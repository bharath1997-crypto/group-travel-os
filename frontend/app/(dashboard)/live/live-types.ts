import type { PlacePreviewData } from "./PlacePreviewCard";

export function toSafeErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "type" in error) {
    return `Browser event error: ${(error as Event).type}`;
  }
  return "Unknown error";
}

export type LiveStage =
  | "static_landing"
  | "place_preview"
  | "destination_set"
  | "long_distance_preview"
  | "solo_drive_command"
  | "solo_drive_navigation";

export type TripStatus = "on_the_way" | "stopping" | "reached" | "running_late";

export type UserLocationUpdate = {
  lat: number;
  lng: number;
  speedMps: number | null;
  heading: number | null;
  accuracyMeters: number | null;
  timestamp: number | null;
};

export type RoutePreviewStatus = "idle" | "loading" | "ready" | "failed";

export type RouteOriginSource = "gps" | "search" | "map_pick" | "map_center";

export type RouteOrigin = {
  id: string;
  name: string;
  address?: string;
  latitude: number;
  longitude: number;
  source: RouteOriginSource;
  accuracyMeters?: number | null;
};

export function formatRouteOriginLabel(origin: RouteOrigin | null | undefined): string {
  if (!origin) return "Not set";
  if (origin.source === "gps") return "Current location";
  if (origin.source === "map_center") return "Map center";
  if (origin.source === "map_pick") return origin.name || "Custom start point";
  return origin.name;
}

export type RouteManeuver = {
  instruction: string;
  location: [number, number]; // [lng, lat]
};

export type RouteLine = {
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
  geometry: [number, number][];
  distanceMeters: number;
  durationSeconds: number;
  maneuvers?: RouteManeuver[];
  active: boolean;
};

export type DistanceTier = "local" | "far" | "long_distance";

export type { PlacePreviewData };

export const LOCAL_DISTANCE_MILES = 100;
export const FAR_DISTANCE_MILES = 500;

/** Under 100 miles — normal local Live destination. */
export const LOCAL_LIVE_MAX_M = LOCAL_DISTANCE_MILES * 1609.34;

/** Over 500 miles — strong far-away warning. */
export const FAR_WARNING_MAX_M = FAR_DISTANCE_MILES * 1609.34;

/** Legacy alias used by existing warning checks (~100 mi). */
export const FAR_LOCATION_THRESHOLD_M = LOCAL_LIVE_MAX_M;

export function getDistanceTier(distanceM: number | null): DistanceTier {
  if (distanceM == null) return "local";
  if (distanceM <= LOCAL_LIVE_MAX_M) return "local";
  if (distanceM <= FAR_WARNING_MAX_M) return "far";
  return "long_distance";
}

export function isFarFromUser(distanceM: number | null): boolean {
  return getDistanceTier(distanceM) !== "local";
}

export function isLongDistanceFromUser(distanceM: number | null): boolean {
  return getDistanceTier(distanceM) === "long_distance";
}

export function canDrawLocalRoute(distanceM: number | null): boolean {
  return distanceM == null || distanceM <= LOCAL_LIVE_MAX_M;
}

export function canStartSoloLive(distanceM: number | null): boolean {
  return !isLongDistanceFromUser(distanceM);
}

export function formatDistanceMiles(m: number | null): string {
  if (m == null) return "Calculating…";
  const miles = m / 1609.34;
  if (miles < 0.1) return `${Math.round(m)} m`;
  return `${miles.toFixed(1)} mi`;
}

export function estimateDriveEta(distanceM: number | null): string {
  if (distanceM == null) return "Calculating…";
  if (distanceM > LOCAL_LIVE_MAX_M) return "Long-distance route";
  const miles = distanceM / 1609.34;
  const minutes = Math.max(1, Math.round((miles / 30) * 60));
  return `${minutes} min`;
}

export function formatRouteDuration(durationSeconds: number | null | undefined): string {
  if (durationSeconds == null || !Number.isFinite(durationSeconds)) return "Calculating…";
  const minutes = Math.max(1, Math.round(durationSeconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem > 0 ? `${hours} hr ${rem} min` : `${hours} hr`;
}

export function speedMpsToMph(speedMps: number | null): number {
  if (speedMps == null || Number.isNaN(speedMps) || speedMps < 0) return 0;
  return Math.round(speedMps * 2.23694);
}

export function formatArrivalTime(etaMinutes: number | null): string {
  const d = new Date();
  if (etaMinutes == null) {
    d.setMinutes(d.getMinutes() + 8);
  } else {
    d.setMinutes(d.getMinutes() + etaMinutes);
  }
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function etaMinutesFromDistance(distanceM: number | null): number | null {
  if (distanceM == null || distanceM > LOCAL_LIVE_MAX_M) return null;
  const miles = distanceM / 1609.34;
  return Math.max(1, Math.round((miles / 30) * 60));
}
