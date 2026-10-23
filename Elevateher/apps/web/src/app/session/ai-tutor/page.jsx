"use client";
import { useState, useRef, useCallback, useEffect } from "react";

// ─── Ela AI Tutor Standalone Session Page ─────────────────────────────────────
// Route: /session/ai-tutor
// A self-contained chat with Ela, the AI career coach.
// No human mentor required — mentees can start at any time.

const STARTER_PROMPTS = [
  "🎯 I want to plan my career path in tech",
  "📝 Help me prepare for a job interview",
  "💡 I'm stuck on a project — can you guide me?",
  "🌏 I want to explore opportunities in Southeast Asia",
  "📚 What skills should I learn for my SDG track?",
  "🤔 I feel overwhelmed about my future",
];

function ElaAvatar({ size = 40, pulse = false }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "linear-gradient(135deg, #F59E0B, #7C3AED)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.45,
        flexShrink: 0,
        boxShadow: pulse
          ? "0 0 0 6px rgba(245,158,11,0.15), 0 0 20px rgba(245,158,11,0.4)"
          : "0 0 16px rgba(245,158,11,0.3)",
        animation: pulse ? "ela-pulse 1.8s ease-in-out infinite" : "none",
      }}
    >
      🤖
    </div>
  );
}

function MsgBubble({ msg }) {
  const isEla = msg.role === "ela";
  const time = msg.time || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div
      style={{
        display: "flex",
        justifyContent: isEla ? "flex-start" : "flex-end",
        alignItems: "flex-end",
        gap: 10,
      }}
    >
      {isEla && <ElaAvatar size={34} />}
      <div style={{ maxWidth: "76%" }}>
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
            padding: "12px 16px",
            borderRadius: isEla ? "4px 18px 18px 18px" : "18px 18px 4px 18px",
            background: isEla
              ? "linear-gradient(135deg, rgba(245,158,11,0.14), rgba(124,58,237,0.18))"
              : "linear-gradient(135deg, #7C3AED, #EC4899)",
            border: isEla ? "1px solid rgba(245,158,11,0.28)" : "none",
            color: "#fff",
            boxShadow: isEla ? "0 0 28px rgba(245,158,11,0.1)" : "none",
            fontSize: 14,
            lineHeight: 1.65,
          }}
        >
          {msg.reasoning && (
            <details
              style={{
                marginBottom: 12,
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
          {msg.content}
        </div>
        <div
          style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.3)",
            marginTop: 4,
            textAlign: isEla ? "left" : "right",
          }}
        >
          {time}
        </div>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
      <ElaAvatar size={34} pulse />
      <div
        style={{
          padding: "14px 18px",
          borderRadius: "4px 18px 18px 18px",
          background: "linear-gradient(135deg, rgba(245,158,11,0.14), rgba(124,58,237,0.18))",
          border: "1px solid rgba(245,158,11,0.28)",
          display: "flex",
          gap: 5,
          alignItems: "center",
        }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "#F59E0B",
              animation: `bounce 1.4s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default function AiTutorSessionPage() {
  const [messages, setMessages] = useState([
    {
      id: "ela-intro",
      role: "ela",
      content:
        "Hi! I'm Ela 👋 your AI career coach. I'm here to help you explore your path, prepare for challenges, and think through decisions — using questions that help you find your own answers.\n\nWhat's on your mind today?",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [error, setError] = useState(null);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Resolve session ID from URL or create an AI-mode session
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sid = params.get("session_id");
    if (sid) {
      setSessionId(sid);
    }
    // If no session_id, we operate in stateless mode — messages live only in memory
    // (no match required for the AI tutor standalone mode)
  }, []);

  const sendMessage = useCallback(async () => {
    const text = draft.trim();
    if (!text || loading) return;

    const userMsg = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages((prev) => [...prev, userMsg]);
    setDraft("");
    setLoading(true);
    setError(null);

    try {
      let elaContent = null;
      let elaReasoning = null;

      if (sessionId) {
        // Live API mode: session exists, call the chat-ai endpoint
        const res = await fetch(`/api/sessions/${sessionId}/chat-ai`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text }),
        });
        const data = await res.json();
        if (data.tutor_response?.message) {
          elaContent = data.tutor_response.message;
          elaReasoning = data.tutor_response.reasoning;
        } else if (data.error) {
          setError(data.error);
        }
      } else {
        // Stateless mode: call through a simple proxy route to the AI
        const res = await fetch("/api/ai/ela-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            history: messages.map((m) => ({
              role: m.role === "ela" ? "assistant" : "user",
              content: m.content,
            })),
          }),
        });
        if (res.ok) {
          const data = await res.json();
          elaContent = data.reply;
          elaReasoning = data.reasoning;
        }
      }

      if (elaContent) {
        setMessages((prev) => [
          ...prev,
          {
            id: `ela-${Date.now()}`,
            role: "ela",
            content: elaContent,
            reasoning: elaReasoning,
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
      }
    } catch (e) {
      setError("Ela is temporarily unavailable. Please try again in a moment.");
    } finally {
      setLoading(false);
      textareaRef.current?.focus();
    }
  }, [draft, loading, sessionId, messages]);

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const useStarterPrompt = (prompt) => {
    setDraft(prompt.replace(/^[^\w]*/, ""));
    textareaRef.current?.focus();
  };

  return (
    <>
      <style>{`
        @keyframes ela-pulse {
          0%, 100% { box-shadow: 0 0 0 4px rgba(245,158,11,0.12), 0 0 16px rgba(245,158,11,0.3); }
          50% { box-shadow: 0 0 0 8px rgba(245,158,11,0.06), 0 0 28px rgba(245,158,11,0.5); }
        }
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
        details > summary::-webkit-details-marker { display: none; }
        textarea::placeholder { color: rgba(255,255,255,0.3); }
        textarea:focus { border-color: rgba(245,158,11,0.5) !important; outline: none; }
        .starter-btn:hover {
          background: rgba(245,158,11,0.15) !important;
          border-color: rgba(245,158,11,0.4) !important;
          color: #F59E0B !important;
          transform: translateY(-1px);
        }
        .send-btn:hover:not(:disabled) {
          filter: brightness(1.15);
          transform: scale(1.04);
        }
        .send-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>

      <div
        style={{
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          background: "#0C0817",
          fontFamily: "'Inter', sans-serif",
          color: "#fff",
        }}
      >
        {/* ── Nav ─────────────────────────────────────────────── */}
        <nav
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 20px",
            height: 60,
            borderBottom: "1px solid rgba(245,158,11,0.15)",
            background: "rgba(245,158,11,0.03)",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <a
              href="/mentee/dashboard"
              style={{
                color: "rgba(255,255,255,0.4)",
                textDecoration: "none",
                fontSize: 20,
                lineHeight: 1,
              }}
            >
              ←
            </a>
            <ElaAvatar size={36} />
            <div>
              <div style={{ fontWeight: 800, fontSize: 15 }}>
                Ela{" "}
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#F59E0B",
                    background: "rgba(245,158,11,0.12)",
                    border: "1px solid rgba(245,158,11,0.3)",
                    borderRadius: 100,
                    padding: "1px 7px",
                    marginLeft: 4,
                  }}
                >
                  AI COACH
                </span>
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
                Socratic career mentor · Powered by DeepSeek
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {sessionId && (
              <a
                href={`/session/${sessionId}`}
                style={{
                  padding: "6px 14px",
                  borderRadius: 8,
                  background: "rgba(124,58,237,0.15)",
                  border: "1px solid rgba(124,58,237,0.3)",
                  color: "#A78BFA",
                  textDecoration: "none",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                📋 Full Session View
              </a>
            )}
            <a
              href="/mentee/candidates"
              style={{
                padding: "6px 14px",
                borderRadius: 8,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.6)",
                textDecoration: "none",
                fontSize: 12,
              }}
            >
              👤 Find Human Mentor
            </a>
          </div>
        </nav>

        {/* ── Messages ─────────────────────────────────────────── */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "24px 20px 8px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {/* Starter prompts — show only when only the intro message is present */}
          {messages.length === 1 && (
            <div>
              <div
                style={{
                  fontSize: 12,
                  color: "rgba(255,255,255,0.35)",
                  marginBottom: 12,
                  textAlign: "center",
                }}
              >
                Or choose a topic to start:
              </div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  justifyContent: "center",
                }}
              >
                {STARTER_PROMPTS.map((p) => (
                  <button
                    key={p}
                    className="starter-btn"
                    onClick={() => useStarterPrompt(p)}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 20,
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "rgba(255,255,255,0.65)",
                      fontSize: 12,
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <MsgBubble key={msg.id} msg={msg} />
          ))}

          {loading && <TypingIndicator />}

          {error && (
            <div
              style={{
                textAlign: "center",
                padding: "10px 16px",
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.25)",
                borderRadius: 10,
                color: "#FCA5A5",
                fontSize: 13,
              }}
            >
              ⚠️ {error}
            </div>
          )}

          <div ref={bottomRef} style={{ paddingBottom: 8 }} />
        </div>

        {/* ── Input Area ───────────────────────────────────────── */}
        <div
          style={{
            padding: "14px 20px 18px",
            borderTop: "1px solid rgba(245,158,11,0.12)",
            background: "rgba(245,158,11,0.02)",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask Ela anything about your career journey… (Enter to send)"
              rows={2}
              style={{
                flex: 1,
                padding: "12px 16px",
                borderRadius: 14,
                fontSize: 14,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(245,158,11,0.2)",
                color: "#fff",
                resize: "none",
                maxHeight: 120,
                fontFamily: "'Inter', sans-serif",
                lineHeight: 1.5,
                transition: "border-color 0.2s",
              }}
            />
            <button
              className="send-btn"
              onClick={sendMessage}
              disabled={!draft.trim() || loading}
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                flexShrink: 0,
                background: "linear-gradient(135deg, #F59E0B, #7C3AED)",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.18s",
                boxShadow: "0 0 18px rgba(245,158,11,0.3)",
              }}
            >
              <svg viewBox="0 0 24 24" style={{ width: 20, height: 20, fill: "#fff" }}>
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </div>
          <div
            style={{
              fontSize: 11,
              color: "rgba(255,255,255,0.22)",
              marginTop: 8,
              textAlign: "center",
            }}
          >
            🛡️ All messages are scanned by SEA-Guard · Ela uses Socratic coaching — she'll guide, not give answers
          </div>
        </div>
      </div>
    </>
  );
}
