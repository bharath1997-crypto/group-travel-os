/**
 * Live map Travel layer — global highways, main roads, and railways overlay.
 * Toggleable on any base map style (separate from Satellite / Terrain / Hybrid).
 */

import type { StyleSpecification } from "maplibre-gl";
import { DEV_TILE_DEFAULTS } from "@/lib/map-providers";

/** Esri Reference — major roads and highways worldwide. */
export const TRAVEL_ROADS_TILE_URL = DEV_TILE_DEFAULTS.hybridLabels.transport;

/** OpenRailwayMap — railway lines worldwide (OSM-derived). */
export const TRAVEL_RAILWAYS_TILE_URL =
  "https://tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png";

export const TRAVEL_LAYER_ATTRIBUTION =
  "© Esri © OpenRailwayMap © OpenStreetMap contributors";

export const TRAVEL_LAYER_SOURCE_IDS = {
  roads: "rovvy-travel-roads",
  railways: "rovvy-travel-railways",
} as const;

export const TRAVEL_LAYER_LAYER_IDS = {
  roads: "rovvy-travel-roads-raster",
  railways: "rovvy-travel-railways-raster",
} as const;

/** Esri native tile max — matches satellite/terrain view cap with overzoom. */
export const TRAVEL_LAYER_MAX_ZOOM = 16.5;

export type TravelLayerParts = {
  roads: boolean;
  railways: boolean;
};

/** Hybrid already stacks Esri transportation — only add railways there. */
export function resolveTravelLayerParts(
  enabled: boolean,
  skipRoadsBecauseHybrid: boolean,
): TravelLayerParts {
  if (!enabled) return { roads: false, railways: false };
  return {
    roads: !skipRoadsBecauseHybrid,
    railways: true,
  };
}

export function travelLayerBeforeId(
  layers: StyleSpecification["layers"] | undefined,
): string | undefined {
  if (!layers?.length) return undefined;
  const routeMarker = layers.find((layer) => layer.id.startsWith("live-route"));
  if (routeMarker) return routeMarker.id;
  const symbol = layers.find((layer) => layer.type === "symbol");
  return symbol?.id;
}
