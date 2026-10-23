import { proxyJsonToBackend } from "@/app/api/utils/backend";
import { auth } from "@/auth";

// AI-powered mentor matching using Gemini (SEA-LION equivalent)
// Generates embeddings-free semantic match reasons

export async function POST(request) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.text();
    return proxyJsonToBackend(request, "/match", {
      method: "POST",
      body,
      headers: {
        "Content-Type": request.headers.get("content-type") || "application/json",
      },
    });
  } catch (err) {
    console.error("POST /api/ai/match", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
