import type maplibregl from "maplibre-gl";
import type { ExpressionSpecification } from "maplibre-gl";
import { travelLayerBeforeId } from "@/lib/live-travel-layer";
import { mapSupportsLabelSearch } from "./live-map-labels";

const HYBRID_ROAD_SOURCE = "openmaptiles";

export const HYBRID_ROAD_LAYER_IDS = {
  motorwayCasing: "rovvy-hybrid-motorway-casing",
  motorwayCore: "rovvy-hybrid-motorway-core",
  trunkCasing: "rovvy-hybrid-trunk-casing",
  trunkCore: "rovvy-hybrid-trunk-core",
  primaryCasing: "rovvy-hybrid-primary-casing",
  primaryCore: "rovvy-hybrid-primary-core",
  secondaryCore: "rovvy-hybrid-secondary-core",
  localCore: "rovvy-hybrid-local-core",
} as const;

const ALL_HYBRID_ROAD_LAYER_IDS = Object.values(HYBRID_ROAD_LAYER_IDS);

function zoomWidth(stops: [number, number][]): ExpressionSpecification {
  return ["interpolate", ["linear"], ["zoom"], ...stops.flat()];
}

function casingWidth(core: ExpressionSpecification, extra = 0.8): ExpressionSpecification {
  return ["+", core, extra] as ExpressionSpecification;
}

function removeHybridRoadLayers(map: maplibregl.Map): void {
  for (const layerId of ALL_HYBRID_ROAD_LAYER_IDS) {
    try {
      if (map.getLayer(layerId)) map.removeLayer(layerId);
    } catch {
      /* style switching */
    }
  }
}

function addHybridRoadLayer(
  map: maplibregl.Map,
  spec: maplibregl.LayerSpecification,
  beforeId: string | undefined,
): void {
  if (map.getLayer(spec.id)) return;
  map.addLayer(spec, beforeId);
}

/** Google-style thin white/yellow road lines over satellite imagery. */
export function syncHybridRoadOverlayNow(map: maplibregl.Map, enabled: boolean): void {
  if (!enabled || !mapSupportsLabelSearch(map)) {
    removeHybridRoadLayers(map);
    return;
  }

  const beforeId = travelLayerBeforeId(map.getStyle()?.layers);
  const motorwayWidth = zoomWidth([
    [4, 0.5],
    [8, 0.9],
    [12, 1.6],
    [16, 2.8],
  ]);
  const trunkWidth = zoomWidth([
    [5, 0.45],
    [9, 0.85],
    [13, 1.4],
    [16, 2.4],
  ]);
  const primaryWidth = zoomWidth([
    [7, 0.35],
    [11, 0.75],
    [14, 1.2],
    [16, 2],
  ]);
  const secondaryWidth = zoomWidth([
    [9, 0.3],
    [12, 0.65],
    [15, 1],
    [16, 1.5],
  ]);
  const localWidth = zoomWidth([
    [13, 0.25],
    [15, 0.55],
    [16, 0.9],
  ]);

  const roadLayers: maplibregl.LayerSpecification[] = [
    {
      id: HYBRID_ROAD_LAYER_IDS.motorwayCasing,
      type: "line",
      source: HYBRID_ROAD_SOURCE,
      "source-layer": "transportation",
      minzoom: 4,
      filter: ["==", ["get", "class"], "motorway"],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": "rgba(15,23,42,0.55)",
        "line-width": casingWidth(motorwayWidth, 0.9),
        "line-opacity": 0.85,
      },
    },
    {
      id: HYBRID_ROAD_LAYER_IDS.motorwayCore,
      type: "line",
      source: HYBRID_ROAD_SOURCE,
      "source-layer": "transportation",
      minzoom: 4,
      filter: ["==", ["get", "class"], "motorway"],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": "#FDE68A",
        "line-width": motorwayWidth,
        "line-opacity": 0.95,
      },
    },
    {
      id: HYBRID_ROAD_LAYER_IDS.trunkCasing,
      type: "line",
      source: HYBRID_ROAD_SOURCE,
      "source-layer": "transportation",
      minzoom: 5,
      filter: ["==", ["get", "class"], "trunk"],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": "rgba(15,23,42,0.5)",
        "line-width": casingWidth(trunkWidth, 0.75),
        "line-opacity": 0.8,
      },
    },
    {
      id: HYBRID_ROAD_LAYER_IDS.trunkCore,
      type: "line",
      source: HYBRID_ROAD_SOURCE,
      "source-layer": "transportation",
      minzoom: 5,
      filter: ["==", ["get", "class"], "trunk"],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": "#FEF3C7",
        "line-width": trunkWidth,
        "line-opacity": 0.92,
      },
    },
    {
      id: HYBRID_ROAD_LAYER_IDS.primaryCasing,
      type: "line",
      source: HYBRID_ROAD_SOURCE,
      "source-layer": "transportation",
      minzoom: 7,
      filter: ["==", ["get", "class"], "primary"],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": "rgba(15,23,42,0.45)",
        "line-width": casingWidth(primaryWidth, 0.65),
        "line-opacity": 0.75,
      },
    },
    {
      id: HYBRID_ROAD_LAYER_IDS.primaryCore,
      type: "line",
      source: HYBRID_ROAD_SOURCE,
      "source-layer": "transportation",
      minzoom: 7,
      filter: ["==", ["get", "class"], "primary"],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": "#FFFFFF",
        "line-width": primaryWidth,
        "line-opacity": 0.9,
      },
    },
    {
      id: HYBRID_ROAD_LAYER_IDS.secondaryCore,
      type: "line",
      source: HYBRID_ROAD_SOURCE,
      "source-layer": "transportation",
      minzoom: 9,
      filter: ["==", ["get", "class"], "secondary"],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": "rgba(255,255,255,0.88)",
        "line-width": secondaryWidth,
        "line-opacity": 0.82,
      },
    },
    {
      id: HYBRID_ROAD_LAYER_IDS.localCore,
      type: "line",
      source: HYBRID_ROAD_SOURCE,
      "source-layer": "transportation",
      minzoom: 13,
      filter: ["in", ["get", "class"], ["literal", ["tertiary", "minor", "service"]]],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": "rgba(255,255,255,0.75)",
        "line-width": localWidth,
        "line-opacity": 0.7,
      },
    },
  ];

  for (const spec of roadLayers) {
    addHybridRoadLayer(map, spec, beforeId);
  }
}

export function syncHybridRoadOverlay(map: maplibregl.Map, activeBaseLayer: string): void {
  syncHybridRoadOverlayNow(map, activeBaseLayer === "hybrid");
}
