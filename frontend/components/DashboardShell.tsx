"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useRef, useEffect, type ReactNode } from "react";
import {
  Compass,
  Map,
  Bell,
  User,
  MessageSquare,
  Search,
  MoreHorizontal,
  Activity,
  Calendar,
  CloudSun,
  Plane,
  Building2,
  Route,
  Bus,
  Users,
  Heart,
  X,
  LogOut,
  Settings,
  BarChart2,
  ChevronDown,
  Sparkles,
} from "lucide-react";

import { RovvyLogo } from "@/components/RovvyLogo";
import { NotificationBell } from "@/components/NotificationBell";
import { PostOAuthWelcomeModal } from "@/components/PostOAuthWelcomeModal";
import { PresenceHeartbeat } from "@/components/PresenceHeartbeat";
import { ProfileDropdown } from "@/components/ProfileDropdown";
import TravelloLogo from "@/components/TravelloLogo";
import { VerificationBanner } from "@/components/VerificationBanner";
import { useDashboardUser } from "@/contexts/dashboard-user-context";

/* ─── Sub-nav config ─────────────────────────────────────────────────────── */
const EXPLORE_SUBNAV = [
  { href: "/explore/activities", label: "Activities", Icon: Activity },
  { href: "/explore/events",     label: "Events",     Icon: Calendar },
  { href: "/weather",            label: "Weather",    Icon: CloudSun },
  { href: "/explore/map",        label: "Map View",   Icon: Map },
];

const TRIPS_SUBNAV = [
  { href: "/trip-space",  label: "Trip Space",  Icon: Map },
  { href: "/flights",     label: "Flights",     Icon: Plane },
  { href: "/hotels",      label: "Hotels",      Icon: Building2 },
  { href: "/routes",      label: "Routes",      Icon: Route },
  { href: "/buses",       label: "Buses",       Icon: Bus },
  { href: "/group",       label: "Groups",      Icon: Users },
  { href: "/buddy",       label: "Buddy Trips", Icon: Heart },
];

/* ─── Primary tabs ───────────────────────────────────────────────────────── */
type PrimaryTab = "explore" | "trips" | "live" | "notifications" | "profile";

function getPrimaryTab(pathname: string): PrimaryTab {
  if (pathname.startsWith("/explore") || pathname.startsWith("/weather") || pathname.startsWith("/map"))
    return "explore";
  if (
    pathname.startsWith("/trips") || pathname.startsWith("/trip-space") ||
    pathname.startsWith("/flights") || pathname.startsWith("/hotels") ||
    pathname.startsWith("/routes") || pathname.startsWith("/buses") ||
    pathname.startsWith("/group") || pathname.startsWith("/buddy") ||
    false
  )
    return "trips";
  if (pathname.startsWith("/trip-live") || pathname.startsWith("/live"))
    return "live";
  if (pathname.startsWith("/notifications")) return "notifications";
  if (pathname.startsWith("/profile") || pathname.startsWith("/settings") || pathname.startsWith("/stats"))
    return "profile";
  return "explore";
}

/* ─── Pulsing LIVE dot icon ──────────────────────────────────────────────── */
function LiveDot() {
  return (
    <span className="relative flex h-5 w-5 items-center justify-center">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
      <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-400" />
    </span>
  );
}

/* ─── Overflow menu (mobile top-bar) ─────────────────────────────────────── */
function OverflowMenu({ onLogout }: { onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-xl text-white/80 hover:bg-white/10 transition"
        aria-label="More options"
      >
        <MoreHorizontal className="h-5 w-5" />
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-50 w-44 rounded-2xl border border-slate-700 bg-slate-900 py-1.5 shadow-2xl">
          <Link
            href="/stats"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition"
          >
            <BarChart2 className="h-4 w-4" /> My Stats
          </Link>
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition"
          >
            <Settings className="h-4 w-4" /> Settings
          </Link>
          <div className="mx-3 my-1 border-t border-slate-700" />
          <button
            onClick={() => { setOpen(false); onLogout(); }}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-red-400 hover:bg-slate-800 transition"
          >
            <LogOut className="h-4 w-4" /> Log out
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Search bar (mobile top-bar) ───────────────────────────────────────── */
function SearchBar() {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex h-9 w-9 items-center justify-center rounded-xl text-white/80 hover:bg-white/10 transition"
        aria-label="Search"
      >
        <Search className="h-5 w-5" />
      </button>
    );
  }
  return (
    <div className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-1.5 flex-1 max-w-xs">
      <Search className="h-4 w-4 text-white/60 shrink-0" />
      <input
        autoFocus
        placeholder="Search…"
        className="flex-1 bg-transparent text-xs text-white placeholder-white/40 outline-none"
        onBlur={() => setOpen(false)}
      />
      <button onClick={() => setOpen(false)} className="text-white/40 hover:text-white/80">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/* ─── Sidebar sub-nav group ──────────────────────────────────────────────── */
function SubNavGroup({
  label,
  items,
  pathname,
}: {
  label: string;
  items: { href: string; label: string; Icon: React.ComponentType<{ className?: string }> }[];
  pathname: string;
}) {
  return (
    <div className="mt-1 space-y-0.5 border-l border-slate-700 ml-3 pl-3">
      <p className="mb-1.5 text-[9px] font-extrabold uppercase tracking-widest text-slate-500 px-1">
        {label}
      </p>
      {items.map(({ href, label: l, Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
              active
                ? "bg-[#0F766E]/20 text-[#CCFBF1]"
                : "text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            {l}
          </Link>
        );
      })}
    </div>
  );
}

/* ─── Main shell ─────────────────────────────────────────────────────────── */
export function DashboardShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { loading } = useDashboardUser();

  const activeTab = getPrimaryTab(pathname);

  function handleLogout() {
    router.push("/logout");
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A0F1E]">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-700 border-t-[#0F766E]" />
      </div>
    );
  }

  /* ── sidebar primary items ── */
  const sidebarPrimary = [
    {
      id: "explore" as PrimaryTab,
      href: "/explore",
      label: "Explore",
      Icon: Compass,
    },
    {
      id: "trips" as PrimaryTab,
      href: "/trips",
      label: "Trips",
      Icon: Map,
    },
    {
      id: "live" as PrimaryTab,
      href: "/live",
      label: "LIVE",
      Icon: null, // replaced with LiveDot
    },
    {
      id: "notifications" as PrimaryTab,
      href: "/notifications",
      label: "Notifications",
      Icon: Bell,
    },
    {
      id: "profile" as PrimaryTab,
      href: "/profile",
      label: "Profile",
      Icon: User,
    },
  ];

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">

      {/* ─────────────────────── DESKTOP SIDEBAR ────────────────────────── */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col bg-[#0A0F1E] border-r border-slate-800">

        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-slate-800">
          <Link href="/explore">
            <RovvyLogo variant="dark" width={110} height={36} />
          </Link>
        </div>

        {/* Profile area */}
        <div className="flex flex-col items-center border-b border-slate-800/70 px-3 pb-4 pt-5">
          <ProfileDropdown layout="sidebar" avatarSize={56} onLogout={handleLogout} />
        </div>

        {/* Top bar actions in sidebar */}
        <div className="flex flex-col gap-1.5 px-4 py-3 border-b border-slate-800/50">
          <div className="flex items-center gap-2">
            <Link
              href="/chat"
              className="flex items-center gap-2 flex-1 rounded-xl px-3 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-800 hover:text-white transition"
            >
              <MessageSquare className="h-4 w-4" /> Chat Hub
            </Link>
            <button
              className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition"
              aria-label="Search"
            >
              <Search className="h-4 w-4" />
            </button>
          </div>
          <Link
            href="/wayra"
            className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition ${
              pathname === "/wayra"
                ? "bg-[#0F766E]/20 text-[#CCFBF1]"
                : "text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <Sparkles className="h-4 w-4 text-[#0F766E]" /> Wayra Personal AI
          </Link>
        </div>

        {/* Primary nav */}
        <nav className="flex flex-1 flex-col gap-0.5 px-3 py-3 overflow-y-auto">
          {sidebarPrimary.map(({ id, href, label, Icon }) => {
            const active = activeTab === id;
            const isLive = id === "live";
            return (
              <div key={id}>
                <Link
                  href={href}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all ${
                    active && !isLive
                      ? "bg-[#0F766E]/20 text-[#CCFBF1]"
                      : isLive
                      ? active
                        ? "bg-emerald-500/20 text-emerald-300"
                        : "text-slate-300 hover:bg-slate-800 hover:text-white"
                      : "text-slate-400 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  {isLive ? (
                    <LiveDot />
                  ) : Icon ? (
                    <Icon className="h-4 w-4 shrink-0" />
                  ) : null}
                  {label}
                  {isLive && (
                    <span className="ml-auto rounded-md bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-emerald-400">
                      Live
                    </span>
                  )}
                </Link>

                {/* Sub-navs */}
                {id === "explore" && active && (
                  <SubNavGroup label="Explore" items={EXPLORE_SUBNAV} pathname={pathname} />
                )}
                {id === "trips" && active && (
                  <SubNavGroup label="Trips" items={TRIPS_SUBNAV} pathname={pathname} />
                )}
              </div>
            );
          })}

          {/* Extras at bottom */}
          <div className="mt-auto pt-3 border-t border-slate-800 space-y-0.5">
            <Link
              href="/stats"
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition text-slate-500 hover:bg-slate-800 hover:text-white`}
            >
              <BarChart2 className="h-4 w-4 shrink-0" /> My Stats
            </Link>
            <Link
              href="/settings"
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition text-slate-500 hover:bg-slate-800 hover:text-white`}
            >
              <Settings className="h-4 w-4 shrink-0" /> Settings
            </Link>
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-800 hover:text-red-400 transition"
            >
              <LogOut className="h-4 w-4 shrink-0" /> Log out
            </button>
          </div>
        </nav>
      </aside>

      {/* ─────────────────────── MAIN CONTENT AREA ──────────────────────── */}
      <div className="flex min-h-screen flex-1 flex-col overflow-hidden">

        {/* ── DESKTOP TOP BAR ── */}
        <header className="hidden md:flex items-center justify-between border-b border-slate-200/80 bg-[#0A0F1E] px-6 py-3 shadow-sm">
          <div className="flex items-center gap-2">
            {/* Sub-nav pills for active section */}
            {activeTab === "explore" && (
              <div className="flex items-center gap-1">
                {EXPLORE_SUBNAV.map(({ href, label, Icon }) => {
                  const active = pathname === href || pathname.startsWith(`${href}/`);
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                        active
                          ? "bg-[#0F766E] text-white"
                          : "text-slate-400 hover:bg-slate-800 hover:text-white"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </Link>
                  );
                })}
              </div>
            )}
            {activeTab === "trips" && (
              <div className="flex items-center gap-1">
                {TRIPS_SUBNAV.map(({ href, label, Icon }) => {
                  const active = pathname === href || pathname.startsWith(`${href}/`);
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                        active
                          ? "bg-[#0F766E] text-white"
                          : "text-slate-400 hover:bg-slate-800 hover:text-white"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/wayra"
              className={`flex items-center gap-2 rounded-xl bg-slate-800 px-3 py-2 text-xs font-semibold transition ${
                pathname === "/wayra"
                  ? "bg-[#0F766E]/20 text-[#CCFBF1]"
                  : "text-slate-300 hover:bg-slate-700 hover:text-white"
              }`}
            >
              <Sparkles className="h-4 w-4 text-[#0F766E]" /> Wayra AI
            </Link>
            <Link
              href="/chat"
              className="flex items-center gap-2 rounded-xl bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition"
            >
              <MessageSquare className="h-4 w-4" /> Chat Hub
            </Link>
            <button className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition">
              <Search className="h-4 w-4" />
            </button>
            <NotificationBell variant="dark" />
          </div>
        </header>

        {/* ── MOBILE TOP BAR ── */}
        <header className="flex items-center gap-2 border-b border-slate-800/80 bg-[#0A0F1E] px-3 py-3 md:hidden">
          <Link href="/explore" className="mr-1">
            <RovvyLogo variant="dark" width={90} height={30} />
          </Link>
          <div className="flex-1" />
          <Link href="/chat" className="flex h-9 w-9 items-center justify-center rounded-xl text-white/80 hover:bg-white/10 transition">
            <MessageSquare className="h-5 w-5" />
          </Link>
          <SearchBar />
          <NotificationBell variant="dark" />
          <OverflowMenu onLogout={handleLogout} />
        </header>

        {/* ── MOBILE SUB-NAV STRIP ── */}
        {(activeTab === "explore" || activeTab === "trips") && (
          <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-100 bg-white px-3 py-2 md:hidden no-scrollbar">
            {(activeTab === "explore" ? EXPLORE_SUBNAV : TRIPS_SUBNAV).map(
              ({ href, label, Icon }) => {
                const active = pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                      active
                        ? "bg-[#0F766E] text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </Link>
                );
              }
            )}
          </div>
        )}

        {/* ── PAGE CONTENT ── */}
        <main className="flex-1 overflow-auto pb-24 md:pb-0">
          <PresenceHeartbeat />
          <PostOAuthWelcomeModal />
          <VerificationBanner />
          {children}
        </main>

        {/* ─────────────────────── MOBILE BOTTOM NAV ──────────────────────── */}
        <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-end bg-[#0F172A] border-t border-slate-800 md:hidden">
          {sidebarPrimary.map(({ id, href, label, Icon }, idx) => {
            const active = activeTab === id;
            const isLive = id === "live";
            const isCenter = idx === 2; // LIVE is index 2

            if (isCenter) {
              return (
                <Link
                  key={id}
                  href={href}
                  className="flex flex-1 flex-col items-center justify-start -mt-5"
                >
                  <span
                    className={`flex h-14 w-14 items-center justify-center rounded-full border-4 shadow-xl transition-all ${
                      active
                        ? "border-slate-900 bg-emerald-500 shadow-emerald-500/40"
                        : "border-slate-900 bg-[#0F766E] shadow-[#0F766E]/30 hover:bg-emerald-500"
                    }`}
                  >
                    <LiveDot />
                  </span>
                  <span
                    className={`mt-1 text-[9px] font-black uppercase tracking-widest pb-2 ${
                      active ? "text-emerald-400" : "text-slate-500"
                    }`}
                  >
                    Live
                  </span>
                </Link>
              );
            }

            return (
              <Link
                key={id}
                href={href}
                className={`flex flex-1 flex-col items-center gap-1 py-3 transition ${
                  active ? "text-[#0F766E]" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {Icon && <Icon className="h-5 w-5" />}
                <span className="text-[9px] font-bold uppercase tracking-wider">
                  {label === "Notifications" ? "Alerts" : label}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
