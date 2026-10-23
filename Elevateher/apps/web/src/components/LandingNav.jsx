"use client";
import { useState, useEffect } from "react";

const NAV_LINKS = [
  { label: "How It Works", href: "#how-it-works" },
  { label: "SDG Impact", href: "#sdg" },
  { label: "Partners", href: "#partners" },
];

export default function LandingNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <nav
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          background: scrolled ? "rgba(15,10,30,0.95)" : "transparent",
          backdropFilter: scrolled ? "blur(12px)" : "none",
          borderBottom: scrolled ? "1px solid rgba(124,58,237,0.2)" : "none",
          transition: "all 0.3s ease",
          padding: "0 24px",
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: 110,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img src="/logo_new.svg" alt="ElevateHer Logo" style={{ height: 90 }} />
          </div>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="mobile-menu-btn"
            style={{
              background: "transparent",
              border: "none",
              color: "#fff",
              fontSize: 24,
              width: 40,
              height: 40,
              cursor: "pointer",
              display: "none", // Will be shown by CSS on mobile
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ☰
          </button>
          <div className="desktop-auth-links" style={{ display: "flex", alignItems: "center", gap: 32 }}>
            {NAV_LINKS.map((l) => (
              <a
                key={l.label}
                href={l.href}
                style={{
                  color: "rgba(255,255,255,0.7)",
                  textDecoration: "none",
                  fontSize: 14,
                  fontWeight: 500,
                }}
                className="nav-link"
              >
                {l.label}
              </a>
            ))}
            <a
              href="/account/signin"
              style={{
                padding: "8px 20px",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                background: "transparent",
                border: "1px solid rgba(167,139,250,0.4)",
                color: "#A78BFA",
                textDecoration: "none",
                transition: "all 0.2s",
              }}
            >
              Sign In
            </a>
            <a
              href="/account/signup"
              style={{
                padding: "8px 20px",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                background: "linear-gradient(135deg, #7C3AED, #EC4899)",
                color: "#fff",
                textDecoration: "none",
              }}
            >
              Join Free
            </a>
          </div>
        </div>
      </nav>

      {menuOpen && (
        <>
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 99,
              background: "rgba(0,0,0,0.6)",
              backdropFilter: "blur(4px)",
            }}
            onClick={() => setMenuOpen(false)}
          />
          <div
            style={{
              position: "fixed",
              top: 64,
              left: 0,
              right: 0,
              zIndex: 100,
              background: "rgba(15,10,30,0.98)",
              backdropFilter: "blur(12px)",
              borderBottom: "1px solid rgba(124,58,237,0.2)",
              padding: "16px 24px",
              display: "flex",
              flexDirection: "column",
              gap: 12,
              animation: "slideDown 0.3s ease",
            }}
          >
            {NAV_LINKS.map((l) => (
              <a
                key={l.label}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                style={{
                  color: "rgba(255,255,255,0.8)",
                  textDecoration: "none",
                  fontSize: 16,
                  fontWeight: 500,
                  padding: "10px 0",
                }}
              >
                {l.label}
              </a>
            ))}
            <a
              href="/account/signin"
              onClick={() => setMenuOpen(false)}
              style={{
                padding: "10px 20px",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                background: "transparent",
                border: "1px solid rgba(167,139,250,0.4)",
                color: "#A78BFA",
                textDecoration: "none",
                textAlign: "center",
              }}
            >
              Sign In
            </a>
            <a
              href="/account/signup"
              onClick={() => setMenuOpen(false)}
              style={{
                padding: "10px 20px",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                background: "linear-gradient(135deg, #7C3AED, #EC4899)",
                color: "#fff",
                textDecoration: "none",
                textAlign: "center",
              }}
            >
              Join Free
            </a>
          </div>
        </>
      )}
    </>
  );
}
