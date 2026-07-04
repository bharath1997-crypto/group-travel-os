/**
 * Route Intelligence API client.
 *
 * Calls backend /api/v1/route-intelligence/explain — gets structured options
 * + Rovi AI explanation in one round-trip.
 *
 * Never sends raw OSM data. Only compact location summaries.
 */

import { apiFetch } from "@/lib/api";
import type {
  LocationSummary,
  RouteIntelligenceRequest,
  RouteIntelligenceResponse,
} from "./route-intelligence-types";
import type { PlacePreviewData } from "./PlacePreviewCard";

/**
 * Resolve route options + ask Rovi to explain them.
 * Uses the /explain endpoint — single backend call.
 */
export async function fetchRouteIntelligence(
  origin: LocationSummary,
  destination: LocationSummary,
  userPreference?: string,
): Promise<RouteIntelligenceResponse> {
  const body: RouteIntelligenceRequest = {
    origin,
    destination,
    ...(userPreference ? { userPreference } : {}),
  };

  return apiFetch<RouteIntelligenceResponse>("/route-intelligence/explain", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/**
 * Build a compact LocationSummary from a PlacePreviewData.
 * Only sends name, country, lat, lng — no raw OSM properties.
 */
export function placeToLocationSummary(place: PlacePreviewData): LocationSummary {
  return {
    name: place.name,
    country: place.country ?? undefined,
    lat: place.lat,
    lng: place.lng,
  };
}

/**
 * Build a LocationSummary from GPS + reverse-geocoded user region.
 */
export function userRegionToLocationSummary(region: {
  lat?: number;
  lng?: number;
  city?: string;
  state?: string;
  country?: string;
} | null, fallback: { lat: number; lng: number } | null): LocationSummary | null {
  const lat = region?.lat ?? fallback?.lat;
  const lng = region?.lng ?? fallback?.lng;
  if (lat == null || lng == null) return null;

  const nameParts = [region?.city, region?.state].filter(Boolean);
  const name = nameParts.length > 0 ? nameParts.join(", ") : "Current location";

  return {
    name,
    country: region?.country ?? undefined,
    lat,
    lng,
  };
}
