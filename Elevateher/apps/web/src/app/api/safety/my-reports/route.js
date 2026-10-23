import { proxyJsonToBackend } from "@/app/api/utils/backend";

export async function GET(request) {
  try {
    return proxyJsonToBackend(request, "/safety/my-reports");
  } catch (err) {
    console.error("GET /api/safety/my-reports", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
