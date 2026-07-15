import type maplibregl from "maplibre-gl";
import type { LiveMapLayer } from "@/lib/map-providers";
import {
  resolveTravelLayerParts,
  TRAVEL_LAYER_LAYER_IDS,
  TRAVEL_LAYER_MAX_ZOOM,
  TRAVEL_LAYER_SOURCE_IDS,
  TRAVEL_RAILWAYS_TILE_URL,
  TRAVEL_ROADS_TILE_URL,
  travelLayerBeforeId,
} from "@/lib/live-travel-layer";
import {
  setBaseHousenumberVisibility,
  syncTravelVectorLayersNow,
} from "./live-travel-layer-vector";
import { mapSupportsLabelSearch } from "./live-map-labels";
import {
  ROVVY_BUILDING_HOUSENUMBER_LAYER_ID,
  ROVVY_HOUSENUMBER_LAYER_ID,
} from "./live-clean-map-housenumbers";

function removeTravelRaster(
  map: maplibregl.Map,
  layerId: string,
  sourceId: string,
): void {
  if (map.getLayer(layerId)) map.removeLayer(layerId);
  if (map.getSource(sourceId)) map.removeSource(sourceId);
}

function rasterOpacityForZoom(
  activeBaseLayer: LiveMapLayer,
  kind: "roads" | "railways",
): maplibregl.ExpressionSpecification {
  const peak =
    activeBaseLayer === "satellite" || activeBaseLayer === "dark"
      ? kind === "roads"
        ? 0.94
        : 0.9
      : kind === "roads"
        ? 0.82
        : 0.86;

  return [
    "interpolate",
    ["linear"],
    ["zoom"],
    0,
    0.35,
    6,
    0.55,
    10,
    0.72,
    13,
    kind === "roads" ? 0.8 : 0.84,
    16,
    peak,
  ];
}

function ensureTravelRaster(
  map: maplibregl.Map,
  layerId: string,
  sourceId: string,
  tileUrl: string,
  activeBaseLayer: LiveMapLayer,
  kind: "roads" | "railways",
  minzoom: number,
  beforeId: string | undefined,
): void {
  if (!map.getSource(sourceId)) {
    map.addSource(sourceId, {
      type: "raster",
      tiles: [tileUrl],
      tileSize: 256,
      maxzoom: TRAVEL_LAYER_MAX_ZOOM,
    });
  }

  const opacity = rasterOpacityForZoom(activeBaseLayer, kind);

  if (map.getLayer(layerId)) {
    map.setPaintProperty(layerId, "raster-opacity", opacity);
    map.setLayerZoomRange(layerId, minzoom, TRAVEL_LAYER_MAX_ZOOM);
    return;
  }

  map.addLayer(
    {
      id: layerId,
      type: "raster",
      source: sourceId,
      minzoom,
      maxzoom: TRAVEL_LAYER_MAX_ZOOM,
      paint: { "raster-opacity": opacity },
    },
    beforeId,
  );
}

function hideRovvyHouseNumbers(map: maplibregl.Map): void {
  for (const layerId of [ROVVY_HOUSENUMBER_LAYER_ID, ROVVY_BUILDING_HOUSENUMBER_LAYER_ID]) {
    try {
      if (map.getLayer(layerId)) map.removeLayer(layerId);
    } catch {
      /* style switching */
    }
  }
}

function syncTravelRasterOverlay(
  map: maplibregl.Map,
  enabled: boolean,
  activeBaseLayer: LiveMapLayer,
): void {
  const parts = resolveTravelLayerParts(enabled, activeBaseLayer === "hybrid");
  const beforeId = travelLayerBeforeId(map.getStyle()?.layers);

  if (!parts.roads) {
    removeTravelRaster(
      map,
      TRAVEL_LAYER_LAYER_IDS.roads,
      TRAVEL_LAYER_SOURCE_IDS.roads,
    );
  } else {
    ensureTravelRaster(
      map,
      TRAVEL_LAYER_LAYER_IDS.roads,
      TRAVEL_LAYER_SOURCE_IDS.roads,
      TRAVEL_ROADS_TILE_URL,
      activeBaseLayer,
      "roads",
      4,
      beforeId,
    );
  }

  if (!parts.railways) {
    removeTravelRaster(
      map,
      TRAVEL_LAYER_LAYER_IDS.railways,
      TRAVEL_LAYER_SOURCE_IDS.railways,
    );
  } else {
    ensureTravelRaster(
      map,
      TRAVEL_LAYER_LAYER_IDS.railways,
      TRAVEL_LAYER_SOURCE_IDS.railways,
      TRAVEL_RAILWAYS_TILE_URL,
      activeBaseLayer,
      "railways",
      5,
      beforeId,
    );
  }
}

export function whenMapStyleReady(
  map: maplibregl.Map,
  fn: () => void,
): void {
  const run = () => {
    try {
      if (!map.isStyleLoaded()) return;
      fn();
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message.includes("Style is not done loading") ||
          err.message.includes("not done loading"))
      ) {
        map.once("idle", run);
      }
    }
  };

  if (map.isStyleLoaded()) {
    run();
    return;
  }

  const onStyleData = () => {
    if (!map.isStyleLoaded()) return;
    map.off("styledata", onStyleData);
    run();
  };
  map.on("styledata", onStyleData);
}

export function syncTravelLayerOverlayNow(
  map: maplibregl.Map,
  enabled: boolean,
  activeBaseLayer: LiveMapLayer,
): void {
  const canUseVector = mapSupportsLabelSearch(map);

  if (!enabled) {
    syncTravelVectorLayersNow(map, false, activeBaseLayer);
    syncTravelRasterOverlay(map, false, activeBaseLayer);
    setBaseHousenumberVisibility(map, true);
    return;
  }

  if (canUseVector) {
    syncTravelVectorLayersNow(map, true, activeBaseLayer);
    syncTravelRasterOverlay(map, false, activeBaseLayer);
    hideRovvyHouseNumbers(map);
    setBaseHousenumberVisibility(map, false);
    return;
  }

  syncTravelVectorLayersNow(map, false, activeBaseLayer);
  syncTravelRasterOverlay(map, true, activeBaseLayer);
  setBaseHousenumberVisibility(map, true);
}

export function syncTravelLayerOverlay(
  map: maplibregl.Map,
  enabled: boolean,
  activeBaseLayer: LiveMapLayer,
): void {
  whenMapStyleReady(map, () =>
    syncTravelLayerOverlayNow(map, enabled, activeBaseLayer),
  );
}
