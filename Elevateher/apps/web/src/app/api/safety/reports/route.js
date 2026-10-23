import { proxyJsonToBackend } from "@/app/api/utils/backend";

export async function POST(request) {
  try {
    const body = await request.text();
    return proxyJsonToBackend(request, "/safety/reports", {
      method: "POST",
      body,
      headers: {
        "Content-Type": request.headers.get("content-type") || "application/json",
      },
    });
  } catch (err) {
    console.error("POST /api/safety/reports", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
