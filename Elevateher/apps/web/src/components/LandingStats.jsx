"use client";
import { useState, useEffect } from "react";

const STATS = [
  { value: "2.4B", label: "Women underserved by EdTech" },
  { value: "5", label: "SE Asian countries supported" },
  { value: "12", label: "Week structured programme" },
  { value: "3", label: "UN SDGs addressed" },
];

export default function LandingStats() {
  const [currentStat, setCurrentStat] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStat((prev) => (prev + 1) % STATS.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
        gap: 1,
        background: "rgba(255,255,255,0.05)",
        borderRadius: 16,
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.08)",
        maxWidth: 800,
        margin: "0 auto",
      }}
    >
      {STATS.map((stat, i) => (
        <div
          key={i}
          style={{
            padding: "24px 16px",
            textAlign: "center",
            background:
              i === currentStat ? "rgba(124,58,237,0.15)" : "transparent",
            transition: "background 0.5s",
          }}
        >
          <div
            style={{
              fontSize: 28,
              fontWeight: 900,
              color: i === currentStat ? "#A78BFA" : "#fff",
            }}
          >
            {stat.value}
          </div>
          <div
            style={{
              fontSize: 12,
              color: "rgba(255,255,255,0.5)",
              marginTop: 4,
              lineHeight: 1.4,
            }}
          >
            {stat.label}
          </div>
        </div>
      ))}
    </div>
  );
}
