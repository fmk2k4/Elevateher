"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const EVENT_TYPES = [
  { id: "course_enrolled", label: "📚 Course Enrolled", sdg: "4.4" },
  { id: "course_completed", label: "🎓 Course Completed", sdg: "4.4" },
  { id: "certification_gained", label: "🏅 Certification Gained", sdg: "4.4" },
  { id: "skill_gained", label: "💡 New Skill Gained", sdg: "4.4" },
  { id: "milestone_reached", label: "⭐ Milestone Reached", sdg: "4.4" },
  { id: "internship_started", label: "💼 Internship Started", sdg: "8.6" },
  { id: "job_offer", label: "🎉 Job Offer Received", sdg: "8.6" },
  { id: "career_entry", label: "🚀 Career Entry", sdg: "8.6" },
  {
    id: "first_salary_negotiation",
    label: "💰 First Salary Negotiation",
    sdg: "8.6",
  },
  {
    id: "network_connection",
    label: "🤝 Professional Network Added",
    sdg: "17.16",
  },
  { id: "programme_completed", label: "🏆 Programme Completed", sdg: "5.5" },
];

const SDG_COLORS = {
  4.4: {
    bg: "rgba(196,30,58,0.15)",
    border: "rgba(196,30,58,0.35)",
    text: "#F87171",
    label: "SDG 4.4 — Quality Education",
  },
  5.5: {
    bg: "rgba(229,36,59,0.15)",
    border: "rgba(229,36,59,0.35)",
    text: "#FCA5A5",
    label: "SDG 5.5 — Gender Equality",
  },
  8.6: {
    bg: "rgba(162,25,66,0.15)",
    border: "rgba(162,25,66,0.35)",
    text: "#FBBF24",
    label: "SDG 8.6 — Decent Work",
  },
  17.16: {
    bg: "rgba(124,58,237,0.15)",
    border: "rgba(124,58,237,0.35)",
    text: "#A78BFA",
    label: "SDG 17.16 — Partnerships",
  },
};

function EventCard({ event }) {
  const sdg = SDG_COLORS[event.sdg_goal] || SDG_COLORS["4.4"];
  const typeInfo = EVENT_TYPES.find((t) => t.id === event.event_type);
  return (
    <div
      style={{
        background: sdg.bg,
        border: `1px solid ${sdg.border}`,
        borderRadius: 14,
        padding: 18,
        display: "flex",
        gap: 14,
        alignItems: "flex-start",
      }}
    >
      <div style={{ fontSize: 24 }}>
        {typeInfo?.label?.split(" ")[0] || "🌟"}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>
          {typeInfo?.label?.split(" ").slice(1).join(" ") ||
            event.event_type?.replace(/_/g, " ")}
        </div>
        {event.description && (
          <div
            style={{
              color: "rgba(255,255,255,0.55)",
              fontSize: 13,
              marginTop: 4,
            }}
          >
            {event.description}
          </div>
        )}
        <div
          style={{
            display: "flex",
            gap: 10,
            marginTop: 8,
            alignItems: "center",
          }}
        >
          <span
            style={{
              padding: "2px 8px",
              borderRadius: 100,
              fontSize: 11,
              fontWeight: 700,
              color: sdg.text,
              background: sdg.border.replace("0.35", "0.2"),
            }}
          >
            {event.sdg_goal}
          </span>
          {event.sdg_track && (
            <span
              style={{
                padding: "2px 8px",
                borderRadius: 100,
                fontSize: 11,
                background: "rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.5)",
              }}
            >
              {event.sdg_track}
            </span>
          )}
          {event.is_verified && (
            <span style={{ fontSize: 11, color: "#10B981" }}>✓ Verified</span>
          )}
          <span
            style={{
              fontSize: 11,
              color: "rgba(255,255,255,0.3)",
              marginLeft: "auto",
            }}
          >
            {new Date(event.recorded_at).toLocaleDateString("en-MY", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function ImpactPage() {
  const [showLog, setShowLog] = useState(false);
  const [form, setForm] = useState({
    event_type: "skill_gained",
    description: "",
  });
  const [error, setError] = useState(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["impactEvents"],
    queryFn: async () => {
      const r = await fetch("/api/impact-events");
      return r.ok ? r.json() : null;
    },
  });

  const logMutation = useMutation({
    mutationFn: async (payload) => {
      const eventType = EVENT_TYPES.find((e) => e.id === payload.event_type);
      const r = await fetch("/api/impact-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, sdg_goal: eventType?.sdg || "4.4" }),
      });
      if (!r.ok) throw new Error((await r.json()).error);
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries(["impactEvents"]);
      setShowLog(false);
      setForm({ event_type: "skill_gained", description: "" });
      setError(null);
    },
    onError: (err) => setError(err.message),
  });

  const events = data?.events || [];
  const summary = data?.summary || [];

  const totalBySDG = { 4.4: 0, 5.5: 0, 8.6: 0, 17.16: 0 };
  summary.forEach((s) => {
    if (totalBySDG[s.sdg_goal] !== undefined)
      totalBySDG[s.sdg_goal] = parseInt(s.count);
  });

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
            / SDG Impact Log
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
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: 28,
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 900, marginBottom: 6 }}>
              🌱 My SDG Impact Log
            </h1>
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 14 }}>
              Every milestone you achieve is tracked against the UN Sustainable
              Development Goals.
            </p>
          </div>
          <button
            onClick={() => setShowLog(!showLog)}
            style={{
              padding: "10px 22px",
              borderRadius: 12,
              background: "linear-gradient(135deg, #7C3AED, #EC4899)",
              color: "#fff",
              fontWeight: 700,
              border: "none",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            + Log Achievement
          </button>
        </div>

        {/* Log form */}
        {showLog && (
          <div
            style={{
              background: "rgba(124,58,237,0.08)",
              border: "1px solid rgba(124,58,237,0.25)",
              borderRadius: 16,
              padding: 24,
              marginBottom: 24,
            }}
          >
            <h3 style={{ fontWeight: 700, marginBottom: 16 }}>
              Log an Achievement
            </h3>
            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.7)",
                  marginBottom: 8,
                }}
              >
                Achievement Type
              </label>
              <select
                value={form.event_type}
                onChange={(e) =>
                  setForm({ ...form, event_type: e.target.value })
                }
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 10,
                  fontSize: 14,
                  background: "#1A0F2E",
                  border: "1px solid rgba(255,255,255,0.15)",
                  color: "#fff",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              >
                {EVENT_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label} (SDG {t.sdg})
                  </option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.7)",
                  marginBottom: 8,
                }}
              >
                Description (optional)
              </label>
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="Tell us a bit about this achievement…"
                rows={3}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 10,
                  fontSize: 14,
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "#fff",
                  outline: "none",
                  resize: "vertical",
                  boxSizing: "border-box",
                  fontFamily: "'Inter', sans-serif",
                }}
              />
            </div>
            {error && (
              <div style={{ color: "#FCA5A5", fontSize: 13, marginBottom: 12 }}>
                {error}
              </div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => {
                  setShowLog(false);
                  setError(null);
                }}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: 10,
                  background: "rgba(255,255,255,0.07)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "#fff",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => logMutation.mutate(form)}
                disabled={logMutation.isPending}
                style={{
                  flex: 2,
                  padding: "10px",
                  borderRadius: 10,
                  background: "linear-gradient(135deg, #7C3AED, #EC4899)",
                  color: "#fff",
                  cursor: "pointer",
                  fontWeight: 700,
                  border: "none",
                  opacity: logMutation.isPending ? 0.7 : 1,
                }}
              >
                {logMutation.isPending ? "Saving…" : "Log Achievement 🌱"}
              </button>
            </div>
          </div>
        )}

        {/* SDG summary */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 16,
            marginBottom: 32,
          }}
        >
          {Object.entries(totalBySDG).map(([sdg, count]) => {
            const info = SDG_COLORS[sdg];
            return (
              <div
                key={sdg}
                style={{
                  background: info.bg,
                  border: `1px solid ${info.border}`,
                  borderRadius: 12,
                  padding: "18px 20px",
                }}
              >
                <div
                  style={{ fontSize: 24, fontWeight: 900, color: info.text }}
                >
                  {count}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: info.text,
                    marginTop: 4,
                  }}
                >
                  {sdg}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "rgba(255,255,255,0.45)",
                    marginTop: 2,
                    lineHeight: 1.4,
                  }}
                >
                  {info.label.split("—")[1]?.trim()}
                </div>
              </div>
            );
          })}
        </div>

        {/* Events list */}
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>
            Achievement History ({events.length})
          </h2>
          {isLoading && (
            <div
              style={{
                textAlign: "center",
                padding: 40,
                color: "rgba(255,255,255,0.3)",
              }}
            >
              Loading…
            </div>
          )}
          {!isLoading && events.length === 0 && (
            <div
              style={{
                textAlign: "center",
                padding: 48,
                background: "rgba(255,255,255,0.03)",
                borderRadius: 16,
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <div style={{ fontSize: 48, marginBottom: 12 }}>🌱</div>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>
                No achievements logged yet
              </div>
              <div style={{ color: "rgba(255,255,255,0.4)", marginBottom: 24 }}>
                Every skill you learn, course you complete, or milestone you
                reach counts!
              </div>
              <button
                onClick={() => setShowLog(true)}
                style={{
                  padding: "10px 24px",
                  borderRadius: 10,
                  background: "linear-gradient(135deg, #7C3AED, #EC4899)",
                  color: "#fff",
                  fontWeight: 700,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Log your first achievement →
              </button>
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {events.map((ev) => (
              <EventCard key={ev.id} event={ev} />
            ))}
          </div>
        </div>

        {/* Info box */}
        <div
          style={{
            marginTop: 40,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 16,
            padding: 24,
          }}
        >
          <h3 style={{ fontWeight: 700, marginBottom: 12 }}>
            🌍 Why We Track SDG Impact
          </h3>
          <p
            style={{
              color: "rgba(255,255,255,0.55)",
              fontSize: 14,
              lineHeight: 1.8,
            }}
          >
            ElevateHer is aligned with the UN Sustainable Development Goals.
            Every achievement you log contributes to our shared mission of
            improving education (SDG 4.4), gender equality (SDG 5.5), and youth
            employment (SDG 8.6) across Southeast Asia. Your impact is reported
            to our partner institutions as anonymised aggregate data.
          </p>
        </div>
      </div>
    </div>
  );
}
