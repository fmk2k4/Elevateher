"use client";
import { useState, useEffect } from "react";
import useAuth from "@/utils/useAuth";

export default function SignUpPage() {
  const [step, setStep] = useState(1); // 1=role select, 2=credentials
  const [role, setRole] = useState("mentee");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const { signUpWithCredentials } = useAuth();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const r = params.get("role");
      if (r === "mentor" || r === "mentee") {
        setRole(r);
        setStep(2);
      }
    }
  }, []);

  const ROLES = [
    {
      id: "mentee",
      icon: "🎓",
      title: "I'm a Mentee",
      desc: "I'm a girl aged 14–22 looking for career mentorship and guidance.",
      color: "#7C3AED",
    },
    {
      id: "mentor",
      icon: "⭐",
      title: "I'm a Mentor",
      desc: "I'm a professional who wants to support the next generation of women leaders.",
      color: "#EC4899",
    },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    if (!email || !password || !name) {
      setError("Please fill in all fields");
      setLoading(false);
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      setLoading(false);
      return;
    }
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem("pendingRole", role);
      }
      const res = await signUpWithCredentials({
        email,
        password,
        name,
        role,
        callbackUrl: `/onboarding/${role}`,
        redirect: false,
      });

      if (res?.error) {
        const msgs = {
          CredentialsSignin: "This email is already registered. Try signing in.",
          Configuration: "Sign-up isn't working right now. Please try again later.",
        };
        setError(msgs[res.error] || "Something went wrong. Please try again.");
        setLoading(false);
      } else if (res?.ok) {
        window.location.href = res?.url || `/onboarding/${role}`;
      } else {
        setError("Something went wrong. Please try again.");
        setLoading(false);
      }
    } catch (err) {
      setError("An unexpected error occurred.");
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #0F0A1E 0%, #1A0F2E 100%)",
        padding: 24,
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <div style={{ width: "100%", maxWidth: step === 1 ? 600 : 440 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <a href="/" style={{ textDecoration: "none", display: "inline-block" }}>
            <img src="/logo_new.svg" alt="ElevateHer Logo" style={{ height: 80 }} />
          </a>
        </div>

        {step === 1 ? (
          <div>
            <h1
              style={{
                color: "#fff",
                fontSize: 26,
                fontWeight: 800,
                textAlign: "center",
                marginBottom: 8,
              }}
            >
              Who are you joining as?
            </h1>
            <p
              style={{
                color: "rgba(255,255,255,0.45)",
                fontSize: 14,
                textAlign: "center",
                marginBottom: 32,
              }}
            >
              Choose your role to get started
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
              }}
            >
              {ROLES.map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    setRole(r.id);
                    setStep(2);
                  }}
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: `2px solid ${role === r.id ? r.color : "rgba(255,255,255,0.08)"}`,
                    borderRadius: 16,
                    padding: "28px 20px",
                    textAlign: "center",
                    cursor: "pointer",
                    color: "#fff",
                    transition: "all 0.2s",
                  }}
                >
                  <div style={{ fontSize: 40, marginBottom: 12 }}>{r.icon}</div>
                  <div
                    style={{ fontWeight: 700, fontSize: 17, marginBottom: 10 }}
                  >
                    {r.title}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: "rgba(255,255,255,0.55)",
                      lineHeight: 1.6,
                    }}
                  >
                    {r.desc}
                  </div>
                </button>
              ))}
            </div>
            <p
              style={{
                textAlign: "center",
                marginTop: 24,
                color: "rgba(255,255,255,0.45)",
                fontSize: 14,
              }}
            >
              Already have an account?{" "}
              <a
                href="/account/signin"
                style={{
                  color: "#A78BFA",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                Sign in
              </a>
            </p>
          </div>
        ) : (
          <div
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 20,
              padding: 40,
            }}
          >
            {/* Role badge */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 24,
              }}
            >
              <button
                onClick={() => setStep(1)}
                style={{
                  background: "none",
                  border: "none",
                  color: "rgba(255,255,255,0.4)",
                  cursor: "pointer",
                  fontSize: 18,
                  padding: 0,
                }}
              >
                ←
              </button>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 12px",
                  borderRadius: 100,
                  background:
                    role === "mentor"
                      ? "rgba(236,72,153,0.15)"
                      : "rgba(124,58,237,0.15)",
                  border: `1px solid ${role === "mentor" ? "rgba(236,72,153,0.3)" : "rgba(124,58,237,0.3)"}`,
                  fontSize: 12,
                  fontWeight: 600,
                  color: role === "mentor" ? "#F9A8D4" : "#A78BFA",
                }}
              >
                {role === "mentor" ? "⭐ Mentor" : "🎓 Mentee"}
              </div>
            </div>

            <h1
              style={{
                color: "#fff",
                fontSize: 22,
                fontWeight: 800,
                marginBottom: 8,
              }}
            >
              Create your account
            </h1>
            <p
              style={{
                color: "rgba(255,255,255,0.45)",
                fontSize: 14,
                marginBottom: 28,
              }}
            >
              Free to join. No credit card needed.
            </p>

            <form onSubmit={handleSubmit}>
              {[
                {
                  label: "Full Name",
                  type: "text",
                  value: name,
                  onChange: setName,
                  placeholder: "Your full name",
                },
                {
                  label: "Email",
                  type: "email",
                  value: email,
                  onChange: setEmail,
                  placeholder: "you@example.com",
                },
                {
                  label: "Password",
                  type: "password",
                  value: password,
                  onChange: setPassword,
                  placeholder: "Min. 8 characters",
                },
              ].map((f) => (
                <div key={f.label} style={{ marginBottom: 18 }}>
                  <label
                    style={{
                      display: "block",
                      color: "rgba(255,255,255,0.7)",
                      fontSize: 13,
                      fontWeight: 600,
                      marginBottom: 8,
                    }}
                  >
                    {f.label}
                  </label>
                  <input
                    type={f.type}
                    value={f.value}
                    onChange={(e) => f.onChange(e.target.value)}
                    placeholder={f.placeholder}
                    required
                    style={{
                      width: "100%",
                      padding: "12px 16px",
                      borderRadius: 10,
                      fontSize: 15,
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      color: "#fff",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              ))}

              {error && (
                <div
                  style={{
                    background: "rgba(239,68,68,0.15)",
                    border: "1px solid rgba(239,68,68,0.3)",
                    borderRadius: 10,
                    padding: "12px 16px",
                    marginBottom: 20,
                    color: "#FCA5A5",
                    fontSize: 13,
                  }}
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "14px",
                  borderRadius: 10,
                  fontSize: 15,
                  fontWeight: 700,
                  background:
                    role === "mentor"
                      ? "linear-gradient(135deg, #BE185D, #EC4899)"
                      : "linear-gradient(135deg, #7C3AED, #EC4899)",
                  color: "#fff",
                  border: "none",
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? "Creating account…" : "Create Account →"}
              </button>
            </form>

            <p
              style={{
                textAlign: "center",
                marginTop: 20,
                color: "rgba(255,255,255,0.45)",
                fontSize: 13,
              }}
            >
              Already have an account?{" "}
              <a
                href="/account/signin"
                style={{
                  color: "#A78BFA",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                Sign in
              </a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
