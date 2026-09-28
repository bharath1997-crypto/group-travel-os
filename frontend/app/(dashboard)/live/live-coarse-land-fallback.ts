import { formatMapCoordinates } from "./live-map-pick-context";
import type { PlacePreviewData } from "./live-place-preview-data";

type CoarseLandRegion = {
  name: string;
  country: string;
  localityType: string;
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
};

/** Offline bounding boxes for remote land when Nominatim reverse is unavailable. */
const COARSE_LAND_REGIONS: CoarseLandRegion[] = [
  {
    name: "Greenland",
    country: "Greenland",
    localityType: "Territory",
    minLat: 59.5,
    maxLat: 83.8,
    minLng: -73.5,
    maxLng: -11.5,
  },
  {
    name: "Iceland",
    country: "Iceland",
    localityType: "Country",
    minLat: 63.2,
    maxLat: 66.8,
    minLng: -24.8,
    maxLng: -13.2,
  },
  {
    name: "Svalbard",
    country: "Norway",
    localityType: "Territory",
    minLat: 76.0,
    maxLat: 81.0,
    minLng: 10.0,
    maxLng: 35.0,
  },
  {
    name: "Faroe Islands",
    country: "Faroe Islands",
    localityType: "Territory",
    minLat: 61.2,
    maxLat: 62.5,
    minLng: -7.8,
    maxLng: -6.2,
  },
];

export function resolveCoarseLandRegion(
  lat: number,
  lng: number,
): Pick<CoarseLandRegion, "name" | "country" | "localityType"> | null {
  for (const region of COARSE_LAND_REGIONS) {
    if (
      lat >= region.minLat &&
      lat <= region.maxLat &&
      lng >= region.minLng &&
      lng <= region.maxLng
    ) {
      return {
        name: region.name,
        country: region.country,
        localityType: region.localityType,
      };
    }
  }
  return null;
}

export function buildCoarseLandFallbackPlace(
  lat: number,
  lng: number,
  userLoc: { lat: number; lng: number } | null,
  source: PlacePreviewData["source"] = "dropped_pin",
): PlacePreviewData | null {
  const region = resolveCoarseLandRegion(lat, lng);
  if (!region) return null;

  const coordinates = formatMapCoordinates(lat, lng);
  const roundedLat = Math.round(lat * 100000) / 100000;
  const roundedLng = Math.round(lng * 100000) / 100000;

  return {
    name: region.name,
    categoryLabel: region.localityType,
    address: `${coordinates} · ${region.country}`,
    phone: null,
    lat,
    lng,
    distanceM: userLoc ? haversineM(userLoc.lat, userLoc.lng, lat, lng) : null,
    openingHours: null,
    openStatus: null,
    placeKey: `coarse-land:${region.name.toLowerCase()}:${roundedLat},${roundedLng}`,
    osmType: null,
    osmId: null,
    city: region.name,
    state: null,
    country: region.country,
    localityType: region.localityType,
    localityName: region.name,
    coordinatesLabel: coordinates,
    mapPresenceNote: "Approximate region — geocoder unavailable, showing territory from map coordinates",
    source,
    tags: { coarse_land: "true" },
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
