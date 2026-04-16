"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { AppLogo } from "@/components/AppLogo";
import { NotificationBell } from "@/components/NotificationBell";
import { PostOAuthWelcomeModal } from "@/components/PostOAuthWelcomeModal";
import { ProfileCompletionBanner } from "@/components/ProfileCompletionBanner";
import { PresenceHeartbeat } from "@/components/PresenceHeartbeat";
import { ProfileDropdown } from "@/components/ProfileDropdown";
import { VerificationBanner } from "@/components/VerificationBanner";
import { useDashboardUser } from "@/contexts/dashboard-user-context";
import { clearToken } from "@/lib/auth";
import { clearLocalProfileCache } from "@/lib/profileCache";

type NavItem = {
  href: string;
  label: string;
  mapPin?: boolean;
};

const nav: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/trips", label: "Trips" },
  { href: "/groups", label: "Groups" },
  { href: "/feed", label: "Feed" },
  { href: "/map", label: "Map", mapPin: true },
  { href: "/weather", label: "Weather" },
  { href: "/stats", label: "My Stats" },
  { href: "/settings", label: "Settings" },
];

function MapPinIcon({ className }: { className?: string }) {
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
      <path d="M12 21c-4-3-7-6-7-9a7 7 0 1114 0c0 3-3 6-7 9z" />
      <circle cx="12" cy="11" r="2.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useDashboardUser();

  function handleLogout() {
    clearToken();
    clearLocalProfileCache();
    router.replace("/login");
  }

  const profileFilled = user?.profile_completion_filled ?? 0;
  const profileTotal = user?.profile_completion_total ?? 6;
  const profileComplete = profileFilled >= profileTotal;
  const showProfileBanner =
    Boolean(user) &&
    !profileComplete &&
    pathname !== "/complete-profile";

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-white">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-gray-800 bg-gray-900 text-gray-100 md:flex">
        <div className="border-b border-gray-800 px-4 py-4">
          <Link
            href="/dashboard"
            className="inline-block outline-none ring-offset-2 ring-offset-gray-900 focus-visible:ring-2 focus-visible:ring-white/50"
          >
            <AppLogo variant="onDark" className="h-8 w-auto max-w-[11rem]" />
          </Link>
        </div>
        <div className="flex flex-col items-center border-b border-gray-800/80 px-3 pb-4 pt-5">
          <ProfileDropdown
            layout="sidebar"
            avatarSize={64}
            onLogout={handleLogout}
          />
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {nav.map(({ href, label, mapPin }) => {
            const active =
              pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-gray-800 text-white"
                    : "text-gray-300 hover:bg-gray-800/80 hover:text-white"
                }`}
              >
                {mapPin ? (
                  <MapPinIcon className="h-4 w-4 shrink-0 opacity-90" />
                ) : null}
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <div className="hidden border-b border-slate-200/90 bg-white/95 px-4 py-2 shadow-sm backdrop-blur-sm md:flex md:items-center md:justify-end">
          <NotificationBell variant="light" />
        </div>

        <header className="border-b border-gray-200 bg-gray-900 px-3 py-3 md:hidden">
          <div className="mb-3 grid grid-cols-[auto_1fr_auto] items-center gap-2">
            <NotificationBell variant="dark" />
            <div className="flex justify-center">
              <AppLogo variant="onDark" className="h-7 w-auto max-w-[9rem]" />
            </div>
            <ProfileDropdown
              layout="header"
              avatarSize={40}
              onLogout={handleLogout}
            />
          </div>
          <nav className="flex flex-wrap gap-1">
            {nav.map(({ href, label, mapPin }) => (
              <Link
                key={href}
                href={href}
                className="inline-flex items-center gap-1 rounded-md bg-gray-800 px-2 py-1 text-xs text-gray-200"
              >
                {mapPin ? <MapPinIcon className="h-3.5 w-3.5" /> : null}
                {label}
              </Link>
            ))}
          </nav>
        </header>

        <main className="flex-1 overflow-auto">
          <PresenceHeartbeat />
          <PostOAuthWelcomeModal />
          <VerificationBanner />
          {showProfileBanner ? (
            <ProfileCompletionBanner filled={profileFilled} total={profileTotal} />
          ) : null}
          {children}
        </main>
      </div>
    </div>
  );
}
