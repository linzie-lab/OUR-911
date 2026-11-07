import { useCallback, useEffect, useState } from "react";
import { EmptyState, Loading, Notice, PageHeader } from "../components/Ui.jsx";
import { getApiError, useAuth } from "../context/AuthContext.jsx";
import api from "../lib/api.js";

const categories = [
  ["medical_emergency", "Medical emergency"],
  ["injury", "Injury"],
  ["sudden_illness", "Sudden illness"],
  ["mental_health_concern", "Mental health concern"],
  ["accident", "Accident"],
  ["other", "Other"],
];
const severities = ["low", "medium", "high", "critical"];
const statuses = ["submitted", "under_review", "resolved"];

function humanize(value) {
  return value?.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function IncidentCard({ incident, staff, onStatusChange, busyId }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold text-slate-950">{humanize(incident.category)}</h3>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
              {humanize(incident.status)}
            </span>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              incident.severity === "critical" || incident.severity === "high"
                ? "bg-rose-100 text-rose-800"
                : "bg-amber-100 text-amber-900"
            }`}>
              {humanize(incident.severity)}
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-600">{incident.location || "Location not provided"}</p>
          {staff && incident.reporter && (
            <p className="mt-1 text-xs text-slate-500">
              Reported by {incident.reporter.name} · {incident.reporter.email}
            </p>
          )}
        </div>
        <time className="text-xs text-slate-500" dateTime={incident.created_at}>
          {new Date(incident.created_at).toLocaleString()}
        </time>
      </div>
      <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">
        {incident.description}
      </p>
      {staff && incident.contact_info && (
        <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
          Contact provided: {incident.contact_info}
        </p>
      )}
      {incident.history?.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-semibold text-teal-800">
            Status history ({incident.history.length})
          </summary>
          <ol className="mt-3 space-y-2 border-l-2 border-slate-200 pl-4">
            {incident.history.map((item) => (
              <li className="text-sm text-slate-600" key={item.id}>
                <strong>{humanize(item.status)}</strong> · {item.message}{" "}
                <span className="text-xs text-slate-500">
                  {new Date(item.created_at).toLocaleString()}
                </span>
              </li>
            ))}
          </ol>
        </details>
      )}
      {staff && incident.status !== "resolved" && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          <span className="text-sm font-semibold text-slate-700">Update status:</span>
          {statuses
            .filter((status) => status !== incident.status)
            .map((status) => (
              <button
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 disabled:opacity-60"
                disabled={busyId === incident.id}
                key={status}
                onClick={() => onStatusChange(incident.id, status)}
                type="button"
              >
                {humanize(status)}
              </button>
            ))}
        </div>
      )}
    </article>
  );
}

export default function IncidentReporting() {
  const { user, guest } = useAuth();
  const staff = user?.role === "admin" || user?.role === "health_personnel";
  const [zones, setZones] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [form, setForm] = useState({
    category: "medical_emergency",
    description: "",
    location: "",
    zone_id: "",
    severity: "medium",
    contact_info: "",
  });
  const [filter, setFilter] = useState({ category: "", severity: "", status: "" });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [zoneForm, setZoneForm] = useState({
    name: "",
    latitude: "",
    longitude: "",
    description: "",
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = Object.fromEntries(
        Object.entries(filter).filter(([, value]) => value),
      );
      const zoneRequest = api.get("/campus-zones");
      const incidentRequest = user
        ? api.get(staff ? "/incidents" : "/incidents/mine", { params: staff ? params : {} })
        : Promise.resolve({ data: { incidents: [] } });
      const [incidentResponse, zoneResponse] = await Promise.all([
        incidentRequest,
        zoneRequest,
      ]);
      setIncidents(incidentResponse.data.incidents);
      setZones(zoneResponse.data.zones);
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setLoading(false);
    }
  }, [filter, staff, user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function submitIncident(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { data } = await api.post(user ? "/incidents" : "/incidents/guest", {
        ...form,
        zone_id: form.zone_id || null,
        contact_info: form.contact_info || null,
      });
      setForm({
        category: "medical_emergency",
        description: "",
        location: "",
        zone_id: "",
        severity: "medium",
        contact_info: "",
      });
      setNotice(user
        ? "Your report was submitted. You can track its status below."
        : data.message);
      await loadData();
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setBusy(false);
    }
  }

  async function updateStatus(incidentId, status) {
    setBusyId(incidentId);
    setError("");
    try {
      await api.patch(`/incidents/${incidentId}/status`, { status });
      setNotice("Incident status updated.");
      await loadData();
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setBusyId(null);
    }
  }

  async function createZone(event) {
    event.preventDefault();
    setError("");
    try {
      const { data } = await api.post("/campus-zones", {
        ...zoneForm,
        latitude: Number(zoneForm.latitude),
        longitude: Number(zoneForm.longitude),
      });
      setZones((current) => [...current, data.zone].sort((a, b) => a.name.localeCompare(b.name)));
      setZoneForm({ name: "", latitude: "", longitude: "", description: "" });
      setNotice("Campus zone added to the location selector.");
    } catch (requestError) {
      setError(getApiError(requestError));
    }
  }

  return (
    <main className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow="Campus health response"
        title={staff ? "Incident reports" : "Report a health incident"}
        description={staff
          ? "Review reports and record status updates. Student identities and contact details are visible only to authorized staff."
          : "For emergencies, call local emergency services first. Signed-in reports are private to you and authorized campus health staff."}
      />
      {guest && <Notice className="mb-4" kind="info">You are reporting as a guest. Staff can review your report, but it will not be linked to an account and cannot be tracked from this device.</Notice>}
      {error && <Notice className="mb-4" kind="error">{error}</Notice>}
      {notice && <div className="mb-4"><Notice kind="success">{notice}</Notice></div>}

      {user?.role === "admin" && (
        <details className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <summary className="cursor-pointer font-bold">Manage campus location options</summary>
          <p className="mt-2 text-sm text-slate-600">
            Add real campus locations so students can select them in reports. Coordinates are used for campus records only.
          </p>
          <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={createZone}>
            <input
              aria-label="Campus zone name"
              className="rounded-lg border border-slate-300 px-3 py-2.5"
              maxLength={120}
              onChange={(event) => setZoneForm({ ...zoneForm, name: event.target.value })}
              placeholder="Zone name (e.g. North Library)"
              required
              value={zoneForm.name}
            />
            <input
              aria-label="Description"
              className="rounded-lg border border-slate-300 px-3 py-2.5"
              onChange={(event) => setZoneForm({ ...zoneForm, description: event.target.value })}
              placeholder="Description (optional)"
              value={zoneForm.description}
            />
            <input
              aria-label="Latitude"
              className="rounded-lg border border-slate-300 px-3 py-2.5"
              max="90"
              min="-90"
              onChange={(event) => setZoneForm({ ...zoneForm, latitude: event.target.value })}
              placeholder="Latitude"
              required
              step="any"
              type="number"
              value={zoneForm.latitude}
            />
            <input
              aria-label="Longitude"
              className="rounded-lg border border-slate-300 px-3 py-2.5"
              max="180"
              min="-180"
              onChange={(event) => setZoneForm({ ...zoneForm, longitude: event.target.value })}
              placeholder="Longitude"
              required
              step="any"
              type="number"
              value={zoneForm.longitude}
            />
            <button className="rounded-lg bg-teal-800 px-4 py-2.5 text-sm font-bold text-white sm:col-span-2" type="submit">
              Add location
            </button>
          </form>
        </details>
      )}

      {!staff && (
        <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <h2 className="text-lg font-bold">New incident report</h2>
          <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={submitIncident}>
            <label className="text-sm font-semibold text-slate-700">
              Incident category
              <select
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal"
                onChange={(event) => setForm({ ...form, category: event.target.value })}
                value={form.category}
              >
                {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Severity
              <select
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal capitalize"
                onChange={(event) => setForm({ ...form, severity: event.target.value })}
                value={form.severity}
              >
                {severities.map((value) => <option key={value} value={value}>{humanize(value)}</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
              Campus location
              {zones.length > 0 ? (
                <select
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal"
                  onChange={(event) => {
                    const zone = zones.find((item) => String(item.id) === event.target.value);
                    setForm({ ...form, zone_id: event.target.value, location: zone?.name ?? "" });
                  }}
                  required
                  value={form.zone_id}
                >
                  <option value="">Choose a campus zone</option>
                  {zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}
                </select>
              ) : (
                <>
                  <input
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"
                    maxLength={255}
                    onChange={(event) => setForm({ ...form, location: event.target.value })}
                    placeholder="Building, room, or campus area"
                    required
                    value={form.location}
                  />
                  <span className="mt-1 block text-xs font-normal text-slate-500">
                    Campus zones have not been configured; enter the location clearly.
                  </span>
                </>
              )}
            </label>
            <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
              What happened?
              <textarea
                className="mt-1.5 min-h-28 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"
                maxLength={5000}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                required
                value={form.description}
              />
            </label>
            <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
              Contact information <span className="font-normal text-slate-500">(optional, visible to authorized staff only)</span>
              <input
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"
                maxLength={120}
                onChange={(event) => setForm({ ...form, contact_info: event.target.value })}
                value={form.contact_info}
              />
            </label>
            <button
              className="rounded-lg bg-teal-800 px-5 py-3 text-sm font-bold text-white hover:bg-teal-900 disabled:opacity-60 sm:col-span-2"
              disabled={busy}
              type="submit"
            >
              {busy ? "Submitting…" : "Submit incident report"}
            </button>
          </form>
        </section>
      )}

      {user && <section id="my-reports">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-bold">{staff ? "Campus reports" : "Your reports"}</h2>
            <p className="mt-1 text-sm text-slate-600">
              {staff ? "Review reports and update response status." : "Your reports are private to you and authorized staff."}
            </p>
          </div>
          {staff && (
            <div className="grid grid-cols-3 gap-2">
              {["category", "severity", "status"].map((key) => (
                <select
                  aria-label={`Filter by ${key}`}
                  className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs capitalize"
                  key={key}
                  onChange={(event) => setFilter({ ...filter, [key]: event.target.value })}
                  value={filter[key]}
                >
                  <option value="">All {key}</option>
                  {(key === "category" ? categories.map(([value]) => value)
                    : key === "severity" ? severities : statuses).map((value) => (
                    <option key={value} value={value}>{humanize(value)}</option>
                  ))}
                </select>
              ))}
            </div>
          )}
        </div>
        {loading ? <Loading label="Loading incident reports…" /> : incidents.length === 0 ? (
          <EmptyState title="No incident reports yet">
            {staff ? "New campus reports will appear here." : "After you submit a report, you can follow its status here."}
          </EmptyState>
        ) : (
          <div className="space-y-3">
            {incidents.map((incident) => (
              <IncidentCard
                busyId={busyId}
                incident={incident}
                key={incident.id}
                onStatusChange={updateStatus}
                staff={staff}
              />
            ))}
          </div>
        )}
      </section>}
    </main>
  );
}
