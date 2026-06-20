export type TripMember = {
  user_id: string;
  display_name: string;
  is_admin: boolean;
};

export type GroupValidateResponse = {
  trip_id: string;
  trip_name: string;
  member_count: number;
  members: TripMember[];
  is_admin: boolean;
};

export type MeetingPoint = {
  lat: number;
  lng: number;
  label: string;
  set_by: string;
  set_at: string;
};

export type ConvoyData = {
  active: boolean;
  leader_id: string;
  destination_lat: number;
  destination_lng: number;
  destination_name: string;
  route_geometry: GeoJSON.LineString;
  started_at: string;
};

export type QuickStatus =
  | "on_my_way"
  | "wait_for_me"
  | "at_the_spot"
  | "need_help";

export type MemberLiveData = {
  lat?: number;
  lng?: number;
  bearing?: number | null;
  speed_mph?: number;
  last_seen?: string;
  status?: QuickStatus | { status?: QuickStatus; updated_at?: string };
};

export const MEMBER_DOT_COLORS = ["#7c3aed", "#d97706", "#f97316", "#2563eb"];

export const STATUS_LABELS: Record<QuickStatus, string> = {
  on_my_way: "On my way",
  wait_for_me: "Wait for me",
  at_the_spot: "At the spot",
  need_help: "Need help",
};

export const STATUS_BADGE_CLASSES: Record<QuickStatus, string> = {
  on_my_way: "bg-teal-100 text-teal-800",
  wait_for_me: "bg-amber-100 text-amber-800",
  at_the_spot: "bg-green-100 text-green-800",
  need_help: "bg-red-100 text-red-800",
};

export function firstName(displayName: string): string {
  return displayName.trim().split(/\s+/)[0] || displayName;
}

export function memberStatusValue(
  data: MemberLiveData | undefined,
): QuickStatus | null {
  if (!data?.status) return null;
  if (typeof data.status === "string") return data.status;
  return data.status.status ?? null;
}

export function isMemberOffline(lastSeen: string | undefined): boolean {
  if (!lastSeen) return true;
  const diffMs = Date.now() - new Date(lastSeen).getTime();
  return diffMs > 5 * 60 * 1000;
}

export function etaMinutesToPoint(
  memberLat: number | undefined,
  memberLng: number | undefined,
  targetLat: number,
  targetLng: number,
  speedMph?: number,
): number | null {
  if (memberLat == null || memberLng == null) return null;
  const radiusM = 6371000;
  const phi1 = (memberLat * Math.PI) / 180;
  const phi2 = (targetLat * Math.PI) / 180;
  const dPhi = ((targetLat - memberLat) * Math.PI) / 180;
  const dLng = ((targetLng - memberLng) * Math.PI) / 180;
  const a =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLng / 2) ** 2;
  const distanceM = radiusM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  const speed = speedMph && speedMph > 5 ? speedMph : 25;
  const hours = distanceM / 1609.34 / speed;
  return Math.max(1, Math.round(hours * 60));
}

export function memberColorForIndex(index: number): string {
  return MEMBER_DOT_COLORS[index % MEMBER_DOT_COLORS.length];
}
