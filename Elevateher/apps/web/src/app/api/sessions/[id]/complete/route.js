import { proxyJsonToBackend } from "@/app/api/utils/backend";
import { auth } from "@/auth";

// POST /api/sessions/[id]/complete — mark a session as done with notes
export async function POST(request, { params }) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { id: sessionId } = params;
    const body = await request.json().catch(() => ({}));
    const response = await proxyJsonToBackend(request, `/session/${sessionId}/complete`, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });
    return response;
  } catch (err) {
    console.error("POST /api/sessions/[id]/complete", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
