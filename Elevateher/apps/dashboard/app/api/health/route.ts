import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  // Use API_URL (http://api:8000) for server-side fetches inside Docker
  // Use NEXT_PUBLIC_API_URL (http://localhost:8000) for browser-side fetches
  const apiBase = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const token = process.env.DASHBOARD_SERVICE_TOKEN || "";
  const tokenLooksLikeJwt = token.split(".").length === 3;

  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

  if (!isDemoMode && (!token || !tokenLooksLikeJwt)) {
    throw new Error("CRITICAL_CONFIG_ERROR: DASHBOARD_SERVICE_TOKEN is missing or invalid in production.");
  }

  const result: Record<string, unknown> = {
    status: token && tokenLooksLikeJwt ? "ok" : "degraded",
    apiBase,
    dashboardTokenPresent: Boolean(token),
    dashboardTokenLooksLikeJwt: tokenLooksLikeJwt,
  };

  try {
    const upstream = await fetch(`${apiBase.replace(/\/$/, "")}/health`, {
      cache: "no-store",
    });
    result.apiReachable = upstream.ok;
    result.apiStatus = upstream.status;
  } catch (error) {
    result.apiReachable = false;
    result.apiError = error instanceof Error ? error.message : "Unknown error";
  }

  return NextResponse.json(result, {
    status: result.status === "ok" ? 200 : 503,
  });
}
