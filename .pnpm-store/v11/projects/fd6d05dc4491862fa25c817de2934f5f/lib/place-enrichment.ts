import { apiFetch } from "@/lib/api";

export type DrivingRoute = {
  distance_miles: number;
  duration_minutes: number;
  polyline: [number, number][];
};

export type PlaceEnrichment = {
  event_id: string;
  formatted_address?: string;
  street?: string;
  city?: string;
  state?: string;
  postcode?: string;
  image_url?: string | null;
  description?: string;
  wikipedia_url?: string;
  route?: DrivingRoute;
  cached?: boolean;
  fetched_at?: string;
};

const SESSION_PREFIX = "rovvy_place_enrich_";

function sessionKey(id: string): string {
  return `${SESSION_PREFIX}${id}`;
}

/** Per-tab cache — cleared when the browser tab/session ends. */
export function getCachedPlaceEnrichment(id: string): PlaceEnrichment | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(sessionKey(id));
    if (!raw) return null;
    return JSON.parse(raw) as PlaceEnrichment;
  } catch {
    return null;
  }
}

export function setCachedPlaceEnrichment(id: string, data: PlaceEnrichment): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(sessionKey(id), JSON.stringify(data));
  } catch {
    /* quota exceeded — ignore */
  }
}

export async function fetchPlaceEnrichment(
  place: {
    id: string;
    name?: string;
    venue_lat?: number | null;
    lat?: number;
    venue_lon?: number | null;
    lng?: number;
  },
  origin?: { lat: number; lng: number } | null,
): Promise<PlaceEnrichment> {
  const lat = place.venue_lat ?? place.lat;
  const lon = place.venue_lon ?? place.lng;
  if (lat == null || lon == null) {
    return { event_id: place.id };
  }

  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    name: place.name || "",
  });
  if (origin) {
    params.set("origin_lat", String(origin.lat));
    params.set("origin_lon", String(origin.lng));
  }

  return apiFetch<PlaceEnrichment>(
    `/explore/places/${encodeURIComponent(place.id)}/enrich?${params.toString()}`,
    {},
    20000,
  );
}

/** Merge enrichment fields onto a map/list place object. */
export function mergePlaceEnrichment<T extends Record<string, unknown>>(
  place: T,
  enrichment: PlaceEnrichment,
): T & PlaceEnrichment {
  return {
    ...place,
    ...enrichment,
    formatted_address: enrichment.formatted_address || (place.formatted_address as string | undefined),
    city:
      enrichment.city && enrichment.city !== "Unknown"
        ? enrichment.city
        : (place.city as string | undefined),
    state: enrichment.state || (place.state as string | undefined),
    image_url: enrichment.image_url || (place.image_url as string | null | undefined) || undefined,
  };
}
