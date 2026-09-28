/** Overture `/explore/places` request helpers for the main hub. */

export type ExplorePlaceRow = {
  id: string;
  gers_id?: string;
  name: string;
  address?: string;
  category?: string;
  lat?: number | null;
  lng?: number | null;
  image_url?: string | null;
  source?: string | null;
  source_label?: string | null;
  url?: string | null;
  opening_hours?: string | null;
  hours_source?: string | null;
  confidence?: number | null;
  distance_m?: number | null;
};

export const EXPLORE_PLACES_LIMIT = 48;
export const EXPLORE_PLACES_MAX_RADIUS_M = 100_000;

export function explorePlacesQuery(cityLabel: string, coords?: { lat: number; lng: number }): string {
  const params = new URLSearchParams({
    city: cityLabel,
    limit: String(EXPLORE_PLACES_LIMIT),
  });
  if (coords) {
    params.set("lat", String(coords.lat));
    params.set("lon", String(coords.lng));
    const radiusM = Math.min(Math.round(200 * 1609.344), EXPLORE_PLACES_MAX_RADIUS_M);
    params.set("radius_m", String(radiusM));
  }
  return params.toString();
}

export function placeSourceLabel(place: ExplorePlaceRow): string {
  const raw = (place.source || "").toLowerCase();
  if (raw === "overture" || place.gers_id) return place.source_label?.trim() || "Overture";
  if (raw.includes("foursquare")) return "Foursquare";
  if (raw.includes("osm") || place.id.startsWith("osm-")) return "OpenStreetMap";
  return "Venue listing";
}

export function uniquePlacesByGersId(places: ExplorePlaceRow[]): ExplorePlaceRow[] {
  const seen = new Set<string>();
  return places.filter((place) => {
    const key = (place.gers_id || place.id || "").trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function slotIdentityForPlace(place: ExplorePlaceRow): string {
  return place.gers_id || place.id;
}
