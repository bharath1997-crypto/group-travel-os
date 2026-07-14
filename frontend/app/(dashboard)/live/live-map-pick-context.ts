import type { LiveGeocodingReverseResult } from "./live-geocoding";
import { extractCityCountry, buildPlaceKey } from "./live-place-key";
import { normalizePlaceCategory } from "./live-geocoding";
import type { PlacePreviewData } from "./PlacePreviewCard";

const COUNTRY_CONTINENT: Record<string, string> = {
  AF: "Asia",
  AL: "Europe",
  DZ: "Africa",
  AD: "Europe",
  AO: "Africa",
  AG: "North America",
  AR: "South America",
  AM: "Asia",
  AU: "Oceania",
  AT: "Europe",
  AZ: "Asia",
  BS: "North America",
  BH: "Asia",
  BD: "Asia",
  BB: "North America",
  BY: "Europe",
  BE: "Europe",
  BZ: "North America",
  BJ: "Africa",
  BT: "Asia",
  BO: "South America",
  BA: "Europe",
  BW: "Africa",
  BR: "South America",
  BN: "Asia",
  BG: "Europe",
  BF: "Africa",
  BI: "Africa",
  KH: "Asia",
  CM: "Africa",
  CA: "North America",
  CV: "Africa",
  CF: "Africa",
  TD: "Africa",
  CL: "South America",
  CN: "Asia",
  CO: "South America",
  KM: "Africa",
  CG: "Africa",
  CD: "Africa",
  CR: "North America",
  CI: "Africa",
  HR: "Europe",
  CU: "North America",
  CY: "Asia",
  CZ: "Europe",
  DK: "Europe",
  DJ: "Africa",
  DM: "North America",
  DO: "North America",
  EC: "South America",
  EG: "Africa",
  SV: "North America",
  GQ: "Africa",
  ER: "Africa",
  EE: "Europe",
  SZ: "Africa",
  ET: "Africa",
  FJ: "Oceania",
  FI: "Europe",
  FR: "Europe",
  GA: "Africa",
  GM: "Africa",
  GE: "Asia",
  DE: "Europe",
  GH: "Africa",
  GR: "Europe",
  GD: "North America",
  GT: "North America",
  GN: "Africa",
  GW: "Africa",
  GY: "South America",
  HT: "North America",
  HN: "North America",
  HU: "Europe",
  IS: "Europe",
  IN: "Asia",
  ID: "Asia",
  IR: "Asia",
  IQ: "Asia",
  IE: "Europe",
  IL: "Asia",
  IT: "Europe",
  JM: "North America",
  JP: "Asia",
  JO: "Asia",
  KZ: "Asia",
  KE: "Africa",
  KI: "Oceania",
  KW: "Asia",
  KG: "Asia",
  LA: "Asia",
  LV: "Europe",
  LB: "Asia",
  LS: "Africa",
  LR: "Africa",
  LY: "Africa",
  LI: "Europe",
  LT: "Europe",
  LU: "Europe",
  MG: "Africa",
  MW: "Africa",
  MY: "Asia",
  MV: "Asia",
  ML: "Africa",
  MT: "Europe",
  MH: "Oceania",
  MR: "Africa",
  MU: "Africa",
  MX: "North America",
  FM: "Oceania",
  MD: "Europe",
  MC: "Europe",
  MN: "Asia",
  ME: "Europe",
  MA: "Africa",
  MZ: "Africa",
  MM: "Asia",
  NA: "Africa",
  NR: "Oceania",
  NP: "Asia",
  NL: "Europe",
  NZ: "Oceania",
  NI: "North America",
  NE: "Africa",
  NG: "Africa",
  KP: "Asia",
  MK: "Europe",
  NO: "Europe",
  OM: "Asia",
  PK: "Asia",
  PW: "Oceania",
  PA: "North America",
  PG: "Oceania",
  PY: "South America",
  PE: "South America",
  PH: "Asia",
  PL: "Europe",
  PT: "Europe",
  QA: "Asia",
  RO: "Europe",
  RU: "Europe",
  RW: "Africa",
  KN: "North America",
  LC: "North America",
  VC: "North America",
  WS: "Oceania",
  SM: "Europe",
  ST: "Africa",
  SA: "Asia",
  SN: "Africa",
  RS: "Europe",
  SC: "Africa",
  SL: "Africa",
  SG: "Asia",
  SK: "Europe",
  SI: "Europe",
  SB: "Oceania",
  SO: "Africa",
  ZA: "Africa",
  KR: "Asia",
  SS: "Africa",
  ES: "Europe",
  LK: "Asia",
  SD: "Africa",
  SR: "South America",
  SE: "Europe",
  CH: "Europe",
  SY: "Asia",
  TW: "Asia",
  TJ: "Asia",
  TZ: "Africa",
  TH: "Asia",
  TL: "Asia",
  TG: "Africa",
  TO: "Oceania",
  TT: "North America",
  TN: "Africa",
  TR: "Asia",
  TM: "Asia",
  TV: "Oceania",
  UG: "Africa",
  UA: "Europe",
  AE: "Asia",
  GB: "Europe",
  US: "North America",
  UY: "South America",
  UZ: "Asia",
  VU: "Oceania",
  VA: "Europe",
  VE: "South America",
  VN: "Asia",
  YE: "Asia",
  ZM: "Africa",
  ZW: "Africa",
};

export type MapPickTerrainContext = {
  terrainHint: string | null;
  mapPresenceNote: string;
  dataSparse: boolean;
};

export function formatMapCoordinates(lat: number, lng: number): string {
  const latDir = lat >= 0 ? "N" : "S";
  const lngDir = lng >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(5)}° ${latDir}, ${Math.abs(lng).toFixed(5)}° ${lngDir}`;
}

export function formatDecimalCoordinates(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

export function continentFromCountryCode(code: string | null | undefined): string | null {
  if (!code?.trim()) return null;
  return COUNTRY_CONTINENT[code.trim().toUpperCase()] ?? null;
}

function extractState(address?: Record<string, string>): string | null {
  if (!address) return null;
  return address.state || address.region || address.province || address.state_district || null;
}

function extractPostcode(address?: Record<string, string>): string | null {
  if (!address) return null;
  return address.postcode || null;
}

function extractSettlementName(address?: Record<string, string>, details?: LiveGeocodingReverseResult): string | null {
  if (details?.name?.trim()) return details.name.trim();
  if (!address) return null;
  return (
    address.village ||
    address.hamlet ||
    address.town ||
    address.city ||
    address.municipality ||
    address.locality ||
    address.isolated_dwelling ||
    null
  );
}

function hasStructuredAddress(address?: Record<string, string>): boolean {
  if (!address) return false;
  return Boolean(
    address.road ||
      address.house_number ||
      address.city ||
      address.town ||
      address.village ||
      address.municipality ||
      address.postcode,
  );
}

export function inferMapPickTerrainContext(
  details: LiveGeocodingReverseResult | null,
): MapPickTerrainContext {
  if (!details) {
    return {
      terrainHint: "No address data available for this point",
      mapPresenceNote: "Not clearly on map — coordinates only",
      dataSparse: true,
    };
  }

  const cls = (details.class || "").toLowerCase();
  const type = (details.type || "").toLowerCase();
  const tags = { ...(details.extratags || {}), ...(details.address || {}) };
  const natural = (tags.natural || "").toLowerCase();
  const landuse = (tags.landuse || "").toLowerCase();
  const leisure = (tags.leisure || "").toLowerCase();
  const settlement = extractSettlementName(details.address, details);
  const structured = hasStructuredAddress(details.address);

  let terrainHint: string | null = null;

  if (natural === "wood" || natural === "forest" || landuse === "forest" || type === "forest") {
    terrainHint = "Forest or woodland";
  } else if (natural === "peak" || type === "peak" || natural === "ridge") {
    terrainHint = "Mountain or high ground";
  } else if (natural === "wetland" || natural === "marsh" || natural === "swamp") {
    terrainHint = "Wetland or marsh";
  } else if (natural === "water" || natural === "bay" || cls === "waterway") {
    terrainHint = "Water or shoreline";
  } else if (landuse === "farmland" || landuse === "meadow") {
    terrainHint = "Open countryside";
  } else if (leisure === "nature_reserve" || landuse === "conservation") {
    terrainHint = "Protected nature area";
  } else if (type === "isolated_dwelling" || type === "hamlet") {
    terrainHint = "Remote settlement";
  } else if (!settlement && !structured) {
    terrainHint = "Remote or unmapped terrain";
  }

  let mapPresenceNote: string;
  if (settlement || (details.name && cls !== "natural" && cls !== "landuse")) {
    mapPresenceNote = "Named place on OpenStreetMap";
  } else if (terrainHint) {
    mapPresenceNote = "Area is on the map, but not as a named street address";
  } else if (!structured) {
    mapPresenceNote = "Not clearly on map — limited location data";
  } else {
    mapPresenceNote = "Mapped location";
  }

  const dataSparse = !settlement && !structured && !details.name;

  return { terrainHint, mapPresenceNote, dataSparse };
}

function formatFullAddress(
  address?: Record<string, string>,
  fallback?: string,
): string {
  if (!address) return fallback || "";
  const line1 = [address.house_number, address.road].filter(Boolean).join(" ");
  const locality =
    address.village ||
    address.hamlet ||
    address.town ||
    address.city ||
    address.municipality;
  const line2 = [locality, extractState(address), extractPostcode(address)]
    .filter(Boolean)
    .join(", ");
  const line3 = address.country || null;
  const formatted = [line1, line2, line3].filter(Boolean).join(", ");
  return formatted || fallback || "";
}

export function buildPlaceFromMapPick(
  lat: number,
  lng: number,
  details: LiveGeocodingReverseResult | null,
  userLoc: { lat: number; lng: number } | null,
): PlacePreviewData {
  const terrain = inferMapPickTerrainContext(details);
  const roundedLat = Math.round(lat * 100000) / 100000;
  const roundedLng = Math.round(lng * 100000) / 100000;
  const coordinates = formatDecimalCoordinates(roundedLat, roundedLng);

  if (!details) {
    return {
      name: "Selected coordinates",
      categoryLabel: "Coordinates",
      address: coordinates,
      phone: null,
      lat,
      lng,
      distanceM: userLoc ? haversineM(userLoc.lat, userLoc.lng, lat, lng) : null,
      openingHours: null,
      openStatus: null,
      placeKey: `map-pick:${roundedLat},${roundedLng}`,
      osmType: null,
      osmId: null,
      city: null,
      state: null,
      country: null,
      postcode: null,
      continent: null,
      terrainHint: terrain.terrainHint,
      mapPresenceNote: terrain.mapPresenceNote,
      coordinatesLabel: formatMapCoordinates(lat, lng),
      source: "map_pick",
      tags: {},
    };
  }

  const reverseGeo = extractCityCountry(details.address);
  const state = extractState(details.address);
  const postcode = extractPostcode(details.address);
  const countryCode = details.address?.country_code;
  const continent = continentFromCountryCode(countryCode);
  const settlement = extractSettlementName(details.address, details);
  const name =
    settlement ||
    details.display_name?.split(",")[0]?.trim() ||
    "Selected location";
  const categoryLabel =
    normalizePlaceCategory(details) ||
    (details.extratags ? normalizePlaceCategory(details.extratags) : null) ||
    (terrain.terrainHint ? terrain.terrainHint : "Location");
  const city = reverseGeo.city ?? null;
  const country = reverseGeo.country ?? null;
  const placeKey = buildPlaceKey({
    name,
    lat,
    lng,
    city,
    country,
    osmType: details.osm_type,
    osmId: details.osm_id,
  });

  return {
    name,
    categoryLabel,
    address: formatFullAddress(details.address, details.display_name),
    phone:
      details.extratags?.phone ||
      details.extratags?.["contact:phone"] ||
      null,
    lat,
    lng,
    distanceM: userLoc ? haversineM(userLoc.lat, userLoc.lng, lat, lng) : null,
    openingHours: details.extratags?.opening_hours ?? null,
    openStatus: details.extratags?.opening_hours ? "Open Now" : null,
    placeKey,
    osmType: details.osm_type ?? null,
    osmId: details.osm_id ?? null,
    city,
    state,
    country,
    postcode,
    continent,
    terrainHint: terrain.terrainHint,
    mapPresenceNote: terrain.mapPresenceNote,
    coordinatesLabel: formatMapCoordinates(lat, lng),
    source: "map_pick",
    tags: { ...(details.extratags || {}), ...(details.address || {}) },
  };
}

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
