import type maplibregl from "maplibre-gl";
import type { LiveMapLayer } from "@/lib/map-providers";
import { mapSupportsLabelSearch } from "./live-map-labels";
import {
  getTravelRoutePalette,
  TRAVEL_VECTOR_LAYER_IDS,
  TRAVEL_VECTOR_SOURCE,
  TRANSIT_CLASS_FILTER,
  travelLocalWidth,
  travelMotorwayWidth,
  travelPathWidth,
  travelPrimaryWidth,
  travelRailWidth,
  travelSecondaryWidth,
  travelTrunkWidth,
} from "./live-travel-layer-styles";
import { travelLayerBeforeId } from "@/lib/live-travel-layer";

const ALL_VECTOR_LAYER_IDS = Object.values(TRAVEL_VECTOR_LAYER_IDS);

function removeVectorTravelLayers(map: maplibregl.Map): void {
  for (const layerId of ALL_VECTOR_LAYER_IDS) {
    try {
      if (map.getLayer(layerId)) map.removeLayer(layerId);
    } catch {
      /* style switching */
    }
  }
}

function addTravelLayer(
  map: maplibregl.Map,
  spec: maplibregl.LayerSpecification,
  beforeId: string | undefined,
): void {
  if (map.getLayer(spec.id)) return;
  map.addLayer(spec, beforeId);
}

function casingWidth(core: maplibregl.ExpressionSpecification, extra = 1.6): maplibregl.ExpressionSpecification {
  return ["+", core, extra] as maplibregl.ExpressionSpecification;
}

export function syncTravelVectorLayersNow(
  map: maplibregl.Map,
  enabled: boolean,
  activeBaseLayer: LiveMapLayer,
): boolean {
  if (!mapSupportsLabelSearch(map)) {
    removeVectorTravelLayers(map);
    return false;
  }

  if (!enabled) {
    removeVectorTravelLayers(map);
    return true;
  }

  const palette = getTravelRoutePalette(activeBaseLayer);
  const beforeId = travelLayerBeforeId(map.getStyle()?.layers);
  const isDark = activeBaseLayer === "dark";

  addTravelLayer(
    map,
    {
      id: TRAVEL_VECTOR_LAYER_IDS.railCasing,
      type: "line",
      source: TRAVEL_VECTOR_SOURCE,
      "source-layer": "transportation",
      minzoom: 5,
      filter: ["==", ["get", "class"], "rail"],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": palette.rail.casing,
        "line-width": casingWidth(travelRailWidth(), 2),
        "line-opacity": isDark ? 0.95 : 0.88,
      },
    },
    beforeId,
  );

  addTravelLayer(
    map,
    {
      id: TRAVEL_VECTOR_LAYER_IDS.railCore,
      type: "line",
      source: TRAVEL_VECTOR_SOURCE,
      "source-layer": "transportation",
      minzoom: 5,
      filter: ["==", ["get", "class"], "rail"],
      layout: { "line-cap": "butt", "line-join": "round" },
      paint: {
        "line-color": palette.rail.core,
        "line-width": travelRailWidth(),
        "line-dasharray": [2, 1.5],
        "line-opacity": isDark ? 1 : 0.92,
      },
    },
    beforeId,
  );

  addTravelLayer(
    map,
    {
      id: TRAVEL_VECTOR_LAYER_IDS.motorwayCasing,
      type: "line",
      source: TRAVEL_VECTOR_SOURCE,
      "source-layer": "transportation",
      minzoom: 4,
      filter: ["==", ["get", "class"], "motorway"],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": palette.motorway.casing,
        "line-width": casingWidth(travelMotorwayWidth(), 2.2),
        "line-opacity": 0.95,
      },
    },
    beforeId,
  );

  addTravelLayer(
    map,
    {
      id: TRAVEL_VECTOR_LAYER_IDS.motorwayCore,
      type: "line",
      source: TRAVEL_VECTOR_SOURCE,
      "source-layer": "transportation",
      minzoom: 4,
      filter: ["==", ["get", "class"], "motorway"],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": palette.motorway.core,
        "line-width": travelMotorwayWidth(),
        "line-opacity": 1,
      },
    },
    beforeId,
  );

  addTravelLayer(
    map,
    {
      id: TRAVEL_VECTOR_LAYER_IDS.trunkCasing,
      type: "line",
      source: TRAVEL_VECTOR_SOURCE,
      "source-layer": "transportation",
      minzoom: 5,
      filter: ["==", ["get", "class"], "trunk"],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": palette.trunk.casing,
        "line-width": casingWidth(travelTrunkWidth(), 2),
        "line-opacity": 0.92,
      },
    },
    beforeId,
  );

  addTravelLayer(
    map,
    {
      id: TRAVEL_VECTOR_LAYER_IDS.trunkCore,
      type: "line",
      source: TRAVEL_VECTOR_SOURCE,
      "source-layer": "transportation",
      minzoom: 5,
      filter: ["==", ["get", "class"], "trunk"],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": palette.trunk.core,
        "line-width": travelTrunkWidth(),
        "line-opacity": 1,
      },
    },
    beforeId,
  );

  addTravelLayer(
    map,
    {
      id: TRAVEL_VECTOR_LAYER_IDS.primaryCasing,
      type: "line",
      source: TRAVEL_VECTOR_SOURCE,
      "source-layer": "transportation",
      minzoom: 7,
      filter: ["==", ["get", "class"], "primary"],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": palette.primary.casing,
        "line-width": casingWidth(travelPrimaryWidth(), 1.6),
        "line-opacity": 0.9,
      },
    },
    beforeId,
  );

  addTravelLayer(
    map,
    {
      id: TRAVEL_VECTOR_LAYER_IDS.primaryCore,
      type: "line",
      source: TRAVEL_VECTOR_SOURCE,
      "source-layer": "transportation",
      minzoom: 7,
      filter: ["==", ["get", "class"], "primary"],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": palette.primary.core,
        "line-width": travelPrimaryWidth(),
        "line-opacity": 1,
      },
    },
    beforeId,
  );

  addTravelLayer(
    map,
    {
      id: TRAVEL_VECTOR_LAYER_IDS.secondaryCasing,
      type: "line",
      source: TRAVEL_VECTOR_SOURCE,
      "source-layer": "transportation",
      minzoom: 9,
      filter: ["==", ["get", "class"], "secondary"],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": palette.secondary.casing,
        "line-width": casingWidth(travelSecondaryWidth(), 1.2),
        "line-opacity": isDark ? 0.85 : 0.78,
      },
    },
    beforeId,
  );

  addTravelLayer(
    map,
    {
      id: TRAVEL_VECTOR_LAYER_IDS.secondaryCore,
      type: "line",
      source: TRAVEL_VECTOR_SOURCE,
      "source-layer": "transportation",
      minzoom: 9,
      filter: ["==", ["get", "class"], "secondary"],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": palette.secondary.core,
        "line-width": travelSecondaryWidth(),
        "line-opacity": isDark ? 0.95 : 0.88,
      },
    },
    beforeId,
  );

  addTravelLayer(
    map,
    {
      id: TRAVEL_VECTOR_LAYER_IDS.localCore,
      type: "line",
      source: TRAVEL_VECTOR_SOURCE,
      "source-layer": "transportation",
      minzoom: 13,
      filter: ["in", ["get", "class"], ["literal", ["tertiary", "minor", "service"]]],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": palette.local,
        "line-width": travelLocalWidth(),
        "line-opacity": isDark ? 0.82 : 0.72,
      },
    },
    beforeId,
  );

  addTravelLayer(
    map,
    {
      id: TRAVEL_VECTOR_LAYER_IDS.pathCore,
      type: "line",
      source: TRAVEL_VECTOR_SOURCE,
      "source-layer": "transportation",
      minzoom: 14,
      filter: ["in", ["get", "class"], ["literal", ["path", "track", "footway"]]],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": palette.path,
        "line-width": travelPathWidth(),
        "line-dasharray": [1.5, 1.2],
        "line-opacity": isDark ? 0.75 : 0.65,
      },
    },
    beforeId,
  );

  addTravelLayer(
    map,
    {
      id: TRAVEL_VECTOR_LAYER_IDS.transitStops,
      type: "circle",
      source: TRAVEL_VECTOR_SOURCE,
      "source-layer": "poi",
      minzoom: 11,
      filter: TRANSIT_CLASS_FILTER,
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          11,
          2.5,
          14,
          4,
          16,
          5.5,
        ],
        "circle-color": palette.transit.fill,
        "circle-stroke-color": palette.transit.stroke,
        "circle-stroke-width": 1.5,
        "circle-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          11,
          0.55,
          13,
          0.85,
          16,
          1,
        ],
      },
    },
    beforeId,
  );

  addTravelLayer(
    map,
    {
      id: TRAVEL_VECTOR_LAYER_IDS.transitLabels,
      type: "symbol",
      source: TRAVEL_VECTOR_SOURCE,
      "source-layer": "poi",
      minzoom: 14,
      filter: TRANSIT_CLASS_FILTER,
      layout: {
        "text-field": [
          "coalesce",
          ["get", "name"],
          ["get", "name_en"],
          "Transit stop",
        ],
        "text-size": 10,
        "text-anchor": "top",
        "text-offset": [0, 0.8],
        "text-optional": true,
        "text-allow-overlap": false,
        "text-max-width": 8,
      },
      paint: {
        "text-color": palette.transit.label,
        "text-halo-color": isDark ? "#0F172A" : "#FFFFFF",
        "text-halo-width": 1.25,
        "text-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          14,
          0.65,
          16,
          1,
        ],
      },
    },
    beforeId,
  );

  return true;
}

export function setBaseHousenumberVisibility(map: maplibregl.Map, visible: boolean): void {
  const layers = map.getStyle()?.layers ?? [];
  for (const layer of layers) {
    if (layer.type !== "symbol") continue;
    const sourceLayer = (layer as { "source-layer"?: string })["source-layer"];
    if (sourceLayer !== "housenumber") continue;
    try {
      map.setLayoutProperty(layer.id, "visibility", visible ? "visible" : "none");
    } catch {
      /* layer unavailable during style swap */
    }
  }
}
