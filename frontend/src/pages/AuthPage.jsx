import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Notice } from "../components/Ui.jsx";
import { getApiError, useAuth } from "../context/AuthContext.jsx";
import BrandMark from "../components/BrandMark.jsx";

export default function AuthPage() {
  const { user, loading, login, register } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const mode = location.pathname === "/register" ? "register" : "login";
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (loading) return null;
  if (user) return <Navigate replace to="/" />;

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (mode === "register" && password !== confirmation) {
      setError("The passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "register") await register(fullName, email, password);
      else await login(email, password);
      navigate(location.state?.from?.pathname ?? "/", { replace: true });
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-1 py-5 sm:px-4 sm:py-10">
      <div className="grid overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm md:grid-cols-[0.9fr_1.1fr]">
        <section className="bg-teal-950 p-7 text-white sm:p-10">
          <Link className="inline-flex items-center gap-3" to="/">
            <span className="rounded-xl bg-white px-2 py-1"><BrandMark /></span>
          </Link>
          <p className="mt-12 text-xs font-bold uppercase tracking-[0.18em] text-teal-300">One unified response</p>
          <h1 className="mt-4 text-3xl font-bold leading-tight sm:text-4xl">
            {mode === "login" ? "Welcome back to a healthier campus." : "Create your OUR 911 account."}
          </h1>
          <p className="mt-4 max-w-md text-sm leading-6 text-teal-100">
            {mode === "login"
              ? "Sign in to follow your reports, manage donor availability and stay connected to campus care."
              : "A student account helps you securely track reports and manage your community support activity."}
          </p>
          <p className="mt-5 text-sm font-bold text-white">Every second matters. Every life counts.</p>
          <div className="mt-9 rounded-2xl border border-white/15 bg-white/5 p-4 text-sm leading-6 text-teal-50">
            Emergency guidance and the health facility directory are available without signing in.
          </div>
          <Link className="mt-5 inline-flex font-semibold text-white underline underline-offset-4" to="/">
            Continue as guest →
          </Link>
        </section>
        <section className="p-6 sm:p-10">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-800">
            {mode === "login" ? "Sign in" : "Create account"}
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
            {mode === "login" ? "Access your account" : "Your account details"}
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            {mode === "login" ? "Use your registered email and password." : "Registration is currently available for students."}
          </p>
          {error && <Notice className="mt-5" kind="error">{error}</Notice>}
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            {mode === "register" && (
              <label className="block text-sm font-semibold text-slate-700">
                Full name
                <input autoComplete="name" className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-3 font-normal outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100" maxLength={120} onChange={(event) => setFullName(event.target.value)} required value={fullName} />
              </label>
            )}
            <label className="block text-sm font-semibold text-slate-700">
              Email address
              <input autoComplete="email" className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-3 font-normal outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100" maxLength={255} onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Password
              <span className="mt-1.5 flex rounded-xl border border-slate-300 focus-within:border-teal-700 focus-within:ring-2 focus-within:ring-teal-100">
                <input autoComplete={mode === "login" ? "current-password" : "new-password"} className="min-w-0 flex-1 rounded-l-xl px-3.5 py-3 font-normal outline-none" maxLength={128} minLength={8} onChange={(event) => setPassword(event.target.value)} required type={showPassword ? "text" : "password"} value={password} />
                <button aria-label={showPassword ? "Hide password" : "Show password"} className="rounded-r-xl px-3 text-xs font-bold text-teal-800" onClick={() => setShowPassword((value) => !value)} type="button">
                  {showPassword ? "Hide" : "Show"}
                </button>
              </span>
              {mode === "register" && <span className="mt-1 block text-xs font-normal text-slate-500">Use 8–128 characters.</span>}
            </label>
            {mode === "register" && (
              <label className="block text-sm font-semibold text-slate-700">
                Confirm password
                <input autoComplete="new-password" className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-3 font-normal outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100" maxLength={128} minLength={8} onChange={(event) => setConfirmation(event.target.value)} required type={showPassword ? "text" : "password"} value={confirmation} />
              </label>
            )}
            {mode === "login" && (
              <div className="text-right">
                <Link className="text-sm font-semibold text-teal-800 hover:underline" to="/forgot-password">Forgot password?</Link>
              </div>
            )}
            <button className="w-full rounded-xl bg-teal-800 px-4 py-3 text-sm font-bold text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-60" disabled={busy} type="submit">
              {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>
          <p className="mt-5 text-center text-sm text-slate-600">
            {mode === "login" ? "New to OUR 911?" : "Already have an account?"}{" "}
            <Link className="font-bold text-teal-800 underline underline-offset-2" to={mode === "login" ? "/register" : "/login"}>
              {mode === "login" ? "Create an account" : "Sign in"}
            </Link>
          </p>
          <p className="mt-5 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">
            Public registration creates student accounts. Health personnel and administrator access is assigned by a trusted operator.
          </p>
        </section>
      </div>
    </main>
  );
}
