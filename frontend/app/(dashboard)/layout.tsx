"use client";

import { AIAssistantSidecar } from "@/components/ai/AIAssistantSidecar";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { PostOAuthWelcomeModal } from "@/components/PostOAuthWelcomeModal";
import { PresenceHeartbeat } from "@/components/PresenceHeartbeat";
import { VerificationBanner } from "@/components/VerificationBanner";
import {
  DashboardUserProvider,
  useDashboardUser,
} from "@/contexts/dashboard-user-context";
import { apiFetch } from "@/lib/api";
import { clearToken } from "@/lib/auth";

const CORAL = "#E94560";

type PlanOut = {
  plan: string;
  status: string;
  current_period_end: string | null;
};

type NavBadges = {
  has_unread_messages?: boolean;
  unread_notifications?: number;
};

function dicebearLoreleiAvatarSrc(userId: string | null | undefined): string {
  const seed =
    userId && userId.length > 0 ? userId : "travello-user";
  return `https://api.dicebear.com/7.x/lorelei/svg?seed=${encodeURIComponent(seed)}`;
}

function formatDisplayName(full: string | null | undefined): string {
  if (!full?.trim()) return "Traveler";
  return full
    .trim()
    .split(" ")
    .filter(Boolean)
    .map(
      (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
    )
    .join(" ");
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  if (href === "/travel-hub") {
    return pathname === "/travel-hub" || pathname.startsWith("/groups/");
  }
  if (href === "/split-activities") {
    return pathname === "/split-activities";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function IconDoor() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 4h9a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z" />
      <circle cx="10" cy="12" r="1" fill="currentColor" stroke="none" />
      <path d="M16 12h4M18 10l2 2-2 2" />
    </svg>
  );
}

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

const MAIN_NAV: {
  href: string;
  label: string;
  emoji: string;
  kind?: "notifications";
}[] = [
  { href: "/dashboard", label: "Dashboard", emoji: "🏠" },
  { href: "/trips", label: "Trips", emoji: "✈️" },
  { href: "/travel-hub", label: "Travel Hub", emoji: "👥" },
  { href: "/split-activities", label: "Split Activities", emoji: "💸" },
  { href: "/live", label: "Live", emoji: "📍" },
  { href: "/feed", label: "Explore", emoji: "🧭" },
  { href: "/map", label: "Map", emoji: "🗺️" },
  { href: "/weather", label: "Weather", emoji: "🌤️" },
  { href: "/stats", label: "Stats", emoji: "📊" },
  {
    href: "/notifications",
    label: "Notifications",
    emoji: "🔔",
    kind: "notifications",
  },
];

const MOBILE_NAV: { href: string; label: string; emoji: string }[] = [
  { href: "/dashboard", label: "Home", emoji: "🏠" },
  { href: "/trips", label: "Trips", emoji: "✈️" },
  { href: "/travel-hub", label: "Travel Hub", emoji: "👥" },
  { href: "/map", label: "Map", emoji: "🗺️" },
  { href: "/profile", label: "Profile", emoji: "👤" },
];

const PRIMARY_NAV = MAIN_NAV.slice(0, -1);
const NOTIF_NAV = MAIN_NAV[MAIN_NAV.length - 1]!;

function SidebarNavLink({
  href,
  label,
  emoji,
  active,
  notifCount,
  kind,
  iconOnly,
  onNavigate,
}: {
  href: string;
  label: string;
  emoji: string;
  active: boolean;
  notifCount: number;
  kind?: "notifications";
  iconOnly?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      title={iconOnly ? label : undefined}
      onClick={() => onNavigate?.()}
      className={[
        "relative flex items-center gap-2.5 rounded-lg border-l-[3px] py-[9px] text-[13px] font-medium transition-all duration-300 ease-in-out",
        iconOnly
          ? "justify-center px-1 pl-1 pr-1"
          : "pl-[9px] pr-3",
        active
          ? "border-white bg-[#E94560] text-white"
          : "border-transparent text-[rgba(255,255,255,0.65)] hover:bg-[rgba(255,255,255,0.1)] hover:text-white",
      ].join(" ")}
    >
      <span className="inline-flex w-5 shrink-0 justify-center text-base leading-none">
        {emoji}
      </span>
      <span
        className={
          iconOnly
            ? "sr-only"
            : "min-w-0 flex-1 truncate"
        }
      >
        {label}
      </span>
      {!iconOnly && kind === "notifications" && notifCount > 0 ? (
        <span className="inline-flex min-h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white">
          {notifCount > 99 ? "99+" : notifCount}
        </span>
      ) : null}
      {iconOnly && kind === "notifications" && notifCount > 0 ? (
        <span className="absolute right-0.5 top-1 h-1.5 w-1.5 rounded-full bg-red-500 ring-1 ring-[#0F3460]" />
      ) : null}
    </Link>
  );
}

function PlanBadgeFooter({ plan }: { plan: string | null }) {
  const p = plan ?? "free";
  if (p === "free")
    return (
      <span className="inline-flex max-w-full truncate rounded-full bg-[rgba(255,255,255,0.15)] px-2 py-0.5 text-[10px] font-semibold text-[rgba(255,255,255,0.85)]">
        Free
      </span>
    );
  if (p === "pass_3day" || p === "pass_7day")
    return (
      <span
        className="inline-flex max-w-full truncate rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
        style={{ backgroundColor: CORAL }}
      >
        {p === "pass_3day" ? "3-Day Pass" : "7-Day Pass"}
      </span>
    );
  if (p === "pro" || p === "enterprise")
    return (
      <span className="inline-flex max-w-full truncate rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-semibold text-purple-900">
        Pro
      </span>
    );
  return (
    <span className="inline-flex max-w-full truncate rounded-full bg-[rgba(255,255,255,0.15)] px-2 py-0.5 text-[10px] font-semibold text-[rgba(255,255,255,0.85)]">
      {p}
    </span>
  );
}

function DashboardChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useDashboardUser();

  const [plan, setPlan] = useState<PlanOut | null>(null);
  const [planLoading, setPlanLoading] = useState(true);
  const [notifCount, setNotifCount] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMdUp, setIsMdUp] = useState(false);
  const [isLgUp, setIsLgUp] = useState(false);

  useEffect(() => {
    const mqMd = window.matchMedia("(min-width: 768px)");
    const mqLg = window.matchMedia("(min-width: 1024px)");
    const apply = () => {
      const md = mqMd.matches;
      const lg = mqLg.matches;
      setIsMdUp(md);
      setIsLgUp(lg);
      if (lg) setSidebarOpen(false);
    };
    apply();
    mqMd.addEventListener("change", apply);
    mqLg.addEventListener("change", apply);
    return () => {
      mqMd.removeEventListener("change", apply);
      mqLg.removeEventListener("change", apply);
    };
  }, []);

  function handleLogout() {
    clearToken();
    router.push("/login");
  }

  const profileFilled = user?.profile_completion_filled ?? 0;
  const profileTotal = user?.profile_completion_total ?? 6;
  const profileComplete = profileFilled >= profileTotal;
  const showProfileBanner =
    Boolean(user) &&
    !profileComplete &&
    pathname !== "/complete-profile";

  const isMapPage = pathname === "/map";

  useEffect(() => {
    if (loading || !user) return;
    let c = false;
    setPlanLoading(true);
    (async () => {
      try {
        const p = await apiFetch<PlanOut>("/subscriptions/me");
        if (!c) setPlan(p);
      } catch {
        if (!c) setPlan(null);
      } finally {
        if (!c) setPlanLoading(false);
      }
    })();
    return () => {
      c = true;
    };
  }, [loading, user]);

  useEffect(() => {
    if (loading || !user) return;
    let c = false;
    (async () => {
      try {
        const b = await apiFetch<NavBadges>("/users/me/nav-badges");
        if (c) return;
        setNotifCount(
          Math.max(0, Math.floor(b.unread_notifications ?? 0)),
        );
      } catch {
        /* Optional endpoint — keep defaults */
      }
    })();
    return () => {
      c = true;
    };
  }, [loading, user]);

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

  const closeSidebar = () => setSidebarOpen(false);
  const afterNav = () => {
    if (!isLgUp) setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen min-h-[100dvh] bg-[#F8F9FA]">
      {/* Desktop sidebar — lg+ always 220px */}
      <aside className="fixed left-0 top-0 z-40 hidden h-full min-h-screen w-[220px] flex-col bg-[#0F3460] transition-all duration-300 ease-in-out lg:flex">
        <div className="shrink-0 border-b border-[rgba(255,255,255,0.1)] px-4 py-5">
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          >
            <Image
              src="/logo-dark.svg"
              alt=""
              width={36}
              height={36}
              className="h-9 w-9 shrink-0 rounded-md object-contain"
              priority
            />
            <span className="text-lg font-bold tracking-tight text-white">
              travello
            </span>
          </Link>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden px-3 py-3">
          {PRIMARY_NAV.map((item) => (
            <SidebarNavLink
              key={item.href}
              href={item.href}
              label={item.label}
              emoji={item.emoji}
              active={isActive(pathname, item.href)}
              notifCount={notifCount}
            />
          ))}
          <div
            className="my-2 h-px shrink-0 bg-[rgba(255,255,255,0.1)]"
            aria-hidden
          />
          <SidebarNavLink
            href={NOTIF_NAV.href}
            label={NOTIF_NAV.label}
            emoji={NOTIF_NAV.emoji}
            active={isActive(pathname, NOTIF_NAV.href)}
            notifCount={notifCount}
            kind="notifications"
          />
        </nav>

        <div className="shrink-0 border-t border-[rgba(255,255,255,0.1)] p-3">
          <div className="flex items-center gap-2">
            <div
              role="button"
              tabIndex={0}
              className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg p-1 transition-colors hover:bg-[rgba(255,255,255,0.06)]"
              onClick={() => router.push("/profile")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  router.push("/profile");
                }
              }}
            >
              <img
                src={dicebearLoreleiAvatarSrc(user?.id)}
                alt=""
                width={34}
                height={34}
                className="h-[34px] w-[34px] shrink-0 rounded-full border border-[rgba(255,255,255,0.2)] bg-white/10 object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-white">
                  {formatDisplayName(user?.full_name)}
                </p>
                <div className="mt-0.5">
                  {planLoading ? (
                    <span className="inline-block h-4 w-14 animate-pulse rounded-full bg-[rgba(255,255,255,0.15)]" />
                  ) : (
                    <PlanBadgeFooter plan={plan?.plan ?? null} />
                  )}
                </div>
              </div>
            </div>
            <button
              type="button"
              title="Sign out"
              onClick={handleLogout}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[rgba(255,255,255,0.4)] transition-colors hover:text-[rgba(255,255,255,0.8)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              aria-label="Sign out"
            >
              <IconDoor />
            </button>
          </div>
        </div>
      </aside>

      {/* Tablet collapsed rail — md only, 64px icons */}
      <aside className="fixed left-0 top-0 z-40 hidden h-full min-h-screen w-[64px] flex-col bg-[#0F3460] transition-all duration-300 ease-in-out md:flex lg:hidden">
        <div className="flex shrink-0 flex-col items-center border-b border-[rgba(255,255,255,0.1)] px-1 py-3">
          <button
            type="button"
            aria-label="Expand sidebar"
            className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-lg text-2xl text-[#E94560] transition-colors hover:bg-[rgba(255,255,255,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            onClick={() => setSidebarOpen(true)}
          >
            ☰
          </button>
          <Link
            href="/dashboard"
            className="flex items-center justify-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            title="travello"
          >
            <Image
              src="/logo-dark.svg"
              alt=""
              width={36}
              height={36}
              className="h-9 w-9 shrink-0 rounded-md object-contain"
              priority
            />
          </Link>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden px-1 py-2">
          {PRIMARY_NAV.map((item) => (
            <SidebarNavLink
              key={item.href}
              href={item.href}
              label={item.label}
              emoji={item.emoji}
              active={isActive(pathname, item.href)}
              notifCount={notifCount}
              iconOnly
              onNavigate={afterNav}
            />
          ))}
          <div
            className="my-2 h-px shrink-0 bg-[rgba(255,255,255,0.1)]"
            aria-hidden
          />
          <SidebarNavLink
            href={NOTIF_NAV.href}
            label={NOTIF_NAV.label}
            emoji={NOTIF_NAV.emoji}
            active={isActive(pathname, NOTIF_NAV.href)}
            notifCount={notifCount}
            kind="notifications"
            iconOnly
            onNavigate={afterNav}
          />
        </nav>

        <div className="mt-auto flex shrink-0 flex-col items-center gap-2 border-t border-[rgba(255,255,255,0.1)] p-2">
          <button
            type="button"
            title={formatDisplayName(user?.full_name)}
            className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            onClick={() => {
              router.push("/profile");
              afterNav();
            }}
          >
            <img
              src={dicebearLoreleiAvatarSrc(user?.id)}
              alt=""
              width={32}
              height={32}
              className="h-8 w-8 rounded-full border border-[rgba(255,255,255,0.2)] bg-white/10 object-cover"
            />
          </button>
          <button
            type="button"
            title="Sign out"
            onClick={handleLogout}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[rgba(255,255,255,0.4)] transition-colors hover:text-[rgba(255,255,255,0.8)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            aria-label="Sign out"
          >
            <IconDoor />
          </button>
        </div>
      </aside>

      {/* Slide-over drawer — tablet + mobile when open (ignored on lg+) */}
      {sidebarOpen && !isLgUp ? (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-[3000] bg-[rgba(0,0,0,0.5)] transition-opacity duration-300"
            onClick={closeSidebar}
          />
          <aside className="fixed left-0 top-0 z-[3010] flex h-full min-h-0 w-[220px] flex-col bg-[#0F3460] shadow-2xl transition-all duration-300 ease-in-out md:left-[64px]">
            <div className="shrink-0 border-b border-[rgba(255,255,255,0.1)] px-4 py-5">
              <Link
                href="/dashboard"
                onClick={afterNav}
                className="flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-white/50"
              >
                <Image
                  src="/logo-dark.svg"
                  alt=""
                  width={36}
                  height={36}
                  className="h-9 w-9 shrink-0 rounded-md object-contain"
                  priority
                />
                <span className="text-lg font-bold tracking-tight text-white">
                  travello
                </span>
              </Link>
            </div>

            <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden px-3 py-3">
              {PRIMARY_NAV.map((item) => (
                <SidebarNavLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  emoji={item.emoji}
                  active={isActive(pathname, item.href)}
                  notifCount={notifCount}
                  onNavigate={afterNav}
                />
              ))}
              <div
                className="my-2 h-px shrink-0 bg-[rgba(255,255,255,0.1)]"
                aria-hidden
              />
              <SidebarNavLink
                href={NOTIF_NAV.href}
                label={NOTIF_NAV.label}
                emoji={NOTIF_NAV.emoji}
                active={isActive(pathname, NOTIF_NAV.href)}
                notifCount={notifCount}
                kind="notifications"
                onNavigate={afterNav}
              />
            </nav>

            <div className="shrink-0 border-t border-[rgba(255,255,255,0.1)] p-3">
              <div className="flex items-center gap-2">
                <div
                  role="button"
                  tabIndex={0}
                  className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg p-1 transition-colors hover:bg-[rgba(255,255,255,0.06)]"
                  onClick={() => {
                    router.push("/profile");
                    afterNav();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      router.push("/profile");
                      afterNav();
                    }
                  }}
                >
                  <img
                    src={dicebearLoreleiAvatarSrc(user?.id)}
                    alt=""
                    width={34}
                    height={34}
                    className="h-[34px] w-[34px] shrink-0 rounded-full border border-[rgba(255,255,255,0.2)] bg-white/10 object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-white">
                      {formatDisplayName(user?.full_name)}
                    </p>
                    <div className="mt-0.5">
                      {planLoading ? (
                        <span className="inline-block h-4 w-14 animate-pulse rounded-full bg-[rgba(255,255,255,0.15)]" />
                      ) : (
                        <PlanBadgeFooter plan={plan?.plan ?? null} />
                      )}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  title="Sign out"
                  onClick={handleLogout}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[rgba(255,255,255,0.4)] transition-colors hover:text-[rgba(255,255,255,0.8)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                  aria-label="Sign out"
                >
                  <IconDoor />
                </button>
              </div>
            </div>
          </aside>
        </>
      ) : null}

      <div
        className={
          isMapPage
            ? "flex min-h-screen min-h-[100dvh] flex-col transition-all duration-300 ease-in-out max-md:ml-0 md:ml-[64px] lg:ml-[220px]"
            : "flex min-h-screen min-h-[100dvh] flex-col pb-[72px] transition-all duration-300 ease-in-out max-md:ml-0 md:ml-[64px] lg:ml-[220px] md:pb-0"
        }
      >
        {!isMdUp ? (
          <header className="relative sticky top-0 z-30 flex h-[52px] shrink-0 items-center border-b border-[#E9ECEF] bg-white px-3">
            <button
              type="button"
              aria-label="Open menu"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-2xl text-[#E94560] transition-colors hover:bg-[#F8F9FA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E94560]/40"
              onClick={() => setSidebarOpen(true)}
            >
              ☰
            </button>
            <div className="flex min-w-0 flex-1 justify-center px-2">
              {!isMapPage ? (
                <Image
                  src="/logo-light.svg"
                  alt="Travello"
                  width={200}
                  height={60}
                  className="h-8 w-auto max-w-[160px]"
                  priority
                />
              ) : (
                <span className="text-[15px] font-semibold text-[#0F3460]">
                  Map
                </span>
              )}
            </div>
            <Link
              href="/notifications"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[#6C757D] transition-colors hover:bg-[#F8F9FA] hover:text-[#0F3460] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E94560]/40"
              aria-label="Notifications"
            >
              <BellIcon className="h-6 w-6" />
            </Link>
          </header>
        ) : null}

        <main
          className={
            isMapPage
              ? "flex min-h-0 flex-1 flex-col overflow-hidden bg-white p-0"
              : "min-h-0 flex-1 bg-[#F8F9FA] p-3 md:p-5"
          }
        >
          {isMapPage ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
              <div className="sr-only" aria-hidden>
                <PresenceHeartbeat />
              </div>
              <PostOAuthWelcomeModal />
              <VerificationBanner />
              <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
                {children}
              </div>
            </div>
          ) : (
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
              <PresenceHeartbeat />
              <PostOAuthWelcomeModal />
              <VerificationBanner />
              {showProfileBanner ? (
                <div className="border-b border-slate-200/80 bg-gradient-to-r from-slate-50 via-white to-emerald-50/40 px-4 py-3">
                  <div className="flex max-w-4xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <span
                        className="mt-0.5 inline-flex h-2 w-2 shrink-0 rounded-full bg-slate-400 ring-4 ring-slate-200/80"
                        aria-hidden
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">
                          Complete your profile
                        </p>
                        <p className="mt-0.5 text-xs text-slate-600">
                          {profileFilled} of {profileTotal} details added — finish
                          anytime for recovery and a better experience.
                        </p>
                      </div>
                    </div>
                    <Link
                      href="/complete-profile"
                      className="inline-flex shrink-0 items-center justify-center rounded-xl bg-[#E94560] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E94560]/40"
                    >
                      Complete now
                    </Link>
                  </div>
                </div>
              ) : null}
              <div className="w-full">{children}</div>
            </div>
          )}
        </main>

        <nav className="fixed bottom-0 left-0 right-0 z-30 flex border-t border-[#E9ECEF] bg-white px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden">
          <div className="mx-auto flex w-full max-w-lg justify-between">
            {MOBILE_NAV.map(({ href, label, emoji }) => {
              const active = isActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  className="flex min-w-0 flex-1 flex-col items-center gap-1 py-1"
                >
                  <span
                    className={`text-lg leading-none ${
                      active ? "text-[#E94560]" : "text-[#6C757D]"
                    }`}
                    aria-hidden
                  >
                    {emoji}
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

      {user ? (
        <AIAssistantSidecar
          page={
            pathname
              .replace(/^\//, "")
              .replace(/\//g, "_")
              .slice(0, 100) || "dashboard"
          }
          tripId={(() => {
            const p = pathname.split("/").filter(Boolean);
            if (p[0] === "trips" && p[1] && p[1] !== "plan") return p[1];
            return undefined;
          })()}
          groupId={(() => {
            const p = pathname.split("/").filter(Boolean);
            if (p[0] === "groups" && p[1] && p[1] !== "new") return p[1];
            return undefined;
          })()}
          context={{ pathname }}
          className="!z-[100] max-md:bottom-20"
        />
      ) : null}
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
