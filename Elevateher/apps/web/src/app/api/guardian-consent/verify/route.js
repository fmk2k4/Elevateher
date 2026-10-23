import { proxyJsonToBackend } from "@/app/api/utils/backend";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");
    if (!token) {
      return Response.json({ valid: false, reason: "invalid" }, { status: 400 });
    }

    const res = await proxyJsonToBackend(request, `/auth/guardian-consent/verify?token=${encodeURIComponent(token)}`);
    
    if (!res.ok) {
      if (res.status === 410) {
        return Response.json({ valid: false, reason: "expired" }, { status: 410 });
      }
      return Response.json({ valid: false, reason: "invalid" }, { status: 404 });
    }
    
    return res;
  } catch (err) {
    console.error("GET /api/guardian-consent/verify", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
