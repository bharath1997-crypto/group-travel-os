import type { LiveGeocodingReverseResult } from "./live-geocoding";
import { formatMapCoordinates } from "./live-map-pick-context";
import type { PlacePreviewData } from "./live-place-preview-data";

export const GENERIC_WATER_LABELS = new Set([
  "ocean",
  "sea",
  "water",
  "open ocean",
  "open water",
  "bay",
  "gulf",
  "strait",
  "place",
  "location",
  "address",
  "selected location",
  "dropped pin",
  "map pin",
]);

export const NAMED_OCEAN_BASIN_LABELS = new Set([
  "arctic ocean",
  "north atlantic ocean",
  "south atlantic ocean",
  "atlantic ocean",
  "north pacific ocean",
  "south pacific ocean",
  "pacific ocean",
  "indian ocean",
  "southern ocean",
  "open ocean",
]);

export function isGenericWaterLabel(name?: string | null): boolean {
  const normalized = name?.trim().toLowerCase();
  if (!normalized) return true;
  return GENERIC_WATER_LABELS.has(normalized);
}

export function isNamedOceanBasinLabel(name?: string | null): boolean {
  const normalized = name?.trim().toLowerCase();
  if (!normalized) return false;
  return NAMED_OCEAN_BASIN_LABELS.has(normalized);
}

export function hasLandAdminContext(address?: Record<string, string>): boolean {
  if (!address) return false;
  return Boolean(
    address.country?.trim() ||
      address.state?.trim() ||
      address.region?.trim() ||
      address.province?.trim() ||
      address.county?.trim() ||
      address.state_district?.trim() ||
      address.municipality?.trim() ||
      address.city?.trim() ||
      address.town?.trim() ||
      address.village?.trim() ||
      address.hamlet?.trim() ||
      address.island?.trim(),
  );
}

function isExplicitOpenWaterNatural(details: LiveGeocodingReverseResult): boolean {
  const cls = (details.class || "").toLowerCase();
  const type = (details.type || "").toLowerCase();
  const natural = String(details.extratags?.natural || details.address?.natural || "").toLowerCase();
  return (
    natural === "water" ||
    natural === "sea" ||
    natural === "bay" ||
    (cls === "natural" && (type === "water" || type === "sea")) ||
    cls === "waterway"
  );
}

export function isLandCoverGeocode(details: LiveGeocodingReverseResult): boolean {
  const natural = String(details.extratags?.natural || details.address?.natural || "").toLowerCase();
  const type = (details.type || "").toLowerCase();
  const cls = (details.class || "").toLowerCase();

  if (
    ["glacier", "bare_rock", "scree", "sand", "grassland", "heath", "scrub", "tundra", "land", "ice"].includes(
      natural,
    )
  ) {
    return true;
  }
  if (type === "glacier" || type === "administrative") return true;
  if (cls === "place" || cls === "boundary" || cls === "landuse") return true;
  return false;
}

export function isWaterMapFeature(props: Record<string, unknown>): boolean {
  if (isNamedOceanBasinLabel(String(props.name || props["name:en"] || ""))) {
    return false;
  }

  const cls = String(props.class || props.subclass || "").toLowerCase();
  const type = String(props.type || "").toLowerCase();
  const natural = String(props.natural || "").toLowerCase();
  const place = String(props.place || "").toLowerCase();

  if (cls === "water" || type === "water" || natural === "water" || natural === "sea" || natural === "bay") {
    return true;
  }
  if (place === "ocean" || place === "sea") return true;

  const label = String(props.name || props["name:en"] || "").trim();
  return isGenericWaterLabel(label) && (cls === "water" || natural === "water" || type === "water");
}

export function isWaterReverseGeocode(details: LiveGeocodingReverseResult): boolean {
  if (hasLandAdminContext(details.address) && !isExplicitOpenWaterNatural(details)) {
    return false;
  }
  if (isLandCoverGeocode(details)) return false;

  const cls = (details.class || "").toLowerCase();
  const type = (details.type || "").toLowerCase();
  const natural = String(details.extratags?.natural || details.address?.natural || "").toLowerCase();
  const settlement =
    details.address?.city ||
    details.address?.town ||
    details.address?.village ||
    details.address?.hamlet ||
    details.address?.municipality;

  if (natural === "water" || natural === "sea" || natural === "bay") return true;
  if (cls === "natural" && (type === "water" || type === "sea")) return true;
  if (cls === "waterway" && !settlement && !details.address?.country) return true;
  if (
    (isGenericWaterLabel(details.name) || isNamedOceanBasinLabel(details.name)) &&
    !settlement &&
    !details.address?.road &&
    !details.address?.country
  ) {
    return true;
  }

  return false;
}

/** Resolve a human ocean basin label from coordinates (open water, no named POI). */
export function resolveOceanRegionName(lat: number, lng: number): string {
  if (lat <= -60) return "Southern Ocean";
  if (lat >= 66) return "Arctic Ocean";

  const isPacific = lng >= 120 || lng <= -70;
  if (isPacific) {
    return lat >= 0 ? "North Pacific Ocean" : "South Pacific Ocean";
  }

  if (lng > -70 && lng <= 20) {
    return lat >= 0 ? "North Atlantic Ocean" : "South Atlantic Ocean";
  }

  if (lng > 20 && lng <= 120) {
    return "Indian Ocean";
  }

  return lat >= 0 ? "Open Ocean" : "Southern Ocean";
}

export function isOpenWaterPlace(
  place: Pick<PlacePreviewData, "categoryLabel" | "terrainHint" | "tags">,
): boolean {
  if (place.categoryLabel === "Open ocean") return true;
  if (place.terrainHint === "Open ocean") return true;
  return place.tags?.open_water === "true";
}

/** Open ocean / water — show coordinates only, no route preview or travel chrome. */
export function isUnroutableOpenWaterPlace(
  place:
    | Pick<PlacePreviewData, "name" | "categoryLabel" | "terrainHint" | "tags">
    | null
    | undefined,
): boolean {
  if (!place) return false;
  return isOpenWaterPlace(place) || isNamedOceanBasinLabel(place.name);
}

export function buildOpenWaterPlace(
  lat: number,
  lng: number,
  userLoc: { lat: number; lng: number } | null,
  source: PlacePreviewData["source"] = "map_click",
): PlacePreviewData {
  const roundedLat = Math.round(lat * 100000) / 100000;
  const roundedLng = Math.round(lng * 100000) / 100000;
  const coordinates = formatMapCoordinates(lat, lng);
  const name = resolveOceanRegionName(lat, lng);

  return {
    name,
    categoryLabel: "Open ocean",
    address: `${coordinates} · Open water, no street address`,
    phone: null,
    lat,
    lng,
    distanceM: userLoc ? haversineM(userLoc.lat, userLoc.lng, lat, lng) : null,
    openingHours: null,
    openStatus: null,
    placeKey: `open-water:${roundedLat},${roundedLng}`,
    osmType: null,
    osmId: null,
    city: null,
    state: null,
    country: null,
    postcode: null,
    continent: null,
    terrainHint: "Open ocean",
    mapPresenceNote: "Open water — coordinates only, not a bookable venue",
    coordinatesLabel: coordinates,
    source,
    tags: { open_water: "true" },
  };
}

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(a));
}
