"use client";

import Link from "next/link";
import { OpenLoungeButton } from "@/components/lounge/OpenLoungeButton";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Building2,
  Camera,
  Compass,
  Check,
  CheckCircle,
  Clapperboard,
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Globe,
  Hotel,
  Map as MapIcon,
  MapPin,
  Mountain,
  Palmtree,
  Plane,
  ShoppingBag,
  Sun,
  Trees,
  Users,
  Utensils,
  Vote,
} from "lucide-react";

import { apiFetch, apiFetchWithStatus } from "@/lib/api";

const DASHBOARD_FETCH_TIMEOUT_MS = 45000;
import { clearToken } from "@/lib/auth";
import { emitOpenWayra } from "@/lib/open-wayra";
import WayraIcon from "@/components/ui/WayraIcon";

/** Dashboard color roles — navy structure, teal primary, neutrals surfaces. */
const NAVY = "#0F3460";
const BRAND = "#0F766E";
const BRAND_DARK = "#0D5C56";
const BRAND_SUBTLE = "#F0FDFA";
const BRAND_MUTED = "rgba(15, 118, 110, 0.12)";
const CARD = "#FFFFFF";
const SURFACE = "#F8F9FA";
const SURFACE_ALT = "#FAFBFC";
const BORDER = "#E9ECEF";
const MUTED = "#6C757D";
/** Text links — navy, quieter than filled primary buttons */
const LINK = "#0F3460";
const SUCCESS = "#22C55E";
const SUCCESS_SUBTLE = "#F0FDF4";
const SUCCESS_BORDER = "#BBF7D0";
const ATTENTION = "#B45309";
const ATTENTION_SUBTLE = "#FFFBEB";
/** Warm accent — negative balances / owes only (tiny dose) */
const WARM = "#DC2626";
const WARM_SUBTLE = "#FEF2F2";
const WARM_BORDER = "#FECACA";

/** Dashboard CTA destinations — keep button labels aligned with these paths. */
const DASHBOARD_ROUTES = {
  tripsPlan: "/trips/plan",
  tripsList: "/trips",
  /** Travel Hub is the live group-chat workspace (browse groups, messages, calls). */
  /** Dedicated group-creation entry; redirects into Travel Hub create modal. */
  groupsNew: "/groups/new",
  plan: "/plan",
  map: "/map",
  buddy: "/buddy",
  splitActivities: "/split-activities",
  notifications: "/notifications",
} as const;

/** Polls are authored and voted on inside a trip workspace. */
type TripWorkspaceTab =
  | "overview"
  | "itinerary"
  | "expenses"
  | "polls"
  | "members"
  | "map";

function tripWorkspaceHref(tripId: string, tab?: TripWorkspaceTab): string {
  const base = `/trips/${tripId}`;
  if (!tab || tab === "overview") return base;
  return `${base}?tab=${tab}`;
}

const ROVVY_UNLOCKS = [
  {
    Icon: Plane,
    title: "Trip workspace",
    detail: "Dates, routes, and plans in one place",
  },
  {
    Icon: Users,
    title: "Group chat",
    detail: "Invite people in Travel Hub",
  },
  {
    Icon: Vote,
    title: "Polls",
    detail: "Vote on dates, stays, and activities",
  },
  {
    Icon: Building2,
    title: "Shared costs",
    detail: "Split expenses and track balances",
  },
  {
    Icon: MapPin,
    title: "Map pins",
    detail: "Save stays and meet-up spots",
  },
  {
    Icon: CloudSun,
    title: "Trip weather",
    detail: "Forecasts for your next trip",
  },
] as const;

function RovvyUnlockGrid({ compact = false }: { compact?: boolean }) {
  return (
    <ul
      className={
        compact
          ? "mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3"
          : "mt-5 grid gap-3 sm:grid-cols-2"
      }
    >
      {ROVVY_UNLOCKS.map(({ Icon, title, detail }) => (
        <li
          key={title}
          className={
            compact
              ? "rounded-lg border px-2.5 py-2"
              : "flex gap-3 rounded-xl border px-3 py-3"
          }
          style={{ borderColor: BORDER, backgroundColor: SURFACE_ALT }}
        >
          <span
            className={
              compact
                ? "inline-flex shrink-0 rounded-md p-1"
                : "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            }
            style={{ backgroundColor: "#F4F7FB", color: NAVY }}
            aria-hidden
          >
            <Icon className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} strokeWidth={1.75} />
          </span>
          <div className={compact ? "mt-1.5" : "min-w-0"}>
            <p
              className={
                compact
                  ? "text-[11px] font-semibold leading-tight"
                  : "text-sm font-semibold"
              }
              style={{ color: NAVY }}
            >
              {title}
            </p>
            {!compact ? (
              <p className="mt-0.5 text-xs leading-snug" style={{ color: MUTED }}>
                {detail}
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Single primary empty experience when the user has no trips yet. */
function TripsPrimaryEmptyState() {
  return (
    <section
      className="rounded-2xl border p-6 shadow-sm"
      style={{ borderColor: `${BRAND}33`, backgroundColor: CARD }}
    >
      <div className="flex items-start gap-3">
        <span
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: BRAND_SUBTLE, color: BRAND }}
          aria-hidden
        >
          <Plane className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-bold tracking-tight" style={{ color: NAVY }}>
            Create your first trip
          </h2>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: MUTED }}>
            A trip brings together dates, polls, shared costs, and map pins for your
            group—no separate chats or spreadsheets.
          </p>
        </div>
      </div>

      <RovvyUnlockGrid />

      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          href={DASHBOARD_ROUTES.tripsPlan}
          className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
          style={{ backgroundColor: BRAND }}
        >
          Plan your first trip
        </Link>
        <Link
          href={DASHBOARD_ROUTES.groupsNew}
          className="inline-flex items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-semibold transition hover:bg-[#F8F9FA]"
          style={{ borderColor: BORDER, color: NAVY }}
        >
          Create a group
        </Link>
      </div>
    </section>
  );
}

/** Compact calendar empty when trips exist but none are upcoming-dated. */
function UpcomingTripsCompactEmpty({ activeTripCount }: { activeTripCount: number }) {
  return (
    <div
      className="mt-4 rounded-xl border border-dashed px-4 py-3"
      style={{ borderColor: BORDER, backgroundColor: SURFACE_ALT }}
    >
      <p className="text-sm font-semibold" style={{ color: NAVY }}>
        No trip dates yet
      </p>
      <p className="mt-1 text-xs leading-relaxed" style={{ color: MUTED }}>
        You have {activeTripCount} active {activeTripCount === 1 ? "trip" : "trips"}.
        Add start dates to show weather and checklists here.
      </p>
      <Link
        href={DASHBOARD_ROUTES.tripsList}
        className="mt-2 inline-block text-xs font-semibold hover:underline"
        style={{ color: LINK }}
      >
        View all trips →
      </Link>
    </div>
  );
}

function PollsEmptyState({
  hasTrips,
  firstTripId,
}: {
  hasTrips: boolean;
  firstTripId?: string;
}) {
  return (
    <div className="mt-4">
      <span className="inline-flex rounded-lg p-2" style={{ backgroundColor: BRAND_SUBTLE, color: BRAND }} aria-hidden>
        <Vote className="h-6 w-6" strokeWidth={1.5} />
      </span>
      <p className="mt-3 text-sm font-semibold" style={{ color: NAVY }}>
        No open polls
      </p>
      <p className="mt-1 text-xs leading-relaxed" style={{ color: MUTED }}>
        Start a poll in a trip to choose dates, stays, or activities together.
      </p>
      <Link
        href={
          hasTrips && firstTripId
            ? tripWorkspaceHref(firstTripId, "polls")
            : DASHBOARD_ROUTES.tripsPlan
        }
        className="mt-3 inline-block text-sm font-semibold hover:underline"
        style={{ color: LINK }}
      >
        {hasTrips ? "Start a poll →" : "Create a trip first →"}
      </Link>
    </div>
  );
}

function CompanionsEmptyState({ variant }: { variant: "onboarding" | "active" }) {
  if (variant === "onboarding") {
    return (
      <div className="mt-4 rounded-lg px-1 py-2 text-center">
        <p className="text-xs leading-relaxed" style={{ color: MUTED }}>
          Create a trip and invite people in Travel Hub to see them here.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <span className="inline-flex rounded-lg p-2" style={{ backgroundColor: "#F4F7FB", color: NAVY }} aria-hidden>
        <Users className="h-6 w-6" strokeWidth={1.5} />
      </span>
      <p className="mt-3 text-sm font-semibold" style={{ color: NAVY }}>
        No companions yet
      </p>
      <p className="mt-1 text-xs leading-relaxed" style={{ color: MUTED }}>
        Create a group in Travel Hub and invite people to plan trips together.
      </p>
      <Link
        href={DASHBOARD_ROUTES.groupsNew}
        className="mt-3 inline-block text-sm font-semibold hover:underline"
        style={{ color: LINK }}
      >
        Create a group →
      </Link>
    </div>
  );
}

function ExpensesEmptyState({ hasTrips }: { hasTrips: boolean }) {
  return (
    <div className="mt-4">
      <span className="inline-flex rounded-lg p-2" style={{ backgroundColor: "#F0FDF4", color: SUCCESS }} aria-hidden>
        <Building2 className="h-6 w-6" strokeWidth={1.5} />
      </span>
      <p className="mt-3 text-sm font-semibold" style={{ color: NAVY }}>
        {hasTrips ? "Nothing owed" : "No shared expenses yet"}
      </p>
      <p className="mt-1 text-xs leading-relaxed" style={{ color: MUTED }}>
        {hasTrips
          ? "Add trip expenses and Rovvy will split them and show who owes what."
          : "Create a trip with your group to start tracking shared costs."}
      </p>
      <Link
        href={hasTrips ? DASHBOARD_ROUTES.splitActivities : DASHBOARD_ROUTES.tripsPlan}
        className="mt-3 inline-block text-sm font-semibold hover:underline"
        style={{ color: LINK }}
      >
        {hasTrips ? "View shared expenses →" : "Create a trip first →"}
      </Link>
    </div>
  );
}

function BuddyTripsIntro() {
  return (
    <p className="mt-1 text-xs leading-relaxed" style={{ color: MUTED }}>
      Find trips with open spots—or post your own on Buddy.
    </p>
  );
}

function BuddySampleNote() {
  return (
    <p className="mt-2 text-[10px] leading-snug" style={{ color: MUTED }}>
      Examples below—not live listings. Browse Buddy for real trips near you.
    </p>
  );
}

const DASHBOARD_WAYRA_PROMPTS = [
  {
    label: "Getting started",
    prompt: "What should I do first on my Rovvy dashboard?",
  },
  {
    label: "Create a group",
    prompt: "How do I create a group and invite people on Rovvy?",
  },
] as const;

function DashboardSectionLabel({ children }: { children: string }) {
  return (
    <p
      className="mb-3 text-[11px] font-semibold uppercase tracking-wide"
      style={{ color: MUTED }}
    >
      {children}
    </p>
  );
}

function BuddyTripsCard({ compact = false }: { compact?: boolean }) {
  const itemPad = compact ? "px-3 py-2" : "px-3 py-3";
  const titleClass = compact ? "text-xs" : "text-sm";
  const metaClass = compact ? "text-[9px]" : "text-[10px]";

  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const token = typeof window !== "undefined" ? localStorage.getItem("gt_token") : null;
    if (!token) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const data = await apiFetch<any[]>("/buddy/trips?status=open");
        if (active) {
          setTrips(Array.isArray(data) ? data : []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div
      className="rounded-xl border p-4 shadow-sm"
      style={{ borderColor: BORDER, backgroundColor: CARD }}
    >
      <h2 className="text-sm font-semibold" style={{ color: NAVY }}>
        Open trips on Buddy
      </h2>
      <BuddyTripsIntro />
      {loading ? (
        <div className="mt-4 space-y-2 animate-pulse">
          <div className="h-10 bg-slate-100 rounded-lg" />
          <div className="h-10 bg-slate-100 rounded-lg" />
        </div>
      ) : trips.length === 0 ? (
        <div className="mt-4 text-center py-6 px-4 rounded-xl border border-dashed border-[#E9ECEF] bg-[#F8F9FA]">
          <p className="text-xs font-medium" style={{ color: MUTED }}>
            No buddy trips nearby yet. Be the first to create one!
          </p>
          <Link
            href={DASHBOARD_ROUTES.buddy}
            className="mt-3 inline-flex items-center justify-center rounded-xl bg-[#0F766E] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:opacity-95"
          >
            Create Buddy Trip →
          </Link>
        </div>
      ) : (
        <>
          <ul className="mt-3 space-y-3">
            {trips.slice(0, 3).map((t) => {
              const spots = Math.max(0, t.max_size - t.current_size);
              return (
                <li key={t.id}>
                  <Link
                    href={DASHBOARD_ROUTES.buddy}
                    className={`block rounded-lg border transition hover:border-[#0F766E]/25 hover:bg-[#F0FDFA] ${itemPad}`}
                    style={{ borderColor: BORDER }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className={`font-bold ${titleClass}`} style={{ color: NAVY }}>
                          {t.destination}
                        </p>
                        <p className={`mt-0.5 ${metaClass}`} style={{ color: MUTED }}>
                          {t.date_from} · {t.current_size} members · {compact ? `${spots} spots` : `${spots} spots left`}
                        </p>
                      </div>
                      <span
                        className="shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-semibold"
                        style={{ borderColor: BRAND, color: BRAND, backgroundColor: CARD }}
                      >
                        Join →
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
          <Link
            href={DASHBOARD_ROUTES.buddy}
            className="mt-4 inline-block text-xs font-semibold hover:underline"
            style={{ color: LINK }}
          >
            Browse Buddy trips →
          </Link>
        </>
      )}
    </div>
  );
}

/** Secondary helper — sits below core dashboard work, not beside it. */
function DashboardWayraHelper() {
  return (
    <section
      className="border-t pt-5"
      style={{ borderColor: BORDER }}
      aria-label="Wayra helper"
    >
      <div
        className="flex flex-col gap-3 rounded-xl border border-dashed px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
        style={{ borderColor: BORDER, backgroundColor: SURFACE_ALT }}
      >
        <div className="flex min-w-0 items-start gap-2.5">
          <div className="mt-0.5 shrink-0 opacity-75" aria-hidden>
            <WayraIcon state="perched" size={0.28} variant="navy" animate={false} />
          </div>
          <div className="min-w-0">
            <p
              className="text-[10px] font-semibold uppercase tracking-wide"
              style={{ color: MUTED }}
            >
              Questions about Rovvy?
            </p>
            <p className="mt-0.5 text-xs leading-snug" style={{ color: NAVY }}>
              Ask Wayra how the app works or for destination ideas. Use the sections
              above for trips, groups, polls, and expenses.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 sm:shrink-0 sm:justify-end">
          {DASHBOARD_WAYRA_PROMPTS.map(({ label, prompt }) => (
            <button
              key={label}
              type="button"
              onClick={() => emitOpenWayra({ prompt })}
              className="rounded-full border bg-white px-2.5 py-1 text-[10px] font-medium transition hover:border-[#0F766E]/20 hover:bg-[#F0FDFA]"
              style={{ borderColor: BORDER, color: NAVY }}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => emitOpenWayra()}
            className="rounded-md px-1.5 py-1 text-[10px] font-medium underline-offset-2 transition hover:underline"
            style={{ color: MUTED }}
          >
            Open Wayra
          </button>
        </div>
      </div>
      <p className="mt-1.5 text-[10px] leading-relaxed" style={{ color: MUTED }}>
        App help works offline. Destination tips need the assistant when it&apos;s
        available.
      </p>
    </section>
  );
}

type UserMe = {
  id: string;
  full_name: string;
  email: string;
};

type TravelStats = {
  trips_created: number;
  groups_joined: number;
  locations_saved: number;
  expenses_paid: number;
  polls_created?: number;
  countries_from_trips: string[];
};

type GroupMemberOut = {
  id: string;
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  role: string;
  last_seen_at: string | null;
};

type GroupOut = {
  id: string;
  name: string;
  members: GroupMemberOut[];
};

type TripOut = {
  id: string;
  group_id: string;
  title: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
};

type TripWithMeta = TripOut & { group_name: string; member_count: number };

type LocationOut = {
  id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  category: string | null;
};

type ExpenseOut = {
  id: string;
  description: string;
  amount: number;
};

type BalanceRow = {
  from_user_id: string;
  to_user_id: string;
  amount: number;
};

type SplitPersonSummary = {
  userId: string;
  name: string;
  net: number;
  incoming: number;
  outgoing: number;
};

type PollOptionOut = {
  id: string;
  poll_id: string;
  label: string;
  vote_count: number;
};

type PollOut = {
  id: string;
  trip_id: string;
  question: string;
  status: string;
  closes_at: string | null;
  options: PollOptionOut[];
};

type OpenMeteoCurrent = {
  temperature_2m?: number;
  apparent_temperature?: number;
  relative_humidity_2m?: number;
  weathercode?: number;
  windspeed_10m?: number;
};

type OpenMeteoDaily = {
  time: string[];
  weathercode: number[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
};

type WeatherBundle = {
  current: OpenMeteoCurrent;
  daily: OpenMeteoDaily;
};

function firstToken(name: string): string {
  const p = name.trim().split(/\s+/)[0];
  return p || "there";
}

function parseYmd(s: string | null): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function startOfToday(): Date {
  const t = new Date();
  return new Date(t.getFullYear(), t.getMonth(), t.getDate());
}

function formatRupee(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: n % 1 === 0 ? 0 : 2,
  }).format(n);
}

/** e.g. "Apr 20–27, 2026" or cross-month */
function formatDateRangeReadable(
  start: string | null,
  end: string | null,
): string {
  if (!start) return "Dates TBC";
  const sd = parseYmd(start);
  if (!sd) return "Dates TBC";
  const fmt = (d: Date, withYear: boolean) =>
    d.toLocaleDateString("en-IN", {
      month: "short",
      day: "numeric",
      ...(withYear ? { year: "numeric" } : {}),
    });
  if (!end) return fmt(sd, true);
  const ed = parseYmd(end);
  if (!ed) return fmt(sd, true);
  const sameMonthYear =
    sd.getMonth() === ed.getMonth() && sd.getFullYear() === ed.getFullYear();
  if (sameMonthYear) {
    return `${sd.toLocaleDateString("en-IN", { month: "short" })} ${sd.getDate()}–${ed.getDate()}, ${ed.getFullYear()}`;
  }
  return `${fmt(sd, false)}–${fmt(ed, true)}`;
}

function subtextDayDate(): string {
  const now = new Date();
  return now.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const Shimmer = ({
  width = "100%",
  height = 16,
}: {
  width?: string | number;
  height?: number;
}) => (
  <div
    style={{
      width,
      height,
      background:
        "linear-gradient(90deg, #1e2538 25%, #2a3248 50%, #1e2538 75%)",
      backgroundSize: "200% 100%",
      borderRadius: 8,
      animation: "shimmer 1.5s infinite",
    }}
  />
);

async function apiFetchWithDeadline<T>(
  path: string,
  pageSignal: AbortSignal,
): Promise<T> {
  const t = new AbortController();
  const timer = setTimeout(() => t.abort(), DASHBOARD_FETCH_TIMEOUT_MS);
  const onPageAbort = () => t.abort();
  pageSignal.addEventListener("abort", onPageAbort);
  try {
    if (pageSignal.aborted) throw new DOMException("Aborted", "AbortError");
    return await apiFetch<T>(path, { signal: t.signal });
  } finally {
    clearTimeout(timer);
    pageSignal.removeEventListener("abort", onPageAbort);
  }
}

async function apiFetchWithStatusDeadline<T>(
  path: string,
  pageSignal: AbortSignal,
): Promise<{ data: T | null; status: number }> {
  const t = new AbortController();
  const timer = setTimeout(() => t.abort(), DASHBOARD_FETCH_TIMEOUT_MS);
  const onPageAbort = () => t.abort();
  pageSignal.addEventListener("abort", onPageAbort);
  try {
    if (pageSignal.aborted) return { data: null, status: 0 };
    return await apiFetchWithStatus<T>(path, { signal: t.signal });
  } finally {
    clearTimeout(timer);
    pageSignal.removeEventListener("abort", onPageAbort);
  }
}

function DestinationGlyph({
  title,
  className = "h-4 w-4",
}: {
  title: string;
  className?: string;
}) {
  const t = title.toLowerCase();
  const cls = `${className} shrink-0 text-current`;
  if (/goa|beach|coastal|sea|sand|maldives|bali|coast/.test(t))
    return <Palmtree className={cls} strokeWidth={1.5} aria-hidden />;
  if (/manali|trek|mountain|himalaya|hiking|nepal|peak/.test(t))
    return <Mountain className={cls} strokeWidth={1.5} aria-hidden />;
  if (/delhi|mumbai|bangalore|city|metro|urban|paris|tokyo|london/.test(t))
    return <Building2 className={cls} strokeWidth={1.5} aria-hidden />;
  if (/international|abroad|overseas/.test(t))
    return <Plane className={cls} strokeWidth={1.5} aria-hidden />;
  return <MapPin className={cls} strokeWidth={1.5} aria-hidden />;
}

function WeatherGlyph({
  code,
  className = "h-6 w-6",
}: {
  code: number;
  className?: string;
}) {
  const c = `${className} shrink-0 text-current`;
  if (code === 0) return <Sun className={c} strokeWidth={1.5} aria-hidden />;
  if (code === 1 || code === 2)
    return <CloudSun className={c} strokeWidth={1.5} aria-hidden />;
  if (code === 3) return <Cloud className={c} strokeWidth={1.5} aria-hidden />;
  if (code === 45 || code === 48)
    return <CloudFog className={c} strokeWidth={1.5} aria-hidden />;
  if ([51, 53, 55, 56, 57].includes(code))
    return <CloudRain className={c} strokeWidth={1.5} aria-hidden />;
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code))
    return <CloudRain className={c} strokeWidth={1.5} aria-hidden />;
  if ([71, 73, 75, 77].includes(code))
    return <CloudSnow className={c} strokeWidth={1.5} aria-hidden />;
  if ([95, 96, 99].includes(code))
    return <CloudLightning className={c} strokeWidth={1.5} aria-hidden />;
  return <CloudSun className={c} strokeWidth={1.5} aria-hidden />;
}

function isRainCode(code: number): boolean {
  return [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(
    code,
  );
}

function pollIsOpen(p: PollOut): boolean {
  if (p.status !== "open") return false;
  if (p.closes_at) {
    const end = new Date(p.closes_at).getTime();
    if (Number.isFinite(end) && Date.now() > end) return false;
  }
  return true;
}

function isOnlineSeen(lastSeenAt: string | null, windowMin: number): boolean {
  if (!lastSeenAt) return false;
  const t = new Date(lastSeenAt).getTime();
  if (!Number.isFinite(t)) return false;
  return Date.now() - t < windowMin * 60 * 1000;
}

function agoLabel(lastSeenAt: string | null): string {
  if (!lastSeenAt) return "—";
  const t = new Date(lastSeenAt).getTime();
  if (!Number.isFinite(t)) return "—";
  const diffMin = Math.floor((Date.now() - t) / (60 * 1000));
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const h = Math.floor(diffMin / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function stringHue(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h + s.charCodeAt(i) * 17) % 360;
  return `hsl(${h} 55% 42%)`;
}

function CategoryGlyph({ category }: { category: string | null }) {
  if (!category)
    return (
      <MapPin
        className="mr-1 inline h-4 w-4 shrink-0 align-text-bottom"
        strokeWidth={1.5}
        aria-hidden
      />
    );
  const c = category.toLowerCase();
  const cls = "mr-1 inline h-4 w-4 shrink-0 align-text-bottom";
  if (/food|restaurant|cafe/.test(c))
    return <Utensils className={cls} strokeWidth={1.5} aria-hidden />;
  if (/hotel|stay|lodg/.test(c))
    return <Hotel className={cls} strokeWidth={1.5} aria-hidden />;
  if (/shop|mall/.test(c))
    return <ShoppingBag className={cls} strokeWidth={1.5} aria-hidden />;
  if (/nature|park|view/.test(c))
    return <Trees className={cls} strokeWidth={1.5} aria-hidden />;
  return <MapPin className={cls} strokeWidth={1.5} aria-hidden />;
}

function pickSoonestTrip(trips: TripWithMeta[]): TripWithMeta | null {
  const today = startOfToday();
  const ongoing = trips.filter((t) => t.status === "ongoing");
  if (ongoing.length) {
    ongoing.sort((a, b) => {
      const da = parseYmd(a.start_date)?.getTime() ?? 0;
      const db = parseYmd(b.start_date)?.getTime() ?? 0;
      return da - db;
    });
    return ongoing[0] ?? null;
  }
  const upcoming = trips.filter((t) => {
    if (t.status === "cancelled" || t.status === "completed") return false;
    const sd = parseYmd(t.start_date);
    if (!sd) return false;
    return sd >= today;
  });
  upcoming.sort((a, b) => {
    const da = parseYmd(a.start_date)?.getTime() ?? Infinity;
    const db = parseYmd(b.start_date)?.getTime() ?? Infinity;
    return da - db;
  });
  return upcoming[0] ?? null;
}

function formatDateStripForBanner(
  start: string | null,
  end: string | null,
): string {
  if (!start) return "Dates TBC";
  const sd = parseYmd(start);
  if (!sd) return "Dates TBC";
  if (!end) {
    return sd.toLocaleDateString("en-IN", {
      month: "short",
      day: "numeric",
    });
  }
  const ed = parseYmd(end);
  if (!ed) {
    return sd.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
  }
  const sameMy =
    sd.getMonth() === ed.getMonth() && sd.getFullYear() === ed.getFullYear();
  if (sameMy) {
    return `${sd.toLocaleDateString("en-IN", { month: "short" })} ${sd.getDate()}–${ed.getDate()}`;
  }
  return `${sd.toLocaleDateString("en-IN", { month: "short", day: "numeric" })}–${ed.toLocaleDateString("en-IN", { month: "short", day: "numeric" })}`;
}

function tripBannerBadge(trip: TripWithMeta): {
  text: string;
  bg: string;
} {
  if (trip.status === "ongoing") {
    return { text: "Live now", bg: SUCCESS };
  }
  const sd = parseYmd(trip.start_date);
  if (!sd) return { text: "—", bg: MUTED };
  const d = Math.ceil(
    (sd.getTime() - startOfToday().getTime()) / (24 * 60 * 60 * 1000),
  );
  if (d === 0) return { text: "Today!", bg: SUCCESS };
  if (d < 0) return { text: "Started", bg: BRAND_DARK };
  return { text: `${d} day${d === 1 ? "" : "s"} away`, bg: BRAND };
}

function destinationLine(
  trip: TripWithMeta,
  firstPinName: string | null,
): string {
  const dest =
    firstPinName?.trim() ||
    trip.title.split(/[|–,]/)[0]?.trim() ||
    trip.title;
  return dest;
}

async function geocodeCity(
  q: string,
  signal?: AbortSignal,
): Promise<{ lat: number; lon: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`;
  const res = await fetch(url, {
    signal,
    headers: {
      "User-Agent": "RovvyDashboard/1.0 (rovvy.app)",
      Accept: "application/json",
    },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { lat?: string; lon?: string }[];
  const row = data[0];
  if (!row?.lat || !row?.lon) return null;
  const lat = parseFloat(row.lat);
  const lon = parseFloat(row.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}

async function fetchOpenMeteo(
  lat: number,
  lon: number,
  signal?: AbortSignal,
): Promise<WeatherBundle | null> {
  const u = new URL("https://api.open-meteo.com/v1/forecast");
  u.searchParams.set("latitude", String(lat));
  u.searchParams.set("longitude", String(lon));
  u.searchParams.set(
    "current",
    "temperature_2m,apparent_temperature,relative_humidity_2m,weathercode,windspeed_10m",
  );
  u.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,weathercode");
  u.searchParams.set("timezone", "auto");
  u.searchParams.set("forecast_days", "5");
  const res = await fetch(u.toString(), { signal });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    current?: OpenMeteoCurrent;
    daily?: OpenMeteoDaily;
  };
  if (!json.current || !json.daily?.time?.length) return null;
  return { current: json.current, daily: json.daily as OpenMeteoDaily };
}

function findRainDayLabel(
  daily: OpenMeteoDaily,
  start: string | null,
  end: string | null,
): string | null {
  if (!start || !daily.time.length) return null;
  const tripStart = parseYmd(start);
  const tripEnd = parseYmd(end ?? start) ?? tripStart;
  if (!tripStart || !tripEnd) return null;
  for (let i = 0; i < daily.time.length; i++) {
    const day = parseYmd(daily.time[i]);
    if (!day) continue;
    if (day < tripStart || day > tripEnd) continue;
    const code = daily.weathercode[i];
    if (code !== undefined && isRainCode(code)) {
      return day.toLocaleDateString("en-IN", { weekday: "long", month: "short", day: "numeric" });
    }
  }
  return null;
}

export default function DashboardPage() {
  const router = useRouter();
  const pageAbortRef = useRef<AbortController | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [openPollsCount, setOpenPollsCount] = useState(0);
  const [postComingSoonOpen, setPostComingSoonOpen] = useState(false);

  const [me, setMe] = useState<UserMe | null>(null);
  const [userName, setUserName] = useState("there");

  useEffect(() => {
    try {
      const token = localStorage.getItem("gt_token");
      if (token) {
        const payload = JSON.parse(atob(token.split(".")[1]));
        const name = payload.full_name || payload.username || "there";
        setUserName(firstToken(name));
      }
    } catch (e) {
      // ignore
    }
  }, []);

  const [stats, setStats] = useState<TravelStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  const [groups, setGroups] = useState<GroupOut[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [groupsError, setGroupsError] = useState<string | null>(null);

  const [tripsLoading, setTripsLoading] = useState(true);
  const [tripsError, setTripsError] = useState<string | null>(null);
  const [tripsList, setTripsList] = useState<TripWithMeta[]>([]);

  const [smartTrip, setSmartTrip] = useState<TripWithMeta | null>(null);
  const [tripPins, setTripPins] = useState<LocationOut[]>([]);
  const [tripExpensesList, setTripExpensesList] = useState<ExpenseOut[]>([]);
  const [tripBalanceSummary, setTripBalanceSummary] = useState<BalanceRow[]>(
    [],
  );
  const [weather, setWeather] = useState<WeatherBundle | null>(null);
  const [rainDayLabel, setRainDayLabel] = useState<string | null>(null);
  /** True while loading pins/expenses/weather for the selected trip only. */
  const [smartTripDetailsLoading, setSmartTripDetailsLoading] = useState(true);

  const [pollItems, setPollItems] = useState<
    { poll: PollOut; tripId: string }[]
  >([]);
  const [pollsLoading, setPollsLoading] = useState(true);
  const [pollsError, setPollsError] = useState<string | null>(null);

  const [expenseLines, setExpenseLines] = useState<
    { row: BalanceRow; tripId: string; tripTitle: string }[]
  >([]);
  const [expensesLoading, setExpensesLoading] = useState(true);
  const [expensesError, setExpensesError] = useState<string | null>(null);

  const userNameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const g of groups) {
      for (const mem of g.members ?? []) {
        if (!m.has(mem.user_id)) m.set(mem.user_id, mem.full_name);
      }
    }
    return m;
  }, [groups]);

  const companions = useMemo(() => {
    if (!me) return [];
    const seen = new Set<string>();
    const out: GroupMemberOut[] = [];
    for (const g of groups) {
      for (const mem of g.members ?? []) {
        if (mem.user_id === me.id) continue;
        if (seen.has(mem.user_id)) continue;
        seen.add(mem.user_id);
        out.push(mem);
        if (out.length >= 4) return out;
      }
    }
    return out;
  }, [groups, me]);

  const myPendingExpenses = useMemo(() => {
    if (!me) return [];
    return expenseLines.filter(({ row }) => {
      const youOwe = row.from_user_id === me.id && row.amount > 0.01;
      const owesYou = row.to_user_id === me.id && row.amount > 0.01;
      return youOwe || owesYou;
    });
  }, [expenseLines, me]);

  const splitSummary = useMemo(() => {
    const byPerson = new Map<string, SplitPersonSummary>();
    let incomingTotal = 0;
    let outgoingTotal = 0;

    if (!me) {
      return {
        incomingTotal,
        outgoingTotal,
        netTotal: 0,
        people: [] as SplitPersonSummary[],
        visiblePeople: [] as SplitPersonSummary[],
      };
    }

    for (const { row } of myPendingExpenses) {
      if (row.amount <= 0.01) continue;

      const isIncoming = row.to_user_id === me.id;
      const otherId = isIncoming ? row.from_user_id : row.to_user_id;
      const existing =
        byPerson.get(otherId) ??
        ({
          userId: otherId,
          name: userNameMap.get(otherId) ?? otherId,
          net: 0,
          incoming: 0,
          outgoing: 0,
        } satisfies SplitPersonSummary);

      if (isIncoming) {
        existing.net += row.amount;
        existing.incoming += row.amount;
        incomingTotal += row.amount;
      } else {
        existing.net -= row.amount;
        existing.outgoing += row.amount;
        outgoingTotal += row.amount;
      }

      byPerson.set(otherId, existing);
    }

    const people = Array.from(byPerson.values())
      .filter((person) => Math.abs(person.net) > 0.01)
      .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));

    return {
      incomingTotal,
      outgoingTotal,
      netTotal: incomingTotal - outgoingTotal,
      people,
      visiblePeople: people.slice(0, 3),
    };
  }, [me, myPendingExpenses, userNameMap]);

  const checklist = useMemo(() => {
    const desc = tripExpensesList.map((e) => e.description.toLowerCase()).join(" ");
    const hotel = /hotel|stay|lodg|resort/.test(desc);
    const transport =
      /flight|train|bus ticket|uber|cab|\b(bus)\b/.test(desc);
    const membersOk = (smartTrip?.member_count ?? 0) >= 2;
    const settled =
      tripBalanceSummary.length === 0 ||
      tripBalanceSummary.every((r) => Math.abs(r.amount) < 0.01);
    const offlineMap = false;
    return { hotel, transport, membersOk, settled, offlineMap };
  }, [tripExpensesList, tripBalanceSummary, smartTrip]);

  const checklistDone = useMemo(() => {
    let n = 0;
    if (checklist.hotel) n++;
    if (checklist.transport) n++;
    if (checklist.membersOk) n++;
    if (checklist.settled) n++;
    if (checklist.offlineMap) n++;
    return n;
  }, [checklist]);

  const smartChecklist = useMemo(() => {
    return [
      { key: "hotel", done: checklist.hotel, label: "Pin stays on the map" },
      { key: "trans", done: checklist.transport, label: "Add transport bookings" },
      { key: "group", done: checklist.membersOk, label: "Invite 2+ group members" },
      { key: "settle", done: checklist.settled, label: "Settle shared costs" },
      { key: "offline", done: checklist.offlineMap, label: "Save a map pin" },
    ];
  }, [checklist]);

  const activeJourneysCount = useMemo(
    () =>
      tripsList.filter(
        (t) => t.status !== "completed" && t.status !== "cancelled",
      ).length,
    [tripsList],
  );

  const pollSectionFooter = useMemo(() => {
    if (pollItems.length === 0) return null;
    return {
      href: tripWorkspaceHref(pollItems[0].tripId, "polls"),
      label: "View open polls →",
    };
  }, [pollItems]);

  const firstTripId = tripsList[0]?.id;

  const upcomingTripsDisplay = useMemo(() => {
    const today = startOfToday();
    const ongoing = tripsList.filter((t) => t.status === "ongoing");
    if (ongoing.length) {
      ongoing.sort((a, b) => {
        const da = parseYmd(a.start_date)?.getTime() ?? 0;
        const db = parseYmd(b.start_date)?.getTime() ?? 0;
        return da - db;
      });
      return ongoing.slice(0, 3);
    }
    const rest = tripsList.filter((t) => {
      if (t.status === "cancelled" || t.status === "completed") return false;
      const sd = parseYmd(t.start_date);
      if (!sd) return false;
      return sd >= today;
    });
    rest.sort((a, b) => {
      const da = parseYmd(a.start_date)?.getTime() ?? 0;
      const db = parseYmd(b.start_date)?.getTime() ?? 0;
      return da - db;
    });
    return rest.slice(0, 3);
  }, [tripsList]);

  const otherUpcomingTrips = useMemo(() => {
    if (!smartTrip) return upcomingTripsDisplay;
    return upcomingTripsDisplay.filter((t) => t.id !== smartTrip.id);
  }, [upcomingTripsDisplay, smartTrip]);

  useEffect(() => {
    pageAbortRef.current?.abort();
    const ac = new AbortController();
    pageAbortRef.current = ac;
    const pageSignal = ac.signal;
    let cancelled = false;

    const emptyStats: TravelStats = {
      trips_created: 0,
      groups_joined: 0,
      locations_saved: 0,
      expenses_paid: 0,
      countries_from_trips: [],
    };

    async function loadSmartTripExtras(soonest: TripWithMeta) {
      try {
        const [locs, exps, bal] = await Promise.all([
          apiFetchWithDeadline<LocationOut[]>(
            `/trips/${soonest.id}/locations`,
            pageSignal,
          ).catch(() => [] as LocationOut[]),
          apiFetchWithDeadline<ExpenseOut[]>(
            `/trips/${soonest.id}/expenses`,
            pageSignal,
          ).catch(() => [] as ExpenseOut[]),
          apiFetchWithDeadline<BalanceRow[]>(
            `/trips/${soonest.id}/expenses/summary`,
            pageSignal,
          ).catch(() => [] as BalanceRow[]),
        ]);
        if (cancelled || pageSignal.aborted) return;
        setTripPins(locs);
        setTripExpensesList(exps);
        setTripBalanceSummary(bal);
        const geoQuery = locs[0]?.name ?? soonest.title ?? "India";
        const coords = await geocodeCity(geoQuery, pageSignal).catch(
          () => null,
        );
        if (cancelled || pageSignal.aborted) return;
        if (coords) {
          const wx = await fetchOpenMeteo(
            coords.lat,
            coords.lon,
            pageSignal,
          ).catch(() => null);
          if (cancelled || pageSignal.aborted) return;
          if (wx) {
            setWeather(wx);
            setRainDayLabel(
              findRainDayLabel(
                wx.daily,
                soonest.start_date ?? null,
                soonest.end_date ?? null,
              ),
            );
          } else {
            setWeather(null);
            setRainDayLabel(null);
          }
        } else {
          setWeather(null);
          setRainDayLabel(null);
        }
      } catch (e) {
        if ((e as Error)?.name === "AbortError") return;
      } finally {
        if (!cancelled && !pageSignal.aborted) {
          setSmartTripDetailsLoading(false);
        }
      }
    }

    async function run() {
      setStatsError(null);
      setGroupsError(null);
      setTripsError(null);
      setPollsError(null);
      setExpensesError(null);
      setStatsLoading(true);
      setGroupsLoading(true);
      setTripsLoading(true);
      setPollsLoading(true);
      setExpensesLoading(true);
      setSmartTripDetailsLoading(true);

      const meRes = await apiFetchWithStatusDeadline<UserMe>(
        "/auth/me",
        pageSignal,
      );
      if (cancelled || pageSignal.aborted) return;
      if (meRes.status === 401) {
        clearToken();
        setMe(null);
        setStatsLoading(false);
        setGroupsLoading(false);
        setTripsLoading(false);
        setPollsLoading(false);
        setExpensesLoading(false);
        setSmartTripDetailsLoading(false);
        return;
      }
      if (!meRes.data) {
        setMe(null);
        setStatsLoading(false);
        setGroupsLoading(false);
        setTripsLoading(false);
        setPollsLoading(false);
        setExpensesLoading(false);
        setSmartTripDetailsLoading(false);
        return;
      }
      setMe(meRes.data);
      setUserName(firstToken(meRes.data.full_name ?? meRes.data.email ?? "there"));

      const settled = await Promise.allSettled([
        apiFetchWithDeadline<TravelStats>("/users/me/travel-stats", pageSignal),
        apiFetchWithDeadline<GroupOut[]>("/groups", pageSignal),
      ]);
      if (cancelled || pageSignal.aborted) return;

      let st: TravelStats | null = null;
      if (settled[0]!.status === "fulfilled") {
        st = settled[0]!.value;
      } else {
        const err = settled[0]!.reason as Error | undefined;
        if (err?.name === "AbortError" || pageSignal.aborted) return;
        setStatsError("Couldn't load this section.");
      }

      let grpList: GroupOut[] = [];
      if (settled[1]!.status === "fulfilled") {
        grpList = settled[1]!.value;
      } else {
        const err = settled[1]!.reason as Error | undefined;
        if (err?.name === "AbortError" || pageSignal.aborted) return;
        setGroupsError("Couldn't load this section.");
      }

      setStats(
        st ?? {
          ...emptyStats,
        },
      );
      setStatsLoading(false);
      setGroups(grpList);
      setGroupsLoading(false);

      let tripLists: TripOut[][];
      try {
        tripLists = await Promise.all(
          grpList.map((g) =>
            apiFetchWithDeadline<TripOut[]>(`/groups/${g.id}/trips`, pageSignal),
          ),
        );
      } catch (e) {
        if ((e as Error)?.name === "AbortError" || pageSignal.aborted) return;
        setTripsError("Couldn't load this section.");
        tripLists = grpList.map(() => []);
      }
      if (cancelled || pageSignal.aborted) return;

      const merged: TripWithMeta[] = [];
      grpList.forEach((g, i) => {
        const mc = g.members?.length ?? 0;
        for (const t of tripLists[i] ?? []) {
          merged.push({
            ...t,
            group_name: g.name,
            member_count: mc,
          });
        }
      });
      setTripsList(merged);
      setTripsLoading(false);

      const soonest = pickSoonestTrip(merged);
      setSmartTrip(soonest);

      const activeOrdered = merged
        .filter((t) => t.status !== "completed" && t.status !== "cancelled")
        .sort((a, b) => {
          const da = parseYmd(a.start_date)?.getTime() ?? Infinity;
          const db = parseYmd(b.start_date)?.getTime() ?? Infinity;
          return da - db;
        });

      if (!soonest) {
        setTripPins([]);
        setTripExpensesList([]);
        setTripBalanceSummary([]);
        setWeather(null);
        setRainDayLabel(null);
        setSmartTripDetailsLoading(false);
      } else {
        void loadSmartTripExtras(soonest);
      }

      void (async () => {
        let pollLists: PollOut[][];
        try {
          pollLists = await Promise.all(
            activeOrdered.map((trip) =>
              apiFetchWithDeadline<PollOut[]>(
                `/trips/${trip.id}/polls`,
                pageSignal,
              ).catch(() => [] as PollOut[]),
            ),
          );
        } catch (e) {
          if ((e as Error)?.name === "AbortError" || pageSignal.aborted) return;
          setPollsError("Couldn't load this section.");
          setPollsLoading(false);
          return;
        }
        if (cancelled || pageSignal.aborted) return;
        const pollsAccum: { poll: PollOut; tripId: string }[] = [];
        activeOrdered.forEach((trip, idx) => {
          for (const pol of pollLists[idx] ?? []) {
            if (!pollIsOpen(pol)) continue;
            pollsAccum.push({ poll: pol, tripId: trip.id });
          }
        });
        setOpenPollsCount(pollsAccum.length);
        setPollItems(pollsAccum.slice(0, 2));
        setPollsLoading(false);
      })();

      void (async () => {
        const expTripIds = activeOrdered.slice(0, 8);
        let expResults: BalanceRow[][];
        try {
          expResults = await Promise.all(
            expTripIds.map((trip) =>
              apiFetchWithDeadline<BalanceRow[]>(
                `/trips/${trip.id}/expenses/summary`,
                pageSignal,
              ).catch(() => [] as BalanceRow[]),
            ),
          );
        } catch (e) {
          if ((e as Error)?.name === "AbortError" || pageSignal.aborted) return;
          setExpensesError("Couldn't load this section.");
          setExpensesLoading(false);
          return;
        }
        if (cancelled || pageSignal.aborted) return;
        const flatExp: {
          row: BalanceRow;
          tripId: string;
          tripTitle: string;
        }[] = [];
        expTripIds.forEach((trip, idx) => {
          for (const row of expResults[idx] ?? []) {
            flatExp.push({ row, tripId: trip.id, tripTitle: trip.title });
          }
        });
        setExpenseLines(flatExp);
        setExpensesLoading(false);
      })();
    }

    void run().catch((err) => {
      if ((err as Error)?.name === "AbortError") return;
      console.warn("[Rovvy] Dashboard load partial failure:", err);
    });
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [router, reloadTick]);

  const groupCount = stats?.groups_joined ?? groups.length;

  const showSmartSkeleton =
    tripsLoading || (Boolean(smartTrip) && smartTripDetailsLoading);
  const showPollsSkeleton = pollsLoading;
  const showExpensesSkeleton = expensesLoading;
  const showCompanionsSkeleton = groupsLoading;
  const showUpcomingSkeleton = tripsLoading;

  const smartFirstPinName = tripPins[0]?.name ?? null;

  return (
    <div className="space-y-8 pb-6" style={{ color: NAVY }}>
      {/* ——— Identity & next actions ——— */}
      {/* HERO */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: MUTED }}>
            Rovvy · Roam together
          </p>
          <h1 className="mt-2 text-xl font-bold leading-snug tracking-tight md:text-2xl">
            <span style={{ color: BRAND }}>{userName}</span>, your group travel dashboard.
          </h1>
          <p className="mt-2 text-sm font-medium" style={{ color: NAVY }}>
            Active trips, open polls, shared costs, and your group—all on one page.
          </p>
          <p className="mt-1 text-xs" style={{ color: MUTED }}>
            {subtextDayDate()}
            {!statsLoading && !groupsLoading
              ? ` · ${activeJourneysCount} active ${activeJourneysCount === 1 ? "trip" : "trips"} · ${groupCount} ${groupCount === 1 ? "group" : "groups"}`
              : null}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={
                smartTrip
                  ? tripWorkspaceHref(smartTrip.id)
                  : DASHBOARD_ROUTES.tripsPlan
              }
              className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
              style={{ backgroundColor: BRAND }}
            >
              {smartTrip ? "Open current trip" : "Plan a trip"}
            </Link>
          </div>
        </div>
      </div>

      {/* COMMAND METRICS — active now, needs attention, people, travel value */}
      <section aria-label="Dashboard metrics">
        <p
          className="mb-2 text-[11px] font-semibold uppercase tracking-wide"
          style={{ color: MUTED }}
        >
          At a glance
        </p>
        {statsError && !statsLoading ? (
          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <p>Couldn&apos;t load dashboard stats.</p>
            <button
              type="button"
              onClick={() => setReloadTick((x) => x + 1)}
              className="mt-1 font-semibold underline"
              style={{ color: NAVY }}
            >
              Retry
            </button>
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {(
            [
              {
                Icon: Plane,
                n: activeJourneysCount,
                label: "Active trips",
                hint: "Trips you're planning or on now",
                dash: tripsLoading,
                tone: "primary" as const,
              },
              {
                Icon: Users,
                n: groupCount,
                label: "Your groups",
                hint: "Groups you belong to",
                dash: groupsLoading,
                tone: "default" as const,
              },
              {
                Icon: Vote,
                n: openPollsCount,
                label: "Open polls",
                hint: "Still waiting on votes",
                dash: pollsLoading,
                tone:
                  !pollsLoading && openPollsCount > 0
                    ? ("attention" as const)
                    : ("default" as const),
              },
              {
                Icon: MapPin,
                n: stats?.locations_saved ?? 0,
                label: "Saved places",
                hint: "Pinned on your map",
                dash: statsLoading,
                tone: "default" as const,
              },
              {
                Icon: Globe,
                n: stats?.countries_from_trips?.length ?? 0,
                label: "Countries visited",
                hint: "From completed trips",
                dash: statsLoading,
                tone: "default" as const,
              },
            ] as const
          ).map((c) => {
            const SIcon = c.Icon;
            const show = c.dash ? "—" : c.n;
            const isPrimary = c.tone === "primary";
            const isAttention = c.tone === "attention";
            return (
              <div
                key={c.label}
                className="flex flex-col rounded-xl border px-3 py-3.5 shadow-sm sm:px-4 sm:py-4"
                style={{
                  borderColor: isPrimary
                    ? `${BRAND}40`
                    : isAttention
                      ? "#F59E0B55"
                      : BORDER,
                  backgroundColor: isPrimary
                    ? BRAND_SUBTLE
                    : isAttention
                      ? ATTENTION_SUBTLE
                      : CARD,
                }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex rounded-lg p-1.5"
                    style={{
                      backgroundColor: isPrimary
                        ? BRAND_MUTED
                        : isAttention
                          ? "#FEF3C7"
                          : "#F4F7FB",
                      color: isPrimary ? BRAND : isAttention ? ATTENTION : NAVY,
                    }}
                    aria-hidden
                  >
                    <SIcon className="h-4 w-4" strokeWidth={1.75} />
                  </span>
                  <p
                    className="text-[10px] font-semibold uppercase tracking-wide leading-tight"
                    style={{ color: MUTED }}
                  >
                    {c.label}
                  </p>
                </div>
                <p
                  className="mt-2 text-2xl font-bold tabular-nums"
                  style={{ color: NAVY }}
                >
                  {show}
                </p>
                <p className="mt-1 text-[11px] leading-snug" style={{ color: MUTED }}>
                  {c.hint}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* PRIMARY QUICK ACTIONS */}
      <section>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: MUTED }}>
          Quick actions
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {(
            [
              { Icon: Plane, label: "+New Trip", href: DASHBOARD_ROUTES.tripsPlan, primary: true },
              {
                Icon: MapIcon,
                label: "Plan Weekend Trip",
                href: "/trip-space",
                primary: false,
              },
              {
                Icon: Users,
                label: "+New Group",
                href: DASHBOARD_ROUTES.groupsNew,
                primary: false,
              },
              { Icon: MapIcon, label: "View map", href: DASHBOARD_ROUTES.map, primary: false },
            ] as const
          ).map((a) => {
            const QIcon = a.Icon;
            return (
              <Link
                key={a.label}
                href={a.href}
                className={
                  a.primary
                    ? "group rounded-xl px-3 py-4 text-center text-[11px] font-bold text-white shadow-sm transition hover:opacity-95"
                    : "group rounded-xl border bg-white px-3 py-4 text-center text-[11px] font-bold transition hover:border-[#0F3460]/25 hover:bg-[#F8F9FA]"
                }
                style={
                  a.primary
                    ? { backgroundColor: BRAND }
                    : { borderColor: BORDER, color: NAVY }
                }
              >
                <span className="flex justify-center text-current leading-none" aria-hidden>
                  <QIcon className="h-[18px] w-[18px]" strokeWidth={1.5} />
                </span>
                <span className="mt-2 block">{a.label}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* WORKSPACE — active now → waiting → people → explore */}
      {!tripsLoading && tripsList.length === 0 ? (
        <div className="space-y-8">
          <section aria-label="Active now">
            <DashboardSectionLabel>Active now</DashboardSectionLabel>
            <TripsPrimaryEmptyState />
          </section>

          <section aria-label="Needs your attention">
            <DashboardSectionLabel>Needs your attention</DashboardSectionLabel>
            <div className="grid gap-4 md:grid-cols-2">
              <div
                className="rounded-xl border p-4 shadow-sm"
                style={{ borderColor: BORDER, backgroundColor: CARD }}
              >
                <h2 className="text-sm font-semibold" style={{ color: NAVY }}>
                  Active polls
                </h2>
                <PollsEmptyState hasTrips={false} />
              </div>
              <div
                className="rounded-xl border p-4 shadow-sm"
                style={{ borderColor: BORDER, backgroundColor: CARD }}
              >
                <h2 className="text-sm font-semibold" style={{ color: NAVY }}>
                  Shared expenses
                </h2>
                <ExpensesEmptyState hasTrips={false} />
              </div>
            </div>
          </section>

          <section aria-label="Your people">
            <DashboardSectionLabel>Your people</DashboardSectionLabel>
            <div
              className="rounded-xl border p-4 shadow-sm"
              style={{ borderColor: BORDER, backgroundColor: CARD }}
            >
              <h2 className="text-sm font-semibold" style={{ color: NAVY }}>
                Group companions
              </h2>
              <p className="mt-1 text-xs" style={{ color: MUTED }}>
                People you travel with across trips
              </p>
              {companions.length === 0 ? (
                <CompanionsEmptyState variant="onboarding" />
              ) : (
                <ul className="mt-4 space-y-3">
                  {companions.slice(0, 3).map((c) => {
                    const online = isOnlineSeen(c.last_seen_at, 5);
                    return (
                      <li key={c.user_id} className="flex items-center gap-2">
                        <img
                          src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(c.user_id)}`}
                          alt=""
                          width={28}
                          height={28}
                          className="h-7 w-7 shrink-0 rounded-full ring-1 ring-[#E9ECEF]"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold" style={{ color: NAVY }}>
                            {c.full_name}
                          </p>
                          <div className="flex items-center gap-1.5">
                            <span
                              className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                              style={{
                                backgroundColor: online ? SUCCESS : "#CED4DA",
                              }}
                            />
                            <span
                              className="text-[9px] font-semibold"
                              style={{ color: online ? SUCCESS : MUTED }}
                            >
                              {online ? "Online" : agoLabel(c.last_seen_at)}
                            </span>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              <OpenLoungeButton
                className="mt-4 inline-block text-xs font-semibold hover:underline"
                style={{ color: LINK }}
              >
                Open Rovvy Lounge →
              </OpenLoungeButton>
            </div>
          </section>

          <section aria-label="Explore">
            <DashboardSectionLabel>Explore</DashboardSectionLabel>
            <BuddyTripsCard compact />
          </section>
        </div>
      ) : (
        <div className="space-y-8">
          {/* ——— Active now ——— */}
          <section aria-label="Active now">
            <DashboardSectionLabel>Active now</DashboardSectionLabel>
            <div className="space-y-4">
              {showSmartSkeleton ? (
                <div
                  className="overflow-hidden rounded-xl border shadow-sm"
                  style={{ borderColor: BORDER, backgroundColor: CARD }}
                >
                  <div className="space-y-3 p-4" style={{ backgroundColor: BRAND }}>
                    <Shimmer height={24} width="60%" />
                    <Shimmer height={14} width="90%" />
                    <div className="mt-4 flex gap-2">
                      <Shimmer height={64} width={64} />
                      <div className="flex-1 space-y-2">
                        <Shimmer height={20} />
                        <Shimmer height={12} width="70%" />
                      </div>
                    </div>
                  </div>
                </div>
              ) : smartTrip ? (
                <div
                  className="overflow-hidden rounded-xl border shadow-sm"
                  style={{ borderColor: BORDER, backgroundColor: CARD }}
                >
                  <div className="p-4 text-white" style={{ backgroundColor: BRAND }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#A5C9FF]">
                          Current trip
                        </p>
                        <h2 className="mt-1 truncate text-lg font-bold">{smartTrip.title}</h2>
                        <p className="mt-0.5 text-xs text-[#A5C9FF]">
                          {formatDateStripForBanner(smartTrip.start_date, smartTrip.end_date)} ·{" "}
                          {smartTrip.group_name}
                        </p>
                      </div>
                      <Link
                        href={tripWorkspaceHref(smartTrip.id)}
                        className="shrink-0 rounded-full bg-white/20 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-white/30"
                      >
                        Open trip →
                      </Link>
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-[#A5C9FF]/20 pt-4">
                      {smartTripDetailsLoading ? (
                        <Shimmer height={40} width={120} />
                      ) : weather ? (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex text-white" aria-hidden>
                            <WeatherGlyph
                              code={weather.current.weathercode ?? 0}
                              className="h-7 w-7"
                            />
                          </span>
                          <div>
                            <p className="text-sm font-bold">
                              {weather.current.temperature_2m != null
                                ? `${Math.round(weather.current.temperature_2m)}°C`
                                : "—"}
                            </p>
                            <p className="text-[10px] text-[#A5C9FF]">
                              {destinationLine(smartTrip, smartFirstPinName)}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-[#A5C9FF]">Weather unavailable</p>
                      )}
                      {rainDayLabel ? (
                        <span className="rounded bg-sky-900/50 px-2 py-0.5 text-[9px] font-semibold text-sky-200">
                          ☔ Rain expected {rainDayLabel}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p
                          className="text-[10px] font-bold uppercase tracking-wider"
                          style={{ color: MUTED }}
                        >
                          Saved pins
                        </p>
                        <p className="mt-1 text-base font-bold" style={{ color: NAVY }}>
                          {tripPins.length}
                        </p>
                        <p className="mt-0.5 truncate text-[10px]" style={{ color: MUTED }}>
                          {smartFirstPinName ? `📍 ${smartFirstPinName}` : "No map pins saved"}
                        </p>
                      </div>
                      <div>
                        <p
                          className="text-[10px] font-bold uppercase tracking-wider"
                          style={{ color: MUTED }}
                        >
                          Total budget
                        </p>
                        <p className="mt-1 text-base font-bold" style={{ color: SUCCESS }}>
                          {formatRupee(
                            tripExpensesList.reduce((sum, e) => sum + e.amount, 0),
                          )}
                        </p>
                        <p className="mt-0.5 truncate text-[10px]" style={{ color: MUTED }}>
                          Split between {smartTrip.member_count} members
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 border-t pt-4">
                      <p
                        className="text-[10px] font-bold uppercase tracking-wider"
                        style={{ color: MUTED }}
                      >
                        Checklist ({checklistDone}/5)
                      </p>
                      <ul className="mt-2 space-y-1">
                        {smartChecklist.map((row) => (
                          <li key={row.key} className="flex items-center gap-1.5 text-[11px]">
                            {row.done ? (
                              <CheckCircle className="h-3.5 w-3.5 shrink-0" style={{ color: SUCCESS }} />
                            ) : (
                              <span className="h-3.5 w-3.5 shrink-0 rounded-full border" />
                            )}
                            <span
                              style={{
                                color: row.done ? MUTED : NAVY,
                                textDecoration: row.done ? "line-through" : "none",
                              }}
                            >
                              {row.label}
                            </span>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${(checklistDone / 5) * 100}%`,
                            backgroundColor: BRAND,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : showUpcomingSkeleton ? (
                <div
                  className="rounded-xl border p-4 shadow-sm"
                  style={{ borderColor: BORDER, backgroundColor: CARD }}
                >
                  <Shimmer height={18} width="40%" />
                  <div className="mt-4 space-y-3">
                    <Shimmer height={40} width="100%" />
                    <Shimmer height={40} width="100%" />
                  </div>
                </div>
              ) : (
                <UpcomingTripsCompactEmpty activeTripCount={activeJourneysCount} />
              )}

              {otherUpcomingTrips.length > 0 ? (
                <div
                  className="rounded-xl border p-4 shadow-sm"
                  style={{ borderColor: BORDER, backgroundColor: CARD }}
                >
                  <h3 className="text-sm font-semibold" style={{ color: NAVY }}>
                    More upcoming trips
                  </h3>
                  <ul className="mt-3 space-y-3">
                    {otherUpcomingTrips.map((t) => {
                      const badge = tripBannerBadge(t);
                      return (
                        <li
                          key={t.id}
                          className="flex gap-2 border-b border-[#E9ECEF] pb-3 last:border-0 last:pb-0"
                        >
                          <span
                            className="inline-flex text-lg leading-none text-[#0F3460]"
                            aria-hidden
                          >
                            <DestinationGlyph title={t.title} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold" style={{ color: NAVY }}>
                              {t.title}
                            </p>
                            <p className="text-[10px]" style={{ color: MUTED }}>
                              {badge ? `${badge} · ` : ""}
                              {t.group_name}
                            </p>
                          </div>
                          <Link
                            href={tripWorkspaceHref(t.id)}
                            className="shrink-0 self-center text-xs font-semibold"
                            style={{ color: LINK }}
                          >
                            Open trip →
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                  <Link
                    href={DASHBOARD_ROUTES.tripsList}
                    className="mt-4 inline-block text-sm font-semibold"
                    style={{ color: LINK }}
                  >
                    View all trips →
                  </Link>
                </div>
              ) : smartTrip ? (
                <Link
                  href={DASHBOARD_ROUTES.tripsList}
                  className="inline-block text-sm font-semibold"
                  style={{ color: LINK }}
                >
                  View all trips →
                </Link>
              ) : null}
            </div>
          </section>

          {/* ——— Needs your attention ——— */}
          <section aria-label="Needs your attention">
            <DashboardSectionLabel>Needs your attention</DashboardSectionLabel>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
              {pollsError && !showPollsSkeleton ? (
                <div
                  className="rounded-xl border p-4 shadow-sm"
                  style={{ borderColor: BORDER, backgroundColor: CARD }}
                >
                  <h2 className="text-sm font-semibold" style={{ color: NAVY }}>
                    Active polls
                  </h2>
                  <p className="mt-3 text-sm" style={{ color: MUTED }}>
                    Couldn&apos;t load this section.
                  </p>
                  <button
                    type="button"
                    onClick={() => setReloadTick((x) => x + 1)}
                    className="mt-2 text-sm font-semibold"
                    style={{ color: LINK }}
                  >
                    Retry
                  </button>
                </div>
              ) : showPollsSkeleton ? (
                <div
                  className="rounded-xl border p-4 shadow-sm"
                  style={{ borderColor: BORDER, backgroundColor: CARD }}
                >
                  <h2 className="text-sm font-semibold" style={{ color: NAVY }}>
                    Active polls
                  </h2>
                  <ul className="mt-3 space-y-3">
                    <li className="flex gap-2">
                      <Shimmer width={20} height={20} />
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <Shimmer height={16} width="80%" />
                        <Shimmer height={12} width="50%" />
                      </div>
                    </li>
                  </ul>
                </div>
              ) : (
                <div
                  className="rounded-xl border p-4 shadow-sm"
                  style={{ borderColor: BORDER, backgroundColor: CARD }}
                >
                  <h2 className="text-sm font-semibold" style={{ color: NAVY }}>
                    Active polls
                  </h2>
                  {pollItems.length === 0 ? (
                    <PollsEmptyState
                      hasTrips={tripsList.length > 0}
                      firstTripId={firstTripId}
                    />
                  ) : (
                    <ul className="mt-3 space-y-5">
                      {pollItems.map(({ poll: p, tripId }) => {
                        const totals = p.options.reduce(
                          (s, o) => s + o.vote_count,
                          0,
                        );
                        const maxV = Math.max(0, ...p.options.map((o) => o.vote_count));
                        const showVoteNow = totals === 0;
                        return (
                          <li key={p.id}>
                            <p className="text-xs font-bold leading-snug" style={{ color: NAVY }}>
                              {p.question}
                            </p>
                            <div className="mt-2 space-y-1.5">
                              {p.options.map((o) => {
                                const pct =
                                  totals > 0
                                    ? Math.round((o.vote_count / totals) * 100)
                                    : 0;
                                const lead = o.vote_count === maxV && maxV > 0;
                                return (
                                  <div key={o.id}>
                                    <div className="flex justify-between text-[10px]" style={{ color: MUTED }}>
                                      <span className="truncate pr-1">{o.label}</span>
                                      <span>{o.vote_count}</span>
                                    </div>
                                    <div className="mt-0.5 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                                      <div
                                        className="h-full rounded-full"
                                        style={{
                                          width: `${pct}%`,
                                          backgroundColor: lead ? BRAND : NAVY,
                                        }}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              {showVoteNow ? (
                                <Link
                                  href={tripWorkspaceHref(tripId, "polls")}
                                  className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                                  style={{ backgroundColor: BRAND }}
                                >
                                  Vote now →
                                </Link>
                              ) : null}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {pollSectionFooter ? (
                    <Link
                      href={pollSectionFooter.href}
                      className="mt-4 inline-block text-sm font-semibold"
                      style={{ color: LINK }}
                    >
                      {pollSectionFooter.label}
                    </Link>
                  ) : null}
                </div>
              )}
            </div>

            <div>
              {expensesError && !showExpensesSkeleton ? (
                <div
                  className="rounded-xl border p-4 shadow-sm"
                  style={{ borderColor: BORDER, backgroundColor: CARD }}
                >
                  <h2 className="text-sm font-semibold" style={{ color: NAVY }}>
                    Shared expenses
                  </h2>
                  <p className="mt-3 text-sm" style={{ color: MUTED }}>
                    Couldn&apos;t load this section.
                  </p>
                  <button
                    type="button"
                    onClick={() => setReloadTick((x) => x + 1)}
                    className="mt-2 text-sm font-semibold"
                    style={{ color: LINK }}
                  >
                    Retry
                  </button>
                </div>
              ) : showExpensesSkeleton ? (
                <div
                  className="rounded-xl border p-4 shadow-sm"
                  style={{ borderColor: BORDER, backgroundColor: CARD }}
                >
                  <h2 className="text-sm font-semibold" style={{ color: NAVY }}>
                    Shared expenses
                  </h2>
                  <div className="mt-3 space-y-1.5">
                    <Shimmer height={14} width="90%" />
                    <Shimmer height={8} width="100%" />
                  </div>
                </div>
              ) : (
                <div
                  className="rounded-xl border p-4 shadow-sm"
                  style={{ borderColor: BORDER, backgroundColor: CARD }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold" style={{ color: NAVY }}>
                        Shared expenses
                      </h2>
                      <p className="mt-1 text-xs" style={{ color: MUTED }}>
                        What you owe and are owed across trips
                      </p>
                    </div>
                    {myPendingExpenses.length > 0 ? (
                      <Link
                        href={DASHBOARD_ROUTES.splitActivities}
                        className="shrink-0 text-xs font-semibold"
                        style={{ color: LINK }}
                      >
                        View all balances →
                      </Link>
                    ) : null}
                  </div>
                  {myPendingExpenses.length === 0 ? (
                    <ExpensesEmptyState hasTrips={tripsList.length > 0} />
                  ) : (
                    <>
                      <div className="mt-4 grid grid-cols-3 gap-2">
                        <div
                          className="rounded-xl border px-3 py-2"
                          style={{
                            borderColor: SUCCESS_BORDER,
                            backgroundColor: SUCCESS_SUBTLE,
                          }}
                        >
                          <p
                            className="text-[10px] font-semibold uppercase tracking-wide"
                            style={{ color: SUCCESS }}
                          >
                            Owed to you
                          </p>
                          <p
                            className="mt-1 text-sm font-bold tabular-nums"
                            style={{ color: SUCCESS }}
                          >
                            {formatRupee(splitSummary.incomingTotal)}
                          </p>
                        </div>
                        <div
                          className="rounded-xl border px-3 py-2"
                          style={{
                            borderColor: WARM_BORDER,
                            backgroundColor: WARM_SUBTLE,
                          }}
                        >
                          <p
                            className="text-[10px] font-semibold uppercase tracking-wide"
                            style={{ color: WARM }}
                          >
                            You owe
                          </p>
                          <p
                            className="mt-1 text-sm font-bold tabular-nums"
                            style={{ color: WARM }}
                          >
                            {formatRupee(splitSummary.outgoingTotal)}
                          </p>
                        </div>
                        <div
                          className="rounded-xl border px-3 py-2"
                          style={{
                            borderColor:
                              splitSummary.netTotal >= 0 ? SUCCESS_BORDER : WARM_BORDER,
                            backgroundColor:
                              splitSummary.netTotal >= 0 ? SUCCESS_SUBTLE : WARM_SUBTLE,
                            color: splitSummary.netTotal >= 0 ? SUCCESS : WARM,
                          }}
                        >
                          <p className="text-[10px] font-semibold uppercase tracking-wide">
                            Net balance
                          </p>
                          <p className="mt-1 text-sm font-bold tabular-nums">
                            {splitSummary.netTotal >= 0 ? "+" : "-"}
                            {formatRupee(Math.abs(splitSummary.netTotal))}
                          </p>
                        </div>
                      </div>

                      <ul className="mt-3 divide-y divide-[#E9ECEF]">
                        {splitSummary.visiblePeople.map((person) => {
                          const positive = person.net > 0;
                          const color = positive ? SUCCESS : WARM;
                          const initial = (person.name.trim()[0] ?? "?").toUpperCase();
                          return (
                            <li key={person.userId}>
                              <Link
                                href={DASHBOARD_ROUTES.splitActivities}
                                className="flex items-center gap-2 py-2.5"
                                aria-label={`Open split activity for ${person.name}`}
                              >
                                <div
                                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                                  style={{ backgroundColor: stringHue(person.name) }}
                                >
                                  {initial}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-xs font-bold" style={{ color: NAVY }}>
                                    {person.name}
                                  </p>
                                  <p className="text-[10px]" style={{ color: MUTED }}>
                                    {positive ? "They owe you" : "You owe them"}
                                  </p>
                                </div>
                                <p className="text-sm font-bold tabular-nums" style={{ color }}>
                                  {positive ? "+" : "-"}
                                  {formatRupee(Math.abs(person.net))}
                                </p>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>

                      <Link
                        href={DASHBOARD_ROUTES.splitActivities}
                        className="mt-3 inline-flex w-full items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold text-white"
                        style={{ backgroundColor: BRAND }}
                      >
                        View all expenses
                        {splitSummary.people.length > 3
                          ? ` · ${splitSummary.people.length - 3} more`
                          : ""}
                      </Link>
                    </>
                  )}
                </div>
              )}
            </div>
            </div>
          </section>

          <section aria-label="Your people">
            <DashboardSectionLabel>Your people</DashboardSectionLabel>
            <div>
              {groupsError && !showCompanionsSkeleton ? (
                <div
                  className="rounded-xl border p-4 shadow-sm"
                  style={{ borderColor: BORDER, backgroundColor: CARD }}
                >
                  <h2 className="text-sm font-semibold" style={{ color: NAVY }}>
                    Group companions
                  </h2>
                  <p className="mt-3 text-sm" style={{ color: MUTED }}>
                    Couldn&apos;t load this section.
                  </p>
                  <button
                    type="button"
                    onClick={() => setReloadTick((x) => x + 1)}
                    className="mt-2 text-sm font-semibold"
                    style={{ color: LINK }}
                  >
                    Retry
                  </button>
                </div>
              ) : showCompanionsSkeleton ? (
                <div
                  className="rounded-xl border p-4 shadow-sm"
                  style={{ borderColor: BORDER, backgroundColor: CARD }}
                >
                  <h2 className="text-sm font-semibold" style={{ color: NAVY }}>
                    Group companions
                  </h2>
                  <div className="mt-3 space-y-2">
                    <Shimmer height={40} width="100%" />
                  </div>
                </div>
              ) : (
                <div
                  className="rounded-xl border p-4 shadow-sm"
                  style={{ borderColor: BORDER, backgroundColor: CARD }}
                >
                  <h2 className="text-sm font-semibold" style={{ color: NAVY }}>
                    Group companions
                  </h2>
                  <p className="mt-1 text-xs" style={{ color: MUTED }}>
                    People you travel with across trips
                  </p>
                  {companions.length === 0 ? (
                    <CompanionsEmptyState variant="active" />
                  ) : (
                    <ul className="mt-3 space-y-3">
                      {companions.map((c) => {
                        const online = isOnlineSeen(c.last_seen_at, 5);
                        return (
                          <li key={c.user_id} className="flex items-center gap-2">
                            <img
                              src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(c.user_id)}`}
                              alt=""
                              width={32}
                              height={32}
                              className="h-8 w-8 shrink-0 rounded-full ring-1 ring-[#E9ECEF]"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold" style={{ color: NAVY }}>
                                {c.full_name}
                              </p>
                              <div className="flex items-center gap-1.5">
                                <span
                                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                                  style={{
                                    backgroundColor: online ? SUCCESS : "#CED4DA",
                                  }}
                                />
                                <span
                                  className="text-[10px] font-semibold"
                                  style={{ color: online ? SUCCESS : MUTED }}
                                >
                                  {online ? "Online" : agoLabel(c.last_seen_at)}
                                </span>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  <OpenLoungeButton
                    className="mt-4 inline-block text-sm font-semibold"
                    style={{ color: LINK }}
                  >
                    Open Rovvy Lounge →
                  </OpenLoungeButton>
                </div>
              )}
            </div>
          </section>

          <section aria-label="Explore">
            <DashboardSectionLabel>Explore</DashboardSectionLabel>
            <BuddyTripsCard />
          </section>
        </div>
      )}

      <DashboardWayraHelper />

      {postComingSoonOpen ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-post-soon-title"
        >
          <div
            className="w-full max-w-sm rounded-2xl border bg-white p-6 shadow-xl"
            style={{ borderColor: BORDER }}
          >
            <h2 id="new-post-soon-title" className="text-lg font-semibold" style={{ color: NAVY }}>
              Posts are coming soon
            </h2>
            <p className="mt-2 text-sm" style={{ color: MUTED }}>
              Share trip photos and updates from your profile once posts launch. For now, plan a trip or
              open Travel Hub with your group.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPostComingSoonOpen(false)}
                className="rounded-lg border px-4 py-2 text-sm font-semibold"
                style={{ borderColor: BORDER, color: NAVY }}
              >
                Close
              </button>
              <Link
                href={DASHBOARD_ROUTES.tripsPlan}
                onClick={() => setPostComingSoonOpen(false)}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
                style={{ backgroundColor: BRAND }}
              >
                Plan a trip
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
