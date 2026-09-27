import type maplibregl from "maplibre-gl";
import type { LiveMapLayer } from "@/lib/map-providers";
import { LIVE_SEA_ROUTES_GEOJSON } from "@/lib/live-sea-routes-data";
import {
  getSeaRouteLayerPaint,
  SEA_ROUTE_FILTERS,
  SEA_ROUTES_LAYER_IDS,
  SEA_ROUTES_SOURCE_ID,
  type SeaRouteCategory,
  type SeaRoutesOverlayState,
} from "@/lib/live-sea-routes";
import { travelLayerBeforeId } from "@/lib/live-travel-layer";
import { whenMapStyleReady } from "./live-travel-layer-sync";

const CATEGORY_LAYER_IDS: Record<
  SeaRouteCategory,
  { casing: string; core: string }
> = {
  shipping: {
    casing: SEA_ROUTES_LAYER_IDS.shippingCasing,
    core: SEA_ROUTES_LAYER_IDS.shipping,
  },
  ferry: {
    casing: SEA_ROUTES_LAYER_IDS.ferryCasing,
    core: SEA_ROUTES_LAYER_IDS.ferry,
  },
  cruise: {
    casing: SEA_ROUTES_LAYER_IDS.cruiseCasing,
    core: SEA_ROUTES_LAYER_IDS.cruise,
  },
};

function ensureSource(map: maplibregl.Map): void {
  if (map.getSource(SEA_ROUTES_SOURCE_ID)) return;
  map.addSource(SEA_ROUTES_SOURCE_ID, {
    type: "geojson",
    data: LIVE_SEA_ROUTES_GEOJSON,
    lineMetrics: true,
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
      /* unsupported paint on this layer version */
    }
  }
}

function ensurePairLayer(
  map: maplibregl.Map,
  category: SeaRouteCategory,
  activeBaseLayer: LiveMapLayer,
  beforeId: string | undefined,
): void {
  const spec = getSeaRouteLayerPaint(category, activeBaseLayer);
  const ids = CATEGORY_LAYER_IDS[category];
  const filter = SEA_ROUTE_FILTERS[category];

  const addOrUpdate = (
    layerId: string,
    paint: maplibregl.LineLayerSpecification["paint"],
    layout: maplibregl.LineLayerSpecification["layout"],
  ) => {
    if (map.getLayer(layerId)) {
      applyPaint(map, layerId, paint);
      map.setLayerZoomRange(layerId, spec.minzoom, 22);
      return;
    }
    map.addLayer(
      {
        id: layerId,
        type: "line",
        source: SEA_ROUTES_SOURCE_ID,
        filter,
        layout,
        paint,
        minzoom: spec.minzoom,
      },
      beforeId,
    );
  };

  addOrUpdate(ids.casing, spec.casing, {
    "line-cap": "round",
    "line-join": "round",
  });
  addOrUpdate(ids.core, spec.core, {
    "line-cap": "round",
    "line-join": "round",
  });
}

function removeCategoryPair(map: maplibregl.Map, category: SeaRouteCategory): void {
  const ids = CATEGORY_LAYER_IDS[category];
  removeLayerIfPresent(map, ids.core);
  removeLayerIfPresent(map, ids.casing);
}

const LEGACY_LAYER_IDS = ["rovvy-sea-shipping", "rovvy-sea-ferry", "rovvy-sea-cruise"];

export function syncSeaRoutesOverlayNow(
  map: maplibregl.Map,
  state: SeaRoutesOverlayState,
  activeBaseLayer: LiveMapLayer,
): void {
  for (const legacyId of LEGACY_LAYER_IDS) {
    removeLayerIfPresent(map, legacyId);
  }
  const beforeId = travelLayerBeforeId(map.getStyle()?.layers);
  const anyEnabled = state.seaRoutesEnabled || state.cruiseRoutesEnabled;

  if (!anyEnabled) {
    for (const category of ["shipping", "ferry", "cruise"] as SeaRouteCategory[]) {
      removeCategoryPair(map, category);
    }
    try {
      if (map.getSource(SEA_ROUTES_SOURCE_ID)) map.removeSource(SEA_ROUTES_SOURCE_ID);
    } catch {
      /* style switching */
    }
    return;
  }

  ensureSource(map);

  if (state.seaRoutesEnabled) {
    ensurePairLayer(map, "shipping", activeBaseLayer, beforeId);
    ensurePairLayer(map, "ferry", activeBaseLayer, beforeId);
  } else {
    removeCategoryPair(map, "shipping");
    removeCategoryPair(map, "ferry");
  }

  if (state.cruiseRoutesEnabled) {
    ensurePairLayer(map, "cruise", activeBaseLayer, beforeId);
  } else {
    removeCategoryPair(map, "cruise");
  }
}

export function syncSeaRoutesOverlay(
  map: maplibregl.Map,
  state: SeaRoutesOverlayState,
  activeBaseLayer: LiveMapLayer,
): void {
  whenMapStyleReady(map, () =>
    syncSeaRoutesOverlayNow(map, state, activeBaseLayer),
  );
}
