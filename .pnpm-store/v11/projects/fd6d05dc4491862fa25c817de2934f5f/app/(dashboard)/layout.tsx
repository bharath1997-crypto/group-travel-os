"use client";

import { AIAssistantSidecar } from "@/components/ai/AIAssistantSidecar";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Brain,
  Calendar,
  Users as LucideUsers,
  Wallet,
  Briefcase,
  Activity,
  Plane,
  Heart,
  Navigation2,
  User,
  FileArchive,
  type LucideIcon,
} from "lucide-react";
import { ExploreTabIcon } from "@/components/map/MapControlIcons";
import type { CSSProperties, ReactNode } from "react";
import { useEffect, useState } from "react";
import LiveTopRevealZone from "./live/LiveTopRevealZone";
import { useLiveAutoRevealHeader } from "./live/use-live-auto-reveal-header";

import { IconCheck } from "@/components/icons";

import { PostOAuthWelcomeModal } from "@/components/PostOAuthWelcomeModal";
import { PresenceHeartbeat } from "@/components/PresenceHeartbeat";
import { VerificationBanner } from "@/components/VerificationBanner";
import BrandedLoading from "@/components/BrandedLoading";
import ConnectionStatusBanner from "@/components/ConnectionStatusBanner";
import ConsentPreferencesBanner from "@/components/consent/ConsentPreferencesBanner";
import { RovvyAppHeader } from "@/components/RovvyAppHeader";
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

const COLLECTION_SUBS: SubNavItem[] = [
  { href: "/collection", label: "My Space", Icon: Brain },
  { href: "/collection/memory", label: "Memory", Icon: FileArchive },
];

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
    href: "/collection",
    label: "Collection",
    Icon: Briefcase,
    subs: [
      { href: "/trips",            label: "Trips",    Icon: Briefcase },
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
      pathname === "/collection" ||
      pathname.startsWith("/collection/") ||
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
    ? "ring-2 ring-emerald-500 ring-offset-2 ring-offset-[#0F1614]"
    : "ring-2 ring-red-500 ring-offset-2 ring-offset-[#0F1614]";

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
          className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 text-white ring-2 ring-[#0F1614]"
          aria-hidden
        >
          <IconCheck size={10} darkBg />
        </span>
      ) : (
        <span
          className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-red-500 bg-navy ring-2 ring-[#0F1614]"
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
          ? "bg-primary/10 text-text-on-dark shadow-[inset_0_0_0_1px_rgba(14,110,92,0.35)]"
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


function DashboardChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
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

  const liveHeaderPx = 64;

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

  const liveAutoHeader = useLiveAutoRevealHeader({
    enabled: isLivePage,
    headerPx: liveHeaderPx,
  });

  useEffect(() => {
    if (!isLivePage) {
      const headerH = isMdUp ? liveHeaderPx : 0;
      document.documentElement.style.setProperty("--rovvy-header-h", `${headerH}px`);
      document.documentElement.classList.remove("live-mode");
      document.body.classList.remove("live-mode");
      document.body.classList.remove("live-header-revealed");
      return () => {
        document.documentElement.style.removeProperty("--rovvy-header-h");
      };
    }

    document.documentElement.classList.add("live-mode");
    document.body.classList.add("live-mode");
    return () => {
      document.documentElement.classList.remove("live-mode");
      document.body.classList.remove("live-mode");
      document.body.classList.remove("live-header-revealed");
      document.documentElement.style.removeProperty("--rovvy-header-h");
    };
  }, [isLivePage, liveHeaderPx, isMdUp]);

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

  const isExploreHub = pathname === "/explore";
  const needsZeroOuterPadding =
    isMapPage ||
    isExplorerEventsShell ||
    isExploreShortsShell ||
    isExploreHub ||
    pathname.startsWith("/profile") ||
    pathname === "/collection" ||
    pathname.startsWith("/collection/") ||
    pathname === "/seats" ||
    pathname.startsWith("/seats/");

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
    isDarkHub ||
    pathname === "/seats" ||
    pathname.startsWith("/seats/");

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
  const isCollectionArea =
    pathname === "/collection" || pathname.startsWith("/collection/");
  const activeSubs = isCollectionArea
    ? COLLECTION_SUBS
    : activeSection?.subs ?? [];
  const hasSubNav =
    activeSubs.length > 0 && !pathname.startsWith("/explore") && !isLivePage;

  const headerPx = hasSubNav ? 110 : 64;

  return (
    <div
      className={`${
        isLivePage
          ? "flex h-screen max-h-[100dvh] flex-col overflow-hidden"
          : "min-h-screen min-h-[100dvh]"
      } bg-app`}
    >
      <ConnectionStatusBanner />

      {isLivePage ? (
        <LiveTopRevealZone
          visible={!liveAutoHeader.revealed}
          onReveal={liveAutoHeader.reveal}
        />
      ) : null}

      {/* ═══════════════════════════════════════════════════
          FIXED TOP HEADER — Live: slides down from top on edge hover
      ═══════════════════════════════════════════════════ */}
      <header
        className={`dashboard-header fixed top-0 left-0 right-0 z-40 overflow-visible select-none border-b border-[rgba(15,22,20,0.07)] bg-[rgba(251,250,247,0.9)] font-sans backdrop-blur-[16px] ${
          isLivePage
            ? `block ${liveAutoHeader.revealed ? "live-header-revealed" : "live-header-auto-hide"}`
            : "hidden md:block"
        }`}
        onPointerEnter={isLivePage ? liveAutoHeader.reveal : undefined}
        onPointerLeave={isLivePage ? liveAutoHeader.scheduleHide : undefined}
      >
        <RovvyAppHeader />

        {/* ── Sub-nav strip — page-specific tabs below the shared header ── */}
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
                      ? "bg-primary text-white shadow-[0_6px_16px_rgba(14,110,92,0.2)]"
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
          paddingTop: isLivePage || !isMdUp ? "0px" : `${headerPx}px`,
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

