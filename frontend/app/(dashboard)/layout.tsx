"use client";

import { AIAssistantSidecar } from "@/components/ai/AIAssistantSidecar";
import { LoungeDock } from "@/components/LoungeDock";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Search, MoreVertical, X as LucideX, Calendar, Users as LucideUsers, Bot, MessageSquare } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import { IconBell, IconCheck, IconLogout } from "@/components/icons";

import { PostOAuthWelcomeModal } from "@/components/PostOAuthWelcomeModal";
import { PresenceHeartbeat } from "@/components/PresenceHeartbeat";
import { VerificationBanner } from "@/components/VerificationBanner";
import { RovvyLogo, RovvyIcon } from "@/components/RovvyLogo";
import BrandedLoading from "@/components/BrandedLoading";
import ConnectionStatusBanner from "@/components/ConnectionStatusBanner";
import {
  DashboardUserProvider,
  useDashboardUser,
} from "@/contexts/dashboard-user-context";
import { API_BASE, apiFetch } from "@/lib/api";
import { clearToken } from "@/lib/auth";

const CORAL = "#E94560";

const NAV_BG = "#0F172A";
const MUTED = "#94A3B8";

const GT_NOTIFICATIONS_UNREAD = "gt-notifications-unread";

type SubNavItem = { href: string; label: string };

type NavSectionDef = {
  id: "home" | "plan" | "explore" | "group" | "profile";
  href: string;
  label: string;
  emoji: string;
  subs: SubNavItem[];
};

const NAV_SECTIONS: NavSectionDef[] = [
  { id: "home", href: "/dashboard", label: "Home", emoji: "🏠", subs: [] },
  {
    id: "plan",
    href: "/plan",
    label: "Plan",
    emoji: "🗓️",
    subs: [
      { href: "/flights", label: "Flights" },
      { href: "/hotels", label: "Hotels" },
      { href: "/routes", label: "Routes" },
      { href: "/buses", label: "Buses" },
    ],
  },
  {
    id: "explore",
    href: "/explore",
    label: "Explore",
    emoji: "🔍",
    subs: [
      { href: "/activities", label: "Activities" },
      { href: "/explore/events", label: "Events" },
      { href: "/weather", label: "Weather" },
    ],
  },
  {
    id: "group",
    href: "/group",
    label: "Group",
    emoji: "👥",
    subs: [
      { href: "/buddy", label: "Buddy Trips" },
      { href: "/travel-hub", label: "Rovvy Lounge" },
      { href: "/live", label: "Live" },
    ],
  },
  {
    id: "profile",
    href: "/profile",
    label: "Profile",
    emoji: "👤",
    subs: [],
  },
];

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

function sectionActive(pathname: string, section: NavSectionDef): boolean {
  if (section.id === "home") return pathname === "/dashboard";
  if (section.id === "plan") {
    return (
      pathname === "/plan" ||
      pathname.startsWith("/flights") ||
      pathname.startsWith("/hotels") ||
      pathname.startsWith("/routes") ||
      pathname.startsWith("/buses")
    );
  }
  if (section.id === "explore") {
    return (
      pathname === "/explore" ||
      pathname.startsWith("/explore/") ||
      pathname.startsWith("/activities") ||
      pathname.startsWith("/weather")
    );
  }
  if (section.id === "group") {
    return (
      pathname === "/group" ||
      pathname.startsWith("/buddy") ||
      pathname.startsWith("/travel-hub") ||
      pathname.startsWith("/live")
    );
  }
  if (section.id === "profile") {
    return pathname === "/profile" || pathname.startsWith("/profile/");
  }
  return false;
}

function subActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
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
  border: "2px solid rgba(248,250,252,0.2)",
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
  const [imgFailed, setImgFailed] = useState(false);
  const showInitials = !profilePicUrl || imgFailed;
  const initials = initialsFromFullName(displayName);
  const bg = deterministicAvatarBg(displayName);

  const ringClass = profileComplete
    ? "ring-2 ring-emerald-500 ring-offset-2 ring-offset-[#0F172A]"
    : "ring-2 ring-red-500 ring-offset-2 ring-offset-[#0F172A]";

  return (
    <span className="relative inline-flex shrink-0">
      {showInitials ? (
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-full border-2 border-[rgba(248,250,252,0.2)] text-xs font-bold text-[#F8FAFC] ${ringClass}`}
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
            onError={() => setImgFailed(true)}
          />
        </span>
      )}
      {profileComplete ? (
        <span
          className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 text-white ring-2 ring-[#0F172A]"
          aria-hidden
        >
          <IconCheck size={10} darkBg />
        </span>
      ) : (
        <span
          className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-red-500 bg-[#0F172A] ring-2 ring-[#0F172A]"
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
      <span className="inline-block h-4 w-14 animate-pulse rounded-full bg-[rgba(248,250,252,0.15)]" />
    );
  }
  const tier = subscriptionTier?.trim().toLowerCase() || "free";
  return <PlanBadgeFooter plan={tier} />;
}

function SidebarNavSection({
  section,
  pathname,
}: {
  section: NavSectionDef;
  pathname: string;
}) {
  const active = sectionActive(pathname, section);
  const showSubs = section.subs.length > 0 && active;

  return (
    <div className="flex flex-col gap-0.5">
      <Link
        href={section.href}
        className={[
          "flex items-center gap-2 xl:gap-2.5 rounded-lg px-3 py-2 xl:py-2.5 text-[13px] font-medium transition-colors",
          active
            ? "bg-[rgba(204,251,241,0.1)] text-[#F8FAFC] shadow-[inset_0_0_0_1px_rgba(15,118,110,0.35)]"
            : "text-[#94A3B8] hover:bg-[rgba(248,250,252,0.06)] hover:text-[#F8FAFC]",
        ].join(" ")}
      >
        <span
          className="flex h-5 w-5 shrink-0 items-center justify-center text-base leading-none"
          aria-hidden
          style={{ opacity: active ? 1 : 0.85 }}
        >
          {section.emoji}
        </span>
        <span className="min-w-0 flex-1 truncate">{section.label}</span>
      </Link>
      {showSubs ? (
        <div className="ml-2 flex flex-col gap-0.5 border-l border-[#334155] py-0.5 pl-3">
          {section.subs.map((sub) => {
            const subIsActive = subActive(pathname, sub.href);
            return (
              <Link
                key={sub.href}
                href={sub.href}
                className={
                  subIsActive
                    ? "rounded-md px-2 py-1 xl:py-1.5 text-[12px] font-medium text-[#CCFBF1]"
                    : "rounded-md px-2 py-1 xl:py-1.5 text-[12px] font-normal text-[#94A3B8] hover:text-[#F8FAFC]"
                }
              >
                {sub.label}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function DashboardChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useDashboardUser();
  const hideAssistantSidecar = pathname.startsWith("/travel-hub");

  const isMapPage = pathname === "/map";
  const isLivePage = pathname === "/live";
  const isExplorerEventsShell = pathname.startsWith("/explore/events");
  const isExploreShortsShell = pathname.startsWith("/explore/shorts");
  const isFlightsPage = pathname.startsWith("/flights");
  const isRoutesPage = pathname.startsWith("/routes");
  const isActivitiesPage = pathname.startsWith("/activities");
  const isHotelsPage = pathname.startsWith("/hotels");
  const isBuddyPage = pathname.startsWith("/buddy");
  const isDarkHub =
    pathname === "/plan" ||
    pathname === "/group" ||
    pathname === "/explore" ||
    pathname === "/buses";

  const [isMdUp, setIsMdUp] = useState(false);
  const [sidebarMe, setSidebarMe] = useState<SidebarAuthMe | null>(null);
  const [sidebarProfileLoading, setSidebarProfileLoading] = useState(true);
  const [notifCount, setNotifCount] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

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
    const apply = () => setIsMdUp(mqMd.matches);
    apply();
    mqMd.addEventListener("change", apply);
    return () => mqMd.removeEventListener("change", apply);
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

  const needsZeroOuterPadding =
    isMapPage ||
    isExplorerEventsShell ||
    isExploreShortsShell ||
    isLivePage ||
    pathname.startsWith("/profile");

  const useFullWidthInner =
    isMapPage ||
    isLivePage ||
    isExplorerEventsShell ||
    isExploreShortsShell ||
    isFlightsPage ||
    isRoutesPage ||
    isActivitiesPage ||
    isHotelsPage ||
    isBuddyPage ||
    isDarkHub;

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
    return <BrandedLoading fullScreen={true} />;
  }

  const MOBILE_TABS = NAV_SECTIONS.map((s) => ({
    href: s.href,
    label: s.label,
    emoji: s.emoji,
    id: s.id,
  }));

  return (
    <div className="min-h-screen min-h-[100dvh] bg-[#F8F9FA]">
      <ConnectionStatusBanner />
      {/* Desktop / tablet sidebar */}
      <aside
        className="fixed left-0 top-0 z-40 hidden h-full min-h-screen w-[200px] xl:w-[240px] flex-col border-r border-[#1E293B] md:flex"
        style={{ backgroundColor: NAV_BG }}
      >
        <div className="shrink-0 border-b border-[rgba(248,250,252,0.08)] px-4 py-4 xl:py-5">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[#CCFBF1]/40"
          >
            <RovvyLogo variant="dark" size="md" />
          </Link>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden px-3 py-3 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#334155] [scrollbar-color:#334155_transparent] [scrollbar-width:thin]">
          {NAV_SECTIONS.map((section) => (
            <SidebarNavSection
              key={section.id}
              section={section}
              pathname={pathname}
            />
          ))}
        </nav>

        <div className="shrink-0 space-y-1.5 xl:space-y-2 border-t border-[rgba(248,250,252,0.08)] p-2.5 xl:p-3">
          <Link
            href="/notifications"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] transition-colors hover:bg-[rgba(248,250,252,0.06)]"
            style={{ color: MUTED }}
          >
            <IconBell size={18} darkBg className="shrink-0 opacity-90" />
            <span className="flex-1 truncate text-[#F8FAFC]/90">
              Notifications
            </span>
            {notifCount > 0 ? (
              <span className="inline-flex min-h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white">
                {notifCount > 99 ? "99+" : notifCount}
              </span>
            ) : null}
          </Link>

          <div className="flex items-center gap-1.5 xl:gap-2 rounded-lg p-0.5 xl:p-1">
            <div
              role="button"
              tabIndex={0}
              title={!profileComplete ? "Complete profile" : undefined}
              className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 xl:gap-2 rounded-lg p-0.5 xl:p-1 transition-colors hover:bg-[rgba(248,250,252,0.06)]"
              onClick={() => router.push(profileTarget)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  router.push(profileTarget);
                }
              }}
            >
              <SidebarProfileAvatar
                key={sidebarPicUrl ?? "no-photo"}
                profilePicUrl={sidebarPicUrl}
                displayName={sidebarDisplayName}
                profileComplete={profileComplete}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-[#F8FAFC]">
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
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#94A3B8] transition-colors hover:bg-[rgba(248,250,252,0.06)] hover:text-[#F8FAFC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CCFBF1]/40"
              aria-label="Sign out"
            >
              <IconLogout size={20} darkBg />
            </button>
          </div>
        </div>
      </aside>

      <div
        className={
          isMapPage
            ? "flex min-h-screen min-h-[100dvh] flex-col transition-all duration-300 ease-in-out max-md:ml-0 md:ml-[200px] xl:ml-[240px]"
            : "flex min-h-screen min-h-[100dvh] flex-col pb-[calc(56px+env(safe-area-inset-bottom,0px))] transition-all duration-300 ease-in-out max-md:ml-0 max-md:pb-[calc(56px+env(safe-area-inset-bottom,0px))] md:ml-[200px] xl:ml-[240px] md:pb-0"
        }
      >
        {!isMdUp ? (
          <header className="relative sticky top-0 z-30 flex h-[52px] shrink-0 items-center justify-between border-b border-[#E2E8F0] bg-white px-3 shadow-sm select-none">
            {searchOpen ? (
              <div className="flex items-center w-full gap-2 px-1">
                <input
                  type="text"
                  placeholder="I'm looking for..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && searchQuery.trim()) {
                      router.push(`/explore?q=${encodeURIComponent(searchQuery)}`);
                      setSearchOpen(false);
                    }
                  }}
                  className="flex-1 text-sm border border-stone-200 px-3 py-1.5 rounded-full outline-none focus:border-[#0F766E] text-stone-850"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setSearchOpen(false)}
                  className="p-1 text-stone-500 hover:text-stone-800"
                >
                  <LucideX size={18} />
                </button>
              </div>
            ) : (
              <>
                <Link href="/dashboard" className="flex items-center gap-1.5 min-w-0">
                  <RovvyIcon size={26} />
                  <span className="text-[15px] font-bold text-[#0F766E] tracking-tight">Rovvy</span>
                </Link>
                
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setSearchOpen(true)}
                    className="p-2 text-stone-600 hover:text-stone-800 rounded-lg hover:bg-stone-50 transition-colors"
                    aria-label="Search"
                  >
                    <Search size={20} />
                  </button>

                  <Link
                    href="/notifications"
                    className="relative p-2 text-stone-600 hover:text-stone-800 rounded-lg hover:bg-stone-50 transition-colors"
                    aria-label="Notifications"
                  >
                    <IconBell size={20} />
                    {notifCount > 0 ? (
                      <span className="absolute top-1.5 right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[8px] font-bold text-white ring-2 ring-white">
                        {notifCount > 99 ? "99" : notifCount}
                      </span>
                    ) : null}
                  </Link>

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setMenuOpen(!menuOpen)}
                      className="p-2 text-stone-600 hover:text-stone-800 rounded-lg hover:bg-stone-50 transition-colors"
                      aria-label="Menu"
                    >
                      <MoreVertical size={20} />
                    </button>

                    {menuOpen && (
                      <>
                        <div 
                          className="fixed inset-0 z-40 bg-transparent"
                          onClick={() => setMenuOpen(false)}
                        />
                        <div className="absolute right-0 mt-1.5 w-44 rounded-xl bg-white border border-stone-200 shadow-xl py-1.5 z-50 animate-fade-in text-[12px] font-medium text-stone-700">
                          <button
                            type="button"
                            onClick={() => {
                              router.push("/trips/plan");
                              setMenuOpen(false);
                            }}
                            className="w-full text-left px-3.5 py-2 hover:bg-stone-50 flex items-center gap-2"
                          >
                            <Calendar size={14} className="text-[#0F766E]" />
                            <span>🗓️ Plan a Trip</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              router.push("/groups/new");
                              setMenuOpen(false);
                            }}
                            className="w-full text-left px-3.5 py-2 hover:bg-stone-50 flex items-center gap-2"
                          >
                            <LucideUsers size={14} className="text-[#0F766E]" />
                            <span>👥 Create Group</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              router.push("/travel-hub");
                              setMenuOpen(false);
                            }}
                            className="w-full text-left px-3.5 py-2 hover:bg-stone-50 flex items-center gap-2"
                          >
                            <MessageSquare size={14} className="text-[#0F766E]" />
                            <span>🛋️ Rovvy Lounge</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const e = new CustomEvent("open-ai-sidecar");
                              window.dispatchEvent(e);
                              setMenuOpen(false);
                            }}
                            className="w-full text-left px-3.5 py-2 hover:bg-stone-50 flex items-center gap-2"
                          >
                            <Bot size={14} className="text-teal-600" />
                            <span>🤖 Ask AI Assistant</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </>
            )}
          </header>
        ) : null}

        <main
          className={
            needsZeroOuterPadding
              ? "flex min-h-0 flex-1 flex-col overflow-hidden p-0"
              : "min-h-0 flex-1 bg-[#F8F9FA] p-3 md:p-4 xl:p-5"
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
            <div
              className={
                useFullWidthInner
                  ? "flex w-full max-w-none flex-col gap-0"
                  : "mx-auto flex w-full max-w-6xl flex-col gap-5"
              }
            >
              <PresenceHeartbeat />
              <PostOAuthWelcomeModal />
              <VerificationBanner />
              <div className="w-full">{children}</div>
            </div>
          )}
        </main>

        <nav
          className="fixed bottom-0 left-0 right-0 z-30 flex min-h-14 border-t border-[#E2E8F0] bg-white pb-[env(safe-area-inset-bottom,0px)] pt-0 md:hidden"
          aria-label="Primary"
        >
          <div className="mx-auto flex h-14 w-full max-w-lg items-stretch justify-between px-1">
            {MOBILE_TABS.map(({ href, label, emoji, id }) => {
              const def = NAV_SECTIONS.find((s) => s.id === id)!;
              const active = sectionActive(pathname, def);
              return (
                <Link
                  key={href}
                  href={href}
                  className="relative flex min-h-[44px] min-w-[44px] flex-1 flex-col items-center justify-center gap-0.5 px-0.5 py-1"
                >
                  {id === "group" ? (
                    <span
                      className="absolute right-[20%] top-1 h-2 w-2 rounded-full bg-[#0F766E] ring-2 ring-white"
                      aria-hidden
                      title="Updates"
                    />
                  ) : null}
                  <span
                    className="text-lg leading-none"
                    aria-hidden
                    style={{
                      filter: active ? "none" : "grayscale(1)",
                      opacity: active ? 1 : 0.55,
                    }}
                  >
                    {emoji}
                  </span>
                  <span
                    className={`max-w-full truncate text-[10px] font-semibold ${
                      active ? "text-[#0F766E]" : "text-[#94A3B8]"
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

      {user && !hideAssistantSidecar ? (
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
          className="!z-[40] max-md:!bottom-[72px] max-md:!left-0 max-md:!p-0 [&>div]:max-md:!pb-0 [&>div]:max-md:!pl-4"
        />
      ) : null}
      {user && <LoungeDock />}
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
