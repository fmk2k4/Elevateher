"use client";
import { useState, useEffect } from "react";

export default function GuardianConsentPage({ params }) {
  const token = params.token;
  const [status, setStatus] = useState("loading"); // loading, valid, consented, expired, error
  const [consentData, setConsentData] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function verify() {
      try {
        const res = await fetch(`/api/guardian-consent/verify?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (res.ok && data.valid) {
          setStatus("valid");
          setConsentData(data);
        } else if (res.status === 410 || data.reason === "expired") {
          setStatus("expired");
        } else {
          setStatus("error");
        }
      } catch (err) {
        setStatus("error");
      }
    }
    if (token) {
      verify();
    }
  }, [token]);

  const handleConsent = async (consented) => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/guardian-consent/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          decision: consented ? "consented" : "declined",
        }),
      });
      if (res.ok) {
        setStatus(consented ? "consented" : "declined");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
    setSubmitting(false);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0F0A1E 0%, #1A0F2E 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <div style={{ width: "100%", maxWidth: 520 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <span style={{ fontSize: 40 }}>🌟</span>
          <div
            style={{
              fontWeight: 900,
              fontSize: 22,
              background: "linear-gradient(135deg, #A78BFA, #EC4899)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              marginTop: 8,
            }}
          >
            ElevateHer
          </div>
          <div
            style={{
              color: "rgba(255,255,255,0.4)",
              fontSize: 14,
              marginTop: 4,
            }}
          >
            Guardian Consent Portal
          </div>
        </div>

        <div
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 20,
            padding: 36,
          }}
        >
          {status === "loading" && (
            <div
              style={{
                textAlign: "center",
                padding: 32,
                color: "rgba(255,255,255,0.5)",
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
              Verifying consent token…
            </div>
          )}

          {status === "valid" && consentData && (
            <>
              <div style={{ marginBottom: 24 }}>
                <div
                  style={{ fontSize: 24, fontWeight: 800, marginBottom: 12 }}
                >
                  Parental Consent Required 👨‍👩‍👧
                </div>
                <p
                  style={{
                    color: "rgba(255,255,255,0.6)",
                    fontSize: 14,
                    lineHeight: 1.8,
                  }}
                >
                  <strong style={{ color: "#fff" }}>
                    {consentData.mentee_name}
                  </strong>{" "}
                  has signed up for ElevateHer, a safe AI-powered career
                  mentorship platform for girls aged 14–22 in Southeast Asia.
                </p>
                <p
                  style={{
                    color: "rgba(255,255,255,0.6)",
                    fontSize: 14,
                    lineHeight: 1.8,
                    marginTop: 12,
                  }}
                >
                  Because they are under 18, we need your consent before their
                  account can be activated.
                </p>
              </div>

              {/* Platform features */}
              <div
                style={{
                  background: "rgba(124,58,237,0.08)",
                  border: "1px solid rgba(124,58,237,0.2)",
                  borderRadius: 12,
                  padding: 20,
                  marginBottom: 24,
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 12 }}>
                  What ElevateHer provides:
                </div>
                {[
                  "✅ AI-matched career mentors, verified and approved",
                  "✅ All conversations monitored by safety AI (SEA-Guard)",
                  "✅ Automatic suspension of any account showing unsafe patterns",
                  "✅ 24-hour human moderation review",
                  "✅ No sharing of personal contact details",
                  "✅ Structured 12-week programme with career milestones",
                ].map((item, i) => (
                  <div
                    key={i}
                    style={{
                      fontSize: 13,
                      color: "rgba(255,255,255,0.65)",
                      marginBottom: 6,
                    }}
                  >
                    {item}
                  </div>
                ))}
              </div>

              <div
                style={{
                  fontSize: 13,
                  color: "rgba(255,255,255,0.4)",
                  marginBottom: 24,
                }}
              >
                This consent link expires on{" "}
                {new Date(consentData.expires_at).toLocaleDateString("en-MY", {
                  dateStyle: "full",
                })}
                .
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <button
                  onClick={() => handleConsent(false)}
                  disabled={submitting}
                  style={{
                    flex: 1,
                    padding: "14px",
                    borderRadius: 12,
                    fontSize: 15,
                    fontWeight: 700,
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "rgba(255,255,255,0.7)",
                    cursor: "pointer",
                  }}
                >
                  ✗ Decline
                </button>
                <button
                  onClick={() => handleConsent(true)}
                  disabled={submitting}
                  style={{
                    flex: 2,
                    padding: "14px",
                    borderRadius: 12,
                    fontSize: 15,
                    fontWeight: 700,
                    background: "linear-gradient(135deg, #7C3AED, #EC4899)",
                    color: "#fff",
                    border: "none",
                    cursor: "pointer",
                    opacity: submitting ? 0.7 : 1,
                  }}
                >
                  {submitting
                    ? "Processing…"
                    : "✓ I Consent — Activate Account"}
                </button>
              </div>

              <p
                style={{
                  fontSize: 12,
                  color: "rgba(255,255,255,0.3)",
                  textAlign: "center",
                  marginTop: 16,
                  lineHeight: 1.6,
                }}
              >
                By clicking "I Consent", you confirm that you are the legal
                guardian of the applicant and agree to their participation in
                ElevateHer's mentorship programme in accordance with our{" "}
                <a href="#" style={{ color: "#A78BFA" }}>
                  Safety Policy
                </a>{" "}
                and{" "}
                <a href="#" style={{ color: "#A78BFA" }}>
                  Privacy Notice
                </a>
                .
              </p>
            </>
          )}

          {status === "consented" && (
            <div style={{ textAlign: "center", padding: 24 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
              <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>
                Thank you!
              </h2>
              <p style={{ color: "rgba(255,255,255,0.6)", lineHeight: 1.8 }}>
                You've consented to {consentData?.mentee_name}'s participation
                in ElevateHer. Their account is now active and they can begin
                their mentorship journey.
              </p>
              <p
                style={{
                  color: "rgba(255,255,255,0.4)",
                  fontSize: 13,
                  marginTop: 16,
                }}
              >
                You can revoke consent at any time by emailing
                safety@elevateher.app
              </p>
            </div>
          )}

          {status === "declined" && (
            <div style={{ textAlign: "center", padding: 24 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
              <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>
                Consent declined
              </h2>
              <p style={{ color: "rgba(255,255,255,0.6)", lineHeight: 1.8 }}>
                We've recorded that you've declined consent. The account will
                remain inactive. If you change your mind, please ask the
                applicant to re-register.
              </p>
            </div>
          )}

          {status === "expired" && (
            <div style={{ textAlign: "center", padding: 24 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>⏰</div>
              <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>
                Link expired
              </h2>
              <p style={{ color: "rgba(255,255,255,0.6)", lineHeight: 1.8 }}>
                This consent link has expired (links are valid for 72 hours).
                Please ask the applicant to log in and request a new consent
                email.
              </p>
            </div>
          )}

          {status === "error" && (
            <div style={{ textAlign: "center", padding: 24, color: "#FCA5A5" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
              <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>
                Something went wrong
              </h2>
              <p>Please try again or contact support@elevateher.app</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
