"use client";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  badge: (color, bg) => ({
    display: "inline-block",
    padding: "4px 12px",
    borderRadius: 100,
    fontSize: 12,
    fontWeight: 700,
    background: bg || `${color}22`,
    color,
    border: `1px solid ${color}44`,
  }),
};

const STATUS_INFO = {
  unverified: { label: "Unverified", color: "#6B7280", icon: "○" },
  pending_id: { label: "ID Pending", color: "#F59E0B", icon: "⏳" },
  pending_employment: {
    label: "Employment Docs Pending",
    color: "#F59E0B",
    icon: "⏳",
  },
  pending_admin_review: { label: "Under Review", color: "#3B82F6", icon: "🔍" },
  approved: { label: "Approved", color: "#10B981", icon: "✓" },
  rejected: { label: "Rejected", color: "#EF4444", icon: "✗" },
  suspended: { label: "Suspended", color: "#EF4444", icon: "⚠️" },
};

function MenteeCard({ match, onAccept, onDecline, onOpenChat }) {
  const weekNum = match.started_at
    ? Math.ceil(
        (Date.now() - new Date(match.started_at)) / (7 * 24 * 3600 * 1000),
      )
    : 1;
  const isPending = match.status === "pending";

  return (
    <div
      style={{
        ...S.card,
        border: isPending ? "1px solid rgba(245,158,11,0.3)" : S.card.border,
      }}
    >
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
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #7C3AED, #EC4899)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            flexShrink: 0,
          }}
        >
          {match.mentee_name?.[0] || "M"}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>
            {match.mentee_name}
          </div>
          <div
            style={{
              color: "rgba(255,255,255,0.45)",
              fontSize: 12,
              marginTop: 2,
            }}
          >
            {match.sdg_track} Track{!isPending && ` · Week ${weekNum}`}
          </div>
          {match.career_goals?.length > 0 && (
            <div
              style={{
                color: "rgba(255,255,255,0.3)",
                fontSize: 11,
                marginTop: 2,
              }}
            >
              Goals:{" "}
              {match.career_goals
                .slice(0, 2)
                .map((g) => g.replace(/_/g, " "))
                .join(", ")}
            </div>
          )}
        </div>
        <span
          style={S.badge(match.status === "active" ? "#10B981" : "#F59E0B")}
        >
          {isPending ? "⏳ New Request" : match.status}
        </span>
      </div>

      {!isPending && (
        <>
          <div
            style={{
              height: 4,
              background: "rgba(255,255,255,0.08)",
              borderRadius: 2,
              marginBottom: 10,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${Math.min((parseInt(match.sessions_completed) / 12) * 100, 100)}%`,
                background: "linear-gradient(90deg, #7C3AED, #EC4899)",
                borderRadius: 2,
              }}
            />
          </div>
          <div
            style={{
              fontSize: 12,
              color: "rgba(255,255,255,0.35)",
              marginBottom: 14,
            }}
          >
            {match.sessions_completed || 0}/12 sessions ·{" "}
            {match.match_reason || "AI matched"}
          </div>
        </>
      )}

      {isPending ? (
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => onAccept(match.id)}
            style={{
              flex: 1,
              padding: "10px 0",
              borderRadius: 10,
              background: "linear-gradient(135deg, #10B981, #059669)",
              border: "none",
              color: "#fff",
              fontWeight: 700,
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            ✓ Accept
          </button>
          <button
            onClick={() => onDecline(match.id)}
            style={{
              flex: 1,
              padding: "10px 0",
              borderRadius: 10,
              background: "rgba(239,68,68,0.15)",
              border: "1px solid rgba(239,68,68,0.35)",
              color: "#FCA5A5",
              fontWeight: 600,
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            ✗ Decline
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => onOpenChat(match.id)}
            style={{
              flex: 1,
              padding: "8px 0",
              borderRadius: 8,
              background: "rgba(124,58,237,0.15)",
              border: "1px solid rgba(124,58,237,0.3)",
              color: "#A78BFA",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            💬 Message
          </button>
          <button
            onClick={() => toast.info("Session notes feature coming soon!")}
            style={{
              flex: 1,
              padding: "8px 0",
              borderRadius: 8,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "rgba(255,255,255,0.7)",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            📝 Session Notes
          </button>
        </div>
      )}
    </div>
  );
}

export default function MentorDashboard() {
  const qc = useQueryClient();
  const [weeklyBrief, setWeeklyBrief] = useState(null);
  const [loadingBrief, setLoadingBrief] = useState(false);
  const [startingSession, setStartingSession] = useState(null);
  const [docFile, setDocFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const { data: profileData } = useQuery({
    queryKey: ["mentorProfile"],
    queryFn: async () => {
      try {
        const r = await fetch("/api/mentor/profile");
        return r.ok ? r.json() : null;
      } catch (e) {
        return null;
      }
    },
  });

  useEffect(() => {
    if (profileData && profileData.profile && profileData.profile.onboarding_complete === false) {
      window.location.href = "/onboarding/mentor";
    }
  }, [profileData]);

  const { data: statsData } = useQuery({
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

  const { data: matchesData } = useQuery({
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

  const acceptMutation = useMutation({
    mutationFn: async (matchId) => {
      const r = await fetch(`/api/matches/${matchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept" }),
      });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries(["myMatches"]),
    onError: (err) => alert(err.message || "Failed to accept mentee"),
  });

  const declineMutation = useMutation({
    mutationFn: async (matchId) => {
      const r = await fetch(`/api/matches/${matchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "decline" }),
      });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries(["myMatches"]),
    onError: (err) => alert(err.message || "Failed to decline mentee"),
  });

  const handleOpenChat = async (matchId) => {
    setStartingSession(matchId);
    try {
      const sessionsRes = await fetch(`/api/sessions?match_id=${matchId}`);
      if (sessionsRes.ok) {
        const data = await sessionsRes.json();
        const openSession = (data.sessions || []).find((s) => !s.completed);
        if (openSession) {
          window.location.href = `/session/${openSession.id}`;
          return;
        }
      }
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
    setStartingSession(null);
  };

  const handleWeeklyBrief = async () => {
    setLoadingBrief(true);
    try {
      const r = await fetch("/api/ai/weekly-brief");
      if (r.ok) setWeeklyBrief(await r.json());
    } catch {}
    setLoadingBrief(false);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!docFile) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", docFile);
    
    try {
      const res = await fetch("/api/mentor/upload-verification-doc", {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        toast.success("Document uploaded successfully. Our team will review it shortly.");
        qc.invalidateQueries(["mentorProfile"]);
        setDocFile(null);
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to upload document");
      }
    } catch (err) {
      toast.error("Failed to upload document");
    }
    setIsUploading(false);
  };

  const mp = profileData?.profile;
  const stats = statsData?.stats;
  const matches = matchesData?.matches || [];
  const pendingMatches = matches.filter((m) => m.status === "pending");
  const activeMatches = matches.filter((m) => m.status === "active");
  const otherMatches = matches.filter(
    (m) => !["pending", "active"].includes(m.status),
  );
  const vStatus =
    STATUS_INFO[mp?.verification_status] || STATUS_INFO.unverified;
  const isApproved = mp?.is_approved;

  const STAT_CARDS = [
    {
      label: "Active Mentees",
      value: stats?.active_mentees || 0,
      icon: "👩‍🎓",
      color: "#7C3AED",
    },
    {
      label: "Pending Requests",
      value: pendingMatches.length,
      icon: "⏳",
      color: "#F59E0B",
    },
    {
      label: "Sessions Hosted",
      value: stats?.sessions_hosted || 0,
      icon: "📚",
      color: "#EC4899",
    },
    {
      label: "Programmes Complete",
      value: stats?.completed_programmes || 0,
      icon: "🏆",
      color: "#10B981",
    },
  ];

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
          <span
            style={{
              fontSize: 13,
              color: "rgba(255,255,255,0.3)",
              marginLeft: 4,
            }}
          >
            Mentor Portal
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={handleWeeklyBrief}
            disabled={loadingBrief}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              background: "rgba(124,58,237,0.15)",
              border: "1px solid rgba(124,58,237,0.3)",
              color: "#A78BFA",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {loadingBrief ? "⏳" : "🤖 Weekly Brief"}
          </button>
          <NotificationsPanel />
          <a
            href="/mentor/profile"
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              background: "rgba(255,255,255,0.07)",
              color: "rgba(255,255,255,0.8)",
              textDecoration: "none",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            👤 My Profile
          </a>
          <span style={S.badge(vStatus.color)}>
            {vStatus.icon} {vStatus.label}
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
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 6 }}>
            Welcome,{" "}
            {mp?.display_name || mp?.full_name?.split(" ")[0] || "Mentor"} 👋
          </h1>
          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>
            {mp?.job_title} · {mp?.employer}
          </div>
        </div>

        {/* Weekly AI brief panel */}
        {weeklyBrief && (
          <div
            style={{
              background: "rgba(124,58,237,0.08)",
              border: "1px solid rgba(124,58,237,0.25)",
              borderRadius: 16,
              padding: 24,
              marginBottom: 24,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 14,
              }}
            >
              <div>
                <div
                  style={{ fontWeight: 700, fontSize: 16, color: "#A78BFA" }}
                >
                  🤖 AI Weekly Brief
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "rgba(255,255,255,0.4)",
                    marginTop: 2,
                  }}
                >
                  {weeklyBrief.meta?.week}
                </div>
              </div>
              <button
                onClick={() => setWeeklyBrief(null)}
                style={{
                  background: "none",
                  border: "none",
                  color: "rgba(255,255,255,0.4)",
                  cursor: "pointer",
                  fontSize: 18,
                }}
              >
                ×
              </button>
            </div>
            <p
              style={{
                fontSize: 14,
                color: "rgba(255,255,255,0.7)",
                marginBottom: 14,
                lineHeight: 1.7,
              }}
            >
              {weeklyBrief.brief?.greeting}
            </p>
            {weeklyBrief.brief?.weekly_highlights?.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.4)",
                    marginBottom: 8,
                  }}
                >
                  THIS WEEK
                </div>
                {weeklyBrief.brief.weekly_highlights.map((h, i) => (
                  <div
                    key={i}
                    style={{
                      fontSize: 13,
                      color: "rgba(255,255,255,0.65)",
                      padding: "4px 0",
                      borderLeft: "2px solid #7C3AED",
                      paddingLeft: 10,
                      marginBottom: 4,
                    }}
                  >
                    {h}
                  </div>
                ))}
              </div>
            )}
            {weeklyBrief.brief?.suggested_questions?.length > 0 && (
              <div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.4)",
                    marginBottom: 8,
                  }}
                >
                  💡 SUGGESTED QUESTIONS
                </div>
                {weeklyBrief.brief.suggested_questions.map((q, i) => (
                  <div
                    key={i}
                    style={{
                      fontSize: 13,
                      color: "rgba(255,255,255,0.6)",
                      padding: "6px 12px",
                      background: "rgba(255,255,255,0.04)",
                      borderRadius: 8,
                      marginBottom: 6,
                    }}
                  >
                    "{q}"
                  </div>
                ))}
              </div>
            )}
            <p
              style={{
                fontSize: 13,
                color: "#A78BFA",
                marginTop: 14,
                fontStyle: "italic",
              }}
            >
              {weeklyBrief.brief?.motivation}
            </p>
          </div>
        )}

        {/* Pending requests banner */}
        {pendingMatches.length > 0 && (
          <div
            style={{
              background: "rgba(245,158,11,0.08)",
              border: "1px solid rgba(245,158,11,0.3)",
              borderRadius: 16,
              padding: 20,
              marginBottom: 24,
            }}
          >
            <div style={{ fontWeight: 700, color: "#FCD34D", marginBottom: 4 }}>
              ⏳ {pendingMatches.length} pending mentee request
              {pendingMatches.length > 1 ? "s" : ""}
            </div>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>
              Accept or decline below. Mentees are notified within seconds.
            </div>
          </div>
        )}

        {/* Verification banner */}
        {!isApproved && (
          <div
            style={{
              ...S.card,
              marginBottom: 28,
              background:
                mp?.verification_status === "pending_admin_review"
                  ? "rgba(59,130,246,0.08)"
                  : "rgba(245,158,11,0.08)",
              border: `1px solid ${mp?.verification_status === "pending_admin_review" ? "rgba(59,130,246,0.25)" : "rgba(245,158,11,0.25)"}`,
            }}
          >
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <span style={{ fontSize: 32 }}>
                {mp?.verification_status === "pending_admin_review"
                  ? "🔍"
                  : "📋"}
              </span>
              <div>
                <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 16 }}>
                  {mp?.verification_status === "pending_admin_review"
                    ? "Profile Under Review"
                    : "Complete Your Verification"}
                </div>
                <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>
                  {mp?.verification_status === "pending_admin_review"
                    ? "Our safety team is reviewing your application. You'll receive an email within 24–48 hours."
                    : "Submit your ID and employment documents to get approved and start mentoring."}
                </div>
              </div>
            </div>
            
            {mp?.verification_status !== "pending_admin_review" && (
              <form onSubmit={handleUpload} style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Upload Government ID (PDF/JPG/PNG)</label>
                  <input 
                    type="file" 
                    accept=".pdf,image/*"
                    onChange={(e) => setDocFile(e.target.files[0])}
                    style={{
                      width: "100%",
                      padding: "10px",
                      background: "rgba(255,255,255,0.04)",
                      border: "1px dashed rgba(255,255,255,0.2)",
                      borderRadius: 8,
                      color: "#fff",
                      fontSize: 13
                    }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={!docFile || isUploading}
                  style={{
                    padding: "10px 20px",
                    borderRadius: 8,
                    background: (!docFile || isUploading) ? "rgba(255,255,255,0.1)" : "#F59E0B",
                    color: (!docFile || isUploading) ? "rgba(255,255,255,0.4)" : "#000",
                    fontWeight: 700,
                    border: "none",
                    cursor: (!docFile || isUploading) ? "not-allowed" : "pointer",
                    fontSize: 13
                  }}
                >
                  {isUploading ? "Uploading..." : "Submit Document"}
                </button>
              </form>
            )}
          </div>
        )}

        {/* Stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 16,
            marginBottom: 28,
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

        {/* Capacity bar */}
        {mp && (
          <div style={{ ...S.card, marginBottom: 28 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <span style={{ fontWeight: 700 }}>Mentee Capacity</span>
              <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>
                {mp.current_mentees}/{mp.max_mentees} slots used
              </span>
            </div>
            <div
              style={{
                height: 8,
                background: "rgba(255,255,255,0.08)",
                borderRadius: 4,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${(mp.current_mentees / mp.max_mentees) * 100}%`,
                  background:
                    mp.current_mentees >= mp.max_mentees
                      ? "#EF4444"
                      : "linear-gradient(90deg, #7C3AED, #10B981)",
                  borderRadius: 4,
                }}
              />
            </div>
            {mp.current_mentees >= mp.max_mentees && (
              <div style={{ color: "#FCA5A5", fontSize: 13, marginTop: 8 }}>
                ⚠️ At capacity — complete or close a programme to accept new
                mentees
              </div>
            )}
          </div>
        )}

        {/* Pending requests */}
        {pendingMatches.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>
              ⏳ New Requests
            </h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                gap: 20,
              }}
            >
              {pendingMatches.map((m) => (
                <MenteeCard
                  key={m.id}
                  match={m}
                  onAccept={(id) => acceptMutation.mutate(id)}
                  onDecline={(id) => declineMutation.mutate(id)}
                  onOpenChat={handleOpenChat}
                />
              ))}
            </div>
          </div>
        )}

        {/* Active mentees */}
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>
            Your Active Mentees
          </h2>
          {activeMatches.length === 0 ? (
            <div style={{ ...S.card, textAlign: "center", padding: 48 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>👩‍🎓</div>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>
                No active mentees yet
              </div>
              <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 14 }}>
                {isApproved
                  ? "Once mentees send requests and you accept, they'll appear here."
                  : "Get approved first to start receiving mentee requests."}
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
              {activeMatches.map((m) => (
                <MenteeCard
                  key={m.id}
                  match={m}
                  onAccept={(id) => acceptMutation.mutate(id)}
                  onDecline={(id) => declineMutation.mutate(id)}
                  onOpenChat={handleOpenChat}
                />
              ))}
            </div>
          )}
        </div>

        {/* Past mentees */}
        {otherMatches.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>
              Past Mentees
            </h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                gap: 20,
                opacity: 0.8,
              }}
            >
              {otherMatches.map((m) => (
                <MenteeCard
                  key={m.id}
                  match={m}
                  onAccept={() => {}}
                  onDecline={() => {}}
                  onOpenChat={() => {
                    toast.info("This session is completed/archived.");
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Skills */}
        {mp?.skills?.length > 0 && (
          <div style={S.card}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
              🛠️ Your Skills
            </h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {mp.skills.map((s) => (
                <span
                  key={s}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 100,
                    fontSize: 13,
                    background: "rgba(124,58,237,0.15)",
                    border: "1px solid rgba(124,58,237,0.3)",
                    color: "#A78BFA",
                  }}
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
