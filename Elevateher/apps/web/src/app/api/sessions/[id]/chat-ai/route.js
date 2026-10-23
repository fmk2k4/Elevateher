import { getRawAccessToken, getBackendBaseUrl } from "@/app/api/utils/backend";
import { auth } from "@/auth";

export async function POST(request, { params }) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    
    const token = await getRawAccessToken(request);
    const body = await request.text();
    
    const url = new URL(`/session/${params.id}/chat-ai`, `${getBackendBaseUrl()}/`);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": request.headers.get("content-type") || "application/json"
      },
      body
    });

    return new Response(response.body, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("content-type") || "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
      }
    });
  } catch (err) {
    console.error("POST /api/sessions/[id]/chat-ai", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
