import { GPS_ACCEPTABLE_ACCURACY_M } from "./live-gps";
import type { RouteOrigin } from "./live-types";

export function buildGpsRouteOrigin(
  lat: number,
  lng: number,
  accuracyMeters: number | null,
): RouteOrigin {
  return {
    id: "gps:current",
    name: "Current location",
    latitude: lat,
    longitude: lng,
    source: "gps",
    accuracyMeters,
  };
}

export function buildMapCenterRouteOrigin(lat: number, lng: number): RouteOrigin {
  return {
    id: `map:center:${lat.toFixed(5)},${lng.toFixed(5)}`,
    name: "Map center",
    latitude: lat,
    longitude: lng,
    source: "map_center",
  };
}

export function buildMapPickRouteOrigin(
  lat: number,
  lng: number,
  name?: string,
  address?: string,
): RouteOrigin {
  return {
    id: `map:pick:${lat.toFixed(5)},${lng.toFixed(5)}`,
    name: name || "Custom start point",
    address,
    latitude: lat,
    longitude: lng,
    source: "map_pick",
  };
}

export function isLowGpsAccuracy(accuracyMeters: number | null | undefined): boolean {
  return accuracyMeters != null && accuracyMeters > GPS_ACCEPTABLE_ACCURACY_M;
}

export function validateRouteOriginCoords(origin: RouteOrigin | null | undefined): origin is RouteOrigin {
  if (!origin) return false;
  return Number.isFinite(origin.latitude) && Number.isFinite(origin.longitude);
}

/** User explicitly picked a start point — do not override with GPS auto-updates. */
export function isUserChosenRouteOrigin(origin: RouteOrigin | null | undefined): boolean {
  return origin?.source === "map_pick" || origin?.source === "search";
}

export function routeOriginsEquivalent(
  a: RouteOrigin | null | undefined,
  b: RouteOrigin | null | undefined,
): boolean {
  if (!a || !b) return !a && !b;
  if (a.source !== b.source) return false;
  return (
    Math.abs(a.latitude - b.latitude) < 1e-5 &&
    Math.abs(a.longitude - b.longitude) < 1e-5
  );
}
