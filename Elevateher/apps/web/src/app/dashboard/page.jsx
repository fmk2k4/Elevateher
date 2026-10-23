"use client";
import { useEffect, useState } from "react";

export default function DashboardRouter() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/users/profile");
        if (!res.ok) {
          setError("Not authenticated");
          setLoading(false);
          return;
        }
        const { user: userData } = await res.json();
        if (!userData) {
          setError("No user data");
          setLoading(false);
          return;
        }
        setUser(userData);
        if (!userData.onboarding_complete) {
          // Route to the correct role-specific onboarding path.
          // /onboarding is not a real route — /onboarding/[role] is.
          const pendingRole = userData.role === "mentor" ? "mentor" : "mentee";
          window.location.href = `/onboarding/${pendingRole}`;
          return;
        }
        const role = userData.role || "mentee";
        if (role === "mentor") window.location.href = "/mentor/dashboard";
        else if (role === "institution_admin" || role === "admin")
          window.location.href = "/institution/dashboard";
        else window.location.href = "/mentee/dashboard";
      } catch (err) {
        setError("Error loading dashboard: " + err.message);
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
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
          <div style={{ fontSize: 48, marginBottom: 16 }}>🌟</div>
          <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 16 }}>
            Loading your dashboard…
          </div>
        </div>
      </div>
    );
  }

  if (error) {
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
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 16, marginBottom: 24 }}>
            {error}
          </div>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <a
              href="/"
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                background: "linear-gradient(135deg, #7C3AED, #EC4899)",
                color: "#fff",
                textDecoration: "none",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              Home
            </a>
            <a
              href="/account/signin"
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.2)",
                color: "#fff",
                textDecoration: "none",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              Sign In
            </a>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
