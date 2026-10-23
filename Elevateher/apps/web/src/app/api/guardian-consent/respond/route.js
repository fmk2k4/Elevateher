import { proxyPublicToBackend } from "@/app/api/utils/backend";

export async function POST(request) {
  try {
    const body = await request.text();
    return proxyPublicToBackend(request, "/auth/guardian-consent/respond", {
      method: "POST",
      body,
      headers: {
        "Content-Type": request.headers.get("content-type") || "application/json",
      },
    });
  } catch (err) {
    console.error("POST /api/guardian-consent/respond", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
