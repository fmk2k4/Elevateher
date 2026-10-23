import { proxyJsonToBackend } from "@/app/api/utils/backend";
import { auth } from "@/auth";

export async function GET(request, { params }) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    return proxyJsonToBackend(request, `/session/${params.id}`);
  } catch (err) {
    console.error("GET /api/sessions/[id]", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return Response.json({ error: "Unauthorized" }, { status: 401 });
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
