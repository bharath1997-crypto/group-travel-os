"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import { clearToken, saveToken } from "@/lib/auth";
import { syncLocalProfileCache } from "@/lib/profileCache";

const WELCOME_KEY = "gt_oauth_welcome";

type Me = { full_name: string; email: string; avatar_url?: string | null };

async function fetchMeWithRetry(): Promise<Me> {
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await apiFetch<Me>("/auth/me");
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error("profile fetch failed");
      await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
    }
  }
  throw lastErr ?? new Error("profile fetch failed");
}

function oauthErrorPath(err: string, intent: string | null): string {
  const q = `oauth_error=${encodeURIComponent(err)}`;
  if (intent === "signup") {
    return `/register?${q}`;
  }
  return `/login?${q}`;
}

export default function OAuthCallbackPage() {
  const router = useRouter();
  const [msg, setMsg] = useState("Completing sign-in…");

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const err = q.get("oauth_error");
    const token = q.get("access_token");
    const oauthNewUser = q.get("oauth_new_user") === "1";
    const oauthIntent = q.get("oauth_intent");

    if (err) {
      setMsg("Redirecting…");
      router.replace(oauthErrorPath(err, oauthIntent));
      return;
    }

    if (!token) {
      setMsg("Missing token — redirecting…");
      router.replace(oauthErrorPath("missing_token", oauthIntent));
      return;
    }

    saveToken(token);

    (async () => {
      try {
        const me = await fetchMeWithRetry();
        localStorage.setItem(
          "gt_user_name",
          me.full_name?.trim() || "Traveler",
        );
        syncLocalProfileCache(me);
        if (oauthNewUser) {
          try {
            sessionStorage.setItem(WELCOME_KEY, "1");
          } catch {
            /* ignore quota / private mode */
          }
        }
        router.replace(oauthNewUser ? "/complete-profile" : "/dashboard");
      } catch {
        clearToken();
        setMsg("Could not load profile — redirecting…");
        router.replace(
          oauthErrorPath("profile_unavailable", oauthIntent ?? "login"),
        );
      }
    })();
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 text-white">
      <div className="flex flex-col items-center gap-3">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white"
          aria-hidden
        />
        <p className="text-sm text-slate-300">{msg}</p>
      </div>
    </div>
  );
}
