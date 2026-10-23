const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || process.env.VITE_API_URL || "http://localhost:8000";

function buildTargetUrl() {
  return `${API_BASE_URL.replace(/\/$/, "")}/ussd/callback`;
}

function buildFormEncodedPayload(payload) {
  const form = new URLSearchParams();

  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined || value === null) {
      continue;
    }
    form.set(key, String(value));
  }

  return form;
}

async function forwardUssdRequest(request) {
  const contentType = request.headers.get("content-type") || "";
  const targetUrl = buildTargetUrl();

  let body;
  const headers = { Accept: "text/plain" };

  if (contentType.includes("application/json")) {
    const payload = await request.json();
    body = buildFormEncodedPayload({
      sessionId: payload.sessionId || payload.session_id,
      serviceCode: payload.serviceCode || payload.service_code || "*384#",
      phoneNumber: payload.phoneNumber || payload.phone_number || payload.msisdn,
      text: payload.text || payload.input || "",
    });
    headers["Content-Type"] = "application/x-www-form-urlencoded";
  } else if (contentType.includes("application/x-www-form-urlencoded")) {
    body = await request.text();
    headers["Content-Type"] = "application/x-www-form-urlencoded";
  } else if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    body = buildFormEncodedPayload({
      sessionId: form.get("sessionId") || form.get("session_id"),
      serviceCode: form.get("serviceCode") || form.get("service_code") || "*384#",
      phoneNumber: form.get("phoneNumber") || form.get("phone_number") || form.get("msisdn"),
      text: form.get("text") || form.get("input") || "",
    });
    headers["Content-Type"] = "application/x-www-form-urlencoded";
  } else {
    body = await request.text();
    if (contentType) {
      headers["Content-Type"] = contentType;
    }
  }

  try {
    const response = await fetch(targetUrl, {
      method: "POST",
      headers,
      body,
      cache: "no-store",
    });

    const responseText = await response.text();

    return new Response(responseText, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("content-type") || "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response(
      "END USSD backend is temporarily unavailable. Please try again shortly.",
      {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
        },
      },
    );
  }
}

export async function POST(request) {
  try {
    return await forwardUssdRequest(request);
  } catch (err) {
    console.error("USSD callback proxy error:", err);
    return new Response(
      "END Sorry, a technical error occurred. Please try again later.",
      {
        status: 502,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      },
    );
  }
}

export async function GET() {
  return Response.json({
    endpoint: "ElevateHer USSD Callback Proxy",
    upstream: buildTargetUrl(),
    service_code: "*384#",
    format: "Proxy to canonical FastAPI USSD gateway",
    supported_languages: ["en", "ms", "id", "th", "ja"],
    note: "POST sessionId, phoneNumber, and cumulative text to exercise the real FastAPI USSD flow.",
  });
}
