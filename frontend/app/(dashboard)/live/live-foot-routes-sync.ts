import type maplibregl from "maplibre-gl";
import type { LiveMapLayer } from "@/lib/map-providers";
import {
  FOOT_HIKING_TRACK_FILTER,
  FOOT_ROUTES_LAYER_IDS,
  FOOT_ROUTES_VECTOR_MAX_ZOOM,
  FOOT_ROUTES_VECTOR_SOURCE,
  FOOT_ROUTES_VECTOR_TILES,
  FOOT_TRAIL_CLASS_FILTER,
  getFootHikingLayerPaint,
  getFootRouteLayerPaint,
} from "@/lib/live-foot-routes";
import { travelLayerBeforeId } from "@/lib/live-travel-layer";
import { whenMapStyleReady } from "./live-travel-layer-sync";

function ensureVectorSource(map: maplibregl.Map): void {
  if (map.getSource(FOOT_ROUTES_VECTOR_SOURCE)) return;
  map.addSource(FOOT_ROUTES_VECTOR_SOURCE, {
    type: "vector",
    tiles: [FOOT_ROUTES_VECTOR_TILES],
    maxzoom: FOOT_ROUTES_VECTOR_MAX_ZOOM,
    attribution: "© OpenFreeMap © OpenStreetMap",
  });
}

function removeLayerIfPresent(map: maplibregl.Map, layerId: string): void {
  try {
    if (map.getLayer(layerId)) map.removeLayer(layerId);
  } catch {
    /* style switching */
  }
}

function applyPaint(
  map: maplibregl.Map,
  layerId: string,
  paint: maplibregl.LineLayerSpecification["paint"],
): void {
  if (!map.getLayer(layerId)) return;
  for (const [key, value] of Object.entries(paint ?? {})) {
    try {
      map.setPaintProperty(layerId, key, value);
    } catch {
      /* unsupported paint */
    }
  }
}

function ensureLinePair(
  map: maplibregl.Map,
  options: {
    casingId: string;
    coreId: string;
    filter: maplibregl.ExpressionSpecification;
    paint: ReturnType<typeof getFootRouteLayerPaint>;
    beforeId: string | undefined;
  },
): void {
  const { casingId, coreId, filter, paint, beforeId } = options;

  const upsert = (
    layerId: string,
    layerPaint: maplibregl.LineLayerSpecification["paint"],
  ) => {
    if (map.getLayer(layerId)) {
      applyPaint(map, layerId, layerPaint);
      map.setLayerZoomRange(layerId, paint.minzoom, 22);
      return;
    }
    map.addLayer(
      {
        id: layerId,
        type: "line",
        source: FOOT_ROUTES_VECTOR_SOURCE,
        "source-layer": "transportation",
        filter,
        minzoom: paint.minzoom,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: layerPaint,
      },
      beforeId,
    );
  };

  upsert(casingId, paint.casing);
  upsert(coreId, paint.core);
}

function removeFootLayers(map: maplibregl.Map): void {
  for (const layerId of Object.values(FOOT_ROUTES_LAYER_IDS)) {
    removeLayerIfPresent(map, layerId);
  }
}

export function syncFootRoutesOverlayNow(
  map: maplibregl.Map,
  enabled: boolean,
  activeBaseLayer: LiveMapLayer,
): void {
  const beforeId = travelLayerBeforeId(map.getStyle()?.layers);

  if (!enabled) {
    removeFootLayers(map);
    return;
  }

  ensureVectorSource(map);

  const trailPaint = getFootRouteLayerPaint(activeBaseLayer);
  const hikingPaint = getFootHikingLayerPaint(activeBaseLayer);

  ensureLinePair(map, {
    casingId: FOOT_ROUTES_LAYER_IDS.trailCasing,
    coreId: FOOT_ROUTES_LAYER_IDS.trailCore,
    filter: FOOT_TRAIL_CLASS_FILTER,
    paint: trailPaint,
    beforeId,
  });

  ensureLinePair(map, {
    casingId: FOOT_ROUTES_LAYER_IDS.hikingCasing,
    coreId: FOOT_ROUTES_LAYER_IDS.hikingCore,
    filter: FOOT_HIKING_TRACK_FILTER,
    paint: hikingPaint,
    beforeId,
  });
}

export function syncFootRoutesOverlay(
  map: maplibregl.Map,
  enabled: boolean,
  activeBaseLayer: LiveMapLayer,
): void {
  whenMapStyleReady(map, () =>
    syncFootRoutesOverlayNow(map, enabled, activeBaseLayer),
  );
}
