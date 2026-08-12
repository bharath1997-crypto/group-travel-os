/** Session-only reverse-geocode cache for map taps (Google Maps–style instant re-tap). */

import { isGenericPlaceName } from "@/lib/wayra/place-region";

export type TapGeocodeCacheEntry = {
  name: string;
  categoryLabel: string;
  address: string;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  placeKey?: string | null;
  osmType?: string | null;
  osmId?: number | null;
  cachedAt: number;
};

const MAX_ENTRIES = 96;
const TTL_MS = 45 * 60 * 1000;

const cache = new Map<string, TapGeocodeCacheEntry>();

function roundCoord(value: number): number {
  return Math.round(value * 100000) / 100000;
}

export function tapGeocodeCacheKey(lat: number, lng: number): string {
  return `${roundCoord(lat)},${roundCoord(lng)}`;
}

export function getTapGeocodeCache(
  lat: number,
  lng: number,
): TapGeocodeCacheEntry | null {
  const key = tapGeocodeCacheKey(lat, lng);
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.cachedAt > TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit;
}

/** Ignore cache entries that never resolved beyond a generic dropped pin. */
export function isUsableTapGeocodeCache(entry: TapGeocodeCacheEntry): boolean {
  if (isGenericPlaceName(entry.name)) return false;
  return entry.categoryLabel.trim().toLowerCase() !== "dropped pin";
}

export function setTapGeocodeCache(
  lat: number,
  lng: number,
  entry: Omit<TapGeocodeCacheEntry, "cachedAt">,
): void {
  const key = tapGeocodeCacheKey(lat, lng);
  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { ...entry, cachedAt: Date.now() });
}
