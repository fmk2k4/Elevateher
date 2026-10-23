import LandingNav from "@/components/LandingNav";
import LandingStats from "@/components/LandingStats";

const TRACKS = [
  { icon: "💻", label: "STEM", desc: "Tech, Engineering, Data Science" },
  {
    icon: "📊",
    label: "Business",
    desc: "Finance, Marketing, Entrepreneurship",
  },
  { icon: "🔧", label: "Trades", desc: "Skilled trades and technical work" },
  { icon: "🎨", label: "Creative", desc: "Design, Media, Communications" },
  { icon: "🏥", label: "Healthcare", desc: "Medicine, Nursing, Allied Health" },
];

const SDG_CARDS = [
  {
    goal: "SDG 4.4",
    color: "#C41E3A",
    label: "Quality Education",
    desc: "Structured 12-week mentorship tracks with milestone-based learning and career skills.",
  },
  {
    goal: "SDG 5.5",
    color: "#E5243B",
    label: "Gender Equality",
    desc: "Verified female mentor network ensuring girls have safe, qualified role models.",
  },
  {
    goal: "SDG 8.6",
    color: "#A21942",
    label: "Decent Work",
    desc: "Career entry tracking, salary negotiation coaching, and youth employment outcomes.",
  },
];

const PARTNERS = [
  { name: "INTI University", country: "🇲🇾 Malaysia" },
  { name: "Nanyang Polytechnic", country: "🇸🇬 Singapore" },
  { name: "BINUS University", country: "🇮🇩 Indonesia" },
  { name: "Prince of Songkla Univ.", country: "🇹🇭 Thailand" },
  { name: "Kansai University", country: "🇯🇵 Japan" },
  { name: "Teesside University", country: "🇬🇧 United Kingdom" },
];

const HOW_STEPS = [
  {
    step: "01",
    icon: "📱",
    title: "Dial *384# or sign up online",
    desc: "Works on any phone — feature phone, smartphone, or the web. No data connection needed for USSD.",
  },
  {
    step: "02",
    icon: "🤖",
    title: "AI matches you to a mentor",
    desc: "SEA-LION AI finds your perfect mentor by career goals, language, and track — in seconds.",
  },
  {
    step: "03",
    icon: "🛡️",
    title: "Safe, structured sessions",
    desc: "Every message is scanned by SEA-Guard. All mentors verified. Guardian consent for under-18s.",
  },
  {
    step: "04",
    icon: "🏆",
    title: "Track your impact",
    desc: "Milestone certificates, SDG impact events, and career outcome reporting for your institution.",
  },
];

export default function LandingPage() {

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#0F0A1E",
        color: "#fff",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <LandingNav />

      {/* Hero */}
      <section
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(124,58,237,0.25) 0%, rgba(15,10,30,0) 70%)",
          paddingTop: 80,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Background orbs */}
        <div
          style={{
            position: "absolute",
            top: "15%",
            left: "5%",
            width: 400,
            height: 400,
            borderRadius: "50%",
            background: "rgba(124,58,237,0.08)",
            filter: "blur(80px)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "10%",
            right: "5%",
            width: 300,
            height: 300,
            borderRadius: "50%",
            background: "rgba(236,72,153,0.08)",
            filter: "blur(80px)",
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: "0 24px",
            textAlign: "center",
            width: "100%",
          }}
        >
          {/* Badge */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "rgba(124,58,237,0.15)",
              border: "1px solid rgba(124,58,237,0.3)",
              borderRadius: 100,
              padding: "6px 16px",
              marginBottom: 32,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#7C3AED",
                display: "inline-block",
              }}
            />
            <span style={{ fontSize: 13, color: "#A78BFA", fontWeight: 500 }}>
              GoGlobal Innovators Challenge 2026 · Group 10
            </span>
          </div>

          <h1
            style={{
              fontSize: "clamp(36px, 6vw, 72px)",
              fontWeight: 900,
              lineHeight: 1.1,
              marginBottom: 24,
              letterSpacing: "-0.02em",
            }}
          >
            Safe AI career mentorship
            <br />
            <span
              style={{
                background: "linear-gradient(135deg, #A78BFA 0%, #EC4899 100%)",
                backgroundClip: "text",
                color: "transparent",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              for every girl — even offline
            </span>
          </h1>

          <p
            style={{
              fontSize: "clamp(16px, 2vw, 20px)",
              color: "rgba(255,255,255,0.6)",
              maxWidth: 640,
              margin: "0 auto 40px",
              lineHeight: 1.7,
            }}
          >
            ElevateHer connects girls aged 14–22 in Southeast Asia with verified
            career mentors via SMS and USSD. No smartphone. No internet. No
            barriers.
          </p>

          <div
            style={{
              display: "flex",
              gap: 16,
              justifyContent: "center",
              flexWrap: "wrap",
              marginBottom: 64,
            }}
          >
            <a
              href="/account/signup"
              style={{
                padding: "14px 32px",
                borderRadius: 12,
                fontSize: 16,
                fontWeight: 700,
                background: "linear-gradient(135deg, #7C3AED, #EC4899)",
                color: "#fff",
                textDecoration: "none",
                boxShadow: "0 0 40px rgba(124,58,237,0.4)",
              }}
            >
              Get Started Free →
            </a>
            <a
              href="#how-it-works"
              style={{
                padding: "14px 32px",
                borderRadius: 12,
                fontSize: 16,
                fontWeight: 600,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#fff",
                textDecoration: "none",
              }}
            >
              How It Works
            </a>
            <a
              href="/ussd-simulator"
              style={{
                padding: "14px 32px",
                borderRadius: 12,
                fontSize: 16,
                fontWeight: 600,
                background: "rgba(124,58,237,0.15)",
                border: "1px solid rgba(124,58,237,0.3)",
                color: "#A78BFA",
                textDecoration: "none",
              }}
            >
              Try USSD Simulator
            </a>
            <a
              href="/safety"
              style={{
                padding: "14px 32px",
                borderRadius: 12,
                fontSize: 16,
                fontWeight: 600,
                background: "rgba(236,72,153,0.15)",
                border: "1px solid rgba(236,72,153,0.3)",
                color: "#F472B6",
                textDecoration: "none",
              }}
            >
              Safety Features
            </a>
          </div>

          {/* Demo Credentials */}
          <div
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12,
              padding: 16,
              maxWidth: 500,
              margin: "0 auto 64px",
              textAlign: "left",
              fontSize: 14,
            }}
          >
            <div style={{ fontWeight: 600, color: "#A78BFA", marginBottom: 8, textAlign: "center" }}>
              Demo Accounts
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, color: "rgba(255,255,255,0.8)" }}>
              <div>
                <strong style={{ color: "#fff" }}>Mentee:</strong><br />
                mentee@example.com<br />
                password123
              </div>
              <div>
                <strong style={{ color: "#fff" }}>Mentor:</strong><br />
                mentor@example.com<br />
                password123
              </div>
            </div>
          </div>

          <LandingStats />
        </div>
      </section>

      {/* How It Works */}
      <section
        id="how-it-works"
        style={{ padding: "100px 24px", maxWidth: 1200, margin: "0 auto" }}
      >
        <div style={{ textAlign: "center", marginBottom: 64 }}>
          <span
            style={{
              fontSize: 13,
              color: "#A78BFA",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            How It Works
          </span>
          <h2
            style={{
              fontSize: "clamp(28px, 4vw, 48px)",
              fontWeight: 800,
              marginTop: 12,
              marginBottom: 0,
            }}
          >
            From zero to mentored in 4 steps
          </h2>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 24,
          }}
        >
          {HOW_STEPS.map((s) => (
            <div
              key={s.step}
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 16,
                padding: 28,
                position: "relative",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: "rgba(167,139,250,0.5)",
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  marginBottom: 16,
                }}
              >
                STEP {s.step}
              </div>
              <div style={{ fontSize: 36, marginBottom: 16 }}>{s.icon}</div>
              <h3
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  marginBottom: 12,
                  lineHeight: 1.3,
                }}
              >
                {s.title}
              </h3>
              <p
                style={{
                  fontSize: 14,
                  color: "rgba(255,255,255,0.55)",
                  lineHeight: 1.7,
                  margin: 0,
                }}
              >
                {s.desc}
              </p>
            </div>
          ))}
        </div>

        {/* USSD demo box */}
        <div
          style={{
            marginTop: 64,
            background: "rgba(124,58,237,0.08)",
            border: "1px solid rgba(124,58,237,0.2)",
            borderRadius: 20,
            padding: 40,
            display: "flex",
            gap: 40,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div style={{ flex: 1, minWidth: 280 }}>
            <div
              style={{
                fontSize: 13,
                color: "#A78BFA",
                fontWeight: 600,
                marginBottom: 12,
              }}
            >
              USSD DEMO · *384#
            </div>
            <div
              style={{
                background: "#000",
                borderRadius: 12,
                padding: 20,
                fontFamily: "monospace",
                fontSize: 13,
                color: "#00FF41",
                lineHeight: 2,
              }}
            >
              <div>Welcome to ElevateHer 🌟</div>
              <div>1. I'm new here</div>
              <div>2. Returning user</div>
              <div>3. Mentor portal</div>
              <div style={{ color: "rgba(0,255,65,0.5)", marginTop: 8 }}>
                User enters: 1
              </div>
              <div style={{ marginTop: 8 }}>Choose language:</div>
              <div>1. English</div>
              <div>2. Bahasa Melayu</div>
              <div>3. Bahasa Indonesia</div>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 280 }}>
            <h3 style={{ fontSize: 22, fontWeight: 800, marginBottom: 16 }}>
              Works on any phone
            </h3>
            <p
              style={{
                color: "rgba(255,255,255,0.6)",
                lineHeight: 1.8,
                marginBottom: 20,
              }}
            >
              USSD (*384#) works without internet or a smartphone. SMS fallback
              available. Supports 5 languages: English, Bahasa Melayu, Bahasa
              Indonesia, Thai, and Japanese.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[
                "🇲🇾 Malay",
                "🇮🇩 Indonesian",
                "🇹🇭 Thai",
                "🇸🇬 English",
                "🇯🇵 Japanese",
              ].map((l) => (
                <span
                  key={l}
                  style={{
                    padding: "4px 12px",
                    borderRadius: 100,
                    background: "rgba(167,139,250,0.1)",
                    border: "1px solid rgba(167,139,250,0.2)",
                    fontSize: 13,
                    color: "#A78BFA",
                  }}
                >
                  {l}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Tracks */}
      <section
        style={{ padding: "80px 24px", background: "rgba(255,255,255,0.02)" }}
      >
        <div style={{ maxWidth: 1200, margin: "0 auto", textAlign: "center" }}>
          <span
            style={{
              fontSize: 13,
              color: "#A78BFA",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            Career Tracks
          </span>
          <h2
            style={{
              fontSize: "clamp(28px, 4vw, 44px)",
              fontWeight: 800,
              marginTop: 12,
              marginBottom: 48,
            }}
          >
            Choose your path
          </h2>
          <div
            style={{
              display: "flex",
              gap: 16,
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            {TRACKS.map((t) => (
              <div
                key={t.label}
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 16,
                  padding: "24px 28px",
                  textAlign: "center",
                  minWidth: 160,
                  transition: "all 0.2s",
                  cursor: "default",
                }}
              >
                <div style={{ fontSize: 36, marginBottom: 12 }}>{t.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>
                  {t.label}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "rgba(255,255,255,0.45)",
                    lineHeight: 1.5,
                  }}
                >
                  {t.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SDG */}
      <section
        id="sdg"
        style={{ padding: "100px 24px", maxWidth: 1200, margin: "0 auto" }}
      >
        <div style={{ textAlign: "center", marginBottom: 64 }}>
          <span
            style={{
              fontSize: 13,
              color: "#A78BFA",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            UN SDG Alignment
          </span>
          <h2
            style={{
              fontSize: "clamp(28px, 4vw, 48px)",
              fontWeight: 800,
              marginTop: 12,
            }}
          >
            Designed around global goals
          </h2>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 24,
          }}
        >
          {SDG_CARDS.map((sdg) => (
            <div
              key={sdg.goal}
              style={{
                borderRadius: 16,
                overflow: "hidden",
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.03)",
              }}
            >
              <div style={{ background: sdg.color, padding: "20px 24px" }}>
                <div style={{ fontWeight: 900, fontSize: 22 }}>{sdg.goal}</div>
                <div style={{ fontWeight: 600, fontSize: 15, opacity: 0.9 }}>
                  {sdg.label}
                </div>
              </div>
              <div style={{ padding: "20px 24px" }}>
                <p
                  style={{
                    fontSize: 14,
                    color: "rgba(255,255,255,0.6)",
                    lineHeight: 1.7,
                    margin: 0,
                  }}
                >
                  {sdg.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Safety */}
      <section
        style={{
          padding: "80px 24px",
          background: "rgba(124,58,237,0.05)",
          borderTop: "1px solid rgba(124,58,237,0.15)",
          borderBottom: "1px solid rgba(124,58,237,0.15)",
        }}
      >
        <div style={{ maxWidth: 900, margin: "0 auto", textAlign: "center" }}>
          <span style={{ fontSize: 36 }}>🛡️</span>
          <h2
            style={{
              fontSize: "clamp(24px, 4vw, 40px)",
              fontWeight: 800,
              marginTop: 16,
              marginBottom: 20,
            }}
          >
            Child safety is non-negotiable
          </h2>
          <p
            style={{
              fontSize: 16,
              color: "rgba(255,255,255,0.6)",
              lineHeight: 1.8,
              maxWidth: 600,
              margin: "0 auto 40px",
            }}
          >
            ElevateHer serves users as young as 14. Every architectural decision
            is made with their safety first.
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 16,
              maxWidth: 800,
              margin: "0 auto",
            }}
          >
            {[
              { icon: "👨‍👩‍👧", label: "Guardian consent for under-18s" },
              { icon: "🤖", label: "SEA-Guard NLP content scanning" },
              { icon: "⚡", label: "Auto-suspension on critical flags" },
              { icon: "👁️", label: "Temporal grooming detection" },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  background: "rgba(255,255,255,0.04)",
                  borderRadius: 12,
                  padding: "20px 16px",
                  border: "1px solid rgba(255,255,255,0.07)",
                }}
              >
                <div style={{ fontSize: 28, marginBottom: 10 }}>
                  {item.icon}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.8)",
                    lineHeight: 1.4,
                  }}
                >
                  {item.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Partners */}
      <section
        id="partners"
        style={{ padding: "100px 24px", maxWidth: 1200, margin: "0 auto" }}
      >
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <span
            style={{
              fontSize: 13,
              color: "#A78BFA",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            GoGlobal Partners
          </span>
          <h2
            style={{
              fontSize: "clamp(24px, 4vw, 40px)",
              fontWeight: 800,
              marginTop: 12,
            }}
          >
            Built with partner institutions
          </h2>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 16,
          }}
        >
          {PARTNERS.map((p) => (
            <div
              key={p.name}
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 12,
                padding: "20px 16px",
                textAlign: "center",
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>
                {p.name}
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
                {p.country}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section
        style={{
          padding: "100px 24px",
          textAlign: "center",
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(124,58,237,0.2) 0%, transparent 70%)",
        }}
      >
        <h2
          style={{
            fontSize: "clamp(32px, 5vw, 60px)",
            fontWeight: 900,
            marginBottom: 24,
            lineHeight: 1.1,
          }}
        >
          Ready to elevate
          <br />
          <span
            style={{
              background: "linear-gradient(135deg, #A78BFA, #EC4899)",
              backgroundClip: "text",
              color: "transparent",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            the next generation?
          </span>
        </h2>
        <p
          style={{
            fontSize: 18,
            color: "rgba(255,255,255,0.6)",
            marginBottom: 40,
            maxWidth: 500,
            margin: "0 auto 40px",
          }}
        >
          Join as a mentee, become a mentor, or partner with your institution.
        </p>
        <div
          style={{
            display: "flex",
            gap: 16,
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <a
            href="/account/signup?role=mentee"
            style={{
              padding: "16px 36px",
              borderRadius: 12,
              fontSize: 16,
              fontWeight: 700,
              background: "linear-gradient(135deg, #7C3AED, #EC4899)",
              color: "#fff",
              textDecoration: "none",
              boxShadow: "0 0 50px rgba(124,58,237,0.4)",
            }}
          >
            Join as Mentee
          </a>
          <a
            href="/account/signup?role=mentor"
            style={{
              padding: "16px 36px",
              borderRadius: 12,
              fontSize: 16,
              fontWeight: 600,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.15)",
              color: "#fff",
              textDecoration: "none",
            }}
          >
            Become a Mentor
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          padding: "40px 24px",
          borderTop: "1px solid rgba(255,255,255,0.07)",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 20, marginBottom: 8 }}>🌟 ElevateHer</div>
        <div
          style={{
            fontSize: 13,
            color: "rgba(255,255,255,0.35)",
            marginBottom: 8,
          }}
        >
          GoGlobal Innovators Challenge 2026 · Group 10 · SDG 4 · SDG 5 · SDG 8
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.25)" }}>
          MIT Licence · hello@elevateher.app
        </div>
      </footer>

      <style>{`
        .nav-link { display: inline !important; }
        .mobile-menu-btn { display: none; }
        @media (max-width: 640px) {
          .nav-link, .desktop-auth-links { display: none !important; }
          .mobile-menu-btn { display: flex !important; align-items: center; justify-content: center; }
        }
        a { transition: opacity 0.2s; }
        a:hover { opacity: 0.85; }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
