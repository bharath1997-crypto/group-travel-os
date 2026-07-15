import type { Map as MaplibreMap, ExpressionSpecification } from "maplibre-gl";
import { mapSupportsLabelSearch } from "./live-map-labels";

export const CLEAN_MAP_HOUSENUMBER_MIN_ZOOM = 15;
export const ROVVY_HOUSENUMBER_LAYER_ID = "rovvy-housenumber-labels";
export const ROVVY_BUILDING_HOUSENUMBER_LAYER_ID = "rovvy-building-housenumber-labels";

const VECTOR_SOURCE_ID = "openmaptiles";

function resolveStyleTextFont(map: MaplibreMap): string[] {
  const layers = map.getStyle()?.layers ?? [];
  for (const layer of layers) {
    if (layer.type === "symbol" && layer.layout?.["text-font"]) {
      const font = layer.layout["text-font"];
      if (Array.isArray(font) && font.length > 0) return font as string[];
    }
  }
  return ["Noto Sans Regular"];
}

function removeLayerIfPresent(map: MaplibreMap, layerId: string): void {
  try {
    if (map.getLayer(layerId)) map.removeLayer(layerId);
  } catch {
    /* style switching */
  }
}

/** High-zoom house numbers on Clean Map — hidden when Travel layer is on. */
export function ensureCleanMapHouseNumberLabels(
  map: MaplibreMap,
  options?: { travelLayerEnabled?: boolean },
): void {
  if (!mapSupportsLabelSearch(map)) return;

  removeLayerIfPresent(map, ROVVY_HOUSENUMBER_LAYER_ID);
  removeLayerIfPresent(map, ROVVY_BUILDING_HOUSENUMBER_LAYER_ID);

  if (options?.travelLayerEnabled) return;

  const textFont = resolveStyleTextFont(map);
  const textPaint = {
    "text-color": "#64748b",
    "text-halo-color": "#ffffff",
    "text-halo-width": 1,
  };
  const textLayoutBase = {
    "text-size": [
      "interpolate",
      ["linear"],
      ["zoom"],
      14,
      9,
      16,
      10,
      17,
      10.5,
    ] as ExpressionSpecification,
    "text-font": textFont,
    "text-anchor": "center" as const,
    "text-allow-overlap": false,
    "text-optional": true,
    "text-padding": 2,
  };

  try {
    map.addLayer({
      id: ROVVY_HOUSENUMBER_LAYER_ID,
      type: "symbol",
      source: VECTOR_SOURCE_ID,
      "source-layer": "housenumber",
      minzoom: CLEAN_MAP_HOUSENUMBER_MIN_ZOOM,
      layout: {
        ...textLayoutBase,
        "text-field": ["to-string", ["get", "housenumber"]],
      },
      paint: textPaint,
    });
  } catch {
    /* housenumber layer unavailable in this style */
  }

  try {
    map.addLayer({
      id: ROVVY_BUILDING_HOUSENUMBER_LAYER_ID,
      type: "symbol",
      source: VECTOR_SOURCE_ID,
      "source-layer": "building",
      minzoom: CLEAN_MAP_HOUSENUMBER_MIN_ZOOM,
      filter: [
        "any",
        ["has", "housenumber"],
        ["has", "addr:housenumber"],
        ["has", "house_number"],
      ],
      layout: {
        ...textLayoutBase,
        "text-field": [
          "coalesce",
          ["to-string", ["get", "housenumber"]],
          ["to-string", ["get", "addr:housenumber"]],
          ["to-string", ["get", "house_number"]],
          "",
        ],
      },
      paint: textPaint,
    });
  } catch {
    /* building housenumber overlay unavailable */
  }
}
