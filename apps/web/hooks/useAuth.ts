import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken, removeToken, getUserFromToken, isAuthenticated, setToken } from "@/lib/auth";
import { authApi } from "@/lib/api";

export function useAuth(redirectIfUnauthenticated = true) {
  const router = useRouter();
  const [user, setUser] = useState<ReturnType<typeof getUserFromToken> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token || !isAuthenticated()) {
      if (redirectIfUnauthenticated) {
        router.replace("/login");
      }
      setLoading(false);
      return;
    }
    setUser(getUserFromToken());
    setLoading(false);
  }, [redirectIfUnauthenticated, router]);

  // Fix S-F3: Proactive token refresh — check every 4 minutes, refresh if expiring within 5 minutes.
  // Prevents silent 401 failures mid-session during long-running tasks like proposal generation.
  useEffect(() => {
    const checkAndRefresh = async () => {
      const token = getToken();
      if (!token) return;
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        const expiresInMs = payload.exp * 1000 - Date.now();
        if (expiresInMs < 5 * 60 * 1000 && expiresInMs > 0) {
          const resp = await authApi.refresh();
          setToken(resp.data.access_token);
          setUser(getUserFromToken());
        }
      } catch {
        // Refresh failed (token already expired or network error) — force logout
        removeToken();
        router.replace("/login");
      }
    };

    const interval = setInterval(checkAndRefresh, 4 * 60 * 1000);
    return () => clearInterval(interval);
  }, [router]);

  const logout = () => {
    removeToken();
    router.push("/login");
  };

  return { user, loading, logout, isAuthenticated: !!user };
}
