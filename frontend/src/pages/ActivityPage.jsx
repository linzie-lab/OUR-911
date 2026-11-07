import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState, Loading, Notice, PageHeader } from "../components/Ui.jsx";
import { getApiError, useAuth } from "../context/AuthContext.jsx";
import api from "../lib/api.js";

export default function ActivityPage() {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(Boolean(user));
  const [error, setError] = useState("");
  const updates = reports
    .flatMap((report) =>
      (report.history ?? []).map((update) => ({
        ...update,
        category: report.category,
        location: report.location,
      })),
    )
    .sort((left, right) => new Date(right.created_at) - new Date(left.created_at))
    .slice(0, 10);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    api.get("/incidents/mine")
      .then(({ data }) => setReports(data.incidents))
      .catch((requestError) => setError(getApiError(requestError)))
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <main className="mx-auto max-w-5xl">
      <PageHeader eyebrow="My account" title="My Activity" description="A private timeline of reports submitted from your account." />
      {!user && <Notice><Link className="font-bold underline" to="/login">Sign in</Link> to view your account activity. Guest reports are not connected to a personal account.</Notice>}
      {error && <div className="mb-4"><Notice kind="error">{error}</Notice></div>}
      {loading ? <Loading label="Loading your activity…" /> : user && !reports.length ? (
        <EmptyState title="No activity to show">Your incident reports will appear here after you submit one.</EmptyState>
      ) : user ? (
        <div className="space-y-7">
          <section>
            <h2 className="mb-3 font-bold text-slate-950">Report updates</h2>
            <ol className="space-y-2">
              {updates.map((update) => (
                <li className="rounded-xl border border-slate-200 bg-white p-4" key={update.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{update.message}</p>
                      <p className="mt-1 text-xs capitalize text-slate-500">{update.category.replaceAll("_", " ")} · {update.location}</p>
                    </div>
                    <time className="text-xs text-slate-500" dateTime={update.created_at}>{new Date(update.created_at).toLocaleString()}</time>
                  </div>
                </li>
              ))}
            </ol>
          </section>
          <section>
            <h2 className="mb-3 font-bold text-slate-950">My reports</h2>
            <ol className="space-y-3">
              {reports.map((report) => (
                <li className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={report.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold capitalize text-slate-950">{report.category.replaceAll("_", " ")}</h3>
                      <p className="mt-1 text-sm text-slate-600">{report.location} · {new Date(report.created_at).toLocaleString()}</p>
                    </div>
                    <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-bold capitalize text-teal-900">{report.status.replaceAll("_", " ")}</span>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>
      ) : null}
    </main>
  );
}
