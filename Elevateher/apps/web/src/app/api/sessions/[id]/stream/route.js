import { proxyJsonToBackend } from "@/app/api/utils/backend";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

    const { id } = params;
    
    // proxyJsonToBackend usually returns standard JSON. For streaming, we might need to 
    // fetch manually or if proxyJsonToBackend handles streaming correctly.
    // Our existing dashboard proxy does streaming, but in apps/web, proxyJsonToBackend uses fetch.
    const apiBase = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const target = `${apiBase}/sessions/${id}/stream`;
    
    const headers = new Headers();
    headers.set("Authorization", `Bearer ${session.user.id}`);
    
    const upstream = await fetch(target, {
      method: "GET",
      headers,
      cache: "no-store",
    });
    
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
      },
    });

  } catch (err) {
    console.error("GET /api/sessions/[id]/stream", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
}
