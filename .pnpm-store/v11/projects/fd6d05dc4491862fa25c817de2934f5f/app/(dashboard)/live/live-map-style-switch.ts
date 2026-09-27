import type { Map as MaplibreMap } from "maplibre-gl";
import { isCartoBasemapConfigured, type LiveMapLayer } from "@/lib/map-providers";

/** Basemap layer ids used to verify raster styles after switch. */
export const LIVE_MAP_BASE_LAYER_MARKERS: Partial<Record<LiveMapLayer, string>> = {
  street: "osm-tiles",
  satellite: "esri-tiles",
  terrain: "esri-topo-tiles",
  dark: "carto-tiles",
  hybrid: "esri-imagery",
};

/** Authoritative layer after setStyle — vector URL styles share openmaptiles and cannot be detected otherwise. */
const appliedBasemapLayer = new WeakMap<MaplibreMap, LiveMapLayer>();

export function setLiveMapAppliedBasemapLayer(
  map: MaplibreMap,
  layer: LiveMapLayer,
): void {
  appliedBasemapLayer.set(map, layer);
}

export function getLiveMapAppliedBasemapLayer(
  map: MaplibreMap,
): LiveMapLayer | null {
  return appliedBasemapLayer.get(map) ?? null;
}

function mapHasStyleSpec(map: MaplibreMap): boolean {
  try {
    return Boolean(map.getStyle());
  } catch {
    return false;
  }
}

function isLiveMapStyleReady(map: MaplibreMap): boolean {
  try {
    return mapHasStyleSpec(map) && Boolean(map.isStyleLoaded());
  } catch {
    return false;
  }
}

export function detectLiveMapBaseLayer(map: MaplibreMap | null | undefined): LiveMapLayer | null {
  if (!map) return null;

  const applied = getLiveMapAppliedBasemapLayer(map);
  if (applied) return applied;

  try {
    if (!mapHasStyleSpec(map) || !map.isStyleLoaded()) return null;
  } catch {
    return null;
  }

  for (const [layer, markerId] of Object.entries(LIVE_MAP_BASE_LAYER_MARKERS) as [
    LiveMapLayer,
    string,
  ][]) {
    if (map.getLayer(markerId)) return layer;
  }

  const sources = map.getStyle()?.sources ?? {};
  if (sources.openmaptiles || sources.basemap) return "clean";

  return null;
}

export function liveMapBaseLayerMatches(
  map: MaplibreMap | null | undefined,
  expected: LiveMapLayer,
): boolean {
  if (!map) return false;

  const applied = getLiveMapAppliedBasemapLayer(map);
  if (applied === expected) return true;

  const detected = detectLiveMapBaseLayer(map);
  if (detected === expected) return true;

  // Dark falls back to clean vector when CARTO key is missing.
  if (
    !isCartoBasemapConfigured() &&
    expected === "dark" &&
    (applied === "clean" || detected === "clean")
  ) {
    return true;
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
  setLiveMapAppliedBasemapLayer(map, targetLayer);

  let cancelled = false;
  let idleHandler: (() => void) | null = null;
  let styleLoadHandler: (() => void) | null = null;
  let verifyTimer: ReturnType<typeof setTimeout> | null = null;
  let forceFinishTimer: ReturnType<typeof setTimeout> | null = null;

  const cancel = () => {
    cancelled = true;
    if (styleLoadHandler) map.off("style.load", styleLoadHandler);
    if (idleHandler) map.off("idle", idleHandler);
    if (verifyTimer) clearTimeout(verifyTimer);
    if (forceFinishTimer) clearTimeout(forceFinishTimer);
    styleLoadHandler = null;
    idleHandler = null;
    verifyTimer = null;
    forceFinishTimer = null;
  };

  const finish = () => {
    if (cancelled || generation !== getGeneration()) return;
    if (!liveMapBaseLayerMatches(map, targetLayer)) return;
    onReady(map, targetLayer);
  };

  const forceFinish = () => {
    if (cancelled || generation !== getGeneration()) return;
    if (getLiveMapAppliedBasemapLayer(map) !== targetLayer) return;
    if (!isLiveMapStyleReady(map)) {
      map.once("idle", () => {
        if (cancelled || generation !== getGeneration()) return;
        if (getLiveMapAppliedBasemapLayer(map) !== targetLayer) return;
        onReady(map, targetLayer);
      });
      return;
    }
    onReady(map, targetLayer);
  };

  styleLoadHandler = () => {
    if (cancelled || generation !== getGeneration()) return;
    finish();
    idleHandler = () => {
      if (cancelled || generation !== getGeneration()) return;
      finish();
    };
    map.once("idle", idleHandler);
  };

  map.once("style.load", styleLoadHandler);
  map.setStyle(style, { diff: false });

  verifyTimer = setTimeout(() => {
    if (cancelled || generation !== getGeneration()) return;
    if (liveMapBaseLayerMatches(map, targetLayer)) {
      finish();
      return;
    }
    map.setStyle(style, { diff: false });
  }, 400);

  forceFinishTimer = setTimeout(() => {
    if (cancelled || generation !== getGeneration()) return;
    forceFinish();
  }, 1400);

  return { generation, targetLayer, cancel };
}

let liveMapStyleSwitchGeneration = 0;

export function resetLiveMapStyleSwitchGenerationForTests(): void {
  liveMapStyleSwitchGeneration = 0;
}
