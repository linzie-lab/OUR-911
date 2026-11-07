import { useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import BrandMark from "./BrandMark.jsx";

const groups = [
  {
    label: "Main",
    items: [{ to: "/", label: "Dashboard", mark: "⌂" }],
  },
  {
    label: "Health services",
    items: [
      { to: "/first-aid", label: "First Aid Companion", mark: "+" },
      { to: "/incidents", label: "Emergency Reporting", mark: "!" },
      { to: "/facilities", label: "Health Facilities", mark: "⌖" },
      { to: "/emergency-contacts", label: "Emergency Contacts", mark: "☎" },
    ],
  },
  {
    label: "Community support",
    items: [
      { to: "/damuconnect", label: "DamuConnect", mark: "♡" },
      { to: "/damuconnect#donors", label: "Find Blood Donors", mark: "⌕" },
      { to: "/damuconnect#donor-registration", label: "Become a Donor", mark: "＋" },
      { to: "/damuconnect#requests", label: "Request Blood", mark: "＋" },
      { to: "/damuconnect#request-tracking", label: "Track Blood Requests", mark: "◷" },
      { to: "/damuconnect#information", label: "Blood Donation Info", mark: "i" },
    ],
  },
  {
    label: "My account",
    items: [
      { to: "/incidents#my-reports", label: "My Reports", mark: "▤" },
      { to: "/activity", label: "My Activity", mark: "◷" },
      { to: "/profile", label: "My Profile", mark: "○" },
      { to: "/settings", label: "Settings", mark: "⚙" },
    ],
  },
];

function isActive(location, path) {
  const [pathname, hash] = path.split("#");
  return location.pathname === pathname && (!hash || location.hash === `#${hash}`);
}

export default function AppShell() {
  const { user, guest, loading, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const title =
    groups.flatMap((group) => group.items).find((item) => isActive(location, item.to))
      ?.label ?? (location.pathname === "/intelligence" ? "Health Intelligence" : "OUR 911");

  function submitSearch(event) {
    event.preventDefault();
    const query = search.trim().toLowerCase();
    if (!query) return;
    const item = groups
      .flatMap((group) => group.items)
      .find((entry) => entry.label.toLowerCase().includes(query));
    if (item) navigate(item.to);
    else navigate(`/facilities?search=${encodeURIComponent(search.trim())}`);
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex min-h-[68px] max-w-[1480px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <Link className="flex shrink-0 items-center gap-3" to="/">
            <BrandMark />
          </Link>
          <div className="hidden min-w-0 flex-1 items-center justify-between gap-6 pl-5 md:flex">
            <div>
              <p className="text-xs font-medium text-slate-500">Workspace</p>
              <h1 className="text-base font-bold">{title}</h1>
            </div>
            <form className="w-full max-w-sm" onSubmit={submitSearch} role="search">
              <label className="sr-only" htmlFor="global-search">Search OUR 911</label>
              <input
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:bg-white focus:ring-2 focus:ring-teal-100"
                id="global-search"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search services or facilities"
                value={search}
              />
            </form>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              aria-label="View incident updates"
              className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
              onClick={() => navigate(user ? "/activity" : "/login")}
              title="Incident updates"
              type="button"
            >
              ◷
            </button>
            {loading ? (
              <span className="hidden text-sm text-slate-500 sm:block">Checking account…</span>
            ) : user ? (
              <div className="flex items-center gap-2">
                <Link className="flex items-center gap-2 rounded-xl p-1.5 hover:bg-slate-50" to="/profile">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-100 text-sm font-bold text-teal-900">
                    {user.full_name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}
                  </span>
                  <span className="hidden max-w-32 text-left sm:block">
                    <span className="block truncate text-sm font-semibold">{user.full_name}</span>
                    <span className="block text-xs capitalize text-slate-500">{user.role.replaceAll("_", " ")}</span>
                  </span>
                </Link>
                <button aria-label="Sign out" className="rounded-lg border border-slate-200 px-2.5 py-2 text-sm font-semibold hover:bg-slate-50 sm:px-3" onClick={logout} type="button">
                  <span className="sm:hidden">↪</span><span className="hidden sm:inline">Sign out</span>
                </button>
              </div>
            ) : (
              <Link className="rounded-lg bg-teal-800 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-900" to={guest ? "/profile" : "/login"}>
                {guest ? "Guest account" : "Sign in"}
              </Link>
            )}
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-[1480px] px-3 sm:px-6 lg:grid lg:grid-cols-[245px_minmax(0,1fr)] lg:gap-7 lg:px-8">
        <aside className="hidden py-6 lg:block">
          <nav aria-label="Sidebar navigation" className="sticky top-[88px] space-y-6">
            {groups.map((group) => (
              <section key={group.label}>
                <h2 className="px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{group.label}</h2>
                <div className="mt-2 space-y-1">
                  {group.items.map((item) => (
                    <NavLink
                      aria-current={isActive(location, item.to) ? "page" : undefined}
                      className={() => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition ${
                        isActive(location, item.to)
                          ? "bg-teal-50 text-teal-900"
                          : "text-slate-600 hover:bg-white hover:text-slate-950"
                      }`}
                      end={item.to === "/"}
                      key={item.to}
                      to={item.to}
                    >
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white text-sm font-bold text-teal-800 shadow-sm">{item.mark}</span>
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              </section>
            ))}
            {(user?.role === "admin" || (
              user?.role === "health_personnel" && user?.responder_approved
            )) && (
              <section>
                <h2 className="px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Staff workspace</h2>
                <NavLink className="mt-2 flex rounded-xl px-3 py-2.5 text-[13px] font-medium text-slate-600 hover:bg-white" to="/intelligence">Health Intelligence</NavLink>
              </section>
            )}
            {user?.role === "admin" && (
              <section>
                <h2 className="px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Administration</h2>
                <NavLink className={({ isActive: active }) => `mt-2 flex rounded-xl px-3 py-2.5 text-[13px] font-medium ${active ? "bg-teal-50 text-teal-900" : "text-slate-600 hover:bg-white"}`} to="/admin">System administration</NavLink>
              </section>
            )}
            {!user && guest && (
              <div className="rounded-2xl border border-teal-100 bg-white p-4">
                <p className="text-sm font-bold">Using OUR 911 as a guest</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">First aid, emergency reports and facility contacts are available without an account.</p>
                <Link className="mt-3 inline-block text-xs font-bold text-teal-800" to="/register">Create an account →</Link>
              </div>
            )}
          </nav>
        </aside>
        <div className="min-w-0 pb-8 pt-3 lg:py-6">
          <form className="mb-3 md:hidden" onSubmit={submitSearch} role="search">
            <label className="sr-only" htmlFor="mobile-search">Search OUR 911</label>
            <input
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-teal-600"
              id="mobile-search"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search services or facilities"
              value={search}
            />
          </form>
          <nav aria-label="Mobile navigation" className="mb-3 flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 lg:hidden">
            {[
              { to: "/", label: "Dashboard" },
              { to: "/first-aid", label: "First Aid" },
              { to: "/incidents", label: "Report" },
              { to: "/facilities", label: "Facilities" },
              { to: "/damuconnect", label: "DamuConnect" },
              { to: "/profile", label: user ? "Profile" : "Account" },
            ].map((item) => (
              <NavLink className={() => `whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold ${
                isActive(location, item.to) ? "bg-teal-50 text-teal-900" : "text-slate-600"
              }`} end={item.to === "/"} key={item.to} to={item.to}>
                {item.label}
              </NavLink>
            ))}
          </nav>
          <details className="mb-3 rounded-xl border border-slate-200 bg-white lg:hidden">
            <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-teal-900">All services and account pages</summary>
            <div className="grid gap-4 border-t border-slate-100 p-4 sm:grid-cols-2">
              {groups.map((group) => (
                <section key={group.label}>
                  <h2 className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{group.label}</h2>
                  <div className="mt-1 grid">
                    {group.items.map((item) => (
                      <Link className="rounded-lg px-2 py-2 text-sm text-slate-700 hover:bg-teal-50 hover:text-teal-900" key={item.to} to={item.to}>{item.label}</Link>
                    ))}
                  </div>
                </section>
              ))}
              {(user?.role === "admin" || (
                user?.role === "health_personnel" && user?.responder_approved
              )) && (
                <section>
                  <h2 className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Staff workspace</h2>
                  <Link className="mt-1 block rounded-lg px-2 py-2 text-sm text-slate-700 hover:bg-teal-50" to="/intelligence">Health Intelligence</Link>
                </section>
              )}
            </div>
          </details>
          <Outlet />
        </div>
      </div>
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1480px] flex-col gap-2 px-4 py-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <span className="font-semibold text-slate-700">OUR 911 · Every second matters. Every life counts.</span>
          <div className="flex flex-wrap gap-4">
            <Link className="hover:text-teal-800" to="/emergency-contacts">Support & contacts</Link>
            <Link className="hover:text-teal-800" to="/privacy">Privacy</Link>
            <span>Not an ambulance dispatch service. Contact local emergency services for life-threatening emergencies.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
