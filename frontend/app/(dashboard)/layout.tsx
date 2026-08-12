"use client";

import { AIAssistantSidecar } from "@/components/ai/AIAssistantSidecar";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Calendar,
  Users as LucideUsers,
  Wallet,
  Briefcase,
  Activity,
  Plane,
  Heart,
  Radio,
  Bell,
  ChevronDown,
  Navigation2,
  User,
  type LucideIcon,
} from "lucide-react";
import { ExploreTabIcon } from "@/components/map/MapControlIcons";
import type { CSSProperties, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { IconCheck } from "@/components/icons";

import { PostOAuthWelcomeModal } from "@/components/PostOAuthWelcomeModal";
import { PresenceHeartbeat } from "@/components/PresenceHeartbeat";
import { VerificationBanner } from "@/components/VerificationBanner";
import { RovvyLogo } from "@/components/RovvyLogo";
import BrandedLoading from "@/components/BrandedLoading";
import ConnectionStatusBanner from "@/components/ConnectionStatusBanner";
import ConsentPreferencesBanner from "@/components/consent/ConsentPreferencesBanner";
import { HeaderProfileMenu } from "@/components/HeaderProfileMenu";
import { HeaderSearchBar } from "@/components/HeaderSearchBar";
import {
  DashboardUserProvider,
  useDashboardUser,
} from "@/contexts/dashboard-user-context";
import {
  readLiveImmersiveChrome,
  type LiveImmersiveChromeState,
} from "@/app/(dashboard)/live/live-immersive-chrome";
import { API_BASE, apiFetch } from "@/lib/api";
import { BRAND } from "@/lib/brand";

const GT_NOTIFICATIONS_UNREAD = "gt-notifications-unread";

type NavIcon = LucideIcon | typeof ExploreTabIcon;

type SubNavItem = { href: string; label: string; Icon?: LucideIcon };

type NavSectionDef = {
  id: "explore" | "live" | "trips" | "connect";
  href: string;
  label: string;
  Icon: NavIcon | null;
  subs: SubNavItem[];
  mobileLabel?: string;
};

const NAV_SECTIONS: NavSectionDef[] = [
  {
    id: "explore",
    href: "/explore",
    label: "Explore",
    Icon: ExploreTabIcon,
    subs: [
      { href: "/explore",            label: "Discover" },
      { href: "/explore/activities", label: "Activities", Icon: Activity },
      { href: "/explore/events",     label: "Events",     Icon: Calendar },
    ],
  },
  {
    id: "live",
    href: "/live",
    label: "Live",
    Icon: Navigation2,
    subs: [],
  },
  {
    id: "trips",
    href: "/trips",
    label: "Trips",
    Icon: Briefcase,
    subs: [
      { href: "/trips",            label: "Overview", Icon: Briefcase },
      { href: "/group",            label: "People",   Icon: LucideUsers },
      { href: "/flights",          label: "Flights",  Icon: Plane },
      { href: "/split-activities", label: "Money",    Icon: Wallet },
    ],
  },
  {
    id: "connect",
    href: "/buddy",
    label: "Connect",
    Icon: Heart,
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
  if (section.id === "live") {
    return pathname === "/live" || pathname.startsWith("/live/");
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
      pathname.startsWith("/split-activities")
    );
  }
  if (section.id === "connect") {
    return (
      pathname.startsWith("/buddy") ||
      pathname.startsWith("/buddies") ||
      pathname.startsWith("/connect") ||
      pathname.startsWith("/join")
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
      <span className="inline-flex max-w-full truncate rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-white">
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
          className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-red-500 bg-navy ring-2 ring-[#0F172A]"
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

  return (
    <Link
      href={section.href}
      className={[
        "flex items-center gap-2 xl:gap-2.5 rounded-lg px-3 py-2 xl:py-2.5 text-[13px] font-medium transition-colors",
        active
          ? "bg-[rgba(204,251,241,0.1)] text-[#F8FAFC] shadow-[inset_0_0_0_1px_rgba(15,118,110,0.35)]"
          : "text-muted hover:bg-[rgba(248,250,252,0.06)] hover:text-[#F8FAFC]",
      ].join(" ")}
    >
      {section.Icon ? (
        <section.Icon
          size={18}
          strokeWidth={2}
          className={`h-5 w-5 shrink-0 ${active ? "text-primary-soft" : "text-muted"}`}
          aria-hidden
        />
      ) : null}
      <span className="min-w-0 flex-1 truncate">{section.label}</span>
    </Link>
  );
}

function LiveHeaderNavTab({
  active,
  notifCount,
  onNavigate,
}: {
  active: boolean;
  notifCount: number;
  onNavigate: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`relative flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 xl:px-3 text-xs xl:text-[13px] font-semibold whitespace-nowrap transition-all ${
          active
            ? "text-primary bg-primary-soft ring-1 ring-[#0F766E]/15"
            : "text-stone-500 hover:text-stone-800 hover:bg-stone-100"
        }`}
        title="Live"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Radio size={15} strokeWidth={2} aria-hidden />
        <span className="hidden xl:inline">Live</span>
        <ChevronDown
          size={14}
          strokeWidth={2}
          className={`hidden xl:block transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
        {notifCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-white">
            {notifCount > 9 ? "9+" : notifCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Live menu"
          className="absolute right-0 top-[calc(100%+0.35rem)] z-50 min-w-[11rem] overflow-hidden rounded-xl border border-stone-200 bg-white py-1 shadow-[0_12px_32px_rgba(15,23,42,0.12)]"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onNavigate();
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] font-medium text-stone-800 hover:bg-stone-50"
          >
            <Radio size={14} strokeWidth={2} className="text-primary" aria-hidden />
            Live map
          </button>
          {notifCount > 0 ? (
            <Link
              href="/notifications"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[13px] font-medium text-stone-800 hover:bg-stone-50"
            >
              <span className="flex items-center gap-2">
                <Bell size={14} strokeWidth={2} className="text-stone-500" aria-hidden />
                Notifications
              </span>
              <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-white">
                {notifCount > 99 ? "99+" : notifCount}
              </span>
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function DashboardChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useDashboardUser();
  const hideAssistantSidecar =
    pathname.startsWith("/travel-hub");

  const isLivePage = pathname === "/live" || pathname.startsWith("/live/");
  const isMapPage =
    pathname === "/map" || pathname === "/explore/map" || isLivePage;
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
    pathname === "/live" ||
    isTripSpacePage;

  const liveHeaderPx = (() => {
    const section = NAV_SECTIONS.find((s) => sectionActive(pathname, s));
    const subs = section?.subs ?? [];
    return subs.length > 0 ? 100 : 56;
  })();

  const [isMdUp, setIsMdUp] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [sidebarMe, setSidebarMe] = useState<SidebarAuthMe | null>(null);
  const [sidebarProfileLoading, setSidebarProfileLoading] = useState(true);
  const [notifCount, setNotifCount] = useState(0);
  const [cartCount, setCartCount] = useState(0);
  const [liveChrome, setLiveChrome] = useState<LiveImmersiveChromeState>({
    active: false,
    darkMap: false,
  });
  const hideBottomNav = isLivePage && liveChrome.active;

  // Toggle top header bar on activity/typing/hover
  const [headerVisible, setHeaderVisible] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  useEffect(() => {
    if (!isLivePage) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (e.clientY < 70) {
        setHeaderVisible(true);
      } else if (!isSearchFocused) {
        const activeEl = document.activeElement;
        const isTyping = activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA");
        if (!isTyping) {
          setHeaderVisible(false);
        }
      }
    };

    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
        setIsSearchFocused(true);
        setHeaderVisible(true);
      }
    };

    const handleFocusOut = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
        setIsSearchFocused(false);
        setTimeout(() => {
          const activeEl = document.activeElement;
          const stillTyping = activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA");
          if (!stillTyping) {
            setHeaderVisible(false);
          }
        }, 150);
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (touch && touch.clientY < 50) {
        setHeaderVisible(true);
      }
    };

    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;
      const headerEl = document.querySelector(".dashboard-header");
      if (headerEl && !headerEl.contains(target) && !isSearchFocused) {
        const activeEl = document.activeElement;
        const isTyping = activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA");
        if (!isTyping) {
          setHeaderVisible(false);
        }
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("focusout", handleFocusOut);
    window.addEventListener("touchstart", handleTouchStart);
    window.addEventListener("mousedown", handleOutsideClick);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("focusout", handleFocusOut);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isLivePage, isSearchFocused]);

  useEffect(() => {
    if (!isLivePage) {
      document.documentElement.style.removeProperty("--rovvy-header-h");
      document.documentElement.classList.remove("live-mode");
      document.body.classList.remove("live-mode");
      return;
    }
    const currentH = isLivePage ? liveHeaderPx : headerVisible ? liveHeaderPx : 0;
    document.documentElement.style.setProperty("--rovvy-header-h", `${currentH}px`);
    document.documentElement.classList.add("live-mode");
    document.body.classList.add("live-mode");
    return () => {
      document.documentElement.style.removeProperty("--rovvy-header-h");
      document.documentElement.classList.remove("live-mode");
      document.body.classList.remove("live-mode");
    };
  }, [isLivePage, liveHeaderPx, headerVisible]);

  useEffect(() => {
    if (!isLivePage) {
      setLiveChrome({ active: false, darkMap: false });
      return;
    }
    const sync = () => setLiveChrome(readLiveImmersiveChrome());
    sync();
    window.addEventListener("rovvy-live-chrome", sync);
    return () => window.removeEventListener("rovvy-live-chrome", sync);
  }, [isLivePage, pathname]);

  useEffect(() => {
    setMounted(true);
  }, []);

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
    router.push("/logout");
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

  const isExploreHub = pathname === "/explore";
  const needsZeroOuterPadding =
    isMapPage ||
    isExplorerEventsShell ||
    isExploreShortsShell ||
    isExploreHub ||
    pathname.startsWith("/profile");

  /** Full-bleed shells that must clip (all map routes + shorts player). */
  const needsMainOverflowHidden = isMapPage || isExploreShortsShell;

  const useFullWidthInner =
    isMapPage ||
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
    if (!mounted) {
      return (
        <div
          className="fixed inset-0 z-50 bg-app"
          aria-busy="true"
          aria-label="Loading Rovvy"
          suppressHydrationWarning
        />
      );
    }
    return <BrandedLoading fullScreen={true} />;
  }

  const MOBILE_TABS = [
    ...NAV_SECTIONS.map((s) => ({
      href: s.href,
      label: s.mobileLabel ?? s.label,
      Icon: s.Icon,
      id: s.id,
    })),
    {
      href: "/profile",
      label: "Profile",
      Icon: User,
      id: "profile",
    },
  ];

  // Compute sub-nav for current section
  const activeSection = NAV_SECTIONS.find((s) => sectionActive(pathname, s));
  const activeSubs = activeSection?.subs ?? [];
  const hasSubNav = activeSubs.length > 0;

  // Header height: 64px primary row + 46px contextual row when present.
  const headerPx = hasSubNav ? 110 : 64;
  const liveImmersiveHeader = false;
  const liveDarkHeader = false;

  return (
    <div
      className={`${
        isLivePage
          ? "flex h-screen max-h-[100dvh] flex-col overflow-hidden"
          : "min-h-screen min-h-[100dvh]"
      } ${isLivePage ? "bg-navy" : "bg-app"}`}
    >
      <ConnectionStatusBanner />

      {/* ═══════════════════════════════════════════════════
          FIXED TOP HEADER — never hides on scroll
      ═══════════════════════════════════════════════════ */}
      <header
        className={`dashboard-header fixed top-0 left-0 right-0 z-40 hidden overflow-visible select-none transition-all duration-300 md:block translate-y-0 opacity-100 ${
          liveDarkHeader
            ? "border-b border-white/10 bg-slate-950/55 shadow-none backdrop-blur-xl"
            : liveImmersiveHeader
              ? "border-b border-white/25 bg-white/70 shadow-[0_4px_24px_rgba(15,23,42,0.06)] backdrop-blur-xl"
              : "border-b border-[#E2E8F0] bg-white/95 shadow-[0_8px_30px_-18px_rgba(15,23,42,0.28)] backdrop-blur-xl"
        }`}
      >
        <div className="flex h-16 items-center gap-3 overflow-visible px-4 md:gap-5 md:px-7">
          {/* Logo — image taller than the bar for a zoomed-in wordmark */}
          <Link
            href="/explore"
            className="flex h-full shrink-0 items-center overflow-hidden focus-visible:outline-none"
          >
            <RovvyLogo
              variant={liveDarkHeader ? "white" : "primary"}
              height={58}
              className="md:hidden"
            />
            <RovvyLogo
              variant={liveDarkHeader ? "white" : "primary"}
              height={70}
              className="hidden md:block"
            />
          </Link>

          {/* Search — centered in remaining space on desktop */}
          <div className="hidden min-w-0 flex-1 items-center justify-center px-3 md:flex lg:px-6">
            <HeaderSearchBar />
          </div>

          {/* Nav tabs + profile menu — right aligned */}
          <div className="ml-auto flex shrink-0 items-center gap-2 md:gap-3">
            <nav className="hidden md:flex items-center gap-0.5 xl:gap-1" aria-label="Primary">
              {NAV_SECTIONS.map((section) => {
                const active = sectionActive(pathname, section);
                if (section.id === "live") {
                  return (
                    <LiveHeaderNavTab
                      key={section.id}
                      active={active}
                      notifCount={notifCount}
                      onNavigate={() => router.push("/live")}
                    />
                  );
                }
                return (
                  <Link
                    key={section.id}
                    href={section.href}
                    className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 xl:px-3 text-xs xl:text-[13px] font-semibold whitespace-nowrap transition-all ${
                      active
                        ? liveDarkHeader
                          ? "bg-teal-500/20 text-teal-200 ring-1 ring-teal-300/30"
                          : "text-primary bg-primary-soft ring-1 ring-[#0F766E]/15"
                        : liveDarkHeader
                          ? "text-slate-300 hover:text-white hover:bg-white/10"
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

            {user ? (
              <>
                <div className={`hidden md:block h-6 w-px ${liveDarkHeader ? "bg-white/15" : "bg-stone-200"}`} />

                <HeaderProfileMenu
                  displayName={sidebarDisplayName}
                  avatarUrl={sidebarPicUrl}
                  cartCount={cartCount}
                  notifCount={notifCount}
                  onLogout={handleLogout}
                  showOverflowItems
                />
              </>
            ) : (
              <div className="flex items-center gap-2 sm:gap-3">
                <Link
                  href={`/login?next=${encodeURIComponent(pathname)}`}
                  className={`px-2 py-2 text-sm font-semibold sm:px-3 ${
                    liveDarkHeader
                      ? "text-slate-200 hover:text-white"
                      : "text-stone-600 hover:text-primary"
                  }`}
                >
                  Log in
                </Link>
                <Link
                  href="/register"
                  className="rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover sm:px-4"
                >
                  Sign up
                </Link>
              </div>
            )}
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
                      ? "bg-primary text-white shadow-[0_6px_16px_rgba(15,118,110,0.2)]"
                      : "text-slate-500 hover:bg-app hover:text-navy"
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
        className={`dashboard-content-shell main-content flex min-h-0 w-full max-w-[100vw] flex-col transition-all duration-300 ease-in-out md:pb-0 ${
          isLivePage
            ? "flex-1 overflow-hidden pb-0"
            : `h-[100dvh] ${
                isMapPage
                  ? "overflow-hidden pb-0"
                  : "overflow-y-auto pb-[calc(56px+env(safe-area-inset-bottom,0px))]"
              }`
        }`}
        style={{
          paddingTop: !isMdUp
            ? "0px"
            : `${headerPx}px`,
        }}
      >
        <main
          className={
            needsZeroOuterPadding
              ? needsMainOverflowHidden
                ? "dashboard-main-live flex min-h-0 flex-1 flex-col overflow-hidden p-0"
                : "flex flex-col p-0 min-h-min"
              : "min-h-0 flex-1 bg-app p-3 md:p-5 xl:p-7"
          }
        >
          {isMapPage ? (
            <div className={`flex min-h-0 flex-1 flex-col overflow-hidden ${isLivePage ? "bg-transparent" : "bg-white"}`}>
              <div className="sr-only" aria-hidden>
                <PresenceHeartbeat />
              </div>
              <PostOAuthWelcomeModal />
              <VerificationBanner />
              <div className={`relative flex min-h-0 flex-1 flex-col overflow-hidden ${isLivePage ? "bg-transparent" : "bg-white"}`}>
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
          className={`bottom-tab-bar fixed bottom-0 left-0 right-0 z-30 flex items-end border-t border-[#E2E8F0] bg-white/96 pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-12px_32px_rgba(15,23,42,0.08)] backdrop-blur-xl md:hidden ${
            hideBottomNav ? "hidden" : ""
          }`}
          aria-label="Primary"
        >
          <div className="mx-auto flex h-16 w-full max-w-lg items-stretch justify-between px-1.5">
            {MOBILE_TABS.map(({ href, label, Icon, id }) => {
              const def = NAV_SECTIONS.find((s) => s.id === id);
              const active =
                id === "profile"
                  ? pathname === "/profile" || pathname.startsWith("/profile/")
                  : def
                    ? sectionActive(pathname, def)
                    : false;

              return (
                <Link
                  key={href}
                  href={href}
                  className={`relative flex min-h-[48px] min-w-[48px] flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-1.5 transition-colors ${active ? "bg-primary-soft" : ""}`}
                >
                  {Icon && (
                    <Icon
                      size={20}
                      strokeWidth={2}
                      className={active ? "text-primary" : "text-slate-400"}
                      aria-hidden
                    />
                  )}
                  <span
                    className={`max-w-full truncate text-[10px] font-semibold ${
                      active ? "text-primary" : "text-slate-500"
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

      {!hideAssistantSidecar ? (
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
        />
      ) : null}
      <ConsentPreferencesBanner />
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

