import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState, Loading, Notice, PageHeader } from "../components/Ui.jsx";
import { getApiError } from "../context/AuthContext.jsx";
import api from "../lib/api.js";

export default function EmergencyContacts() {
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/facilities")
      .then(({ data }) => setFacilities(data.facilities))
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
              {facility.phone ? <a className="mt-3 inline-block font-semibold text-teal-800 underline underline-offset-2" href={`tel:${facility.phone}`}>{facility.phone}</a> : <p className="mt-3 text-sm text-slate-500">No contact number listed.</p>}
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
