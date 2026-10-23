"use client";
import { useQuery } from "@tanstack/react-query";

const S = {
  page: {
    minHeight: "100vh",
    background: "#0F0A1E",
    color: "#fff",
    fontFamily: "'Inter', sans-serif",
    padding: "40px 20px",
  },
  container: {
    maxWidth: 600,
    margin: "0 auto",
  },
  card: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  header: {
    fontSize: 24,
    fontWeight: 700,
    marginBottom: 24,
    color: "#A78BFA",
  },
};

export default function MyReportsPage() {
  const { data: reports, isLoading } = useQuery({
    queryKey: ["my-reports"],
    queryFn: async () => {
      const res = await fetch("/api/safety/my-reports");
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });

  return (
    <div style={S.page}>
      <div style={S.container}>
        <a href="/dashboard" style={{ color: "rgba(255,255,255,0.5)", textDecoration: "none", display: "inline-block", marginBottom: 20 }}>← Back to Dashboard</a>
        <h1 style={S.header}>My Safety Reports</h1>
        
        {isLoading && <div style={{ color: "rgba(255,255,255,0.5)" }}>Loading reports...</div>}
        
        {!isLoading && (!reports || reports.length === 0) && (
          <div style={{ ...S.card, textAlign: "center", color: "rgba(255,255,255,0.5)" }}>
            You haven't submitted any safety reports.
          </div>
        )}

        {reports?.map((r) => (
          <div key={r.id} style={S.card}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ fontWeight: 600, fontSize: 16 }}>{r.reason || "Reported"}</div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "4px 8px",
                  borderRadius: 8,
                  background: r.status === "open" ? "rgba(245,158,11,0.15)" : "rgba(16,185,129,0.15)",
                  color: r.status === "open" ? "#F59E0B" : "#10B981",
                  textTransform: "capitalize",
                }}
              >
                {r.status || "Pending"}
              </div>
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginBottom: 16 }}>
              {r.description || "No description provided."}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 12 }}>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
                ID: {r.id.split('-')[0].toUpperCase()}
              </span>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
                {new Date(r.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
