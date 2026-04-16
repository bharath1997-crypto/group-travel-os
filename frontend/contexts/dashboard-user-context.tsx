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

import { apiFetch } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";
import { syncLocalProfileCache } from "@/lib/profileCache";

export type DashboardUser = {
  id?: string;
  full_name: string;
  email: string;
  avatar_url?: string | null;
  is_verified?: boolean;
  profile_completion_filled?: number;
  profile_completion_total?: number;
};

type Ctx = {
  user: DashboardUser | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
};

const DashboardUserContext = createContext<Ctx | null>(null);

export function DashboardUserProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const me = await apiFetch<DashboardUser>("/auth/me");
    setUser(me);
  }, []);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login");
      return;
    }
    let c = false;
    (async () => {
      try {
        const me = await apiFetch<DashboardUser>("/auth/me");
        if (!c) {
          setUser(me);
          syncLocalProfileCache(me);
        }
      } catch {
        if (!c) {
          setUser({
            full_name: "Traveler",
            email: "",
            is_verified: true,
            profile_completion_filled: 0,
            profile_completion_total: 6,
          });
        }
      } finally {
        if (!c) setLoading(false);
      }
    })();
    return () => {
      c = true;
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
