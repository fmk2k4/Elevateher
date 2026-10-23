import { proxyJsonToBackend } from "@/app/api/utils/backend";

export async function GET(request) {
  try {
    return proxyJsonToBackend(request, "/impact/events");
  } catch (err) {
    console.error("GET /api/impact-events", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.text();
    return proxyJsonToBackend(request, "/impact/events", {
      method: "POST",
      body,
      headers: {
        "Content-Type": request.headers.get("content-type") || "application/json",
      },
    });
  } catch (err) {
    console.error("POST /api/impact-events", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
