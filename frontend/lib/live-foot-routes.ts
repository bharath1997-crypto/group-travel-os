/**
 * Live map foot / trekking trail overlay — OSM paths worldwide via OpenFreeMap vector tiles.
 * Budget: $0 (OpenFreeMap + OpenStreetMap contributors).
 */
import type { ExpressionSpecification, LineLayerSpecification } from "maplibre-gl";
import type { LiveMapLayer } from "@/lib/map-providers";

export const FOOT_ROUTES_VECTOR_SOURCE = "openmaptiles";

export const FOOT_ROUTES_VECTOR_TILES =
  "https://tiles.openfreemap.org/planet/{z}/{x}/{y}.pbf";

export const FOOT_ROUTES_VECTOR_MAX_ZOOM = 14;

export const FOOT_ROUTES_LAYER_IDS = {
  trailCasing: "rovvy-foot-trail-casing",
  trailCore: "rovvy-foot-trail-core",
  hikingCasing: "rovvy-foot-hiking-casing",
  hikingCore: "rovvy-foot-hiking-core",
} as const;

export const FOOT_ROUTES_ATTRIBUTION = "© OpenFreeMap © OpenStreetMap contributors";

/** Walkable paths — forests, mountains, pedestrian-only ways. */
export const FOOT_TRAIL_CLASS_FILTER: ExpressionSpecification = [
  "in",
  ["get", "class"],
  ["literal", ["path", "footway", "steps", "pedestrian"]],
];

/** Unpaved hiking tracks tagged in OSM (no general vehicle tracks). */
export const FOOT_HIKING_TRACK_FILTER: ExpressionSpecification = [
  "all",
  ["==", ["get", "class"], "track"],
  ["in", ["get", "subclass"], ["literal", ["hiking", "footway", "path"]]],
];

export type FootRouteLayerPaint = {
  minzoom: number;
  casing: LineLayerSpecification["paint"];
  core: LineLayerSpecification["paint"];
};

function zoomWidth(stops: [number, number][]): ExpressionSpecification {
  return ["interpolate", ["linear"], ["zoom"], ...stops.flat()];
}

export function footTrailCoreWidth(): ExpressionSpecification {
  return zoomWidth([
    [7, 0.5],
    [10, 1.2],
    [13, 2.4],
    [16, 4.5],
  ]);
}

export function footTrailCasingWidth(): ExpressionSpecification {
  return zoomWidth([
    [7, 1.2],
    [10, 2.4],
    [13, 4],
    [16, 7],
  ]);
}

function isDarkOceanLayer(layer: LiveMapLayer): boolean {
  return layer === "satellite" || layer === "terrain" || layer === "hybrid" || layer === "dark";
}

export function getFootRouteLayerPaint(activeBaseLayer: LiveMapLayer): FootRouteLayerPaint {
  const vivid = isDarkOceanLayer(activeBaseLayer);

  if (vivid) {
    return {
      minzoom: 7,
      casing: {
        "line-color": "#14532D",
        "line-width": footTrailCasingWidth(),
        "line-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          7,
          0.55,
          11,
          0.75,
          14,
          0.9,
        ],
      },
      core: {
        "line-color": "#4ADE80",
        "line-width": footTrailCoreWidth(),
        "line-dasharray": [2, 1.2],
        "line-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          7,
          0.7,
          11,
          0.88,
          14,
          1,
        ],
      },
    };
  }

  return {
    minzoom: 7,
    casing: {
      "line-color": "#BBF7D0",
      "line-width": footTrailCasingWidth(),
      "line-opacity": 0.85,
    },
    core: {
      "line-color": "#15803D",
      "line-width": footTrailCoreWidth(),
      "line-dasharray": [2, 1.2],
      "line-opacity": 0.92,
    },
  };
}

export function getFootHikingLayerPaint(activeBaseLayer: LiveMapLayer): FootRouteLayerPaint {
  const base = getFootRouteLayerPaint(activeBaseLayer);
  return {
    ...base,
    core: {
      ...base.core,
      "line-color": isDarkOceanLayer(activeBaseLayer) ? "#FDE047" : "#CA8A04",
      "line-dasharray": [1.2, 1.4],
    },
  };
}
