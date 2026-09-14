import { haversineM } from "@/lib/geo";
import type { GroupConvergeMember } from "./live-group-converge-mock";
import type { TripMemberLocation } from "./live-group-location-types";

export const ARRIVAL_RADIUS_WALK_M = 150;
export const ARRIVAL_RADIUS_DRIVE_M = 250;

export type ArrivalRecord = {
  userId: string;
  arrivedAt: number;
  lat: number;
  lng: number;
};

export function arrivalRadiusForTravelMode(travelMode: string): number {
  return travelMode === "Walk" || travelMode === "Trek"
    ? ARRIVAL_RADIUS_WALK_M
    : ARRIVAL_RADIUS_DRIVE_M;
}

export function isWithinArrivalRadius(
  lat: number,
  lng: number,
  destinationLat: number,
  destinationLng: number,
  radiusM: number,
): boolean {
  return haversineM(lat, lng, destinationLat, destinationLng) <= radiusM;
}

export function parseArrivalsSnapshot(
  data: Record<string, unknown> | null | undefined,
): ArrivalRecord[] {
  if (!data) return [];

  const records: ArrivalRecord[] = [];
  for (const [userId, raw] of Object.entries(data)) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const lat = Number(row.lat);
    const lng = Number(row.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    records.push({
      userId,
      lat,
      lng,
      arrivedAt: Number(row.arrivedAt ?? row.arrived_at ?? Date.now()),
    });
  }
  return records;
}

export function buildArrivalSubline(input: {
  arrivedCount: number;
  memberCount: number;
  lateMembers: GroupConvergeMember[];
  staleMembers: GroupConvergeMember[];
}): string {
  const parts: string[] = [];
  if (input.lateMembers[0]) {
    parts.push(`${input.lateMembers[0].name} ${input.lateMembers[0].etaLabel} out`);
  }
  if (input.staleMembers[0]) {
    parts.push(`${input.staleMembers[0].name} hasn't moved recently`);
  }
  if (parts.length === 0) {
    if (input.arrivedCount >= input.memberCount) {
      return "Everyone is at the meetup.";
    }
    return "Others are still on the way.";
  }
  return parts.join(". ");
}

export function computeGroupArrival(input: {
  destination: { lat: number; lng: number };
  memberCount: number;
  selfUserId: string | null;
  selfLat: number | null;
  selfLng: number | null;
  memberLocations: TripMemberLocation[];
  rtArrivals: ArrivalRecord[];
  convergeMembers: GroupConvergeMember[];
  travelMode: string;
}): {
  arrivedUserIds: string[];
  arrivedCount: number;
  memberCount: number;
  subline: string;
  suggestNightFinished: boolean;
  selfArrived: boolean;
} {
  const radiusM = arrivalRadiusForTravelMode(input.travelMode);
  const arrived = new Set<string>();

  for (const record of input.rtArrivals) {
    arrived.add(record.userId);
  }

  for (const location of input.memberLocations) {
    if (location.status === "stale") continue;
    if (
      isWithinArrivalRadius(
        location.lat,
        location.lng,
        input.destination.lat,
        input.destination.lng,
        radiusM,
      )
    ) {
      arrived.add(location.userId);
    }
  }

  if (
    input.selfUserId &&
    input.selfLat != null &&
    input.selfLng != null &&
    isWithinArrivalRadius(
      input.selfLat,
      input.selfLng,
      input.destination.lat,
      input.destination.lng,
      radiusM,
    )
  ) {
    arrived.add(input.selfUserId);
  }

  if (arrived.size === 0) {
    for (const member of input.convergeMembers) {
      if (member.status === "stale") continue;
      if (member.etaMinutes != null && member.etaMinutes <= 8) {
        arrived.add(member.id);
      }
    }
  }

  const memberCount = Math.max(input.memberCount, input.convergeMembers.length, 1);
  const rawArrivedCount = arrived.size;
  const finalArrivedCount = Math.min(Math.max(1, rawArrivedCount), memberCount);

  const lateMembers = input.convergeMembers.filter(
    (member) => member.status === "late" && !member.isSelf && !arrived.has(member.id),
  );
  const staleMembers = input.convergeMembers.filter(
    (member) => member.status === "stale" && !arrived.has(member.id),
  );

  const majority = Math.ceil(memberCount * 0.5);
  const suggestNightFinished = rawArrivedCount >= 2 && rawArrivedCount >= majority;

  return {
    arrivedUserIds: [...arrived],
    arrivedCount: finalArrivedCount,
    memberCount,
    subline: buildArrivalSubline({
      arrivedCount: finalArrivedCount,
      memberCount,
      lateMembers,
      staleMembers,
    }),
    suggestNightFinished,
    selfArrived: Boolean(input.selfUserId && arrived.has(input.selfUserId)),
  };
}
