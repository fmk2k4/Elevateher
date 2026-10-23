import { proxyJsonToBackend } from "@/app/api/utils/backend";

export async function GET(request) {
  try {
    const response = await proxyJsonToBackend(request, "/mentee/profile");
    if (!response.ok) return response;

    const profile = await response.json();
    return Response.json({ profile });
  } catch (err) {
    console.error("GET /api/mentee/profile", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.text();
    const response = await proxyJsonToBackend(request, "/mentee/profile", {
      method: "POST",
      body,
      headers: {
        "Content-Type": request.headers.get("content-type") || "application/json",
      },
    });
    if (!response.ok) return response;

    const profile = await response.json();
    return Response.json({ profile }, { status: response.status });
  } catch (err) {
    console.error("POST /api/mentee/profile", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
