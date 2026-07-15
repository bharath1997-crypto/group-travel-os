import type maplibregl from "maplibre-gl";
import { DEV_TILE_DEFAULTS } from "@/lib/map-providers";
import { travelLayerBeforeId } from "@/lib/live-travel-layer";

const SOURCE_ID = "rovvy-dark-street-labels";
const LAYER_ID = "rovvy-dark-street-labels-raster";

/** Brighter place/street labels on Dark map for outdoor legibility (z15+). */
export function syncDarkMapStreetLabelsNow(
  map: maplibregl.Map,
  enabled: boolean,
): void {
  if (!enabled) {
    if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
    if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
    return;
  }

  const beforeId = travelLayerBeforeId(map.getStyle()?.layers);
  const tileUrl = DEV_TILE_DEFAULTS.hybridLabels.places;

  if (!map.getSource(SOURCE_ID)) {
    map.addSource(SOURCE_ID, {
      type: "raster",
      tiles: [tileUrl],
      tileSize: 256,
      maxzoom: 16,
    });
  }

  const paint = {
    "raster-opacity": [
      "interpolate",
      ["linear"],
      ["zoom"],
      14,
      0,
      15,
      0.42,
      16,
      0.58,
      17,
      0.68,
    ] as maplibregl.ExpressionSpecification,
  };

  if (map.getLayer(LAYER_ID)) {
    map.setPaintProperty(LAYER_ID, "raster-opacity", paint["raster-opacity"]);
    return;
  }

  map.addLayer(
    {
      id: LAYER_ID,
      type: "raster",
      source: SOURCE_ID,
      minzoom: 14,
      maxzoom: 17.5,
      paint,
    },
    beforeId,
  );
}

export function syncDarkMapStreetLabels(map: maplibregl.Map, enabled: boolean): void {
  try {
    if (!map.isStyleLoaded()) {
      map.once("idle", () => syncDarkMapStreetLabelsNow(map, enabled));
      return;
    }
    syncDarkMapStreetLabelsNow(map, enabled);
  } catch {
    /* style switching */
  }
}
