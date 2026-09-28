import { haversineM } from "@/lib/geo";
import type { FriendLocation } from "./live-friend-layer-sync";
import type {
  GroupConvergeMember,
  GroupWayraNotice,
} from "./live-group-converge-mock";
import type {
  GroupMemberSummary,
  TripMemberLocation,
  TripMemberLocationStatus,
} from "./live-group-location-types";
import { etaMinutesFromDuration } from "./live-types";

export const LOCATION_STALE_MS = 4 * 60 * 1000;
export const LOCATION_IDLE_MS = 90 * 1000;
export const MEMBER_ETA_REFRESH_MS = 30_000;

const AVATAR_STYLES = [
  { avatarClassName: "bg-[#DCEAE5] text-[#0A4A3E]", ringClassName: "border-[#6FE0C0]" },
  { avatarClassName: "bg-[#F0E5D2] text-[#7A5A22]", ringClassName: "border-[#6FE0C0]" },
  { avatarClassName: "bg-[#E4E1F2] text-[#474079]", ringClassName: "border-[#C9BFFF]" },
  { avatarClassName: "bg-[#D8D5CC] text-[#5A615A]", ringClassName: "border-[rgba(168,176,170,0.65)]" },
  { avatarClassName: "bg-[#F6E4E8] text-[#7A3A4A]", ringClassName: "border-[#E8A0B0]" },
  { avatarClassName: "bg-[#E0EEF6] text-[#2A4A66]", ringClassName: "border-[#8CB8DA]" },
];

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
  }
  return name.trim().slice(0, 2).toUpperCase();
}

export function resolveLocationStatus(
  updatedAt: number,
  now = Date.now(),
  rawStatus?: string | null,
): TripMemberLocationStatus {
  const ageMs = Math.max(0, now - updatedAt);
  if (ageMs >= LOCATION_STALE_MS) return "stale";
  if (rawStatus === "idle" || ageMs >= LOCATION_IDLE_MS) return "idle";
  return "active";
}

export function parseTripLocationsSnapshot(
  data: Record<string, unknown> | null | undefined,
  now = Date.now(),
): TripMemberLocation[] {
  if (!data) return [];

  const locations: TripMemberLocation[] = [];
  for (const [userId, raw] of Object.entries(data)) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const lat = Number(row.lat ?? row.latitude);
    const lng = Number(row.lng ?? row.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const updatedAt = Number(row.updatedAt ?? row.updated_at ?? 0);
    locations.push({
      userId,
      lat,
      lng,
      updatedAt,
      speedMps:
        row.speedMps != null
          ? Number(row.speedMps)
          : row.speed_mps != null
            ? Number(row.speed_mps)
            : null,
      heading:
        row.heading != null
          ? Number(row.heading)
          : row.bearing != null
            ? Number(row.bearing)
            : null,
      status: resolveLocationStatus(updatedAt, now, typeof row.status === "string" ? row.status : null),
      name: typeof row.name === "string" ? row.name : null,
      travelMode: typeof row.travelMode === "string" ? row.travelMode : null,
    });
  }
  return locations;
}

function movementLabel(location: TripMemberLocation | null, travelMode: string): string {
  if (!location) return "waiting for location";
  if (location.status === "stale") {
    const ageMin = Math.max(1, Math.round((Date.now() - location.updatedAt) / 60_000));
    return `location ${ageMin} min old`;
  }
  const speed = location.speedMps ?? 0;
  if (speed >= 8) return "driving";
  if (speed >= 2) return "moving";
  if (travelMode === "Walk" || travelMode === "Trek") return "walking";
  return "on the way";
}

function formatDistanceMi(distanceM: number | null): string | null {
  if (distanceM == null || !Number.isFinite(distanceM)) return null;
  const miles = distanceM / 1609.34;
  if (miles < 0.1) return "<0.1 mi";
  return `${miles.toFixed(1)} mi`;
}

function memberDetail(
  location: TripMemberLocation | null,
  destination: { lat: number; lng: number } | null,
  travelMode: string,
  etaMinutes: number | null,
  status: GroupConvergeMember["status"],
): string {
  if (!location) return "waiting for location";
  const distanceM = destination
    ? haversineM(location.lat, location.lng, destination.lat, destination.lng)
    : null;
  const distanceLabel = formatDistanceMi(distanceM);
  const movement = movementLabel(location, travelMode);

  if (status === "late" && etaMinutes != null) {
    return `${movement} · ${distanceLabel ?? "en route"} · running late`;
  }
  if (distanceLabel) return `${movement} · ${distanceLabel}`;
  return movement;
}

function classifyMemberStatus(
  location: TripMemberLocation | null,
  etaMinutes: number | null,
  fastestEta: number | null,
): GroupConvergeMember["status"] {
  if (!location || location.status === "stale") return "stale";
  if (etaMinutes == null) return "on_track";
  if (fastestEta != null && etaMinutes - fastestEta >= 12) return "late";
  return "on_track";
}

export function memberLocationsToFriends(
  locations: TripMemberLocation[],
  roster: GroupMemberSummary[],
  currentUserId: string | null,
): FriendLocation[] {
  const nameById = new Map(roster.map((member) => [member.userId, member.fullName]));

  return locations
    .filter((location) => location.userId !== currentUserId)
    .map((location) => ({
      userId: location.userId,
      name: location.name ?? nameById.get(location.userId) ?? "Member",
      lat: location.lat,
      lng: location.lng,
      lastSeenAt: new Date(location.updatedAt).toISOString(),
      status: location.status,
      speedMps: location.speedMps ?? null,
      heading: location.heading ?? null,
    }));
}

function buildRosterFromLocations(
  locations: TripMemberLocation[],
  currentUserId: string | null,
  currentUserName: string,
): GroupMemberSummary[] {
  const roster: GroupMemberSummary[] = [];
  const seen = new Set<string>();

  if (currentUserId) {
    roster.push({
      userId: currentUserId,
      fullName: currentUserName,
      avatarUrl: null,
    });
    seen.add(currentUserId);
  }

  for (const location of locations) {
    if (seen.has(location.userId)) continue;
    roster.push({
      userId: location.userId,
      fullName: location.name?.trim() || "Member",
      avatarUrl: null,
    });
    seen.add(location.userId);
  }

  return roster;
}

export function buildConvergeStatusNotice(input: {
  members: GroupConvergeMember[];
  wayraAlert?: string | null;
  mockFallback?: string;
}): string {
  const alert = input.wayraAlert?.trim();
  if (alert) {
    const firstSentence = alert.split(/(?<=[.!?])\s+/)[0]?.trim();
    if (firstSentence && firstSentence.length <= 72) return firstSentence;
    return alert.length <= 72 ? alert : `${alert.slice(0, 69).trim()}…`;
  }

  const lateMember = input.members.find((member) => !member.isSelf && member.status === "late");
  if (lateMember) {
    if (/traffic/i.test(lateMember.detail)) {
      return `${lateMember.name} hit traffic — ${lateMember.etaLabel} out`;
    }
    return `${lateMember.name} is running late · ${lateMember.etaLabel}`;
  }

  const staleMember = input.members.find((member) => !member.isSelf && member.status === "stale");
  if (staleMember) {
    return `${staleMember.name} hasn't moved recently — tap to nudge`;
  }

  return input.mockFallback ?? "Group Live is sharing ETAs";
}

export function buildConvergeMembers(input: {
  roster: GroupMemberSummary[];
  locations: TripMemberLocation[];
  currentUserId: string | null;
  currentUserName: string;
  yourRouteDurationSeconds: number | null;
  memberEtas: Record<string, number | null>;
  destination: { lat: number; lng: number } | null;
  travelMode: string;
}): GroupConvergeMember[] {
  const roster =
    input.roster.length > 0
      ? input.roster
      : buildRosterFromLocations(input.locations, input.currentUserId, input.currentUserName);

  const locationByUser = new Map(input.locations.map((location) => [location.userId, location]));
  const etaValues = Object.values(input.memberEtas).filter(
    (value): value is number => value != null,
  );
  const yourEta = etaMinutesFromDuration(input.yourRouteDurationSeconds);
  if (yourEta != null) etaValues.push(yourEta);
  const fastestEta = etaValues.length > 0 ? Math.min(...etaValues) : null;

  const members: GroupConvergeMember[] = roster.map((member, index) => {
    const style = AVATAR_STYLES[index % AVATAR_STYLES.length]!;
    const isSelf = member.userId === input.currentUserId;
    const location = locationByUser.get(member.userId) ?? null;
    const etaMinutes = isSelf
      ? yourEta
      : (input.memberEtas[member.userId] ?? null);
    const status = isSelf
      ? "on_track"
      : classifyMemberStatus(location, etaMinutes, fastestEta);
    const etaLabel =
      status === "stale"
        ? "Nudge"
        : etaMinutes != null
          ? `${etaMinutes} min`
          : location
            ? "…"
            : "—";

    return {
      id: member.userId,
      name: isSelf ? "You" : member.fullName,
      initials: initialsFromName(isSelf ? input.currentUserName : member.fullName),
      avatarClassName: style.avatarClassName,
      ringClassName: style.ringClassName,
      detail: memberDetail(location, input.destination, input.travelMode, etaMinutes, status),
      etaMinutes: status === "stale" ? null : etaMinutes,
      etaLabel,
      status,
      isSelf,
    };
  });

  if (input.currentUserId && !members.some((member) => member.isSelf)) {
    const style = AVATAR_STYLES[0]!;
    const yourEtaMinutes = yourEta;
    members.unshift({
      id: input.currentUserId,
      name: "You",
      initials: initialsFromName(input.currentUserName),
      avatarClassName: style.avatarClassName,
      ringClassName: style.ringClassName,
      detail: memberDetail(
        locationByUser.get(input.currentUserId) ?? null,
        input.destination,
        input.travelMode,
        yourEtaMinutes,
        "on_track",
      ),
      etaMinutes: yourEtaMinutes,
      etaLabel: yourEtaMinutes != null ? `${yourEtaMinutes} min` : "—",
      status: "on_track",
      isSelf: true,
    });
  }

  return members.sort((a, b) => {
    if (a.isSelf) return -1;
    if (b.isSelf) return 1;
    if (a.status === "stale" && b.status !== "stale") return 1;
    if (b.status === "stale" && a.status !== "stale") return -1;
    const aEta = a.etaMinutes ?? Number.MAX_SAFE_INTEGER;
    const bEta = b.etaMinutes ?? Number.MAX_SAFE_INTEGER;
    return aEta - bEta;
  });
}

export function wayraNoticeFromAlert(alert: string | null | undefined): GroupWayraNotice | null {
  if (!alert?.trim()) return null;
  return {
    headline: alert.trim(),
    actions: [
      { id: "order-drink", label: "Order his drink now" },
      { id: "move-table", label: "Move the table to 7:40" },
    ],
  };
}

export function shouldRefreshMemberEta(cachedAt: number | undefined, now = Date.now()): boolean {
  if (!cachedAt) return true;
  return now - cachedAt >= MEMBER_ETA_REFRESH_MS;
}
