"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { API_BASE, apiFetch } from "@/lib/api";
import { clearToken, getToken } from "@/lib/auth";

type UserMe = {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string | null;
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
  is_online?: boolean;
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

type BalanceRow = {
  from_user_id: string;
  to_user_id: string;
  amount: number;
};

type TripWithMeta = TripOut & { group_name: string; member_count: number };

const NAVY = "#0F3460";
const CORAL = "#E94560";
const CARD = "#FFFFFF";
const BORDER = "#E9ECEF";
const TEXT = "#2C3E50";
const MUTED = "#6C757D";
const SUCCESS = "#2ECC71";
const CORAL_TINT = "#fff0f3";
const CORAL_BORDER = "#ffd6de";

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

function daysBetween(from: Date, to: Date): number {
  return Math.max(
    0,
    Math.ceil((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)),
  );
}

function formatRupee(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: n % 1 === 0 ? 0 : 2,
  }).format(n);
}

function formatDateRangeShort(start: string | null, end: string | null): string {
  if (!start) return "Dates TBC";
  const sd = parseYmd(start);
  if (!sd) return "Dates TBC";
  const fmtShort = (d: Date, withYear: boolean) =>
    d.toLocaleDateString("en-IN", {
      month: "short",
      day: "numeric",
      ...(withYear ? { year: "numeric" } : {}),
    });
  if (!end) return fmtShort(sd, true);
  const ed = parseYmd(end);
  if (!ed) return fmtShort(sd, true);
  const sameMonthYear =
    sd.getMonth() === ed.getMonth() && sd.getFullYear() === ed.getFullYear();
  if (sameMonthYear) {
    return `${sd.toLocaleDateString("en-IN", { month: "short" })} ${sd.getDate()}–${ed.getDate()}, ${ed.getFullYear()}`;
  }
  return `${fmtShort(sd, false)}–${fmtShort(ed, true)}`;
}

function subtextToday(): string {
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
  if (/beach|goa|sea|sand|maldives|bali/.test(t)) return "🏖️";
  if (/mountain|manali|trek|hiking|himalaya|nepal/.test(t)) return "🏔️";
  if (/paris|tokyo|london|city|metro|urban/.test(t)) return "🌆";
  if (/international|flight|abroad|overseas/.test(t)) return "✈️";
  return "📍";
}

function tripStatusBadgeClasses(status: string): string {
  switch (status) {
    case "planning":
      return "bg-[#e8f0fe] text-[#0F3460]";
    case "confirmed":
      return "bg-[#e8f8f0] text-[#1a7a4a]";
    case "ongoing":
      return "bg-[#fff0f3] text-[#E94560]";
    case "completed":
      return "bg-gray-100 text-[#6C757D]";
    default:
      return "bg-gray-100 text-[#6C757D]";
  }
}

function pollIsOpen(p: PollOut): boolean {
  if (p.status !== "open") return false;
  if (p.closes_at) {
    const end = new Date(p.closes_at).getTime();
    if (Number.isFinite(end) && Date.now() > end) return false;
  }
  return true;
}

function daysLeftPoll(closesAt: string | null): number | null {
  if (!closesAt) return null;
  const end = new Date(closesAt).getTime();
  if (!Number.isFinite(end)) return null;
  const d = Math.ceil((end - Date.now()) / (24 * 60 * 60 * 1000));
  return d >= 0 ? d : 0;
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
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function stringHue(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h + s.charCodeAt(i) * 17) % 360;
  return `hsl(${h} 55% 42%)`;
}

async function fetchAuthMe(): Promise<{ ok: true; user: UserMe } | { ok: false }> {
  const token = getToken();
  if (!token) {
    clearToken();
    return { ok: false };
  }
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    clearToken();
    return { ok: false };
  }
  if (!res.ok) {
    try {
      const errBody: unknown = await res.json();
      const detail =
        typeof errBody === "object" &&
        errBody !== null &&
        "detail" in errBody &&
        typeof (errBody as { detail: unknown }).detail === "string"
          ? (errBody as { detail: string }).detail
          : res.statusText;
      throw new Error(detail || "Failed to load profile");
    } catch (e) {
      if (e instanceof Error) throw e;
      throw new Error(res.statusText);
    }
  }
  const user = (await res.json()) as UserMe;
  return { ok: true, user };
}

function StatCardSkeleton() {
  return (
    <div
      className="flex flex-col items-center rounded-xl border p-4"
      style={{ borderColor: BORDER, backgroundColor: CARD }}
    >
      <div className="h-5 w-5 animate-pulse rounded bg-gray-200" />
      <div className="mt-2 h-8 w-12 animate-pulse rounded bg-gray-200" />
      <div className="mt-2 h-3 w-20 animate-pulse rounded bg-gray-200" />
    </div>
  );
}

function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div
      className="rounded-xl border p-4"
      style={{ borderColor: BORDER, backgroundColor: CARD }}
    >
      <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
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
  const [meReady, setMeReady] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);

  const [stats, setStats] = useState<TravelStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const [groups, setGroups] = useState<GroupOut[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);

  const [trips, setTrips] = useState<TripWithMeta[]>([]);
  const [tripsLoading, setTripsLoading] = useState(true);

  const [pollItems, setPollItems] = useState<
    { poll: PollOut; tripId: string }[]
  >([]);
  const [pollsLoading, setPollsLoading] = useState(true);

  const [expenseLines, setExpenseLines] = useState<
    {
      row: BalanceRow;
      tripId: string;
      tripTitle: string;
    }[]
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

  const upcomingTripsDisplay = useMemo(() => {
    const today = startOfToday();
    const ongoing = trips.filter((t) => t.status === "ongoing");
    if (ongoing.length) return ongoing.slice(0, 3);
    const rest = trips.filter((t) => {
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
  }, [trips]);

  const tripCountLabel = stats?.trips_created ?? 0;
  const groupCountLabel = stats?.groups_joined ?? groups.length;

  const myPendingExpenses = useMemo(() => {
    if (!me) return [];
    return expenseLines.filter(({ row }) => {
      const youOwe = row.from_user_id === me.id && row.amount > 0.01;
      const owesYou = row.to_user_id === me.id && row.amount > 0.01;
      return youOwe || owesYou;
    });
  }, [expenseLines, me]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setMeReady(false);
      setStatsLoading(true);
      setGroupsLoading(true);
      setTripsLoading(true);
      setPollsLoading(true);
      setExpensesLoading(true);

      setBootError(null);
      try {
        let auth: { ok: true; user: UserMe } | { ok: false };
        try {
          auth = await fetchAuthMe();
        } catch (e) {
          if (cancelled) return;
          setBootError(
            e instanceof Error ? e.message : "Could not load your account.",
          );
          setMeReady(true);
          return;
        }
        if (!auth.ok) {
          router.replace("/login");
          return;
        }
        if (cancelled) return;
        setMe(auth.user);
        setMeReady(true);

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

        const slice2 = grpList.slice(0, 2);
        const tripLists = await Promise.all(
          slice2.map((g) =>
            apiFetch<TripOut[]>(`/groups/${g.id}/trips`).catch(() => []),
          ),
        );
        if (cancelled) return;

        const merged: TripWithMeta[] = [];
        slice2.forEach((g, i) => {
          const mc = g.members?.length ?? 0;
          for (const t of tripLists[i] ?? []) {
            merged.push({
              ...t,
              group_name: g.name,
              member_count: mc,
            });
          }
        });
        setTrips(merged);
        setTripsLoading(false);

        const activeOrdered = merged
          .filter((t) => t.status !== "completed" && t.status !== "cancelled")
          .sort((a, b) => {
            const da = parseYmd(a.start_date)?.getTime() ?? Infinity;
            const db = parseYmd(b.start_date)?.getTime() ?? Infinity;
            return da - db;
          });

        const pollsAccum: { poll: PollOut; tripId: string }[] = [];
        for (const trip of activeOrdered) {
          if (pollsAccum.length >= 2) break;
          const list = await apiFetch<PollOut[]>(
            `/trips/${trip.id}/polls`,
          ).catch(() => [] as PollOut[]);
          for (const pol of list) {
            if (!pollIsOpen(pol)) continue;
            pollsAccum.push({ poll: pol, tripId: trip.id });
            if (pollsAccum.length >= 2) break;
          }
        }
        if (cancelled) return;
        setPollItems(pollsAccum);
        setPollsLoading(false);

        const expTripPick = activeOrdered.slice(0, 3);
        const expResults = await Promise.all(
          expTripPick.map((trip) =>
            apiFetch<BalanceRow[]>(`/trips/${trip.id}/expenses/summary`)
              .then((rows) =>
                rows.map((row) => ({
                  row,
                  tripId: trip.id,
                  tripTitle: trip.title,
                })),
              )
              .catch(() => []),
          ),
        );
        if (cancelled) return;
        setExpenseLines(expResults.flat());
        setExpensesLoading(false);
      } catch (e) {
        if (!cancelled) {
          setStatsLoading(false);
          setGroupsLoading(false);
          setTripsLoading(false);
          setPollsLoading(false);
          setExpensesLoading(false);
          setBootError(
            e instanceof Error
              ? e.message
              : "Something went wrong loading data.",
          );
          setMeReady(true);
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!meReady && !me) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-8">
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-[#E9ECEF] border-t-[#E94560]"
          aria-hidden
        />
      </div>
    );
  }

  if (bootError && !me) {
    return (
      <div className="p-6">
        <p className="rounded-xl border border-[#E9ECEF] bg-white px-4 py-3 text-sm text-[#2C3E50] shadow-sm">
          {bootError}
        </p>
      </div>
    );
  }

  if (!me) return null;

  const fn = firstToken(me.full_name ?? me.email ?? "");

  return (
    <div className="space-y-6 p-4 md:p-6" style={{ color: TEXT }}>
      {bootError ? (
        <p className="rounded-xl border border-[#fecaca] bg-[#fff1f2] px-4 py-2 text-sm text-[#991b1b]">
          {bootError}
        </p>
      ) : null}
      {/* TOP BAR */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1
            className="text-xl font-bold leading-snug tracking-tight md:text-2xl"
            style={{ color: NAVY }}
          >
            Hey <span style={{ color: CORAL }}>{fn}</span>! 👋 Ready for your
            next adventure?
          </h1>
          <p className="mt-1 text-sm" style={{ color: MUTED }}>
            Today is {subtextToday()} · {tripCountLabel} trips planned ·{" "}
            {groupCountLabel} active groups
          </p>
        </div>
        <button
          type="button"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border shadow-sm transition hover:opacity-90"
          style={{
            borderColor: BORDER,
            backgroundColor: CARD,
            color: NAVY,
          }}
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
        </button>
      </div>

      {/* ROW 1 — STATS */}
      <section>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {statsLoading ? (
            <>
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
                  label: "Countries",
                },
                {
                  icon: "📍",
                  n: stats?.locations_saved ?? 0,
                  label: "Pins saved",
                },
              ].map((c) => (
                <div
                  key={c.label}
                  className="flex flex-col items-center rounded-xl border px-3 py-4 text-center shadow-sm"
                  style={{ borderColor: BORDER, backgroundColor: CARD }}
                >
                  <span className="text-[20px] leading-none" aria-hidden>
                    {c.icon}
                  </span>
                  <p
                    className="mt-2 text-[26px] font-bold tabular-nums"
                    style={{ color: NAVY }}
                  >
                    {c.n}
                  </p>
                  <p
                    className="mt-1 text-[11px] font-medium uppercase tracking-wide"
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
              {
                icon: "✈️",
                label: "+ New Trip",
                href: "/trips",
              },
              {
                icon: "👥",
                label: "+ New Group",
                href: "/groups",
              },
              {
                icon: "🗺️",
                label: "Open Map",
                href: "/map",
              },
              {
                icon: "🌤️",
                label: "Weather",
                href: "/weather",
              },
            ] as const
          ).map((a) => (
            <button
              key={a.label}
              type="button"
              className="cursor-pointer rounded-xl border px-3 py-4 text-center text-[11px] font-bold transition-colors border-[#ffd6de] bg-[#fff0f3] text-[#E94560] hover:border-[#E94560] hover:bg-[#E94560] hover:text-white"
              onClick={() => router.push(a.href)}
            >
              <span className="block text-[18px] leading-none" aria-hidden>
                {a.icon}
              </span>
              <span className="mt-2 block">{a.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ROW 3 */}
      <section className="grid gap-4 md:grid-cols-2">
        <div>
          {tripsLoading ? (
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
                  No trips yet!{" "}
                  <Link href="/trips" className="font-semibold underline" style={{ color: CORAL }}>
                    Create your first trip →
                  </Link>
                </p>
              ) : (
                <ul className="mt-3 space-y-4">
                  {upcomingTripsDisplay.map((t) => {
                    const sd = parseYmd(t.start_date);
                    const progressPct = (() => {
                      if (t.status === "ongoing") return 100;
                      if (!sd) return 0;
                      const d = daysBetween(startOfToday(), sd);
                      return Math.min(100, Math.round((d / 30) * 100));
                    })();
                    return (
                      <li
                        key={t.id}
                        className="border-b border-[#E9ECEF] pb-4 last:border-0 last:pb-0"
                      >
                        <div className="flex gap-2">
                          <span className="text-lg" aria-hidden>
                            {destinationEmoji(t.title)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p
                              className="truncate text-sm font-bold"
                              style={{ color: NAVY }}
                            >
                              {t.title}
                            </p>
                            <p className="text-xs" style={{ color: MUTED }}>
                              {formatDateRangeShort(t.start_date, t.end_date)}{" "}
                              · {t.member_count} members
                            </p>
                            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${progressPct}%`,
                                  backgroundColor: CORAL,
                                }}
                              />
                            </div>
                            <span
                              className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${tripStatusBadgeClasses(t.status)}`}
                            >
                              {t.status.replace(/_/g, " ")}
                            </span>
                          </div>
                        </div>
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
          {pollsLoading ? (
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
                <p className="mt-4 text-sm" style={{ color: MUTED }}>
                  No active polls right now
                </p>
              ) : (
                <ul className="mt-3 space-y-5">
                  {pollItems.map(({ poll: p, tripId }) => {
                    const totals = p.options.reduce(
                      (s, o) => s + o.vote_count,
                      0,
                    );
                    const maxV = Math.max(0, ...p.options.map((o) => o.vote_count));
                    const dLeft = daysLeftPoll(p.closes_at);
                    return (
                      <li key={p.id}>
                        <p
                          className="text-xs font-bold leading-snug"
                          style={{ color: NAVY }}
                        >
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
                                <div className="flex justify-between text-[10px] text-[#6C757D]">
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
                          {dLeft !== null ? (
                            <span
                              className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                              style={{
                                backgroundColor: "#e8f8f0",
                                color: "#1a7a4a",
                              }}
                            >
                              Open · {dLeft} day{dLeft === 1 ? "" : "s"} left
                            </span>
                          ) : (
                            <span
                              className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                              style={{
                                backgroundColor: "#e8f8f0",
                                color: "#1a7a4a",
                              }}
                            >
                              Open
                            </span>
                          )}
                          <button
                            type="button"
                            className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                            style={{
                              backgroundColor: CORAL_TINT,
                              color: CORAL,
                            }}
                            onClick={() => router.push(`/trips/${tripId}`)}
                          >
                            Vote now
                          </button>
                        </div>
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
                View all polls →
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ROW 4 */}
      <section className="grid gap-4 md:grid-cols-2">
        <div>
          {expensesLoading ? (
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
                <p className="mt-4 text-sm font-medium" style={{ color: MUTED }}>
                  All settled up! 🎉
                </p>
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
                      <li key={`${tripId}-${idx}-${row.from_user_id}-${row.to_user_id}`} className="flex gap-2">
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
                            {tripTitle} · Split
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
          {groupsLoading ? (
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
                <p className="mt-4 text-sm" style={{ color: MUTED }}>
                  Join a group to see companions here.
                </p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {companions.map((c) => {
                    const online = isOnlineSeen(c.last_seen_at, 5);
                    return (
                      <li key={c.user_id} className="flex items-center gap-2">
                        <img
                          src={`https://api.dicebear.com/7.x/lorelei/svg?seed=${encodeURIComponent(c.user_id)}`}
                          alt=""
                          width={30}
                          height={30}
                          className="h-[30px] w-[30px] shrink-0 rounded-full ring-1 ring-[#E9ECEF]"
                        />
                        <div className="min-w-0 flex-1">
                          <p
                            className="truncate text-sm font-semibold"
                            style={{ color: NAVY }}
                          >
                            {c.full_name}
                          </p>
                          <div className="flex items-center gap-1.5">
                            <span
                              className="inline-block h-2 w-2 rounded-full shrink-0"
                              style={{
                                backgroundColor: online ? SUCCESS : "#CED4DA",
                              }}
                            />
                            {online ? (
                              <span
                                className="text-[10px] font-semibold"
                                style={{ color: SUCCESS }}
                              >
                                Online
                              </span>
                            ) : (
                              <span className="text-[10px] text-[#6C757D]">
                                {agoLabel(c.last_seen_at)}
                              </span>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              <Link
                href="/groups"
                className="mt-4 inline-block text-sm font-semibold"
                style={{ color: CORAL }}
              >
                See all →
              </Link>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
