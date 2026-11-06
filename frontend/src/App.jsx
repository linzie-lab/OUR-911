import { Link, Route, Routes } from "react-router-dom";

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
          The project foundation is ready. Application modules can be added here
          as the team defines them.
        </p>
        <Link
          className="mt-8 inline-flex rounded-lg bg-cyan-500 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400"
          to="/"
        >
          Home
        </Link>
      </div>
    </main>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="*" element={<HomePage />} />
    </Routes>
  );
}
