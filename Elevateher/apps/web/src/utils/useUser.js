import * as React from "react";
import { apiFetch } from "./api-client";

const useUser = () => {
  const [user, setUser] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    apiFetch("/auth/me")
      .then((data) => {
        if (!cancelled) setUser(data.user || data || null);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { user, data: user, loading };
};

export { useUser };
export default useUser;
