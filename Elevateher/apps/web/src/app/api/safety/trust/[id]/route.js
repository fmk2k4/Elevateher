const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function GET(request, { params }) {
  try {
    const mentorId = params.id;
    if (!mentorId) return Response.json({ error: "mentor id required" }, { status: 400 });

    // Extract Bearer token from the incoming request's Authorization header
    const authHeader = request.headers.get("Authorization");
    const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

    try {
      const backendRes = await fetch(`${API_BASE}/safety/trust/${mentorId}`, {
        headers: { Authorization: token ? `Bearer ${token}` : "" },
        signal: AbortSignal.timeout(4000),
      });
      if (!backendRes.ok) return Response.json(getDegradedBadge(mentorId));
      return Response.json(await backendRes.json());
    } catch {
      return Response.json(getDegradedBadge(mentorId));
    }
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

function getDegradedBadge(mentorId) {
  return {
    trust: {
      user_id: mentorId,
      verification_status: "unknown",
      trust_score: null,
      trust_tier: "unverified",
      badge: "unverified",
      can_mentor_minors: false,
    },
    display: {
      headline: "Safety check unavailable",
      supportive_text: "Trust verification is temporarily unavailable. Manual review is active."
    },
    _source: "degraded",
  };
}
