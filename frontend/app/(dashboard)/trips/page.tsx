"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";

type TripOut = {
  id: string;
  group_id: string;
  title: string;
  description: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

type GroupListItem = { id: string };

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

function formatDate(d: string | null): string {
  if (!d) return "—";
  return d;
}

export default function TripsPage() {
  const [trips, setTrips] = useState<TripOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const groups = await apiFetch<GroupListItem[]>("/groups");
        const lists = await Promise.all(
          groups.map((g) =>
            apiFetch<TripOut[]>(`/groups/${g.id}/trips`).catch(() => [] as TripOut[]),
          ),
        );
        const merged = lists.flat();
        merged.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
        if (!cancelled) setTrips(merged);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Failed to load trips");
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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Trips</h1>
          <p className="text-sm text-gray-600">Your trips across all groups</p>
        </div>
      </div>

      {loading ? (
        <div className="mt-10 flex flex-col items-center gap-3 py-16">
          <div
            className="h-10 w-10 animate-spin rounded-full border-2 border-gray-200 border-t-gray-900"
            aria-hidden
          />
          <p className="text-sm text-gray-600">Loading trips…</p>
        </div>
      ) : error ? (
        <p className="mt-10 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : trips.length === 0 ? (
        <div className="mt-16 flex flex-col items-center justify-center text-center">
          <p className="text-lg font-medium text-gray-900">No trips yet</p>
          <p className="mt-2 max-w-sm text-sm text-gray-600">
            Create your first trip to get started — pick a group, then add a
            trip from there.
          </p>
          <Link
            href="/groups"
            className="mt-6 rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
          >
            Create Trip
          </Link>
        </div>
      ) : (
        <ul className="mt-8 divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white">
          {trips.map((t) => (
            <li
              key={t.id}
              className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium text-gray-900">{t.title}</p>
                <p className="mt-1 text-sm text-gray-600">
                  {formatDate(t.start_date)} → {formatDate(t.end_date)}
                </p>
              </div>
              <span
                className={`inline-flex w-fit shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusBadgeClass(t.status)}`}
              >
                {t.status.replace("_", " ")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
