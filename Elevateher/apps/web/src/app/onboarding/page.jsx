import { useUser } from "@/utils/useUser";

export default function OnboardingResolver() {
  const { user, loading } = useUser();

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0F0A1E",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "rgba(255,255,255,0.5)",
          fontFamily: "'Inter', sans-serif",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>🌟</div>
          <div>Loading setup…</div>
        </div>
      </div>
    );
  }

  // If we have a user and they have a role, redirect to that role's onboarding
  const role = user?.role === "mentor" ? "mentor" : "mentee";
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0F0A1E",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "rgba(255,255,255,0.5)",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 16 }}>🌟</div>
        <div>Redirecting to {role} setup…</div>
        <script
          dangerouslySetInnerHTML={{
            __html: `window.location.href = '/onboarding/${role}'`,
          }}
        />
      </div>
    </div>
  );
}
