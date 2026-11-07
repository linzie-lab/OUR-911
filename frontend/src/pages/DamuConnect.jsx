import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { EmptyState, Loading, Notice, PageHeader } from "../components/Ui.jsx";
import { getApiError, useAuth } from "../context/AuthContext.jsx";
import api from "../lib/api.js";

const bloodTypes = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const priorities = ["low", "medium", "high", "critical"];
const requestStatuses = ["open", "partially_fulfilled", "fulfilled", "cancelled"];

function pretty(value) {
  return value?.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function DamuConnect() {
  const { user, guest } = useAuth();
  const location = useLocation();
  const staff = user?.role === "admin" || (
    user?.role === "health_personnel" && user?.responder_approved
  );
  const [donor, setDonor] = useState(null);
  const [donorForm, setDonorForm] = useState({ blood_type: "O+", phone: "", location: "" });
  const [requests, setRequests] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [requestForm, setRequestForm] = useState({
    blood_type: "O+",
    units_requested: "1",
    priority: "medium",
    facility_id: "",
    facility_name: "",
    contact_name: "",
    contact_phone: "",
    notes: "",
  });
  const [donors, setDonors] = useState([]);
  const [donorFilter, setDonorFilter] = useState({ blood_type: "", location: "" });
  const [matchResults, setMatchResults] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [profile, requestResponse, facilityResponse] = await Promise.all([
        api.get("/damu/donors/me"),
        api.get("/damu/requests"),
        api.get("/facilities"),
      ]);
      setDonor(profile.data.donor);
      if (profile.data.donor) {
        setDonorForm({
          blood_type: profile.data.donor.blood_type,
          phone: profile.data.donor.phone,
          location: profile.data.donor.location ?? "",
        });
      }
      setRequests(requestResponse.data.requests);
      setFacilities(facilityResponse.data.facilities);
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (loading || !location.hash) return undefined;
    const timer = window.setTimeout(() => {
      document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: "smooth" });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loading, location.hash]);

  async function saveDonor(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { data } = await api.post("/damu/donors", {
        ...donorForm,
        is_available: donor?.is_available ?? true,
        location: donorForm.location || null,
      });
      setDonor(data.donor);
      setNotice("Your voluntary donor profile has been saved. Only authorized health staff can view your contact details.");
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setBusy(false);
    }
  }

  async function setAvailability(available) {
    try {
      const { data } = await api.patch("/damu/donors/me", { is_available: available });
      setDonor(data.donor);
      setNotice(available ? "You are marked as available." : "Your availability has been withdrawn.");
    } catch (requestError) {
      setError(getApiError(requestError));
    }
  }

  async function submitRequest(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api.post("/damu/requests", {
        ...requestForm,
        units_requested: Number(requestForm.units_requested),
        facility_id: requestForm.facility_id || null,
        facility_name: requestForm.facility_id
          ? facilities.find((item) => String(item.id) === requestForm.facility_id)?.name
          : requestForm.facility_name,
        notes: requestForm.notes || null,
      });
      setRequestForm({
        ...requestForm,
        units_requested: "1",
        contact_name: "",
        contact_phone: "",
        notes: "",
      });
      setNotice("Blood request submitted. Track status updates below.");
      await loadData();
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setBusy(false);
    }
  }

  async function searchDonors() {
    setError("");
    try {
      const { data } = await api.get("/damu/admin/donors", {
        params: {
          blood_type: donorFilter.blood_type || undefined,
          location: donorFilter.location || undefined,
        },
      });
      setDonors(data.donors);
    } catch (requestError) {
      setError(getApiError(requestError));
    }
  }

  async function updateRequest(requestId, status) {
    try {
      await api.patch(`/damu/requests/${requestId}/status`, { status });
      setNotice("Request status updated.");
      await loadData();
    } catch (requestError) {
      setError(getApiError(requestError));
    }
  }

  async function findMatches(requestId) {
    setError("");
    try {
      const { data } = await api.get(`/damu/requests/${requestId}/matches`);
      setMatchResults((current) => ({ ...current, [requestId]: data }));
    } catch (requestError) {
      setError(getApiError(requestError));
    }
  }

  async function recordMatch(requestId, donorId) {
    try {
      await api.post(`/damu/requests/${requestId}/matches`, { donor_id: donorId });
      setNotice("Donor contact initiated by authorized staff and match recorded.");
      await findMatches(requestId);
    } catch (requestError) {
      setError(getApiError(requestError));
    }
  }

  async function recordOutcome(matchId, status) {
    try {
      await api.patch(`/damu/matches/${matchId}`, { status });
      setNotice("Coordination outcome recorded.");
      await loadData();
    } catch (requestError) {
      setError(getApiError(requestError));
    }
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-3xl">
        <PageHeader title="DamuConnect" description="Voluntary donor discovery and blood request coordination." />
        <Notice>
          {guest ? "You are using guest access. " : ""}
          <Link className="font-bold underline" to="/login">Sign in</Link> to register as a donor or submit and track a blood request. Donor contact details are not public.
        </Notice>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow="Voluntary blood donation"
        title="DamuConnect"
        description="A coordination tool to connect requests with volunteers. This is not a compatibility engine; all screening and transfusion decisions belong to qualified healthcare professionals."
      />
      {error && <div className="mb-4"><Notice kind="error">{error}</Notice></div>}
      {notice && <div className="mb-4"><Notice kind="success">{notice}</Notice></div>}
      <div className="mb-5" id="information">
        <Notice kind="warning">DamuConnect is a preliminary coordination tool, not a medical compatibility engine. Final donor screening and transfusion decisions belong to qualified healthcare professionals.</Notice>
      </div>
      {loading ? <Loading label="Loading DamuConnect…" /> : (
        <>
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6" id="donor-registration">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold">Volunteer as a donor</h2>
                  <p className="mt-1 text-sm text-slate-600">Your phone is only shared with authorized health staff.</p>
                </div>
                {donor && (
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${donor.is_available ? "bg-emerald-100 text-emerald-900" : "bg-slate-100 text-slate-700"}`}>
                    {donor.is_available ? "Available" : "Unavailable"}
                  </span>
                )}
              </div>
              <form className="mt-5 grid gap-3 sm:grid-cols-2" onSubmit={saveDonor}>
                <label className="text-sm font-semibold text-slate-700">
                  Blood group
                  <select className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal" onChange={(event) => setDonorForm({ ...donorForm, blood_type: event.target.value })} value={donorForm.blood_type}>
                    {bloodTypes.map((type) => <option key={type}>{type}</option>)}
                  </select>
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  Contact phone
                  <input className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" maxLength={32} onChange={(event) => setDonorForm({ ...donorForm, phone: event.target.value })} required value={donorForm.phone} />
                </label>
                <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
                  General location (optional)
                  <input className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" maxLength={160} onChange={(event) => setDonorForm({ ...donorForm, location: event.target.value })} value={donorForm.location} />
                </label>
                <button className="rounded-lg bg-teal-800 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60 sm:col-span-2" disabled={busy} type="submit">
                  {busy ? "Saving…" : donor ? "Update donor profile" : "Register as a voluntary donor"}
                </button>
              </form>
              {donor && (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                  <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold" onClick={() => setAvailability(!donor.is_available)} type="button">
                    {donor.is_available ? "Withdraw availability" : "Mark available"}
                  </button>
                </div>
              )}
            </section>

            <section className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6" id="requests">
              <h2 className="text-lg font-bold">Submit a blood request</h2>
              <p className="mt-1 text-sm text-slate-600">Only authorized staff can view the contact details.</p>
              <form className="mt-5 grid gap-3 sm:grid-cols-2" onSubmit={submitRequest}>
                <label className="text-sm font-semibold text-slate-700">
                  Blood group needed
                  <select className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal" onChange={(event) => setRequestForm({ ...requestForm, blood_type: event.target.value })} value={requestForm.blood_type}>
                    {bloodTypes.map((type) => <option key={type}>{type}</option>)}
                  </select>
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  Units requested
                  <input className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" max="100" min="1" onChange={(event) => setRequestForm({ ...requestForm, units_requested: event.target.value })} required type="number" value={requestForm.units_requested} />
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  Urgency
                  <select className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal" onChange={(event) => setRequestForm({ ...requestForm, priority: event.target.value })} value={requestForm.priority}>
                    {priorities.map((value) => <option key={value} value={value}>{pretty(value)}</option>)}
                  </select>
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  Facility
                  {facilities.length ? (
                    <select className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal" onChange={(event) => setRequestForm({ ...requestForm, facility_id: event.target.value, facility_name: "" })} value={requestForm.facility_id}>
                      <option value="">Choose or enter facility below</option>
                      {facilities.map((facility) => <option key={facility.id} value={facility.id}>{facility.name}</option>)}
                    </select>
                  ) : (
                    <input className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" onChange={(event) => setRequestForm({ ...requestForm, facility_name: event.target.value, facility_id: "" })} placeholder="Hospital or collection center" required value={requestForm.facility_name} />
                  )}
                  {facilities.length > 0 && !requestForm.facility_id && (
                    <input className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" onChange={(event) => setRequestForm({ ...requestForm, facility_name: event.target.value })} placeholder="Or enter another facility" required={!requestForm.facility_id} value={requestForm.facility_name} />
                  )}
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  Authorized contact
                  <input className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" maxLength={120} onChange={(event) => setRequestForm({ ...requestForm, contact_name: event.target.value })} required value={requestForm.contact_name} />
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  Contact phone
                  <input className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" maxLength={32} onChange={(event) => setRequestForm({ ...requestForm, contact_phone: event.target.value })} required value={requestForm.contact_phone} />
                </label>
                <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
                  Notes (optional)
                  <textarea className="mt-1.5 min-h-16 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" maxLength={2000} onChange={(event) => setRequestForm({ ...requestForm, notes: event.target.value })} value={requestForm.notes} />
                </label>
                <button className="rounded-lg bg-rose-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60 sm:col-span-2" disabled={busy} type="submit">
                  {busy ? "Submitting…" : "Submit blood request"}
                </button>
              </form>
            </section>
          </div>

          {!staff && (
            <section className="mt-7 scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6" id="donors">
              <h2 className="text-lg font-bold">Find a blood donor</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Donor discovery and contact sharing are managed by authorized health personnel to protect volunteers. Submit a request above and the team can coordinate with available donors.
              </p>
            </section>
          )}

          {staff && (
            <section className="mt-7 scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6" id="donors">
              <h2 className="text-lg font-bold">Authorized donor discovery</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Contact information is displayed only to authorized staff. A matching blood group and location are preliminary search criteria only—not a compatibility assessment.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                <select className="rounded-lg border border-slate-300 bg-white px-3 py-2.5" onChange={(event) => setDonorFilter({ ...donorFilter, blood_type: event.target.value })} value={donorFilter.blood_type}>
                  <option value="">All blood groups</option>
                  {bloodTypes.map((type) => <option key={type}>{type}</option>)}
                </select>
                <input className="rounded-lg border border-slate-300 px-3 py-2.5" onChange={(event) => setDonorFilter({ ...donorFilter, location: event.target.value })} placeholder="Filter by general location" value={donorFilter.location} />
                <button className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white" onClick={searchDonors} type="button">Search donors</button>
              </div>
              {donors.length > 0 && (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead className="text-xs uppercase text-slate-500"><tr><th className="pb-2 pr-3">Name</th><th className="pb-2 pr-3">Group</th><th className="pb-2 pr-3">Location</th><th className="pb-2 pr-3">Contact (authorized)</th><th className="pb-2">Status</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">{donors.map((item) => (
                      <tr key={item.id}><td className="py-2.5 pr-3">{item.name}</td><td className="py-2.5 pr-3 font-bold">{item.blood_type}</td><td className="py-2.5 pr-3">{item.location || "—"}</td><td className="py-2.5 pr-3">{item.phone}</td><td className="py-2.5">{item.is_available ? "Available" : "Unavailable"}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          <section className="mt-7 scroll-mt-24" id="request-tracking">
            <h2 className="text-xl font-bold">{staff ? "Blood requests" : "Your blood requests"}</h2>
            {requests.length === 0 ? (
              <div className="mt-3"><EmptyState title="No blood requests yet">Submitted requests and their coordination status will appear here.</EmptyState></div>
            ) : (
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                {requests.map((item) => (
                  <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={item.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div><h3 className="font-bold">{item.blood_type} · {item.units_requested} unit{item.units_requested === 1 ? "" : "s"}</h3><p className="mt-1 text-sm text-slate-600">{item.facility || "Facility not specified"} · {pretty(item.priority)} urgency</p></div>
                      <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-900">{pretty(item.status)}</span>
                    </div>
                    {staff && <p className="mt-3 text-sm text-slate-600">Requested by {item.requested_by} · Contact: {item.contact_name} {item.contact_phone}</p>}
                    {item.notes && <p className="mt-2 text-sm text-slate-600">{item.notes}</p>}
                    {staff && item.donor_matches?.length > 0 && (
                      <div className="mt-4 rounded-xl border border-slate-200 p-3">
                        <h4 className="text-sm font-bold">Coordination outcomes</h4>
                        <ul className="mt-2 space-y-3">
                          {item.donor_matches.map((match) => (
                            <li className="flex flex-wrap items-center justify-between gap-2 text-sm" key={match.id}>
                              <span>{match.donor_name} · {match.donor_phone} · {pretty(match.status)}</span>
                              <select
                                aria-label={`Record outcome for ${match.donor_name}`}
                                className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs"
                                onChange={(event) => event.target.value && recordOutcome(match.id, event.target.value)}
                                value=""
                              >
                                <option value="">Record outcome…</option>
                                {["accepted", "declined", "completed", "cancelled"].map((status) => (
                                  <option key={status} value={status}>{pretty(status)}</option>
                                ))}
                              </select>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {staff && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <select aria-label={`Update status for request ${item.id}`} className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm" onChange={(event) => event.target.value && updateRequest(item.id, event.target.value)} value="">
                          <option value="">Update status…</option>
                          {requestStatuses.map((status) => <option key={status} value={status}>{pretty(status)}</option>)}
                        </select>
                        <button className="rounded-lg border border-teal-700 px-3 py-2 text-sm font-semibold text-teal-900" onClick={() => findMatches(item.id)} type="button">Find potential donors</button>
                      </div>
                    )}
                    {staff && matchResults[item.id] && (
                      <div className="mt-4 rounded-xl bg-slate-50 p-4">
                        <p className="text-xs leading-5 text-amber-900">{matchResults[item.id].notice}</p>
                        {matchResults[item.id].donors.length === 0 ? <p className="mt-2 text-sm text-slate-600">No currently available donors found for this blood group.</p> : (
                          <ul className="mt-3 space-y-2">{matchResults[item.id].donors.map((candidate) => (
                            <li className="flex flex-wrap items-center justify-between gap-2 text-sm" key={candidate.id}>
                              <span>{candidate.name} · {candidate.location || "Location not provided"} · {candidate.phone}</span>
                              <button className="rounded-lg bg-teal-800 px-3 py-1.5 text-xs font-semibold text-white" onClick={() => recordMatch(item.id, candidate.id)} type="button">Record contact</button>
                            </li>
                          ))}</ul>
                        )}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
          {staff && <Notice kind="warning">Donor discovery is not a medical blood compatibility engine. Qualified healthcare professionals must determine compatibility, screening, and transfusion decisions.</Notice>}
        </>
      )}
    </main>
  );
}
