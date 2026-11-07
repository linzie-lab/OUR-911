export function PageHeader({ eyebrow, title, description, children }) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && (
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-800">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            {description}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}

export function Notice({ kind = "info", className = "", children }) {
  const style = {
    info: "border-sky-200 bg-sky-50 text-sky-950",
    success: "border-emerald-200 bg-emerald-50 text-emerald-950",
    error: "border-rose-200 bg-rose-50 text-rose-950",
    warning: "border-amber-200 bg-amber-50 text-amber-950",
  }[kind];
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm leading-6 ${style} ${className}`} role="status">
      {children}
    </div>
  );
}

export function Loading({ label = "Loading…" }) {
  return (
    <div className="flex items-center gap-3 py-8 text-sm text-slate-600" role="status">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-teal-700 border-r-transparent" />
      {label}
    </div>
  );
}

export function EmptyState({ title, children }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
      <h3 className="font-semibold text-slate-900">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">{children}</p>
    </div>
  );
}
