"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useDashboardUser } from "@/contexts/dashboard-user-context";
import { goToVerifyEmail } from "@/lib/verification";

function BellIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

type BellVariant = "light" | "dark";

export function NotificationBell({ variant = "light" }: { variant?: BellVariant }) {
  const { user } = useDashboardUser();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const needsVerify = Boolean(user && user.is_verified === false);

  const btnCls =
    variant === "dark"
      ? "relative flex h-10 w-10 items-center justify-center rounded-xl text-slate-300 transition-colors duration-200 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      : "relative flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30";

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (!user) return null;

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={btnCls}
        aria-label="Notifications"
        aria-expanded={open}
      >
        <BellIcon className="h-5 w-5" />
        {needsVerify ? (
          <span
            className={`absolute right-2 top-2 h-2 w-2 rounded-full bg-amber-400 shadow-sm ring-2 ${
              variant === "dark" ? "ring-gray-900" : "ring-white"
            }`}
            aria-hidden
          />
        ) : null}
      </button>

      {open ? (
        <div
          className="absolute right-0 z-[120] mt-2 w-[min(100vw-2rem,20rem)] origin-top-right rounded-2xl border border-slate-200/80 bg-white py-2 shadow-[0_16px_40px_-12px_rgba(15,23,42,0.25)] transition duration-200 ease-out md:mt-1.5"
          role="menu"
        >
          {needsVerify ? (
            <div className="border-b border-slate-100 px-3 pb-3 pt-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Notifications
              </p>
              <div className="mt-2 rounded-xl bg-amber-50/90 p-3 ring-1 ring-amber-100/80">
                <p className="text-sm font-semibold text-amber-950">
                  Verify your email
                </p>
                <p className="mt-1 text-xs leading-relaxed text-amber-900/85">
                  Please verify your email to activate all features
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    goToVerifyEmail(router);
                  }}
                  className="mt-3 w-full rounded-lg bg-amber-600 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-amber-500"
                >
                  Verify now
                </button>
              </div>
            </div>
          ) : (
            <div className="px-4 py-6 text-center">
              <p className="text-sm text-slate-500">You&apos;re all caught up.</p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
