import { proxyJsonToBackend } from "@/app/api/utils/backend";

export async function GET(request) {
  try {
    return proxyJsonToBackend(request, "/dashboard/stats");
  } catch (err) {
    console.error("GET /api/dashboard/stats", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
