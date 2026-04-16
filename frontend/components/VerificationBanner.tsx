"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useDashboardUser } from "@/contexts/dashboard-user-context";
import { goToVerifyEmail } from "@/lib/verification";

const SESSION_KEY = "gt_verify_banner_dismissed";

export function VerificationBanner() {
  const { user } = useDashboardUser();
  const router = useRouter();
  const [dismissed, setDismissed] = useState(true);

  const needsVerify = Boolean(user && user.is_verified === false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(sessionStorage.getItem(SESSION_KEY) === "1");
  }, []);

  if (!needsVerify || dismissed) return null;

  function dismiss() {
    sessionStorage.setItem(SESSION_KEY, "1");
    setDismissed(true);
  }

  return (
    <div
      className="border-b border-amber-100/90 bg-gradient-to-r from-amber-50/95 via-orange-50/80 to-amber-50/90 px-4 py-3 shadow-sm transition-all duration-300 ease-out"
      role="region"
      aria-label="Email verification"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700"
            aria-hidden
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="h-4 w-4"
            >
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <path d="m22 6-10 7L2 6" />
            </svg>
          </span>
          <p className="text-sm leading-snug text-amber-950">
            <span className="font-medium">
              Your account is temporary until email verification is completed.
            </span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:justify-end">
          <button
            type="button"
            onClick={() => goToVerifyEmail(router)}
            className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-500"
          >
            Verify now
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-xl px-3 py-2 text-sm font-medium text-amber-900/80 transition hover:bg-amber-100/80"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
