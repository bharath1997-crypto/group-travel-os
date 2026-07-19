import type { PlacePreviewData } from "./PlacePreviewCard";
import { normalizePlaceCategory } from "./live-geocoding";

export type PlaceLocationField = {
  label: string;
  value: string;
};

const HOURS_RELEVANT_CATEGORIES = new Set([
  "Restaurant",
  "Fast food",
  "Cafe",
  "Bar",
  "Pub",
  "Coffee shop",
  "Bakery",
  "Supermarket",
  "Convenience store",
  "Liquor store",
  "Museum",
  "Gallery",
  "Attraction",
  "Hotel",
  "Motel",
  "Gas station",
  "Pharmacy",
  "Bank",
  "Library",
  "Park",
  "Fitness center",
  "Sports center",
  "Cinema",
  "Place of worship",
  "Church",
  "Mosque",
  "Synagogue",
  "Temple",
  "School",
  "College",
  "University",
  "Hospital",
  "Clinic",
]);

function normalizeToken(value: string): string {
  return value.trim().toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ");
}

function titleCase(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function isOsmGeometryLabel(label: string): boolean {
  return /^(node|way|relation)$/i.test(label.trim());
}

export function resolvePlaceCategoryLabel(place: PlacePreviewData): string {
  const fromTags = normalizePlaceCategory(place.tags);
  if (fromTags) return fromTags;
  if (place.categoryLabel && !isOsmGeometryLabel(place.categoryLabel)) {
    return place.categoryLabel;
  }
  return "Place";
}

export function inferPlaceTypeLabel(place: PlacePreviewData): string {
  const category = resolvePlaceCategoryLabel(place);
  if (category && !["Place", "Location", "Address", "Coordinates"].includes(category)) {
    return category;
  }

  const placeTag = place.tags?.place;
  if (typeof placeTag === "string" && placeTag.trim()) {
    return titleCase(placeTag);
  }

  const name = place.name.trim();
  if (/borough$/i.test(name)) return "Borough";
  if (/county$/i.test(name)) return "County";
  if (/province$/i.test(name)) return "Province";
  if (/parish$/i.test(name)) return "Parish";
  if (/municipality$/i.test(name)) return "Municipality";
  if (/district$/i.test(name)) return "District";
  if (/national park$/i.test(name)) return "National park";
  if (/^city of /i.test(name)) return "City";

  const osmType = String(place.tags?.type || place.tags?.boundary || "").toLowerCase();
  if (osmType === "administrative") return "Administrative area";

  if (category === "Location") return "Area";
  return category || "Place";
}

export function formatPlaceSubtitle(place: PlacePreviewData): string {
  const typeLabel = inferPlaceTypeLabel(place);
  const displayType = (typeLabel && typeLabel !== place.name) ? typeLabel : "Location";

  if (place.address) {
    return `${displayType} · ${place.address}`;
  }

  const locationParts = [place.state, place.country].filter(Boolean);
  if (locationParts.length > 0) {
    return `${displayType} · ${locationParts.join(", ")}`;
  }
  return displayType;
}

function inferAdminLabel(value: string, place: PlacePreviewData): string {
  const normalized = value.toLowerCase();
  if (normalized.includes("borough")) return "Borough";
  if (normalized.includes("county")) return "County";
  if (normalized.includes("parish")) return "Parish";
  if (normalized.includes("province")) return "Province";
  if (normalized.includes("municipality")) return "Municipality";
  if (normalized.includes("district")) return "District";
  if (/^city of /i.test(value)) return "City";

  const typeLabel = inferPlaceTypeLabel(place);
  if (["Borough", "County", "Parish", "Province", "Municipality", "District"].includes(typeLabel)) {
    return typeLabel;
  }
  return "City";
}

export function getPlaceLocationFields(place: PlacePreviewData): PlaceLocationField[] {
  const fields: PlaceLocationField[] = [];
  const cityValue = place.city?.trim();
  const nameToken = normalizeToken(place.name);

  if (cityValue && normalizeToken(cityValue) !== nameToken) {
    fields.push({
      label: inferAdminLabel(cityValue, place),
      value: cityValue,
    });
  }

  if (place.state?.trim() && normalizeToken(place.state) !== nameToken) {
    fields.push({ label: "Region", value: place.state.trim() });
  }

  if (place.country?.trim()) {
    fields.push({ label: "Country", value: place.country.trim() });
  }

  if (place.continent?.trim()) {
    fields.push({ label: "Continent", value: place.continent.trim() });
  }

  if (place.postcode?.trim()) {
    fields.push({ label: "Postcode", value: place.postcode.trim() });
  }

  return fields;
}

export function shouldShowOpeningHours(place: PlacePreviewData): boolean {
  if (place.openStatus?.trim()) return true;
  if (place.openingHours?.trim()) return true;

  const category = resolvePlaceCategoryLabel(place);
  if (HOURS_RELEVANT_CATEGORIES.has(category)) return true;

  return /restaurant|cafe|shop|store|museum|attraction|hotel|hospital|pharmacy|bank|library|bar|pub/i.test(
    category,
  );
}

export function formatOpeningHoursLabel(place: PlacePreviewData): string | null {
  if (!shouldShowOpeningHours(place)) return null;
  if (place.openStatus?.trim()) return place.openStatus.trim();
  if (place.openingHours?.trim()) return place.openingHours.trim();
  return "Hours unavailable";
}

export function compactRouteConditionLabel(options: {
  lastMileNotice?: string | null;
  lastMileMode?: "walk" | null;
  borderNotice?: string | null;
}): string | null {
  if (options.borderNotice?.trim()) return "Border crossing on route";
  if (options.lastMileMode === "walk" || options.lastMileNotice?.trim()) {
    return "Off-road access required";
  }
  return null;
}
