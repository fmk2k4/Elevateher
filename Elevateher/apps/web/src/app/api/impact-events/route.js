import { proxyJsonToBackend } from "@/app/api/utils/backend";
import { auth } from "@/auth";

export async function GET(request) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return Response.json({ error: "Unauthorized" }, { status: 401 });

    return proxyJsonToBackend(request, "/impact/events");
  } catch (err) {
    console.error("GET /api/impact-events", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return Response.json({ error: "Unauthorized" }, { status: 401 });

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
