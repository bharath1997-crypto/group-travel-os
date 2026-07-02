/** Stable placeKey for lazy registry + media lookups. Mirrors backend place_key_service. */

const OSM_TYPES = new Set(["node", "way", "relation"]);

function normalizePlaceToken(value: string | null | undefined, maxLen = 80): string {
  if (!value?.trim()) return "unknown";
  const s = value
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return (s.slice(0, maxLen) || "unknown");
}

export type PlaceKeyInput = {
  name: string;
  lat: number;
  lng: number;
  city?: string | null;
  country?: string | null;
  osmType?: string | null;
  osmId?: number | null;
};

export function buildPlaceKey(input: PlaceKeyInput): string {
  const osmType = input.osmType?.trim().toLowerCase();
  if (osmType && OSM_TYPES.has(osmType) && input.osmId != null) {
    return `osm:${osmType}:${Math.trunc(input.osmId)}`;
  }

  const normName = normalizePlaceToken(input.name, 80);
  const rlat = Number(input.lat.toFixed(4));
  const rlng = Number(input.lng.toFixed(4));
  const city = normalizePlaceToken(input.city, 60);
  const country = normalizePlaceToken(input.country, 60);
  return `source:${normName}:${rlat}:${rlng}:${city}:${country}`;
}

export function extractCityCountry(address?: Record<string, string>): {
  city?: string;
  country?: string;
} {
  if (!address) return {};
  const city =
    address.city ||
    address.town ||
    address.village ||
    address.municipality ||
    address.county;
  const country = address.country;
  return { city, country };
}
