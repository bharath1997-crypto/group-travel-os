import type { Map as MaplibreMap, MapGeoJSONFeature } from "maplibre-gl";
import { haversineM } from "@/lib/geo";
import type { AutocompleteResult } from "./live-geocoding";
import { normalizePlaceCategory } from "./live-geocoding";

const VECTOR_SOURCE_ID = "openmaptiles";
const LABEL_SOURCE_LAYERS = ["poi", "place", "aerodrome_label"] as const;
const ADDRESS_SOURCE_LAYERS = ["housenumber", "building"] as const;

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

function getHouseNumberFromProps(props: Record<string, unknown>): string | null {
  const candidates = [props.housenumber, props["addr:housenumber"], props.house_number];
  for (const value of candidates) {
    if (value == null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return null;
}

function getStreetFromProps(props: Record<string, unknown>): string | null {
  const candidates = [props["addr:street"], props.street, props.name];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function formatBuildingAddress(props: Record<string, unknown>): string {
  const houseNumber = getHouseNumberFromProps(props);
  const street = getStreetFromProps(props);
  if (houseNumber && street) return `${houseNumber} ${street}`;
  if (houseNumber) return houseNumber;
  if (street) return street;
  return "Address";
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

  if (geom.type === "Polygon") {
    const ring = (geom.coordinates as [number, number][][])[0];
    if (!ring?.length) return null;
    let sumLng = 0;
    let sumLat = 0;
    for (const [lng, lat] of ring) {
      sumLng += lng;
      sumLat += lat;
    }
    return { lat: sumLat / ring.length, lng: sumLng / ring.length };
  }

  if (geom.type === "MultiPolygon") {
    const multi = geom.coordinates as number[][][][];
    const ring = multi[0]?.[0] as [number, number][] | undefined;
    if (!ring?.length) return null;
    let sumLng = 0;
    let sumLat = 0;
    for (const [lng, lat] of ring) {
      sumLng += lng;
      sumLat += lat;
    }
    return { lat: sumLat / ring.length, lng: sumLng / ring.length };
  }

  return null;
}

function normalizeQuery(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ");
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

function parseAddressQuery(query: string): {
  houseNumber: string | null;
  streetTokens: string[];
} {
  const normalized = normalizeQuery(query);
  if (!normalized) return { houseNumber: null, streetTokens: [] };

  const leading = normalized.match(/^(\d+[a-z]?)\s+(.+)$/);
  if (leading) {
    return {
      houseNumber: leading[1],
      streetTokens: leading[2].split(/\s+/).filter((t) => t.length > 1),
    };
  }

  const trailing = normalized.match(/^(.+?)\s+(\d+[a-z]?)$/);
  if (trailing) {
    return {
      houseNumber: trailing[2],
      streetTokens: trailing[1].split(/\s+/).filter((t) => t.length > 1),
    };
  }

  if (/^\d+[a-z]?$/.test(normalized)) {
    return { houseNumber: normalized, streetTokens: [] };
  }

  return { houseNumber: null, streetTokens: normalized.split(/\s+/).filter((t) => t.length > 1) };
}

function addressMatchScore(props: Record<string, unknown>, query: string): number {
  const houseNumber = getHouseNumberFromProps(props);
  const street = getStreetFromProps(props);
  const formatted = formatBuildingAddress(props);
  const direct = textMatchScore(formatted, query);
  if (direct > 0) return direct + 15;

  const parsed = parseAddressQuery(query);
  if (!houseNumber) return 0;

  let score = 0;
  if (parsed.houseNumber) {
    const qNum = parsed.houseNumber.toLowerCase();
    const propNum = houseNumber.toLowerCase();
    if (propNum === qNum) score += 95;
    else if (propNum.startsWith(qNum)) score += 75;
    else return 0;
  }

  if (parsed.streetTokens.length > 0 && street) {
    const streetNorm = normalizeQuery(street);
    const matched = parsed.streetTokens.filter((token) => streetNorm.includes(token)).length;
    if (matched === 0) return 0;
    score += matched * 12;
  } else if (parsed.streetTokens.length === 0 && parsed.houseNumber) {
    score += 10;
  }

  return score;
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

function pushMatch(
  matches: AutocompleteResult[],
  seen: Set<string>,
  feature: MapGeoJSONFeature,
  coords: { lat: number; lng: number },
  anchor: { lat: number; lng: number } | null,
  score: number,
  name: string,
  address: string,
  category: string,
  matchType: AutocompleteResult["matchType"],
) {
  const id = buildFeatureId(feature, coords.lat, coords.lng);
  if (seen.has(id)) return;
  seen.add(id);

  const distanceMeters = anchor
    ? haversineM(anchor.lat, anchor.lng, coords.lat, coords.lng)
    : null;

  matches.push({
    id,
    placeKey: id,
    name,
    category,
    address,
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
    matchType,
    score,
    tags: (feature.properties || {}) as Record<string, string>,
  });
}

function searchAddressFeatures(
  map: MaplibreMap,
  query: string,
  anchor: { lat: number; lng: number } | null,
  viewport: { west: number; south: number; east: number; north: number },
  seen: Set<string>,
  matches: AutocompleteResult[],
) {
  for (const sourceLayer of ADDRESS_SOURCE_LAYERS) {
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
      const houseNumber = getHouseNumberFromProps(props);
      if (!houseNumber) continue;

      const score = addressMatchScore(props, query);
      if (score <= 0) continue;

      const coords = getFeatureCoordinates(feature);
      if (!coords) continue;
      if (!isInsideBounds(coords.lat, coords.lng, viewport)) continue;

      const street = getStreetFromProps(props);
      const address = formatBuildingAddress(props);
      const name = street ? `${houseNumber} ${street}` : houseNumber;

      pushMatch(
        matches,
        seen,
        feature,
        coords,
        anchor,
        score,
        name,
        address,
        "Address",
        "map_address",
      );
    }
  }
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

  searchAddressFeatures(map, q, anchor, viewport, seen, matches);

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

      const category = featureCategoryLabel(feature);

      let score = textScore > 0 ? textScore : 40;
      if (sourceLayer === "poi") score += 10;
      const distanceMeters = anchor
        ? haversineM(anchor.lat, anchor.lng, coords.lat, coords.lng)
        : null;
      if (distanceMeters != null) score -= Math.min(distanceMeters / 100, 40);

      pushMatch(
        matches,
        seen,
        feature,
        coords,
        anchor,
        score,
        name,
        category,
        category,
        "map_label",
      );
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
  const houseNumber = getHouseNumberFromProps(props);
  const street = getStreetFromProps(props);
  const address = houseNumber ? formatBuildingAddress(props) : featureCategoryLabel(feature);
  const name =
    getFeatureLabelName(props) ||
    (houseNumber && street ? `${houseNumber} ${street}` : houseNumber) ||
    "Place";
  const coords = getFeatureCoordinates(feature) || { lat: clickLat, lng: clickLng };
  const id = buildFeatureId(feature, coords.lat, coords.lng);
  const category = houseNumber ? "Address" : featureCategoryLabel(feature);

  return {
    name,
    categoryLabel: category,
    address,
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
