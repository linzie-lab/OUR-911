import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState, Loading, Notice, PageHeader } from "../components/Ui.jsx";
import { getApiError } from "../context/AuthContext.jsx";
import api from "../lib/api.js";

export default function EmergencyContacts() {
  const [facilities, setFacilities] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api.get("/facilities"), api.get("/emergency-contacts")])
      .then(([facilityResponse, contactResponse]) => {
        setFacilities(facilityResponse.data.facilities);
        setContacts(contactResponse.data.contacts);
      })
      .catch((requestError) => setError(getApiError(requestError)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="mx-auto max-w-5xl">
      <PageHeader eyebrow="Health services" title="Emergency contacts" description="Contact details shown here come from active directory records. Confirm unverified details with the facility." />
      <Notice className="mb-5" kind="warning">
        OUR 911 is not an ambulance dispatch service. For a life-threatening emergency, contact your local emergency services immediately. No unverified emergency number is provided here.
      </Notice>
      {error && <div className="mb-4"><Notice kind="error">{error}</Notice></div>}
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-bold text-slate-950">Emergency services</h2>
        {loading ? <Loading label="Loading verified emergency contacts…" /> : contacts.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {contacts.map((contact) => (
              <article className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={contact.id}>
                <div>
                  <p className="font-bold text-slate-950">{contact.name}</p>
                  <p className="mt-1 text-sm capitalize text-slate-600">{contact.category} · verified contact</p>
                  {contact.location && <p className="mt-1 text-xs text-slate-500">{contact.location}</p>}
                </div>
                <a className="shrink-0 rounded-lg bg-rose-700 px-3 py-2 text-sm font-bold text-white hover:bg-rose-800" href={`tel:${contact.phone}`}>Call now · {contact.phone}</a>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="No verified contacts are configured">
            Ask an administrator to verify additional ambulance, fire and facility contacts. We never invent facility numbers.
          </EmptyState>
        )}
      </section>
      <h2 className="mb-3 text-lg font-bold text-slate-950">Health facilities</h2>
      {loading ? <Loading label="Loading facility contacts…" /> : facilities.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {facilities.map((facility) => (
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={facility.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-bold text-slate-950">{facility.name}</h2>
                  <p className="mt-1 text-sm capitalize text-slate-600">{facility.facility_type}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${facility.is_verified ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>
                  {facility.is_verified ? "Verified" : "Unverified"}
                </span>
              </div>
              <p className="mt-3 text-sm text-slate-700">{facility.address}</p>
              {facility.phone && facility.is_verified ? <a className="mt-3 inline-block font-semibold text-teal-800 underline underline-offset-2" href={`tel:${facility.phone}`}>Call now · {facility.phone}</a> : <p className="mt-3 text-sm text-slate-500">{facility.phone ? "Phone number has not been verified." : "No contact number listed."}</p>}
              <Link className="mt-4 block text-sm font-semibold text-teal-800 hover:underline" to={`/facilities?search=${encodeURIComponent(facility.name)}`}>View facility details →</Link>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title="No facility contacts are listed">
          The directory has no active facility records yet. We do not display fictional locations or phone numbers.
        </EmptyState>
      )}
    </main>
  );
}
