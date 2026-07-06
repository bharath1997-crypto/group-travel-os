import type { Map as MaplibreMap, MapGeoJSONFeature } from "maplibre-gl";
import { haversineM } from "@/lib/geo";
import type { AutocompleteResult } from "./live-geocoding";
import { normalizePlaceCategory } from "./live-geocoding";

const VECTOR_SOURCE_ID = "openmaptiles";
const LABEL_SOURCE_LAYERS = ["poi", "place", "aerodrome_label"] as const;

export function mapSupportsLabelSearch(map: MaplibreMap | null | undefined): boolean {
  if (!map) return false;
  try {
    return !!map.getSource(VECTOR_SOURCE_ID);
  } catch {
    return false;
  }
}

export function getFeatureLabelName(props: Record<string, unknown>): string | null {
  const candidates = [props.name, props.name_en, props["name:latin"], props["name:en"]];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export function getFeatureCoordinates(
  feature: MapGeoJSONFeature,
): { lat: number; lng: number } | null {
  const geom = feature.geometry;
  if (!geom) return null;

  if (geom.type === "Point") {
    const [lng, lat] = geom.coordinates as [number, number];
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  }

  if (geom.type === "MultiPoint") {
    const first = (geom.coordinates as [number, number][])[0];
    if (!first) return null;
    const [lng, lat] = first;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  }

  return null;
}

function normalizeQuery(value: string): string {
  return value.trim().toLowerCase();
}

function textMatchScore(name: string, query: string): number {
  const n = normalizeQuery(name);
  const q = normalizeQuery(query);
  if (!n || !q) return 0;
  if (n === q) return 100;
  if (n.startsWith(q)) return 90;
  if (n.split(/\s+/).some((word) => word.startsWith(q))) return 80;
  if (n.includes(q)) return 60;
  const qWords = q.split(/\s+/).filter(Boolean);
  if (qWords.length > 1 && qWords.every((word) => n.includes(word))) return 55;
  return 0;
}

function featureCategoryLabel(feature: MapGeoJSONFeature): string {
  const props = feature.properties || {};
  const fromTags = normalizePlaceCategory(props);
  if (fromTags) return fromTags;
  const cls = props.class || props.subclass || props.type;
  if (typeof cls === "string" && cls.trim()) {
    return cls.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return "Place";
}

function buildFeatureId(feature: MapGeoJSONFeature, lat: number, lng: number): string {
  const props = feature.properties || {};
  const osmId = props.osm_id ?? props.id;
  const osmType = props.osm_type ?? feature.sourceLayer ?? "node";
  if (osmId != null) return `osm:${osmType}:${osmId}`;
  return `map-label:${lat.toFixed(5)},${lng.toFixed(5)}:${String(props.name || "place")}`;
}

function isInsideBounds(
  lat: number,
  lng: number,
  bounds: { west: number; south: number; east: number; north: number },
): boolean {
  return lng >= bounds.west && lng <= bounds.east && lat >= bounds.south && lat <= bounds.north;
}

export function searchVisibleMapLabels(
  map: MaplibreMap,
  query: string,
  anchor: { lat: number; lng: number } | null,
  limit = 8,
): AutocompleteResult[] {
  const q = query.trim();
  if (q.length < 2 || !mapSupportsLabelSearch(map)) return [];

  const bounds = map.getBounds();
  if (!bounds) return [];

  const viewport = {
    west: bounds.getWest(),
    south: bounds.getSouth(),
    east: bounds.getEast(),
    north: bounds.getNorth(),
  };

  const seen = new Set<string>();
  const matches: AutocompleteResult[] = [];

  for (const sourceLayer of LABEL_SOURCE_LAYERS) {
    let features: MapGeoJSONFeature[] = [];
    try {
      features = map.querySourceFeatures(VECTOR_SOURCE_ID, {
        sourceLayer,
      }) as MapGeoJSONFeature[];
    } catch {
      continue;
    }

    for (const feature of features) {
      const props = (feature.properties || {}) as Record<string, unknown>;
      const name = getFeatureLabelName(props);
      if (!name) continue;

      const textScore = textMatchScore(name, q);
      if (textScore <= 0) {
        const category = featureCategoryLabel(feature).toLowerCase();
        if (!category.includes(normalizeQuery(q))) continue;
      }

      const coords = getFeatureCoordinates(feature);
      if (!coords) continue;
      if (!isInsideBounds(coords.lat, coords.lng, viewport)) continue;

      const id = buildFeatureId(feature, coords.lat, coords.lng);
      if (seen.has(id)) continue;
      seen.add(id);

      const distanceMeters = anchor
        ? haversineM(anchor.lat, anchor.lng, coords.lat, coords.lng)
        : null;
      const category = featureCategoryLabel(feature);

      let score = textScore > 0 ? textScore : 40;
      if (sourceLayer === "poi") score += 10;
      if (distanceMeters != null) score -= Math.min(distanceMeters / 100, 40);

      matches.push({
        id,
        placeKey: id,
        name,
        category,
        address: category,
        lat: coords.lat,
        lng: coords.lng,
        distanceMeters,
        distanceLabel:
          distanceMeters == null
            ? null
            : distanceMeters > 160
              ? `${(distanceMeters / 1609.34).toFixed(1)} mi`
              : `${Math.round(distanceMeters)} m`,
        source: "osm_local",
        matchType: "map_label",
        score,
        tags: props as Record<string, string>,
      });
    }
  }

  matches.sort((a, b) => b.score - a.score);
  return matches.slice(0, limit);
}

export function mapLabelFeatureToPlacePreview(
  feature: MapGeoJSONFeature,
  clickLat: number,
  clickLng: number,
  userLoc: { lat: number; lng: number } | null,
) {
  const props = (feature.properties || {}) as Record<string, unknown>;
  const name = getFeatureLabelName(props) || "Place";
  const coords = getFeatureCoordinates(feature) || { lat: clickLat, lng: clickLng };
  const id = buildFeatureId(feature, coords.lat, coords.lng);
  const category = featureCategoryLabel(feature);

  return {
    name,
    categoryLabel: category,
    address: category,
    phone: null,
    lat: coords.lat,
    lng: coords.lng,
    distanceM: userLoc ? haversineM(userLoc.lat, userLoc.lng, coords.lat, coords.lng) : null,
    openingHours: null,
    openStatus: null,
    placeKey: id,
    osmType: typeof props.osm_type === "string" ? props.osm_type : null,
    osmId: props.osm_id != null ? Number(props.osm_id) : null,
    source: "map_label",
    tags: props as Record<string, string>,
  };
}
