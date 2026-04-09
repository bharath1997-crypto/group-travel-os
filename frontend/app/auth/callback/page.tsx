"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import { saveToken } from "@/lib/auth";

type Me = { full_name: string };

export default function OAuthCallbackPage() {
  const router = useRouter();
  const [msg, setMsg] = useState("Completing sign-in…");

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const err = q.get("oauth_error");
    const token = q.get("access_token");

    if (err) {
      setMsg("Redirecting…");
      router.replace(`/login?oauth_error=${encodeURIComponent(err)}`);
      return;
    }

    if (!token) {
      setMsg("Missing token — redirecting…");
      router.replace("/login?oauth_error=missing_token");
      return;
    }

    saveToken(token);

    (async () => {
      try {
        const me = await apiFetch<Me>("/auth/me");
        localStorage.setItem(
          "gt_user_name",
          me.full_name?.trim() || "Traveler",
        );
        router.replace("/dashboard");
      } catch {
        setMsg("Could not load profile — redirecting…");
        router.replace("/login?oauth_error=profile");
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
