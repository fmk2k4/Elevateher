"use client";
import { useEffect } from "react";

export default function InstitutionRedirect() {
  useEffect(() => {
    window.location.href = "/institution/dashboard";
  }, []);
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0A0612",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <div style={{ textAlign: "center", color: "#fff" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
        <div style={{ color: "rgba(255,255,255,0.5)" }}>
          Loading institution dashboard…
        </div>
      </div>
    </div>
  );
}
