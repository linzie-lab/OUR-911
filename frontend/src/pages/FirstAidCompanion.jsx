import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { emergencyNotice, firstAidGuides } from "../data/firstAidGuides.js";
import BrandMark from "../components/BrandMark.jsx";

const iconPaths = {
  burn: (
    <>
      <path d="M12 22c4.4 0 7.5-3.1 7.5-7.2 0-3.1-1.6-5.3-4.1-8.3.1 2.4-.7 3.6-1.7 4.3C13.3 6.2 10.4 3.7 7 2c.7 4.3-2.5 7.1-2.5 12.1C4.5 18.5 7.6 22 12 22Z" />
      <path d="M12 18.5c1.7 0 2.8-1.2 2.8-2.8 0-1.1-.6-2-1.6-3-.1 1-.7 1.6-1.2 1.8-.2-1.2-.8-2-1.8-2.7.1 1.6-1.1 2.5-1.1 4 0 1.6 1.2 2.7 2.9 2.7Z" />
    </>
  ),
  bleeding: (
    <>
      <path d="M12 22a7 7 0 0 0 7-7c0-3.7-7-13-7-13S5 11.3 5 15a7 7 0 0 0 7 7Z" />
      <path d="M9 15h6m-3-3v6" />
    </>
  ),
  fainting: (
    <>
      <path d="M3 12h4l3-8 4 16 3-8h4" />
      <circle cx="12" cy="12" r="10" />
    </>
  ),
  choking: (
    <>
      <path d="M12 3v3m0 12v3M3 12h3m12 0h3" />
      <path d="M8 8c1-1 2.3-1.5 4-1.5s3 .5 4 1.5m-8 8c1 1 2.3 1.5 4 1.5s3-.5 4-1.5" />
      <circle cx="12" cy="12" r="10" />
    </>
  ),
  fracture: (
    <>
      <path d="M7.5 4.5a2.5 2.5 0 1 0-3 3.9l5.2 5.2-2.2 2.2a2.5 2.5 0 1 0 3.9 3l2.2-2.2 1.5 1.5a2.5 2.5 0 1 0 3-3.9l-5.2-5.2 2.2-2.2a2.5 2.5 0 1 0-3.9-3L11 6l-1.5-1.5a2.5 2.5 0 0 0-2 0Z" />
    </>
  ),
  arrow: <path d="M5 12h14m-7-7 7 7-7 7" />,
};

const accentStyles = {
  orange: {
    icon: "bg-orange-50 text-orange-600",
    badge: "bg-orange-50 text-orange-700",
    selected: "border-orange-400 ring-orange-100",
  },
  rose: {
    icon: "bg-rose-50 text-rose-600",
    badge: "bg-rose-50 text-rose-700",
    selected: "border-rose-400 ring-rose-100",
  },
  violet: {
    icon: "bg-violet-50 text-violet-600",
    badge: "bg-violet-50 text-violet-700",
    selected: "border-violet-400 ring-violet-100",
  },
  sky: {
    icon: "bg-sky-50 text-sky-600",
    badge: "bg-sky-50 text-sky-700",
    selected: "border-sky-400 ring-sky-100",
  },
  amber: {
    icon: "bg-amber-50 text-amber-700",
    badge: "bg-amber-50 text-amber-800",
    selected: "border-amber-400 ring-amber-100",
  },
};

function Icon({ name, className = "h-5 w-5" }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      {iconPaths[name]}
    </svg>
  );
}

function EmergencyBanner() {
  return (
    <div className="border-b border-rose-200 bg-rose-50">
      <div className="mx-auto flex max-w-7xl items-start gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-600 text-sm font-bold text-white">
          !
        </span>
        <p className="text-sm leading-6 text-rose-950">
          <strong>Life-threatening emergency?</strong> Call your local emergency
          number now. This companion does not replace emergency services.
        </p>
      </div>
    </div>
  );
}

function GuideCard({ guide, isSelected, onSelect }) {
  const accent = accentStyles[guide.accent];

  return (
    <button
      aria-pressed={isSelected}
      className={`group flex min-h-40 w-full flex-col rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
        isSelected
          ? `border-2 ${accent.selected} ring-4`
          : "border-slate-200"
      }`}
      onClick={onSelect}
      type="button"
    >
      <span
        className={`flex h-11 w-11 items-center justify-center rounded-xl ${accent.icon}`}
      >
        <Icon name={guide.icon} className="h-6 w-6" />
      </span>
      <span className="mt-4 flex w-full items-center justify-between gap-2">
        <span className="font-semibold text-slate-950">{guide.shortTitle}</span>
        <Icon
          name="arrow"
          className="h-4 w-4 text-slate-400 transition group-hover:translate-x-1 group-hover:text-slate-700"
        />
      </span>
      <span className="mt-1 text-sm leading-5 text-slate-600">
        {guide.summary}
      </span>
    </button>
  );
}

function GuideDetails({ guide }) {
  const accent = accentStyles[guide.accent];

  return (
    <section
      aria-labelledby="guide-title"
      className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
    >
      <div className="border-b border-slate-100 p-5 sm:p-7">
        <span
          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${accent.badge}`}
        >
          {guide.category}
        </span>
        <div className="mt-4 flex items-center gap-3">
          <span
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${accent.icon}`}
          >
            <Icon name={guide.icon} className="h-6 w-6" />
          </span>
          <h2
            className="text-2xl font-bold tracking-tight text-slate-950"
            id="guide-title"
          >
            {guide.title}
          </h2>
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          {guide.summary}
        </p>
      </div>

      <div className="space-y-7 p-5 sm:p-7">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-800">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-100 text-xs font-bold text-teal-800">
              1
            </span>
            What to do
          </h3>
          <ol className="mt-4 space-y-4">
            {guide.steps.map((step, index) => (
              <li className="flex gap-3 text-sm leading-6 text-slate-700" key={step}>
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-xs font-semibold text-slate-500">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 sm:p-5">
          <h3 className="flex items-center gap-2 font-bold text-rose-950">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-600 text-sm font-bold text-white">
              !
            </span>
            Get emergency help
          </h3>
          <ul className="mt-3 space-y-2 pl-4 text-sm leading-6 text-rose-950 marker:text-rose-500">
            {guide.urgentSigns.map((sign) => (
              <li className="list-disc" key={sign}>
                {sign}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-sm leading-6 text-slate-500">
          <strong className="text-slate-700">Remember:</strong> {guide.note}
        </p>
      </div>
    </section>
  );
}

export default function FirstAidCompanion() {
  const [selectedId, setSelectedId] = useState(firstAidGuides[0].id);
  const [search, setSearch] = useState("");

  const filteredGuides = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return firstAidGuides;

    return firstAidGuides.filter((guide) =>
      [
        guide.title,
        guide.category,
        guide.summary,
        ...guide.steps,
        ...guide.urgentSigns,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [search]);

  const selectedGuide =
    filteredGuides.find((guide) => guide.id === selectedId) ??
    filteredGuides[0] ??
    null;

  function handleSearchChange(event) {
    const value = event.target.value;
    setSearch(value);
    const query = value.trim().toLowerCase();
    const nextGuide = firstAidGuides.find((guide) =>
      guide.title.toLowerCase().includes(query),
    );
    if (query && nextGuide) setSelectedId(nextGuide.id);
  }

  return (
    <div className="min-h-screen bg-[#f7faf9] text-slate-900">
      <EmergencyBanner />
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link
            aria-label="OUR 911 home"
            className="flex items-center gap-3 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700"
            to="/"
          >
            <BrandMark />
          </Link>
          <span className="hidden items-center gap-2 rounded-full bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-900 sm:inline-flex">
            <span className="h-2 w-2 rounded-full bg-teal-600" />
            First Aid Companion
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-14 pt-8 sm:px-6 sm:pt-12 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.92fr)] lg:items-start">
          <div>
            <div className="max-w-2xl">
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-teal-800">
                First Aid Companion
              </p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                Know what to do.
                <span className="block text-teal-800">Act with confidence.</span>
              </h1>
              <p className="mt-4 text-base leading-7 text-slate-600">
                Quick, practical steps for common emergencies. Choose a guide
                to see what to do and when to get medical help.
              </p>
            </div>

            <label className="mt-7 block">
              <span className="sr-only">Search first-aid guides</span>
              <span className="flex h-12 items-center gap-3 rounded-xl border border-slate-300 bg-white px-4 shadow-sm focus-within:border-teal-700 focus-within:ring-4 focus-within:ring-teal-100">
                <svg
                  aria-hidden="true"
                  className="h-5 w-5 shrink-0 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-4-4" />
                </svg>
                <input
                  className="h-full w-full border-0 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                  onChange={handleSearchChange}
                  placeholder="Search symptoms or emergencies"
                  type="search"
                  value={search}
                />
              </span>
            </label>

            <div className="mt-6 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-950">
                  Common emergencies
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Select a topic for step-by-step guidance.
                </p>
              </div>
              <span className="shrink-0 text-xs font-medium text-slate-500">
                {filteredGuides.length} guides
              </span>
            </div>

            {filteredGuides.length ? (
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {filteredGuides.map((guide) => (
                  <GuideCard
                    guide={guide}
                    isSelected={guide.id === selectedGuide?.id}
                    key={guide.id}
                    onSelect={() => setSelectedId(guide.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
                No guide matches that search. Try “burn”, “breathing”, or
                “injury”.
              </div>
            )}

            <aside className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm leading-6 text-amber-950">
                <strong>Stay safe:</strong> Check the scene before approaching.
                Do not put yourself in danger, and ask someone nearby to help
                contact emergency services.
              </p>
            </aside>
          </div>

          <div className="lg:sticky lg:top-6">
            {selectedGuide ? (
              <GuideDetails guide={selectedGuide} />
            ) : (
              <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm leading-6 text-slate-600">
                Select a first-aid topic to view its steps.
              </div>
            )}
          </div>
        </div>

        <footer className="mt-10 border-t border-slate-200 pt-5">
          <p className="mx-auto max-w-4xl text-center text-xs leading-5 text-slate-500">
            {emergencyNotice}
          </p>
        </footer>
      </main>
    </div>
  );
}
