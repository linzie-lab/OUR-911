import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { EmptyState, Loading, Notice, PageHeader } from "../components/Ui.jsx";
import { getApiError, useAuth } from "../context/AuthContext.jsx";
import api from "../lib/api.js";

const blankFacility = {
  name: "",
  facility_type: "",
  address: "",
  phone: "",
  services: "",
  operating_hours: "",
  description: "",
  is_verified: false,
};

export default function FacilityDirectory() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const isAdmin = user?.role === "admin";
  const [facilities, setFacilities] = useState([]);
  const [types, setTypes] = useState([]);
  const [query, setQuery] = useState(() => searchParams.get("search") ?? "");
  const [facilityType, setFacilityType] = useState("");
  const [form, setForm] = useState(blankFacility);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadFacilities = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/facilities", {
        params: { search: query || undefined, type: facilityType || undefined },
      });
      setFacilities(data.facilities);
      setTypes([...new Set(data.facilities.map((facility) => facility.facility_type))]);
      setError("");
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setLoading(false);
    }
  }, [facilityType, query]);

  useEffect(() => {
    loadFacilities();
  }, [loadFacilities]);

  useEffect(() => {
    setQuery(searchParams.get("search") ?? "");
  }, [searchParams]);

  async function submitFacility(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const payload = {
      ...form,
      services: form.services.split(",").map((service) => service.trim()).filter(Boolean),
      phone: form.phone || null,
      operating_hours: form.operating_hours || null,
      description: form.description || null,
    };
    try {
      if (editingId) {
        await api.patch(`/facilities/${editingId}`, payload);
        setNotice("Facility updated.");
      } else {
        await api.post("/facilities", payload);
        setNotice("Facility added to the directory.");
      }
      setForm(blankFacility);
      setEditingId(null);
      setShowForm(false);
      await loadFacilities();
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setBusy(false);
    }
  }

  function startEdit(facility) {
    setEditingId(facility.id);
    setForm({
      name: facility.name,
      facility_type: facility.facility_type,
      address: facility.address,
      phone: facility.phone ?? "",
      services: facility.services.join(", "),
      operating_hours: facility.operating_hours ?? "",
      description: facility.description ?? "",
      is_verified: facility.is_verified,
    });
    setShowForm(true);
  }

  async function removeFacility(id) {
    if (!window.confirm("Remove this facility from the public directory?")) return;
    try {
      await api.delete(`/facilities/${id}`);
      setNotice("Facility removed from the directory.");
      await loadFacilities();
    } catch (requestError) {
      setError(getApiError(requestError));
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Find care"
        title="Health Facility Directory"
        description="Browse campus and community care locations. Unverified information is labelled and should be confirmed directly with the facility."
      >
        {isAdmin && (
          <button
            className="rounded-lg bg-teal-800 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-900"
            onClick={() => {
              setShowForm(!showForm);
              setEditingId(null);
              setForm(blankFacility);
            }}
            type="button"
          >
            {showForm ? "Close form" : "Add facility"}
          </button>
        )}
      </PageHeader>
      {error && <div className="mb-4"><Notice kind="error">{error}</Notice></div>}
      {notice && <div className="mb-4"><Notice kind="success">{notice}</Notice></div>}

      {isAdmin && showForm && (
        <form className="mb-7 grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2" onSubmit={submitFacility}>
          <h2 className="text-lg font-bold sm:col-span-2">{editingId ? "Edit facility" : "New facility"}</h2>
          {[
            ["name", "Facility name", true],
            ["facility_type", "Type (clinic, pharmacy, counselling)", true],
            ["address", "Address or location", true],
            ["phone", "Contact phone", false],
            ["operating_hours", "Operating hours (verified only)", false],
            ["services", "Services (comma separated)", false],
          ].map(([key, label, required]) => (
            <label className="text-sm font-semibold text-slate-700" key={key}>
              {label}
              <input
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"
                onChange={(event) => setForm({ ...form, [key]: event.target.value })}
                required={required}
                value={form[key]}
              />
            </label>
          ))}
          <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
            Description
            <textarea
              className="mt-1.5 min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              value={form.description}
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
            <input
              checked={form.is_verified}
              onChange={(event) => setForm({ ...form, is_verified: event.target.checked })}
              type="checkbox"
            />
            Mark verified only after confirming the information with the facility
          </label>
          <button className="rounded-lg bg-teal-800 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60 sm:col-span-2" disabled={busy} type="submit">
            {busy ? "Saving…" : editingId ? "Save facility" : "Add facility"}
          </button>
        </form>
      )}

      <section className="mb-5 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_220px]">
        <label className="text-sm font-semibold text-slate-700">
          Search by name
          <input
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search facility directory"
            value={query}
          />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Facility type
          <select
            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal"
            onChange={(event) => setFacilityType(event.target.value)}
            value={facilityType}
          >
            <option value="">All types</option>
            {types.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </label>
      </section>
      {loading ? <Loading label="Searching facilities…" /> : facilities.length === 0 ? (
        <EmptyState title="No facility records found">
          No verified facilities are currently listed. Administrators can add records after confirming their details; no demonstration contacts are shown.
        </EmptyState>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {facilities.map((facility) => (
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={facility.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-teal-800">{facility.facility_type}</p>
                  <h2 className="mt-1 text-lg font-bold">{facility.name}</h2>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${facility.is_verified ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"}`}>
                  {facility.is_verified ? "Verified" : "Not verified"}
                </span>
              </div>
              <p className="mt-3 text-sm text-slate-700">{facility.address}</p>
              {facility.phone && <p className="mt-2 text-sm"><a className="font-semibold text-teal-800 underline" href={`tel:${facility.phone}`}>{facility.phone}</a></p>}
              {facility.operating_hours && <p className="mt-2 text-sm text-slate-600">Hours: {facility.operating_hours}</p>}
              {facility.services.length > 0 && <p className="mt-2 text-sm text-slate-600">Services: {facility.services.join(", ")}</p>}
              {facility.description && <p className="mt-3 text-sm leading-6 text-slate-600">{facility.description}</p>}
              {isAdmin && (
                <div className="mt-4 flex gap-2 border-t border-slate-100 pt-4">
                  <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold" onClick={() => startEdit(facility)} type="button">Edit</button>
                  <button className="rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-800" onClick={() => removeFacility(facility.id)} type="button">Remove</button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
