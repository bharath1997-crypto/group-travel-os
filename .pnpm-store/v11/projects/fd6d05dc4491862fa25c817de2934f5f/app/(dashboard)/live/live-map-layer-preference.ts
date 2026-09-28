import {
  isLiveDarkBasemapAvailable,
  type LiveMapLayer,
} from "@/lib/map-providers";

const STORAGE_KEY = "rovvy_live_map_layer";

/** Detailed Map — labels, POIs, and house numbers at high zoom. */
export const DEFAULT_LIVE_MAP_LAYER: LiveMapLayer = "street";

/** Product gate — hide Dark basemap until re-enabled. */
export const LIVE_MAP_DARK_LAYER_ENABLED = false;

const ALL_LIVE_MAP_LAYERS: LiveMapLayer[] = [
  "street",
  "clean",
  "satellite",
  "terrain",
  "hybrid",
  "dark",
];

export function isLiveMapDarkLayerEnabled(): boolean {
  return LIVE_MAP_DARK_LAYER_ENABLED;
}

/** Layers shown in the map picker and allowed via saved preference. */
export function getSelectableLiveMapLayers(): LiveMapLayer[] {
  return ALL_LIVE_MAP_LAYERS.filter(
    (layer) => layer !== "dark" || isLiveMapDarkLayerEnabled(),
  );
}

export function coerceSelectableLiveMapLayer(layer: LiveMapLayer): LiveMapLayer {
  if (layer === "dark" && !isLiveMapDarkLayerEnabled()) {
    return DEFAULT_LIVE_MAP_LAYER;
  }
  return layer;
}

/** Night / OS dark theme picks Dark only when CARTO key is configured. */
export function resolveAutoLiveMapLayer(now: Date = new Date()): LiveMapLayer {
  if (!isLiveMapDarkLayerEnabled()) {
    return DEFAULT_LIVE_MAP_LAYER;
  }

  if (!isLiveDarkBasemapAvailable()) {
    return DEFAULT_LIVE_MAP_LAYER;
  }

  if (
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  ) {
    return "dark";
  }

  const hour = now.getHours();
  if (hour >= 18 || hour < 6) {
    return "dark";
  }

  return DEFAULT_LIVE_MAP_LAYER;
}

/** Vector basemaps that support Rovvy house-number overlays. */
export function layerUsesVectorHouseNumberOverlay(layer: LiveMapLayer): boolean {
  return layer === "street" || layer === "clean";
}

function sanitizeStoredLiveMapLayer(layer: LiveMapLayer): LiveMapLayer {
  return coerceSelectableLiveMapLayer(
    layer === "dark" && !isLiveDarkBasemapAvailable() ? DEFAULT_LIVE_MAP_LAYER : layer,
  );
}

export function loadLiveMapLayerPreference(): LiveMapLayer {
  if (typeof window === "undefined") return DEFAULT_LIVE_MAP_LAYER;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const selectable = getSelectableLiveMapLayers();
    if (raw && selectable.includes(raw as LiveMapLayer)) {
      return sanitizeStoredLiveMapLayer(raw as LiveMapLayer);
    }
    if (raw === "dark") {
      return DEFAULT_LIVE_MAP_LAYER;
    }

    return resolveAutoLiveMapLayer();
  } catch {
    /* private mode */
  }
  return DEFAULT_LIVE_MAP_LAYER;
}

export function saveLiveMapLayerPreference(layer: LiveMapLayer): void {
  if (typeof window === "undefined") return;
  const safe = coerceSelectableLiveMapLayer(layer);
  try {
    localStorage.setItem(STORAGE_KEY, safe);
  } catch {
    /* quota / private mode */
  }
}
