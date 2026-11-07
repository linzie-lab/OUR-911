import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState, Loading, Notice } from "../components/Ui.jsx";
import { getApiError, useAuth } from "../context/AuthContext.jsx";
import api from "../lib/api.js";

const services = [
  {
    to: "/first-aid",
    label: "First Aid Companion",
    description: "Step-by-step guidance for common emergencies.",
    mark: "+",
    image: "/images/service-first-aid.svg",
    category: "Immediate guidance",
    tone: "bg-teal-50 text-teal-900",
    frame: "bg-[#eaf7f5]",
  },
  {
    to: "/incidents",
    label: "Incident Reporting",
    description: "Report a concern and privately follow its status.",
    mark: "!",
    image: "/images/service-incidents.svg",
    category: "Campus response",
    tone: "bg-rose-50 text-rose-900",
    frame: "bg-[#fff0f1]",
  },
  {
    to: "/intelligence",
    label: "Campus Health Intelligence",
    description: "Explore privacy-preserving campus health trends.",
    mark: "↗",
    image: "/images/service-intelligence.svg",
    category: "Staff workspace",
    tone: "bg-blue-50 text-blue-900",
    frame: "bg-[#edf4fb]",
  },
  {
    to: "/damuconnect",
    label: "DamuConnect",
    description: "Coordinate voluntary donor and blood request support.",
    mark: "♡",
    image: "/images/service-damuconnect.svg",
    category: "Community support",
    tone: "bg-red-50 text-red-900",
    frame: "bg-[#fff0ee]",
  },
  {
    to: "/facilities",
    label: "Health Facilities",
    description: "Search care locations and available contact information.",
    mark: "⌖",
    image: "/images/service-facilities.svg",
    category: "Find care",
    tone: "bg-sky-50 text-sky-900",
    frame: "bg-[#edf5f9]",
  },
];

const statusNames = {
  submitted: "Submitted",
  under_review: "Under review",
  pending: "Pending",
  accepted: "Accepted",
  responding: "Responding",
  rejected: "Rejected",
  resolved: "Resolved",
};

function StatCard({ label, value, note, mark, tone, to }) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-medium text-slate-600">{label}</span>
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold ${tone}`}>{mark}</span>
      </div>
      <p className="mt-4 text-3xl font-bold tracking-tight text-slate-950">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{note}</p>
    </>
  );
  return to ? (
    <Link className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-teal-200 hover:shadow-md sm:p-5" to={to}>{content}</Link>
  ) : (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">{content}</div>
  );
}

export default function Dashboard() {
  const { user, guest } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sosOpen, setSosOpen] = useState(false);
  const [sosBusy, setSosBusy] = useState(false);
  const [sosError, setSosError] = useState("");
  const [sosResult, setSosResult] = useState("");
  const [locationMessage, setLocationMessage] = useState("");
  const [sosForm, setSosForm] = useState({
    category: "medical_emergency",
    description: "",
    location: "",
    latitude: null,
    longitude: null,
  });

  function requestLocation() {
    if (!navigator.geolocation) {
      setLocationMessage("GPS is unavailable in this browser. Enter a location manually.");
      return;
    }
    setLocationMessage("Requesting your location…");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setSosForm((current) => ({
          ...current,
          latitude: coords.latitude,
          longitude: coords.longitude,
        }));
        setLocationMessage("GPS location attached. Add a landmark or description if helpful.");
      },
      () => {
        setSosForm((current) => ({ ...current, latitude: null, longitude: null }));
        setLocationMessage("GPS was unavailable or permission was denied. Enter your location below.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  }

  function openSosForm() {
    if (!window.confirm("Do you need emergency assistance? Continue to prepare an emergency report.")) {
      return;
    }
    setSosOpen(true);
    setSosError("");
    setSosResult("");
    requestLocation();
  }

  async function submitSos(event) {
    event.preventDefault();
    setSosBusy(true);
    setSosError("");
    setSosResult("");
    try {
      const { data: result } = await api.post(user ? "/incidents" : "/incidents/guest", {
        category: sosForm.category,
        description: sosForm.description.trim(),
        location: sosForm.location.trim(),
        latitude: sosForm.latitude,
        longitude: sosForm.longitude,
        severity: "high",
      });
      setSosResult(
        `Report reference OUR-${result.incident?.id ?? result.report_id}. ${
          user ? "Track its status in My Reports." : "This guest report cannot be retrieved later."
        }`,
      );
      if (user) {
        setData((current) => current && ({
          ...current,
          reports: [result.incident, ...current.reports],
        }));
      }
    } catch (requestError) {
      setSosError(getApiError(requestError));
    } finally {
      setSosBusy(false);
    }
  }

  useEffect(() => {
    let active = true;
    async function loadSummary() {
      setLoading(true);
      setError("");
      try {
        const [facilityResponse, donorResponse, reportResponse] = await Promise.all([
          api.get("/facilities/summary"),
          api.get("/damu/summary"),
          user ? api.get("/incidents/mine") : Promise.resolve({ data: { incidents: [] } }),
        ]);
        if (!active) return;
        const reports = reportResponse.data.incidents;
        setData({
          facilities: facilityResponse.data.registered_facilities,
          donors: donorResponse.data.available_donors,
          reports,
          resolved: reports.filter((report) => report.status === "resolved").length,
        });
      } catch {
        if (active) setError("Live dashboard information could not be loaded. Please try again.");
      } finally {
        if (active) setLoading(false);
      }
    }
    loadSummary();
    return () => {
      active = false;
    };
  }, [user]);

  const today = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date());
  const firstName = user?.full_name.split(/\s+/)[0] ?? "there";
  const isStaff = user?.role === "admin" || (
    user?.role === "health_personnel" && user?.responder_approved
  );

  return (
    <main className="space-y-8 pb-4">
      <section className="relative isolate overflow-hidden rounded-[28px] bg-[#102c43] shadow-[0_24px_70px_-38px_rgba(15,42,63,0.65)]">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_68%_45%,rgba(57,139,157,0.28),transparent_44%),linear-gradient(112deg,#102c43_0%,#153d56_55%,#17606c_100%)]" />
        <div className="grid min-h-[310px] lg:grid-cols-[1.05fr_0.95fr]">
          <div className="relative z-10 flex flex-col items-start justify-center px-6 py-8 sm:px-9 sm:py-10 lg:px-11">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-teal-100">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                One unified response
              </span>
              <span className="text-xs font-medium text-slate-300">{today}</span>
            </div>
            <h1 className="mt-5 max-w-xl text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl">
              {user ? `Welcome back, ${firstName}.` : "Welcome to OUR 911."}
            </h1>
            <p className="mt-3 max-w-lg text-sm leading-6 text-slate-200 sm:text-base">
              {user
                ? "We’re here to help you stay informed, find care and support a safer campus."
                : guest
                  ? "You’re here as a guest. Emergency guidance and campus support are ready when you need them."
                  : "An integrated emergency response and life-saving service platform."}
            </p>
            <p className="mt-2 text-sm font-semibold text-teal-200">Every second matters. Every life counts.</p>
            {!user && !guest && (
              <div className="mt-4 flex flex-wrap gap-2">
                <Link className="rounded-lg border border-white/30 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15" to="/login">Sign in</Link>
                <Link className="rounded-lg bg-white px-4 py-2 text-sm font-bold text-[#153d56] transition hover:bg-teal-50" to="/register">Create account</Link>
              </div>
            )}
            <div className="mt-6 flex flex-wrap gap-2">
              <button className="inline-flex items-center gap-2 rounded-xl bg-[#d6283f] px-4 py-3 text-sm font-bold text-white shadow-lg shadow-rose-950/20 transition hover:bg-[#bd1e35] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" onClick={openSosForm} type="button">
                <span aria-hidden="true" className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20">!</span>
                SOS · Report an emergency
                <span aria-hidden="true">→</span>
              </button>
              <Link className="rounded-xl border border-white/25 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15" to="/first-aid">Open First Aid Guide</Link>
            </div>
            <p className="mt-3 text-[11px] leading-5 text-slate-300">
              Life-threatening emergency? Contact local emergency services immediately.
            </p>
          </div>
          <div className="relative min-h-[210px] overflow-hidden lg:min-h-full">
            <div className="absolute inset-0 bg-gradient-to-r from-[#153d56] via-transparent to-transparent lg:z-10 lg:bg-gradient-to-r" />
            <img
              alt="Illustration of campus health professionals providing coordinated care"
              className="absolute inset-0 h-full w-full object-cover object-center opacity-95"
              height="520"
              src="/images/dashboard-hero.svg"
              width="720"
            />
            <div className="absolute bottom-4 right-4 hidden items-center gap-2 rounded-xl border border-white/70 bg-white/90 px-3 py-2 text-xs font-semibold text-slate-700 shadow-lg sm:flex">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">✓</span>
              Campus health, connected
            </div>
          </div>
        </div>
      </section>

      {sosOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-3 sm:p-6" role="presentation">
          <section aria-labelledby="sos-title" aria-modal="true" className="max-h-[95vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-7" role="dialog">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-rose-700">Emergency report</p>
                <h2 className="mt-1 text-xl font-bold text-slate-950" id="sos-title">Do you need emergency assistance?</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">For immediate danger, call emergency services now. Submitting here notifies OUR 911 responders; it does not dispatch an ambulance.</p>
              </div>
              <button aria-label="Close emergency report" className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100" onClick={() => setSosOpen(false)} type="button">Close</button>
            </div>
            {sosError && <div className="mt-4"><Notice kind="error">{sosError}</Notice></div>}
            {sosResult ? (
              <div className="mt-5">
                <Notice kind="success">{sosResult}</Notice>
                <div className="mt-4 flex flex-wrap gap-2">
                  {user && <Link className="rounded-lg bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white" to="/incidents#my-reports" onClick={() => setSosOpen(false)}>View My Reports</Link>}
                  <button className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold" onClick={() => setSosOpen(false)} type="button">Close</button>
                </div>
              </div>
            ) : (
              <form className="mt-5 space-y-4" onSubmit={submitSos}>
                <label className="block text-sm font-semibold text-slate-800">
                  Emergency type
                  <select className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" onChange={(event) => setSosForm((current) => ({ ...current, category: event.target.value }))} value={sosForm.category}>
                    <option value="medical_emergency">Medical emergency</option>
                    <option value="accident">Accident</option>
                    <option value="fire">Fire</option>
                    <option value="security_emergency">Security emergency</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p aria-live="polite" className="text-sm text-slate-700">{locationMessage}</p>
                  <button className="mt-2 text-sm font-semibold text-teal-800 underline" onClick={requestLocation} type="button">Try GPS again</button>
                  {sosForm.latitude !== null && <p className="mt-1 text-xs text-slate-500">Coordinates attached: {sosForm.latitude.toFixed(5)}, {sosForm.longitude.toFixed(5)}</p>}
                </div>
                <label className="block text-sm font-semibold text-slate-800">
                  Location or nearby landmark <span className="font-normal text-slate-500">(required if GPS unavailable)</span>
                  <input className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" maxLength={255} onChange={(event) => setSosForm((current) => ({ ...current, location: event.target.value }))} placeholder="Building, road, campus zone or landmark" required={sosForm.latitude === null} value={sosForm.location} />
                </label>
                <label className="block text-sm font-semibold text-slate-800">
                  Brief description
                  <textarea className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" maxLength={5000} onChange={(event) => setSosForm((current) => ({ ...current, description: event.target.value }))} placeholder="What happened and what help is needed?" required rows={3} value={sosForm.description} />
                </label>
                <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
                  <button className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={() => setSosOpen(false)} type="button">Cancel / Go back</button>
                  <button className="rounded-lg bg-[#c91f35] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#a9182b] disabled:opacity-60" disabled={sosBusy} type="submit">{sosBusy ? "Submitting…" : "Submit emergency report"}</button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}

      {error && <Notice kind="error">{error}</Notice>}
      <section>
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-teal-800">Your campus at a glance</p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-950">Campus overview</h2>
          </div>
          {user && <Link className="text-sm font-semibold text-teal-800 hover:underline" to="/activity">View activity →</Link>}
        </div>
        {loading ? <Loading label="Loading live campus overview…" /> : data ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="My Incident Reports" value={user ? data.reports.length : "—"} note={user ? "Reports linked to your account" : "Sign in to view your private reports"} mark="▤" tone="bg-[#edf3f8] text-[#183f5b]" to={user ? "/incidents#my-reports" : "/login"} />
            <StatCard label="Resolved Reports" value={user ? data.resolved : "—"} note={user ? "Your resolved reports" : "Personal account data"} mark="✓" tone="bg-emerald-50 text-emerald-800" to={user ? "/incidents#my-reports" : "/login"} />
            <StatCard label="Available Blood Donors" value={data.donors} note="Voluntary donor profiles marked available" mark="♡" tone="bg-rose-50 text-rose-800" to="/damuconnect" />
            <StatCard label="Registered Health Facilities" value={data.facilities} note="Active directory listings" mark="⌖" tone="bg-sky-50 text-sky-800" to="/facilities" />
          </div>
        ) : null}
      </section>

      <section>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-teal-800">Explore our services</p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-950">Care and coordination, all in one place</h2>
          </div>
          <p className="text-sm text-slate-500">Choose a service to get started.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {services.map((service) => (
            <Link className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:border-slate-300 hover:shadow-[0_18px_38px_-22px_rgba(15,42,63,0.4)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700" key={service.to} to={service.to}>
              <div className={`relative aspect-[16/8.5] overflow-hidden ${service.frame}`}>
                <img
                  alt=""
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.035]"
                  height="360"
                  loading="lazy"
                  src={service.image}
                  width="640"
                />
                <span className={`absolute left-3 top-3 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] shadow-sm ${service.tone}`}>
                  {service.category}
                </span>
                {service.label === "Campus Health Intelligence" && (
                  <span className="absolute right-3 top-3 rounded-full bg-[#163d5a] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    Staff only
                  </span>
                )}
              </div>
              <div className="p-5">
                <div className="flex items-start gap-3">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base font-bold ${service.tone}`}>{service.mark}</span>
                  <div className="min-w-0">
                    <h3 className="font-bold leading-5 text-slate-950">{service.label}</h3>
                    <p className="mt-1.5 text-sm leading-5 text-slate-600">{service.description}</p>
                  </div>
                </div>
                <span className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#edf3f8] px-3 py-2 text-xs font-bold text-[#173d58] transition group-hover:bg-[#173d58] group-hover:text-white">
                  {service.label === "Campus Health Intelligence" && !isStaff ? "View access details" : "Explore service"}
                  <span aria-hidden="true">→</span>
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_10px_30px_-24px_rgba(15,42,63,0.35)] sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-teal-800">Your account</p>
              <h2 className="mt-1 font-bold text-slate-950">Recent activity</h2>
              <p className="mt-1 text-xs text-slate-500">Your latest incident reports</p>
            </div>
            {user && <Link className="text-xs font-bold text-teal-800 hover:underline" to="/activity">View all</Link>}
          </div>
          {!user ? (
            <EmptyState title="Personal activity is private">
              Sign in to see reports submitted from your account. Guest reports are not linked to or retrievable by other visitors.
            </EmptyState>
          ) : !data?.reports.length ? (
            <EmptyState title="No reports yet">
              Your submitted incident reports will appear here with their latest status.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.reports.slice(0, 4).map((report) => (
                <li className="flex flex-col gap-2 py-3 first:pt-0 sm:flex-row sm:items-center sm:justify-between" key={report.id}>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{report.category.replaceAll("_", " ")}</p>
                    <p className="mt-1 text-xs text-slate-500">{report.location} · {new Date(report.created_at).toLocaleDateString()}</p>
                  </div>
                  <span className="w-fit rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{statusNames[report.status] ?? report.status}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_10px_30px_-24px_rgba(15,42,63,0.35)] sm:p-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-teal-800">Shortcuts</p>
          <h2 className="mt-1 font-bold text-slate-950">Quick access</h2>
          <div className="mt-3 space-y-1">
            {[
              ["/emergency-contacts", "Emergency contacts"],
              ["/damuconnect#donors", "Find a blood donor"],
              ["/damuconnect#requests", "Request blood"],
              ["/profile", user ? "My profile" : "Create an account"],
            ].map(([to, label]) => (
              <Link className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-teal-900" key={to} to={to}>
                {label}<span aria-hidden="true">→</span>
              </Link>
            ))}
          </div>
          {guest && <p className="mt-3 text-xs leading-5 text-slate-500">Some community coordination tools require a signed-in account.</p>}
        </div>
      </section>
    </main>
  );
}
