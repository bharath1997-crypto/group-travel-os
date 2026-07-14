import type { LiveMapLayer } from "@/lib/map-providers";

const STORAGE_KEY = "rovvy_live_map_layer";

export const DEFAULT_LIVE_MAP_LAYER: LiveMapLayer = "clean";

const VALID_LAYERS: LiveMapLayer[] = ["street", "clean", "satellite", "terrain", "hybrid", "dark"];

export function loadLiveMapLayerPreference(): LiveMapLayer {
  if (typeof window === "undefined") return DEFAULT_LIVE_MAP_LAYER;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && VALID_LAYERS.includes(raw as LiveMapLayer)) {
      return raw as LiveMapLayer;
    }
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
