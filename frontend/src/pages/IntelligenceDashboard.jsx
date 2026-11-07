import { useEffect, useState } from "react";
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import { Bar, Line } from "react-chartjs-2";
import { Link } from "react-router-dom";
import { EmptyState, Loading, Notice, PageHeader } from "../components/Ui.jsx";
import { getApiError, useAuth } from "../context/AuthContext.jsx";
import api from "../lib/api.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
  Filler,
);

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { grid: { display: false } },
    y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: "#e2e8f0" } },
  },
};

function Metric({ label, value, tone = "slate" }) {
  const styles = {
    slate: "bg-slate-50 text-slate-950",
    teal: "bg-teal-50 text-teal-950",
    rose: "bg-rose-50 text-rose-950",
    amber: "bg-amber-50 text-amber-950",
  };
  return (
    <div className={`rounded-2xl border border-slate-200 p-5 ${styles[tone]}`}>
      <p className="text-sm font-semibold text-slate-600">{label}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}

export default function IntelligenceDashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api.get("/intelligence/summary")
      .then(({ data }) => {
        if (active) setSummary(data.summary);
      })
      .catch((requestError) => {
        if (active) setError(getApiError(requestError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  if (!["admin", "health_personnel"].includes(user?.role)) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <PageHeader title="Health Intelligence" description="Aggregate, privacy-preserving campus health indicators." />
        <Notice kind="warning">This dashboard is available to authorized health personnel and administrators only.</Notice>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Authorized staff"
        title="Campus Health Intelligence"
        description="Aggregated measures based on incident reports in OUR 911. This is operational information, not a clinical or epidemiological diagnosis."
      />
      {error && <div className="mb-5"><Notice kind="error">{error}</Notice></div>}
      {loading ? <Loading label="Loading database statistics…" /> : !summary ? (
        <EmptyState title="Analytics unavailable">{error || "No summary data is available."}</EmptyState>
      ) : summary.total_incidents === 0 ? (
        <EmptyState title="No incident data yet">
          Analytics will appear after students submit incident reports. No sample statistics are displayed.
        </EmptyState>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Total reports" value={summary.total_incidents} />
            <Metric label="Open reports" value={summary.open_incidents} tone="amber" />
            <Metric label="Resolved" value={summary.resolved_incidents} tone="teal" />
            <Metric label="Open critical" value={summary.critical_incidents} tone="rose" />
          </div>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-bold">Activity indicator</h2>
                <p className="mt-1 text-sm text-slate-600">{summary.risk_indicator.basis}</p>
              </div>
              <span className="rounded-full bg-teal-50 px-3 py-1.5 text-sm font-bold text-teal-900">
                {summary.risk_indicator.label}
              </span>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Last 7 days: {summary.risk_indicator.current_7_days} · Previous 7 days: {summary.risk_indicator.previous_7_days}
            </p>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="font-bold">Incident reports over 14 days</h2>
              <div className="mt-4 h-64">
                <Line
                  data={{
                    labels: summary.trend.map((item) => new Date(`${item.date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })),
                    datasets: [{
                      label: "Reports",
                      data: summary.trend.map((item) => item.count),
                      borderColor: "#0f766e",
                      backgroundColor: "rgba(13, 148, 136, .12)",
                      fill: true,
                      tension: 0.3,
                    }],
                  }}
                  options={chartOptions}
                />
              </div>
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="font-bold">Category distribution</h2>
              <div className="mt-4 h-64">
                <Bar
                  data={{
                    labels: summary.categories.map((item) => item.category.replaceAll("_", " ")),
                    datasets: [{
                      label: "Reports",
                      data: summary.categories.map((item) => item.count),
                      backgroundColor: "#14b8a6",
                      borderRadius: 6,
                    }],
                  }}
                  options={chartOptions}
                />
              </div>
            </section>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="font-bold">Frequently reported locations</h2>
              {summary.frequent_locations.length ? (
                <ol className="mt-4 space-y-3">
                  {summary.frequent_locations.map((item) => (
                    <li className="flex items-center justify-between gap-3 text-sm" key={item.location}>
                      <span className="truncate text-slate-700">{item.location}</span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 font-bold">{item.count}</span>
                    </li>
                  ))}
                </ol>
              ) : <p className="mt-4 text-sm text-slate-500">No location data has been recorded.</p>}
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-bold">Recent reports</h2>
                <Link className="text-sm font-semibold text-teal-800" to="/incidents">Review all</Link>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[450px] text-left text-sm">
                  <thead className="text-xs uppercase text-slate-500">
                    <tr><th className="pb-2 pr-3">Category</th><th className="pb-2 pr-3">Location</th><th className="pb-2 pr-3">Severity</th><th className="pb-2">Status</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {summary.recent_incidents.map((incident) => (
                      <tr key={incident.id}>
                        <td className="py-2.5 pr-3">{incident.category.replaceAll("_", " ")}</td>
                        <td className="py-2.5 pr-3">{incident.location || "—"}</td>
                        <td className="py-2.5 pr-3 capitalize">{incident.severity}</td>
                        <td className="py-2.5 capitalize">{incident.status.replaceAll("_", " ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
          <p className="mt-5 text-xs leading-5 text-slate-500">
            Aggregate dashboard excludes reporter identities, contact details, and incident descriptions.
          </p>
        </>
      )}
    </main>
  );
}
