import { proxyJsonToBackend } from "@/app/api/utils/backend";
import { auth } from "@/auth";

export async function GET(request) {
  try {
    const session = await auth();
    console.log("PROFILE ROUTE SESSION:", JSON.stringify(session));
    if (!session?.user?.id) {
      console.error("No session or user id");
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    return proxyJsonToBackend(request, "/auth/users/profile");
  } catch (err) {
    console.error("GET /api/users/profile", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return Response.json({ error: "Unauthorized" }, { status: 401 });

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
