import type { FetchRouteResult } from "@/app/(dashboard)/live/live-routing";
import { areSeatShareEndpointsReady, type LocationPoint } from "./seats-location";

export const SEATSHARE_MAX_DISTANCE_MILES = 200;

const METERS_PER_MILE = 1609.344;

export type RouteOption = {
  id: string;
  label: string;
  distanceMiles: number;
  durationMinutes: number;
  geometry: [number, number][];
  isEligible: boolean;
};

export function metersToMiles(meters: number): number {
  return meters / METERS_PER_MILE;
}

export function isRouteEligible(distanceMiles: number): boolean {
  return distanceMiles <= SEATSHARE_MAX_DISTANCE_MILES;
}

export function formatRouteDistance(miles: number): string {
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

export function formatRouteDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h} hr ${m} min` : `${h} hr`;
}

function geometryFingerprint(coords: [number, number][]): string {
  if (coords.length === 0) return "";
  const a = coords[0];
  const b = coords[coords.length - 1];
  return `${coords.length}:${a[0].toFixed(4)},${a[1].toFixed(4)}:${b[0].toFixed(4)},${b[1].toFixed(4)}`;
}

function toRouteOption(
  id: string,
  label: string,
  geometry: [number, number][],
  distanceMeters: number,
  durationSeconds: number,
): RouteOption {
  const distanceMiles = metersToMiles(distanceMeters);
  return {
    id,
    label,
    distanceMiles,
    durationMinutes: Math.max(1, Math.round(durationSeconds / 60)),
    geometry,
    isEligible: isRouteEligible(distanceMiles),
  };
}

/** Primary drivable route plus up to two alternates from Live route preview. */
export function buildSeatShareRouteOptions(result: FetchRouteResult): RouteOption[] {
  const line = result.route;
  if (!line || line.geometry.length < 2) return [];

  const options: RouteOption[] = [
    toRouteOption("primary", "Primary route", line.geometry, line.distanceMeters, line.durationSeconds),
  ];
  const seen = new Set([geometryFingerprint(line.geometry)]);

  for (const alt of result.alternatives ?? []) {
    if (options.length >= 3) break;
    if (!alt.geometry || alt.geometry.length < 2) continue;
    const fp = geometryFingerprint(alt.geometry);
    if (seen.has(fp)) continue;
    seen.add(fp);
    options.push(
      toRouteOption(alt.id, alt.label || `Alternate ${options.length}`, alt.geometry, alt.distanceMeters, alt.durationSeconds),
    );
  }

  return options;
}

export function findRouteOption(options: RouteOption[], id: string | null): RouteOption | null {
  if (!id) return options[0] ?? null;
  return options.find((o) => o.id === id) ?? options[0] ?? null;
}

export function isSeatShareSearchReady(
  from: LocationPoint,
  to: LocationPoint,
  selected: RouteOption | null,
): boolean {
  return areSeatShareEndpointsReady(from, to) && !!selected?.isEligible;
}
