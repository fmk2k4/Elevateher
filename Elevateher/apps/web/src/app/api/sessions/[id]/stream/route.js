import { proxyJsonToBackend } from "@/app/api/utils/backend";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  try {
    const { searchParams } = new URL(request.url);
    const queryToken = searchParams.get("token");
    const authHeader = request.headers.get("Authorization");
    const headerToken = authHeader && authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    const token = queryToken || headerToken;

    const { id } = params;
    
    const apiBase = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const target = `${apiBase.replace(/\/$/, "")}/session/${id}/stream`;
    
    const headers = new Headers();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    
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
