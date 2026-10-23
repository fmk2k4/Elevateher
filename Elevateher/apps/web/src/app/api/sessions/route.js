import { proxyJsonToBackend } from "@/app/api/utils/backend";

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const matchId = url.searchParams.get("match_id");
    const path = matchId ? `/session?match_id=${encodeURIComponent(matchId)}` : "/session";
    return proxyJsonToBackend(request, path);
  } catch (err) {
    console.error("GET /api/sessions", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.text();
    return proxyJsonToBackend(request, "/session", {
      method: "POST",
      body,
      headers: { "Content-Type": request.headers.get("content-type") || "application/json" },
    });
  } catch (err) {
    console.error("POST /api/sessions", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
