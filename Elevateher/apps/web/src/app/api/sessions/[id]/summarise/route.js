import { proxyJsonToBackend } from "@/app/api/utils/backend";

// Proxy to FastAPI /session/{id}/summarise endpoint
// FastAPI handles DB access, AI summarization (via Phi-3/Gemini/llama.cpp), and session updates
export async function POST(request, { params }) {
  const { id: sessionId } = params;

  // Proxy to FastAPI's summarise endpoint
  return proxyJsonToBackend(request, `/session/${sessionId}/summarise`, {
    method: "POST",
    body: JSON.stringify({}),
    headers: { "Content-Type": "application/json" },
  });
}