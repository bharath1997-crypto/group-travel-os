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

    // Default to dark mode if system theme prefers dark
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }

    // Dynamic time-of-day auto theme:
    // Nighttime (6 PM to 6 AM) uses dark mode
    // Morning/Daytime (6 AM to 6 PM) uses light/clean mode
    const hour = new Date().getHours();
    if (hour >= 18 || hour < 6) {
      return "dark";
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
