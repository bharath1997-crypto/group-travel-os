"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { ProfileAvatarBadge } from "@/components/ProfileAvatarBadge";
import type { DashboardUser } from "@/contexts/dashboard-user-context";
import { useDashboardUser } from "@/contexts/dashboard-user-context";
import { goToVerifyEmail } from "@/lib/verification";

function avatarSeed(user: DashboardUser | null): string {
  const name = user?.full_name?.trim() || "";
  if (name) return name;
  return user?.email?.trim() || "Traveler";
}

function Chevron({
  open,
  className = "text-slate-500",
}: {
  open: boolean;
  className?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className={`h-4 w-4 shrink-0 transition-transform duration-200 ${className} ${
        open ? "rotate-180" : ""
      }`}
      aria-hidden
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

type Props = {
  /** Pixel size passed to ProfileAvatarBadge */
  avatarSize: number;
  /** Sidebar: centered column; header: row next to logo */
  layout: "sidebar" | "header";
  onLogout: () => void;
};

export function ProfileDropdown({ avatarSize, layout, onLogout }: Props) {
  const { user } = useDashboardUser();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const seed = avatarSeed(user);
  const profileFilled = user?.profile_completion_filled ?? 0;
  const profileTotal = user?.profile_completion_total ?? 6;
  const needsVerify = user?.is_verified === false;
  const profileComplete = profileFilled >= profileTotal;
  const avatarHrefTarget = profileComplete ? "/settings" : "/complete-profile";

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (!user) return null;

  const menuPosition =
    layout === "sidebar"
      ? "left-1/2 top-full z-[130] mt-2 w-64 -translate-x-1/2"
      : "right-0 top-full z-[130] mt-2 w-72";

  return (
    <div
      className={
        layout === "sidebar"
          ? "relative flex flex-col items-center"
          : "relative flex items-center gap-1"
      }
      ref={wrapRef}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={
          layout === "sidebar"
            ? "flex flex-col items-center gap-1.5 rounded-xl p-1 outline-none ring-offset-2 ring-offset-gray-900 transition hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-white/40"
            : "flex items-center gap-0.5 rounded-xl p-0.5 outline-none ring-offset-2 ring-offset-gray-900 transition hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/40"
        }
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Account menu"
      >
        <span
          className={
            layout === "sidebar"
              ? "flex items-center gap-0.5"
              : "flex items-center gap-0.5"
          }
        >
          <ProfileAvatarBadge
            name={seed}
            src={user.avatar_url}
            size={avatarSize}
            profileFilled={profileFilled}
            profileTotal={profileTotal}
            needsEmailVerification={needsVerify}
            href=""
          />
          <Chevron
            open={open}
            className={layout === "header" ? "text-white/80" : "text-slate-400"}
          />
        </span>
      </button>

      {layout === "sidebar" ? (
        <p className="mt-0.5 max-w-[10rem] truncate text-center text-xs font-medium text-white">
          {user.full_name?.trim() || "Traveler"}
        </p>
      ) : null}

      {open ? (
        <div
          className={`absolute ${menuPosition} origin-top rounded-2xl border border-slate-200/90 bg-white py-1 shadow-[0_20px_50px_-12px_rgba(15,23,42,0.25)] transition duration-200 ease-out`}
          role="menu"
        >
          {needsVerify ? (
            <div className="border-b border-amber-100 bg-amber-50/90 px-3 py-3">
              <p className="text-sm font-semibold text-amber-950">
                Your account is not verified
              </p>
              <p className="mt-1 text-xs leading-relaxed text-amber-900/85">
                Verify your email to unlock full access
              </p>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  goToVerifyEmail(router);
                }}
                className="mt-2 w-full rounded-lg bg-amber-600 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-amber-500"
              >
                Verify Now
              </button>
            </div>
          ) : null}

          <Link
            href={avatarHrefTarget}
            role="menuitem"
            className="block px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50"
            onClick={() => setOpen(false)}
          >
            {profileComplete ? "Profile & settings" : "Complete profile"}
          </Link>
          <Link
            href="/settings"
            role="menuitem"
            className="block px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50"
            onClick={() => setOpen(false)}
          >
            Settings
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
            className="w-full px-4 py-2.5 text-left text-sm text-red-600 transition hover:bg-red-50"
          >
            Log out
          </button>
        </div>
      ) : null}
    </div>
  );
}
