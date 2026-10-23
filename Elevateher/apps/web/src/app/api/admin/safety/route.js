import { proxyJsonToBackend } from "@/app/api/utils/backend";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const qs = searchParams.toString();
    const response = await proxyJsonToBackend(request, `/admin/safety${qs ? `?${qs}` : ""}`);
    return response;
  } catch (err) {
    console.error("GET /api/admin/safety", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const body = await request.text();
    return proxyJsonToBackend(request, "/admin/safety", {
      method: "PUT",
      body,
      headers: {
        "Content-Type": request.headers.get("content-type") || "application/json",
      },
    });
  } catch (err) {
    console.error("PUT /api/admin/safety", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
