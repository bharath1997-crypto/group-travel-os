import {
  isLiveDarkBasemapAvailable,
  type LiveMapLayer,
} from "@/lib/map-providers";

const STORAGE_KEY = "rovvy_live_map_layer";

export const DEFAULT_LIVE_MAP_LAYER: LiveMapLayer = "clean";

const VALID_LAYERS: LiveMapLayer[] = ["street", "clean", "satellite", "terrain", "hybrid", "dark"];

/** Night / OS dark theme picks Dark only when CARTO key is configured. */
export function resolveAutoLiveMapLayer(now: Date = new Date()): LiveMapLayer {
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

function sanitizeStoredLiveMapLayer(layer: LiveMapLayer): LiveMapLayer {
  if (layer === "dark" && !isLiveDarkBasemapAvailable()) {
    return DEFAULT_LIVE_MAP_LAYER;
  }
  return layer;
}

export function loadLiveMapLayerPreference(): LiveMapLayer {
  if (typeof window === "undefined") return DEFAULT_LIVE_MAP_LAYER;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && VALID_LAYERS.includes(raw as LiveMapLayer)) {
      return sanitizeStoredLiveMapLayer(raw as LiveMapLayer);
    }

    return resolveAutoLiveMapLayer();
  } catch {
    /* private mode */
  }
  return DEFAULT_LIVE_MAP_LAYER;
}

export function saveLiveMapLayerPreference(layer: LiveMapLayer): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, layer);
  } catch {
    /* quota / private mode */
  }
}
