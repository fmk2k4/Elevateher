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

export default function MentorProfilePage() {
  const qc = useQueryClient();
  const [formData, setFormData] = useState({
    full_name: "",
    display_name: "",
    job_title: "",
    employer: "",
    industry: "",
    years_exp: 0,
    bio: "",
    max_mentees: 2,
    skills: "",
    languages: "",
    linkedin_url: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["mentorProfile"],
    queryFn: async () => {
      const r = await fetch("/api/mentor/profile");
      if (!r.ok) throw new Error("Failed to fetch");
      return r.json();
    },
  });

  useEffect(() => {
    if (data?.profile) {
      setFormData({
        full_name: data.profile.full_name || "",
        display_name: data.profile.display_name || "",
        job_title: data.profile.job_title || "",
        employer: data.profile.employer || "",
        industry: data.profile.industry || "",
        years_exp: data.profile.years_exp || 0,
        bio: data.profile.bio || "",
        max_mentees: data.profile.max_mentees || 2,
        skills: Array.isArray(data.profile.skills) ? data.profile.skills.join(", ") : "",
        languages: Array.isArray(data.profile.languages) ? data.profile.languages.join(", ") : "en",
        linkedin_url: data.profile.linkedin_url || "",
      });
    }
  }, [data]);

  const updateMutation = useMutation({
    mutationFn: async (payloadData) => {
      const payload = {
        ...payloadData,
        skills: payloadData.skills ? payloadData.skills.split(",").map(s => s.trim()).filter(Boolean) : [],
        languages: payloadData.languages ? payloadData.languages.split(",").map(s => s.trim()).filter(Boolean) : ["en"],
      };
      const r = await fetch("/api/mentor/profile", {
        method: "POST", // API uses POST
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error("Update failed");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries(["mentorProfile"]);
      alert("Profile updated successfully!");
    },
    onError: (err) => {
      alert(err.message || "Failed to update profile");
    }
  });

  if (isLoading) {
    return <div style={{ ...S.page, padding: 40, textAlign: "center" }}>Loading profile...</div>;
  }

  return (
    <div style={S.page}>
      <nav style={S.nav}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }}>🌟</span>
          <span style={{ fontWeight: 800, fontSize: 18, color: "#fff" }}>ElevateHer</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <a href="/mentor/dashboard" style={{ color: "#A78BFA", textDecoration: "none", fontSize: 14, fontWeight: 600 }}>← Back to Dashboard</a>
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

          <label style={S.label}>Job Title</label>
          <input 
            type="text" 
            style={S.input} 
            value={formData.job_title}
            onChange={(e) => setFormData({...formData, job_title: e.target.value})}
          />

          <label style={S.label}>Employer</label>
          <input 
            type="text" 
            style={S.input} 
            value={formData.employer}
            onChange={(e) => setFormData({...formData, employer: e.target.value})}
          />

          <label style={S.label}>Industry</label>
          <input 
            type="text" 
            style={S.input} 
            value={formData.industry}
            onChange={(e) => setFormData({...formData, industry: e.target.value})}
          />

          <label style={S.label}>Years of Experience</label>
          <input 
            type="number" 
            style={S.input} 
            value={formData.years_exp}
            onChange={(e) => setFormData({...formData, years_exp: parseInt(e.target.value) || 0})}
          />

          <label style={S.label}>Max Mentees</label>
          <input 
            type="number" 
            style={S.input} 
            value={formData.max_mentees}
            onChange={(e) => setFormData({...formData, max_mentees: parseInt(e.target.value) || 1})}
          />

          <label style={S.label}>LinkedIn URL</label>
          <input 
            type="url" 
            style={S.input} 
            placeholder="https://linkedin.com/in/..."
            value={formData.linkedin_url}
            onChange={(e) => setFormData({...formData, linkedin_url: e.target.value})}
          />

          <label style={S.label}>Skills (comma separated)</label>
          <input 
            type="text" 
            style={S.input} 
            placeholder="React, Python, Leadership"
            value={formData.skills}
            onChange={(e) => setFormData({...formData, skills: e.target.value})}
          />

          <label style={S.label}>Languages (comma separated)</label>
          <input 
            type="text" 
            style={S.input} 
            placeholder="en, es, fr"
            value={formData.languages}
            onChange={(e) => setFormData({...formData, languages: e.target.value})}
          />

          <label style={S.label}>Bio</label>
          <textarea 
            style={{ ...S.input, minHeight: 100, resize: "vertical" }}
            value={formData.bio}
            onChange={(e) => setFormData({...formData, bio: e.target.value})}
          />

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
