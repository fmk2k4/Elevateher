import { proxyJsonToBackend } from "@/app/api/utils/backend";

// Admin: list and approve/reject mentor applications
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const qs = searchParams.toString();
    const response = await proxyJsonToBackend(request, `/admin/mentors${qs ? `?${qs}` : ""}`);
    return response;
  } catch (err) {
    console.error("GET /api/admin/mentors", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const body = await request.text();
    return proxyJsonToBackend(request, "/admin/mentors", {
      method: "PUT",
      body,
      headers: {
        "Content-Type": request.headers.get("content-type") || "application/json",
      },
    });
  } catch (err) {
    console.error("PUT /api/admin/mentors", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
