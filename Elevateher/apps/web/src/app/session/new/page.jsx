"use client";
import { useEffect, useState } from "react";

// /session/new?match_id=xxx
// Creates a new session (or finds an existing open one) then redirects to /session/[id]
export default function NewSessionPage() {
  const [status, setStatus] = useState("Creating your session…");
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const matchId = params.get("match_id");

        if (!matchId) {
          setError("No match ID provided.");
          return;
        }

        // Try to find an existing open session first
        const sessionsRes = await fetch(`/api/sessions?match_id=${matchId}`);
        if (sessionsRes.ok) {
          const sessionsData = await sessionsRes.json();
          const openSession = (sessionsData.sessions || []).find(
            (s) => !s.completed,
          );
          if (openSession) {
            setStatus("Resuming your session…");
            window.location.href = `/session/${openSession.id}`;
            return;
          }
        }

        // Create a new session
        setStatus("Starting a new session…");
        const res = await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ match_id: matchId, channel: "web" }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to create session");
        }

        const { session } = await res.json();
        window.location.href = `/session/${session.id}`;
      } catch (err) {
        console.error(err);
        setError(err.message || "Something went wrong. Please try again.");
      }
    })();
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0F0A1E",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Inter', sans-serif",
        color: "#fff",
      }}
    >
      <div style={{ textAlign: "center" }}>
        {error ? (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
            <div style={{ color: "#FCA5A5", marginBottom: 20 }}>{error}</div>
            <a
              href="/mentee/dashboard"
              style={{
                padding: "10px 24px",
                borderRadius: 10,
                background: "rgba(124,58,237,0.2)",
                border: "1px solid rgba(124,58,237,0.4)",
                color: "#A78BFA",
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              ← Back to Dashboard
            </a>
          </>
        ) : (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>💬</div>
            <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 16 }}>
              {status}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
