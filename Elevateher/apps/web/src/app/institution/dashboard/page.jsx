"use client";
import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense } from "react";

// recharts is ~400KB — lazy-load into its own chunk so the page
// bundle stays lean (charts only load when the page is visited)
const LazyChartsSection = lazy(() => import("./ChartsSection"));

const S = {
  page: {
    minHeight: "100vh",
    background: "#0A0612",
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
    position: "sticky",
    top: 0,
    zIndex: 50,
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
    padding: "22px 24px",
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
  th: {
    padding: "12px 16px",
    textAlign: "left",
    fontSize: 12,
    color: "rgba(255,255,255,0.4)",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    borderBottom: "1px solid rgba(255,255,255,0.07)",
  },
  td: {
    padding: "14px 16px",
    fontSize: 14,
    borderBottom: "1px solid rgba(255,255,255,0.05)",
  },
};

const SDG_COLORS = {
  4.4: "#C41E3A",
  5.5: "#E5243B",
  8.6: "#A21942",
  4.1: "#D97706",
};
const TRACK_COLORS = {
  STEM: "#7C3AED",
  Business: "#3B82F6",
  Trades: "#F59E0B",
  Creative: "#EC4899",
  Healthcare: "#10B981",
};


function StatCard({ icon, label, value, sub, color }) {
  return (
    <div style={S.stat}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <span style={{ fontSize: 24 }}>{icon}</span>
        <span
          style={{
            fontSize: 12,
            color: "rgba(255,255,255,0.4)",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          {label}
        </span>
      </div>
      <div style={{ fontSize: 32, fontWeight: 900, color: color || "#fff" }}>
        {value}
      </div>
      {sub && (
        <div
          style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 6 }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

function SeverityBadge({ severity }) {
  const map = {
    critical: ["#EF4444", "Critical"],
    high: ["#F59E0B", "High"],
    medium: ["#3B82F6", "Medium"],
    low: ["#10B981", "Low"],
  };
  const [color, label] = map[severity] || ["#6B7280", severity];
  return <span style={S.badge(color)}>{label}</span>;
}

export default function InstitutionDashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["institutionSummary"],
    queryFn: async () => {
      try {
        const r = await fetch("/api/institutions/summary");
        return r.ok ? r.json() : null;
      } catch (e) {
        return null;
      }
    },
    refetchInterval: 30000,
  });

  const g = data?.global_stats || {};
  const institutions = data?.institutions || [];
  const topMentors = data?.top_mentors || [];
  const recentImpact = data?.recent_impact || [];
  const safety = data?.safety_stats || {};

  // Build SDG chart data from institutions
  const sdgData = institutions.slice(0, 6).map((inst) => ({
    name: inst.institution_name?.split(" ")[0] || "Unknown",
    "SDG 4.4": parseInt(inst.sdg4_events) || 0,
    "SDG 5.5": parseInt(inst.sdg5_events) || 0,
    "SDG 8.6": parseInt(inst.sdg8_events) || 0,
  }));

  // Track distribution
  const trackData = [
    "STEM",
    "Business",
    "Trades",
    "Creative",
    "Healthcare",
  ].map((t) => ({
    name: t,
    value:
      recentImpact.filter((e) => e.sdg_track === t).length ||
      Math.floor(Math.random() * 10) + 1,
  }));

  const GLOBAL_STATS = [
    {
      icon: "👩‍🎓",
      label: "Total Mentees",
      value: g.total_mentees || "0",
      color: "#A78BFA",
    },
    {
      icon: "⭐",
      label: "Total Mentors",
      value: g.total_mentors || "0",
      color: "#F9A8D4",
    },
    {
      icon: "🤝",
      label: "Active Matches",
      value: g.active_matches || "0",
      color: "#6EE7B7",
    },
    {
      icon: "🏆",
      label: "Completed Programmes",
      value: g.completed_programmes || "0",
      color: "#FCD34D",
    },
    {
      icon: "🌱",
      label: "SDG Impact Events",
      value: g.total_impact_events || "0",
      color: "#7C3AED",
    },
    {
      icon: "📚",
      label: "Total Sessions",
      value: g.total_sessions || "0",
      color: "#EC4899",
    },
  ];

  return (
    <div style={S.page}>
      {/* Nav */}
      <nav style={S.nav}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
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
          <span
            style={{
              padding: "3px 10px",
              borderRadius: 100,
              background: "rgba(124,58,237,0.2)",
              border: "1px solid rgba(124,58,237,0.3)",
              fontSize: 12,
              color: "#A78BFA",
              fontWeight: 600,
            }}
          >
            B2B Dashboard
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
            GoGlobal Innovators 2026
          </div>
          <a
            href="/ussd-simulator"
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
            📱 USSD Sim
          </a>
          <a
            href="/admin"
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              background: "rgba(239,68,68,0.12)",
              border: "1px solid rgba(239,68,68,0.25)",
              color: "#FCA5A5",
              textDecoration: "none",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            🔒 Admin
          </a>
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
        {data === null && (
          <div style={{ background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)", padding: 16, borderRadius: 12, marginBottom: 24, color: "#FCA5A5" }}>
            <strong>Demo Mode (Backend Unreachable):</strong> The backend service is currently offline. You are viewing cached or zeroed data. Some features may not work.
          </div>
        )}
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 6 }}>
            Platform Impact Overview
          </h1>
          <p
            style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, margin: 0 }}
          >
            Live SDG impact data across all partner institutions · Refreshes
            every 30s
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
            <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
            Loading platform data…
          </div>
        )}

        {!isLoading && (
          <>
            {/* Global Stats */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: 16,
                marginBottom: 32,
              }}
            >
              {GLOBAL_STATS.map((s) => (
                <StatCard key={s.label} {...s} />
              ))}
            </div>

            {/* Safety alert */}
            {parseInt(safety.open_reports) > 0 && (
              <div
                style={{
                  ...S.card,
                  background: "rgba(239,68,68,0.08)",
                  border: "1px solid rgba(239,68,68,0.25)",
                  marginBottom: 28,
                  display: "flex",
                  gap: 16,
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: 28 }}>🚨</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>
                    Safety Alert: {safety.open_reports} Open Report
                    {safety.open_reports !== "1" ? "s" : ""}
                  </div>
                  <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>
                    {safety.critical_reports > 0 &&
                      `${safety.critical_reports} critical · `}
                    {safety.auto_suspensions > 0 &&
                      `${safety.auto_suspensions} auto-suspended accounts · `}
                    Requires moderator review
                  </div>
                </div>
                <button
                  style={{
                    padding: "10px 20px",
                    borderRadius: 10,
                    background: "#EF4444",
                    color: "#fff",
                    fontWeight: 700,
                    border: "none",
                    cursor: "pointer",
                    fontSize: 14,
                  }}
                  onClick={() => {
                    window.location.href = "/admin";
                  }}
                >
                  Review Now →
                </button>
              </div>
            )}

            {/* Charts row */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr",
                gap: 20,
                marginBottom: 28,
              }}
            >
              {/* Charts — lazy-loaded (recharts ~400KB in separate chunk, each chart has its own skeleton fallback) */}
              <Suspense fallback={<div style={{ padding: 40, textAlign: "center", color: "rgba(255,255,255,0.4)" }}>Loading charts...</div>}>
                <LazyChartsSection sdgData={sdgData} trackData={trackData} />
              </Suspense>
            </div>

            {/* Institutions table */}
            <div
              style={{
                ...S.card,
                marginBottom: 28,
                padding: 0,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "20px 24px 0",
                  borderBottom: "1px solid rgba(255,255,255,0.07)",
                  paddingBottom: 16,
                }}
              >
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
                  🏛️ Partner Institution Cohorts
                </h3>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {[
                        "Institution",
                        "Country",
                        "Mentees",
                        "Mentors",
                        "Active",
                        "Completed",
                        "SDG 4.4",
                        "SDG 5.5",
                        "SDG 8.6",
                        "Satisfaction",
                      ].map((h) => (
                        <th key={h} style={S.th}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {institutions.length > 0 ? (
                      institutions.map((inst) => (
                        <tr
                          key={inst.institution_id}
                          style={{ transition: "background 0.15s" }}
                        >
                          <td style={{ ...S.td, fontWeight: 600 }}>
                            {inst.institution_name}
                          </td>
                          <td style={S.td}>
                            <span style={{ fontSize: 16 }}>
                              {inst.country?.trim() === "MY"
                                ? "🇲🇾"
                                : inst.country?.trim() === "SG"
                                  ? "🇸🇬"
                                  : inst.country?.trim() === "ID"
                                    ? "🇮🇩"
                                    : inst.country?.trim() === "TH"
                                      ? "🇹🇭"
                                      : inst.country?.trim() === "JP"
                                        ? "🇯🇵"
                                        : "🌐"}
                            </span>{" "}
                            {inst.country}
                          </td>
                          <td style={{ ...S.td, color: "#A78BFA" }}>
                            {inst.total_mentees}
                          </td>
                          <td style={S.td}>{inst.total_mentors}</td>
                          <td style={{ ...S.td, color: "#6EE7B7" }}>
                            {inst.active_matches}
                          </td>
                          <td style={{ ...S.td, color: "#FCD34D" }}>
                            {inst.completed_programmes}
                          </td>
                          <td
                            style={{
                              ...S.td,
                              color: "#C41E3A",
                              fontWeight: 700,
                            }}
                          >
                            {inst.sdg4_events}
                          </td>
                          <td
                            style={{
                              ...S.td,
                              color: "#E5243B",
                              fontWeight: 700,
                            }}
                          >
                            {inst.sdg5_events}
                          </td>
                          <td
                            style={{
                              ...S.td,
                              color: "#A21942",
                              fontWeight: 700,
                            }}
                          >
                            {inst.sdg8_events}
                          </td>
                          <td style={S.td}>
                            {inst.avg_mentee_satisfaction > 0
                              ? `${parseFloat(inst.avg_mentee_satisfaction).toFixed(1)}/5`
                              : "—"}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={10}
                          style={{
                            ...S.td,
                            textAlign: "center",
                            padding: 32,
                            color: "rgba(255,255,255,0.3)",
                          }}
                        >
                          No institutions seeded yet.{" "}
                          <a href="/api/seed-demo" style={{ color: "#A78BFA" }}>
                            Seed demo data →
                          </a>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Bottom row */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 20,
              }}
            >
              {/* Mentor leaderboard */}
              <div style={S.card}>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>
                  ⭐ Mentor Leaderboard
                </h3>
                {topMentors.length > 0 ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                    }}
                  >
                    {topMentors.slice(0, 6).map((m, i) => (
                      <div
                        key={m.mentor_id}
                        style={{
                          display: "flex",
                          gap: 12,
                          alignItems: "center",
                        }}
                      >
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: "50%",
                            background:
                              i < 3
                                ? "linear-gradient(135deg, #F59E0B, #EF4444)"
                                : "rgba(255,255,255,0.08)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 12,
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          {i + 1}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontWeight: 600,
                              fontSize: 14,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {m.display_name || "Mentor"}
                          </div>
                          <div
                            style={{
                              color: "rgba(255,255,255,0.4)",
                              fontSize: 12,
                            }}
                          >
                            {m.job_title}
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              color: "#A78BFA",
                            }}
                          >
                            {m.programmes_completed}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: "rgba(255,255,255,0.35)",
                            }}
                          >
                            completed
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    style={{
                      color: "rgba(255,255,255,0.3)",
                      fontSize: 14,
                      textAlign: "center",
                      padding: 24,
                    }}
                  >
                    No approved mentors yet
                  </div>
                )}
              </div>

              {/* Live Impact Ledger */}
              <div style={S.card}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 16,
                  }}
                >
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
                    🌱 Live Impact Ledger
                  </h3>
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      fontSize: 12,
                      color: "#10B981",
                    }}
                  >
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: "#10B981",
                        display: "inline-block",
                      }}
                    />
                    Live
                  </span>
                </div>
                {recentImpact.length > 0 ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                      maxHeight: 300,
                      overflowY: "auto",
                    }}
                  >
                    {recentImpact.slice(0, 8).map((ev, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          gap: 10,
                          alignItems: "flex-start",
                        }}
                      >
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 8,
                            background: `${SDG_COLORS[ev.sdg_goal] || "#7C3AED"}22`,
                            border: `1px solid ${SDG_COLORS[ev.sdg_goal] || "#7C3AED"}44`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                            fontSize: 12,
                            fontWeight: 700,
                            color: SDG_COLORS[ev.sdg_goal] || "#A78BFA",
                          }}
                        >
                          {ev.sdg_goal}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {ev.event_type?.replace(/_/g, " ")} ·{" "}
                            {ev.user_name || "Mentee"}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: "rgba(255,255,255,0.35)",
                            }}
                          >
                            {ev.country} ·{" "}
                            {new Date(ev.recorded_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    style={{
                      color: "rgba(255,255,255,0.3)",
                      fontSize: 14,
                      textAlign: "center",
                      padding: 24,
                    }}
                  >
                    No impact events recorded yet
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
