import { apiFetch } from "@/lib/safe-fetch";
import type { Place } from "./place-panel-types";

export const PLACE_SPINE_NEAR_RADIUS_M = 50;

/** Fetch full Overture spine row for PlacePanel second pass. */
export async function fetchPlaceSpineDetail(gersId: string): Promise<Place> {
  const encoded = encodeURIComponent(gersId.trim());
  return apiFetch<Place>(`/places/spine/${encoded}`);
}

/** Nearest Postgres spine row when map tiles lack gers_id (OSM / public basemap picks). */
export async function fetchPlaceSpineNear(
  lat: number,
  lon: number,
  radiusMeters = PLACE_SPINE_NEAR_RADIUS_M,
): Promise<Place> {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lon),
    radius_meters: String(radiusMeters),
  });
  return apiFetch<Place>(`/places/spine/near?${params.toString()}`);
}
