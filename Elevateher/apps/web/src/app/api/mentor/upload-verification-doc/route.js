import { getRawAccessToken, getBackendBaseUrl } from "@/app/api/utils/backend";

export async function POST(request) {
  try {
    const token = await getRawAccessToken(request);
    if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await request.formData();
    const url = new URL("/mentor/upload-verification-doc", `${getBackendBaseUrl()}/`);
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    const data = await response.json();
    return Response.json(data, { status: response.status });
  } catch (err) {
    console.error("POST /api/mentor/upload-verification-doc error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
