"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { apiFetch } from "@/lib/api";

type TravelStats = {
  trips_created: number;
  groups_joined: number;
  locations_saved: number;
  expenses_paid: number;
  polls_created: number;
  countries_from_trips: string[];
};

type PlanOut = {
  plan: string;
  status: string;
  current_period_end: string | null;
};

const statCards: { key: keyof TravelStats; label: string }[] = [
  { key: "trips_created", label: "Trips Created" },
  { key: "groups_joined", label: "Groups Joined" },
  { key: "locations_saved", label: "Locations Saved" },
  { key: "expenses_paid", label: "Expenses Paid" },
  { key: "polls_created", label: "Polls Created" },
];

function planBadgeClass(plan: string): string {
  switch (plan) {
    case "free":
      return "bg-gray-200 text-gray-800";
    case "pass_3day":
      return "bg-blue-100 text-blue-900";
    case "pass_7day":
      return "bg-indigo-100 text-indigo-900";
    case "pro":
      return "bg-purple-100 text-purple-900";
    case "enterprise":
      return "bg-amber-100 text-amber-900 ring-1 ring-amber-300";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

const Skeleton = ({
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

async function fetchWithDeadline<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  pageSignal: AbortSignal,
): Promise<T> {
  const t = new AbortController();
  const timer = setTimeout(() => t.abort(), 8000);
  const onPageAbort = () => t.abort();
  pageSignal.addEventListener("abort", onPageAbort);
  try {
    if (pageSignal.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    return await fn(t.signal);
  } finally {
    clearTimeout(timer);
    pageSignal.removeEventListener("abort", onPageAbort);
  }
}

export default function StatsPage() {
  const inFlightRef = useRef<AbortController | null>(null);
  const [stats, setStats] = useState<TravelStats | null>(null);
  const [plan, setPlan] = useState<PlanOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    inFlightRef.current?.abort();
    const ac = new AbortController();
    inFlightRef.current = ac;
    const pageSignal = ac.signal;
    setLoading(true);
    setError(null);
    try {
      const [s, p] = await Promise.all([
        fetchWithDeadline(
          (sig) => apiFetch<TravelStats>("/users/me/travel-stats", { signal: sig }),
          pageSignal,
        ),
        fetchWithDeadline(
          (sig) => apiFetch<PlanOut>("/subscriptions/me", { signal: sig }),
          pageSignal,
        ),
      ]);
      if (pageSignal.aborted) return;
      setStats(s);
      setPlan(p);
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      setError(
        e instanceof Error ? e.message : "Could not load data. Tap to retry.",
      );
    } finally {
      if (!pageSignal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    return () => inFlightRef.current?.abort();
  }, [load]);

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-2xl font-semibold text-[#0F3460]">My Stats</h1>
      <p className="mt-1 text-sm text-[#6C757D]">Your activity overview</p>

      {error && !loading ? (
        <div className="mt-8 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p>Could not load data. Tap to retry.</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-2 font-semibold text-[#0F3460] underline"
          >
            Retry
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="mt-8 space-y-8">
          <div className="h-5 w-48">
            <Skeleton height={20} width="12rem" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-[#E9ECEF] bg-white px-5 py-6 shadow-sm"
              >
                <Skeleton height={36} width="4rem" />
                <div className="mt-3">
                  <Skeleton height={14} width="70%" />
                </div>
              </div>
            ))}
          </div>
          <div>
            <Skeleton height={16} width="12rem" />
            <div className="mt-3 flex flex-wrap gap-2">
              <Skeleton height={28} width={80} />
              <Skeleton height={28} width={80} />
              <Skeleton height={28} width={80} />
            </div>
          </div>
        </div>
      ) : !error ? (
        <>
          {plan ? (
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-gray-600">
                Current plan
              </span>
              <span
                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ${planBadgeClass(plan.plan)}`}
              >
                {plan.plan.replace(/_/g, " ")}
              </span>
              <span className="text-xs text-gray-500">({plan.status})</span>
            </div>
          ) : null}

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {statCards.map(({ key, label }) => (
              <div
                key={key}
                className="rounded-xl border border-[#E9ECEF] bg-white px-5 py-6 shadow-sm"
              >
                <p className="text-3xl font-semibold tabular-nums text-[#0F3460]">
                  {stats?.[key] ?? 0}
                </p>
                <p className="mt-2 text-sm font-medium text-gray-600">
                  {label}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-10">
            <h2 className="text-sm font-medium text-gray-700">
              Countries from trips
            </h2>
            {stats?.countries_from_trips &&
            stats.countries_from_trips.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {stats.countries_from_trips.map((c) => (
                  <span
                    key={c}
                    className="rounded-full bg-white px-3 py-1 text-sm font-medium text-gray-800 ring-1 ring-gray-200"
                  >
                    {c}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-gray-600">
                No countries yet — start planning!
              </p>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
