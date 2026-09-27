import type { LiveGeocodingReverseResult } from "@/app/(dashboard)/live/live-geocoding";
import { readCountryCodeFromAddress, resolveCountryCodeForPoint } from "./seats-currency";

export type LocationSource =
  | "default"
  | "autocomplete"
  | "map_pin"
  | "gps_confirmed";

export type LocationPoint = {
  address: string;
  lat: number;
  lng: number;
  isConfirmed: boolean;
  source: LocationSource;
  road?: string | null;
  houseNumber?: string | null;
  city?: string | null;
  countryCode?: string | null;
  osmClass?: string | null;
  osmType?: string | null;
};

/** Demo / map-bias anchor only — not a confirmed origin. */
export const ANCHOR_MUMBAI = { lat: 19.1136, lng: 72.8697 };

export const PROMPT_FROM: LocationPoint = {
  address: "",
  lat: ANCHOR_MUMBAI.lat,
  lng: ANCHOR_MUMBAI.lng,
  isConfirmed: false,
  source: "default",
};

/** Demo destination coords for fixtures — not a confirmed search endpoint. */
export const DEFAULT_TO: LocationPoint = {
  address: "Pune",
  lat: 18.5912,
  lng: 73.7389,
  isConfirmed: false,
  source: "default",
};

export const PROMPT_TO: LocationPoint = {
  address: "",
  lat: 18.5912,
  lng: 73.7389,
  isConfirmed: false,
  source: "default",
};

/** @deprecated Use ANCHOR_MUMBAI for fixture coords */
export const DEFAULT_FROM = { lat: ANCHOR_MUMBAI.lat, lon: ANCHOR_MUMBAI.lng };

const POI_OSM_CLASSES = new Set(["amenity", "shop", "tourism", "leisure"]);

export function formatCoordFallback(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

export function formatSeatShareReverseAddress(
  rev: LiveGeocodingReverseResult | null,
  lat: number,
  lng: number,
): string {
  if (!rev) return formatCoordFallback(lat, lng);

  const addr = rev.address ?? {};
  const street = [addr.house_number, addr.road].filter(Boolean).join(" ").trim();
  if (street) {
    const city =
      addr.city || addr.town || addr.village || addr.suburb || addr.neighbourhood;
    return city ? `${street}, ${city}` : street;
  }

  const osmClass = (rev.class ?? "").toLowerCase();
  if (osmClass && POI_OSM_CLASSES.has(osmClass)) {
    return formatCoordFallback(lat, lng);
  }

  if (addr.road?.trim()) {
    const city = addr.city || addr.town || addr.village;
    return city ? `${addr.road.trim()}, ${city}` : addr.road.trim();
  }

  return formatCoordFallback(lat, lng);
}

export function locationPointFromReverse(
  rev: LiveGeocodingReverseResult | null,
  lat: number,
  lng: number,
  source: Extract<LocationSource, "map_pin" | "gps_confirmed">,
): LocationPoint {
  const addr = rev?.address ?? {};
  const countryCode = readCountryCodeFromAddress(addr);
  return {
    address: formatSeatShareReverseAddress(rev, lat, lng),
    lat,
    lng,
    isConfirmed: true,
    source,
    road: addr.road ?? null,
    houseNumber: addr.house_number ?? null,
    city: addr.city || addr.town || addr.village || addr.suburb || null,
    countryCode,
    osmClass: rev?.class ?? null,
    osmType: rev?.type ?? null,
  };
}

export function withResolvedCountryCode(point: LocationPoint): LocationPoint {
  if (point.countryCode) return point;
  const countryCode = resolveCountryCodeForPoint(point);
  return countryCode ? { ...point, countryCode } : point;
}

export function locationPointDraft(
  partial: Pick<LocationPoint, "address" | "lat" | "lng"> &
    Partial<Pick<LocationPoint, "isConfirmed" | "source">>,
): LocationPoint {
  return {
    address: partial.address,
    lat: partial.lat,
    lng: partial.lng,
    isConfirmed: partial.isConfirmed ?? false,
    source: partial.source ?? "default",
  };
}

export function isOriginSearchReady(from: LocationPoint): boolean {
  return from.isConfirmed;
}

export function areSeatShareEndpointsReady(from: LocationPoint, to: LocationPoint): boolean {
  return from.isConfirmed && to.isConfirmed;
}

export function tomorrowIsoDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function combineIstDateTime(date: string, time: string): Date {
  return new Date(`${date}T${time}:00+05:30`);
}

export function filterRidesAfterTime<T extends { depart_at: string }>(
  rides: T[],
  date: string,
  time: string,
): T[] {
  if (!time) return rides;
  const cutoff = combineIstDateTime(date, time).getTime();
  return rides.filter((r) => new Date(r.depart_at).getTime() >= cutoff);
}
