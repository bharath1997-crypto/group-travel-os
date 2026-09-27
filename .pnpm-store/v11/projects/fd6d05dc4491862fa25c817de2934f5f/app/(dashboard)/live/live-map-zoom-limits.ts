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

export function isAtLiveMapMinZoom(
  zoom: number,
  minZoom: number = LIVE_MAP_MIN_ZOOM,
): boolean {
  return zoom <= minZoom + LIVE_MAP_ZOOM_CAP_EPSILON;
}

export type LiveMapZoomInButtonLevel = "normal" | "approaching" | "max";
export type LiveMapZoomOutButtonLevel = "normal" | "min";

/** Yellow → red on + as the user nears the layer cap. */
export function liveMapZoomInButtonLevel(
  zoom: number,
  maxZoom: number,
  minZoom: number = LIVE_MAP_MIN_ZOOM,
): LiveMapZoomInButtonLevel {
  const z = Math.min(maxZoom, Math.max(minZoom, zoom));
  if (z >= maxZoom - LIVE_MAP_ZOOM_CAP_EPSILON) return "max";
  const span = Math.max(maxZoom - minZoom, 0.001);
  const progress = (z - minZoom) / span;
  if (progress >= 0.82 || z >= maxZoom - 1.25) return "approaching";
  return "normal";
}

export function liveMapZoomOutButtonLevel(
  zoom: number,
  minZoom: number = LIVE_MAP_MIN_ZOOM,
): LiveMapZoomOutButtonLevel {
  const z = Math.max(minZoom, zoom);
  if (z <= minZoom + LIVE_MAP_ZOOM_CAP_EPSILON) return "min";
  return "normal";
}

export function clampLiveMapZoomValue(
  zoom: number,
  minZoom: number,
  maxZoom: number,
): number {
  return Math.min(maxZoom, Math.max(minZoom, zoom));
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
  const clamped = clampLiveMapZoomValue(map.getZoom(), LIVE_MAP_MIN_ZOOM, maxZoom);
  if (Math.abs(map.getZoom() - clamped) > LIVE_MAP_ZOOM_CAP_EPSILON) {
    map.setZoom(clamped);
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
  const minZoom = LIVE_MAP_MIN_ZOOM;
  const z = map.getZoom();
  if (z > maxZoom + LIVE_MAP_ZOOM_CAP_EPSILON) {
    map.setZoom(maxZoom);
  } else if (z < minZoom - LIVE_MAP_ZOOM_CAP_EPSILON) {
    map.setZoom(minZoom);
  }
}

export function clampLiveMapZoom(
  zoom: number,
  map: MaplibreMap | null | undefined,
  layer: LiveMapLayer,
  context: LiveMapZoomContext = {},
): number {
  const maxZoom = resolveLiveMapMaxZoom(map, layer, context);
  return clampLiveMapZoomValue(zoom, LIVE_MAP_MIN_ZOOM, maxZoom);
}

const LIVE_MAP_FALLBACK_BG = "#d4dde4";

/** Prevent blank canvas when raster/vector tiles end before the view zoom. */
export function ensureLiveMapFallbackBackground(map: MaplibreMap): void {
  try {
    if (map.getLayer("rovvy-map-background")) return;
    const beforeId = map.getStyle()?.layers?.[0]?.id;
    map.addLayer(
      {
        id: "rovvy-map-background",
        type: "background",
        paint: { "background-color": LIVE_MAP_FALLBACK_BG },
      },
      beforeId,
    );
  } catch {
    // Style still loading — caller retries on idle/style.load
  }
}
