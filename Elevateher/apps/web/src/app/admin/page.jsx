"use client";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

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
    padding: "10px 16px",
    textAlign: "left",
    fontSize: 11,
    color: "rgba(255,255,255,0.4)",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    borderBottom: "1px solid rgba(255,255,255,0.07)",
  },
  td: {
    padding: "14px 16px",
    fontSize: 13,
    borderBottom: "1px solid rgba(255,255,255,0.05)",
    verticalAlign: "middle",
  },
  btn: (color = "#7C3AED") => ({
    padding: "6px 14px",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 700,
    background: `${color}22`,
    border: `1px solid ${color}44`,
    color,
    cursor: "pointer",
  }),
};

const STATUS_COLORS = {
  pending_admin_review: "#3B82F6",
  approved: "#10B981",
  rejected: "#EF4444",
  suspended: "#EF4444",
  unverified: "#6B7280",
  pending_id: "#F59E0B",
  pending_employment: "#F59E0B",
};

const SEV_COLORS = {
  critical: "#EF4444",
  high: "#F59E0B",
  medium: "#3B82F6",
  low: "#10B981",
};

function AdminNav({ tab, setTab }) {
  const tabs = [
    { id: "mentors", label: "🔍 Mentor Verification" },
    { id: "safety", label: "🛡️ Safety Reports" },
    { id: "scanner", label: "🤖 Bio Scanner" },
  ];
  return (
    <div
      style={{
        display: "flex",
        gap: 4,
        padding: "12px 24px",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => setTab(t.id)}
          style={{
            padding: "8px 16px",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            background: tab === t.id ? "rgba(124,58,237,0.2)" : "transparent",
            border:
              tab === t.id
                ? "1px solid rgba(124,58,237,0.4)"
                : "1px solid transparent",
            color: tab === t.id ? "#A78BFA" : "rgba(255,255,255,0.5)",
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function MentorVerificationTab({ institutionFilter }) {
  const qc = useQueryClient();
  const [notes, setNotes] = useState({});

  const { data, isLoading } = useQuery({
    queryKey: ["adminMentors", institutionFilter],
    queryFn: async () => {
      const r = await fetch(`/api/admin/mentors${institutionFilter ? `?institution_id=${institutionFilter}` : ""}`);
      return r.ok ? r.json() : null;
    },
  });

  const actionMutation = useMutation({
    mutationFn: async ({ mentor_profile_id, action, note }) => {
      const r = await fetch("/api/admin/mentors", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mentor_profile_id, action, notes: note }),
      });
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries(["adminMentors"]),
  });

  const mentors = data?.mentors || [];
  const stats = data?.stats || {};

  return (
    <div>
      {/* Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        {[
          {
            label: "Pending Review",
            value: stats.pending_review || 0,
            color: "#3B82F6",
          },
          { label: "Approved", value: stats.approved || 0, color: "#10B981" },
          { label: "Rejected", value: stats.rejected || 0, color: "#EF4444" },
          { label: "Total", value: stats.total || 0, color: "#A78BFA" },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 12,
              padding: "16px 20px",
            }}
          >
            <div style={{ fontSize: 24, fontWeight: 900, color: s.color }}>
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

      {/* Table */}
      <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
        {isLoading ? (
          <div
            style={{
              padding: 48,
              textAlign: "center",
              color: "rgba(255,255,255,0.3)",
            }}
          >
            Loading mentor applications…
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {[
                    "Mentor",
                    "Role",
                    "Country",
                    "Status",
                    "Bio Safety",
                    "Risk",
                    "Notes",
                    "Actions",
                  ].map((h) => (
                    <th key={h} style={S.th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mentors.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      style={{
                        ...S.td,
                        textAlign: "center",
                        padding: 32,
                        color: "rgba(255,255,255,0.3)",
                      }}
                    >
                      No mentor applications yet
                    </td>
                  </tr>
                ) : (
                  mentors.map((m) => (
                    <tr key={m.id}>
                      <td style={S.td}>
                        <div style={{ fontWeight: 600 }}>{m.full_name}</div>
                        <div
                          style={{
                            fontSize: 11,
                            color: "rgba(255,255,255,0.4)",
                          }}
                        >
                          {m.email}
                        </div>
                      </td>
                      <td style={S.td}>
                        {m.job_title}
                        <br />
                        <span
                          style={{
                            fontSize: 11,
                            color: "rgba(255,255,255,0.4)",
                          }}
                        >
                          {m.employer}
                        </span>
                      </td>
                      <td style={S.td}>{m.country || "—"}</td>
                      <td style={S.td}>
                        <span
                          style={S.badge(
                            STATUS_COLORS[m.verification_status] || "#6B7280",
                          )}
                        >
                          {m.verification_status?.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td style={S.td}>
                        <span
                          style={{
                            color:
                              m.bio_safety_score > 0.75
                                ? "#10B981"
                                : m.bio_safety_score > 0.4
                                  ? "#F59E0B"
                                  : "#EF4444",
                          }}
                        >
                          {m.bio_safety_score
                            ? `${(m.bio_safety_score * 100).toFixed(0)}%`
                            : "—"}
                        </span>
                      </td>
                      <td style={S.td}>
                        <span
                          style={{
                            color:
                              m.max_risk_score > 0.5
                                ? "#EF4444"
                                : m.max_risk_score > 0.3
                                  ? "#F59E0B"
                                  : "#10B981",
                          }}
                        >
                          {m.max_risk_score
                            ? parseFloat(m.max_risk_score).toFixed(2)
                            : "0.00"}
                        </span>
                      </td>
                      <td style={S.td}>
                        <input
                          value={notes[m.id] || ""}
                          onChange={(e) =>
                            setNotes((n) => ({ ...n, [m.id]: e.target.value }))
                          }
                          placeholder="Add note…"
                          style={{
                            background: "rgba(255,255,255,0.06)",
                            border: "1px solid rgba(255,255,255,0.1)",
                            borderRadius: 6,
                            padding: "4px 8px",
                            color: "#fff",
                            fontSize: 12,
                            outline: "none",
                            width: 120,
                          }}
                        />
                      </td>
                      <td style={S.td}>
                        <div
                          style={{ display: "flex", gap: 6, flexWrap: "wrap" }}
                        >
                          {!m.is_approved &&
                            m.verification_status !== "approved" && (
                              <button
                                style={S.btn("#10B981")}
                                onClick={() =>
                                  actionMutation.mutate({
                                    mentor_profile_id: m.id,
                                    action: "approve",
                                    note: notes[m.id],
                                  })
                                }
                              >
                                ✓ Approve
                              </button>
                            )}
                          {m.verification_status !== "rejected" && (
                            <button
                              style={S.btn("#EF4444")}
                              onClick={() =>
                                actionMutation.mutate({
                                  mentor_profile_id: m.id,
                                  action: "reject",
                                  note:
                                    notes[m.id] ||
                                    "Does not meet verification standards",
                                })
                              }
                            >
                              ✗ Reject
                            </button>
                          )}
                          {!m.is_suspended && (
                            <button
                              style={S.btn("#F59E0B")}
                              onClick={() =>
                                actionMutation.mutate({
                                  mentor_profile_id: m.id,
                                  action: "request_docs",
                                  note: notes[m.id],
                                })
                              }
                            >
                              📄 Docs
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function SafetyReportsTab({ institutionFilter }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["adminSafety", institutionFilter],
    queryFn: async () => {
      const r = await fetch(`/api/admin/safety${institutionFilter ? `?institution_id=${institutionFilter}` : ""}`);
      return r.ok ? r.json() : null;
    },
  });

  useEffect(() => {
    const es = new EventSource(`/api/admin/safety/stream${institutionFilter ? `?institution_id=${institutionFilter}` : ""}`);
    es.onmessage = (e) => {
      const alert = JSON.parse(e.data);
      toast(`New safety alert: ${alert.reason}`, { icon: '🚨' });
      qc.invalidateQueries(["adminSafety"]);
    };
    return () => es.close();
  }, [institutionFilter, qc]);

  const actionMutation = useMutation({
    mutationFn: async (payload) => {
      const r = await fetch("/api/admin/safety", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries(["adminSafety"]),
  });

  const reports = data?.reports || [];
  const stats = data?.stats || {};
  const suspended = data?.suspended_users || [];

  return (
    <div>
      {/* Alert banner */}
      {parseInt(stats.critical_open) > 0 && (
        <div
          style={{
            background: "rgba(239,68,68,0.12)",
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: 12,
            padding: "14px 20px",
            marginBottom: 20,
            display: "flex",
            gap: 12,
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 24 }}>🚨</span>
          <div>
            <div style={{ fontWeight: 700, color: "#FCA5A5" }}>
              {stats.critical_open} Critical Reports Need Immediate Review
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>
              Auto-suspension may already be in effect. Review and escalate if
              necessary.
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        {[
          {
            label: "Open Reports",
            value: stats.open_reports || 0,
            color: "#F59E0B",
          },
          {
            label: "Critical Open",
            value: stats.critical_open || 0,
            color: "#EF4444",
          },
          {
            label: "Auto-Suspensions",
            value: stats.auto_suspensions || 0,
            color: "#EC4899",
          },
          {
            label: "Total Reports",
            value: stats.total_reports || 0,
            color: "#6B7280",
          },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 12,
              padding: "16px 20px",
            }}
          >
            <div style={{ fontSize: 24, fontWeight: 900, color: s.color }}>
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

      {/* Reports table */}
      <div
        style={{ ...S.card, padding: 0, overflow: "hidden", marginBottom: 24 }}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
            fontWeight: 700,
          }}
        >
          Safety Reports
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {[
                  "Reported",
                  "Reason",
                  "Severity",
                  "Status",
                  "Date",
                  "Actions",
                ].map((h) => (
                  <th key={h} style={S.th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reports.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      ...S.td,
                      textAlign: "center",
                      padding: 32,
                      color: "rgba(255,255,255,0.3)",
                    }}
                  >
                    No reports — platform is safe! 🛡️
                  </td>
                </tr>
              ) : (
                reports.map((r) => (
                  <tr key={r.id}>
                    <td style={S.td}>
                      <div style={{ fontWeight: 600 }}>{r.reported_name}</div>
                      <div
                        style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}
                      >
                        {r.reported_role}
                      </div>
                    </td>
                    <td style={S.td}>{r.reason?.replace(/_/g, " ")}</td>
                    <td style={S.td}>
                      <span
                        style={S.badge(SEV_COLORS[r.severity] || "#6B7280")}
                      >
                        {r.severity}
                      </span>
                    </td>
                    <td style={S.td}>
                      <span
                        style={S.badge(
                          r.status === "open"
                            ? "#F59E0B"
                            : r.status === "resolved"
                              ? "#10B981"
                              : "#6B7280",
                        )}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td style={S.td}>
                      {new Date(r.created_at).toLocaleDateString()}
                    </td>
                    <td style={S.td}>
                      <div style={{ display: "flex", gap: 6 }}>
                        {r.status === "open" && (
                          <>
                            <button
                              style={S.btn("#10B981")}
                              onClick={() =>
                                actionMutation.mutate({
                                  report_id: r.id,
                                  action: "resolve",
                                })
                              }
                            >
                              Resolve
                            </button>
                            <button
                              style={S.btn("#6B7280")}
                              onClick={() =>
                                actionMutation.mutate({
                                  report_id: r.id,
                                  action: "dismiss",
                                })
                              }
                            >
                              Dismiss
                            </button>
                            {r.severity === "critical" && (
                              <button
                                style={S.btn("#EF4444")}
                                onClick={() =>
                                  actionMutation.mutate({
                                    report_id: r.id,
                                    action: "escalate",
                                  })
                                }
                              >
                                Escalate
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Suspended users */}
      {suspended.length > 0 && (
        <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
          <div
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid rgba(255,255,255,0.07)",
              fontWeight: 700,
            }}
          >
            Suspended Users
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["User", "Role", "Reason", "Suspended", "Action"].map(
                    (h) => (
                      <th key={h} style={S.th}>
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {suspended.map((u) => (
                  <tr key={u.id}>
                    <td style={S.td}>
                      {u.name}
                      <br />
                      <span
                        style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}
                      >
                        {u.email}
                      </span>
                    </td>
                    <td style={S.td}>{u.role}</td>
                    <td style={S.td}>{u.suspended_reason}</td>
                    <td style={S.td}>
                      {u.suspended_at
                        ? new Date(u.suspended_at).toLocaleDateString()
                        : "—"}
                    </td>
                    <td style={S.td}>
                      <button
                        style={S.btn("#10B981")}
                        onClick={() =>
                          actionMutation.mutate({ unsuspend_user_id: u.id })
                        }
                      >
                        Unsuspend
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function BioScannerTab() {
  const [bioText, setBioText] = useState(
    "I'm a senior engineer at a tech company with 8 years experience. Passionate about mentoring young women in STEM. I mentor 1-2 hours per week and focus on career mapping and technical skills.",
  );
  const [result, setResult] = useState(null);
  const [scanning, setScanning] = useState(false);

  const scan = async () => {
    setScanning(true);
    setResult(null);
    try {
      const r = await fetch("/api/safety/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: bioText, type: "bio" }),
      });
      setResult(await r.json());
    } catch (e) {
      setResult({ error: "Scan failed" });
    }
    setScanning(false);
  };

  const UNSAFE_EXAMPLES = [
    "I'm a software engineer. Let's connect on WhatsApp at +60123456789. Don't tell your parents, this is just between us.",
    "I am very passionate mentor. You are such a special girl, not like other girls your age. Let me help you privately.",
    "Senior developer here. kasih nomor hp kamu ya, kita bisa chat langsung via WA.",
  ];

  const SAFE_EXAMPLES = [
    "Senior Data Scientist at Grab with 9 years experience in fintech and AI. Passionate about helping young women break into tech. Available 2 hours per week for structured career mentorship.",
    "Product Manager with 7 years at Axiata. Expertise in telco strategy and agile methodology. Focused on helping mentees with career mapping and professional development.",
  ];

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24 }}>
        <div>
          <h3 style={{ fontWeight: 700, marginBottom: 12 }}>
            🤖 AI Bio Safety Scanner
          </h3>
          <p
            style={{
              color: "rgba(255,255,255,0.45)",
              fontSize: 14,
              marginBottom: 16,
            }}
          >
            Powered by Gemini (SEA-Guard equivalent). Tests mentor bios for
            safety risks before approval.
          </p>
          <textarea
            value={bioText}
            onChange={(e) => setBioText(e.target.value)}
            rows={6}
            style={{
              width: "100%",
              padding: "12px 16px",
              borderRadius: 10,
              fontSize: 14,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "#fff",
              outline: "none",
              resize: "vertical",
              fontFamily: "'Inter', sans-serif",
              boxSizing: "border-box",
              lineHeight: 1.6,
            }}
          />
          <button
            onClick={scan}
            disabled={scanning || !bioText.trim()}
            style={{
              marginTop: 12,
              padding: "12px 24px",
              borderRadius: 10,
              fontWeight: 700,
              fontSize: 15,
              background: "linear-gradient(135deg, #7C3AED, #EC4899)",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              opacity: scanning ? 0.7 : 1,
            }}
          >
            {scanning ? "⏳ Scanning with AI…" : "🔍 Scan Bio"}
          </button>

          {result && (
            <div
              style={{
                marginTop: 20,
                background: result.approved
                  ? "rgba(16,185,129,0.08)"
                  : "rgba(239,68,68,0.08)",
                border: `1px solid ${result.approved ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
                borderRadius: 12,
                padding: 20,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 12,
                }}
              >
                <span style={{ fontSize: 24 }}>
                  {result.approved ? "✅" : "❌"}
                </span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>
                    {result.approved ? "APPROVED" : "FLAGGED"}
                  </div>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>
                    Safety Score:{" "}
                    {result.safe_score
                      ? `${(result.safe_score * 100).toFixed(0)}%`
                      : "—"}
                  </div>
                </div>
              </div>
              {result.flags?.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "rgba(255,255,255,0.4)",
                      marginBottom: 6,
                    }}
                  >
                    FLAGS DETECTED:
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {result.flags.map((f) => (
                      <span
                        key={f}
                        style={{
                          padding: "4px 10px",
                          borderRadius: 100,
                          background: "rgba(239,68,68,0.2)",
                          border: "1px solid rgba(239,68,68,0.4)",
                          fontSize: 12,
                          color: "#FCA5A5",
                        }}
                      >
                        {f.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {result.reason && (
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>
                  {result.reason}
                </div>
              )}
              {result.content_hash && (
                <div
                  style={{
                    fontSize: 11,
                    color: "rgba(255,255,255,0.25)",
                    marginTop: 8,
                    fontFamily: "monospace",
                  }}
                >
                  Hash: {result.content_hash.slice(0, 20)}…
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={S.card}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "#10B981",
                marginBottom: 10,
              }}
            >
              ✅ Safe Examples
            </div>
            {SAFE_EXAMPLES.map((ex, i) => (
              <button
                key={i}
                onClick={() => setBioText(ex)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  background: "rgba(16,185,129,0.08)",
                  border: "1px solid rgba(16,185,129,0.2)",
                  borderRadius: 8,
                  padding: "8px 12px",
                  fontSize: 12,
                  color: "rgba(255,255,255,0.6)",
                  cursor: "pointer",
                  marginBottom: 8,
                  lineHeight: 1.5,
                }}
              >
                {ex.slice(0, 80)}…
              </button>
            ))}
          </div>
          <div style={S.card}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "#EF4444",
                marginBottom: 10,
              }}
            >
              🚨 Unsafe Examples
            </div>
            {UNSAFE_EXAMPLES.map((ex, i) => (
              <button
                key={i}
                onClick={() => setBioText(ex)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  background: "rgba(239,68,68,0.08)",
                  border: "1px solid rgba(239,68,68,0.2)",
                  borderRadius: 8,
                  padding: "8px 12px",
                  fontSize: 12,
                  color: "rgba(255,255,255,0.6)",
                  cursor: "pointer",
                  marginBottom: 8,
                  lineHeight: 1.5,
                }}
              >
                {ex.slice(0, 80)}…
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [tab, setTab] = useState("safety");
  const [institutionFilter, setInstitutionFilter] = useState("");
  
  const { data: profile, isLoading: isProfileLoading } = useQuery({
    queryKey: ["userProfile"],
    queryFn: async () => {
      const r = await fetch("/api/users/profile");
      return r.ok ? r.json() : null;
    }
  });

  const { data: instData } = useQuery({
    queryKey: ["adminInstitutions"],
    queryFn: async () => {
      const r = await fetch("/api/institutions/summary");
      return r.ok ? r.json() : null;
    },
    enabled: profile?.profile?.role === "admin"
  });

  const isAdmin = true; // Always true for demo

  if (isProfileLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0F0A1E",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Inter', sans-serif",
        }}
      >
        <div style={{ textAlign: "center", color: "#fff" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
          <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 16 }}>
            Verifying access…
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0F0A1E",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Inter', sans-serif",
        }}
      >
        <div style={{ textAlign: "center", color: "#fff" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⛔</div>
          <div style={{ color: "#EF4444", fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
            Access Denied
          </div>
          <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, marginBottom: 24 }}>
            This area is restricted to administrators.
          </div>
          <a
            href="/dashboard"
            style={{
              display: "inline-block",
              padding: "10px 24px",
              borderRadius: 10,
              background: "rgba(124,58,237,0.2)",
              border: "1px solid rgba(124,58,237,0.4)",
              color: "#A78BFA",
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            ← Back to Dashboard
          </a>
        </div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      <nav style={S.nav}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <a
            href="/institution/dashboard"
            style={{
              color: "rgba(255,255,255,0.4)",
              textDecoration: "none",
              fontSize: 14,
            }}
          >
            ← B2B Dashboard
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
            Admin Panel
          </span>
          <span
            style={{
              padding: "3px 10px",
              borderRadius: 100,
              background: "rgba(239,68,68,0.15)",
              border: "1px solid rgba(239,68,68,0.3)",
              fontSize: 12,
              color: "#FCA5A5",
              fontWeight: 600,
            }}
          >
            🔒 Restricted
          </span>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <a
            href="/ussd-simulator"
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              background: "rgba(124,58,237,0.15)",
              border: "1px solid rgba(124,58,237,0.3)",
              color: "#A78BFA",
              textDecoration: "none",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            📱 USSD Sim
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

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <AdminNav tab={tab} setTab={setTab} />
        
        {isAdmin && instData?.institutions && (
          <div style={{ paddingRight: 24 }}>
            <select
              value={institutionFilter}
              onChange={(e) => setInstitutionFilter(e.target.value)}
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#fff",
                padding: "6px 12px",
                borderRadius: 8,
                fontSize: 13,
                outline: "none"
              }}
            >
              <option value="">All Institutions</option>
              {instData.institutions.map(inst => (
                <option key={inst.id} value={inst.id}>{inst.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: 28 }}>
        {tab === "mentors" && <MentorVerificationTab institutionFilter={institutionFilter} />}
        {tab === "safety" && <SafetyReportsTab institutionFilter={institutionFilter} />}
        {tab === "scanner" && <BioScannerTab />}
      </div>
    </div>
  );
}
