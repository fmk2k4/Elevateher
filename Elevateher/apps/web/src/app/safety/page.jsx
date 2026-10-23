"use client";

const SAFETY_FEATURES = [
  {
    icon: "👨‍👩‍👧",
    title: "Guardian Consent for Under-18s",
    desc: "Every user under 18 requires explicit written consent from a parent or guardian before their account is activated. Consent can be revoked at any time via email.",
    sdg: "SDG 5.5",
  },
  {
    icon: "🤖",
    title: "SEA-Guard AI Content Scanning",
    desc: "Every mentor bio and every in-session message is automatically scanned by our SEA-Guard AI safety model — trained on Southeast Asian language patterns including Malay, Indonesian, Thai, and English code-switching.",
    sdg: "SDG 4.4",
  },
  {
    icon: "⚡",
    title: "Automatic Suspension on Critical Flags",
    desc: "If our AI detects critical safety patterns (off-platform solicitation, isolation language, inappropriate intimacy), the offending account is automatically suspended within seconds — before human review.",
    sdg: "SDG 5.5",
  },
  {
    icon: "👁️",
    title: "Temporal Grooming Detection",
    desc: "We don't just scan individual messages. Our temporal detector analyses conversation patterns over time, flagging gradual grooming behaviours referenced in 2025 peer-reviewed research (Street et al., TechRxiv).",
    sdg: "SDG 5.5",
  },
  {
    icon: "🔍",
    title: "Mentor Verification (3-Layer)",
    desc: "Every mentor completes: (1) Government ID verification, (2) Employment document verification, (3) Admin review of their application bio. Unverified mentors cannot contact mentees.",
    sdg: "SDG 4.4",
  },
  {
    icon: "🚨",
    title: "One-Tap Safety Reporting",
    desc: "Any mentee or mentor can report a safety concern directly from any session page. Reports are reviewed by a human moderator within 24 hours. Critical reports escalate immediately.",
    sdg: "SDG 5.5",
  },
  {
    icon: "🔒",
    title: "No Personal Contact Sharing",
    desc: "Our platform explicitly blocks phone numbers, email addresses, WhatsApp handles, and social media usernames from being shared in-session. All detected attempts are flagged.",
    sdg: "SDG 5.5",
  },
  {
    icon: "📋",
    title: "Code of Conduct (Mandatory)",
    desc: "All mentors must sign our Code of Conduct before being activated. This includes explicit acknowledgement of child safeguarding obligations and consequences of violations.",
    sdg: "SDG 4.4",
  },
];

const RESEARCH = [
  {
    title: "A Parent in the Room",
    authors: "Street et al.",
    journal: "TechRxiv",
    year: 2025,
    desc: "Peer-reviewed grooming detection research that informs our temporal safety model.",
  },
  {
    title: "Mental Health Interventions in Digital Platforms",
    authors: "Leiva-Bianchi et al.",
    journal: "Scientific Reports",
    year: 2025,
    desc: "Safety-by-design principles applied to our session moderation architecture.",
  },
  {
    title: "Manglish NLP Dataset",
    authors: "Maskat et al.",
    journal: "UiTM Malaysia",
    year: 2024,
    desc: "Enables our safety model to detect grooming language in Malaysian English code-switching.",
  },
];

export default function SafetyPage() {
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
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 64,
        }}
      >
        <a
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            textDecoration: "none",
          }}
        >
          <span style={{ fontSize: 24 }}>🌟</span>
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
        </a>
        <div style={{ display: "flex", gap: 12 }}>
          <a
            href="/account/signin"
            style={{
              padding: "6px 16px",
              borderRadius: 8,
              border: "1px solid rgba(167,139,250,0.4)",
              color: "#A78BFA",
              textDecoration: "none",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Sign In
          </a>
          <a
            href="/account/signup"
            style={{
              padding: "6px 16px",
              borderRadius: 8,
              background: "linear-gradient(135deg, #7C3AED, #EC4899)",
              color: "#fff",
              textDecoration: "none",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Join Free
          </a>
        </div>
      </nav>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "60px 24px" }}>
        {/* Hero */}
        <div style={{ textAlign: "center", marginBottom: 64 }}>
          <div style={{ fontSize: 64, marginBottom: 20 }}>🛡️</div>
          <h1
            style={{
              fontSize: "clamp(32px, 5vw, 56px)",
              fontWeight: 900,
              marginBottom: 20,
              lineHeight: 1.1,
            }}
          >
            Safety is not a feature —<br />
            <span
              style={{
                background: "linear-gradient(135deg, #A78BFA, #EC4899)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              it's the foundation
            </span>
          </h1>
          <p
            style={{
              fontSize: 18,
              color: "rgba(255,255,255,0.6)",
              maxWidth: 600,
              margin: "0 auto",
              lineHeight: 1.8,
            }}
          >
            ElevateHer serves girls as young as 14. Every architectural decision
            — from how we store data to how we moderate conversations — is made
            with their safety as the primary constraint.
          </p>
        </div>

        {/* Safety features grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))",
            gap: 20,
            marginBottom: 64,
          }}
        >
          {SAFETY_FEATURES.map((f) => (
            <div
              key={f.title}
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 16,
                padding: 24,
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: 14,
                  alignItems: "flex-start",
                  marginBottom: 12,
                }}
              >
                <div style={{ fontSize: 36 }}>{f.icon}</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{f.title}</div>
                  <span
                    style={{
                      display: "inline-block",
                      marginTop: 4,
                      padding: "2px 8px",
                      borderRadius: 100,
                      fontSize: 11,
                      fontWeight: 700,
                      background: "rgba(196,30,58,0.2)",
                      color: "#F87171",
                      border: "1px solid rgba(196,30,58,0.3)",
                    }}
                  >
                    {f.sdg}
                  </span>
                </div>
              </div>
              <p
                style={{
                  fontSize: 14,
                  color: "rgba(255,255,255,0.6)",
                  lineHeight: 1.7,
                  margin: 0,
                }}
              >
                {f.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Research-backed */}
        <div style={{ marginBottom: 64 }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>
            Research-backed safety
          </h2>
          <p style={{ color: "rgba(255,255,255,0.5)", marginBottom: 28 }}>
            Our safety architecture is grounded in 2024–2025 peer-reviewed
            research.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {RESEARCH.map((r) => (
              <div
                key={r.title}
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 12,
                  padding: 20,
                  display: "flex",
                  gap: 16,
                }}
              >
                <div
                  style={{
                    width: 4,
                    borderRadius: 2,
                    background: "linear-gradient(to bottom, #7C3AED, #EC4899)",
                    flexShrink: 0,
                  }}
                />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{r.title}</div>
                  <div
                    style={{
                      color: "rgba(255,255,255,0.45)",
                      fontSize: 13,
                      marginTop: 2,
                    }}
                  >
                    {r.authors} · {r.journal} · {r.year}
                  </div>
                  <div
                    style={{
                      color: "rgba(255,255,255,0.6)",
                      fontSize: 13,
                      marginTop: 8,
                      lineHeight: 1.6,
                    }}
                  >
                    {r.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Reporting */}
        <div
          style={{
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.25)",
            borderRadius: 20,
            padding: 36,
            textAlign: "center",
            marginBottom: 48,
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 16 }}>🚨</div>
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>
            Report a safety concern
          </h2>
          <p
            style={{
              color: "rgba(255,255,255,0.6)",
              lineHeight: 1.8,
              maxWidth: 520,
              margin: "0 auto 24px",
            }}
          >
            If you experience or witness unsafe behaviour on ElevateHer, please
            report immediately. Our team reviews all reports within 24 hours.
            Critical reports are escalated immediately.
          </p>
          <div
            style={{
              display: "flex",
              gap: 12,
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <a
              href="mailto:safety@elevateher.app"
              style={{
                padding: "12px 24px",
                borderRadius: 12,
                background: "#EF4444",
                color: "#fff",
                fontWeight: 700,
                textDecoration: "none",
                fontSize: 14,
              }}
            >
              📧 safety@elevateher.app
            </a>
            <a
              href="/account/signin"
              style={{
                padding: "12px 24px",
                borderRadius: 12,
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.15)",
                color: "#fff",
                fontWeight: 600,
                textDecoration: "none",
                fontSize: 14,
              }}
            >
              Report in-app →
            </a>
          </div>
        </div>

        {/* Guardian section */}
        <div
          style={{
            background: "rgba(124,58,237,0.08)",
            border: "1px solid rgba(124,58,237,0.2)",
            borderRadius: 20,
            padding: 36,
          }}
        >
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>
            For parents & guardians
          </h2>
          <p
            style={{
              color: "rgba(255,255,255,0.6)",
              lineHeight: 1.8,
              marginBottom: 20,
            }}
          >
            ElevateHer requires explicit written consent from a parent or
            guardian for all users under 18. When a minor registers, we email
            their guardian a consent link before activating the account.
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 16,
            }}
          >
            {[
              {
                q: "Can I revoke consent?",
                a: "Yes. Email safety@elevateher.app at any time.",
              },
              {
                q: "Can I see messages?",
                a: "By request. Email us and we'll provide a transcript review.",
              },
              {
                q: "Who are the mentors?",
                a: "Verified professionals with ID + employment checks. All bios are AI-screened.",
              },
            ].map((item) => (
              <div
                key={item.q}
                style={{
                  background: "rgba(255,255,255,0.04)",
                  borderRadius: 12,
                  padding: 16,
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 14 }}>
                  {item.q}
                </div>
                <div
                  style={{
                    color: "rgba(255,255,255,0.55)",
                    fontSize: 13,
                    lineHeight: 1.6,
                  }}
                >
                  {item.a}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            marginTop: 64,
            textAlign: "center",
            borderTop: "1px solid rgba(255,255,255,0.07)",
            paddingTop: 40,
          }}
        >
          <a
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              textDecoration: "none",
            }}
          >
            <span style={{ fontSize: 22 }}>🌟</span>
            <span
              style={{
                fontWeight: 800,
                background: "linear-gradient(135deg, #A78BFA, #EC4899)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              ElevateHer
            </span>
          </a>
          <div
            style={{
              color: "rgba(255,255,255,0.3)",
              fontSize: 13,
              marginTop: 12,
            }}
          >
            GoGlobal Innovators Challenge 2026 · MIT Licence ·
            safety@elevateher.app
          </div>
        </div>
      </div>
    </div>
  );
}
