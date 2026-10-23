import { proxyJsonToBackend } from "@/app/api/utils/backend";

export async function GET(request) {
  try {
    const response = await proxyJsonToBackend(request, "/notifications");
    return response;
  } catch (err) {
    console.error("GET /api/notifications", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const body = await request.text();
    return proxyJsonToBackend(request, "/notifications", {
      method: "PUT",
      body,
      headers: {
        "Content-Type": request.headers.get("content-type") || "application/json",
      },
    });
  } catch (err) {
    console.error("PUT /api/notifications", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
