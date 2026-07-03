import { haversineM } from "@/lib/geo";
import { apiFetch } from "@/lib/api";

const GEO_CACHE_TTL_MS = 8 * 60 * 1000;
const GEO_CACHE_MAX = 200;

type CacheEntry<T> = { at: number; data: T };

const searchResultCache = new Map<string, CacheEntry<LiveGeocodingSearchResult[]>>();
const reverseResultCache = new Map<string, CacheEntry<LiveGeocodingReverseResult | null>>();

function readCache<T>(cache: Map<string, CacheEntry<T>>, key: string): T | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > GEO_CACHE_TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  return hit.data;
}

function writeCache<T>(cache: Map<string, CacheEntry<T>>, key: string, data: T) {
  cache.set(key, { at: Date.now(), data });
  if (cache.size <= GEO_CACHE_MAX) return;
  const oldestKey = [...cache.entries()].sort((a, b) => a[1].at - b[1].at)[0]?.[0];
  if (oldestKey) cache.delete(oldestKey);
}

export type LiveGeocodingSearchResult = {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  type?: string;
  class?: string;
  name?: string;
  osm_type?: string;
  osm_id?: number;
  address?: Record<string, string>;
};

export type LiveGeocodingReverseResult = {
  display_name: string;
  name?: string;
  type?: string;
  class?: string;
  osm_type?: string;
  osm_id?: number;
  address?: Record<string, string>;
  extratags?: Record<string, string>;
  lat?: number;
  lng?: number;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  placeKey?: string | null;
  source?: string;
};

export type SearchBias = {
  lat: number;
  lng: number;
};

export type AutocompleteResult = {
  id: string;
  placeKey: string;
  name: string;
  category: string;
  address: string;
  lat: number;
  lng: number;
  distanceMeters: number | null;
  distanceLabel: string | null;
  source: string;
  matchType: string;
  score: number;
  tags: Record<string, string>;
};

export async function liveAutocompleteSearch(
  query: string,
  bias?: SearchBias | null,
  abortSignal?: AbortSignal,
): Promise<AutocompleteResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const params = new URLSearchParams({ q });
  if (bias) {
    params.set("lat", String(bias.lat));
    params.set("lng", String(bias.lng));
  }

  try {
    // Note: If apiFetch supports abort signals, pass it; otherwise omit it
    const data = await apiFetch<{ results: AutocompleteResult[] }>(
      `/places/autocomplete?${params.toString()}`,
      abortSignal ? { signal: abortSignal } : undefined
    );
    return data?.results || [];
  } catch (err: any) {
    if (err.name === 'AbortError') throw err;
    return [];
  }
}

function searchCacheKey(query: string, bias?: SearchBias | null): string {
  const q = query.trim().toLowerCase();
  if (!bias) return q;
  return `${q}@${bias.lat.toFixed(3)},${bias.lng.toFixed(3)}`;
}

export async function liveGeocodingSearch(
  query: string,
  bias?: SearchBias | null,
): Promise<LiveGeocodingSearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const cacheKey = searchCacheKey(q, bias);
  const cached = readCache(searchResultCache, cacheKey);
  if (cached) return cached;

  const params = new URLSearchParams({ q });
  if (bias) {
    params.set("lat", String(bias.lat));
    params.set("lng", String(bias.lng));
  }

  try {
    const rows = await apiFetch<LiveGeocodingSearchResult[]>(
      `/geocoding/search?${params.toString()}`,
    );
    const data = rankSearchResults(Array.isArray(rows) ? rows : [], bias);
    writeCache(searchResultCache, cacheKey, data);
    return data;
  } catch {
    return [];
  }
}

export async function liveGeocodingReverse(
  lat: number,
  lng: number,
): Promise<LiveGeocodingReverseResult | null> {
  const cacheKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;
  const cached = readCache(reverseResultCache, cacheKey);
  if (cached !== undefined) return cached;

  try {
    const data = await apiFetch<LiveGeocodingReverseResult>(
      `/geocoding/reverse?lat=${lat}&lng=${lng}`,
    );
    const result = data && Object.keys(data).length > 0 ? data : null;
    writeCache(reverseResultCache, cacheKey, result);
    return result;
  } catch {
    return null;
  }
}

export function rankSearchResults(
  results: LiveGeocodingSearchResult[],
  bias?: SearchBias | null,
): LiveGeocodingSearchResult[] {
  if (!bias || results.length <= 1) return results;

  return [...results].sort((a, b) => {
    const aLat = parseFloat(a.lat);
    const aLng = parseFloat(a.lon);
    const bLat = parseFloat(b.lat);
    const bLng = parseFloat(b.lon);
    const aDist = haversineM(bias.lat, bias.lng, aLat, aLng);
    const bDist = haversineM(bias.lat, bias.lng, bLat, bLng);
    return aDist - bDist;
  });
}

export function pickNearestSearchResult(
  results: LiveGeocodingSearchResult[],
  bias?: SearchBias | null,
): LiveGeocodingSearchResult | null {
  if (results.length === 0) return null;
  return rankSearchResults(results, bias)[0] ?? null;
}

export function searchResultDistanceM(
  result: LiveGeocodingSearchResult,
  bias?: SearchBias | null,
): number | null {
  if (!bias) return null;
  const lat = parseFloat(result.lat);
  const lng = parseFloat(result.lon);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return haversineM(bias.lat, bias.lng, lat, lng);
}

export function formatSearchLocationContext(result: LiveGeocodingSearchResult): string {
  const addr = result.address;
  if (addr) {
    const city =
      addr.city || addr.town || addr.village || addr.municipality || addr.county;
    const state = addr.state;
    const country = addr.country;
    if (city && state) return `${city}, ${state}`;
    if (city && country) return `${city}, ${country}`;
    if (state && country) return `${state}, ${country}`;
    if (country) return country;
  }

  const parts = result.display_name.split(",").map((part) => part.trim());
  if (parts.length >= 3) return parts.slice(1, 3).join(", ");
  if (parts.length >= 2) return parts.slice(1).join(", ");
  return "";
}

export function formatSearchResultSubtitle(
  result: LiveGeocodingSearchResult,
  bias?: SearchBias | null,
): string {
  const context = formatSearchLocationContext(result);
  const distanceM = searchResultDistanceM(result, bias);
  const parts: string[] = [];
  if (context) parts.push(context);
  if (distanceM != null) {
    const miles = distanceM / 1609.34;
    if (miles < 0.1) parts.push(`${Math.round(distanceM)} m away`);
    else parts.push(`${miles.toFixed(1)} mi away`);
  }
  return parts.join(" · ");
}

export function normalizePlaceCategory(item: any): string | null {
  if (!item) return null;
  const p = item.properties || item.tags || item;

  // 1. amenity
  if (p.amenity) {
    const val = p.amenity;
    if (val === "fuel") return "Gas station";
    if (val === "restaurant") return "Restaurant";
    if (val === "fast_food") return "Fast food";
    if (val === "cafe") return "Cafe";
    if (val === "bar") return "Bar";
    if (val === "pub") return "Pub";
    if (val === "cinema") return "Cinema";
    if (val === "hospital") return "Hospital";
    if (val === "clinic") return "Clinic";
    if (val === "pharmacy") return "Pharmacy";
    if (val === "parking") return "Parking";
    if (val === "bank") return "Bank";
    if (val === "atm") return "ATM";
    if (val === "place_of_worship") {
      const religion = String(p.religion || "").toLowerCase();
      if (religion === "christian") return "Church";
      if (religion === "muslim") return "Mosque";
      if (religion === "jewish") return "Synagogue";
      if (religion === "hindu") return "Temple";
      return "Place of worship";
    }
    if (val === "school") return "School";
    if (val === "college") return "College";
    if (val === "university") return "University";
    if (val === "library") return "Library";
    if (val === "toilets") return "Restroom";
    return val.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
  }

  // 2. shop
  if (p.shop) {
    const val = p.shop;
    if (val === "alcohol") return "Liquor store";
    if (val === "beverages") return "Beverage store";
    if (val === "convenience") return "Convenience store";
    if (val === "supermarket") return "Supermarket";
    if (val === "mobile_phone") return "Mobile phone store";
    if (val === "clothes") return "Clothing store";
    if (val === "bakery") return "Bakery";
    if (val === "coffee") return "Coffee shop";
    return val.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
  }

  // 3. tourism
  if (p.tourism) {
    const val = p.tourism;
    if (val === "hotel") return "Hotel";
    if (val === "motel") return "Motel";
    if (val === "attraction") return "Attraction";
    if (val === "museum") return "Museum";
    if (val === "gallery") return "Gallery";
    return val.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
  }

  // 4. leisure
  if (p.leisure) {
    const val = p.leisure;
    if (val === "park") return "Park";
    if (val === "fitness_centre" || val === "fitness_center") return "Fitness center";
    if (val === "sports_centre" || val === "sports_center") return "Sports center";
    return val.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
  }

  // 5. healthcare
  if (p.healthcare) {
    const val = p.healthcare;
    if (val === "hospital") return "Hospital";
    if (val === "clinic") return "Clinic";
    if (val === "pharmacy") return "Pharmacy";
    return val.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
  }

  // 6. public_transport / highway
  if (p.highway === "bus_stop") return "Bus stop";
  if (p.public_transport === "platform") return "Transit stop";

  // 7. class/type/category
  const c = p.class || p.type || p.category;
  if (c) {
    const val = String(c).toLowerCase().replace(/_/g, " ");
    if (val === "fuel" || val === "gas station") return "Gas station";
    if (val === "restaurant") return "Restaurant";
    if (val === "fast food") return "Fast food";
    if (val === "cafe" || val === "coffee") return "Cafe";
    if (val === "bar") return "Bar";
    if (val === "pub") return "Pub";
    if (val === "cinema") return "Cinema";
    if (val === "hospital") return "Hospital";
    if (val === "clinic") return "Clinic";
    if (val === "pharmacy") return "Pharmacy";
    if (val === "parking") return "Parking";
    if (val === "bank") return "Bank";
    if (val === "atm") return "ATM";
    if (val === "place of worship") {
      const religion = String(p.religion || "").toLowerCase();
      if (religion === "christian") return "Church";
      if (religion === "muslim") return "Mosque";
      if (religion === "jewish") return "Synagogue";
      if (religion === "hindu") return "Temple";
      return "Place of worship";
    }
    if (val === "school") return "School";
    if (val === "college") return "College";
    if (val === "university") return "University";
    if (val === "library") return "Library";
    if (val === "toilets" || val === "restroom") return "Restroom";
    if (val === "hotel") return "Hotel";
    if (val === "motel") return "Motel";
    if (val === "attraction") return "Attraction";
    if (val === "museum") return "Museum";
    if (val === "gallery") return "Gallery";
    if (val === "park") return "Park";
    if (val === "fitness centre" || val === "fitness center") return "Fitness center";
    if (val === "sports centre" || val === "sports center") return "Sports center";
    if (val === "bus stop") return "Bus stop";
    if (val === "platform" || val === "transit stop") return "Transit stop";
    if (val === "alcohol" || val === "liquor store") return "Liquor store";
    if (val === "beverages" || val === "beverage store") return "Beverage store";
    if (val === "convenience" || val === "convenience store") return "Convenience store";
    if (val === "supermarket") return "Supermarket";
    if (val === "mobile phone" || val === "mobile phone store") return "Mobile phone store";
    if (val === "clothes" || val === "clothing store") return "Clothing store";
    if (val === "bakery") return "Bakery";
    if (val === "coffee shop") return "Coffee shop";

    return val.replace(/\b\w/g, (char) => char.toUpperCase());
  }

  return null;
}
