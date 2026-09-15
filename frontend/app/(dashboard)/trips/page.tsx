"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plane } from "lucide-react";

import { TripCard, type TripCardTrip } from "@/components/trips";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { Button } from "@/components/ui/button";
import { apiFetchWithStatus } from "@/lib/api";

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
        "linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)",
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
        setTrips([]);
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
        setTrips([]);
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
    <PageShell>
      <PageHeader
        title="Your Trips"
        description="Plan, manage, and revisit group adventures."
        actions={
          <Button type="button" onClick={() => router.push("/trips/plan")}>
            + Plan New Trip
          </Button>
        }
      />

      <div className="mt-2 flex flex-wrap gap-6 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setFilter(t.id)}
            className={`min-h-11 border-b-2 pb-3 text-sm font-semibold transition ${
              filter === t.id
                ? "border-primary text-primary"
                : "border-transparent text-muted hover:text-text"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && !loading ? (
        <div className="mt-8 rounded-control border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-text">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-2 font-semibold text-primary underline hover:text-primary-hover"
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
        <TripsEmptyState
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
    </PageShell>
  );
}

function TripsEmptyState({
  filter,
  onPlan,
}: {
  filter: FilterTab;
  onPlan: () => void;
}) {
  if (filter === "upcoming") {
    return (
      <div className="mt-16 flex flex-col items-center text-center">
        <p className="text-lg font-bold text-text">No upcoming trips</p>
        <Button type="button" className="mt-6" onClick={onPlan}>
          Plan New Trip →
        </Button>
      </div>
    );
  }
  if (filter === "active") {
    return (
      <div className="mt-16 flex flex-col items-center text-center">
        <p className="text-lg font-bold text-text">No active trips</p>
        <p className="mt-2 max-w-sm text-sm text-muted">Start a trip to see it here</p>
      </div>
    );
  }
  if (filter === "completed") {
    return (
      <div className="mt-16 flex flex-col items-center text-center">
        <p className="text-lg font-bold text-text">No completed trips yet</p>
        <p className="mt-2 max-w-sm text-sm text-muted">
          Your finished trips will appear here
        </p>
      </div>
    );
  }
  return (
    <div className="mt-16 flex flex-col items-center text-center">
      <span
        className="mb-4 inline-flex justify-center rounded-full border border-primary/15 bg-primary-soft p-4 text-primary"
        aria-hidden
      >
        <Plane className="h-10 w-10" strokeWidth={1.5} />
      </span>
      <p className="text-lg font-bold text-text">No trips yet</p>
      <Button type="button" className="mt-6" onClick={onPlan}>
        + Plan Your First Trip
      </Button>
    </div>
  );
}
