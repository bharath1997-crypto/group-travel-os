"use client";

import { useEffect, useState } from "react";

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

export default function StatsPage() {
  const [stats, setStats] = useState<TravelStats | null>(null);
  const [plan, setPlan] = useState<PlanOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [s, p] = await Promise.all([
          apiFetch<TravelStats>("/users/me/travel-stats"),
          apiFetch<PlanOut>("/subscriptions/me"),
        ]);
        if (!cancelled) {
          setStats(s);
          setPlan(p);
        }
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Failed to load stats");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-2xl font-semibold text-[#0F3460]">My Stats</h1>
      <p className="mt-1 text-sm text-[#6C757D]">Your activity overview</p>

      {loading ? (
        <div className="mt-10 flex flex-col items-center gap-3 py-16">
          <div
            className="h-10 w-10 animate-spin rounded-full border-2 border-[#E9ECEF] border-t-[#E94560]"
            aria-hidden
          />
          <p className="text-sm text-gray-600">Loading…</p>
        </div>
      ) : error ? (
        <p className="mt-10 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : (
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
      )}
    </div>
  );
}
