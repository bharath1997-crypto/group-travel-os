"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { LoadingSkeleton, TripCard, type TripCardTrip } from "@/components/trips";
import { apiFetchWithStatus } from "@/lib/api";

const CORAL = "#E94560";
const BORDER = "#E9ECEF";
const BG = "#F8F9FA";

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

export default function TripsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState<MergedTrip[]>([]);
  const [filter, setFilter] = useState<FilterTab>("all");

  const load = useCallback(async () => {
    setLoading(true);
    const { data: groups, status } =
      await apiFetchWithStatus<GroupOut[]>("/groups");
    if (status === 401) {
      router.push("/login");
      return;
    }
    const gList = groups ?? [];
    const lists = await Promise.all(
      gList.map((g) =>
        apiFetchWithStatus<TripOut[]>(`/groups/${g.id}/trips`).then((r) =>
          r.status === 401 ? null : (r.data ?? []),
        ),
      ),
    );
    if (lists.some((x) => x === null)) {
      router.push("/login");
      return;
    }
    const merged: MergedTrip[] = [];
    (lists as TripOut[][]).forEach((tripList, i) => {
      const g = gList[i];
      tripList.forEach((t) => {
        merged.push({
          ...t,
          groupName: g.name,
          members: g.members ?? [],
        });
      });
    });
    merged.sort(sortByStartDesc);
    setTrips(merged);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    void load();
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
        <h1
          className="text-[22px] font-bold"
          style={{ color: "#0F3460" }}
        >
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

      {loading ? (
        <LoadingSkeleton variant="trips-grid" className="mt-8" />
      ) : filtered.length === 0 ? (
        <EmptyState
          filter={filter}
          onPlan={() => router.push("/trips/plan")}
        />
      ) : (
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
      )}
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
      <span className="text-5xl" aria-hidden>
        ✈️
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
