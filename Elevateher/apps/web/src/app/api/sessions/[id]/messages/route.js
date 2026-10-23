import { proxyJsonToBackend } from "@/app/api/utils/backend";
import { auth } from "@/auth";

export async function GET(request, { params }) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { id: sessionId } = params;
    const response = await proxyJsonToBackend(request, `/session/${sessionId}/messages`);
    if (!response.ok) return response;

    const messages = await response.json();
    return Response.json({ messages });
  } catch (err) {
    console.error("GET /api/sessions/[id]/messages", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { id: sessionId } = params;
    const body = await request.json();
    const { content } = body;

    if (!content?.trim())
      return Response.json({ error: "Content required" }, { status: 400 });

    const response = await proxyJsonToBackend(request, "/session/messages", {
      method: "POST",
      body: JSON.stringify({ session_id: sessionId, content }),
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) return response;

    const message = await response.json();
    return Response.json(
      {
        message_id: message.id,
        status: "sent",
        risk_level: message.is_flagged ? "HIGH" : "LOW",
        flagged: Boolean(message.is_flagged),
        message,
      },
      { status: response.status },
    );
  } catch (err) {
    console.error("POST /api/sessions/[id]/messages", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
