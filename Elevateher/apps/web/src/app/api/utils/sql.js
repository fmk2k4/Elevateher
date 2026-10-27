// Direct database access from the web frontend is intentionally disabled.
// All database queries must go through the FastAPI backend proxy via
// proxyJsonToBackend / proxyPublicToBackend.
// This prevents exposing DATABASE_URL and direct SQL execution to the client.
export default function sql() {
  throw new Error(
    'Direct database access from web frontend is disabled. Use /api/* proxy routes instead.'
  );
}