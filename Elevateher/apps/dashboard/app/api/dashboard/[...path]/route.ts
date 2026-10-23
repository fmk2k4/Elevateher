import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function buildProxyHeaders(req: NextRequest, token: string) {
  const headers: Record<string, string> = {};
  const inboundCT = req.headers.get("content-type") ?? "";

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (inboundCT) {
    headers["Content-Type"] = inboundCT;
  }

  const accept = req.headers.get("accept");
  if (accept) {
    headers.Accept = accept;
  }

  const lastEventId = req.headers.get("last-event-id");
  if (lastEventId) {
    headers["Last-Event-ID"] = lastEventId;
  }

  return headers;
}

function buildResponseHeaders(upstream: Response) {
  const headers = new Headers();
  const contentType = upstream.headers.get("content-type");
  const cacheControl = upstream.headers.get("cache-control");
  const connection = upstream.headers.get("connection");
  const buffering = upstream.headers.get("x-accel-buffering");

  if (contentType) {
    headers.set("Content-Type", contentType);
  }
  if (cacheControl) {
    headers.set("Cache-Control", cacheControl);
  }
  if (connection) {
    headers.set("Connection", connection);
  }
  if (buffering) {
    headers.set("X-Accel-Buffering", buffering);
  }

  return headers;
}

async function proxy(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
  method: string,
) {
  const { path = [] } = await ctx.params;
  // Prefer API_URL inside the container (server-side fetch); fall back to NEXT_PUBLIC_API_URL
  // for any environment where only the public URL is exposed.
  const apiBase =
    process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const token = req.cookies.get("dashboard_token")?.value || "";
  const target = `${apiBase.replace(/\/$/, "")}/${path.join("/")}${req.nextUrl.search}`;

  const headers = buildProxyHeaders(req, token);

  const init: RequestInit = { method, headers };
  if (method !== "GET" && method !== "HEAD") {
    init.body = await req.text();
  }
  if (method === "GET") {
    init.cache = "no-store";
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch (err) {
    return NextResponse.json(
      { error: "upstream_unreachable", target, message: (err as Error).message },
      { status: 502 },
    );
  }

  const responseHeaders = buildResponseHeaders(upstream);
  const contentType = upstream.headers.get("content-type") ?? "";
  const isEventStream = contentType.includes("text/event-stream");

  if (isEventStream) {
    // Use native Response for SSE streaming to avoid Next.js buffering
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  }

  const text = await upstream.text();
  if (!responseHeaders.has("Content-Type")) {
    responseHeaders.set("Content-Type", "application/json");
  }

  return new NextResponse(text, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  return proxy(req, ctx, "GET");
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  return proxy(req, ctx, "POST");
}

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  return proxy(req, ctx, "PUT");
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  return proxy(req, ctx, "PATCH");
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  return proxy(req, ctx, "DELETE");
}
