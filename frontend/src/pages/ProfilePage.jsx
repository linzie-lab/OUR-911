import { useState } from "react";
import { Link } from "react-router-dom";
import { Notice, PageHeader } from "../components/Ui.jsx";
import { getApiError, useAuth } from "../context/AuthContext.jsx";
import api from "../lib/api.js";

export default function ProfilePage({ settings = false }) {
  const { user, updateProfile } = useAuth();
  const [name, setName] = useState(user?.full_name ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function saveProfile(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await updateProfile(name);
      setNotice("Your profile name was updated.");
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setBusy(false);
    }
  }

  async function changePassword(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { data } = await api.post("/auth/change-password", {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setNotice(data.message);
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setBusy(false);
    }
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-3xl">
        <PageHeader eyebrow="My account" title={settings ? "Settings" : "My Profile"} description="Your account and privacy options." />
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-lg font-bold text-slate-600">G</span>
            <div>
              <h2 className="font-bold text-slate-950">Guest Account</h2>
              <p className="mt-1 text-sm text-slate-600">No personal account is connected to this session.</p>
            </div>
          </div>
          <Link className="mt-5 inline-flex rounded-xl bg-teal-800 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-900" to="/register">Create an account</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl">
      <PageHeader eyebrow="My account" title={settings ? "Account settings" : "My Profile"} description="Manage your account details and password." />
      {error && <div className="mb-4"><Notice kind="error">{error}</Notice></div>}
      {notice && <div className="mb-4"><Notice kind="success">{notice}</Notice></div>}
      <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-100 text-lg font-bold text-teal-900">
              {user.full_name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}
            </span>
            <div className="min-w-0">
              <h2 className="truncate font-bold text-slate-950">{user.full_name}</h2>
              <p className="truncate text-sm text-slate-600">{user.email}</p>
            </div>
          </div>
          <dl className="mt-6 space-y-3 border-t border-slate-100 pt-4 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-slate-500">Account type</dt><dd className="font-semibold capitalize">{user.role.replaceAll("_", " ")}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-slate-500">Authentication</dt><dd className="font-semibold">Email and password</dd></div>
          </dl>
        </section>
        <section className="space-y-4">
          <form className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" onSubmit={saveProfile}>
            <h2 className="font-bold text-slate-950">Profile details</h2>
            <label className="mt-4 block text-sm font-semibold text-slate-700">
              Full name
              <input className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" maxLength={120} onChange={(event) => setName(event.target.value)} required value={name} />
            </label>
            <p className="mt-3 text-sm text-slate-600">Email: {user.email}</p>
            <button className="mt-4 rounded-xl bg-teal-800 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-900 disabled:opacity-60" disabled={busy} type="submit">Save profile</button>
          </form>
          <form className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" onSubmit={changePassword}>
            <h2 className="font-bold text-slate-950">Change password</h2>
            <label className="mt-4 block text-sm font-semibold text-slate-700">
              Current password
              <input autoComplete="current-password" className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" onChange={(event) => setCurrentPassword(event.target.value)} required type="password" value={currentPassword} />
            </label>
            <label className="mt-3 block text-sm font-semibold text-slate-700">
              New password
              <input autoComplete="new-password" className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" maxLength={128} minLength={8} onChange={(event) => setNewPassword(event.target.value)} required type="password" value={newPassword} />
            </label>
            <p className="mt-1 text-xs text-slate-500">Use 8–128 characters.</p>
            <button className="mt-4 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-800 hover:bg-slate-50 disabled:opacity-60" disabled={busy} type="submit">Update password</button>
          </form>
        </section>
      </div>
    </main>
  );
}
