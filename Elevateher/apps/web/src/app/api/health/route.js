import { getBackendBaseUrl } from "@/app/api/utils/backend";

export async function GET(request) {
  const url = new URL("/health", `${getBackendBaseUrl()}/`);
  try {
    const response = await fetch(url, { cache: "no-store" });
    const text = await response.text();
    return new Response(text, {
      status: response.status,
      headers: { "Content-Type": response.headers.get("content-type") || "application/json" }
    });
  } catch (error) {
    return Response.json({ status: "unreachable", details: String(error) }, { status: 502 });
  }
}
