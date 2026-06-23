"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { clearToken, isLoggedIn } from "@/lib/auth";
import { syncLocalProfileCache } from "@/lib/profileCache";
import {
  checkSession,
  getCachedSessionUser,
  type SessionUser,
} from "@/lib/sessionValidation";

export type DashboardUser = SessionUser;

type Ctx = {
  user: DashboardUser | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
};

const DashboardUserContext = createContext<Ctx | null>(null);

const AUTH_ME_RETRY_MS = [2000, 4000, 8000, 12000];

export function DashboardUserProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const result = await checkSession();
      if (result.status === "valid") {
        setUser(result.user);
        syncLocalProfileCache(result.user);
        return;
      }
      if (result.status === "invalid") {
        clearToken();
        return;
      }
      const cached = getCachedSessionUser();
      if (cached) setUser(cached);
    } catch {
      const cached = getCachedSessionUser();
      if (cached) setUser(cached);
    }
  }, []);

  useEffect(() => {
    if (!isLoggedIn()) {
      const next =
        typeof window !== "undefined"
          ? window.location.pathname + window.location.search
          : "";
      const path = next ? `/login?next=${encodeURIComponent(next)}` : "/login";
      router.replace(path);
      return;
    }

    let cancelled = false;
    const retryTimers: ReturnType<typeof setTimeout>[] = [];

    const finishLoading = () => {
      if (!cancelled) setLoading(false);
    };

    const scheduleRetry = (attempt: number) => {
      const delay = AUTH_ME_RETRY_MS[Math.min(attempt, AUTH_ME_RETRY_MS.length - 1)];
      const timer = setTimeout(() => {
        void loadSession(attempt + 1);
      }, delay);
      retryTimers.push(timer);
    };

    const loadSession = async (attempt = 0) => {
      try {
        const result = await checkSession();
        if (cancelled) return;

        if (result.status === "valid") {
          setUser(result.user);
          syncLocalProfileCache(result.user);
          finishLoading();
          return;
        }

        if (result.status === "invalid") {
          clearToken();
          const next =
            typeof window !== "undefined"
              ? window.location.pathname + window.location.search
              : "";
          const path = next ? `/login?next=${encodeURIComponent(next)}` : "/login";
          router.replace(path);
          finishLoading();
          return;
        }

        const cached = getCachedSessionUser();
        if (cached) setUser(cached);
        finishLoading();

        if (attempt < AUTH_ME_RETRY_MS.length) {
          scheduleRetry(attempt);
        }
      } catch {
        if (cancelled) return;
        const cached = getCachedSessionUser();
        if (cached) setUser(cached);
        finishLoading();
        if (attempt < AUTH_ME_RETRY_MS.length) {
          scheduleRetry(attempt);
        }
      }
    };

    void loadSession();

    return () => {
      cancelled = true;
      retryTimers.forEach(clearTimeout);
    };
  }, [router]);

  const value = useMemo(
    () => ({ user, loading, refreshUser }),
    [user, loading, refreshUser],
  );

  return (
    <DashboardUserContext.Provider value={value}>
      {children}
    </DashboardUserContext.Provider>
  );
}

export function useDashboardUser(): Ctx {
  const ctx = useContext(DashboardUserContext);
  if (!ctx) {
    throw new Error("useDashboardUser must be used within DashboardUserProvider");
  }
  return ctx;
}
