"use client";
import { useQuery } from "@tanstack/react-query";

const STATUS_STYLES = {
  pending: {
    bg: "rgba(245,158,11,0.12)",
    border: "rgba(245,158,11,0.3)",
    color: "#FCD34D",
    label: "⏳ Pending",
  },
  active: {
    bg: "rgba(16,185,129,0.12)",
    border: "rgba(16,185,129,0.3)",
    color: "#6EE7B7",
    label: "✅ Active",
  },
  completed: {
    bg: "rgba(124,58,237,0.12)",
    border: "rgba(124,58,237,0.3)",
    color: "#A78BFA",
    label: "🏆 Completed",
  },
  declined: {
    bg: "rgba(107,114,128,0.12)",
    border: "rgba(107,114,128,0.3)",
    color: "#9CA3AF",
    label: "✗ Declined",
  },
  cancelled: {
    bg: "rgba(107,114,128,0.12)",
    border: "rgba(107,114,128,0.3)",
    color: "#9CA3AF",
    label: "✗ Cancelled",
  },
};

function MatchCard({ match }) {
  const style = STATUS_STYLES[match.status] || STATUS_STYLES.pending;
  const weeksSinceStart = match.started_at
    ? Math.ceil(
        (Date.now() - new Date(match.started_at)) / (7 * 24 * 3600 * 1000),
      )
    : null;
  const progressPct = Math.min(
    ((parseInt(match.sessions_completed) || 0) / 12) * 100,
    100,
  );

  return (
    <div
      style={{
        background: style.bg,
        border: `1px solid ${style.border}`,
        borderRadius: 16,
        padding: 24,
        transition: "all 0.2s",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          gap: 14,
          alignItems: "flex-start",
          marginBottom: 16,
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #7C3AED, #EC4899)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 20,
            fontWeight: 800,
            flexShrink: 0,
          }}
        >
          {(match.mentor_name || "?")[0]}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>
            {match.mentor_name}
          </div>
          <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>
            {match.job_title} · {match.industry}
          </div>
          {match.sdg_track && (
            <div
              style={{
                color: "rgba(255,255,255,0.35)",
                fontSize: 12,
                marginTop: 2,
              }}
            >
              {match.sdg_track} Track
            </div>
          )}
        </div>
        <span
          style={{
            padding: "4px 12px",
            borderRadius: 100,
            fontSize: 12,
            fontWeight: 700,
            color: style.color,
            background: `${style.border.replace("0.3", "0.1")}`,
          }}
        >
          {style.label}
        </span>
      </div>

      {/* Match reason */}
      {match.match_reason && (
        <div
          style={{
            fontSize: 13,
            color: "rgba(255,255,255,0.55)",
            fontStyle: "italic",
            marginBottom: 12,
            paddingLeft: 8,
            borderLeft: "2px solid rgba(124,58,237,0.4)",
          }}
        >
          {match.match_reason}
        </div>
      )}

      {/* Progress (for active/completed) */}
      {(match.status === "active" || match.status === "completed") && (
        <div style={{ marginBottom: 14 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 6,
            }}
          >
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
              Programme Progress
            </span>
            <span
              style={{
                fontSize: 12,
                color: "rgba(255,255,255,0.6)",
                fontWeight: 600,
              }}
            >
              {match.sessions_completed || 0}/12 sessions
            </span>
          </div>
          <div
            style={{
              height: 6,
              background: "rgba(255,255,255,0.1)",
              borderRadius: 3,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${progressPct}%`,
                background: "linear-gradient(90deg, #7C3AED, #EC4899)",
                borderRadius: 3,
              }}
            />
          </div>
          {weeksSinceStart && (
            <div
              style={{
                fontSize: 12,
                color: "rgba(255,255,255,0.35)",
                marginTop: 6,
              }}
            >
              Week {weeksSinceStart} of 12
            </div>
          )}
        </div>
      )}

      {/* Satisfaction (for completed) */}
      {match.status === "completed" && match.mentee_satisfaction && (
        <div
          style={{
            fontSize: 13,
            color: "rgba(255,255,255,0.5)",
            marginBottom: 12,
          }}
        >
          Your rating: {"⭐".repeat(match.mentee_satisfaction)}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 10 }}>
        {match.status === "active" && (
          <a
            href={`/session/new?match_id=${match.id}`}
            style={{
              flex: 1,
              padding: "10px 0",
              borderRadius: 10,
              textAlign: "center",
              background: "linear-gradient(135deg, #7C3AED, #EC4899)",
              color: "#fff",
              textDecoration: "none",
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            💬 Open Chat
          </a>
        )}
        {match.status === "pending" && (
          <div
            style={{
              flex: 1,
              padding: "10px",
              background: "rgba(255,255,255,0.05)",
              borderRadius: 10,
              textAlign: "center",
              fontSize: 13,
              color: "rgba(255,255,255,0.4)",
            }}
          >
            Waiting for mentor to accept…
          </div>
        )}
        {match.status === "completed" && (
          <div
            style={{
              flex: 1,
              padding: "10px",
              background: "rgba(124,58,237,0.1)",
              borderRadius: 10,
              textAlign: "center",
              fontSize: 13,
              color: "#A78BFA",
              fontWeight: 600,
            }}
          >
            🏆 Programme Complete!
          </div>
        )}
      </div>
    </div>
  );
}

export default function MatchesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["myMatches"],
    queryFn: async () => {
      const r = await fetch("/api/matches");
      return r.ok ? r.json() : null;
    },
  });

  const matches = data?.matches || [];
  const activeMatches = matches.filter((m) => m.status === "active");
  const pendingMatches = matches.filter((m) => m.status === "pending");
  const completedMatches = matches.filter((m) => m.status === "completed");
  const otherMatches = matches.filter((m) =>
    ["declined", "cancelled"].includes(m.status),
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0F0A1E",
        color: "#fff",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* Nav */}
      <nav
        style={{
          background: "rgba(255,255,255,0.03)",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 64,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <a
            href="/mentee/dashboard"
            style={{
              color: "rgba(255,255,255,0.4)",
              textDecoration: "none",
              fontSize: 20,
            }}
          >
            ←
          </a>
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
          <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 14 }}>
            / My Matches
          </span>
        </div>
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
      </nav>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: 28 }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 26, fontWeight: 900, marginBottom: 6 }}>
            My Mentorship Matches
          </h1>
          <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 14 }}>
            {matches.length} match{matches.length !== 1 ? "es" : ""} total
          </p>
        </div>

        {isLoading && (
          <div
            style={{
              textAlign: "center",
              padding: 60,
              color: "rgba(255,255,255,0.4)",
            }}
          >
            Loading your matches…
          </div>
        )}

        {!isLoading && matches.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: 60,
              background: "rgba(255,255,255,0.03)",
              borderRadius: 20,
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>
              No matches yet
            </div>
            <div style={{ color: "rgba(255,255,255,0.4)", marginBottom: 24 }}>
              Browse our verified mentors to find your perfect match.
            </div>
            <a
              href="/mentee/candidates"
              style={{
                padding: "12px 28px",
                borderRadius: 12,
                background: "linear-gradient(135deg, #7C3AED, #EC4899)",
                color: "#fff",
                textDecoration: "none",
                fontWeight: 700,
              }}
            >
              Browse Mentors →
            </a>
          </div>
        )}

        {activeMatches.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>
              Active
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {activeMatches.map((m) => (
                <MatchCard key={m.id} match={m} />
              ))}
            </div>
          </div>
        )}

        {pendingMatches.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>
              Pending
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {pendingMatches.map((m) => (
                <MatchCard key={m.id} match={m} />
              ))}
            </div>
          </div>
        )}

        {completedMatches.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>
              Completed 🏆
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {completedMatches.map((m) => (
                <MatchCard key={m.id} match={m} />
              ))}
            </div>
          </div>
        )}

        {otherMatches.length > 0 && (
          <div>
            <h2
              style={{
                fontSize: 18,
                fontWeight: 700,
                marginBottom: 16,
                color: "rgba(255,255,255,0.5)",
              }}
            >
              History
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {otherMatches.map((m) => (
                <MatchCard key={m.id} match={m} />
              ))}
            </div>
          </div>
        )}

        {!activeMatches.length &&
          !pendingMatches.length &&
          matches.length > 0 && (
            <div style={{ marginTop: 32, textAlign: "center" }}>
              <a
                href="/mentee/candidates"
                style={{
                  padding: "12px 28px",
                  borderRadius: 12,
                  background: "linear-gradient(135deg, #7C3AED, #EC4899)",
                  color: "#fff",
                  textDecoration: "none",
                  fontWeight: 700,
                }}
              >
                Find a New Mentor →
              </a>
            </div>
          )}
      </div>
    </div>
  );
}
