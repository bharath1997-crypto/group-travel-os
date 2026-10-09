import { haversineMiles } from "@/lib/hero-location";

import { CITY_COORDS } from "./explore-hub-data";

/** Max distance from hero point to anchor Scaper event inventory (spec ~80 km). */
export const SCAPER_METRO_MAX_KM = 80;

const SCAPER_METRO_MAX_MILES = SCAPER_METRO_MAX_KM / 1.609344;

/**
 * Nearest known hub metro with Scaper-style inventory (Chicago, Orlando, …).
 * Naperville → Chicago; keeps hero coords for places radius separately.
 */
export function resolveScaperMetroCity(input: {
  lat?: number | null;
  lon?: number | null;
  fallbackCity?: string | null;
}): string {
  const fallback = (input.fallbackCity || "Chicago").split(",")[0].trim() || "Chicago";
  const lat = input.lat;
  const lon = input.lon;
  if (lat == null || lon == null || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    return fallback;
  }

  let bestCity: string | null = null;
  let bestMiles = Number.POSITIVE_INFINITY;

  for (const [city, coords] of Object.entries(CITY_COORDS)) {
    const miles = haversineMiles(lat, lon, coords.lat, coords.lng);
    if (miles <= SCAPER_METRO_MAX_MILES && miles < bestMiles) {
      bestMiles = miles;
      bestCity = city;
    }
  }

  return bestCity ?? fallback;
}
