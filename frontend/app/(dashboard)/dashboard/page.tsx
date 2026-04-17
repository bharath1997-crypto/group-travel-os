"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { apiFetch, apiFetchWithStatus } from "@/lib/api";
import { clearToken } from "@/lib/auth";

const NAVY = "#0F3460";
const CORAL = "#E94560";
const CARD = "#FFFFFF";
const BORDER = "#E9ECEF";
const MUTED = "#6C757D";
const SUCCESS = "#22C55E";

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

function destinationEmoji(title: string): string {
  const t = title.toLowerCase();
  if (/goa|beach|coastal|sea|sand|maldives|bali|coast/.test(t)) return "🏖️";
  if (/manali|trek|mountain|himalaya|hiking|nepal|peak/.test(t)) return "🏔️";
  if (/delhi|mumbai|bangalore|city|metro|urban|paris|tokyo|london/.test(t))
    return "🌆";
  if (/international|abroad|overseas/.test(t)) return "✈️";
  return "📍";
}

function weatherCodeToEmoji(code: number): string {
  const m: Record<number, string> = {
    0: "☀️",
    1: "🌤️",
    2: "⛅",
    3: "☁️",
    45: "🌫️",
    51: "🌦️",
    61: "🌧️",
    71: "❄️",
    80: "🌦️",
    95: "⛈️",
  };
  return m[code] ?? "🌤️";
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

function categoryEmoji(cat: string | null): string {
  if (!cat) return "📍";
  const c = cat.toLowerCase();
  if (/food|restaurant|cafe/.test(c)) return "🍽️";
  if (/hotel|stay|lodg/.test(c)) return "🏨";
  if (/shop|mall/.test(c)) return "🛍️";
  if (/nature|park|view/.test(c)) return "🌿";
  return "📍";
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
    return { text: "Live now 🔴", bg: SUCCESS };
  }
  const sd = parseYmd(trip.start_date);
  if (!sd) return { text: "—", bg: CORAL };
  const d = Math.ceil(
    (sd.getTime() - startOfToday().getTime()) / (24 * 60 * 60 * 1000),
  );
  if (d === 0) return { text: "Today!", bg: SUCCESS };
  if (d < 0) return { text: "Started", bg: CORAL };
  return { text: `${d} day${d === 1 ? "" : "s"} away`, bg: CORAL };
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

async function geocodeCity(q: string): Promise<{ lat: number; lon: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "TravelloDashboard/1.0 (travello.app)",
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
  const res = await fetch(u.toString());
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

function StatCardSkeleton() {
  return (
    <div
      className="flex flex-col items-center rounded-xl border px-2 py-4 text-center shadow-sm"
      style={{ borderColor: BORDER, backgroundColor: CARD }}
    >
      <div className="h-[18px] w-[18px] animate-pulse rounded bg-gray-200" />
      <div className="mt-2 h-7 w-10 animate-pulse rounded bg-gray-200" />
      <div className="mt-2 h-2.5 w-16 animate-pulse rounded bg-gray-200" />
    </div>
  );
}

function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div
      className="rounded-xl border p-4 shadow-sm"
      style={{ borderColor: BORDER, backgroundColor: CARD }}
    >
      <div className="h-4 w-28 animate-pulse rounded bg-gray-200" />
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="mt-3 h-3 w-full animate-pulse rounded bg-gray-200"
        />
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();

  const [me, setMe] = useState<UserMe | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [stats, setStats] = useState<TravelStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const [groups, setGroups] = useState<GroupOut[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);

  const [tripsLoading, setTripsLoading] = useState(true);
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

  const [skeletonDeadline, setSkeletonDeadline] = useState(false);

  const [pollItems, setPollItems] = useState<
    { poll: PollOut; tripId: string }[]
  >([]);
  const [pollsLoading, setPollsLoading] = useState(true);

  const [expenseLines, setExpenseLines] = useState<
    { row: BalanceRow; tripId: string; tripTitle: string }[]
  >([]);
  const [expensesLoading, setExpensesLoading] = useState(true);

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

  useEffect(() => {
    const t = window.setTimeout(() => setSkeletonDeadline(true), 5000);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadSmartTripExtras(soonest: TripWithMeta) {
      try {
        const [locs, exps, bal] = await Promise.all([
          apiFetch<LocationOut[]>(`/trips/${soonest.id}/locations`).catch(
            () => [] as LocationOut[],
          ),
          apiFetch<ExpenseOut[]>(`/trips/${soonest.id}/expenses`).catch(
            () => [] as ExpenseOut[],
          ),
          apiFetch<BalanceRow[]>(`/trips/${soonest.id}/expenses/summary`).catch(
            () => [] as BalanceRow[],
          ),
        ]);
        if (cancelled) return;
        setTripPins(locs);
        setTripExpensesList(exps);
        setTripBalanceSummary(bal);
        const geoQuery = locs[0]?.name ?? soonest.title ?? "India";
        const coords = await geocodeCity(geoQuery).catch(() => null);
        if (cancelled) return;
        if (coords) {
          const wx = await fetchOpenMeteo(coords.lat, coords.lon).catch(
            () => null,
          );
          if (cancelled) return;
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
      } finally {
        if (!cancelled) setSmartTripDetailsLoading(false);
      }
    }

    async function run() {
      setStatsLoading(true);
      setGroupsLoading(true);
      setTripsLoading(true);
      setPollsLoading(true);
      setExpensesLoading(true);
      setSmartTripDetailsLoading(true);

      const meRes = await apiFetchWithStatus<UserMe>("/auth/me");
      if (cancelled) return;
      if (meRes.status === 401) {
        clearToken();
        router.replace("/login");
        return;
      }
      if (!meRes.data) {
        setAuthReady(true);
        return;
      }
      setMe(meRes.data);
      setAuthReady(true);

      const [st, grpList] = await Promise.all([
        apiFetch<TravelStats>("/users/me/travel-stats").catch(() => null),
        apiFetch<GroupOut[]>("/groups").catch(() => []),
      ]);
      if (cancelled) return;
      setStats(
        st ?? {
          trips_created: 0,
          groups_joined: 0,
          locations_saved: 0,
          expenses_paid: 0,
          countries_from_trips: [],
        },
      );
      setStatsLoading(false);
      setGroups(grpList);
      setGroupsLoading(false);

      const tripLists = await Promise.all(
        grpList.map((g) =>
          apiFetch<TripOut[]>(`/groups/${g.id}/trips`).catch(() => []),
        ),
      );
      if (cancelled) return;

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
        const pollLists = await Promise.all(
          activeOrdered.map((trip) =>
            apiFetch<PollOut[]>(`/trips/${trip.id}/polls`).catch(
              () => [] as PollOut[],
            ),
          ),
        );
        if (cancelled) return;
        const pollsAccum: { poll: PollOut; tripId: string }[] = [];
        activeOrdered.forEach((trip, idx) => {
          for (const pol of pollLists[idx] ?? []) {
            if (!pollIsOpen(pol)) continue;
            pollsAccum.push({ poll: pol, tripId: trip.id });
          }
        });
        setPollItems(pollsAccum.slice(0, 2));
        setPollsLoading(false);
      })();

      void (async () => {
        const expTripIds = activeOrdered.slice(0, 8);
        const expResults = await Promise.all(
          expTripIds.map((trip) =>
            apiFetch<BalanceRow[]>(`/trips/${trip.id}/expenses/summary`).catch(
              () => [] as BalanceRow[],
            ),
          ),
        );
        if (cancelled) return;
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

    void run();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!authReady) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-8">
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-[#E9ECEF] border-t-[#E94560]"
          aria-hidden
        />
      </div>
    );
  }

  if (!me) return null;

  const fn = firstToken(me.full_name ?? me.email ?? "");
  const tripCount = stats?.trips_created ?? 0;
  const groupCount = stats?.groups_joined ?? groups.length;

  const showStatsSkeleton = statsLoading && !skeletonDeadline;
  const showSmartSkeleton =
    !skeletonDeadline &&
    (tripsLoading || (Boolean(smartTrip) && smartTripDetailsLoading));
  const showPollsSkeleton = pollsLoading && !skeletonDeadline;
  const showExpensesSkeleton = expensesLoading && !skeletonDeadline;
  const showCompanionsSkeleton = groupsLoading && !skeletonDeadline;
  const showUpcomingSkeleton = tripsLoading && !skeletonDeadline;

  const smartFirstPinName = tripPins[0]?.name ?? null;

  return (
    <div className="space-y-6" style={{ color: NAVY }}>
      {/* TOP BAR */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold leading-snug tracking-tight md:text-2xl">
            Hey <span style={{ color: CORAL }}>{fn}</span>! 👋 Ready for your
            next adventure?
          </h1>
          <p className="mt-1 text-sm" style={{ color: MUTED }}>
            Today is {subtextDayDate()} · {tripCount} trips · {groupCount}{" "}
            groups
          </p>
        </div>
        <Link
          href="/notifications"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border shadow-sm transition hover:opacity-90"
          style={{ borderColor: BORDER, backgroundColor: CARD, color: NAVY }}
          aria-label="Notifications"
        >
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
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </Link>
      </div>

      {/* ROW 1 — 6 STAT CARDS */}
      <section>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {showStatsSkeleton ? (
            <>
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
            </>
          ) : (
            <>
              {[
                {
                  icon: "✈️",
                  n: stats?.trips_created ?? 0,
                  label: "Trips created",
                },
                {
                  icon: "👥",
                  n: stats?.groups_joined ?? 0,
                  label: "Groups joined",
                },
                {
                  icon: "🌍",
                  n: stats?.countries_from_trips?.length ?? 0,
                  label: "Countries visited",
                },
                { icon: "📸", n: 0, label: "Posts" },
                { icon: "🎬", n: 0, label: "Memories" },
                {
                  icon: "📍",
                  n: stats?.locations_saved ?? 0,
                  label: "Pins saved",
                },
              ].map((c) => (
                <div
                  key={c.label}
                  className="flex flex-col items-center rounded-xl border px-2 py-4 text-center shadow-sm"
                  style={{ borderColor: BORDER, backgroundColor: CARD }}
                >
                  <span className="text-[18px] leading-none" aria-hidden>
                    {c.icon}
                  </span>
                  <p
                    className="mt-2 text-[22px] font-bold tabular-nums"
                    style={{ color: NAVY }}
                  >
                    {c.n}
                  </p>
                  <p
                    className="mt-1 text-[10px] font-medium uppercase tracking-wide"
                    style={{ color: MUTED }}
                  >
                    {c.label}
                  </p>
                </div>
              ))}
            </>
          )}
        </div>
      </section>

      {/* ROW 2 — QUICK ACTIONS */}
      <section>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {(
            [
              { icon: "✈️", label: "+ New Trip", href: "/trips" },
              { icon: "👥", label: "+ New Group", href: "/travel-hub" },
              { icon: "📸", label: "+ New Post", href: "/profile" },
              { icon: "🗺️", label: "Open Map", href: "/map" },
            ] as const
          ).map((a) => (
            <Link
              key={a.label}
              href={a.href}
              className="rounded-xl border border-[#ffd6de] bg-[#fff0f3] px-3 py-4 text-center text-[11px] font-bold text-[#E94560] transition-colors duration-150 hover:border-[#E94560] hover:bg-[#E94560] hover:text-white"
            >
              <span className="block text-[18px] leading-none" aria-hidden>
                {a.icon}
              </span>
              <span className="mt-2 block">{a.label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ROW 3 — Upcoming Trips | Active Polls */}
      <section className="grid gap-4 md:grid-cols-2">
        <div>
          {showUpcomingSkeleton ? (
            <CardSkeleton lines={4} />
          ) : (
            <div
              className="rounded-xl border p-4 shadow-sm"
              style={{ borderColor: BORDER, backgroundColor: CARD }}
            >
              <h2 className="text-sm font-semibold" style={{ color: NAVY }}>
                Upcoming trips
              </h2>
              {upcomingTripsDisplay.length === 0 ? (
                <p className="mt-4 text-sm" style={{ color: MUTED }}>
                  No upcoming trips scheduled.
                </p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {upcomingTripsDisplay.map((t) => {
                    const badge = tripBannerBadge(t);
                    return (
                      <li
                        key={t.id}
                        className="flex gap-2 border-b border-[#E9ECEF] pb-3 last:border-0 last:pb-0"
                      >
                        <span className="text-lg leading-none" aria-hidden>
                          {destinationEmoji(t.title)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p
                            className="truncate text-sm font-bold"
                            style={{ color: NAVY }}
                          >
                            {t.title}
                          </p>
                          <p className="text-[10px]" style={{ color: MUTED }}>
                            {formatDateRangeReadable(t.start_date, t.end_date)} ·{" "}
                            {t.member_count} members
                          </p>
                        </div>
                        <span
                          className="shrink-0 self-start rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                          style={{ backgroundColor: badge.bg }}
                        >
                          {badge.text}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
              <Link
                href="/trips"
                className="mt-4 inline-block text-sm font-semibold"
                style={{ color: CORAL }}
              >
                View all trips →
              </Link>
            </div>
          )}
        </div>

        <div>
          {showPollsSkeleton ? (
            <CardSkeleton lines={4} />
          ) : (
            <div
              className="rounded-xl border p-4 shadow-sm"
              style={{ borderColor: BORDER, backgroundColor: CARD }}
            >
              <h2 className="text-sm font-semibold" style={{ color: NAVY }}>
                Active polls
              </h2>
              {pollItems.length === 0 ? (
                <div className="mt-4">
                  <p className="text-2xl leading-none" aria-hidden>
                    🗳️
                  </p>
                  <p className="mt-3 text-sm" style={{ color: MUTED }}>
                    No active polls right now
                  </p>
                  <p className="mt-1 text-xs" style={{ color: MUTED }}>
                    Create a trip and start polling your group
                  </p>
                  <Link
                    href="/trips"
                    className="mt-4 inline-block text-sm font-semibold"
                    style={{ color: CORAL }}
                  >
                    View Trips →
                  </Link>
                </div>
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
                                      backgroundColor: lead ? CORAL : NAVY,
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
                              href={`/trips/${tripId}`}
                              className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                              style={{ backgroundColor: CORAL }}
                            >
                              Vote now
                            </Link>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              <Link
                href={pollItems[0] ? `/trips/${pollItems[0].tripId}` : "/trips"}
                className="mt-4 inline-block text-sm font-semibold"
                style={{ color: CORAL }}
              >
                View all polls →
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ROW 4 — Pending Expenses | Group Companions */}
      <section className="grid gap-4 md:grid-cols-2">
        <div>
          {showExpensesSkeleton ? (
            <CardSkeleton lines={4} />
          ) : (
            <div
              className="rounded-xl border p-4 shadow-sm"
              style={{ borderColor: BORDER, backgroundColor: CARD }}
            >
              <h2 className="text-sm font-semibold" style={{ color: NAVY }}>
                Pending expenses
              </h2>
              {myPendingExpenses.length === 0 ? (
                <div className="mt-4">
                  <p className="text-2xl leading-none" aria-hidden>
                    🎉
                  </p>
                  <p className="mt-3 text-sm font-bold" style={{ color: NAVY }}>
                    All settled up!
                  </p>
                  <p className="mt-1 text-sm" style={{ color: MUTED }}>
                    No pending expenses
                  </p>
                </div>
              ) : (
                <ul className="mt-3 space-y-3">
                  {myPendingExpenses.map(({ row, tripId, tripTitle }, idx) => {
                    const fromN =
                      userNameMap.get(row.from_user_id) ?? row.from_user_id;
                    const toN =
                      userNameMap.get(row.to_user_id) ?? row.to_user_id;
                    const youOwe =
                      row.from_user_id === me.id && row.amount > 0.01;
                    const other = youOwe ? toN : fromN;
                    const label = youOwe
                      ? `You owe ${other}`
                      : `${other} owes you`;
                    const color = youOwe ? CORAL : SUCCESS;
                    const initial = (other.trim()[0] ?? "?").toUpperCase();
                    return (
                      <li
                        key={`${tripId}-${idx}-${row.from_user_id}-${row.to_user_id}`}
                        className="flex gap-2"
                      >
                        <div
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                          style={{ backgroundColor: stringHue(other) }}
                        >
                          {initial}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold" style={{ color }}>
                            {label}
                          </p>
                          <p className="truncate text-[10px]" style={{ color: MUTED }}>
                            {tripTitle}
                          </p>
                          <p className="text-sm font-bold tabular-nums" style={{ color }}>
                            {formatRupee(row.amount)}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              {myPendingExpenses.length > 0 ? (
                <Link
                  href={`/trips/${myPendingExpenses[0].tripId}`}
                  className="mt-4 inline-block text-sm font-semibold"
                  style={{ color: CORAL }}
                >
                  Settle up →
                </Link>
              ) : null}
            </div>
          )}
        </div>

        <div>
          {showCompanionsSkeleton ? (
            <CardSkeleton lines={4} />
          ) : (
            <div
              className="rounded-xl border p-4 shadow-sm"
              style={{ borderColor: BORDER, backgroundColor: CARD }}
            >
              <h2 className="text-sm font-semibold" style={{ color: NAVY }}>
                Group companions
              </h2>
              {companions.length === 0 ? (
                <div className="mt-4">
                  <p className="text-2xl leading-none" aria-hidden>
                    👥
                  </p>
                  <p className="mt-3 text-sm" style={{ color: MUTED }}>
                    No companions yet
                  </p>
                  <p className="mt-1 text-xs" style={{ color: MUTED }}>
                    Create a group and invite friends
                  </p>
                  <Link
                    href="/travel-hub"
                    className="mt-4 inline-block text-sm font-semibold"
                    style={{ color: CORAL }}
                  >
                    Create Group →
                  </Link>
                </div>
              ) : (
                <ul className="mt-3 space-y-3">
                  {companions.map((c) => {
                    const online = isOnlineSeen(c.last_seen_at, 5);
                    return (
                      <li key={c.user_id} className="flex items-center gap-2">
                        <img
                          src={`https://api.dicebear.com/7.x/lorelei/svg?seed=${encodeURIComponent(c.user_id)}`}
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
              <Link
                href="/travel-hub"
                className="mt-4 inline-block text-sm font-semibold"
                style={{ color: CORAL }}
              >
                See all →
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ROW 5 — Smart Trip | Buddy Trips */}
      <section className="grid gap-4 md:grid-cols-2">
        <div>
          {showSmartSkeleton ? (
            <CardSkeleton lines={6} />
          ) : !smartTrip ? (
            <div
              className="rounded-xl border bg-white p-8 text-center shadow-sm"
              style={{ borderColor: BORDER }}
            >
              <p className="text-5xl leading-none" aria-hidden>
                ✈️
              </p>
              <p className="mt-4 text-[15px] font-bold" style={{ color: NAVY }}>
                No upcoming trips
              </p>
              <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed" style={{ color: MUTED }}>
                Create a trip to see weather, pins and travel updates here
              </p>
              <button
                type="button"
                onClick={() => router.push("/trips")}
                className="mt-6 inline-flex items-center justify-center rounded-xl px-6 py-2.5 text-sm font-semibold text-white"
                style={{ backgroundColor: CORAL }}
              >
                + Create Trip
              </button>
            </div>
          ) : (
            <div
              className="overflow-hidden rounded-xl border shadow-sm"
              style={{ borderColor: BORDER, backgroundColor: CARD }}
            >
              {/* A + B — navy banner + weather */}
              <div className="px-4 pb-4 pt-4 sm:px-5" style={{ backgroundColor: NAVY }}>
                <div className="relative flex flex-wrap items-start gap-3">
                  <span className="text-2xl leading-none" aria-hidden>
                    {destinationEmoji(smartTrip.title)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-bold leading-tight text-white">
                      {smartTrip.title}
                    </p>
                    <p className="mt-1 text-[11px] leading-snug text-[rgba(255,255,255,0.7)]">
                      {destinationLine(smartTrip, smartFirstPinName)} ·{" "}
                      {formatDateStripForBanner(
                        smartTrip.start_date,
                        smartTrip.end_date,
                      )}{" "}
                      · {smartTrip.member_count} members
                    </p>
                  </div>
                  {(() => {
                    const b = tripBannerBadge(smartTrip);
                    return (
                      <span
                        className="ml-auto inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold text-white sm:absolute sm:right-0 sm:top-0"
                        style={{ backgroundColor: b.bg }}
                      >
                        {b.text}
                      </span>
                    );
                  })()}
                </div>

                <div className="mt-4 border-t border-[rgba(255,255,255,0.15)] pt-4">
                  {weather ? (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-2xl leading-none" aria-hidden>
                          {weatherCodeToEmoji(weather.current.weathercode ?? 0)}
                        </span>
                        <span className="text-2xl font-bold tabular-nums text-white">
                          {weather.current.temperature_2m != null
                            ? `${Math.round(weather.current.temperature_2m)}°`
                            : "—"}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-[rgba(255,255,255,0.75)]">
                        Feels like{" "}
                        {weather.current.apparent_temperature != null
                          ? `${Math.round(weather.current.apparent_temperature)}°`
                          : "—"}{" "}
                        · Humidity{" "}
                        {weather.current.relative_humidity_2m != null
                          ? `${Math.round(weather.current.relative_humidity_2m)}%`
                          : "—"}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2 overflow-x-auto pb-1">
                        {weather.daily.time.slice(0, 5).map((day, i) => {
                          const code = weather.daily.weathercode[i] ?? 0;
                          const max = weather.daily.temperature_2m_max[i];
                          const d = parseYmd(day);
                          const label = d
                            ? d.toLocaleDateString("en-IN", { weekday: "short" })
                            : day;
                          return (
                            <div
                              key={day}
                              className="flex min-w-[3.25rem] flex-col items-center rounded-lg border border-[rgba(255,255,255,0.25)] px-1.5 py-1.5 text-center"
                            >
                              <span className="text-[9px] font-semibold uppercase text-[rgba(255,255,255,0.85)]">
                                {label}
                              </span>
                              <span className="text-base leading-tight">
                                {weatherCodeToEmoji(code)}
                              </span>
                              <span className="text-[10px] font-bold tabular-nums text-white">
                                {max != null ? `${Math.round(max)}°` : "—"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : smartTripDetailsLoading ? (
                    <p className="text-[11px] text-[rgba(255,255,255,0.75)]">
                      🌤️ Weather loading...
                    </p>
                  ) : (
                    <p className="text-[11px] text-[rgba(255,255,255,0.75)]">
                      🌤️ Weather loading...
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-5 p-4 sm:p-5">
                {/* C — Rain */}
                {rainDayLabel ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
                    <p className="font-medium">⚠️ Rain expected on {rainDayLabel}</p>
                    <p className="mt-1 text-xs text-amber-800">
                      Plan indoor activities for that day
                    </p>
                  </div>
                ) : null}

                {/* D — Pins */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide" style={{ color: MUTED }}>
                    Saved pins
                  </p>
                  {tripPins.length === 0 ? (
                    <p className="mt-2 text-sm" style={{ color: MUTED }}>
                      No pins saved yet. Add locations to your trip →
                    </p>
                  ) : (
                    <>
                      <ul className="mt-3 space-y-2">
                        {tripPins.slice(0, 4).map((loc) => (
                          <li
                            key={loc.id}
                            className="flex items-start justify-between gap-2 rounded-lg border px-3 py-2"
                            style={{ borderColor: BORDER }}
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-semibold" style={{ color: NAVY }}>
                                <span className="mr-1">{categoryEmoji(loc.category)}</span>
                                {loc.name}
                              </p>
                            </div>
                            {loc.category ? (
                              <span
                                className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize text-white"
                                style={{ backgroundColor: NAVY }}
                              >
                                {loc.category}
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                      <Link
                        href="/map"
                        className="mt-3 inline-block text-sm font-semibold"
                        style={{ color: CORAL }}
                      >
                        {tripPins.length > 4
                          ? `+ ${tripPins.length - 4} more · Open map →`
                          : "Open map →"}
                      </Link>
                    </>
                  )}
                </div>

                {/* E — Checklist */}
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-bold uppercase tracking-wide" style={{ color: MUTED }}>
                      Trip checklist
                    </p>
                    <span className="text-xs font-semibold" style={{ color: CORAL }}>
                      {checklistDone}/5 done
                    </span>
                  </div>
                  <ul className="mt-3 space-y-2.5">
                    {(
                      [
                        { done: checklist.hotel, label: "Hotel booked" },
                        { done: checklist.transport, label: "Transport booked" },
                        { done: checklist.membersOk, label: "Members ready" },
                        { done: checklist.settled, label: "Expenses settled" },
                        { done: checklist.offlineMap, label: "Offline map ready" },
                      ] as const
                    ).map((row) => (
                      <li key={row.label} className="flex items-center gap-2.5">
                        <span
                          className="inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border-2"
                          style={{
                            borderColor: row.done ? CORAL : BORDER,
                            backgroundColor: row.done ? CORAL : "transparent",
                          }}
                          aria-hidden
                        >
                          {row.done ? (
                            <span className="text-[11px] font-bold leading-none text-white">
                              ✓
                            </span>
                          ) : null}
                        </span>
                        <span
                          className={`text-sm ${row.done ? "text-[#6C757D] line-through" : ""}`}
                          style={{ color: row.done ? undefined : NAVY }}
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
                        backgroundColor: CORAL,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div>
          <div
            className="rounded-xl border p-4 shadow-sm"
            style={{ borderColor: BORDER, backgroundColor: CARD }}
          >
            <h2 className="text-sm font-semibold" style={{ color: NAVY }}>
              Buddy trips nearby
            </h2>
            <p className="mt-1 text-xs" style={{ color: MUTED }}>
              Discover travelers heading your way
            </p>
            <ul className="mt-4 space-y-3">
              <li className="rounded-lg border px-3 py-3" style={{ borderColor: BORDER }}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold" style={{ color: NAVY }}>
                      🏖️ Goa weekend
                    </p>
                    <p className="mt-1 text-[10px]" style={{ color: MUTED }}>
                      Apr 18–20 · 5 members · 2 spots left
                    </p>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                    style={{ backgroundColor: CORAL }}
                  >
                    Join →
                  </span>
                </div>
              </li>
              <li className="rounded-lg border px-3 py-3" style={{ borderColor: BORDER }}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold" style={{ color: NAVY }}>
                      🏔️ Manali trek
                    </p>
                    <p className="mt-1 text-[10px]" style={{ color: MUTED }}>
                      May 2–6 · 8 members · 4 spots left
                    </p>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                    style={{ backgroundColor: CORAL }}
                  >
                    Join →
                  </span>
                </div>
              </li>
            </ul>
            <Link
              href="/feed"
              className="mt-4 inline-block text-sm font-semibold"
              style={{ color: CORAL }}
            >
              Explore buddy trips →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
