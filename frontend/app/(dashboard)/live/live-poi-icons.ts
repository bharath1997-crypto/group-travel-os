import {
  Anchor,
  Banknote,
  Building2,
  Bus,
  Church,
  Coffee,
  Dumbbell,
  Film,
  Fuel,
  GraduationCap,
  Hospital,
  Hotel,
  Landmark,
  Library,
  MapPin,
  Mountain,
  Palmtree,
  ParkingCircle,
  Plane,
  ShoppingBag,
  Store,
  Trees,
  Trophy,
  Utensils,
  Waves,
  Wine,
  type LucideIcon,
} from "lucide-react";
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
  "Ferry terminal": "⛴️",
  Airport: "✈️",
  Helipad: "🚁",
  Cinema: "🎬",
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

const CATEGORY_LUCIDE_MAP: Record<string, LucideIcon> = {
  "Gas station": Fuel,
  Restaurant: Utensils,
  "Fast food": Utensils,
  "Liquor store": Wine,
  "Beverage store": Wine,
  Cafe: Coffee,
  "Coffee shop": Coffee,
  Bar: Wine,
  Pub: Wine,
  Church: Church,
  Mosque: Church,
  Synagogue: Church,
  Temple: Church,
  "Place of worship": Church,
  Library: Library,
  School: GraduationCap,
  College: GraduationCap,
  University: GraduationCap,
  Park: Trees,
  Playground: Trees,
  Museum: Landmark,
  Gallery: Landmark,
  Attraction: Landmark,
  Monument: Landmark,
  Memorial: Landmark,
  Viewpoint: Landmark,
  Hotel: Hotel,
  Motel: Hotel,
  Hospital: Hospital,
  Clinic: Hospital,
  Pharmacy: Building2,
  Parking: ParkingCircle,
  Restroom: Building2,
  ATM: Banknote,
  Bank: Banknote,
  "Bus stop": Bus,
  "Transit stop": Bus,
  Waterfall: Waves,
  Mountain: Mountain,
  Forest: Trees,
  Beach: Palmtree,
  Lake: Waves,
  River: Waves,
  Port: Anchor,
  Marina: Anchor,
  "Ferry terminal": Anchor,
  Airport: Plane,
  Helipad: Plane,
  Cinema: Film,
  Stadium: Trophy,
  "Fitness center": Dumbbell,
  "Sports center": Trophy,
  "Convenience store": Store,
  Supermarket: ShoppingBag,
  Shop: ShoppingBag,
  Address: MapPin,
  Building: Building2,
  Place: MapPin,
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
  "Beach",
  "Port",
  "Airport",
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

export function resolvePoiRowLucideIcon(place: PoiMapPlace): LucideIcon {
  const label = resolvePlaceCategoryLabel(place);
  if (CATEGORY_LUCIDE_MAP[label]) return CATEGORY_LUCIDE_MAP[label];

  const lower = label.toLowerCase();
  for (const [key, icon] of Object.entries(CATEGORY_LUCIDE_MAP)) {
    if (lower.includes(key.toLowerCase())) return icon;
  }

  const tags = place.tags || {};
  const historic = tags.historic;
  if (typeof historic === "string" && LANDMARK_TAG_HINTS.has(historic)) {
    return Landmark;
  }

  const tourism = tags.tourism;
  if (typeof tourism === "string") {
    if (tourism === "museum" || tourism === "gallery" || tourism === "attraction") return Landmark;
    if (tourism === "viewpoint") return Landmark;
    if (tourism === "artwork") return Landmark;
  }

  const amenity = tags.amenity;
  if (typeof amenity === "string") {
    return CATEGORY_LUCIDE_MAP[titleCase(amenity)] ?? MapPin;
  }

  return MapPin;
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
    background: landmark ? "#D97706" : "#0E6E5C",
    size: landmark ? 26 : 22,
    landmark,
  };
}
