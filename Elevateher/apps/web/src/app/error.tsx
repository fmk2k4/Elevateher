import { Link, isRouteErrorResponse, useRouteError } from "react-router";

export default function ErrorPage() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-rose-600">
            {error.status}
          </p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            {error.statusText || "Something went wrong"}
          </h1>
          <p className="mt-3 text-slate-600">{error.data || "Please try again."}</p>
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

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-rose-600">
          Unexpected Error
        </p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">
          Something went wrong on our side
        </h1>
        <p className="mt-3 text-slate-600">
          Our team has been notified. Please retry in a moment.
        </p>
        <Link
          to="/"
          className="mt-6 inline-block px-5 py-2.5 rounded-lg bg-violet-600 text-white font-medium hover:bg-violet-700"
        >
          Return Home
        </Link>
      </div>
    </main>
  );
}
