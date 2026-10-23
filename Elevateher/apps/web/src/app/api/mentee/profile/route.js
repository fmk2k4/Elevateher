import { proxyJsonToBackend } from "@/app/api/utils/backend";
import { auth } from "@/auth";

export async function GET(request) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return Response.json({ error: "Unauthorized" }, { status: 401 });

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
    const session = await auth();
    if (!session?.user?.id)
      return Response.json({ error: "Unauthorized" }, { status: 401 });

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
