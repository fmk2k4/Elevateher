import { proxyJsonToBackend } from "@/app/api/utils/backend";

export async function GET(request) {
  try {
    return proxyJsonToBackend(request, "/auth/users/profile");
  } catch (err) {
    console.error("GET /api/users/profile", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const body = await request.text();
    return proxyJsonToBackend(request, "/auth/users/profile", {
      method: "PUT",
      body,
      headers: {
        "Content-Type": request.headers.get("content-type") || "application/json",
      },
    });
  } catch (err) {
    console.error("PUT /api/users/profile", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
