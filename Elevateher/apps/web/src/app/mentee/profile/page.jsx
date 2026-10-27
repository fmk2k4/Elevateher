"use client";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const S = {
  page: {
    minHeight: "100vh",
    background: "#0F0A1E",
    color: "#fff",
    fontFamily: "'Inter', sans-serif",
  },
  nav: {
    background: "rgba(255,255,255,0.03)",
    borderBottom: "1px solid rgba(255,255,255,0.07)",
    padding: "0 24px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    height: 64,
  },
  card: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 24,
    maxWidth: 600,
    margin: "0 auto",
  },
  input: {
    width: "100%",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8,
    padding: "10px 14px",
    color: "#fff",
    fontSize: 14,
    marginBottom: 16,
  },
  label: {
    display: "block",
    fontSize: 13,
    color: "rgba(255,255,255,0.6)",
    marginBottom: 6,
    fontWeight: 600,
  },
  button: {
    padding: "10px 20px",
    borderRadius: 8,
    background: "linear-gradient(135deg, #7C3AED, #EC4899)",
    border: "none",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 14,
    width: "100%",
  }
};

export default function MenteeProfilePage() {
  const qc = useQueryClient();
  const [formData, setFormData] = useState({
    full_name: "",
    display_name: "",
    career_goals: [],
    sdg_track: "STEM",
    current_education: "",
    education_level: "",
    preferred_languages: [],
    challenges: [],
    bio_short: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["menteeProfile"],
    queryFn: async () => {
      const r = await fetch("/api/mentee/profile");
      if (!r.ok) throw new Error("Failed to fetch");
      return r.json();
    },
  });

  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data) {
      // Backend returns MenteeProfileResponse directly (flat object), but
      // some API routes may wrap it. Handle both shapes.
      const p = data.profile || data;
      setFormData({
        full_name: p.full_name || "",
        display_name: p.display_name || "",
        career_goals: p.career_goals || [],
        sdg_track: p.sdg_track || "STEM",
        current_education: p.current_education || "",
        education_level: p.education_level || "",
        preferred_languages: p.preferred_languages || [],
        challenges: p.challenges || [],
        bio_short: p.bio_short || "",
      });
    }
  }, [data]);

  const updateMutation = useMutation({
    mutationFn: async (payload) => {
      const r = await fetch("/api/mentee/profile", {
        method: "POST", // API uses POST
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error("Update failed");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries(["menteeProfile"]);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
    onError: (err) => {
      alert(err.message || "Failed to update profile");
    }
  });

  if (isLoading) {
    return <div style={{ ...S.page, padding: 40, textAlign: "center", color: "#fff" }}>Loading profile...</div>;
  }

  return (
    <div style={S.page}>
      <nav style={S.nav}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }}>🌟</span>
          <span style={{ fontWeight: 800, fontSize: 18, color: "#fff" }}>ElevateHer</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <a href="/mentee/dashboard" style={{ color: "#A78BFA", textDecoration: "none", fontSize: 14, fontWeight: 600 }}>← Back to Dashboard</a>
        </div>
      </nav>

      <div style={{ padding: "40px 24px" }}>
        <div style={S.card}>
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 24 }}>My Profile</h1>
          
          <label style={S.label}>Full Name</label>
          <input 
            type="text" 
            style={S.input} 
            value={formData.full_name}
            onChange={(e) => setFormData({...formData, full_name: e.target.value})}
          />

          <label style={S.label}>Display Name</label>
          <input 
            type="text" 
            style={S.input} 
            value={formData.display_name}
            onChange={(e) => setFormData({...formData, display_name: e.target.value})}
          />

          <label style={S.label}>Current Education</label>
          <input 
            type="text" 
            style={S.input} 
            value={formData.current_education}
            onChange={(e) => setFormData({...formData, current_education: e.target.value})}
          />
          
          <label style={S.label}>SDG Track</label>
          <select 
            style={S.input}
            value={formData.sdg_track}
            onChange={(e) => setFormData({...formData, sdg_track: e.target.value})}
          >
            <option value="STEM">STEM Track: Science, Tech, Engineering, Math</option>
            <option value="Business">Business Track: Finance, Marketing, Entrepreneurship</option>
            <option value="Trades">Trades Track: Skilled trades and technical work</option>
            <option value="Creative">Creative Track: Design, Media, Communications</option>
          </select>

          <label style={S.label}>Bio (Short)</label>
          <textarea 
            style={{ ...S.input, minHeight: 100, resize: "vertical" }}
            value={formData.bio_short}
            onChange={(e) => setFormData({...formData, bio_short: e.target.value})}
          />

          {saved && (
            <div style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 10, padding: "12px 16px", marginBottom: 16, color: "#6EE7B7", fontSize: 14 }}>
              ✓ Profile saved successfully!
            </div>
          )}

          <button
            style={{ ...S.button, opacity: updateMutation.isPending ? 0.7 : 1 }}
            onClick={() => updateMutation.mutate(formData)}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? "Saving..." : "Save Profile"}
          </button>
        </div>
      </div>
    </div>
  );
}
