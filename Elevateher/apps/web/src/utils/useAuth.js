import { apiFetch } from "./api-client";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

function useAuth() {
  const signInWithCredentials = async (options) => {
    const { email, password, callbackUrl } = options || {};
    try {
      const data = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ identifier: email, password }),
      });
      if (data.access_token) {
        localStorage.setItem("auth_token", data.access_token);
      }
      return {
        ok: true,
        url: callbackUrl || "/dashboard",
        user: { id: data.user_id, role: data.role },
      };
    } catch (err) {
      return { error: err.message || "Sign in failed" };
    }
  };

  const signUpWithCredentials = async (options) => {
    const { email, password, name, role, callbackUrl } = options || {};
    try {
      const data = await apiFetch("/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password, name, role: role || "mentee" }),
      });
      if (data.access_token) {
        localStorage.setItem("auth_token", data.access_token);
      }
      return {
        ok: true,
        url: callbackUrl || "/dashboard",
        user: { id: data.user_id },
      };
    } catch (err) {
      return { error: err.message || "Sign up failed" };
    }
  };

  const signOut = async (options = {}) => {
    const { callbackUrl } = options;
    const token = localStorage.getItem("auth_token");
    try {
      await apiFetch("/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refresh_token: "" }),
      });
    } catch {}
    localStorage.removeItem("auth_token");
    if (callbackUrl) {
      window.location.href = callbackUrl;
    }
  };

  const notConfigured = () =>
    Promise.resolve({ error: "Social sign-in not configured on backend" });

  return {
    signInWithCredentials,
    signUpWithCredentials,
    signInWithGoogle: notConfigured,
    signInWithFacebook: notConfigured,
    signInWithTwitter: notConfigured,
    signInWithApple: notConfigured,
    signOut,
  };
}

export default useAuth;
