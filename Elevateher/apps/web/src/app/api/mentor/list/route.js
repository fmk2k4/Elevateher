import { proxyJsonToBackend } from "@/app/api/utils/backend";

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const params = new URLSearchParams();
    for (const key of ["track", "language", "limit"]) {
      const value = url.searchParams.get(key);
      if (value) {
        params.set(key, value);
      }
    }
    const path = params.toString() ? `/mentor/list?${params.toString()}` : "/mentor/list";
    return proxyJsonToBackend(request, path);
  } catch (err) {
    console.error("GET /api/mentor/list", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
