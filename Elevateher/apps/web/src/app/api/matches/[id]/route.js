import { proxyJsonToBackend } from "@/app/api/utils/backend";
import { auth } from "@/auth";

import { getRoleBasedPath } from "@/app/api/utils/roleRouter";

// PATCH /api/matches/[id] — proxy match lifecycle updates to FastAPI
export async function PATCH(request, { params }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.text();
    const backendPath = await getRoleBasedPath(request, `/mentee/matches/${params.id}`, `/mentor/matches/${params.id}`);
    return proxyJsonToBackend(request, backendPath, {
      method: "PATCH",
      body,
      headers: {
        "Content-Type": request.headers.get("content-type") || "application/json",
      },
    });
  } catch (err) {
    console.error("PATCH /api/matches/[id]", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
