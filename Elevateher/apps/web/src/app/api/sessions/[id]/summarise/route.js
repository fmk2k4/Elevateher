import { proxyJsonToBackend } from "@/app/api/utils/backend";
import { auth } from "@/auth";

// Proxy to FastAPI /session/{id}/summarise endpoint
// FastAPI handles DB access, AI summarization (via Phi-3/Gemini/llama.cpp), and session updates
export async function POST(request, { params }) {
  const session = await auth();
  if (!session?.user?.id)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id: sessionId } = params;

  // Proxy to FastAPI's summarise endpoint
  return proxyJsonToBackend(request, `/session/${sessionId}/summarise`, {
    method: "POST",
    body: JSON.stringify({}),
    headers: { "Content-Type": "application/json" },
  });
}