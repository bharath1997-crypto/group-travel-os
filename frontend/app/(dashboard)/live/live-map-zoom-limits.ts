import type { Map as MaplibreMap } from "maplibre-gl";
import {
  getLiveMapMaxZoom,
  LIVE_MAP_CLEAN_TRAVEL_MAX_ZOOM,
  LIVE_MAP_HYBRID_MAX_ZOOM,
  LIVE_MAP_MIN_ZOOM,
  LIVE_MAP_VECTOR_MAX_ZOOM,
  type LiveMapLayer,
} from "@/lib/map-providers";
import { mapSupportsLabelSearch } from "./live-map-labels";

export const LIVE_MAP_HYBRID_IMAGERY_LAYER_ID = "esri-imagery";
/** Float-safe comparison for fractional max zoom (e.g. 16.5). */
export const LIVE_MAP_ZOOM_CAP_EPSILON = 0.001;

export type LiveMapZoomContext = {
  travelLayerEnabled?: boolean;
};

export function mapUsesHybridRasterStack(map: MaplibreMap | null | undefined): boolean {
  if (!map) return false;
  try {
    return !!map.getLayer(LIVE_MAP_HYBRID_IMAGERY_LAYER_ID);
  } catch {
    return false;
  }
}

/** Effective max zoom for the loaded style (vector fallbacks cap at z14). */
export function resolveLiveMapMaxZoom(
  map: MaplibreMap | null | undefined,
  layer: LiveMapLayer,
  context: LiveMapZoomContext = {},
): number {
  const travelOn = context.travelLayerEnabled === true;

  if (layer === "clean") {
    if (travelOn) return LIVE_MAP_CLEAN_TRAVEL_MAX_ZOOM;
    return getLiveMapMaxZoom("clean");
  }

  if (layer === "street" && mapSupportsLabelSearch(map)) {
    return travelOn ? LIVE_MAP_CLEAN_TRAVEL_MAX_ZOOM : LIVE_MAP_VECTOR_MAX_ZOOM;
  }

  if (layer === "hybrid") {
    if (mapUsesHybridRasterStack(map)) return LIVE_MAP_HYBRID_MAX_ZOOM;
    if (mapSupportsLabelSearch(map)) {
      return travelOn ? LIVE_MAP_CLEAN_TRAVEL_MAX_ZOOM : LIVE_MAP_VECTOR_MAX_ZOOM;
    }
    return LIVE_MAP_HYBRID_MAX_ZOOM;
  }

  if (layer === "satellite" || layer === "terrain") {
    return getLiveMapMaxZoom(layer);
  }

  return getLiveMapMaxZoom(layer, { travelLayerEnabled: travelOn });
}

export function isAtLiveMapMaxZoom(
  zoom: number,
  map: MaplibreMap | null | undefined,
  layer: LiveMapLayer,
  context: LiveMapZoomContext = {},
): boolean {
  return zoom >= resolveLiveMapMaxZoom(map, layer, context) - LIVE_MAP_ZOOM_CAP_EPSILON;
}

/** Set min/max zoom on the map and snap back if the camera is past the cap. */
export function applyLiveMapZoomLimits(
  map: MaplibreMap,
  layer: LiveMapLayer,
  context: LiveMapZoomContext = {},
): number {
  const maxZoom = resolveLiveMapMaxZoom(map, layer, context);
  map.setMinZoom(LIVE_MAP_MIN_ZOOM);
  map.setMaxZoom(maxZoom);
  if (map.getZoom() > maxZoom + LIVE_MAP_ZOOM_CAP_EPSILON) {
    map.setZoom(maxZoom);
  }
  return maxZoom;
}

/** Lightweight clamp during scroll/pinch — do not reset maxZoom every frame. */
export function enforceLiveMapZoomCap(
  map: MaplibreMap,
  layer: LiveMapLayer,
  context: LiveMapZoomContext = {},
): void {
  const maxZoom = resolveLiveMapMaxZoom(map, layer, context);
  if (map.getZoom() > maxZoom + LIVE_MAP_ZOOM_CAP_EPSILON) {
    map.setZoom(maxZoom);
  }
}

export function clampLiveMapZoom(
  zoom: number,
  map: MaplibreMap | null | undefined,
  layer: LiveMapLayer,
  context: LiveMapZoomContext = {},
): number {
  const maxZoom = resolveLiveMapMaxZoom(map, layer, context);
  return Math.min(maxZoom, Math.max(LIVE_MAP_MIN_ZOOM, zoom));
}
