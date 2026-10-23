import { proxyJsonToBackend } from "@/app/api/utils/backend";

export async function GET(request, { params }) {
  try {
    return proxyJsonToBackend(request, `/session/${params.id}`);
  } catch (err) {
    console.error("GET /api/sessions/[id]", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const body = await request.text();
    return proxyJsonToBackend(request, `/session/${params.id}`, {
      method: "PUT",
      body,
      headers: { "Content-Type": request.headers.get("content-type") || "application/json" },
    });
  } catch (err) {
    console.error("PUT /api/sessions/[id]", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
