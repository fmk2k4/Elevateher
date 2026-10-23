import { proxyJsonToBackend } from "@/app/api/utils/backend";

import { getRoleBasedPath } from "@/app/api/utils/roleRouter";

export async function GET(request) {
  try {
    const backendPath = await getRoleBasedPath(request, "/mentee/matches", "/mentor/matches");
    return proxyJsonToBackend(request, backendPath);
  } catch (err) {
    console.error("GET /api/matches", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.text();
    const backendPath = await getRoleBasedPath(request, "/mentee/matches", "/mentor/matches");
    return proxyJsonToBackend(request, backendPath, {
      method: "POST",
      body,
      headers: { "Content-Type": request.headers.get("content-type") || "application/json" },
    });
  } catch (err) {
    console.error("POST /api/matches", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
