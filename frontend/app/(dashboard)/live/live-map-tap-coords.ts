import type { Map as MaplibreMap, PointLike } from "maplibre-gl";

import { haversineM } from "@/lib/geo";

import { isLiveGlobeViewZoom, LIVE_GLOBE_VIEW_MAX_ZOOM } from "./live-map-globe";

export type MapTapScreenPoint = { x: number; y: number };

function normalizeLngNearCenter(lng: number, centerLng: number): number {
  let adjusted = lng;
  while (adjusted - centerLng > 180) adjusted -= 360;
  while (adjusted - centerLng < -180) adjusted += 360;
  return adjusted;
}

/** Reject taps that unproject to the far side of the planet while zoomed in locally. */
export function isLikelyBacksideMapTap(
  tap: { lat: number; lng: number },
  mapCenter: { lat: number; lng: number },
  zoom: number,
): boolean {
  if (zoom <= LIVE_GLOBE_VIEW_MAX_ZOOM) return false;

  const lng = normalizeLngNearCenter(tap.lng, mapCenter.lng);
  const distM = haversineM(mapCenter.lat, mapCenter.lng, tap.lat, lng);
  const maxReasonableM =
    zoom >= 14 ? 400_000 : zoom >= 11 ? 1_200_000 : zoom >= 8 ? 3_000_000 : 8_000_000;

  return distM > maxReasonableM;
}

/**
 * Resolve a screen tap to map coordinates.
 * Globe projection can return the back side of the earth on mobile; clamp/normalize when needed.
 */
export function resolveMapTapLngLat(
  map: MaplibreMap,
  screenPoint: MapTapScreenPoint,
  eventLngLat?: { lat: number; lng: number } | null,
): { lat: number; lng: number } | null {
  const point: PointLike = [screenPoint.x, screenPoint.y];
  let lat: number;
  let lng: number;

  try {
    const unprojected = map.unproject(point);
    lat = unprojected.lat;
    lng = unprojected.lng;
  } catch {
    if (!eventLngLat) return null;
    lat = eventLngLat.lat;
    lng = eventLngLat.lng;
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return eventLngLat ?? null;
  }

  const center = map.getCenter();
  const zoom = map.getZoom();
  lng = normalizeLngNearCenter(lng, center.lng);

  if (isLikelyBacksideMapTap({ lat, lng }, center, zoom)) {
    if (eventLngLat) {
      const eventLng = normalizeLngNearCenter(eventLngLat.lng, center.lng);
      if (!isLikelyBacksideMapTap({ lat: eventLngLat.lat, lng: eventLng }, center, zoom)) {
        return { lat: eventLngLat.lat, lng: eventLng };
      }
    }
    return null;
  }

  if (eventLngLat && isLiveGlobeViewZoom(zoom)) {
    const eventLng = normalizeLngNearCenter(eventLngLat.lng, center.lng);
    const unprojectDist = haversineM(center.lat, center.lng, lat, lng);
    const eventDist = haversineM(center.lat, center.lng, eventLngLat.lat, eventLng);
    if (eventDist + 500 < unprojectDist) {
      return { lat: eventLngLat.lat, lng: eventLng };
    }
  }

  return { lat, lng };
}
