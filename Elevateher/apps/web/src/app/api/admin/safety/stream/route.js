import { getRawAccessToken, getBackendBaseUrl } from "@/app/api/utils/backend";

export async function GET(request) {
  try {
    const token = await getRawAccessToken(request);
    if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const institutionId = searchParams.get("institution_id") || "";
    
    const url = new URL(`/safety/stream${institutionId ? `?institution_id=${institutionId}` : ""}`, `${getBackendBaseUrl()}/`);
    
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return new Response(response.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
      },
    });
  } catch (err) {
    console.error("GET /api/admin/safety/stream error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
