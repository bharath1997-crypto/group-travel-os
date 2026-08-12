import type { Map as MaplibreMap, SkySpecification } from "maplibre-gl";
import type { LiveMapLayer } from "@/lib/map-providers";
import { buildGlobeSunLight } from "./live-globe-sun";

/** Zoom at or below this — treat as world / globe view. */
export const LIVE_GLOBE_VIEW_MAX_ZOOM = 3;

export const LIVE_GLOBE_PROJECTION = { type: "globe" as const };
export const LIVE_MERCATOR_PROJECTION = { type: "mercator" as const };

/** Use flat mercator when zoomed in so taps match the visible map (globe backside bug on mobile). */
export function syncLiveMapProjection(map: MaplibreMap, zoom: number): void {
  if (!map.isStyleLoaded()) return;

  try {
    map.setProjection(
      isLiveGlobeViewZoom(zoom) ? LIVE_GLOBE_PROJECTION : LIVE_MERCATOR_PROJECTION,
    );
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[Rovvy Live Map] projection switch unavailable", err);
    }
  }
}

const LIVE_GLOBE_OCEAN_BG = "#061325";
const LIVE_MAP_FALLBACK_BG = "#d4dde4";

function liveGlobeSkyForLayer(layer: LiveMapLayer): SkySpecification {
  if (layer === "dark") {
    return {
      "sky-color": "#020617",
      "horizon-color": "#1e293b",
      "fog-color": "#020617",
      "sky-horizon-blend": 0.06,
      "horizon-fog-blend": 0.03,
      "atmosphere-blend": [
        "interpolate",
        ["linear"],
        ["zoom"],
        0,
        1,
        4,
        0.85,
        7,
        0,
      ],
    };
  }

  if (layer === "street" || layer === "clean") {
    return {
      "sky-color": "#64748b",
      "horizon-color": "#cbd5e1",
      "fog-color": "#64748b",
      "sky-horizon-blend": 0.1,
      "horizon-fog-blend": 0.05,
      "atmosphere-blend": [
        "interpolate",
        ["linear"],
        ["zoom"],
        0,
        1,
        4,
        0.85,
        7,
        0,
      ],
    };
  }

  return {
    "sky-color": "#0b1a2e",
    "horizon-color": "#3d6b8a",
    "fog-color": "#0b1a2e",
    "sky-horizon-blend": 0.08,
    "horizon-fog-blend": 0.04,
    "atmosphere-blend": [
      "interpolate",
      ["linear"],
      ["zoom"],
      0,
      1,
      4,
      0.85,
      7,
      0,
    ],
  };
}

/** Space behind the globe at world zoom — same on every basemap. */
export function syncLiveGlobeBackground(map: MaplibreMap): void {
  if (!map.isStyleLoaded()) return;
  const onGlobe = isLiveGlobeViewZoom(map.getZoom());

  try {
    const layers = map.getStyle()?.layers || [];
    for (const layer of layers) {
      if (layer.type === "background") {
        if (onGlobe) {
          map.setPaintProperty(layer.id, "background-color", "rgba(0,0,0,0)");
        } else {
          if (layer.id === "rovvy-map-background") {
            map.setPaintProperty(layer.id, "background-color", LIVE_MAP_FALLBACK_BG);
          } else if (layer.id === "rovvy-raster-background") {
            map.setPaintProperty(layer.id, "background-color", LIVE_GLOBE_OCEAN_BG);
          } else {
            const isDarkStyle = layer.id.includes("dark") || layer.id.includes("night");
            map.setPaintProperty(layer.id, "background-color", isDarkStyle ? "#0f172a" : "#f8f4f0");
          }
        }
      }
    }
  } catch (err) {
    // catch style loading race conditions
  }
}

/** Apply real-time sun position for globe day/night terminator. */
export function syncGlobeSunLight(map: MaplibreMap): void {
  if (!map.isStyleLoaded()) return;
  if (!isLiveGlobeViewZoom(map.getZoom())) return;

  try {
    map.setLight(buildGlobeSunLight());
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[Rovvy Live Map] globe sun light unavailable", err);
    }
  }
}

/** Refresh sun light every minute while the map is alive. */
export function bindGlobeSunLight(map: MaplibreMap): () => void {
  const tick = () => syncGlobeSunLight(map);
  tick();
  const timer = window.setInterval(tick, 60_000);
  map.on("zoom", tick);
  map.on("style.load", tick);
  return () => {
    window.clearInterval(timer);
    map.off("zoom", tick);
    map.off("style.load", tick);
  };
}

/**
 * Google-style globe at low zoom on every Live basemap.
 * Requires MapLibre GL JS 5+.
 */
export function applyLiveGlobeMode(
  map: MaplibreMap,
  activeLayer: LiveMapLayer = "street",
): void {
  const apply = () => {
    try {
      if (!map.isStyleLoaded()) return;
      syncLiveMapProjection(map, map.getZoom());
      if (isLiveGlobeViewZoom(map.getZoom())) {
        map.setRenderWorldCopies(false);
        map.setSky(liveGlobeSkyForLayer(activeLayer));
        syncGlobeSunLight(map);
      }
      syncLiveGlobeBackground(map);
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[Rovvy Live Map] globe projection unavailable", err);
      }
    }
  };

  apply();
  if (!map.isStyleLoaded()) {
    map.once("style.load", apply);
  }
}

/** Re-apply globe after every style swap (including external Clean Map URL). */
export function bindLiveGlobeMode(
  map: MaplibreMap,
  getActiveLayer: () => LiveMapLayer,
): () => void {
  const onStyleLoad = () => applyLiveGlobeMode(map, getActiveLayer());
  map.on("style.load", onStyleLoad);
  return () => {
    map.off("style.load", onStyleLoad);
  };
}

/** Keep user on globe when locating from world view; street zoom when already local. */
export function resolveLiveLocateZoom(
  currentZoom: number,
  accuracyMeters: number | null | undefined,
): number {
  if (currentZoom <= LIVE_GLOBE_VIEW_MAX_ZOOM) {
    return 2.2;
  }
  if (currentZoom <= 8) {
    return accuracyMeters != null && accuracyMeters > 150 ? 12 : 14;
  }
  return accuracyMeters != null && accuracyMeters > 150 ? 14 : 16;
}

export function isLiveGlobeViewZoom(zoom: number): boolean {
  return zoom <= LIVE_GLOBE_VIEW_MAX_ZOOM + 0.05;
}
