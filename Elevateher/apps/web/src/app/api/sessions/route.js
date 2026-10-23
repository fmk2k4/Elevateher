import { proxyJsonToBackend } from "@/app/api/utils/backend";
import { auth } from "@/auth";

export async function GET(request) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return Response.json({ error: "Unauthorized" }, { status: 401 });
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
    const session = await auth();
    if (!session?.user?.id)
      return Response.json({ error: "Unauthorized" }, { status: 401 });
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
