"use client";

import { haversineM } from "@/lib/geo";

export type BadgeKind =
  | "arrived"
  | "near"
  | "on_the_way"
  | "stale"
  | "offline";

export type MemberCardProps = {
  userId: string;
  name: string | null | undefined;
  avatarUrl?: string | null;
  lat: number | null;
  lng: number | null;
  updatedAt: number | null;
  quickStatus?: string | null;
  meetLat: number | null;
  meetLng: number | null;
  currentUser?: boolean;
};

const STALE_SEC = 120;

function classify(m: Omit<MemberCardProps, "name" | "avatarUrl">): {
  badge: BadgeKind;
  label: string;
  distanceLabel: string;
} {
  const nowSec = Math.floor(Date.now() / 1000);
  if (
    m.lat === null ||
    m.lng === null ||
    typeof m.updatedAt !== "number" ||
    Number.isNaN(m.updatedAt)
  ) {
    return { badge: "offline", label: "⚫ Offline", distanceLabel: "—" };
  }
  const age = nowSec - m.updatedAt;
  if (age > STALE_SEC) {
    return { badge: "stale", label: "🟡 Stale", distanceLabel: "—" };
  }

  let dMeet: number | null = null;
  if (
    m.meetLat !== null &&
    m.meetLng !== null &&
    !Number.isNaN(m.meetLat) &&
    !Number.isNaN(m.meetLng)
  )
    dMeet = haversineM(m.lat, m.lng, m.meetLat, m.meetLng);

  if (dMeet !== null) {
    if (dMeet <= 100)
      return {
        badge: "arrived",
        label: "🟢 Arrived",
        distanceLabel: `${Math.round(dMeet)} m`,
      };
    if (dMeet <= 500)
      return {
        badge: "near",
        label: "🔵 Near",
        distanceLabel: `${Math.round(dMeet)} m`,
      };
    return {
      badge: "on_the_way",
      label: "🟠 On the way",
      distanceLabel: `${Math.round(dMeet)} m`,
    };
  }

  return {
    badge: "on_the_way",
    label: "🟠 On the way",
    distanceLabel: "—",
  };
}

export function MemberStatusCard(props: MemberCardProps) {
  const { label, distanceLabel } = classify(props);
  const qs = props.quickStatus?.trim();

  return (
    <div
      className={[
        "flex min-w-[140px] max-w-[160px] flex-col rounded-2xl border bg-[rgba(13,31,71,0.92)] px-3 py-2 text-white backdrop-blur",
        props.currentUser ? "border-[#50d493]" : "border-[#29467c]",
      ].join(" ")}
    >
      <div className="flex items-center gap-2">
        <span
          className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-semibold shadow-inner ring-2 ring-black/40"
          style={{
            background: props.avatarUrl
              ? undefined
              : `linear-gradient(135deg,#1d4ed8,#0f172a)`,
          }}
        >
          {props.avatarUrl ? (
            <img
              alt=""
              src={props.avatarUrl}
              className="h-full w-full object-cover"
            />
          ) : (
            (props.name || "?").slice(0, 1)
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-bold">
            {props.currentUser ? "You" : props.name || "Traveler"}
          </p>
          <p className="truncate text-[10px] opacity-85">{label}</p>
          {qs ? (
            <p className="truncate text-[10px] text-emerald-200/90">{qs}</p>
          ) : null}
        </div>
      </div>
      <p className="mt-2 text-[10px] text-[#8fa6d3]">
        To meet · <span className="font-semibold text-white">{distanceLabel}</span>
      </p>
    </div>
  );
}

export { classify as classifyMemberPresence };
