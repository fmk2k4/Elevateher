"use client";
import { useState } from "react";
import useAuth from "@/utils/useAuth";

export default function SignInPage() {
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { signInWithCredentials } = useAuth();

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    if (!email || !password) {
      setError("Please fill in all fields");
      setLoading(false);
      return;
    }
    try {
      const res = await signInWithCredentials({
        email,
        password,
        callbackUrl: "/dashboard",
        redirect: false,
      });
      
      if (res?.error) {
        const msgs = {
          CredentialsSignin: "Incorrect email or password.",
          AccessDenied: "You don't have permission to sign in.",
          Configuration: "Sign-in isn't working right now. Please try again later.",
        };
        setError(msgs[res.error] || "Something went wrong. Please try again.");
        setLoading(false);
      } else if (res?.ok) {
        window.location.href = res?.url || "/dashboard";
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
      <div style={{ width: "100%", maxWidth: 440 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <a href="/" style={{ textDecoration: "none", display: "inline-block" }}>
            <img src="/logo_new.svg" alt="ElevateHer Logo" style={{ height: 80 }} />
          </a>
        </div>

        <div
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 20,
            padding: 40,
          }}
        >
          <h1
            style={{
              color: "#fff",
              fontSize: 24,
              fontWeight: 800,
              marginBottom: 8,
              textAlign: "center",
            }}
          >
            Welcome back
          </h1>
          <p
            style={{
              color: "rgba(255,255,255,0.45)",
              fontSize: 14,
              textAlign: "center",
              marginBottom: 32,
            }}
          >
            Sign in to your ElevateHer account
          </p>

          <form onSubmit={onSubmit}>
            <div style={{ marginBottom: 20 }}>
              <label
                style={{
                  display: "block",
                  color: "rgba(255,255,255,0.7)",
                  fontSize: 13,
                  fontWeight: 600,
                  marginBottom: 8,
                }}
              >
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
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
            <div style={{ marginBottom: 24 }}>
              <label
                style={{
                  display: "block",
                  color: "rgba(255,255,255,0.7)",
                  fontSize: 13,
                  fontWeight: 600,
                  marginBottom: 8,
                }}
              >
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
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
                background: "linear-gradient(135deg, #7C3AED, #EC4899)",
                color: "#fff",
                border: "none",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          {/* Demo Credentials Hint */}
          {process.env.NEXT_PUBLIC_DEMO_MODE === "true" && (
            <div
              style={{
                background: "rgba(124,58,237,0.1)",
                border: "1px solid rgba(124,58,237,0.2)",
                borderRadius: 12,
                padding: 16,
                marginTop: 24,
                fontSize: 13,
                color: "rgba(255,255,255,0.7)",
              }}
            >
              <strong style={{ color: "#A78BFA", display: "block", marginBottom: 8 }}>
                Demo Accounts:
              </strong>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
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
          )}

          <p
            style={{
              textAlign: "center",
              marginTop: 24,
              color: "rgba(255,255,255,0.45)",
              fontSize: 14,
            }}
          >
            Don't have an account?{" "}
            <a
              href="/account/signup"
              style={{
                color: "#A78BFA",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Sign up free
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
