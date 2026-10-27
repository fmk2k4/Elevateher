"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import NotificationsPanel from "@/components/NotificationsPanel";

// ─── Demo quick-fire messages ─────────────────────────────────────────────────
const DEMO_MESSAGES = {
  safe: "Hi! I wanted to ask about Python career paths — which companies in Malaysia are best for data science graduates?",
  grooming1: "Add me on WhatsApp and do not tell anyone, this will be only between us.",
  grooming2: "Our little secret — can we meet at my place this weekend? Just you and me, no one will know.",
  intimacy: "You are so different from my other students. I told no one else about this. Trust me on this.",
};

// ─── Risk meter colours ───────────────────────────────────────────────────────
function riskColor(score) {
  if (score >= 0.8) return "#EF4444";
  if (score >= 0.5) return "#F59E0B";
  if (score >= 0.3) return "#FBBF24";
  return "#10B981";
}
function riskLabel(score) {
  if (score >= 0.8) return "CRITICAL";
  if (score >= 0.5) return "HIGH";
  if (score >= 0.3) return "MEDIUM";
  return "SAFE";
}

const S = {
  page: {
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    background: "#0F0A1E",
    color: "#fff",
    fontFamily: "'Inter', sans-serif",
  },
  nav: {
    background: "rgba(255,255,255,0.03)",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    padding: "0 20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    height: 56,
    flexShrink: 0,
  },
  messages: {
    flex: 1,
    overflowY: "auto",
    padding: "20px 20px 0",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  inputArea: {
    padding: 16,
    borderTop: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.02)",
    flexShrink: 0,
  },
};

const SEVERITY_MAP = {
  off_platform_solicitation: "critical",
  inappropriate_content: "critical",
  grooming_behavior: "critical",
  personal_info_request: "high",
  harassment: "high",
  other: "medium",
};

// ─── Trust Badge chip ─────────────────────────────────────────────────────────
function TrustBadge({ mentorId }) {
  const [badge, setBadge] = useState(null);
  useEffect(() => {
    if (!mentorId) return;
    fetch(`/api/safety/trust/${mentorId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d && setBadge(d.trust))
      .catch(() => {});
  }, [mentorId]);
  if (!badge) return null;
  const isDegraded = badge._source === "degraded" || badge.verification_status === "unknown";
  const color = isDegraded ? "#F59E0B" : badge.trust_tier === "trusted" ? "#10B981" : badge.trust_tier === "verified" ? "#A78BFA" : "#F59E0B";
  const emoji = isDegraded ? "⚠" : badge.trust_tier === "trusted" ? "✓" : badge.trust_tier === "verified" ? "🔍" : "⏳";
  const titleText = isDegraded ? "UNVERIFIED" : badge.trust_tier?.toUpperCase();
  const tooltip = isDegraded ? "Safety check unavailable" : `Trust tier: ${badge.trust_tier} | Score: ${(badge.trust_score * 100).toFixed(0)}%`;

  return (
    <span
      title={tooltip}
      style={{
        fontSize: 10,
        fontWeight: 700,
        padding: "2px 7px",
        borderRadius: 100,
        background: `${color}22`,
        border: `1px solid ${color}55`,
        color,
        letterSpacing: "0.03em",
      }}
    >
      {emoji} {titleText}
    </span>
  );
}

// ─── Risk Meter ───────────────────────────────────────────────────────────────
function RiskMeter({ matchId }) {
  const [risk, setRisk] = useState(null);
  const [prev, setPrev] = useState(0);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (!matchId) return;
    const poll = async () => {
      try {
        const r = await fetch(`/api/safety/escalation-state?match_id=${matchId}`);
        if (!r.ok) return;
        const d = await r.json();
        const esc = d.escalation;
        if (esc) {
          setPrev((old) => old);
          setRisk((old) => {
            if (old && esc.risk_score > old.risk_score) {
              setFlash(true);
              setTimeout(() => setFlash(false), 1200);
            }
            return esc;
          });
        }
      } catch {}
    };
    poll();
    const id = setInterval(poll, 4000);
    return () => clearInterval(id);
  }, [matchId]);

  if (!matchId) return null;
  
  if (risk?._degraded || risk?.state === "service_degraded") {
    return (
      <div
        style={{
          padding: "10px 14px",
          borderRadius: 12,
          background: "rgba(245, 158, 11, 0.1)",
          border: "1px solid rgba(245, 158, 11, 0.3)",
          color: "#F59E0B",
          minWidth: 160,
          fontSize: 12,
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          gap: 6
        }}
      >
        <span>⚠</span>
        <span>Safety check unavailable</span>
      </div>
    );
  }

  const score = risk?.risk_score ?? 0;
  const color = riskColor(score);
  const label = riskLabel(score);
  const pct = Math.round(score * 100);

  return (
    <div
      style={{
        padding: "10px 14px",
        borderRadius: 12,
        background: flash ? `${color}28` : "rgba(255,255,255,0.04)",
        border: `1px solid ${flash ? color : "rgba(255,255,255,0.1)"}`,
        transition: "all 0.4s",
        minWidth: 160,
      }}
    >
      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", fontWeight: 600, letterSpacing: "0.06em", marginBottom: 5 }}>🛡️ GROOMING RISK</div>
      {/* Bar */}
      <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,0.08)", marginBottom: 5, overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: color,
            borderRadius: 3,
            transition: "width 0.5s, background 0.4s",
          }}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 800, fontSize: 12, color }}>{label}</span>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{pct}%</span>
      </div>
      {risk?.off_platform_count > 0 && (
        <div style={{ fontSize: 10, color: "#EF4444", marginTop: 3 }}>
          ⚠ {risk.off_platform_count}× off-platform attempt{risk.off_platform_count > 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}

function MsgBubble({ msg, isOwn }) {
  const time = new Date(msg.sent_at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const isEla = msg.sender_role === "tutor";

  return (
    <div
      style={{
        display: "flex",
        justifyContent: isOwn ? "flex-end" : "flex-start",
        gap: 10,
        alignItems: "flex-end",
      }}
    >
      {/* Ela avatar */}
      {isEla && (
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #F59E0B, #7C3AED)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 17,
            flexShrink: 0,
            boxShadow: "0 0 14px rgba(245,158,11,0.4)",
          }}
        >
          🤖
        </div>
      )}

      <div style={{ maxWidth: "75%" }}>
        {/* "ELA · AI COACH" label */}
        {isEla && (
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "#F59E0B",
              letterSpacing: "0.07em",
              marginBottom: 4,
            }}
          >
            ELA · AI COACH
          </div>
        )}
        <div
          style={{
            padding: "10px 14px",
            borderRadius: isOwn
              ? "18px 18px 4px 18px"
              : isEla
              ? "4px 18px 18px 18px"
              : "18px 18px 18px 4px",
            background: isOwn
              ? "linear-gradient(135deg, #7C3AED, #EC4899)"
              : isEla
              ? "linear-gradient(135deg, rgba(245,158,11,0.15), rgba(124,58,237,0.2))"
              : "rgba(255,255,255,0.08)",
            border: isEla ? "1px solid rgba(245,158,11,0.3)" : "none",
            color: "#fff",
            boxShadow: isEla ? "0 0 24px rgba(245,158,11,0.1)" : "none",
          }}
        >
          {msg.reasoning && (
            <details
              style={{
                marginBottom: 10,
                background: "rgba(0,0,0,0.15)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8,
                overflow: "hidden",
              }}
            >
              <summary
                style={{
                  padding: "8px 12px",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.6)",
                  cursor: "pointer",
                  listStyle: "none",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  userSelect: "none",
                }}
              >
                🧠 Ela's Thought Process
              </summary>
              <div
                style={{
                  padding: "0 12px 12px 12px",
                  fontSize: 13,
                  color: "rgba(255,255,255,0.5)",
                  fontStyle: "italic",
                  lineHeight: 1.5,
                  whiteSpace: "pre-wrap",
                }}
              >
                {msg.reasoning}
              </div>
            </details>
          )}
          <div style={{ fontSize: 14, lineHeight: 1.6, wordBreak: "break-word" }}>
            {msg.content}
          </div>
          <div
            style={{
              fontSize: 11,
              color: isOwn ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.35)",
              marginTop: 4,
              display: "flex",
              alignItems: "center",
              gap: 4,
              justifyContent: isOwn ? "flex-end" : "flex-start",
            }}
          >
            {time}
            {msg.is_flagged && <span title="Flagged for review">⚠️</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SessionPage({ params }) {
  const sessionId = params.id;
  const [draft, setDraft] = useState("");
  const [userRole, setUserRole] = useState(null);
  const [sessionInfo, setSessionInfo] = useState(null);
  const [otherPartyName, setOtherPartyName] = useState("Your partner");
  const [mentorId, setMentorId] = useState(null);
  const [matchId, setMatchId] = useState(null);
  const [safetyWarning, setSafetyWarning] = useState("");
  const [blockedRiskDelta, setBlockedRiskDelta] = useState(null); // { before, after, flags }
  const [aiSummary, setAiSummary] = useState(null);
  const [summarising, setSummarising] = useState(false);
  const [reportingOpen, setReportingOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [demoOpen, setDemoOpen] = useState(false);
  const bottomRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const qc = useQueryClient();

  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

  const { data: messagesData, isLoading } = useQuery({
    queryKey: ["messages", sessionId],
    queryFn: async () => {
      const r = await fetch(`/api/sessions/${sessionId}/messages`);
      if (!r.ok) throw new Error("Failed to load");
      return r.json();
    },
  });

  useEffect(() => {
    let es;
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : "";
      const streamUrl = `/api/sessions/${sessionId}/stream${token ? `?token=${encodeURIComponent(token)}` : ""}`;
      es = new EventSource(streamUrl);
      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "new_message") {
            qc.setQueryData(["messages", sessionId], (old) => {
              if (!old) return old;
              // Check if message already exists
              if (old.messages?.some(m => m.id === data.message.id)) {
                return old;
              }
              return {
                ...old,
                messages: [...old.messages, data.message]
              };
            });
            // Update risk meter query if needed since a new message arrived
            qc.invalidateQueries(["trustScore", matchId]);
            
            // Tab visibility alert
            if (document.visibilityState === "hidden") {
              document.title = "(1) New Message - ElevateHer";
            }
          }
        } catch (err) {
          console.error("Failed to parse session stream message", err);
        }
      };
      es.onerror = (e) => {
        console.warn("SSE stream error", e);
      };
    } catch (e) {
      console.error("Failed to setup SSE", e);
    }
    return () => {
      if (es) es.close();
    };
  }, [sessionId, matchId, qc]);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/users/profile");
      if (r.ok) {
        const { user } = await r.json();
        setUserRole(user?.role);
      }
    })();
    // Get session info from sessions API
    (async () => {
      try {
        const r = await fetch(`/api/sessions/${sessionId}`);
        if (r.ok) {
          const data = await r.json();
          setSessionInfo(data.session);
          if (data.other_party_name) setOtherPartyName(data.other_party_name);
          if (data.session?.mentor_id) setMentorId(data.session.mentor_id);
          if (data.session?.match_id) setMatchId(data.session.match_id);
        }
      } catch (err) {
        console.error("Failed to fetch session info", err);
      }
    })();
  }, [sessionId]);

  // Reset document title on tab focus
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        document.title = "ElevateHer — Safe AI Career Mentorship";
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const isNearBottom =
      container.scrollTop + container.clientHeight >= container.scrollHeight - 150;
    if (isNearBottom) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messagesData?.messages]);

  const sendMutation = useMutation({
    mutationFn: async (content) => {
      const r = await fetch(`/api/sessions/${sessionId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await r.json();
      if (!r.ok) throw { status: r.status, ...data };
      return data;
    },
    onSuccess: () => {
      setSafetyWarning("");
      setBlockedRiskDelta(null);
      qc.invalidateQueries(["messages", sessionId]);
    },
    onError: (err) => {
      if (err.status && err.status >= 400) {
        setSafetyWarning(
          err.message || "Message blocked: safety policy violation detected."
        );
        // Show risk delta if the API returned it
        if (err.risk_before !== undefined || err.risk_after !== undefined) {
          setBlockedRiskDelta({
            before: err.risk_before ?? 0,
            after: err.risk_after ?? 0,
            flags: err.flags || [],
          });
        } else {
          setBlockedRiskDelta({ before: 0, after: 0, flags: ["off_platform_solicitation"] });
        }
        setDraft(err.content || draft);
      }
    },
  });

  const askElaMutation = useMutation({
    mutationFn: async (messageText) => {
      const res = await fetch(`/api/sessions/${sessionId}/chat-ai`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: messageText }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || "Failed to ask Ela");
      }
      // Response is SSE (text/event-stream) — the tutor message arrives
      // via the Redis SSE stream / EventSource, not as JSON here.
      return { success: true };
    },
    onSuccess: (data) => {
      setSafetyWarning("");
      setBlockedRiskDelta(null);
      if (data.error) {
        setSafetyWarning(data.error);
      } else {
        qc.invalidateQueries(["messages", sessionId]);
      }
    },
    onError: (err) => {
      setSafetyWarning(err.message || "Something went wrong asking Ela.");
    },
  });

  const handleSend = useCallback(() => {
    if (!draft.trim() || sendMutation.isPending) return;
    const content = draft.trim();
    setDraft("");
    sendMutation.mutate(content);
  }, [draft, sendMutation]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleAskEla = useCallback(() => {
    if (!draft.trim() || askElaMutation.isPending) return;
    const content = draft.trim();
    setDraft("");
    askElaMutation.mutate(content);
  }, [draft, askElaMutation]);

  const handleSummarise = async () => {
    setSummarising(true);
    try {
      const r = await fetch(`/api/sessions/${sessionId}/summarise`, {
        method: "POST",
      });
      if (r.ok) setAiSummary(await r.json());
    } catch {}
    setSummarising(false);
  };

  const handleReport = async () => {
    if (!reportReason.trim()) return;
    try {
      const r = await fetch("/api/safety/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          reason: reportReason,
          severity: SEVERITY_MAP[reportReason] || "medium",
        }),
      });
      if (r.ok) {
        setReportingOpen(false);
        setReportReason("");
        const data = await r.json().catch(() => ({}));
        const caseId = data.case_id || `CAS-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        toast.success(`Report submitted successfully. Case ID: ${caseId}`, {
          description: "Our safety team will review within 24 hours.",
        });
      } else {
        toast.error("Failed to submit report. Please try again.");
      }
    } catch {
      toast.error("Failed to submit report. Network error. Please try again.");
    }
  };

  const messages = messagesData?.messages || [];

  return (
    <div style={S.page}>
      {/* Nav */}
      <nav style={S.nav}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <a
            href="/dashboard"
            style={{
              color: "rgba(255,255,255,0.5)",
              textDecoration: "none",
              fontSize: 20,
            }}
          >
            ←
          </a>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #7C3AED, #EC4899)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            {otherPartyName[0]}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
              {otherPartyName}
              <TrustBadge mentorId={mentorId} />
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
              {sessionInfo ? `Session ${sessionInfo.session_num}: ${sessionInfo.milestone_title}` : "Session"} · All messages are moderated by SEA-Guard
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <RiskMeter matchId={matchId} />
          <button
            onClick={handleSummarise}
            disabled={summarising || messages.length === 0}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              background: "rgba(124,58,237,0.2)",
              border: "1px solid rgba(124,58,237,0.4)",
              color: "#A78BFA",
              cursor: "pointer",
            }}
          >
            {summarising ? "⏳" : "🤖 AI Summary"}
          </button>
          <NotificationsPanel />
          <button
            onClick={() => setReportingOpen(true)}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              background: "rgba(239,68,68,0.15)",
              border: "1px solid rgba(239,68,68,0.3)",
              color: "#FCA5A5",
              cursor: "pointer",
            }}
          >
            🚨 Report
          </button>
        </div>
      </nav>

      {/* Blocked message alert */}
      {safetyWarning && (
        <div
          id="safety-blocked-banner"
          style={{
            padding: "14px 20px",
            background: "rgba(239,68,68,0.18)",
            borderBottom: "1px solid rgba(239,68,68,0.4)",
            fontSize: 13,
            color: "#FCA5A5",
            animation: "slideDown 0.3s ease",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 14 }}>
            🛡️ Message Blocked — Grooming Pattern Detected
          </div>
          <div style={{ opacity: 0.85 }}>{safetyWarning}</div>
          {blockedRiskDelta && (
            <div style={{ marginTop: 8, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: 12 }}>
                Risk score updated:{" "}
                <strong style={{ color: riskColor(blockedRiskDelta.before) }}>{Math.round(blockedRiskDelta.before * 100)}%</strong>
                {" → "}
                <strong style={{ color: riskColor(blockedRiskDelta.after) }}>{Math.round(blockedRiskDelta.after * 100)}%</strong>
                {" "}
                <span style={{
                  background: `${riskColor(blockedRiskDelta.after)}30`,
                  color: riskColor(blockedRiskDelta.after),
                  fontWeight: 800,
                  padding: "1px 7px",
                  borderRadius: 4,
                  fontSize: 11,
                }}>{riskLabel(blockedRiskDelta.after)}</span>
              </span>
              {blockedRiskDelta.flags.map((f) => (
                <span key={f} style={{ background: "rgba(239,68,68,0.15)", color: "#FCA5A5", fontSize: 10, padding: "2px 6px", borderRadius: 3 }}>{f}</span>
              ))}
            </div>
          )}
          <button
            onClick={() => { setSafetyWarning(""); setBlockedRiskDelta(null); }}
            style={{ background: "none", border: "none", color: "rgba(252,165,165,0.6)", cursor: "pointer", fontSize: 11, marginTop: 6 }}
          >Dismiss</button>
        </div>
      )}

      {/* AI Summary panel */}
      {aiSummary && (
        <div
          style={{
            padding: 16,
            background: "rgba(124,58,237,0.08)",
            borderBottom: "1px solid rgba(124,58,237,0.2)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: "#A78BFA" }}>
              🤖 AI Session Summary
            </span>
            <button
              onClick={() => setAiSummary(null)}
              style={{
                background: "none",
                border: "none",
                color: "rgba(255,255,255,0.4)",
                cursor: "pointer",
                fontSize: 16,
              }}
            >
              ×
            </button>
          </div>
          <p
            style={{
              fontSize: 13,
              color: "rgba(255,255,255,0.7)",
              lineHeight: 1.6,
              marginBottom: 12,
            }}
          >
            {aiSummary.summary}
          </p>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "rgba(255,255,255,0.5)",
              marginBottom: 6,
            }}
          >
            Suggested next questions:
          </div>
          {(aiSummary.questions || []).map((q, i) => (
            <div
              key={i}
              style={{
                fontSize: 12,
                color: "rgba(255,255,255,0.6)",
                padding: "4px 0",
                borderLeft: "2px solid #7C3AED",
                paddingLeft: 8,
                marginBottom: 4,
              }}
            >
              {q}
            </div>
          ))}
          {aiSummary.mentee_sentiment && (
            <div
              style={{
                marginTop: 8,
                fontSize: 12,
                color:
                  aiSummary.mentee_sentiment === "needs_support"
                    ? "#FCA5A5"
                    : "#6EE7B7",
              }}
            >
              Mentee sentiment: {aiSummary.mentee_sentiment}
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        style={S.messages}
        role="log"
        aria-live="polite"
        aria-atomic="false"
      >
        {isLoading && (
          <div
            style={{
              textAlign: "center",
              padding: 32,
              color: "rgba(255,255,255,0.3)",
            }}
          >
            Loading messages…
          </div>
        )}
        {!isLoading && messages.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: 48,
              color: "rgba(255,255,255,0.35)",
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 12 }}>👋</div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>
              Start your session!
            </div>
            <div style={{ fontSize: 13 }}>
              All messages are scanned for safety. Keep conversations
              career-focused.
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <MsgBubble
            key={msg.id}
            msg={msg}
            isOwn={msg.sender_role === userRole}
          />
        ))}
        <div ref={bottomRef} style={{ paddingBottom: 8 }} />
      </div>

      {/* Demo Quick-Fire Panel */}
      {isDemoMode && (
        <div
          style={{
            borderTop: "1px solid rgba(124,58,237,0.25)",
            background: "rgba(124,58,237,0.06)",
            padding: "10px 16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#A78BFA", letterSpacing: "0.06em" }}>🎭 DEMO MODE</span>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>Click to auto-fill a message scenario</span>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[
              { label: "✅ Safe message", key: "safe", color: "#10B981" },
              { label: "⚠️ Off-platform (WhatsApp)", key: "grooming1", color: "#EF4444" },
              { label: "🚨 Secret/Isolation language", key: "grooming2", color: "#EF4444" },
              { label: "🔴 Intimacy escalation", key: "intimacy", color: "#F59E0B" },
            ].map((btn) => (
              <button
                key={btn.key}
                onClick={() => setDraft(DEMO_MESSAGES[btn.key])}
                style={{
                  padding: "5px 12px",
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 600,
                  background: `${btn.color}15`,
                  border: `1px solid ${btn.color}40`,
                  color: btn.color,
                  cursor: "pointer",
                }}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      )}
      
      {askElaMutation.isPending && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, alignSelf: "flex-start", opacity: 0.7, marginBottom: 10 }}>
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #F59E0B, #7C3AED)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
            }}
          >
            🤖
          </div>
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", fontStyle: "italic" }}>
            Ela is thinking...
          </span>
        </div>
      )}

      {/* Input */}
      <div style={S.inputArea}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message… (Enter to send)"
            rows={1}
            style={{
              flex: 1,
              padding: "10px 14px",
              borderRadius: 12,
              fontSize: 14,
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "#fff",
              outline: "none",
              resize: "none",
              maxHeight: 120,
              fontFamily: "'Inter', sans-serif",
            }}
          />
          <button
            onClick={handleSend}
            disabled={!draft.trim() || sendMutation.isPending}
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              flexShrink: 0,
              background: "linear-gradient(135deg, #7C3AED, #EC4899)",
              border: "none",
              cursor: "pointer",
              opacity: !draft.trim() || sendMutation.isPending ? 0.5 : 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              viewBox="0 0 24 24"
              style={{ width: 18, height: 18, fill: "#fff" }}
            >
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
          
          <button
            onClick={handleAskEla}
            disabled={!draft.trim() || askElaMutation.isPending}
            style={{
              padding: "0 16px",
              height: 44,
              borderRadius: 12,
              flexShrink: 0,
              background: "rgba(124,58,237,0.15)",
              border: "1px solid rgba(124,58,237,0.3)",
              color: "#A78BFA",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
              opacity: !draft.trim() || askElaMutation.isPending ? 0.5 : 1,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {askElaMutation.isPending ? "⏳" : "🤖 Ask Ela"}
          </button>
        </div>
        <div
          style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.25)",
            marginTop: 6,
            textAlign: "center",
          }}
        >
          🛡️ All messages are moderated by SEA-Guard for child safety
        </div>
      </div>

      {/* Report modal */}
      {reportingOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-modal-title"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: 24,
          }}
        >
          <div
            style={{
              background: "#1A0F2E",
              borderRadius: 20,
              padding: 32,
              maxWidth: 480,
              width: "100%",
              border: "1px solid rgba(239,68,68,0.3)",
            }}
          >
            <h3 id="report-modal-title" style={{ fontWeight: 800, marginBottom: 8 }}>
              🚨 Report Safety Concern
            </h3>
            <p
              style={{
                color: "rgba(255,255,255,0.55)",
                fontSize: 14,
                marginBottom: 20,
              }}
            >
              Our safety team will review this within 24 hours. For emergencies,
              contact local authorities.
            </p>
            <select
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: 10,
                fontSize: 14,
                background: "#0F0A1E",
                border: "1px solid rgba(255,255,255,0.15)",
                color: "#fff",
                marginBottom: 16,
                outline: "none",
                boxSizing: "border-box",
              }}
            >
              <option value="">Select reason…</option>
              <option value="off_platform_solicitation">
                Attempting to move conversation off-platform
              </option>
              <option value="inappropriate_content">
                Inappropriate or sexual content
              </option>
              <option value="personal_info_request">
                Requesting personal information
              </option>
              <option value="harassment">Harassment or bullying</option>
              <option value="grooming_behavior">
                Suspected grooming behavior
              </option>
              <option value="other">Other safety concern</option>
            </select>
            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={() => setReportingOpen(false)}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: 10,
                  background: "rgba(255,255,255,0.08)",
                  border: "none",
                  color: "#fff",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleReport}
                disabled={!reportReason}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: 10,
                  background: "#EF4444",
                  border: "none",
                  color: "#fff",
                  cursor: "pointer",
                  fontWeight: 700,
                  opacity: reportReason ? 1 : 0.5,
                }}
              >
                Submit Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* Inject keyframe animations */
if (typeof document !== "undefined") {
  const style = document.createElement("style");
  style.textContent = `
    @keyframes slideDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: none; } }
  `;
  document.head.appendChild(style);
}
