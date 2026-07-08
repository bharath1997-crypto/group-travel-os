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
