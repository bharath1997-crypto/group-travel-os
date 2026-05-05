"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plane } from "lucide-react";

import { TripCard, type TripCardTrip } from "@/components/trips";
import { apiFetchWithStatus } from "@/lib/api";

const CORAL = "#E94560";
const BORDER = "#E9ECEF";
const BG = "#F8F9FA";

const Skeleton = ({
  width = "100%",
  height = 16,
  className = "",
}: {
  width?: string | number;
  height?: number;
  className?: string;
}) => (
  <div
    className={className}
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

type GroupMemberOut = {
  id: string;
  user_id: string;
  full_name: string;
  username?: string | null;
};

type GroupOut = {
  id: string;
  name: string;
  members: GroupMemberOut[];
};

type MergedTrip = TripOut & {
  groupName: string;
  members: GroupMemberOut[];
};

type FilterTab = "all" | "upcoming" | "active" | "completed";

function todayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isTripCompleted(t: TripOut, today: string): boolean {
  if (t.status === "completed") return true;
  if (t.end_date && t.end_date < today) return true;
  return false;
}

function isTripUpcoming(t: TripOut, today: string): boolean {
  if (!t.start_date) return false;
  return t.start_date > today;
}

function isTripActive(t: TripOut, today: string): boolean {
  if (isTripCompleted(t, today)) return false;
  if (!t.start_date || t.start_date > today) return false;
  if (t.end_date && t.end_date < today) return false;
  return true;
}

function filterTrips<T extends TripOut>(
  list: T[],
  tab: FilterTab,
  today: string,
): T[] {
  return list.filter((t) => {
    if (tab === "all") return true;
    if (tab === "completed") return isTripCompleted(t, today);
    if (tab === "upcoming") return isTripUpcoming(t, today);
    if (tab === "active") return isTripActive(t, today);
    return true;
  });
}

function sortByStartDesc(a: TripOut, b: TripOut): number {
  const da = a.start_date || "";
  const db = b.start_date || "";
  if (da && db) return db.localeCompare(da);
  if (da) return -1;
  if (db) return 1;
  return b.created_at.localeCompare(a.created_at);
}

async function withDeadline<T>(
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

function TripCardSkeleton() {
  return (
    <li className="list-none rounded-2xl border border-[#E9ECEF] bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton height={20} width="70%" />
          <Skeleton height={14} width="40%" />
        </div>
        <Skeleton height={24} width={56} />
      </div>
      <div className="mt-4 space-y-2">
        <Skeleton height={12} width="100%" />
        <Skeleton height={12} width="80%" />
      </div>
    </li>
  );
}

export default function TripsPage() {
  const router = useRouter();
  const inFlightRef = useRef<AbortController | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trips, setTrips] = useState<MergedTrip[]>([]);
  const [filter, setFilter] = useState<FilterTab>("all");

  const load = useCallback(async () => {
    inFlightRef.current?.abort();
    const ac = new AbortController();
    inFlightRef.current = ac;
    const pageSignal = ac.signal;
    setLoading(true);
    setError(null);
    try {
      const groupsRes = await withDeadline(
        (sig) => apiFetchWithStatus<GroupOut[]>("/groups", { signal: sig }),
        pageSignal,
      );
      if (pageSignal.aborted) return;
      if (groupsRes.status === 401) {
        router.push("/login");
        return;
      }
      const gList = groupsRes.data ?? [];
      const lists = await Promise.all(
        gList.map((g) =>
          withDeadline(
            (sig) =>
              apiFetchWithStatus<TripOut[]>(`/groups/${g.id}/trips`, {
                signal: sig,
              }),
            pageSignal,
          ),
        ),
      );
      if (pageSignal.aborted) return;
      if (lists.some((x) => x.status === 401)) {
        router.push("/login");
        return;
      }
      const merged: MergedTrip[] = [];
      (lists as { data: TripOut[] | null; status: number }[]).forEach(
        (res, i) => {
          const g = gList[i]!;
          const tripList = res.data ?? [];
          tripList.forEach((t) => {
            merged.push({
              ...t,
              groupName: g.name,
              members: g.members ?? [],
            });
          });
        },
      );
      merged.sort(sortByStartDesc);
      setTrips(merged);
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      setError("Could not load data. Tap to retry.");
    } finally {
      if (!pageSignal.aborted) setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
    return () => inFlightRef.current?.abort();
  }, [load]);

  const today = useMemo(() => todayYmd(), []);

  const filtered = useMemo(
    () => filterTrips(trips, filter, today),
    [trips, filter, today],
  );

  const tabs: { id: FilterTab; label: string }[] = [
    { id: "all", label: "All" },
    { id: "upcoming", label: "Upcoming" },
    { id: "active", label: "Active" },
    { id: "completed", label: "Completed" },
  ];

  return (
    <div className="min-h-0 p-4 md:p-6" style={{ background: BG }}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-[22px] font-bold" style={{ color: "#0F3460" }}>
          Your Trips
        </h1>
        <button
          type="button"
          onClick={() => router.push("/trips/plan")}
          className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-95"
          style={{ background: CORAL }}
        >
          + Plan New Trip
        </button>
      </div>

      <div
        className="mt-6 flex flex-wrap gap-6 border-b"
        style={{ borderColor: BORDER }}
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setFilter(t.id)}
            className={`border-b-2 pb-3 text-sm font-semibold transition ${
              filter === t.id
                ? "border-[#E94560] text-[#E94560]"
                : "border-transparent text-[#6C757D]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && !loading ? (
        <div className="mt-8 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p>{error}</p>
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
        <ul className="mt-8 grid list-none gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <TripCardSkeleton />
          <TripCardSkeleton />
          <TripCardSkeleton />
        </ul>
      ) : !error && filtered.length === 0 ? (
        <EmptyState
          filter={filter}
          onPlan={() => router.push("/trips/plan")}
        />
      ) : !error ? (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((t) => (
            <TripCard
              key={t.id}
              trip={t as TripCardTrip}
              today={today}
              onOpen={() => router.push(`/trips/${t.id}`)}
            />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function EmptyState({
  filter,
  onPlan,
}: {
  filter: FilterTab;
  onPlan: () => void;
}) {
  if (filter === "upcoming") {
    return (
      <div className="mt-16 flex flex-col items-center text-center">
        <p className="text-lg font-semibold" style={{ color: "#0F3460" }}>
          No upcoming trips
        </p>
        <button
          type="button"
          onClick={onPlan}
          className="mt-6 rounded-xl px-6 py-3 text-sm font-bold text-white"
          style={{ background: CORAL }}
        >
          Plan New Trip →
        </button>
      </div>
    );
  }
  if (filter === "active") {
    return (
      <div className="mt-16 flex flex-col items-center text-center">
        <p className="text-lg font-semibold" style={{ color: "#0F3460" }}>
          No active trips
        </p>
        <p className="mt-2 max-w-sm text-sm text-[#6C757D]">
          Start a trip to see it here
        </p>
      </div>
    );
  }
  if (filter === "completed") {
    return (
      <div className="mt-16 flex flex-col items-center text-center">
        <p className="text-lg font-semibold" style={{ color: "#0F3460" }}>
          No completed trips yet
        </p>
        <p className="mt-2 max-w-sm text-sm text-[#6C757D]">
          Your finished trips will appear here
        </p>
      </div>
    );
  }
  return (
    <div className="mt-16 flex flex-col items-center text-center">
      <span className="inline-flex justify-center text-[#0F3460]" aria-hidden>
        <Plane className="h-14 w-14" strokeWidth={1.5} />
      </span>
      <p className="mt-4 text-lg font-semibold" style={{ color: "#0F3460" }}>
        No trips yet
      </p>
      <button
        type="button"
        onClick={onPlan}
        className="mt-6 rounded-xl px-6 py-3 text-sm font-bold text-white"
        style={{ background: CORAL }}
      >
        + Plan Your First Trip
      </button>
    </div>
  );
}
