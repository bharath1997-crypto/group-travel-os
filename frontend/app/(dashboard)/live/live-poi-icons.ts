import { normalizePlaceCategory } from "./live-geocoding";

export type PoiMapPlace = {
  name?: string;
  category?: string;
  categoryLabel?: string;
  tags?: Record<string, unknown>;
};

const CATEGORY_ICON_MAP: Record<string, string> = {
  "Gas station": "⛽",
  Restaurant: "🍽️",
  "Fast food": "🍔",
  "Liquor store": "🍾",
  "Beverage store": "🍷",
  Cafe: "☕",
  "Coffee shop": "☕",
  Bar: "🍺",
  Pub: "🍺",
  Church: "⛪",
  Mosque: "🕌",
  Synagogue: "✡️",
  Temple: "🛕",
  "Place of worship": "🙏",
  Library: "📚",
  School: "🏫",
  College: "🎓",
  University: "🎓",
  Park: "🌳",
  Playground: "🛝",
  Museum: "🏛️",
  Gallery: "🖼️",
  Attraction: "⭐",
  Monument: "🗿",
  Memorial: "🕊️",
  Viewpoint: "👁️",
  Hotel: "🏨",
  Motel: "🏨",
  Hospital: "🏥",
  Clinic: "🏥",
  Pharmacy: "💊",
  Parking: "🅿️",
  Restroom: "🚻",
  ATM: "🏧",
  Bank: "🏦",
  "Bus stop": "🚌",
  "Transit stop": "🚉",
  Waterfall: "💧",
  Mountain: "⛰️",
  Forest: "🌲",
  Beach: "🏖️",
  Lake: "🏞️",
  River: "🌊",
  Port: "⚓",
  Marina: "⚓",
  Stadium: "🏟️",
  "Fitness center": "💪",
  "Sports center": "⚽",
  "Convenience store": "🏪",
  Supermarket: "🛒",
  Shop: "🛍️",
  Address: "📌",
  Building: "🏠",
  Place: "📍",
};

const LANDMARK_CATEGORIES = new Set([
  "Attraction",
  "Monument",
  "Memorial",
  "Museum",
  "Gallery",
  "Viewpoint",
  "Waterfall",
  "Mountain",
  "National park",
  "Artwork",
  "Historic",
  "Landmark",
]);

const LANDMARK_TAG_HINTS = new Set([
  "monument",
  "memorial",
  "attraction",
  "museum",
  "gallery",
  "viewpoint",
  "artwork",
  "historic",
]);

function titleCase(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function resolvePlaceCategoryLabel(place: PoiMapPlace): string {
  const fromTags = normalizePlaceCategory(place.tags);
  if (fromTags) return fromTags;
  const raw = (place.categoryLabel || place.category || "").trim();
  if (raw && !/^(node|way|relation)$/i.test(raw)) return raw;
  return "Place";
}

export function resolvePoiMapIcon(place: PoiMapPlace): string {
  const label = resolvePlaceCategoryLabel(place);
  if (CATEGORY_ICON_MAP[label]) return CATEGORY_ICON_MAP[label];

  const lower = label.toLowerCase();
  for (const [key, icon] of Object.entries(CATEGORY_ICON_MAP)) {
    if (lower.includes(key.toLowerCase())) return icon;
  }

  const tags = place.tags || {};
  const historic = tags.historic;
  if (typeof historic === "string" && LANDMARK_TAG_HINTS.has(historic)) {
    if (historic === "monument") return "🗿";
    if (historic === "memorial") return "🕊️";
    return "⭐";
  }

  const tourism = tags.tourism;
  if (typeof tourism === "string") {
    if (tourism === "museum") return "🏛️";
    if (tourism === "gallery") return "🖼️";
    if (tourism === "attraction") return "⭐";
    if (tourism === "viewpoint") return "👁️";
    if (tourism === "artwork") return "🎨";
  }

  const amenity = tags.amenity;
  if (typeof amenity === "string") {
    return CATEGORY_ICON_MAP[titleCase(amenity)] || "📍";
  }

  return "📍";
}

export function isLandmarkPlace(place: PoiMapPlace): boolean {
  const label = resolvePlaceCategoryLabel(place);
  if (LANDMARK_CATEGORIES.has(label)) return true;

  const lower = label.toLowerCase();
  if (lower.includes("landmark") || lower.includes("monument") || lower.includes("memorial")) {
    return true;
  }

  const tags = place.tags || {};
  if (typeof tags.historic === "string" && LANDMARK_TAG_HINTS.has(tags.historic)) return true;
  if (tags.tourism === "attraction" || tags.tourism === "museum" || tags.tourism === "viewpoint") {
    return true;
  }
  if (tags.natural === "peak" || tags.natural === "waterfall") return true;

  const name = (place.name || "").toLowerCase();
  if (/\b(monument|memorial|landmark|historic)\b/.test(name)) return true;

  return false;
}

export function getPoiMarkerPresentation(place: PoiMapPlace): {
  icon: string;
  background: string;
  size: number;
  landmark: boolean;
} {
  const landmark = isLandmarkPlace(place);
  return {
    icon: resolvePoiMapIcon(place),
    background: landmark ? "#D97706" : "#0F766E",
    size: landmark ? 26 : 22,
    landmark,
  };
}
