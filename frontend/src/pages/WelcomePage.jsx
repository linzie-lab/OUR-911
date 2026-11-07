import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import BrandMark from "../components/BrandMark.jsx";

const services = [
  { mark: "+", title: "First Aid Companion", description: "Clear, step-by-step guidance for common emergencies.", to: "/first-aid", image: "/images/service-first-aid.svg", tone: "bg-teal-50 text-teal-900" },
  { mark: "!", title: "Emergency Reporting", description: "Share a campus health concern with response staff.", to: "/incidents", image: "/images/service-incidents.svg", tone: "bg-rose-50 text-rose-900" },
  { mark: "↗", title: "Health Intelligence", description: "Privacy-preserving trends for authorized campus staff.", to: "/intelligence", image: "/images/service-intelligence.svg", tone: "bg-blue-50 text-blue-900", staffOnly: true },
  { mark: "♡", title: "DamuConnect", description: "Coordinate voluntary donor and blood request support.", to: "/damuconnect", image: "/images/service-damuconnect.svg", tone: "bg-red-50 text-red-900" },
  { mark: "⌖", title: "Health Facilities", description: "Find care locations and available contact information.", to: "/facilities", image: "/images/service-facilities.svg", tone: "bg-sky-50 text-sky-900" },
];

export default function WelcomePage() {
  const { continueAsGuest } = useAuth();
  const navigate = useNavigate();

  return (
    <main className="mx-auto max-w-6xl px-1 py-5 sm:px-4 sm:py-10">
      <section className="relative overflow-hidden rounded-3xl bg-teal-950 px-6 py-9 text-white sm:px-10 sm:py-12">
        <div className="grid items-center gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="relative z-10 max-w-3xl">
            <div className="inline-flex rounded-2xl bg-white p-2.5 shadow-sm">
              <BrandMark />
            </div>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-teal-300/30 bg-teal-800/40 px-3 py-1.5 text-xs font-semibold text-teal-100">
              One unified response
            </div>
            <h1 className="mt-5 text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
              An integrated emergency response and life-saving service platform.
            </h1>
            <p className="mt-5 text-sm font-bold tracking-wide text-white sm:text-base">
              Every second matters. Every life counts.
            </p>
          </div>
          <div className="relative min-h-[190px] overflow-hidden rounded-2xl lg:min-h-[270px]">
            <img
              alt="Campus health professionals coordinating care"
              className="absolute inset-0 h-full w-full object-cover"
              height="520"
              src="/images/dashboard-hero.svg"
              width="720"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-teal-950/30 to-transparent" />
          </div>
        </div>
        <div aria-hidden="true" className="absolute -right-14 -top-20 h-72 w-72 rounded-full border-[40px] border-teal-800/30" />
      </section>

      <section className="mt-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-800">Choose how to continue</p>
              <h2 className="mt-2 text-xl font-bold text-slate-950">Welcome to OUR 911</h2>
            </div>
            <span className="hidden h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-lg font-bold text-teal-800 sm:flex">↗</span>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Link className="rounded-2xl bg-teal-800 p-4 text-white transition hover:bg-teal-900" to="/login">
              <span className="text-xs font-bold uppercase tracking-wide text-teal-200">Returning user</span>
              <span className="mt-2 block font-bold">Sign in</span>
              <span className="mt-1 block text-xs text-teal-100">Access your account and private activity.</span>
            </Link>
            <Link className="rounded-2xl border border-slate-200 p-4 transition hover:border-teal-300 hover:bg-teal-50/50" to="/register">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">New to OUR 911</span>
              <span className="mt-2 block font-bold text-slate-950">Create account</span>
              <span className="mt-1 block text-xs text-slate-600">Create a secure student account.</span>
            </Link>
            <button className="rounded-2xl border border-slate-200 p-4 text-left opacity-70" disabled title="Google OAuth is not configured for this application" type="button">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Federated sign-in</span>
              <span className="mt-2 block font-bold text-slate-900">Continue with Google</span>
              <span className="mt-1 block text-xs text-slate-600">Unavailable until Google OAuth is configured.</span>
            </button>
            <Link className="rounded-2xl border border-slate-200 p-4 transition hover:border-teal-300 hover:bg-teal-50/50" to="/login">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Email access</span>
              <span className="mt-2 block font-bold text-slate-950">Continue with email</span>
              <span className="mt-1 block text-xs text-slate-600">Use your existing email and password.</span>
            </Link>
          </div>
          <button
            className="mt-4 flex w-full items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-left transition hover:bg-rose-100 sm:max-w-2xl"
            onClick={() => {
              continueAsGuest();
              navigate("/", { replace: true });
            }}
            type="button"
          >
            <span>
              <span className="block text-xs font-bold uppercase tracking-wide text-rose-800">Emergency access</span>
              <span className="mt-1 block font-bold text-rose-950">Continue as guest</span>
              <span className="mt-1 block text-xs text-rose-900">Open first aid, emergency reports, contacts and facilities now.</span>
            </span>
            <span aria-hidden="true" className="ml-3 text-xl font-bold text-rose-800">→</span>
          </button>
        </div>
      </section>
      <section className="mt-8">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-teal-800">Explore our services</p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-950">Support for every step</h2>
          </div>
          <p className="text-sm text-slate-500">Choose a service to get started.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {services.map((service) => (
            <Link className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg" key={service.title} to={service.to}>
              <div className="relative aspect-[16/8.5] overflow-hidden bg-slate-100">
                <img alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.035]" height="360" loading="lazy" src={service.image} width="640" />
                <span className={`absolute left-3 top-3 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] shadow-sm ${service.tone}`}>{service.staffOnly ? "Staff workspace" : "OUR 911 service"}</span>
              </div>
              <div className="p-5">
                <div className="flex items-start gap-3">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base font-bold ${service.tone}`}>{service.mark}</span>
                  <div>
                    <h3 className="font-bold leading-5 text-slate-950">{service.title}</h3>
                    <p className="mt-1.5 text-sm leading-5 text-slate-600">{service.description}</p>
                  </div>
                </div>
                <span className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#edf3f8] px-3 py-2 text-xs font-bold text-[#173d58] transition group-hover:bg-[#173d58] group-hover:text-white">
                  {service.staffOnly ? "View access details" : "Explore service"} <span aria-hidden="true">→</span>
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
      <p className="mt-6 rounded-xl bg-white p-4 text-xs leading-5 text-slate-600">
        OUR 911 is a campus health coordination platform, not an ambulance dispatch service. For a life-threatening emergency, contact your local emergency services immediately.
      </p>
    </main>
  );
}
