"use client";

import { useEffect, useState } from "react";

import { useDashboardUser } from "@/contexts/dashboard-user-context";

const STORAGE_KEY = "gt_oauth_welcome";

/**
 * One-time modal after successful Google/Facebook sign-in (set in /auth/callback).
 * Explains Gmail / inbox in friendly terms without blocking the app.
 */
export function PostOAuthWelcomeModal() {
  const { user, loading } = useDashboardUser();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || loading) return;
    if (sessionStorage.getItem(STORAGE_KEY) === "1") {
      setOpen(true);
    }
  }, [loading]);

  function dismiss() {
    sessionStorage.removeItem(STORAGE_KEY);
    setOpen(false);
  }

  if (!open || !user) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[3px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="oauth-welcome-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl transition duration-200 ease-out">
        <h2
          id="oauth-welcome-title"
          className="text-lg font-semibold text-slate-900"
        >
          Almost done
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Please confirm your email from your Gmail inbox (or your email
          provider) when we send a verification message. We use{" "}
          <span className="font-medium text-slate-800">{user.email}</span> for
          your account — keep that inbox handy. After you verify, reload this
          site and your dashboard will work as usual.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={dismiss}
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-slate-800"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
