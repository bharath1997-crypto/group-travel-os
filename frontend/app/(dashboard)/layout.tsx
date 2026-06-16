"use client";

import { AIAssistantSidecar } from "@/components/ai/AIAssistantSidecar";
import { LoungeDock } from "@/components/LoungeDock";
import { emitOpenLounge } from "@/lib/open-lounge";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  MoreVertical,
  Calendar,
  Users as LucideUsers,
  Bot,
  MessageSquare,
  DollarSign,
  Compass,
  Map,
  Bell,
  User,
  Activity,
  CloudSun,
  Plane,
  Building2,
  Route,
  Bus,
  Heart,
  LayoutDashboard,
  ShoppingCart,
  type LucideIcon,
} from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import { IconBell, IconCheck, IconLogout } from "@/components/icons";

import { LiveModal } from "@/components/live/LiveModal";
import { PostOAuthWelcomeModal } from "@/components/PostOAuthWelcomeModal";
import { PresenceHeartbeat } from "@/components/PresenceHeartbeat";
import { VerificationBanner } from "@/components/VerificationBanner";
import { RovvyLogo, RovvyIcon } from "@/components/RovvyLogo";
import BrandedLoading from "@/components/BrandedLoading";
import ConnectionStatusBanner from "@/components/ConnectionStatusBanner";
import { HeaderSearchBar } from "@/components/HeaderSearchBar";
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

type SubNavItem = { href: string; label: string; Icon?: LucideIcon };

type NavSectionDef = {
  id: "explore" | "trips" | "live" | "split-activities" | "profile";
  href: string;
  label: string;
  Icon: LucideIcon | null;
  subs: SubNavItem[];
  mobileLabel?: string;
};

const NAV_SECTIONS: NavSectionDef[] = [
  {
    id: "explore",
    href: "/explore",
    label: "Explore",
    Icon: Compass,
    subs: [
      { href: "/explore/activities", label: "Activities", Icon: Activity },
      { href: "/explore/events",     label: "Events",     Icon: Calendar },
      { href: "/weather",            label: "Weather",    Icon: CloudSun },
      { href: "/explore/map",        label: "Map View",   Icon: Map },
    ],
  },
  {
    id: "trips",
    href: "/trips",
    label: "Trips",
    Icon: Map,
    subs: [
      { href: "/trip-space",  label: "Trip Space",  Icon: Map },
      { href: "/flights",     label: "Flights",     Icon: Plane },
      { href: "/hotels",      label: "Hotels",      Icon: Building2 },
      { href: "/routes",      label: "Routes",      Icon: Route },
      { href: "/buses",       label: "Buses",       Icon: Bus },
      { href: "/group",       label: "Groups",      Icon: LucideUsers },
      { href: "/buddy",       label: "Buddy Trips", Icon: Heart },
    ],
  },
  {
    id: "live",
    href: "/trip-live",
    label: "LIVE",
    Icon: null,   // replaced by pulsing dot
    subs: [],
    mobileLabel: "Live",
  },
  {
    id: "split-activities",
    href: "/split-activities",
    label: "Split Activities",
    mobileLabel: "Split",
    Icon: DollarSign,
    subs: [],
  },
  {
    id: "profile",
    href: "/profile",
    label: "Profile",
    Icon: User,
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
  if (section.id === "explore") {
    return (
      pathname === "/explore" ||
      pathname.startsWith("/explore/") ||
      pathname.startsWith("/weather") ||
      pathname === "/map"
    );
  }
  if (section.id === "trips") {
    return (
      pathname === "/trips" ||
      pathname.startsWith("/trips/") ||
      pathname.startsWith("/trip-space") ||
      pathname.startsWith("/flights") ||
      pathname.startsWith("/hotels") ||
      pathname.startsWith("/routes") ||
      pathname.startsWith("/buses") ||
      pathname.startsWith("/group") ||
      pathname.startsWith("/buddy")
    );
  }
  if (section.id === "live") {
    return pathname.startsWith("/trip-live") || pathname === "/live";
  }
  if (section.id === "split-activities") {
    return pathname.startsWith("/split-activities");
  }
  if (section.id === "profile") {
    return (
      pathname === "/profile" ||
      pathname.startsWith("/profile/") ||
      pathname.startsWith("/settings") ||
      pathname.startsWith("/stats")
    );
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
  const isLive = section.id === "live";

  return (
    <Link
      href={section.href}
      className={[
        "flex items-center gap-2 xl:gap-2.5 rounded-lg px-3 py-2 xl:py-2.5 text-[13px] font-medium transition-colors",
        active
          ? "bg-[rgba(204,251,241,0.1)] text-[#F8FAFC] shadow-[inset_0_0_0_1px_rgba(15,118,110,0.35)]"
          : "text-[#94A3B8] hover:bg-[rgba(248,250,252,0.06)] hover:text-[#F8FAFC]",
      ].join(" ")}
    >
      {isLive ? (
        <span className="relative flex h-5 w-5 shrink-0 items-center justify-center">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-400" />
        </span>
      ) : section.Icon ? (
        <section.Icon
          size={18}
          strokeWidth={2}
          className={`h-5 w-5 shrink-0 ${active ? "text-[#CCFBF1]" : "text-[#94A3B8]"}`}
          aria-hidden
        />
      ) : null}
      <span className="min-w-0 flex-1 truncate">{section.label}</span>
      {isLive && (
        <span className="ml-auto rounded-md bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-emerald-400">
          Live
        </span>
      )}
    </Link>
  );
}

function DashboardChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useDashboardUser();

  const isMapPage = pathname === "/map" || pathname === "/explore/map";
  const isLivePage = pathname === "/live" || pathname.startsWith("/trip-live");
  const isExplorerEventsShell = pathname.startsWith("/explore/events");
  const isExploreShortsShell = pathname.startsWith("/explore/shorts");
  const isFlightsPage = pathname.startsWith("/flights");
  const isRoutesPage = pathname.startsWith("/routes");
  const isActivitiesPage = pathname.startsWith("/activities");
  const isHotelsPage = pathname.startsWith("/hotels");
  const isBuddyPage = pathname.startsWith("/buddy");
  const isTripSpacePage = pathname.startsWith("/trip-space");
  const isDarkHub =
    pathname === "/plan" ||
    pathname === "/group" ||
    pathname === "/explore" ||
    pathname === "/buses" ||
    isTripSpacePage;

  const [isMdUp, setIsMdUp] = useState(false);
  const [sidebarMe, setSidebarMe] = useState<SidebarAuthMe | null>(null);
  const [sidebarProfileLoading, setSidebarProfileLoading] = useState(true);
  const [notifCount, setNotifCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [liveModalOpen, setLiveModalOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    if (loading || !user) return;
    let c = false;
    (async () => {
      try {
        const data = await apiFetch<{ count: number }>("/cart/count");
        if (c) return;
        setCartCount(Math.max(0, Math.floor(data.count)));
      } catch {
        /* keep count */
      }
    })();
    return () => {
      c = true;
    };
  }, [loading, user]);

  useEffect(() => {
    const handleCartUpdate = () => {
      (async () => {
        try {
          const data = await apiFetch<{ count: number }>("/cart/count");
          setCartCount(Math.max(0, Math.floor(data.count)));
        } catch {}
      })();
    };
    window.addEventListener("gt-cart-updated", handleCartUpdate);
    return () => window.removeEventListener("gt-cart-updated", handleCartUpdate);
  }, []);


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
    label: s.mobileLabel ?? s.label,
    Icon: s.Icon,
    id: s.id,
  }));

  // Compute sub-nav for current section
  const activeSection = NAV_SECTIONS.find((s) => sectionActive(pathname, s));
  const activeSubs = activeSection?.subs ?? [];
  const hasSubNav = activeSubs.length > 0;

  // Header height: 56px primary row + 44px sub-nav row when present
  const headerPx = hasSubNav ? 108 : 64;

  return (
    <div className="min-h-screen min-h-[100dvh] bg-[#F8F9FA]">
      <ConnectionStatusBanner />

      {/* ═══════════════════════════════════════════════════
          FIXED TOP HEADER — never hides on scroll
      ═══════════════════════════════════════════════════ */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-white border-b border-stone-200 shadow-sm select-none">
        <div className="flex h-16 items-center gap-2 px-3 md:gap-3 md:px-6">
          {/* Logo */}
          <Link
            href="/explore"
            className="flex shrink-0 items-center focus-visible:outline-none"
          >
            <RovvyLogo variant="primary" size="sm" className="hidden xl:block" />
            <RovvyIcon size={26} className="xl:hidden" />
          </Link>

          {/* Search — Google-style pill, centered in header */}
          <div className="hidden min-w-0 flex-1 items-center justify-center px-3 md:flex lg:px-6">
            <HeaderSearchBar />
          </div>

          {/* Navigation + Notifications + Overflow Menu */}
          <div className="ml-auto flex shrink-0 items-center gap-1.5 md:ml-0 md:gap-3">
            {/* Primary nav tabs — desktop only */}
            <nav className="hidden md:flex items-center gap-0.5 xl:gap-1" aria-label="Primary">
              {NAV_SECTIONS.map((section) => {
                const active = sectionActive(pathname, section);
                const isLive = section.id === "live";
                if (isLive) {
                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => setLiveModalOpen(true)}
                      className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 xl:px-3 text-xs xl:text-[13px] font-semibold whitespace-nowrap transition-all ${
                        active
                          ? "text-emerald-700 bg-emerald-50 ring-1 ring-emerald-200"
                          : "text-stone-500 hover:text-stone-800 hover:bg-stone-100"
                      }`}
                      title={section.label}
                    >
                      <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                      </span>
                      <span className="hidden xl:inline">{section.label}</span>
                    </button>
                  );
                }
                return (
                  <Link
                    key={section.id}
                    href={section.href}
                    className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 xl:px-3 text-xs xl:text-[13px] font-semibold whitespace-nowrap transition-all ${
                      active
                        ? "text-[#0F766E] bg-[#F0FDF9] ring-1 ring-[#CCFBF1]"
                        : "text-stone-500 hover:text-stone-800 hover:bg-stone-100"
                    }`}
                    title={section.label}
                  >
                    {section.Icon ? (
                      <section.Icon size={15} strokeWidth={2} aria-hidden />
                    ) : null}
                    <span className="hidden xl:inline">{section.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="hidden md:block h-6 w-px bg-stone-200" />

            {/* Travel Cart */}
            <Link
              href="/cart"
              className="relative p-2 text-stone-500 hover:text-stone-800 rounded-lg hover:bg-stone-100 transition-colors"
              aria-label="Travel Cart"
            >
              <ShoppingCart size={20} />
              {cartCount > 0 ? (
                <span className="absolute top-1.5 right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-teal-600 px-1 text-[8px] font-bold text-white ring-2 ring-white">
                  {cartCount > 99 ? "99" : cartCount}
                </span>
              ) : null}
            </Link>

            {/* Notifications */}
            <Link
              href="/notifications"
              className="relative p-2 text-stone-500 hover:text-stone-800 rounded-lg hover:bg-stone-100 transition-colors"
              aria-label="Notifications"
            >
              <IconBell size={20} />
              {notifCount > 0 ? (
                <span className="absolute top-1.5 right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[8px] font-bold text-white ring-2 ring-white">
                  {notifCount > 99 ? "99" : notifCount}
                </span>
              ) : null}
            </Link>

            {/* Overflow menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen(!menuOpen)}
                className="p-2 text-stone-500 hover:text-stone-800 rounded-lg hover:bg-stone-100 transition-colors"
                aria-label="More options"
              >
                <MoreVertical size={20} />
              </button>

              {menuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40 bg-transparent"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-1.5 w-48 rounded-xl bg-white border border-stone-200 shadow-xl py-1.5 z-50 text-[12px] font-medium text-stone-700">
                    <button
                      type="button"
                      onClick={() => { router.push("/trips/plan"); setMenuOpen(false); }}
                      className="w-full text-left px-3.5 py-2 hover:bg-stone-50 flex items-center gap-2"
                    >
                      <Calendar size={14} className="text-[#0F766E]" />
                      <span>Plan a Trip</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        emitOpenLounge();
                        setMenuOpen(false);
                      }}
                      className="w-full text-left px-3.5 py-2 hover:bg-stone-50 flex items-center gap-2"
                    >
                      <MessageSquare size={14} className="text-[#0F766E]" />
                      <span>Rovvy Lounge</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { router.push("/dashboard"); setMenuOpen(false); }}
                      className="w-full text-left px-3.5 py-2 hover:bg-stone-50 flex items-center gap-2"
                    >
                      <LayoutDashboard size={14} className="text-[#0F766E]" />
                      <span>Dashboard</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { router.push("/stats"); setMenuOpen(false); }}
                      className="w-full text-left px-3.5 py-2 hover:bg-stone-50 flex items-center gap-2"
                    >
                      <MoreVertical size={14} className="text-stone-500" />
                      <span>My Stats</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { router.push("/settings"); setMenuOpen(false); }}
                      className="w-full text-left px-3.5 py-2 hover:bg-stone-50 flex items-center gap-2"
                    >
                      <MoreVertical size={14} className="text-stone-500" />
                      <span>Settings</span>
                    </button>
                    <div className="mx-3 my-1 border-t border-stone-100" />
                    <button
                      type="button"
                      onClick={() => { const e = new CustomEvent("open-ai-sidecar"); window.dispatchEvent(e); setMenuOpen(false); }}
                      className="w-full text-left px-3.5 py-2 hover:bg-stone-50 flex items-center gap-2"
                    >
                      <Bot size={14} className="text-teal-600" />
                      <span>Ask AI Assistant</span>
                    </button>
                    <div className="mx-3 my-1 border-t border-stone-100" />
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full text-left px-3.5 py-2 hover:bg-red-50 flex items-center gap-2 text-red-500"
                    >
                      <MoreVertical size={14} />
                      <span>Sign out</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Sub-nav strip — fixed below primary row, always visible ── */}
        {hasSubNav && (
          <div className="flex items-center gap-1.5 px-4 md:px-6 py-2 border-t border-stone-100 overflow-x-auto no-scrollbar bg-white">
            {activeSubs.map(({ href, label, Icon }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12px] font-semibold transition-all ${
                    active
                      ? "bg-[#0F766E] text-white shadow-sm"
                      : "text-stone-500 hover:bg-stone-100 hover:text-stone-800"
                  }`}
                >
                  {Icon && <Icon size={13} strokeWidth={2} aria-hidden />}
                  {label}
                </Link>
              );
            })}
          </div>
        )}
      </header>

      {/* ═══════════════════════════════════════════════════
          MAIN CONTENT — padded to clear the fixed header
      ═══════════════════════════════════════════════════ */}
      <div
        className="flex h-screen h-[100dvh] w-full flex-col overflow-y-auto pb-[calc(56px+env(safe-area-inset-bottom,0px))] md:pb-0"
        style={{ paddingTop: `${headerPx}px` }}
      >
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
                  ? "flex w-full min-w-0 max-w-none flex-col gap-0"
                  : "mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-5"
              }
            >
              <PresenceHeartbeat />
              <PostOAuthWelcomeModal />
              <VerificationBanner />
              <div className="w-full">{children}</div>
            </div>
          )}
        </main>

        {/* ═══════════════════════════════════════════════════
            MOBILE BOTTOM NAV — fixed, dark bar
        ═══════════════════════════════════════════════════ */}
        <nav
          className="fixed bottom-0 left-0 right-0 z-30 flex items-end border-t border-[#1E293B] bg-[#0F172A] pb-[env(safe-area-inset-bottom,0px)] md:hidden"
          aria-label="Primary"
        >
          <div className="mx-auto flex h-14 w-full max-w-lg items-stretch justify-between px-1">
            {MOBILE_TABS.map(({ href, label, Icon, id }, idx) => {
              const def = NAV_SECTIONS.find((s) => s.id === id)!;
              const active = sectionActive(pathname, def);
              const isCenter = idx === 2;

              if (isCenter) {
                return (
                  <button
                    key={href}
                    type="button"
                    onClick={() => setLiveModalOpen(true)}
                    className="flex flex-1 flex-col items-center justify-start -mt-5"
                    aria-label="LIVE mode"
                  >
                    <span
                      className={`flex h-14 w-14 items-center justify-center rounded-full border-4 border-[#0F172A] shadow-xl transition-all ${
                        active ? "bg-emerald-500 shadow-emerald-500/40" : "bg-[#0F766E] shadow-[#0F766E]/30"
                      }`}
                    >
                      <span className="relative flex h-5 w-5 items-center justify-center">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-50" />
                        <span className="relative inline-flex h-3 w-3 rounded-full bg-white" />
                      </span>
                    </span>
                    <span className={`mt-1 text-[9px] font-black uppercase tracking-widest pb-1 ${
                      active ? "text-emerald-400" : "text-slate-400"
                    }`}>
                      Live
                    </span>
                  </button>
                );
              }

              return (
                <Link
                  key={href}
                  href={href}
                  className="relative flex min-h-[44px] min-w-[44px] flex-1 flex-col items-center justify-center gap-0.5 px-0.5 py-1"
                >
                  {Icon && (
                    <Icon
                      size={20}
                      strokeWidth={2}
                      className={active ? "text-[#0F766E]" : "text-[#94A3B8]"}
                      aria-hidden
                    />
                  )}
                  <span
                    className={`max-w-full truncate text-[10px] font-semibold ${
                      active ? "text-[#0F766E]" : "text-[#64748B]"
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
          className="!z-[40] max-md:!bottom-[72px] max-md:!left-0 max-md:!p-0 [&>div]:max-md:!pb-0 [&>div]:max-md:!pl-4"
        />
      ) : null}
      {user && <LoungeDock />}
      <LiveModal open={liveModalOpen} onClose={() => setLiveModalOpen(false)} />
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

