import { haversineM } from "@/lib/geo";
import { LOCAL_LIVE_MAX_M, type RouteLine } from "./live-types";
import type { LiveLocationContext } from "./live-location-context";

/** Direct distance above this (m) cannot be a same-session Solo Live drive. */
export const SOLO_LIVE_MAX_DIRECT_M = LOCAL_LIVE_MAX_M;

/** Direct distance above this (m) is treated as cross-continent / no land path. */
export const CROSS_OCEAN_DIRECT_M = 2_000_000;

/** Fewer geometry points than this over minDirectM implies a straight line (often over water). */
export const STRAIGHT_LINE_MAX_POINTS = 4;
export const STRAIGHT_LINE_MIN_DIRECT_M = 80_000;

export function polylineLengthM(geometry: [number, number][]): number {
  if (geometry.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < geometry.length; i += 1) {
    const [lngA, latA] = geometry[i - 1];
    const [lngB, latB] = geometry[i];
    total += haversineM(latA, lngA, latB, lngB);
  }
  return total;
}

/** Reject drive routes that are really just a straight line over open water. */
export function isLandConnectedDriveRoute(
  geometry: [number, number][],
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
): boolean {
  if (!geometry || geometry.length < 2) return false;

  const directM = haversineM(originLat, originLng, destLat, destLng);

  if (directM > CROSS_OCEAN_DIRECT_M) return false;

  if (geometry.length <= STRAIGHT_LINE_MAX_POINTS && directM > STRAIGHT_LINE_MIN_DIRECT_M) {
    return false;
  }

  if (directM > SOLO_LIVE_MAX_DIRECT_M) {
    const pathM = polylineLengthM(geometry);
    if (geometry.length < 8 && pathM < directM * 1.08) return false;
  }

  return true;
}

export function soloLiveBlockReason(input: {
  travelMode?: string;
  distanceM?: number | null;
  originLat?: number;
  originLng?: number;
  destLat?: number;
  destLng?: number;
  route?: RouteLine | null;
  locationContext?: LiveLocationContext | null;
}): string | null {
  if ((input.travelMode ?? "Drive") !== "Drive") return null;

  const directM =
    input.distanceM ??
    (input.originLat != null &&
    input.originLng != null &&
    input.destLat != null &&
    input.destLng != null
      ? haversineM(input.originLat, input.originLng, input.destLat, input.destLng)
      : null);

  if (input.locationContext && !input.locationContext.liveSafe) {
    return (
      input.locationContext.template?.recommendation ??
      "This destination is not safe for Solo Live right now. Plan it as a future trip."
    );
  }

  if (directM != null && directM > SOLO_LIVE_MAX_DIRECT_M) {
    return "This place is too far for Solo Live driving. Save it or plan it as a future trip.";
  }

  if (
    input.route &&
    input.originLat != null &&
    input.originLng != null &&
    input.destLat != null &&
    input.destLng != null &&
    !isLandConnectedDriveRoute(
      input.route.geometry,
      input.originLat,
      input.originLng,
      input.destLat,
      input.destLng,
    )
  ) {
    return "No driveable land route to this location. It may be across open water or another continent.";
  }

  return null;
}

export function shouldDrawDriveRouteOnMap(input: {
  travelMode?: string;
  route?: RouteLine | null;
  originLat?: number;
  originLng?: number;
  destLat?: number;
  destLng?: number;
}): boolean {
  if (!input.route?.geometry || input.route.geometry.length < 2) return false;
  if ((input.travelMode ?? "Drive") !== "Drive") return true;

  if (
    input.originLat == null ||
    input.originLng == null ||
    input.destLat == null ||
    input.destLng == null
  ) {
    return input.route.geometry.length > STRAIGHT_LINE_MAX_POINTS;
  }

  return isLandConnectedDriveRoute(
    input.route.geometry,
    input.originLat,
    input.originLng,
    input.destLat,
    input.destLng,
  );
}
