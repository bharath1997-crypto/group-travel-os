"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactElement, ReactNode } from "react";

import { NotificationBell } from "@/components/NotificationBell";
import { PostOAuthWelcomeModal } from "@/components/PostOAuthWelcomeModal";
import { ProfileCompletionBanner } from "@/components/ProfileCompletionBanner";
import { PresenceHeartbeat } from "@/components/PresenceHeartbeat";
import { VerificationBanner } from "@/components/VerificationBanner";
import {
  DashboardUserProvider,
  useDashboardUser,
  type DashboardUser,
} from "@/contexts/dashboard-user-context";
import { clearToken } from "@/lib/auth";
import { clearLocalProfileCache } from "@/lib/profileCache";

/** Google / Facebook and other OAuth providers store the picture in avatar_url. */
function userAvatarSrc(user: DashboardUser | null | undefined): string {
  const url = user?.avatar_url?.trim();
  if (url) return url;
  const seed =
    user?.id && user.id.length > 0 ? user.id : "travello-user";
  return `https://api.dicebear.com/7.x/lorelei/svg?seed=${encodeURIComponent(seed)}`;
}

type NavDef = { href: string; label: string; Icon: () => ReactElement };

function IconHome() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function IconPlane() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
    </svg>
  );
}

function IconPeople() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconPin() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 21c-4-3-7-6-7-9a7 7 0 1114 0c0 3-3 6-7 9z" />
      <circle cx="12" cy="11" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconCompass() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  );
}

function IconMap() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
      <line x1="8" y1="2" x2="8" y2="18" />
      <line x1="16" y1="6" x2="16" y2="22" />
    </svg>
  );
}

function IconCloud() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
    </svg>
  );
}

function IconChart() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function IconPerson() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c1.5-4 4-6 8-6s6.5 2 8 6" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}

/** Door + exit — sign out */
function IconDoor() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 4h9a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z" />
      <circle cx="10" cy="12" r="1" fill="currentColor" stroke="none" />
      <path d="M16 12h4M18 10l2 2-2 2" />
    </svg>
  );
}

function IconUserCircle() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="9" r="3.5" />
      <path d="M6.5 19.5c.8-3.5 3.5-5.5 5.5-5.5s4.7 2 5.5 5.5" />
    </svg>
  );
}

const SIDEBAR_NAV: NavDef[] = [
  { href: "/dashboard", label: "Dashboard", Icon: IconHome },
  { href: "/trips", label: "Trips", Icon: IconPlane },
  { href: "/groups", label: "Groups", Icon: IconPeople },
  { href: "/live", label: "Live", Icon: IconPin },
  { href: "/feed", label: "Explore", Icon: IconCompass },
  { href: "/map", label: "Map", Icon: IconMap },
  { href: "/weather", label: "Weather", Icon: IconCloud },
  { href: "/stats", label: "Stats", Icon: IconChart },
  { href: "/profile", label: "Profile", Icon: IconPerson },
  { href: "/settings", label: "Settings", Icon: IconSettings },
];

const MOBILE_NAV: { href: string; label: string; Icon: () => ReactElement }[] = [
  { href: "/dashboard", label: "Home", Icon: IconHome },
  { href: "/trips", label: "Trips", Icon: IconPlane },
  { href: "/groups", label: "Groups", Icon: IconPeople },
  { href: "/live", label: "Live", Icon: IconPin },
  { href: "/profile", label: "Profile", Icon: IconUserCircle },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function DashboardChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useDashboardUser();

  const username =
    user && typeof user === "object" && "username" in user
      ? (user as { username?: string | null }).username
      : null;

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
      <div className="flex min-h-screen items-center justify-center bg-[#F8F9FA]">
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-[#E9ECEF] border-t-[#E94560]"
          aria-hidden
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside
        className="hidden w-[240px] shrink-0 flex-col bg-[#0F3460] md:flex"
      >
        <div className="px-4 pt-6">
          <Link
            href="/dashboard"
            className="block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          >
            <Image
              src="/logo-dark.svg"
              alt="Travello"
              width={200}
              height={60}
              className="h-10 w-auto max-w-[200px]"
              priority
            />
          </Link>
        </div>

        <nav className="mt-8 flex flex-1 flex-col gap-1 overflow-y-auto px-3 pb-4">
          {SIDEBAR_NAV.map(({ href, label, Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                className={[
                  "flex items-center gap-3 rounded-lg border-l-[3px] px-3 py-2.5 text-sm font-semibold transition-colors",
                  active
                    ? "border-l-white bg-[#E94560] text-white shadow-sm"
                    : "border-l-transparent text-white/70 hover:bg-[rgba(255,255,255,0.1)] hover:text-white",
                ].join(" ")}
              >
                <span className={active ? "text-white" : "text-inherit"}>
                  <Icon />
                </span>
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/30 px-4 py-4">
          <div className="flex items-start gap-3">
            <img
              src={userAvatarSrc(user)}
              alt=""
              width={36}
              height={36}
              className="h-9 w-9 shrink-0 rounded-full border-2 border-white/30 bg-white/10 object-cover"
            />
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="truncate text-sm font-semibold text-white">
                {user?.full_name ?? "Traveler"}
              </p>
              {username ? (
                <p className="truncate text-xs text-white/70">@{username}</p>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Sign out"
          >
            <IconDoor />
            <span className="text-sm font-medium">Sign out</span>
          </button>
        </div>
      </aside>

      <div className="flex min-h-screen min-h-[100dvh] flex-1 flex-col pb-[72px] md:pb-0">
        <header className="sticky top-0 z-20 grid w-full grid-cols-[1fr_auto_1fr] items-center border-b border-[#E9ECEF] bg-white px-3 py-2.5 md:hidden">
          <span className="w-9" aria-hidden />
          <div className="flex justify-center">
            <Image
              src="/logo-light.svg"
              alt="Travello"
              width={200}
              height={60}
              className="h-8 w-auto max-w-[160px]"
              priority
            />
          </div>
          <div className="flex justify-end pr-1">
            <NotificationBell variant="light" />
          </div>
        </header>

        <div className="hidden justify-end border-b border-[#E9ECEF] bg-white px-6 py-2 md:flex">
          <NotificationBell variant="light" />
        </div>

        <main className="min-h-0 flex-1 bg-[#F8F9FA] p-6">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
            <PresenceHeartbeat />
            <PostOAuthWelcomeModal />
            <VerificationBanner />
            {showProfileBanner ? (
              <ProfileCompletionBanner
                filled={profileFilled}
                total={profileTotal}
              />
            ) : null}
            <div className="w-full">{children}</div>
          </div>
        </main>

        <nav className="fixed bottom-0 left-0 right-0 z-30 flex border-t border-[#E9ECEF] bg-white px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden">
          <div className="mx-auto flex w-full max-w-lg justify-between">
            {MOBILE_NAV.map(({ href, label, Icon }) => {
              const active = isActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  className="flex min-w-0 flex-1 flex-col items-center gap-1 py-1"
                >
                  <span
                    className={active ? "text-[#E94560]" : "text-[#6C757D]"}
                  >
                    <Icon />
                  </span>
                  <span
                    className={`max-w-full truncate text-[10px] font-semibold ${
                      active ? "text-[#E94560]" : "text-[#6C757D]"
                    }`}
                  >
                    {label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <DashboardUserProvider>
      <DashboardChrome>{children}</DashboardChrome>
    </DashboardUserProvider>
  );
}
