"use client";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import NotificationsPanel from "@/components/NotificationsPanel";

const S = {
  page: {
    minHeight: "100vh",
    background: "#0F0A1E",
    color: "#fff",
    fontFamily: "'Inter', sans-serif",
  },
  nav: {
    background: "rgba(255,255,255,0.03)",
    borderBottom: "1px solid rgba(255,255,255,0.07)",
    padding: "0 24px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    height: 64,
  },
  card: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 24,
  },
  stat: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: "20px 24px",
  },
  badge: (color) => ({
    display: "inline-block",
    padding: "3px 10px",
    borderRadius: 100,
    fontSize: 11,
    fontWeight: 700,
    background: `${color}22`,
    color,
    border: `1px solid ${color}44`,
  }),
  chip: {
    padding: "4px 10px",
    borderRadius: 100,
    background: "rgba(124,58,237,0.15)",
    border: "1px solid rgba(124,58,237,0.3)",
    color: "#A78BFA",
    fontSize: 12,
    display: "inline-block",
    margin: "2px",
  },
};

const SDG_COLOR = {
  STEM: "#7C3AED",
  Business: "#2563EB",
  Trades: "#D97706",
  Creative: "#EC4899",
  Healthcare: "#059669",
};

function MentorCard({ mentor, onRequest }) {
  return (
    <div
      style={{ ...S.card, display: "flex", flexDirection: "column", gap: 16 }}
    >
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #7C3AED, #EC4899)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 20,
            flexShrink: 0,
          }}
        >
          {mentor.full_name?.[0] || "M"}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>
            {mentor.display_name || mentor.full_name}
          </div>
          <div
            style={{
              color: "rgba(255,255,255,0.5)",
              fontSize: 13,
              marginTop: 2,
            }}
          >
            {mentor.job_title} · {mentor.employer}
          </div>
          <div
            style={{
              color: "rgba(255,255,255,0.35)",
              fontSize: 12,
              marginTop: 2,
            }}
          >
            {mentor.country} · {mentor.years_exp} yrs exp
          </div>
        </div>
        <span style={S.badge("#10B981")}>✓ Verified</span>
      </div>
      <p
        style={{
          fontSize: 13,
          color: "rgba(255,255,255,0.55)",
          lineHeight: 1.7,
          margin: 0,
        }}
      >
        {mentor.bio?.slice(0, 150)}
        {mentor.bio?.length > 150 ? "…" : ""}
      </p>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {(mentor.skills || []).slice(0, 4).map((s) => (
          <span key={s} style={S.chip}>
            {s}
          </span>
        ))}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>
          {mentor.current_mentees}/{mentor.max_mentees} mentees ·{" "}
          {(mentor.languages || []).join(", ")}
        </div>
        <button
          onClick={() => onRequest(mentor)}
          style={{
            padding: "8px 18px",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 700,
            background: "linear-gradient(135deg, #7C3AED, #EC4899)",
            color: "#fff",
            border: "none",
            cursor: "pointer",
          }}
        >
          Request →
        </button>
      </div>
    </div>
  );
}

export default function MenteeDashboard() {
  const [profile, setProfile] = useState(null);
  const [requesting, setRequesting] = useState(false);
  const [startingSession, setStartingSession] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportForm, setReportForm] = useState({ reason: '', description: '', severity: 'medium' });
  const [reporting, setReporting] = useState(false);

  const { data: userProfile, isLoading: profileLoading } = useQuery({
    queryKey: ["menteeProfile"],
    queryFn: async () => {
      try {
        const r = await fetch("/api/mentee/profile");
        return r.ok ? r.json() : null;
      } catch (e) {
        return null;
      }
    },
  });

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ["dashStats"],
    queryFn: async () => {
      try {
        const r = await fetch("/api/dashboard/stats");
        return r.ok ? r.json() : null;
      } catch (e) {
        return null;
      }
    },
  });

  const { data: matchesData, isLoading: matchesLoading } = useQuery({
    queryKey: ["myMatches"],
    queryFn: async () => {
      try {
        const r = await fetch("/api/matches");
        return r.ok ? r.json() : null;
      } catch (e) {
        return null;
      }
    },
    refetchInterval: 5000,
  });

  const { data: mentorsData, isLoading: mentorsLoading } = useQuery({
    queryKey: ["mentorList"],
    queryFn: async () => {
      try {
        const r = await fetch("/api/mentor/list?limit=6");
        return r.ok ? r.json() : null;
      } catch (e) {
        return null;
      }
    },
    enabled: !matchesData?.matches?.some((m) => m.status === "active"),
  });

  useEffect(() => {
    if (profileLoading) return;
    if (!userProfile?.profile) {
      fetch("/api/users/profile")
        .then((r) => {
          if (!r.ok) throw new Error("API error");
          return r.json();
        })
        .then(({ user }) => {
          if (user && user.onboarding_complete === false) {
            window.location.href = "/onboarding/mentee";
          }
        })
        .catch(() => {
          // API not available, demo mode allowed
        });
    } else if (userProfile.profile && userProfile.profile.onboarding_complete === false) {
       window.location.href = "/onboarding/mentee";
    }
  }, [userProfile]);

  const isLoading = profileLoading || statsLoading || matchesLoading || mentorsLoading;
  
  if (isLoading) {
    return (
      <div style={S.page}>
        <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
           <div style={{ color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: 12 }}>
             <div className="spinner" style={{ width: 24, height: 24, border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#7C3AED', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
             <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
             Loading your dashboard...
           </div>
        </div>
      </div>
    );
  }

  const myProfile = userProfile?.profile;
  const stats = statsData?.stats;
  const matches = matchesData?.matches || [];
  const activeMatch = matches.find((m) => m.status === "active");
  const pendingMatch = matches.find((m) => m.status === "pending");
  const mentors = mentorsData?.mentors || [];

  const STAT_CARDS = [
    {
      label: "Sessions Completed",
      value: stats?.sessions_completed || 0,
      icon: "📚",
      color: "#7C3AED",
    },
    {
      label: "Active Mentor",
      value: activeMatch ? "1" : "—",
      icon: "⭐",
      color: "#EC4899",
    },
    {
      label: "Impact Events",
      value: stats?.impact_events?.length || 0,
      icon: "🏆",
      color: "#10B981",
    },
    {
      label: "Programme Week",
      value: activeMatch
        ? Math.ceil(
            (Date.now() - new Date(activeMatch.started_at)) /
              (7 * 24 * 3600 * 1000),
          ) || 1
        : "—",
      icon: "📅",
      color: "#F59E0B",
    },
  ];

  const handleStartSession = async (matchId) => {
    setStartingSession(true);
    try {
      // Try to find an existing open session first
      const sessionsRes = await fetch(`/api/sessions?match_id=${matchId}`);
      if (sessionsRes.ok) {
        const sessionsData = await sessionsRes.json();
        const openSession = sessionsData.sessions?.find((s) => !s.completed);
        if (openSession) {
          window.location.href = `/session/${openSession.id}`;
          return;
        }
      }
      // Create a new session
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ match_id: matchId, channel: "web" }),
      });
      if (res.ok) {
        const { session } = await res.json();
        window.location.href = `/session/${session.id}`;
      }
    } catch (e) {
      console.error(e);
    }
    setStartingSession(false);
  };

  const handleReport = async (e) => {
    e.preventDefault();
    setReporting(true);
    try {
      const res = await fetch("/api/safety/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reported_user_id: activeMatch?.mentor_id,
          match_id: activeMatch?.id,
          reason: reportForm.reason,
          description: reportForm.description,
          severity: reportForm.severity,
        }),
      });
      if (res.ok) {
        toast.success("Report submitted successfully. Our safety team will review it.");
        setShowReportModal(false);
        setReportForm({ reason: '', description: '', severity: 'medium' });
      } else {
        throw new Error("Failed to submit report");
      }
    } catch (e) {
      toast.error("Error: " + e.message);
    } finally {
      setReporting(false);
    }
  };

  return (
    <div style={S.page}>
      {/* Nav */}
      <nav style={S.nav}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }}>🌟</span>
          <span
            style={{
              fontWeight: 800,
              fontSize: 18,
              background: "linear-gradient(135deg, #A78BFA, #EC4899)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            ElevateHer
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <a
            href="/mentee/candidates"
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              background: "rgba(124,58,237,0.12)",
              border: "1px solid rgba(124,58,237,0.25)",
              color: "#A78BFA",
              textDecoration: "none",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            🔍 Find Mentor
          </a>
          <a
            href="/session/ai-tutor"
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              background: "linear-gradient(135deg, rgba(245,158,11,0.18), rgba(124,58,237,0.18))",
              border: "1px solid rgba(245,158,11,0.35)",
              color: "#F59E0B",
              textDecoration: "none",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            🤖 Ask Ela
          </a>
          <a
            href="/mentee/matches"
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.7)",
              textDecoration: "none",
              fontSize: 13,
            }}
          >
            🤝 My Matches
          </a>
          <a
            href="/mentee/impact"
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              background: "rgba(16,185,129,0.1)",
              border: "1px solid rgba(16,185,129,0.2)",
              color: "#6EE7B7",
              textDecoration: "none",
              fontSize: 13,
            }}
          >
            🌱 Impact
          </a>
          <a
            href="/ussd-simulator"
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.5)",
              textDecoration: "none",
              fontSize: 13,
            }}
          >
            📱 USSD
          </a>
          <NotificationsPanel />
          <a
            href="/mentee/profile"
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.8)",
              textDecoration: "none",
              fontSize: 13,
            }}
          >
            👤 My Profile
          </a>
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
            {myProfile?.display_name || myProfile?.full_name || "Mentee"}
          </span>
          <a
            href="/account/logout"
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              background: "rgba(255,255,255,0.07)",
              color: "rgba(255,255,255,0.6)",
              textDecoration: "none",
              fontSize: 13,
            }}
          >
            Sign out
          </a>
        </div>
      </nav>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>
        {statsData === null && (
          <div style={{ background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)", padding: 16, borderRadius: 12, marginBottom: 24, color: "#FCA5A5" }}>
            <strong>Demo Mode (Backend Unreachable):</strong> The backend service is currently offline. You are viewing cached or zeroed data. Some features may not work.
          </div>
        )}
        {/* Welcome */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>
            Welcome back,{" "}
            {myProfile?.display_name ||
              myProfile?.full_name?.split(" ")[0] ||
              "there"}{" "}
            👋
          </h1>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            {myProfile?.sdg_track && (
              <span
                style={S.badge(SDG_COLOR[myProfile.sdg_track] || "#7C3AED")}
              >
                {myProfile.sdg_track} Track
              </span>
            )}
            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>
              Your 12-week mentorship journey
            </span>
          </div>
        </div>

        {/* Progress Timeline (U2) */}
        <div style={{ ...S.card, marginBottom: 28 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Journey Progress</div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, width: "100%", overflowX: "auto", paddingBottom: 8 }}>
            {Array.from({ length: 12 }).map((_, i) => {
              const isCompleted = i < (stats?.sessions_completed || 0);
              const isNext = i === (stats?.sessions_completed || 0);
              return (
                <div key={i} style={{ flex: 1, minWidth: 40, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                  <div style={{ 
                    width: 24, height: 24, borderRadius: "50%", 
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700,
                    background: isCompleted ? "#10B981" : isNext ? "rgba(124,58,237,0.2)" : "rgba(255,255,255,0.05)",
                    border: `1px solid ${isCompleted ? "#10B981" : isNext ? "#7C3AED" : "rgba(255,255,255,0.1)"}`,
                    color: isCompleted ? "#000" : isNext ? "#A78BFA" : "rgba(255,255,255,0.3)"
                  }}>
                    {isCompleted ? "✓" : i + 1}
                  </div>
                  <div style={{ height: 2, width: "100%", background: isCompleted ? "rgba(16,185,129,0.3)" : "rgba(255,255,255,0.05)" }} />
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 8 }}>
            {stats?.sessions_completed || 0} of 12 sessions completed. 
            {(stats?.sessions_completed || 0) < 12 ? ` Session ${(stats?.sessions_completed || 0) + 1} is up next.` : " You have completed all sessions!"}
          </div>
        </div>

        {/* Ela AI Tutor Hero Card */}
        <div
          style={{
            background: "linear-gradient(135deg, rgba(245,158,11,0.12), rgba(124,58,237,0.12), rgba(236,72,153,0.08))",
            border: "1px solid rgba(245,158,11,0.28)",
            borderRadius: 20,
            padding: 28,
            marginBottom: 28,
            display: "flex",
            gap: 24,
            alignItems: "center",
            flexWrap: "wrap",
            boxShadow: "0 0 40px rgba(245,158,11,0.08)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Decorative glow */}
          <div
            style={{
              position: "absolute",
              top: -30,
              right: -30,
              width: 140,
              height: 140,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(245,158,11,0.18) 0%, transparent 70%)",
              pointerEvents: "none",
            }}
          />
          {/* Avatar */}
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #F59E0B, #7C3AED)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 34,
              flexShrink: 0,
              boxShadow: "0 0 24px rgba(245,158,11,0.4)",
            }}
          >
            🤖
          </div>
          {/* Text */}
          <div style={{ flex: 1, minWidth: 200 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#F59E0B",
                letterSpacing: "0.08em",
                marginBottom: 6,
              }}
            >
              AI CAREER COACH · AVAILABLE NOW
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>
              Chat with Ela
            </h2>
            <p
              style={{
                color: "rgba(255,255,255,0.6)",
                fontSize: 14,
                margin: 0,
                lineHeight: 1.6,
              }}
            >
              Your AI mentor is ready. Ask career questions, get coaching on next
              steps, or talk through what's on your mind — any time, no appointment
              needed.
            </p>
            <div
              style={{
                display: "flex",
                gap: 6,
                marginTop: 12,
                flexWrap: "wrap",
              }}
            >
              {["Socratic coaching", "24/7 available", "12-session memory", "Powered by DeepSeek"].map(
                (tag) => (
                  <span
                    key={tag}
                    style={{
                      fontSize: 11,
                      padding: "3px 9px",
                      borderRadius: 100,
                      background: "rgba(245,158,11,0.12)",
                      border: "1px solid rgba(245,158,11,0.25)",
                      color: "#F59E0B",
                    }}
                  >
                    {tag}
                  </span>
                )
              )}
            </div>
          </div>
          {/* CTA */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <a
              href="/session/ai-tutor"
              style={{
                padding: "12px 28px",
                borderRadius: 12,
                background: "linear-gradient(135deg, #F59E0B, #7C3AED)",
                color: "#fff",
                fontWeight: 800,
                fontSize: 15,
                textDecoration: "none",
                textAlign: "center",
                boxShadow: "0 0 20px rgba(245,158,11,0.3)",
                display: "block",
              }}
            >
              🤖 Start AI Session
            </a>
            <div
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.35)",
                textAlign: "center",
              }}
            >
              No sign-up · Instant · Free
            </div>
          </div>
        </div>

        {/* Stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 16,
            marginBottom: 32,
          }}
        >
          {STAT_CARDS.map((s) => (
            <div key={s.label} style={S.stat}>
              <div style={{ fontSize: 26 }}>{s.icon}</div>
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 900,
                  color: s.color,
                  marginTop: 8,
                }}
              >
                {s.value}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "rgba(255,255,255,0.45)",
                  marginTop: 4,
                }}
              >
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* Current match banner */}
        {activeMatch && (
          <div
            style={{
              ...S.card,
              background:
                "linear-gradient(135deg, rgba(124,58,237,0.15), rgba(236,72,153,0.1))",
              border: "1px solid rgba(124,58,237,0.25)",
              marginBottom: 32,
              display: "flex",
              gap: 20,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <div style={{ flex: 1, minWidth: 200 }}>
              <div
                style={{
                  fontSize: 12,
                  color: "#A78BFA",
                  fontWeight: 700,
                  marginBottom: 8,
                }}
              >
                YOUR ACTIVE MENTOR
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>
                {activeMatch.mentor_name}
              </h3>
              <p
                style={{
                  color: "rgba(255,255,255,0.55)",
                  fontSize: 14,
                  margin: 0,
                }}
              >
                {activeMatch.job_title} · {activeMatch.industry}
              </p>
              <p
                style={{
                  color: "rgba(255,255,255,0.4)",
                  fontSize: 13,
                  marginTop: 8,
                }}
              >
                {activeMatch.sessions_completed || 0} sessions completed ·{" "}
                {activeMatch.match_reason || "Matched by AI"}
              </p>
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button
                style={{
                  padding: "10px 20px",
                  borderRadius: 10,
                  background: "linear-gradient(135deg, #7C3AED, #EC4899)",
                  color: "#fff",
                  fontWeight: 700,
                  border: "none",
                  cursor: startingSession ? "not-allowed" : "pointer",
                  fontSize: 14,
                  opacity: startingSession ? 0.7 : 1,
                }}
                onClick={() => handleStartSession(activeMatch.id)}
                disabled={startingSession}
              >
                {startingSession ? "⏳ Opening…" : "💬 Open Session Chat"}
              </button>
              <a
                href={`/session/ai-tutor`}
                style={{
                  padding: "10px 20px",
                  borderRadius: 10,
                  background: "linear-gradient(135deg, rgba(245,158,11,0.2), rgba(124,58,237,0.2))",
                  color: "#F59E0B",
                  fontWeight: 700,
                  border: "1px solid rgba(245,158,11,0.3)",
                  cursor: "pointer",
                  fontSize: 14,
                  textDecoration: "none",
                  display: "inline-block",
                }}
              >
                🤖 Ask Ela
              </a>
              <button
                onClick={() => toast.info("Scheduling integration coming soon!")}
                style={{
                  padding: "10px 20px",
                  borderRadius: 10,
                  background: "rgba(255,255,255,0.08)",
                  color: "#fff",
                  fontWeight: 600,
                  border: "1px solid rgba(255,255,255,0.12)",
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                📅 Schedule Session
              </button>
              <button
                onClick={() => setShowReportModal(true)}
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  background: "rgba(239,68,68,0.15)",
                  color: "#FCA5A5",
                  fontWeight: 600,
                  border: "1px solid rgba(239,68,68,0.3)",
                  cursor: "pointer",
                  fontSize: 13,
                  marginLeft: "auto",
                }}
              >
                ⚠️ Report Issue
              </button>
            </div>
          </div>
        )}

        {pendingMatch && !activeMatch && (
          <div
            style={{
              ...S.card,
              background: "rgba(245,158,11,0.08)",
              border: "1px solid rgba(245,158,11,0.25)",
              marginBottom: 32,
            }}
          >
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <span style={{ fontSize: 32 }}>⏳</span>
              <div>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>
                  Match Pending — {pendingMatch.mentor_name}
                </div>
                <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>
                  Waiting for mentor to accept your request. Usually within
                  24–48 hours.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Browse mentors */}
        {!activeMatch && !pendingMatch && (
          <div style={{ marginBottom: 32 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 20,
              }}
            >
              <div>
                <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>
                  Find your mentor
                </h2>
                <p
                  style={{
                    color: "rgba(255,255,255,0.45)",
                    fontSize: 14,
                    margin: 0,
                  }}
                >
                  Our AI-matched approved mentors for you
                </p>
              </div>
            </div>
            {mentors.length === 0 ? (
              <div style={{ ...S.card, textAlign: "center", padding: 48 }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>
                  No mentors available yet
                </div>
                <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 14 }}>
                  We're adding new mentors every week. Check back soon!
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                  gap: 20,
                }}
              >
                {mentors.map((m) => (
                  <MentorCard
                    key={m.id}
                    mentor={m}
                    onRequest={(mentor) => {
                      setRequesting(true);
                      fetch("/api/matches", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ mentor_id: mentor.id }),
                      })
                        .then(() => window.location.reload())
                        .finally(() => setRequesting(false));
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Career goals + progress */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 20,
            marginBottom: 32,
          }}
        >
          <div style={S.card}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
              🎯 Your Career Goals
            </h3>
            {myProfile?.career_goals?.length ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {myProfile.career_goals.map((g) => (
                  <span key={g} style={S.chip}>
                    {g.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            ) : (
              <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 13 }}>
                No goals set yet
              </p>
            )}
          </div>
          <div style={S.card}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
              🌏 Programme Progress
            </h3>
            <div style={{ display: "flex", gap: 4 }}>
              {Array.from({ length: 12 }, (_, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    height: 8,
                    borderRadius: 4,
                    background:
                      i < (parseInt(stats?.sessions_completed) || 0)
                        ? "#7C3AED"
                        : "rgba(255,255,255,0.1)",
                  }}
                />
              ))}
            </div>
            <div
              style={{
                color: "rgba(255,255,255,0.4)",
                fontSize: 12,
                marginTop: 10,
              }}
            >
              {stats?.sessions_completed || 0} of 12 sessions completed
            </div>
          </div>
        </div>

        {/* SDG goals */}
        <div style={S.card}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
            🌱 SDG Goals We're Working Toward Together
          </h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 16,
            }}
          >
            {[
              {
                goal: "SDG 4.4",
                label: "Skills for employment",
                color: "#C41E3A",
                icon: "📚",
              },
              {
                goal: "SDG 5.5",
                label: "Women's participation",
                color: "#E5243B",
                icon: "👩‍💼",
              },
              {
                goal: "SDG 8.6",
                label: "Youth employment",
                color: "#A21942",
                icon: "💼",
              },
            ].map((sdg) => (
              <div
                key={sdg.goal}
                style={{
                  borderRadius: 10,
                  overflow: "hidden",
                  border: "1px solid rgba(255,255,255,0.07)",
                }}
              >
                <div
                  style={{
                    background: sdg.color,
                    padding: "10px 14px",
                    fontSize: 13,
                    fontWeight: 800,
                  }}
                >
                  {sdg.icon} {sdg.goal}
                </div>
                <div
                  style={{
                    padding: "10px 14px",
                    fontSize: 12,
                    color: "rgba(255,255,255,0.55)",
                  }}
                >
                  {sdg.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {showReportModal && (
          <div style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000
          }}>
            <div style={{ ...S.card, width: "100%", maxWidth: 500, background: "#1F1A30" }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>Report Safety Issue</h2>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", marginBottom: 20 }}>
                If you experience any inappropriate behavior, please report it immediately. Our safety team reviews all reports.
              </p>
              <form onSubmit={handleReport}>
                <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600 }}>Reason</label>
                <select 
                  style={{ width: "100%", padding: 10, borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", marginBottom: 16 }}
                  value={reportForm.reason}
                  onChange={(e) => setReportForm({...reportForm, reason: e.target.value})}
                  required
                >
                  <option value="">Select a reason...</option>
                  <option value="inappropriate_behavior">Inappropriate Behavior</option>
                  <option value="harassment">Harassment</option>
                  <option value="unprofessional">Unprofessional Conduct</option>
                  <option value="other">Other</option>
                </select>

                <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600 }}>Severity</label>
                <select 
                  style={{ width: "100%", padding: 10, borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", marginBottom: 16 }}
                  value={reportForm.severity}
                  onChange={(e) => setReportForm({...reportForm, severity: e.target.value})}
                  required
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>

                <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600 }}>Description (Optional)</label>
                <textarea 
                  style={{ width: "100%", padding: 10, borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", marginBottom: 24, minHeight: 80 }}
                  value={reportForm.description}
                  onChange={(e) => setReportForm({...reportForm, description: e.target.value})}
                  placeholder="Please provide details..."
                />

                <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                  <button type="button" onClick={() => setShowReportModal(false)} style={{ padding: "8px 16px", borderRadius: 8, background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", cursor: "pointer" }}>Cancel</button>
                  <button type="submit" disabled={reporting} style={{ padding: "8px 16px", borderRadius: 8, background: "#EF4444", border: "none", color: "#fff", fontWeight: 600, cursor: reporting ? "not-allowed" : "pointer" }}>
                    {reporting ? "Submitting..." : "Submit Report"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
