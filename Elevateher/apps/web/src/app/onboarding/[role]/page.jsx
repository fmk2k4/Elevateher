"use client";
import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import useUser from "@/utils/useUser";

const STYLE = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #0F0A1E 0%, #1A0F2E 100%)",
    fontFamily: "'Inter', sans-serif",
    padding: 24,
  },
  card: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 20,
    padding: 40,
    maxWidth: 560,
    margin: "0 auto",
  },
  label: {
    display: "block",
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 8,
  },
  input: {
    width: "100%",
    padding: "12px 16px",
    borderRadius: 10,
    fontSize: 15,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "#fff",
    outline: "none",
    boxSizing: "border-box",
  },
  select: {
    width: "100%",
    padding: "12px 16px",
    borderRadius: 10,
    fontSize: 15,
    background: "#1A0F2E",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "#fff",
    outline: "none",
    boxSizing: "border-box",
  },
  btn: {
    width: "100%",
    padding: "14px",
    borderRadius: 10,
    fontSize: 15,
    fontWeight: 700,
    background: "linear-gradient(135deg, #7C3AED, #EC4899)",
    color: "#fff",
    border: "none",
    cursor: "pointer",
  },
  chip: (active) => ({
    padding: "6px 14px",
    borderRadius: 100,
    fontSize: 13,
    cursor: "pointer",
    fontWeight: 500,
    background: active ? "rgba(124,58,237,0.3)" : "rgba(255,255,255,0.05)",
    border: `1px solid ${active ? "rgba(124,58,237,0.6)" : "rgba(255,255,255,0.1)"}`,
    color: active ? "#A78BFA" : "rgba(255,255,255,0.6)",
  }),
};

const SDG_TRACKS = ["STEM", "Business", "Trades", "Creative", "Healthcare"];
const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "ms", label: "Bahasa Melayu" },
  { code: "id", label: "Bahasa Indonesia" },
  { code: "th", label: "Thai" },
  { code: "ja", label: "Japanese" },
];
const COUNTRIES = ["MY", "SG", "ID", "TH", "JP", "GB", "PH", "VN"];
const INDUSTRIES = [
  "Technology",
  "Finance & Banking",
  "Healthcare & Medicine",
  "Education",
  "Marketing & Media",
  "Engineering",
  "Law",
  "Government & Policy",
  "Retail & Commerce",
  "Creative Arts",
];
const MENTEE_CHALLENGES = [
  "no_role_models",
  "family_pressure",
  "financial_constraints",
  "language_barrier",
  "location_rural",
  "low_confidence",
  "unclear_career_path",
  "lack_of_skills",
];

const Field = ({ label, children }) => (
  <fieldset style={{ marginBottom: 20, border: "none", padding: 0 }}>
    <legend style={STYLE.label}>{label}</legend>
    {children}
  </fieldset>
);

export default function OnboardingPage() {
  const { data: user } = useUser();
  const params = useParams();
  const [role, setRole] = useState(params.role || "mentee");
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Mentee fields
  const [menteeForm, setMenteeForm] = useState({
    full_name: "",
    sdg_track: "STEM",
    career_goals: [],
    preferred_languages: ["en"],
    challenges: [],
    current_education: "",
    education_level: "degree",
    age: "",
    country: "MY",
    bio_short: "",
    guardian_email: "",
  });

  const [pendingConsent, setPendingConsent] = useState(false);

  // Mentor fields
  const [mentorForm, setMentorForm] = useState({
    full_name: "",
    job_title: "",
    employer: "",
    industry: "Technology",
    years_exp: "",
    skills: [],
    languages: ["en"],
    bio: "",
    country: "MY",
    age: "",
    can_mentor_minors: false,
  });
  const [skillInput, setSkillInput] = useState("");

  useEffect(() => {
    // Role is already initialized via params.role
    if (params.role === "mentor" || params.role === "mentee") {
      setRole(params.role);
    }
  }, [params.role]);

  useEffect(() => {
    if (user?.name) {
      setMenteeForm((f) => ({ ...f, full_name: user.name }));
      setMentorForm((f) => ({ ...f, full_name: user.name }));
    }
  }, [user]);

  const toggleChip = (arr, val) =>
    arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];

  const submitMentee = async () => {
    if (menteeForm.career_goals.length === 0) {
      setError("Please select at least one career goal");
      return;
    }
    const ageNum = parseInt(menteeForm.age);
    if (ageNum < 18 && !menteeForm.guardian_email) {
      setError("Guardian email is required for users under 18");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/mentee/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...menteeForm,
          age: ageNum || undefined,
        }),
      });
      if (!res.ok) {
        let errStr = "Could not save profile";
        try {
          const data = await res.json();
          errStr = data.error || (data.detail && typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail)) || `HTTP Error ${res.status}`;
        } catch (e) {
          errStr = `HTTP Error ${res.status}`;
        }
        throw new Error(errStr);
      }
      if (typeof window !== "undefined") localStorage.removeItem("pendingRole");
      
      if (ageNum < 18) {
        setPendingConsent(true);
      } else {
        window.location.href = "/dashboard";
      }
    } catch (err) {
      setError(err.message || "Could not save profile");
      setLoading(false);
    }
  };

  const submitMentor = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/mentor/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...mentorForm,
          years_exp: parseInt(mentorForm.years_exp) || 0,
          age: parseInt(mentorForm.age) || undefined,
        }),
      });
      if (!res.ok) {
        let errStr = "Could not save profile";
        try {
          const data = await res.json();
          errStr = data.error || (data.detail && typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail)) || `HTTP Error ${res.status}`;
        } catch (e) {
          errStr = `HTTP Error ${res.status}`;
        }
        throw new Error(errStr);
      }
      if (typeof window !== "undefined") localStorage.removeItem("pendingRole");
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err.message || "Could not save profile");
      setLoading(false);
    }
  };

  if (role === "mentor") {
    return (
      <div style={STYLE.page}>
        <div style={{ paddingTop: 40 }}>
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <div style={{ fontSize: 32 }}>⭐</div>
            <h1
              style={{
                color: "#fff",
                fontSize: 24,
                fontWeight: 800,
                marginTop: 8,
              }}
            >
              Set up your mentor profile
            </h1>
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 14 }}>
              Your profile is reviewed by our team before going live
            </p>
          </div>
          <div style={STYLE.card}>
            <Field label="Full Name">
              <input
                style={STYLE.input}
                value={mentorForm.full_name}
                onChange={(e) =>
                  setMentorForm({ ...mentorForm, full_name: e.target.value })
                }
                placeholder="Your full name"
              />
            </Field>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
              }}
            >
              <Field label="Job Title">
                <input
                  style={STYLE.input}
                  value={mentorForm.job_title}
                  onChange={(e) =>
                    setMentorForm({ ...mentorForm, job_title: e.target.value })
                  }
                  placeholder="Senior Engineer"
                />
              </Field>
              <Field label="Employer">
                <input
                  style={STYLE.input}
                  value={mentorForm.employer}
                  onChange={(e) =>
                    setMentorForm({ ...mentorForm, employer: e.target.value })
                  }
                  placeholder="Company name"
                />
              </Field>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
              }}
            >
              <Field label="Industry">
                <select
                  style={STYLE.select}
                  value={mentorForm.industry}
                  onChange={(e) =>
                    setMentorForm({ ...mentorForm, industry: e.target.value })
                  }
                >
                  {INDUSTRIES.map((i) => (
                    <option key={i} value={i}>
                      {i}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Years of Experience">
                <input
                  style={STYLE.input}
                  type="number"
                  min="1"
                  max="50"
                  value={mentorForm.years_exp}
                  onChange={(e) =>
                    setMentorForm({ ...mentorForm, years_exp: e.target.value })
                  }
                  placeholder="8"
                />
              </Field>
            </div>
            <Field label="Skills (press Enter to add)">
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  marginBottom: 10,
                  flexWrap: "wrap",
                }}
              >
                {mentorForm.skills.map((s) => (
                  <button
                    type="button"
                    key={s}
                    onClick={() =>
                      setMentorForm({
                        ...mentorForm,
                        skills: mentorForm.skills.filter((x) => x !== s),
                      })
                    }
                    style={{ ...STYLE.chip(true), cursor: "pointer" }}
                    aria-label={`Remove skill ${s}`}
                  >
                    {s} ×
                  </button>
                ))}
              </div>
              <input
                style={STYLE.input}
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && skillInput.trim()) {
                    setMentorForm({
                      ...mentorForm,
                      skills: [...mentorForm.skills, skillInput.trim()],
                    });
                    setSkillInput("");
                    e.preventDefault();
                  }
                }}
                placeholder="e.g. Python, Machine Learning…"
              />
            </Field>
            <Field label="Languages you can mentor in">
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {LANGUAGES.map((l) => (
                  <button
                    type="button"
                    key={l.code}
                    onClick={() =>
                      setMentorForm({
                        ...mentorForm,
                        languages: toggleChip(mentorForm.languages, l.code),
                      })
                    }
                    style={STYLE.chip(mentorForm.languages.includes(l.code))}
                    aria-pressed={mentorForm.languages.includes(l.code)}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Bio (tell mentees about yourself)">
              <textarea
                style={{ ...STYLE.input, minHeight: 120, resize: "vertical" }}
                value={mentorForm.bio}
                onChange={(e) =>
                  setMentorForm({ ...mentorForm, bio: e.target.value })
                }
                placeholder="I'm a software engineer with 8 years in fintech. I'm passionate about helping young women enter the tech industry…"
              />
            </Field>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
              }}
            >
              <Field label="Country">
                <select
                  style={STYLE.select}
                  value={mentorForm.country}
                  onChange={(e) =>
                    setMentorForm({ ...mentorForm, country: e.target.value })
                  }
                >
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Age">
                <input
                  style={STYLE.input}
                  type="number"
                  min="22"
                  max="80"
                  value={mentorForm.age}
                  onChange={(e) =>
                    setMentorForm({ ...mentorForm, age: e.target.value })
                  }
                  placeholder="30"
                />
              </Field>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 24,
              }}
            >
              <input
                type="checkbox"
                id="canMinors"
                checked={mentorForm.can_mentor_minors}
                onChange={(e) =>
                  setMentorForm({
                    ...mentorForm,
                    can_mentor_minors: e.target.checked,
                  })
                }
              />
              <label
                htmlFor="canMinors"
                style={{ color: "rgba(255,255,255,0.7)", fontSize: 14 }}
              >
                I consent to mentor users under 18 (requires additional
                verification)
              </label>
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
              style={{
                ...STYLE.btn,
                background: "linear-gradient(135deg, #BE185D, #EC4899)",
                opacity: loading ? 0.7 : 1,
              }}
              onClick={submitMentor}
              disabled={loading}
            >
              {loading
                ? "Submitting for review…"
                : "Submit Mentor Application →"}
            </button>
            <p
              style={{
                color: "rgba(255,255,255,0.35)",
                fontSize: 12,
                textAlign: "center",
                marginTop: 16,
                lineHeight: 1.6,
              }}
            >
              Your profile will be reviewed by our safety team within 24–48
              hours. You'll receive an email when approved.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Mentee onboarding
  if (pendingConsent) {
    return (
      <div style={STYLE.page}>
        <div style={{ paddingTop: 80, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 24 }}>✉️</div>
          <h1 style={{ color: "#fff", fontSize: 24, fontWeight: 800, marginBottom: 12 }}>
            Guardian Consent Required
          </h1>
          <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 16, maxWidth: 400, margin: "0 auto 32px", lineHeight: 1.5 }}>
            Because you are under 18, we have sent an email to <b>{menteeForm.guardian_email}</b>. 
            <br/><br/>
            Your account will be activated once your guardian reviews and confirms your request.
          </p>
          <button
            style={STYLE.btn}
            onClick={() => window.location.href = "/"}
          >
            Return Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={STYLE.page}>
      <div style={{ paddingTop: 40 }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ fontSize: 32 }}>🎓</div>
          <h1
            style={{
              color: "#fff",
              fontSize: 24,
              fontWeight: 800,
              marginTop: 8,
            }}
          >
            Tell us about yourself
          </h1>
          <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 14 }}>
            We'll use this to find your perfect mentor
          </p>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 6,
              marginTop: 16,
            }}
          >
            {[1, 2].map((n) => (
              <div
                key={n}
                style={{
                  width: 32,
                  height: 4,
                  borderRadius: 2,
                  background: step >= n ? "#7C3AED" : "rgba(255,255,255,0.1)",
                }}
              />
            ))}
          </div>
        </div>
        <div style={STYLE.card}>
          {step === 1 ? (
            <>
              <Field label="Full Name">
                <input
                  style={STYLE.input}
                  value={menteeForm.full_name}
                  onChange={(e) =>
                    setMenteeForm({ ...menteeForm, full_name: e.target.value })
                  }
                  placeholder="Your full name"
                />
              </Field>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 16,
                }}
              >
                <Field label="Age">
                  <input
                    style={STYLE.input}
                    type="number"
                    min="10"
                    max="30"
                    value={menteeForm.age}
                    onChange={(e) =>
                      setMenteeForm({ ...menteeForm, age: e.target.value })
                    }
                    placeholder="20"
                  />
                </Field>
                <Field label="Country">
                  <select
                    style={STYLE.select}
                    value={menteeForm.country}
                    onChange={(e) =>
                      setMenteeForm({ ...menteeForm, country: e.target.value })
                    }
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              {parseInt(menteeForm.age) < 18 && (
                <Field label="Guardian's Email Address (Required for <18)">
                  <input
                    style={STYLE.input}
                    type="email"
                    value={menteeForm.guardian_email}
                    onChange={(e) =>
                      setMenteeForm({ ...menteeForm, guardian_email: e.target.value })
                    }
                    placeholder="guardian@example.com"
                  />
                </Field>
              )}
              <Field label="Career Track">
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {SDG_TRACKS.map((t) => (
                    <button
                      type="button"
                      key={t}
                      onClick={() =>
                        setMenteeForm({ ...menteeForm, sdg_track: t })
                      }
                      style={STYLE.chip(menteeForm.sdg_track === t)}
                      aria-pressed={menteeForm.sdg_track === t}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Preferred Languages">
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {LANGUAGES.map((l) => (
                    <button
                      type="button"
                      key={l.code}
                      onClick={() =>
                        setMenteeForm({
                          ...menteeForm,
                          preferred_languages: toggleChip(
                            menteeForm.preferred_languages,
                            l.code,
                          ),
                        })
                      }
                      style={STYLE.chip(
                        menteeForm.preferred_languages.includes(l.code),
                      )}
                      aria-pressed={menteeForm.preferred_languages.includes(l.code)}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </Field>
              <button
                style={STYLE.btn}
                onClick={() => {
                  if (!menteeForm.full_name) {
                    setError("Please enter your name");
                    return;
                  }
                  setError(null);
                  setStep(2);
                }}
              >
                Next →
              </button>
            </>
          ) : (
            <>
              <Field label="Career Goals (select all that apply)">
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {[
                    "software_engineer",
                    "data_scientist",
                    "product_manager",
                    "doctor",
                    "nurse",
                    "teacher",
                    "business_analyst",
                    "entrepreneur",
                    "designer",
                    "lawyer",
                    "accountant",
                    "nurse_practitioner",
                  ].map((g) => (
                    <button
                      type="button"
                      key={g}
                      onClick={() =>
                        setMenteeForm({
                          ...menteeForm,
                          career_goals: toggleChip(menteeForm.career_goals, g),
                        })
                      }
                      style={STYLE.chip(menteeForm.career_goals.includes(g))}
                      aria-pressed={menteeForm.career_goals.includes(g)}
                    >
                      {g.replace(/_/g, " ")}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Challenges you face (optional)">
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {MENTEE_CHALLENGES.map((c) => (
                    <button
                      type="button"
                      key={c}
                      onClick={() =>
                        setMenteeForm({
                          ...menteeForm,
                          challenges: toggleChip(menteeForm.challenges, c),
                        })
                      }
                      style={STYLE.chip(menteeForm.challenges.includes(c))}
                      aria-pressed={menteeForm.challenges.includes(c)}
                    >
                      {c.replace(/_/g, " ")}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Current Education">
                <select
                  style={STYLE.select}
                  value={menteeForm.education_level}
                  onChange={(e) =>
                    setMenteeForm({
                      ...menteeForm,
                      education_level: e.target.value,
                    })
                  }
                >
                  {[
                    ["secondary", "Secondary School"],
                    ["pre_university", "Pre-University / A-Levels"],
                    ["diploma", "Diploma"],
                    ["degree", "Degree (Undergraduate)"],
                    ["postgrad", "Postgraduate"],
                    ["vocational", "Vocational / TVET"],
                    ["other", "Other"],
                  ].map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Brief Bio (optional)">
                <textarea
                  style={{ ...STYLE.input, minHeight: 80, resize: "vertical" }}
                  value={menteeForm.bio_short}
                  onChange={(e) =>
                    setMenteeForm({ ...menteeForm, bio_short: e.target.value })
                  }
                  placeholder="A bit about yourself and your goals…"
                />
              </Field>
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
              <div style={{ display: "flex", gap: 12 }}>
                <button
                  style={{
                    ...STYLE.btn,
                    background: "rgba(255,255,255,0.08)",
                    flex: "0 0 80px",
                  }}
                  onClick={() => setStep(1)}
                >
                  ← Back
                </button>
                <button
                  style={{ ...STYLE.btn, flex: 1, opacity: loading ? 0.7 : 1 }}
                  onClick={submitMentee}
                  disabled={loading}
                >
                  {loading ? "Finding your mentor…" : "Find My Mentor →"}
                </button>
              </div>
            </>
          )}
          {error && step === 1 && (
            <p style={{ color: "#FCA5A5", fontSize: 13, marginTop: 12 }}>
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
