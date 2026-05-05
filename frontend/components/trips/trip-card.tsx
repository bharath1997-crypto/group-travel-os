"use client";

import { Check } from "lucide-react";
import type { ReactNode } from "react";

const NAVY = "#0F3460";
const CORAL = "#E94560";
const BORDER = "#E9ECEF";

/** Navy → coral gradient per design system */
export const TRIP_CARD_HEADER_GRADIENT =
  "linear-gradient(135deg, #0F3460 0%, #E94560 100%)";

export type TripCardTrip = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  groupName?: string;
  members?: { id: string; user_id: string; full_name: string }[];
};

function diceBear(seed: string): string {
  return `https://api.dicebear.com/7.x/lorelei/svg?seed=${encodeURIComponent(seed)}`;
}

function todayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isTripCompleted(
  t: Pick<TripCardTrip, "status" | "end_date">,
  today: string,
): boolean {
  if (t.status === "completed") return true;
  if (t.end_date && t.end_date < today) return true;
  return false;
}

function isTripUpcoming(
  t: Pick<TripCardTrip, "start_date">,
  today: string,
): boolean {
  if (!t.start_date) return false;
  return t.start_date > today;
}

function isTripActive(
  t: Pick<TripCardTrip, "start_date" | "end_date" | "status">,
  today: string,
): boolean {
  if (isTripCompleted(t, today)) return false;
  if (!t.start_date || t.start_date > today) return false;
  if (t.end_date && t.end_date < today) return false;
  return true;
}

function formatRange(start: string | null, end: string | null): string {
  if (!start && !end) return "Dates TBD";
  if (start && end) return `${start} → ${end}`;
  return start || end || "—";
}

function statusBadgeStyle(
  status: string,
): { bg: string; cls: string; pulse?: boolean } {
  if (status === "ongoing" || status === "confirmed") {
    return { bg: "#22C55E", cls: "text-white", pulse: true };
  }
  if (status === "completed") return { bg: NAVY, cls: "text-white" };
  if (status === "cancelled") return { bg: "#DC2626", cls: "text-white" };
  return { bg: "#ADB5BD", cls: "text-white" };
}

function memberCountDisplay(members: TripCardTrip["members"] | undefined): {
  count: number;
  isMock: boolean;
} {
  const n = members?.length ?? 0;
  if (n > 0) return { count: n, isMock: false };
  return { count: 4, isMock: true };
}

export function TripCard({
  trip,
  today: todayProp,
  onOpen,
}: {
  trip: TripCardTrip;
  today?: string;
  onOpen: () => void;
}) {
  const today = todayProp ?? todayYmd();
  const sb = statusBadgeStyle(trip.status);
  const upcoming = isTripUpcoming(trip, today);
  const active = isTripActive(trip, today);
  const completed = isTripCompleted(trip, today);

  const start = trip.start_date
    ? new Date(trip.start_date + "T12:00:00")
    : null;
  const end = trip.end_date
    ? new Date(trip.end_date + "T12:00:00")
    : null;
  const todayD = new Date(today + "T12:00:00");

  let row4: ReactNode = null;
  if (upcoming && start) {
    const days = Math.max(
      0,
      Math.ceil((start.getTime() - todayD.getTime()) / 86400000),
    );
    row4 = (
      <p className="text-xs font-semibold" style={{ color: CORAL }}>
        Starts in {days} day{days === 1 ? "" : "s"}
      </p>
    );
  } else if (active && start && end) {
    const total = Math.max(
      1,
      Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1,
    );
    const passed = Math.min(
      total,
      Math.max(
        1,
        Math.floor((todayD.getTime() - start.getTime()) / 86400000) + 1,
      ),
    );
    const pct = Math.min(100, Math.round((passed / total) * 100));
    row4 = (
      <div>
        <div className="mb-1 h-1.5 w-full overflow-hidden rounded-full bg-[#E9ECEF]">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, background: CORAL }}
          />
        </div>
        <p className="text-xs text-[#6C757D]">
          Day {passed} of {total}
        </p>
      </div>
    );
  } else if (active && start && !end) {
    const day = Math.max(
      1,
      Math.floor((todayD.getTime() - start.getTime()) / 86400000) + 1,
    );
    row4 = (
      <p className="text-xs text-[#6C757D]">
        Day {day} · in progress
      </p>
    );
  } else if (completed) {
    row4 = (
      <p className="flex items-center gap-1 text-xs font-semibold text-green-600">
        <Check className="h-3 w-3" strokeWidth={1.5} aria-hidden />
        Completed
      </p>
    );
  }

  const members = (trip.members ?? []).slice(0, 4);
  const { count: totalMembers, isMock: mockMembers } = memberCountDisplay(
    trip.members,
  );
  const more = Math.max(0, (trip.members?.length ?? 0) - 4);

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full cursor-pointer flex-col overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        style={{ borderColor: BORDER }}
      >
        <div
          className="relative flex h-[88px] shrink-0 flex-col justify-end px-3 pb-2 pt-2"
          style={{ background: TRIP_CARD_HEADER_GRADIENT }}
        >
          <span
            className={`absolute right-3 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${sb.cls} ${sb.pulse ? "animate-pulse" : ""}`}
            style={{ background: sb.bg }}
          >
            {trip.status.replace(/_/g, " ")}
          </span>
          <p className="line-clamp-2 pr-16 text-[15px] font-bold leading-snug text-white drop-shadow-sm">
            {trip.title || "Untitled trip"}
          </p>
          <p className="text-[11px] text-white/90">
            {formatRange(trip.start_date, trip.end_date)}
          </p>
        </div>
        <div className="p-3.5">
          {trip.groupName ? (
            <p className="mb-2 line-clamp-1 text-xs text-[#6C757D]">
              {trip.groupName}
            </p>
          ) : null}

          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-[#2C3E50]">
              <span className="font-semibold">{totalMembers}</span> members
              {mockMembers ? (
                <span className="text-[#ADB5BD]"> (est.)</span>
              ) : null}
            </p>
          </div>

          <div className="relative mt-3 flex h-7 items-center">
            {members.map((m, i) => (
              <img
                key={m.id}
                src={diceBear(m.user_id)}
                alt=""
                className="absolute h-7 w-7 rounded-full border-2 border-white bg-white"
                style={{ left: i * 20 }}
              />
            ))}
            {members.length > 0 && more > 0 ? (
              <span
                className="absolute text-[11px] text-[#6C757D]"
                style={{ left: Math.min(4, members.length) * 20 + 8 }}
              >
                +{more} more
              </span>
            ) : null}
          </div>

          {row4 ? <div className="mt-3">{row4}</div> : null}
        </div>
        <div
          className="border-t px-3.5 py-2.5 text-right text-sm font-semibold"
          style={{ borderColor: "#f5f5f5", color: CORAL }}
        >
          View trip →
        </div>
      </button>
    </li>
  );
}
