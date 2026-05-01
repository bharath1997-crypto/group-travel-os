"use client";

import { AIAssistantSidecar } from "@/components/ai/AIAssistantSidecar";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import {
  IconBanknote,
  IconBarChart,
  IconBell,
  IconCheck,
  IconCloudSun,
  IconCompass,
  IconLayoutDashboard,
  IconLive,
  IconLogout,
  IconMap,
  IconMenu,
  IconMoreHorizontal,
  IconPlane,
  IconSettings,
  IconUser,
  IconUsers,
  type IconComponent,
} from "@/components/icons";

import { PostOAuthWelcomeModal } from "@/components/PostOAuthWelcomeModal";
import { PresenceHeartbeat } from "@/components/PresenceHeartbeat";
import { VerificationBanner } from "@/components/VerificationBanner";
import TravelloLogo from "@/components/TravelloLogo";
import {
  DashboardUserProvider,
  useDashboardUser,
} from "@/contexts/dashboard-user-context";
import { API_BASE, apiFetch } from "@/lib/api";
import { clearToken } from "@/lib/auth";

const CORAL = "#E94560";

const GT_NOTIFICATIONS_UNREAD = "gt-notifications-unread";

/** GET /auth/me fields used for sidebar photo + name row (fetch uses gt_token in layout only). */
type SidebarAuthMe = {
  full_name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
  google_picture?: string | null;
  facebook_picture?: string | null;
  subscription_tier?: string | null;
};

function pickProfilePicUrl(me: SidebarAuthMe | null): string | null {
  if (!me) return null;
  const a = me.avatar_url?.trim();
  if (a) return a;
  const g = me.google_picture?.trim();
  if (g) return g;
  const f = me.facebook_picture?.trim();
  if (f) return f;
  return null;
}

function initialsFromFullName(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) {
    const w = parts[0]!;
    return w.length >= 2
      ? (w[0]! + w[1]!).toUpperCase()
      : w[0]!.toUpperCase();
  }
  const first = parts[0]!;
  const last = parts[parts.length - 1]!;
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase() || "?";
}

function deterministicAvatarBg(name: string): string {
  const s = name.trim() || "?";
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = s.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0;
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h} 48% 42%)`;
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

/** Bottom nav "Explore" and More sheet targets */
function isExploreNavActive(pathname: string): boolean {
  return pathname === "/explore" || pathname.startsWith("/explore/");
}

const MOBILE_MORE_LINKS: {
  href: string;
  label: string;
  Icon: IconComponent;
}[] = [
  { href: "/split-activities", label: "Split Activities", Icon: IconBanknote },
  { href: "/map", label: "Map", Icon: IconMap },
  { href: "/stats", label: "Stats", Icon: IconBarChart },
  { href: "/notifications", label: "Notifications", Icon: IconBell },
  { href: "/weather", label: "Weather", Icon: IconCloudSun },
  { href: "/settings", label: "Settings", Icon: IconSettings },
  { href: "/profile", label: "Profile", Icon: IconUser },
];

function isMoreNavActive(pathname: string): boolean {
  return MOBILE_MORE_LINKS.some(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
}

/** All six verifications from GET /auth/me — not profile_completion_filled. */
function isProfileFullyComplete(
  u: {
    email_verified?: boolean;
    is_verified?: boolean;
    phone?: string | null;
    google_sub?: string | null;
    whatsapp_verified?: boolean;
    instagram_handle?: string | null;
    username?: string | null;
  } | null | undefined,
): boolean {
  if (!u) return false;
  const emailOk = u.email_verified === true || u.is_verified === true;
  const phoneOk = Boolean(u.phone && String(u.phone).trim());
  const googleOk = Boolean(u.google_sub && String(u.google_sub).trim());
  const waOk = u.whatsapp_verified === true;
  const igOk = Boolean(u.instagram_handle && String(u.instagram_handle).trim());
  const userOk = Boolean(u.username && String(u.username).trim());
  return emailOk && phoneOk && googleOk && waOk && igOk && userOk;
}

const MAIN_NAV: {
  href: string;
  label: string;
  Icon: IconComponent;
  kind?: "notifications";
}[] = [
  { href: "/dashboard", label: "Dashboard", Icon: IconLayoutDashboard },
  { href: "/trips", label: "Trips", Icon: IconPlane },
  { href: "/travel-hub", label: "Connect", Icon: IconUsers },
  { href: "/split-activities", label: "Split Activities", Icon: IconBanknote },
  { href: "/live", label: "Live", Icon: IconLive },
  { href: "/feed", label: "Explore", Icon: IconCompass },
  { href: "/map", label: "Map", Icon: IconMap },
  { href: "/weather", label: "Weather", Icon: IconCloudSun },
  { href: "/stats", label: "Stats", Icon: IconBarChart },
  {
    href: "/notifications",
    label: "Notifications",
    Icon: IconBell,
    kind: "notifications",
  },
];

const PRIMARY_NAV = MAIN_NAV.slice(0, -1);
const NOTIF_NAV = MAIN_NAV[MAIN_NAV.length - 1]!;

function SidebarNavLink({
  href,
  label,
  Icon,
  active,
  notifCount,
  kind,
  iconOnly,
  onNavigate,
}: {
  href: string;
  label: string;
  Icon: IconComponent;
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
      <span className="inline-flex w-5 shrink-0 justify-center leading-none">
        <Icon size={20} darkBg active={active} className="shrink-0" aria-hidden />
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
        <span className="absolute -right-1 -top-1 flex min-h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-semibold leading-none text-white ring-2 ring-[#0F3460]">
          {notifCount > 99 ? "99+" : notifCount}
        </span>
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

const SIDEBAR_AVATAR_IMG_STYLE: CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: "50%",
  objectFit: "cover",
  border: "2px solid rgba(255,255,255,0.2)",
};

function SidebarProfileAvatar({
  profilePicUrl,
  displayName,
  profileComplete,
}: {
  profilePicUrl: string | null;
  displayName: string;
  profileComplete: boolean;
}) {
  const [useInitials, setUseInitials] = useState(() => !profilePicUrl);
  const initials = initialsFromFullName(displayName);
  const bg = deterministicAvatarBg(displayName);

  useEffect(() => {
    setUseInitials(!profilePicUrl);
  }, [profilePicUrl]);

  const ringClass = profileComplete
    ? "ring-2 ring-emerald-500 ring-offset-2 ring-offset-[#0F3460]"
    : "ring-2 ring-red-500 ring-offset-2 ring-offset-[#0F3460]";

  return (
    <span className="relative inline-flex shrink-0">
      {useInitials ? (
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-full border-2 border-[rgba(255,255,255,0.2)] text-xs font-bold text-white ${ringClass}`}
          style={{ background: bg }}
          aria-hidden
        >
          {initials}
        </span>
      ) : (
        <span className={`relative inline-flex rounded-full ${ringClass}`}>
          <img
            src={profilePicUrl!}
            alt={displayName}
            style={SIDEBAR_AVATAR_IMG_STYLE}
            onError={(e) => {
              e.currentTarget.style.display = "none";
              setUseInitials(true);
            }}
          />
        </span>
      )}
      {profileComplete ? (
        <span
          className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 text-white ring-2 ring-[#0F3460]"
          aria-hidden
        >
          <IconCheck size={10} darkBg />
        </span>
      ) : (
        <span
          className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-red-500 bg-[#0F3460] ring-2 ring-[#0F3460]"
          aria-hidden
        />
      )}
    </span>
  );
}

function SidebarTierLine({
  loading,
  subscriptionTier,
}: {
  loading: boolean;
  subscriptionTier: string | null | undefined;
}) {
  if (loading) {
    return (
      <span className="inline-block h-4 w-14 animate-pulse rounded-full bg-[rgba(255,255,255,0.15)]" />
    );
  }
  const tier = subscriptionTier?.trim().toLowerCase() || "free";
  return <PlanBadgeFooter plan={tier} />;
}

function DashboardChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useDashboardUser();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [moreSheetOpen, setMoreSheetOpen] = useState(false);
  const [isMdUp, setIsMdUp] = useState(false);
  const [isLgUp, setIsLgUp] = useState(false);
  const [sidebarMe, setSidebarMe] = useState<SidebarAuthMe | null>(null);
  const [sidebarProfileLoading, setSidebarProfileLoading] = useState(true);
  const [notifCount, setNotifCount] = useState(0);

  useEffect(() => {
    let c = false;
    (async () => {
      setSidebarProfileLoading(true);
      try {
        const token =
          typeof window !== "undefined"
            ? window.localStorage.getItem("gt_token")
            : null;
        if (!token?.trim()) {
          if (!c) {
            setSidebarMe(null);
            setSidebarProfileLoading(false);
          }
          return;
        }
        const res = await fetch(`${API_BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${token.trim()}` },
        });
        if (!res.ok) throw new Error("auth/me failed");
        const data = (await res.json()) as SidebarAuthMe;
        if (!c) setSidebarMe(data);
      } catch {
        if (!c) setSidebarMe(null);
      } finally {
        if (!c) setSidebarProfileLoading(false);
      }
    })();
    return () => {
      c = true;
    };
  }, []);

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

  const profileComplete = isProfileFullyComplete(user);
  const profileTarget = "/profile";

  const sidebarDisplayName = formatDisplayName(
    sidebarMe?.full_name ?? user?.full_name,
  );
  const sidebarPicUrl = useMemo(
    () => pickProfilePicUrl(sidebarMe),
    [sidebarMe],
  );
  const uname = sidebarMe?.username?.trim();
  const sidebarPrimaryLabel =
    uname && uname.length > 0 ? `@${uname}` : sidebarDisplayName;

  const isMapPage = pathname === "/map";

  useEffect(() => {
    setMoreSheetOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (loading || !user) return;
    let c = false;
    (async () => {
      try {
        const u = await apiFetch<{ count: number }>(
          "/notifications/unread-count",
        );
        if (c) return;
        setNotifCount(Math.max(0, Math.floor(u.count)));
      } catch {
        /* keep previous count */
      }
    })();
    return () => {
      c = true;
    };
  }, [loading, user]);

  useEffect(() => {
    function onUnread(e: Event) {
      const ce = e as CustomEvent<{ count?: number }>;
      if (typeof ce.detail?.count === "number") {
        setNotifCount(Math.max(0, Math.floor(ce.detail.count)));
      }
    }
    window.addEventListener(GT_NOTIFICATIONS_UNREAD, onUnread);
    return () => window.removeEventListener(GT_NOTIFICATIONS_UNREAD, onUnread);
  }, []);

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
            <TravelloLogo variant="full" size="sm" animated />
          </Link>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden px-3 py-3">
          {PRIMARY_NAV.map((item) => (
            <SidebarNavLink
              key={item.href}
              href={item.href}
              label={item.label}
              Icon={item.Icon}
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
            Icon={NOTIF_NAV.Icon}
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
              title={!profileComplete ? "Complete profile" : undefined}
              className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg p-1 transition-colors hover:bg-[rgba(255,255,255,0.06)]"
              onClick={() => router.push(profileTarget)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  router.push(profileTarget);
                }
              }}
            >
              <SidebarProfileAvatar
                profilePicUrl={sidebarPicUrl}
                displayName={sidebarDisplayName}
                profileComplete={profileComplete}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-white">
                  {sidebarPrimaryLabel}
                </p>
                <div className="mt-0.5">
                  <SidebarTierLine
                    loading={sidebarProfileLoading}
                    subscriptionTier={sidebarMe?.subscription_tier}
                  />
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
              <IconLogout size={20} darkBg />
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
            <IconMenu size={24} darkBg />
          </button>
          <Link
            href="/dashboard"
            className="flex items-center justify-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            title="travello"
          >
            <TravelloLogo variant="mark" size="sm" animated />
          </Link>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden px-1 py-2">
          {PRIMARY_NAV.map((item) => (
            <SidebarNavLink
              key={item.href}
              href={item.href}
              label={item.label}
              Icon={item.Icon}
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
            Icon={NOTIF_NAV.Icon}
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
            title={
              !profileComplete
                ? "Complete profile"
                : sidebarDisplayName
            }
            className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            onClick={() => {
              router.push(profileTarget);
              afterNav();
            }}
          >
            <SidebarProfileAvatar
              profilePicUrl={sidebarPicUrl}
              displayName={sidebarDisplayName}
              profileComplete={profileComplete}
            />
          </button>
          <button
            type="button"
            title="Sign out"
            onClick={handleLogout}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[rgba(255,255,255,0.4)] transition-colors hover:text-[rgba(255,255,255,0.8)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            aria-label="Sign out"
          >
              <IconLogout size={20} darkBg />
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
                <TravelloLogo variant="full" size="sm" animated />
              </Link>
            </div>

            <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden px-3 py-3">
              {PRIMARY_NAV.map((item) => (
                <SidebarNavLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  Icon={item.Icon}
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
                Icon={NOTIF_NAV.Icon}
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
                  title={!profileComplete ? "Complete profile" : undefined}
                  className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg p-1 transition-colors hover:bg-[rgba(255,255,255,0.06)]"
                  onClick={() => {
                    router.push(profileTarget);
                    afterNav();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      router.push(profileTarget);
                      afterNav();
                    }
                  }}
                >
                  <SidebarProfileAvatar
                    profilePicUrl={sidebarPicUrl}
                    displayName={sidebarDisplayName}
                    profileComplete={profileComplete}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-white">
                      {sidebarPrimaryLabel}
                    </p>
                    <div className="mt-0.5">
                      <SidebarTierLine
                        loading={sidebarProfileLoading}
                        subscriptionTier={sidebarMe?.subscription_tier}
                      />
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
                  <IconLogout size={20} darkBg />
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
            : "flex min-h-screen min-h-[100dvh] flex-col pb-[calc(56px+env(safe-area-inset-bottom,0px))] transition-all duration-300 ease-in-out max-md:ml-0 md:ml-[64px] lg:ml-[220px] md:pb-0"
        }
      >
        {!isMdUp ? (
          <header className="relative sticky top-0 z-30 grid h-[52px] shrink-0 grid-cols-[40px_1fr_40px] items-center border-b border-[#E9ECEF] bg-white px-3">
            <span className="w-10 shrink-0" aria-hidden />
            <div className="flex min-w-0 justify-center justify-self-center px-2">
              {!isMapPage ? (
                <TravelloLogo variant="pill-dark" size="sm" animated />
              ) : (
                <span className="text-[15px] font-semibold text-[#0F3460]">
                  Map
                </span>
              )}
            </div>
            <Link
              href="/notifications"
              className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center justify-self-end rounded-xl text-[#6C757D] transition-colors hover:bg-[#F8F9FA] hover:text-[#0F3460] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E94560]/40"
              aria-label="Notifications"
            >
              <IconBell size={24} />
              {notifCount > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 flex min-h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-white">
                  {notifCount > 99 ? "99+" : notifCount}
                </span>
              ) : null}
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
              <div className="w-full">{children}</div>
            </div>
          )}
        </main>

        <nav
          className="fixed bottom-0 left-0 right-0 z-30 flex h-14 min-h-14 border-t border-[#E9ECEF] bg-white px-1 pb-[env(safe-area-inset-bottom,0px)] pt-0 md:hidden"
          aria-label="Primary"
        >
          <div className="mx-auto flex h-full w-full max-w-lg items-stretch justify-between">
            {(
              [
                { href: "/dashboard", label: "Home", Icon: IconLayoutDashboard },
                { href: "/trips", label: "Trips", Icon: IconPlane },
                { href: "/travel-hub", label: "Connect", Icon: IconUsers },
                { href: "/explore", label: "Explore", Icon: IconCompass },
              ] as const
            ).map(({ href, label, Icon }) => {
              const active =
                href === "/explore"
                  ? isExploreNavActive(pathname)
                  : isActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-1"
                  onClick={() => setMoreSheetOpen(false)}
                >
                  <span
                    className={`inline-flex leading-none ${
                      active ? "text-[#E94560]" : "text-[#6C757D]"
                    }`}
                    aria-hidden
                  >
                    <Icon size={18} active={active} />
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
            <button
              type="button"
              className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-1 text-[#6C757D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E94560]/30"
              aria-expanded={moreSheetOpen}
              aria-label="More navigation"
              onClick={() => setMoreSheetOpen(true)}
            >
              <span
                className={`inline-flex leading-none ${
                  isMoreNavActive(pathname) ? "text-[#E94560]" : "text-[#6C757D]"
                }`}
                aria-hidden
              >
                <IconMoreHorizontal size={18} active={isMoreNavActive(pathname)} />
              </span>
              <span
                className={`max-w-full truncate text-[10px] font-semibold ${
                  isMoreNavActive(pathname)
                    ? "text-[#E94560]"
                    : "text-[#6C757D]"
                }`}
              >
                More
              </span>
            </button>
          </div>
        </nav>

        {moreSheetOpen ? (
          <div className="fixed inset-0 z-[3020] md:hidden">
            <button
              type="button"
              aria-label="Close menu"
              className="absolute inset-0 bg-black/45"
              onClick={() => setMoreSheetOpen(false)}
            />
            <div
              className="absolute bottom-0 left-0 right-0 max-h-[min(85dvh,520px)] overflow-hidden rounded-t-2xl border-t border-[#E9ECEF] bg-white shadow-[0_-8px_30px_rgba(0,0,0,0.12)]"
              role="dialog"
              aria-modal="true"
              aria-label="More"
            >
              <div className="mx-auto w-full max-w-lg px-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))] pt-2">
                <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#DEE2E6]" />
                <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-[#6C757D]">
                  More
                </p>
                <ul className="flex flex-col gap-0.5">
                  {MOBILE_MORE_LINKS.map(({ href, label, Icon }) => {
                    const active =
                      pathname === href || pathname.startsWith(`${href}/`);
                    return (
                      <li key={href}>
                        <Link
                          href={href}
                          className="flex items-center gap-3 rounded-xl px-3 py-3 text-[15px] font-medium transition-colors hover:bg-[#F8F9FA]"
                          style={{
                            color: active ? "#E94560" : "#495057",
                          }}
                          onClick={() => setMoreSheetOpen(false)}
                        >
                          <Icon size={20} active={active} aria-hidden />
                          {label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </div>
        ) : null}
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
          className="!z-[100] max-md:!bottom-[80px] max-md:!right-0 max-md:!p-0 [&>div]:max-md:!pb-0 [&>div]:max-md:!pr-4"
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
