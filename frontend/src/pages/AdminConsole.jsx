import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState, Loading, Notice, PageHeader } from "../components/Ui.jsx";
import { getApiError } from "../context/AuthContext.jsx";
import api from "../lib/api.js";

const emptyContact = {
  name: "",
  category: "ambulance",
  phone: "",
  location: "",
  is_verified: false,
};

export default function AdminConsole() {
  const [summary, setSummary] = useState(null);
  const [users, setUsers] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [form, setForm] = useState(emptyContact);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadAdminData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [summaryResult, usersResult, contactsResult, incidentsResult] = await Promise.all([
        api.get("/admin/summary"),
        api.get("/admin/users"),
        api.get("/admin/contacts"),
        api.get("/incidents"),
      ]);
      setSummary(summaryResult.data.summary);
      setUsers(usersResult.data.users);
      setContacts(contactsResult.data.contacts);
      setIncidents(incidentsResult.data.incidents);
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  async function updateUser(userId, changes) {
    setBusy(`user-${userId}`);
    setError("");
    try {
      await api.patch(`/admin/users/${userId}`, changes);
      setNotice("Account permissions updated.");
      await loadAdminData();
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setBusy("");
    }
  }

  async function toggleContactActive(contact) {
    setBusy(`contact-${contact.id}`);
    setError("");
    try {
      await api.patch(`/admin/contacts/${contact.id}`, {
        is_active: !contact.is_active,
      });
      setNotice("Emergency contact availability updated.");
      await loadAdminData();
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setBusy("");
    }
  }

  async function createContact(event) {
    event.preventDefault();
    setBusy("contact");
    setError("");
    try {
      await api.post("/admin/contacts", { ...form, location: form.location || null });
      setForm(emptyContact);
      setNotice("Emergency contact saved. Only verified active contacts are public.");
      await loadAdminData();
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setBusy("");
    }
  }

  async function toggleContact(contact) {
    setBusy(`contact-${contact.id}`);
    setError("");
    try {
      await api.patch(`/admin/contacts/${contact.id}`, {
        is_verified: !contact.is_verified,
      });
      setNotice("Emergency contact verification updated.");
      await loadAdminData();
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setBusy("");
    }
  }

  async function assignIncident(incidentId, responderId) {
    if (!responderId) return;
    setBusy(`incident-${incidentId}`);
    setError("");
    try {
      await api.post(`/incidents/${incidentId}/assign`, {
        responder_id: Number(responderId),
      });
      setNotice("Incident assigned to the selected approved responder.");
      await loadAdminData();
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setBusy("");
    }
  }

  const responders = users.filter(
    (account) => account.role === "health_personnel" && account.responder_approved,
  );

  return (
    <main className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow="Administrator workspace"
        title="System administration"
        description="Manage incident response, emergency contacts, responder approvals and account roles."
      >
        <Link className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white" to="/damuconnect">Open DamuConnect</Link>
      </PageHeader>
      {error && <div className="mb-4"><Notice kind="error">{error}</Notice></div>}
      {notice && <div className="mb-4"><Notice kind="success">{notice}</Notice></div>}
      {loading ? <Loading label="Loading administration data…" /> : (
        <div className="space-y-8">
          <section aria-label="System statistics" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {[
              ["Users", summary?.users],
              ["Open incidents", summary?.open_incidents],
              ["Total incidents", summary?.incidents],
              ["Responders awaiting approval", summary?.responders_pending_approval],
              ["Blood requests", summary?.blood_requests],
            ].map(([label, value]) => (
              <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" key={label}>
                <p className="text-sm text-slate-600">{label}</p>
                <p className="mt-2 text-2xl font-bold text-slate-950">{value ?? 0}</p>
              </article>
            ))}
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-slate-950">Incident assignment and history</h2>
            {incidents.length ? (
              <div className="space-y-3">
                {incidents.map((incident) => (
                  <article className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between" key={incident.id}>
                    <div className="min-w-0">
                      <p className="font-bold capitalize text-slate-950">{incident.category.replaceAll("_", " ")} · {incident.response_status ?? incident.status}</p>
                      <p className="mt-1 truncate text-sm text-slate-600">{incident.location} · {new Date(incident.created_at).toLocaleString()}</p>
                      <p className="mt-1 line-clamp-2 text-sm text-slate-600">{incident.description}</p>
                      <Link className="mt-1 inline-block text-xs font-semibold text-teal-800 underline" to="/incidents#my-reports">View report history</Link>
                    </div>
                    <label className="flex shrink-0 items-center gap-2 text-sm font-medium text-slate-700">
                      Assign responder
                      <select
                        className="max-w-52 rounded-lg border border-slate-300 bg-white px-2 py-2"
                        disabled={!responders.length || busy === `incident-${incident.id}`}
                        onChange={(event) => assignIncident(incident.id, event.target.value)}
                        value={incident.assigned_responder?.id ?? ""}
                      >
                        <option value="">Unassigned</option>
                        {responders.map((responder) => <option key={responder.id} value={responder.id}>{responder.full_name}</option>)}
                      </select>
                    </label>
                  </article>
                ))}
              </div>
            ) : <EmptyState title="No incident history">Submitted reports will appear here for administrative review.</EmptyState>}
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-slate-950">User and responder access</h2>
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr><th className="px-4 py-3">Account</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Responder approval</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((account) => (
                    <tr key={account.id}>
                      <td className="px-4 py-3"><p className="font-semibold text-slate-900">{account.full_name}</p><p className="text-xs text-slate-500">{account.email}</p></td>
                      <td className="px-4 py-3">
                        <select
                          aria-label={`Role for ${account.full_name}`}
                          className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 capitalize"
                          disabled={busy === `user-${account.id}`}
                          onChange={(event) => updateUser(account.id, {
                            role: event.target.value,
                            ...(event.target.value === "health_personnel" ? { responder_approved: false } : {}),
                          })}
                          value={account.role}
                        >
                          <option value="student">Normal user</option>
                          <option value="health_personnel">Emergency responder</option>
                          <option value="admin">Administrator</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        {account.role === "health_personnel" ? (
                          <label className="inline-flex items-center gap-2">
                            <input
                              checked={account.responder_approved}
                              disabled={busy === `user-${account.id}`}
                              onChange={(event) => updateUser(account.id, { responder_approved: event.target.checked })}
                              type="checkbox"
                            />
                            {account.responder_approved ? "Approved" : "Pending"}
                          </label>
                        ) : <span className="text-slate-400">Not applicable</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
            <form className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" onSubmit={createContact}>
              <h2 className="text-lg font-bold">Configure emergency contact</h2>
              <p className="mt-1 text-sm text-slate-600">Additional numbers are public only after an administrator verifies them.</p>
              <div className="mt-4 space-y-3">
                <input aria-label="Contact name" className="w-full rounded-lg border border-slate-300 px-3 py-2.5" maxLength={160} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Service or facility name" required value={form.name} />
                <select aria-label="Contact category" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5" onChange={(event) => setForm({ ...form, category: event.target.value })} value={form.category}>
                  {["police", "general", "ambulance", "fire", "facility"].map((category) => <option className="capitalize" key={category} value={category}>{category}</option>)}
                </select>
                <input aria-label="Telephone number" className="w-full rounded-lg border border-slate-300 px-3 py-2.5" maxLength={32} placeholder="Telephone number" required onChange={(event) => setForm({ ...form, phone: event.target.value })} value={form.phone} />
                <input aria-label="Contact location" className="w-full rounded-lg border border-slate-300 px-3 py-2.5" maxLength={255} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="Location (optional)" value={form.location} />
                <label className="flex items-center gap-2 text-sm text-slate-700"><input checked={form.is_verified} onChange={(event) => setForm({ ...form, is_verified: event.target.checked })} type="checkbox" />I have independently verified this number</label>
                <button className="rounded-lg bg-teal-800 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60" disabled={busy === "contact"} type="submit">{busy === "contact" ? "Saving…" : "Save contact"}</button>
              </div>
            </form>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold">Emergency contact directory</h2>
              <div className="mt-3 divide-y divide-slate-100">
                {contacts.map((contact) => (
                  <div className="flex flex-wrap items-center justify-between gap-3 py-3" key={contact.id}>
                    <div><p className="font-semibold text-slate-900">{contact.name} · {contact.phone}</p><p className="text-xs capitalize text-slate-500">{contact.category} · {contact.is_active ? "Active" : "Inactive"}</p></div>
                    <div className="flex flex-wrap gap-2">
                      <button className={`rounded-lg px-3 py-1.5 text-xs font-bold ${contact.is_verified ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`} disabled={busy === `contact-${contact.id}`} onClick={() => toggleContact(contact)} type="button">{contact.is_verified ? "Verified · revoke" : "Verify contact"}</button>
                      <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700" disabled={busy === `contact-${contact.id}`} onClick={() => toggleContactActive(contact)} type="button">{contact.is_active ? "Deactivate" : "Activate"}</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
