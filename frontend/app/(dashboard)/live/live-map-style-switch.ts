import type { Map as MaplibreMap } from "maplibre-gl";
import type { LiveMapLayer } from "@/lib/map-providers";

/** Basemap layer ids used to verify the rendered style matches the selected layer. */
export const LIVE_MAP_BASE_LAYER_MARKERS: Partial<Record<LiveMapLayer, string>> = {
  street: "osm-tiles",
  satellite: "esri-tiles",
  terrain: "esri-topo-tiles",
  dark: "carto-tiles",
  hybrid: "esri-imagery",
};

export function detectLiveMapBaseLayer(map: MaplibreMap | null | undefined): LiveMapLayer | null {
  if (!map) return null;
  try {
    if (!map.isStyleLoaded()) return null;
  } catch {
    return null;
  }

  for (const [layer, markerId] of Object.entries(LIVE_MAP_BASE_LAYER_MARKERS) as [
    LiveMapLayer,
    string,
  ][]) {
    if (map.getLayer(markerId)) return layer;
  }

  // Clean map uses an external vector style — no stable marker id.
  const sources = map.getStyle()?.sources ?? {};
  if (sources.openmaptiles || sources.basemap) return "clean";

  return null;
}

export function liveMapBaseLayerMatches(
  map: MaplibreMap | null | undefined,
  expected: LiveMapLayer,
): boolean {
  const detected = detectLiveMapBaseLayer(map);
  if (detected === expected) return true;
  // Clean map style URLs vary; treat unknown vector styles as clean when requested.
  if (expected === "clean" && detected === null) {
    try {
      return !!map?.isStyleLoaded();
    } catch {
      return false;
    }
  }
  return false;
}

export type LiveMapStyleSwitchSession = {
  generation: number;
  targetLayer: LiveMapLayer;
  cancel: () => void;
};

/**
 * Apply a basemap style and invoke `onReady` only when this request is still current.
 * Stale style.load / idle handlers from rapid layer changes are ignored.
 */
export function beginLiveMapStyleSwitch(
  map: MaplibreMap,
  targetLayer: LiveMapLayer,
  style: Parameters<MaplibreMap["setStyle"]>[0],
  onReady: (map: MaplibreMap, layer: LiveMapLayer) => void,
  options?: {
    getGeneration?: () => number;
    bumpGeneration?: () => number;
    onTransitionStart?: () => void;
  },
): LiveMapStyleSwitchSession {
  const bumpGeneration =
    options?.bumpGeneration ??
    (() => {
      liveMapStyleSwitchGeneration += 1;
      return liveMapStyleSwitchGeneration;
    });
  const getGeneration = options?.getGeneration ?? (() => liveMapStyleSwitchGeneration);

  const generation = bumpGeneration();
  options?.onTransitionStart?.();

  let cancelled = false;
  let idleHandler: (() => void) | null = null;
  let styleLoadHandler: (() => void) | null = null;
  let verifyTimer: ReturnType<typeof setTimeout> | null = null;

  const cancel = () => {
    cancelled = true;
    if (styleLoadHandler) map.off("style.load", styleLoadHandler);
    if (idleHandler) map.off("idle", idleHandler);
    if (verifyTimer) clearTimeout(verifyTimer);
    styleLoadHandler = null;
    idleHandler = null;
    verifyTimer = null;
  };

  const finish = () => {
    if (cancelled || generation !== getGeneration()) return;
    if (!liveMapBaseLayerMatches(map, targetLayer)) return;
    onReady(map, targetLayer);
  };

  styleLoadHandler = () => {
    if (cancelled || generation !== getGeneration()) return;
    // Restore overlays as soon as the style spec is ready — do not wait for all tiles.
    finish();
    // Some raster sources finish registering layers after the first idle pass.
    idleHandler = () => {
      if (cancelled || generation !== getGeneration()) return;
      finish();
    };
    map.once("idle", idleHandler);
  };

  map.once("style.load", styleLoadHandler);
  map.setStyle(style, { diff: false });

  // If style.load never fires (interrupted switch), retry once on the latest request.
  verifyTimer = setTimeout(() => {
    if (cancelled || generation !== getGeneration()) return;
    if (liveMapBaseLayerMatches(map, targetLayer)) {
      finish();
      return;
    }
    map.setStyle(style, { diff: false });
  }, 1200);

  return { generation, targetLayer, cancel };
}

let liveMapStyleSwitchGeneration = 0;

export function resetLiveMapStyleSwitchGenerationForTests(): void {
  liveMapStyleSwitchGeneration = 0;
}
