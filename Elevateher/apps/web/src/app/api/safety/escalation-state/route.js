import { auth } from "@/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * GET /api/safety/escalation-state?match_id=...
 *
 * Proxy to FastAPI /safety/escalation/state
 * Used by the session page RiskMeter component to poll grooming risk in real-time.
 * Falls back to a safe mock when the backend is unreachable (demo-safe).
 */
export async function GET(request) {
  try {
    const session = await auth();
    const { searchParams } = new URL(request.url);
    const matchId = searchParams.get("match_id");

    if (!matchId) {
      return Response.json({ error: "match_id required" }, { status: 400 });
    }

    if (!session?.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = session.accessToken || session.user?.accessToken;

    try {
      const backendRes = await fetch(
        `${API_BASE}/safety/escalation/state?match_id=${encodeURIComponent(matchId)}`,
        {
          headers: {
            Authorization: token ? `Bearer ${token}` : "",
            "Content-Type": "application/json",
          },
          signal: AbortSignal.timeout(4000),
        }
      );

      if (!backendRes.ok) {
        return Response.json(getDegradedEscalation(matchId));
      }

      const data = await backendRes.json();
      return Response.json(data);
    } catch (fetchErr) {
      console.warn("[escalation-state] Backend unreachable, returning degraded state:", fetchErr?.message);
      return Response.json(getDegradedEscalation(matchId));
    }
  } catch (err) {
    console.error("[escalation-state] Error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

function getDegradedEscalation(matchId) {
  return {
    escalation: {
      match_id: matchId,
      state: "service_degraded",
      risk_score: null,
      open_reports: 0,
      highest_severity: null,
      trigger_reasons: [],
      last_event_at: null,
      off_platform_count: 0,
      intimacy_count: 0,
      _degraded: true,
    },
    viewer_role: "mentee",
    _source: "degraded",
  };
}
