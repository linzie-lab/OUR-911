import { Link, Route, Routes } from "react-router-dom";
import FirstAidCompanion from "./pages/FirstAidCompanion.jsx";

function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
      <div className="mx-auto max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-400">
          Health hackathon project
        </p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-6xl">
          OUR 911
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
          Find practical, step-by-step guidance for common campus emergencies.
        </p>
        <Link
          className="mt-8 inline-flex rounded-lg bg-cyan-500 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400"
          to="/first-aid"
        >
          Open First Aid Companion
        </Link>
      </div>
    </main>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/first-aid" element={<FirstAidCompanion />} />
      <Route path="*" element={<HomePage />} />
    </Routes>
  );
}
