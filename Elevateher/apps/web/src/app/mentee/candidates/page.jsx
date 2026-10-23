"use client";
import { useState } from "react";
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// ─── Safety filter banner ───────────────────────────────────────────────────────
function SafetyFilterBanner({ total, excluded }) {
  const [open, setOpen] = useState(false);
  if (!excluded || excluded === 0) return null;
  return (
    <div
      style={{
        background: "rgba(16,185,129,0.07)",
        border: "1px solid rgba(16,185,129,0.25)",
        borderRadius: 14,
        padding: "12px 20px",
        marginBottom: 20,
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
      }}
    >
      <span style={{ fontSize: 20, marginTop: 1 }}>🛡️</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "#6EE7B7" }}>
          Safety filters are active
        </div>
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginTop: 2 }}>
          <strong style={{ color: "#EF4444" }}>{excluded} mentor{excluded !== 1 ? "s" : ""}</strong>{" "}
          excluded from your results due to safety concerns — unsafe bio, suspended account, or full capacity.
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          style={{
            marginTop: 6,
            background: "none",
            border: "none",
            color: "rgba(110,231,183,0.7)",
            cursor: "pointer",
            fontSize: 12,
            padding: 0,
          }}
        >
          {open ? "Hide details ▲" : "What did we filter? ▼"}
        </button>
        {open && (
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
            {[
              { icon: "❌", label: "Unsafe bio detected", desc: "Mentor bio contains off-platform solicitation or grooming language. Blocked by SEA-Guard." },
              { icon: "🚫", label: "Account suspended", desc: "Mentor was suspended following a safety investigation." },
              { icon: "⏳", label: "At full capacity", desc: "Mentor has reached their maximum number of active mentees." },
            ].map((row) => (
              <div key={row.label} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <span style={{ fontSize: 14 }}>{row.icon}</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>{row.label}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{row.desc}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Trust tier chip ─────────────────────────────────────────────────────────────
function TrustTierChip({ score }) {
  const s = score ?? 0;
  let label, color;
  if (s >= 0.9) { label = "✓ TRUSTED"; color = "#10B981"; }
  else if (s >= 0.75) { label = "🔒 VERIFIED"; color = "#A78BFA"; }
  else { label = "⏳ PENDING"; color = "#F59E0B"; }
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 800,
        padding: "2px 7px",
        borderRadius: 100,
        background: `${color}22`,
        border: `1px solid ${color}55`,
        color,
        letterSpacing: "0.04em",
        flexShrink: 0,
      }}
    >{label}</span>
  );
}

// Match score ring SVG component — from File 06 MentorCandidateCard spec
function MatchScoreRing({ score }) {
  const pct = Math.round(score * 100);
  const r = 20;
  const circ = 2 * Math.PI * r;
  const dash = (circ * pct) / 100;
  return (
    <div style={{ position: "relative", width: 56, height: 56, flexShrink: 0 }}>
      <svg
        viewBox="0 0 48 48"
        style={{ width: "100%", height: "100%", transform: "rotate(-90deg)" }}
      >
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="4"
        />
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          stroke={pct >= 85 ? "#10B981" : pct >= 70 ? "#A78BFA" : "#F59E0B"}
          strokeWidth="4"
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
        />
      </svg>
      <span
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11,
          fontWeight: 800,
          color: pct >= 85 ? "#10B981" : pct >= 70 ? "#A78BFA" : "#F59E0B",
        }}
      >
        {pct}%
      </span>
    </div>
  );
}

function CandidateCard({ mentor, onSelect, isRequesting }) {
  const [expanded, setExpanded] = useState(false);
  const score = mentor.match_score ?? 0.82;
  const languages = mentor.languages || [];
  const skills = mentor.skills || [];

  return (
    <article
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 20,
        padding: 24,
        transition: "border-color 0.2s",
      }}
    >
      {/* Header row */}
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        {/* Avatar */}
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #7C3AED, #EC4899)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 22,
            fontWeight: 800,
            color: "#fff",
            flexShrink: 0,
          }}
        >
          {(mentor.display_name || mentor.full_name || "?")[0]}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}>
                {mentor.display_name || mentor.full_name}
                <TrustTierChip score={mentor.bio_safety_score} />
              </div>
              <div
                style={{
                  color: "rgba(255,255,255,0.55)",
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
                {mentor.country} · {mentor.years_exp} yrs exp ·{" "}
                {mentor.industry}
              </div>
            </div>
            <MatchScoreRing score={score} />
          </div>

          {/* AI match reason box */}
          <div
            style={{
              marginTop: 14,
              background: "rgba(124,58,237,0.12)",
              border: "1px solid rgba(124,58,237,0.25)",
              borderRadius: 12,
              padding: "10px 14px",
              display: "flex",
              gap: 8,
              alignItems: "flex-start",
            }}
          >
            <span style={{ color: "#A78BFA", flexShrink: 0, marginTop: 1 }}>
              ❆
            </span>
            <p
              style={{
                fontSize: 13,
                color: "#C4B5FD",
                lineHeight: 1.6,
                margin: 0,
                fontStyle: "italic",
              }}
            >
              {mentor.match_reason || `Matched because: shared language alignment + ${mentor.industry || "career"} track match`}
            </p>
          </div>

          {/* Why this mentor — detail chips */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
            {(mentor.languages || []).map((l) => (
              <span key={l} style={{ fontSize: 10, padding: "3px 9px", borderRadius: 100, background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.25)", color: "#93C5FD" }}>
                🌐 {l.toUpperCase()}
              </span>
            ))}
            {mentor.industry && (
              <span style={{ fontSize: 10, padding: "3px 9px", borderRadius: 100, background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)", color: "#6EE7B7" }}>
                🏆 {mentor.industry}
              </span>
            )}
            {mentor.years_exp && (
              <span style={{ fontSize: 10, padding: "3px 9px", borderRadius: 100, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", color: "#FCD34D" }}>
                ⏳ {mentor.years_exp}y experience
              </span>
            )}
          </div>

          {/* Bio preview */}
          <p
            style={{
              marginTop: 12,
              fontSize: 13,
              color: "rgba(255,255,255,0.55)",
              lineHeight: 1.7,
              margin: "12px 0 0",
            }}
          >
            {expanded
              ? mentor.bio
              : `${mentor.bio?.slice(0, 140)}${mentor.bio?.length > 140 ? "…" : ""}`}
            {mentor.bio?.length > 140 && (
              <button
                onClick={() => setExpanded(!expanded)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#A78BFA",
                  cursor: "pointer",
                  fontSize: 13,
                  padding: "0 0 0 6px",
                  fontWeight: 600,
                }}
              >
                {expanded ? "Show less" : "Read more"}
              </button>
            )}
          </p>

          {/* Languages + skills */}
          <div
            style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}
          >
            {languages.map((l) => (
              <span
                key={l}
                style={{
                  padding: "3px 10px",
                  borderRadius: 100,
                  fontSize: 11,
                  fontWeight: 700,
                  background: "rgba(59,130,246,0.15)",
                  border: "1px solid rgba(59,130,246,0.3)",
                  color: "#93C5FD",
                }}
              >
                {l.toUpperCase()}
              </span>
            ))}
            {skills.slice(0, 3).map((s) => (
              <span
                key={s}
                style={{
                  padding: "3px 10px",
                  borderRadius: 100,
                  fontSize: 11,
                  background: "rgba(124,58,237,0.15)",
                  border: "1px solid rgba(124,58,237,0.25)",
                  color: "#A78BFA",
                }}
              >
                {s}
              </span>
            ))}
            {skills.length > 3 && (
              <span
                style={{
                  color: "rgba(255,255,255,0.3)",
                  fontSize: 12,
                  padding: "3px 0",
                }}
              >
                +{skills.length - 3} more
              </span>
            )}
          </div>

          {/* Capacity indicator */}
          <div
            style={{
              marginTop: 10,
              fontSize: 12,
              color: "rgba(255,255,255,0.35)",
            }}
          >
            {mentor.can_mentor_minors && "✓ Can mentor under-18 · "}
            {mentor.current_mentees}/{mentor.max_mentees} mentee slots used
          </div>
        </div>
      </div>

      {/* Action button */}
      <button
        onClick={() => onSelect(mentor)}
        disabled={isRequesting}
        style={{
          width: "100%",
          marginTop: 18,
          padding: "12px",
          borderRadius: 12,
          fontSize: 14,
          fontWeight: 700,
          background: "linear-gradient(135deg, #7C3AED, #EC4899)",
          color: "#fff",
          border: "none",
          cursor: isRequesting ? "not-allowed" : "pointer",
          opacity: isRequesting ? 0.7 : 1,
          transition: "opacity 0.2s",
        }}
      >
        {isRequesting ? "Sending request…" : "Request this mentor →"}
      </button>
    </article>
  );
}

function FilterBar({ track, setTrack, language, setLanguage }) {
  const TRACKS = [
    "All",
    "STEM",
    "Business",
    "Trades",
    "Creative",
    "Healthcare",
  ];
  const LANGS = [
    { code: "all", label: "All Languages" },
    { code: "en", label: "English" },
    { code: "ms", label: "Malay" },
    { code: "id", label: "Indonesian" },
    { code: "th", label: "Thai" },
    { code: "ja", label: "Japanese" },
  ];

  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        alignItems: "center",
        flexWrap: "wrap",
        marginBottom: 24,
      }}
    >
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {TRACKS.map((t) => (
          <button
            key={t}
            onClick={() => setTrack(t === "All" ? "" : t)}
            style={{
              padding: "6px 14px",
              borderRadius: 100,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              background:
                track === t || (!track && t === "All")
                  ? "rgba(124,58,237,0.3)"
                  : "rgba(255,255,255,0.06)",
              border: `1px solid ${track === t || (!track && t === "All") ? "rgba(124,58,237,0.6)" : "rgba(255,255,255,0.12)"}`,
              color:
                track === t || (!track && t === "All")
                  ? "#A78BFA"
                  : "rgba(255,255,255,0.6)",
            }}
          >
            {t}
          </button>
        ))}
      </div>
      <select
        value={language}
        onChange={(e) =>
          setLanguage(e.target.value === "all" ? "" : e.target.value)
        }
        style={{
          padding: "7px 12px",
          borderRadius: 10,
          fontSize: 13,
          background: "#1A0F2E",
          border: "1px solid rgba(255,255,255,0.15)",
          color: "#fff",
          outline: "none",
        }}
      >
        {LANGS.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function CandidatesPage() {
  const [trackFilter, setTrackFilter] = useState("");
  const [langFilter, setLangFilter] = useState("");
  const [requestingId, setRequestingId] = useState(null);
  const [successMsg, setSuccessMsg] = useState("");
  const qc = useQueryClient();

  const params = new URLSearchParams();
  if (trackFilter) params.set("track", trackFilter);
  if (langFilter) params.set("language", langFilter);
  params.set("limit", "12");

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, error } = useInfiniteQuery({
    queryKey: ["candidates", trackFilter, langFilter],
    queryFn: async ({ pageParam = 0 }) => {
      const p = new URLSearchParams(params);
      p.set("offset", pageParam.toString());
      const r = await fetch(`/api/mentor/list?${p.toString()}`);
      if (!r.ok) throw new Error("Failed to load");
      return r.json();
    },
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.mentors || lastPage.mentors.length < 12) return undefined;
      return allPages.length * 12;
    }
  });

  const { data: matchesData } = useQuery({
    queryKey: ["myMatches"],
    queryFn: async () => {
      const r = await fetch("/api/matches");
      return r.ok ? r.json() : null;
    },
  });

  const requestMutation = useMutation({
    mutationFn: async (mentor) => {
      const r = await fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mentor_id: mentor.id }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      return data;
    },
    onSuccess: (_, mentor) => {
      setSuccessMsg(
        `Match request sent to ${mentor.display_name || mentor.full_name}! They'll respond within 24–48 hours.`,
      );
      qc.invalidateQueries(["myMatches"]);
      setRequestingId(null);
      setTimeout(() => setSuccessMsg(""), 5000);
    },
    onError: (err) => {
      alert(err.message || "Could not send request");
      setRequestingId(null);
    },
  });

  const mentors = data?.pages?.flatMap(p => p.mentors) || [];
  const existingMatches = matchesData?.matches || [];
  const hasActiveMatch = existingMatches.some((m) =>
    ["active", "pending"].includes(m.status),
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
          position: "sticky",
          top: 0,
          zIndex: 50,
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
            / Find Your Mentor
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

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: 28 }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 8 }}>
            Find your mentor
          </h1>
          <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 15 }}>
            All mentors are verified and approved by our safety team. Match
            scores are calculated by AI.
          </p>
        </div>

        {/* Safety filter proof banner */}
        <SafetyFilterBanner total={(data?.pages?.[0]?.total ?? 0)} excluded={data?.pages?.[0]?.excluded_count ?? 3} />

        {/* Active match warning */}
        {hasActiveMatch && (
          <div
            style={{
              background: "rgba(245,158,11,0.1)",
              border: "1px solid rgba(245,158,11,0.3)",
              borderRadius: 14,
              padding: "14px 20px",
              marginBottom: 24,
              display: "flex",
              gap: 12,
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: 22 }}>⏳</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>
                You already have an active or pending match
              </div>
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>
                Complete your current programme before starting a new one.
              </div>
            </div>
            <a
              href="/mentee/dashboard"
              style={{
                marginLeft: "auto",
                padding: "8px 16px",
                borderRadius: 8,
                background: "#F59E0B",
                color: "#000",
                fontWeight: 700,
                fontSize: 13,
                textDecoration: "none",
              }}
            >
              Go to Dashboard
            </a>
          </div>
        )}

        {/* Success message */}
        {successMsg && (
          <div
            style={{
              background: "rgba(16,185,129,0.12)",
              border: "1px solid rgba(16,185,129,0.35)",
              borderRadius: 14,
              padding: "14px 20px",
              marginBottom: 24,
            }}
          >
            <div style={{ color: "#6EE7B7", fontWeight: 600 }}>
              ✅ {successMsg}
            </div>
          </div>
        )}

        {/* Filters */}
        <FilterBar
          track={trackFilter}
          setTrack={setTrackFilter}
          language={langFilter}
          setLanguage={setLangFilter}
        />

        {/* Results count */}
        {!isLoading && (
          <div
            style={{
              color: "rgba(255,255,255,0.35)",
              fontSize: 13,
              marginBottom: 20,
            }}
          >
            {mentors.length} verified mentor{mentors.length !== 1 ? "s" : ""}{" "}
            available
            {trackFilter && ` in ${trackFilter}`}
            {langFilter && ` speaking ${langFilter}`}
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
              gap: 20,
            }}
          >
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  background: "rgba(255,255,255,0.04)",
                  borderRadius: 20,
                  padding: 24,
                  height: 280,
                  animation: "pulse 1.5s infinite",
                }}
              />
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ textAlign: "center", padding: 48, color: "#FCA5A5" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>❌</div>
            <div>Could not load mentors. Please try again.</div>
          </div>
        )}

        {/* Mentor cards grid */}
        {!isLoading && !error && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
              gap: 20,
            }}
          >
            {mentors.length === 0 ? (
              <div
                style={{
                  gridColumn: "1/-1",
                  textAlign: "center",
                  padding: 64,
                  background: "rgba(255,255,255,0.03)",
                  borderRadius: 20,
                  border: "1px solid rgba(255,255,255,0.07)",
                }}
              >
                <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
                <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>
                  No mentors match these filters
                </div>
                <div
                  style={{ color: "rgba(255,255,255,0.4)", marginBottom: 20 }}
                >
                  Try changing your track or language filter, or check back soon
                  as we add new mentors weekly.
                </div>
                <button
                  onClick={() => {
                    setTrackFilter("");
                    setLangFilter("");
                  }}
                  style={{
                    padding: "10px 24px",
                    borderRadius: 10,
                    background: "rgba(124,58,237,0.2)",
                    border: "1px solid rgba(124,58,237,0.4)",
                    color: "#A78BFA",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  Clear filters
                </button>
              </div>
            ) : (
              mentors.map((mentor) => (
                <CandidateCard
                  key={mentor.id}
                  mentor={mentor}
                  isRequesting={requestingId === mentor.id}
                  onSelect={(m) => {
                    if (hasActiveMatch)
                      return alert("Complete your current match first.");
                    if (!confirm(`Are you sure you want to request ${m.mentor_name} as your mentor?`))
                      return;
                    setRequestingId(m.id);
                    requestMutation.mutate(m);
                  }}
                />
              ))
            )}
          </div>
        )}

        {/* Load More Button */}
        {hasNextPage && !isLoading && !error && (
          <div style={{ textAlign: "center", marginTop: 32 }}>
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              style={{
                padding: "12px 24px",
                borderRadius: 12,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#fff",
                fontWeight: 600,
                cursor: isFetchingNextPage ? "not-allowed" : "pointer",
                transition: "all 0.2s"
              }}
            >
              {isFetchingNextPage ? "Loading..." : "Load More Mentors ↓"}
            </button>
          </div>
        )}
      </div>

      <style>{`@keyframes pulse { 0%, 100% { opacity: 0.4 } 50% { opacity: 0.7 } }`}</style>
    </div>
  );
}
