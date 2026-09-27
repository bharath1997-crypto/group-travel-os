import type { Map as MaplibreMap, MapGeoJSONFeature, PointLike } from "maplibre-gl";

const ROAD_HIGHWAY_VALUES = new Set([
  "motorway",
  "trunk",
  "primary",
  "secondary",
  "tertiary",
  "unclassified",
  "residential",
  "service",
  "track",
  "path",
  "footway",
  "cycleway",
  "steps",
  "living_street",
  "pedestrian",
]);

const BLOCKED_SOURCE_LAYERS = new Set([
  "transportation",
  "transportation_name",
  "water",
  "waterway",
  "water_name",
  "boundary",
  "building",
  "housenumber",
]);

const ALLOWED_SOURCE_LAYERS = new Set([
  "poi",
  "place",
  "aerodrome_label",
  "park",
]);

const ALLOWED_LANDUSE = new Set(["park", "recreation_ground", "grass", "plaza", "village_green"]);

function layerSourceLayer(feature: MapGeoJSONFeature): string {
  const fromFeature = feature.sourceLayer;
  if (typeof fromFeature === "string" && fromFeature) return fromFeature;
  const fromLayer = (feature.layer as { "source-layer"?: string } | undefined)?.["source-layer"];
  return typeof fromLayer === "string" ? fromLayer : "";
}

export function isRoadOrLineInfrastructure(props: Record<string, unknown>): boolean {
  const highway = props.highway;
  if (typeof highway === "string" && ROAD_HIGHWAY_VALUES.has(highway)) return true;
  if (props.railway || props.aerialway) return true;
  const cls = String(props.class ?? "").toLowerCase();
  if (cls === "highway" || cls === "road" || cls === "rail") return true;
  return false;
}

/** True when the feature represents a visitable place, not a road/label/boundary. */
export function isSelectablePlaceFeature(feature: MapGeoJSONFeature): boolean {
  const props = (feature.properties || {}) as Record<string, unknown>;
  const sourceLayer = layerSourceLayer(feature);

  if (isRoadOrLineInfrastructure(props)) return false;
  if (BLOCKED_SOURCE_LAYERS.has(sourceLayer)) return false;

  if (ALLOWED_SOURCE_LAYERS.has(sourceLayer)) return true;

  if (sourceLayer === "landuse") {
    const landClass = String(props.class ?? props.subclass ?? "").toLowerCase();
    return ALLOWED_LANDUSE.has(landClass);
  }

  if (props.amenity || props.shop || props.tourism || props.leisure || props.healthcare) {
    return true;
  }

  if (props.public_transport === "station" || props.railway === "station") return true;

  return false;
}

export function scorePlacePickFeature(feature: MapGeoJSONFeature): number {
  if (!isSelectablePlaceFeature(feature)) return 0;

  const props = (feature.properties || {}) as Record<string, unknown>;
  const hasName = !!(props.name || props.display_name || props.title);
  const sourceLayer = layerSourceLayer(feature);
  const isSymbol = feature.layer?.type === "symbol";

  if (sourceLayer === "poi" && hasName && isSymbol) return 100;
  if (sourceLayer === "poi" && hasName) return 95;
  if (props.amenity || props.shop || props.tourism) return 90;
  if (sourceLayer === "place" && hasName) return 85;
  if (sourceLayer === "landuse" && hasName) return 80;
  if (hasName) return 70;
  return 50;
}

/** Symbol / polygon layers eligible for place pick queries. */
export function getPlacePickLayerIds(map: MaplibreMap): string[] {
  const style = map.getStyle();
  if (!style?.layers) return [];

  return style.layers
    .filter((layer) => {
      const type = layer.type;
      if (type !== "symbol" && type !== "fill") return false;

      const id = layer.id.toLowerCase();
      const srcLayer = String((layer as { "source-layer"?: string })["source-layer"] ?? "").toLowerCase();

      if (/road|highway|rail|transport|boundary|water|housenumber|building/.test(id)) {
        if (srcLayer === "poi" || srcLayer === "place") return true;
        return false;
      }

      if (ALLOWED_SOURCE_LAYERS.has(srcLayer)) return true;
      if (srcLayer === "landuse" && type === "fill") return true;
      if (id.includes("poi")) return true;
      return false;
    })
    .map((layer) => layer.id);
}

export function queryPlacePickFeatures(
  map: MaplibreMap,
  point: { x: number; y: number },
  radiusPx = 16,
): MapGeoJSONFeature[] {
  const bbox: [PointLike, PointLike] = [
    [point.x - radiusPx, point.y - radiusPx],
    [point.x + radiusPx, point.y + radiusPx],
  ];

  const layerIds = getPlacePickLayerIds(map);
  let features: MapGeoJSONFeature[] = [];

  try {
    features =
      layerIds.length > 0
        ? (map.queryRenderedFeatures(bbox, { layers: layerIds }) as MapGeoJSONFeature[])
        : (map.queryRenderedFeatures(bbox) as MapGeoJSONFeature[]);
  } catch {
    features = [];
  }

  if (features.length === 0 && radiusPx < 24) {
    const wide: [PointLike, PointLike] = [
      [point.x - 24, point.y - 24],
      [point.x + 24, point.y + 24],
    ];
    try {
      features =
        layerIds.length > 0
          ? (map.queryRenderedFeatures(wide, { layers: layerIds }) as MapGeoJSONFeature[])
          : (map.queryRenderedFeatures(wide) as MapGeoJSONFeature[]);
    } catch {
      features = [];
    }
  }

  return features.filter(isSelectablePlaceFeature);
}

export function pickTopPlaceFeature(
  features: MapGeoJSONFeature[],
): MapGeoJSONFeature | null {
  const ranked = features
    .map((feature) => ({ feature, score: scorePlacePickFeature(feature) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);
  return ranked[0]?.feature ?? null;
}
