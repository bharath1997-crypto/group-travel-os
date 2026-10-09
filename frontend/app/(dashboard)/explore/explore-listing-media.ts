import type { ExploreSlot } from "./explore-hub-data";

export const EXPLORE_MAP_PREVIEW_LABEL = "Map preview";

export function exploreListingHasRealPhoto(imageUrl?: string | null): boolean {
  const url = (imageUrl || "").trim();
  return url.startsWith("http://") || url.startsWith("https://");
}

export function exploreSlotHasMapCropCoords(slot: Pick<ExploreSlot, "lat" | "lng">): boolean {
  const lat = slot.lat;
  const lng = slot.lng;
  return lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng);
}

export type ExploreCardMedia = {
  imageUrl?: string;
  useMapCrop?: boolean;
  mapCropLat?: number;
  mapCropLng?: number;
  imageLabel: string;
};

/** Real provider photo, else MapLibre map crop at coordinates (G12) — never stock art. */
export function resolveExploreCardMedia(slot: ExploreSlot): ExploreCardMedia {
  if (exploreListingHasRealPhoto(slot.imageUrl)) {
    return { imageUrl: slot.imageUrl!.trim(), imageLabel: "" };
  }
  if (exploreSlotHasMapCropCoords(slot)) {
    return {
      useMapCrop: true,
      mapCropLat: slot.lat as number,
      mapCropLng: slot.lng as number,
      imageLabel: EXPLORE_MAP_PREVIEW_LABEL,
    };
  }
  return { imageLabel: "" };
}
