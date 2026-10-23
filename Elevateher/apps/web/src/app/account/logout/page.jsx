"use client";
import { useEffect } from "react";
import useAuth from "@/utils/useAuth";

export default function LogoutPage() {
  const { signOut } = useAuth();

  useEffect(() => {
    signOut({ callbackUrl: "/", redirect: true });
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #0F0A1E 0%, #1A0F2E 100%)",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <div style={{ textAlign: "center", color: "#fff" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🌟</div>
        <div style={{ fontSize: 18, color: "rgba(255,255,255,0.6)" }}>
          Signing you out…
        </div>
      </div>
    </div>
  );
}
