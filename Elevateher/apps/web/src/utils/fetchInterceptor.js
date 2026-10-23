// Global fetch interceptor: automatically attaches the Bearer JWT
// (stored in localStorage by useAuth.js after FastAPI login) to all
// /api/* requests so the API proxy routes can forward it to FastAPI.
(function installFetchInterceptor() {
  if (typeof window === "undefined" || !window.fetch) return;

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (url, options = {}) => {
    const u = String(url);
    if (u.startsWith("/api/")) {
      try {
        const token = localStorage.getItem("auth_token");
        if (token) {
          options.headers = {
            ...(options.headers || {}),
            Authorization: `Bearer ${token}`,
          };
        }
      } catch {
        // localStorage may be unavailable in some environments
      }
    }
    return originalFetch(url, options);
  };
})();
