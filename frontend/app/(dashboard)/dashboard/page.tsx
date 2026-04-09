"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Avatar } from "@/components/Avatar";
import { apiFetch } from "@/lib/api";

type UserMe = { id: string; full_name: string; email: string };

type PlanOut = {
  plan: string;
  status: string;
  current_period_end: string | null;
};

type TravelStats = {
  trips_created: number;
  groups_joined: number;
  locations_saved: number;
  expenses_paid: number;
};

type GroupMemberOut = {
  id: string;
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  role: string;
  joined_at: string;
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

type DestinationOut = {
  id: string;
  name: string;
  country: string;
  category: string;
  trending_score: number;
  avg_cost_per_day: number | null;
};

type TrendingApi = {
  items: DestinationOut[];
};

type Companion = {
  user_id: string;
  full_name: string;
  /** Not provided by group member API — reserved for future. */
  email: string;
};

function firstName(full: string): string {
  const p = full.trim().split(/\s+/)[0];
  return p || "there";
}

function planBadgeClass(plan: string): string {
  switch (plan) {
    case "free":
      return "bg-gray-200 text-gray-800";
    case "pass_3day":
      return "bg-blue-100 text-blue-900";
    case "pro":
      return "bg-purple-100 text-purple-900";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

function streakCopy(n: number): string {
  if (n <= 0) return "Start your journey!";
  if (n <= 2) return "Getting started! 🌱";
  if (n <= 5) return "On a roll! 🔥";
  return "Travel legend! 🏆";
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "planning":
      return "bg-blue-100 text-blue-800";
    case "confirmed":
      return "bg-green-100 text-green-800";
    case "ongoing":
      return "bg-yellow-100 text-yellow-900";
    case "completed":
      return "bg-gray-200 text-gray-800";
    case "cancelled":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-700";
  }
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
  return Math.ceil((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}

function CompanionChip({
  fullName,
  onClick,
}: {
  fullName: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full ring-2 ring-gray-200 transition hover:ring-violet-400"
      title={fullName}
    >
      <Avatar name={fullName} size={40} />
    </button>
  );
}

export default function DashboardPage() {
  const [me, setMe] = useState<UserMe | null>(null);
  const [plan, setPlan] = useState<PlanOut | null>(null);
  const [stats, setStats] = useState<TravelStats | null>(null);
  const [groups, setGroups] = useState<GroupOut[]>([]);
  const [allTrips, setAllTrips] = useState<
    (TripOut & { group_name: string })[]
  >([]);
  const [trending, setTrending] = useState<DestinationOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalCompanion, setModalCompanion] = useState<Companion | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [user, pl, st, tr, grpList] = await Promise.all([
          apiFetch<UserMe>("/auth/me"),
          apiFetch<PlanOut>("/subscriptions/me"),
          apiFetch<TravelStats>("/users/me/travel-stats"),
          apiFetch<TrendingApi>("/feed/trending?page=1&page_size=10"),
          apiFetch<GroupOut[]>("/groups"),
        ]);
        if (cancelled) return;
        setMe(user);
        setPlan(pl);
        setStats({
          trips_created: st.trips_created,
          groups_joined: st.groups_joined,
          locations_saved: st.locations_saved,
          expenses_paid: st.expenses_paid,
        });
        setTrending(tr.items.slice(0, 10));
        setGroups(grpList);

        const tripLists = await Promise.all(
          grpList.map((g) =>
            apiFetch<TripOut[]>(`/groups/${g.id}/trips`).catch(() => []),
          ),
        );
        if (cancelled) return;
        const merged: (TripOut & { group_name: string })[] = [];
        grpList.forEach((g, i) => {
          for (const t of tripLists[i] ?? []) {
            merged.push({ ...t, group_name: g.name });
          }
        });
        setAllTrips(merged);
      } catch (e) {
        if (!cancelled)
          setError(
            e instanceof Error ? e.message : "Failed to load dashboard",
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const companions = useMemo((): Companion[] => {
    if (!me) return [];
    const byId = new Map<string, Companion>();
    for (const g of groups) {
      for (const m of g.members ?? []) {
        if (m.user_id === me.id) continue;
        if (!byId.has(m.user_id)) {
          byId.set(m.user_id, {
            user_id: m.user_id,
            full_name: m.full_name,
            email: "",
          });
        }
      }
    }
    return Array.from(byId.values()).slice(0, 6);
  }, [groups, me]);

  const upcoming = useMemo(() => {
    const today = startOfToday();
    const ongoing = allTrips.filter((t) => t.status === "ongoing");
    if (ongoing.length > 0) {
      const pick = ongoing.sort(
        (a, b) =>
          (parseYmd(a.start_date)?.getTime() ?? 0) -
          (parseYmd(b.start_date)?.getTime() ?? 0),
      )[0];
      return { trip: pick, mode: "ongoing" as const };
    }
    let best: (TripOut & { group_name: string }) | null = null;
    let bestDate: Date | null = null;
    for (const t of allTrips) {
      if (t.status === "cancelled" || t.status === "completed") continue;
      const sd = parseYmd(t.start_date);
      if (!sd) continue;
      if (sd < today) continue;
      if (!bestDate || sd < bestDate) {
        bestDate = sd;
        best = t;
      }
    }
    if (best && bestDate) return { trip: best, mode: "upcoming" as const };
    return null;
  }, [allTrips]);

  const streakN = stats?.trips_created ?? 0;
  const planLabel = plan?.plan ?? "free";

  if (loading) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 p-8">
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-gray-200 border-t-gray-900"
          aria-hidden
        />
        <p className="text-sm text-gray-600">Loading your dashboard…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 md:p-8">
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      </div>
    );
  }

  const dupTrending = [...trending, ...trending];

  return (
    <div className="p-6 md:p-8">
      <style
        dangerouslySetInnerHTML={{
          __html: `
@keyframes dash-marquee {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
.dash-marquee-track {
  display: flex;
  width: max-content;
  gap: 1rem;
  animation: dash-marquee 42s linear infinite;
}
.dash-marquee-wrap:hover .dash-marquee-track {
  animation-play-state: paused;
}
`,
        }}
      />

      {/* Hero */}
      <section className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 via-white to-amber-50/40 px-6 py-8 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Avatar
              name={
                me?.full_name?.trim() ||
                me?.email?.trim() ||
                "Traveler"
              }
              size={56}
              className="ring-2 ring-violet-200/80 ring-offset-2 ring-offset-white"
            />
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-gray-900 md:text-3xl">
                Hey {firstName(me?.full_name ?? "")}! 👋 Ready for your next
                adventure?
              </h1>
              {plan ? (
                <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-gray-600">
                  Your plan
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${planBadgeClass(planLabel)}`}
                  >
                    {planLabel.replace(/_/g, " ")}
                  </span>
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* Streak + companions */}
      <section className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-orange-100 bg-orange-50/60 p-5 shadow-sm">
          <p className="text-4xl" aria-hidden>
            🔥
          </p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-gray-900">
            {streakN}
          </p>
          <p className="mt-1 text-sm font-medium text-orange-900/80">
            trip streak
          </p>
          <p className="mt-3 text-sm text-gray-700">{streakCopy(streakN)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">Companions</h2>
          <p className="mt-1 text-xs text-gray-500">
            People you travel with across your groups
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {companions.length === 0 ? (
              <p className="text-sm text-gray-500">No companions yet.</p>
            ) : (
              companions.map((c) => (
                <CompanionChip
                  key={c.user_id}
                  fullName={c.full_name}
                  onClick={() => setModalCompanion(c)}
                />
              ))
            )}
          </div>
        </div>
      </section>

      {/* Quick actions */}
      <section className="mt-8">
        <h2 className="text-sm font-semibold text-gray-900">Quick actions</h2>
        <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
          <Link
            href="/groups"
            className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-center text-sm font-medium text-gray-900 shadow-sm transition hover:border-violet-200 hover:bg-violet-50"
          >
            + New Trip →
          </Link>
          <Link
            href="/groups"
            className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-center text-sm font-medium text-gray-900 shadow-sm transition hover:border-violet-200 hover:bg-violet-50"
          >
            + New Group →
          </Link>
          <Link
            href="/weather"
            className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-center text-sm font-medium text-gray-900 shadow-sm transition hover:border-sky-200 hover:bg-sky-50"
          >
            🌤 Weather →
          </Link>
          <Link
            href="/feed"
            className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-center text-sm font-medium text-gray-900 shadow-sm transition hover:border-amber-200 hover:bg-amber-50"
          >
            🔍 Explore Feed →
          </Link>
        </div>
      </section>

      {/* Upcoming trip */}
      <section className="mt-8">
        <h2 className="text-sm font-semibold text-gray-900">Upcoming trip</h2>
        <div className="mt-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          {!upcoming ? (
            <p className="text-sm text-gray-600">
              No trips planned yet — create one!
            </p>
          ) : (
            <>
              <p className="text-lg font-semibold text-gray-900">
                {upcoming.trip.title}
              </p>
              <p className="mt-1 text-sm text-gray-600">
                {upcoming.trip.group_name}
              </p>
              <p className="mt-2 text-sm text-gray-700">
                {upcoming.trip.start_date ?? "—"} →{" "}
                {upcoming.trip.end_date ?? "—"}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusBadgeClass(upcoming.trip.status)}`}
                >
                  {upcoming.trip.status.replace("_", " ")}
                </span>
                {upcoming.mode === "ongoing" ? (
                  <span className="text-sm font-medium text-amber-800">
                    Ongoing!
                  </span>
                ) : (
                  (() => {
                    const sd = parseYmd(upcoming.trip.start_date);
                    if (!sd) return null;
                    const d = daysBetween(startOfToday(), sd);
                    return (
                      <span className="text-sm text-gray-600">
                        {d} day{d === 1 ? "" : "s"} away
                      </span>
                    );
                  })()
                )}
              </div>
            </>
          )}
        </div>
      </section>

      {/* Trending */}
      <section className="mt-8">
        <h2 className="text-sm font-semibold text-gray-900">Trending now</h2>
        <div className="dash-marquee-wrap mt-3 overflow-hidden rounded-xl border border-gray-200 bg-gray-50 py-3">
          {dupTrending.length === 0 ? (
            <p className="px-4 text-sm text-gray-500">No trending data.</p>
          ) : (
            <div className="dash-marquee-track">
              {dupTrending.map((d, i) => (
                <div
                  key={`${d.id}-${i}`}
                  className="w-[200px] shrink-0 rounded-lg border border-gray-200 bg-white p-3 shadow-sm"
                >
                  <p className="font-medium text-gray-900">{d.name}</p>
                  <p className="text-xs text-gray-500">{d.country}</p>
                  <span className="mt-2 inline-block rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-900">
                    {d.category}
                  </span>
                  <p className="mt-2 text-xs text-gray-600">
                    Score {d.trending_score.toFixed(1)}
                  </p>
                  {d.avg_cost_per_day != null ? (
                    <p className="text-xs text-gray-500">
                      Avg ${d.avg_cost_per_day.toFixed(0)}/day
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Stats row */}
      <section className="mt-10 border-t border-gray-100 pt-6">
        <p className="text-center text-sm text-gray-500">
          {stats?.trips_created ?? 0} trips · {stats?.groups_joined ?? 0} groups
          · {stats?.locations_saved ?? 0} locations ·{" "}
          {stats?.expenses_paid ?? 0} expenses
        </p>
      </section>

      {modalCompanion ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="companion-modal-title"
        >
          <div className="max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
            <div className="flex flex-col items-center">
              <Avatar
                name={modalCompanion.full_name}
                size={48}
                className="ring-2 ring-violet-200"
              />
              <h3
                id="companion-modal-title"
                className="mt-4 text-lg font-semibold text-gray-900"
              >
                {modalCompanion.full_name}
              </h3>
              <p className="mt-1 text-sm text-gray-600">
                <span className="text-gray-500">Email: </span>
                {modalCompanion.email ? (
                  <span className="break-all">{modalCompanion.email}</span>
                ) : (
                  <span className="italic text-gray-400">not available</span>
                )}
              </p>
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <a
                href={
                  modalCompanion.email
                    ? `tel:${encodeURIComponent(modalCompanion.email)}`
                    : "#"
                }
                onClick={
                  modalCompanion.email
                    ? undefined
                    : (e) => e.preventDefault()
                }
                className={`rounded-lg py-2 text-center text-sm font-medium ${
                  modalCompanion.email
                    ? "bg-gray-900 text-white hover:bg-gray-800"
                    : "cursor-not-allowed bg-gray-100 text-gray-400"
                }`}
              >
                Call
              </a>
              <a
                href={
                  modalCompanion.email
                    ? `mailto:${encodeURIComponent(modalCompanion.email)}`
                    : `mailto:?subject=${encodeURIComponent(`Hello ${modalCompanion.full_name}`)}&body=${encodeURIComponent("Sent from Group Travel OS.")}`
                }
                className="rounded-lg border border-gray-300 py-2 text-center text-sm font-medium text-gray-800 hover:bg-gray-50"
              >
                Send Email
              </a>
              <p className="text-center text-xs text-gray-400">
                Chat coming soon
              </p>
              <button
                type="button"
                onClick={() => setModalCompanion(null)}
                className="mt-2 rounded-lg bg-gray-900 py-2 text-sm font-medium text-white hover:bg-gray-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
