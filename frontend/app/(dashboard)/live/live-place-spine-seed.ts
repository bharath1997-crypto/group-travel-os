import type { PlacePreviewData } from "./live-place-preview-data";
import { sanitizePlaceCategoryLabel } from "./live-place-category-label";
import type { Place, PlaceDistance, PlaceSeed } from "./place-panel-types";

function normalizeSpineGersId(raw: string): string | null {
  const trimmed = raw.trim();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  if (/^[0-9a-f]{16,64}$/i.test(trimmed)) return trimmed.toLowerCase();
  return null;
}

export function readSpineGersId(tags: PlacePreviewData["tags"]): string | null {
  if (!tags || typeof tags !== "object") return null;
  const raw = tags.gers_id ?? tags.gersId ?? tags.id ?? tags.overture_id;
  if (typeof raw !== "string") return null;
  return normalizeSpineGersId(raw);
}

export function isSpineGersId(gersId: string): boolean {
  return normalizeSpineGersId(gersId) != null;
}

function categorySlug(categoryLabel: string): string {
  const slug = categoryLabel.trim().toLowerCase().replace(/\s+/g, "_");
  return slug || "place";
}

function localPickGersId(place: PlacePreviewData): string {
  const key = place.placeKey ?? `${place.lat.toFixed(5)},${place.lng.toFixed(5)}`;
  return `local:${key}`;
}

function previewAddress(place: PlacePreviewData): string | null {
  const address = place.address?.trim();
  if (!address || address.startsWith("Coordinates:")) return null;
  return address;
}

/** Live preview fields merged into PlacePanel as geocode / spine detail arrives. */
export function placePreviewToPlacePanelPreview(place: PlacePreviewData): Partial<Place> {
  const categoryLabel =
    sanitizePlaceCategoryLabel(place.categoryLabel, place.tags) ?? "Place";
  return {
    name: place.name,
    category_label: categoryLabel,
    address: previewAddress(place),
    lat: place.lat,
    lon: place.lng,
  };
}

/** Instant header seed for every place pick — map, search, dropped pin. */
export function placePreviewToPlaceSeed(place: PlacePreviewData): PlaceSeed {
  const gersFromTags = readSpineGersId(place.tags);
  const categoryLabel =
    sanitizePlaceCategoryLabel(place.categoryLabel, place.tags) ?? "Place";
  const categoryFromTags =
    typeof place.tags?.category === "string" ? place.tags.category.trim() : null;

  return {
    gers_id: gersFromTags ?? localPickGersId(place),
    name: place.name,
    category: categoryFromTags || categorySlug(categoryLabel),
    category_label: categoryLabel,
    lat: place.lat,
    lon: place.lng,
  };
}

/** @deprecated Use placePreviewToPlaceSeed — kept for tests migrating off gers_id gate. */
export function extractPlaceSpineSeed(place: PlacePreviewData): PlaceSeed | null {
  const gersId = readSpineGersId(place.tags);
  if (!gersId) return null;
  return placePreviewToPlaceSeed(place);
}

export function buildPlacePanelDistance(
  distanceM: number | null | undefined,
  routeDurationSeconds: number | null | undefined,
  fromGroupCentre = false,
): PlaceDistance | null {
  if (distanceM == null || !Number.isFinite(distanceM)) return null;
  const miles = distanceM / 1609.344;
  const driveMinutes =
    routeDurationSeconds != null
      ? Math.max(1, Math.round(routeDurationSeconds / 60))
      : Math.max(1, Math.round(miles * 2.5));
  return { miles, driveMinutes, fromGroupCentre };
}
