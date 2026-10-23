import { Link } from "react-router";

export default function NotFoundPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-violet-600">
          404
        </p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">
          We could not find that page
        </h1>
        <p className="mt-3 text-slate-600">
          The page you are looking for may have moved or never existed.
        </p>
        <Link
          to="/"
          className="mt-6 inline-block px-5 py-2.5 rounded-lg bg-violet-600 text-white font-medium hover:bg-violet-700"
        >
          Back to ElevateHer
        </Link>
      </div>
    </main>
  );
}
