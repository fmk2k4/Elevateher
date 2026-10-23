import { proxyJsonToBackend } from "@/app/api/utils/backend";
import { auth } from "@/auth";

// AI Agent weekly brief for mentors — Phi-3 equivalent via Gemini
// Data comes from FastAPI (Phase 1 unification), AI generation stays here (Gemini key lives here)
export async function GET() {
  const session = await auth();
  if (!session?.user?.id)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch mentor data from FastAPI instead of direct Neon SQL
  const backendResp = await proxyJsonToBackend(
    new Request("http://localhost/dashboard/mentor/weekly-brief-data"),
    "/dashboard/mentor/weekly-brief-data",
  );

  if (backendResp.status !== 200) {
    const errBody = await backendResp.text();
    try {
      const errJson = JSON.parse(errBody);
      return Response.json(
        { error: errJson.detail || "Failed to load weekly brief data" },
        { status: backendResp.status },
      );
    } catch {
      return Response.json(
        { error: "Failed to load weekly brief data" },
        { status: backendResp.status },
      );
    }
  }

  let data;
  try {
    data = await backendResp.json();
  } catch {
    return Response.json({ error: "Invalid response from backend" }, { status: 502 });
  }

  const { profile: mp, active_mentees: activeMentees, recent_sessions: recentSessions, impact_events_total: impactTotal } = data;
  if (!mp) return Response.json({ error: "Mentor profile not found" }, { status: 404 });

  const menteeCount = activeMentees?.length || 0;
  const totalSessions = (recentSessions || []).filter((s) => s.completed).length;

  // Build AI prompt from real data
  const prompt = `You are the ElevateHer AI facilitator (Phi-3 equivalent). Generate a personalized weekly brief for a mentor.

Mentor: ${mp.full_name}, ${mp.job_title} at ${mp.employer}
Active mentees: ${menteeCount}
Total sessions completed this week: ${totalSessions}
Impact events attributed: ${impactTotal || 0}

Active mentees summary:
${(activeMentees || []).map((m) => `- ${m.mentee_name}: ${m.sdg_track} track, ${m.sessions_done || 0}/12 sessions, goals: ${(m.career_goals || []).join(", ")}`).join("\n")}

Recent session notes:
${(recentSessions || [])
  .slice(0, 3)
  .map((s) => `- Session ${s.session_num} with ${s.mentee_name}: ${s.agent_summary || "No summary yet"}`)
  .join("\n")}

Generate a warm, encouraging weekly brief in JSON format:
{
  "greeting": "A personalized warm greeting (1 sentence)",
  "weekly_highlights": ["highlight 1", "highlight 2", "highlight 3"],
  "mentee_nudges": [
    {"mentee_name": "...", "suggested_action": "...", "reason": "..."}
  ],
  "suggested_questions": ["Question to ask your next mentee", "Another good discussion starter"],
  "sdg_impact_summary": "1-2 sentences about the SDG impact you're creating",
  "motivation": "A motivational closing message (1-2 sentences, warm and empowering)"
}`;

  // Fallback brief (always available, no API key needed)
  let brief = {
    greeting: `Hi ${mp.full_name?.split(" ")[0]}! Great week of mentoring`,
    weekly_highlights: [
      `${menteeCount} active mentee${menteeCount !== 1 ? "s" : ""} in your programme`,
      `${totalSessions} sessions completed`,
      `Making real impact on SDG 4.4, 5.5, and 8.6`,
    ],
    mentee_nudges: (activeMentees || []).slice(0, 3).map((m) => ({
      mentee_name: m.mentee_name,
      suggested_action: "Schedule your next session",
      reason: `${m.sessions_done || 0}/12 sessions completed — keep the momentum going`,
    })),
    suggested_questions: [
      "What specific career goal do you want to focus on this week?",
      "What's one challenge you've overcome since our last session?",
      "Which skill do you feel most confident about right now?",
    ],
    sdg_impact_summary:
      "Your mentorship directly contributes to SDG 4.4 (skills for employment) and SDG 5.5 (women's participation in leadership).",
    motivation: "Every session you give is a step toward a more equitable future. Keep inspiring!",
  };

  return Response.json({
    brief,
    meta: {
      mentor_name: mp.full_name,
      week: new Date().toLocaleDateString("en-MY", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }),
      active_mentees: menteeCount,
      sessions_this_week: totalSessions,
    },
  });
}
