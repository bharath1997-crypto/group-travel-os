import {
  buildMapCropBackgroundPosition,
  buildMapCropTileUrl,
} from "@/app/(dashboard)/live/place-panel-map-tile";

import type { ExploreSlot } from "./explore-hub-data";

export const EXPLORE_MAP_PREVIEW_LABEL = "Map preview";

export function exploreListingHasRealPhoto(imageUrl?: string | null): boolean {
  const url = (imageUrl || "").trim();
  return url.startsWith("http://") || url.startsWith("https://");
}

export function exploreSlotMapCropStyle(slot: Pick<ExploreSlot, "lat" | "lng">): {
  url: string;
  backgroundPosition: string;
} | null {
  const lat = slot.lat;
  const lng = slot.lng;
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    url: buildMapCropTileUrl(lat, lng),
    backgroundPosition: buildMapCropBackgroundPosition(lat, lng),
  };
}

export type ExploreCardMedia = {
  imageUrl?: string;
  mapCropUrl?: string;
  mapCropBackgroundPosition?: string;
  imageLabel: string;
};

/** Real provider photo, else static OpenFreeMap tile crop — never stock art (G12). */
export function resolveExploreCardMedia(slot: ExploreSlot): ExploreCardMedia {
  if (exploreListingHasRealPhoto(slot.imageUrl)) {
    return { imageUrl: slot.imageUrl!.trim(), imageLabel: "" };
  }
  const crop = exploreSlotMapCropStyle(slot);
  if (crop) {
    return {
      mapCropUrl: crop.url,
      mapCropBackgroundPosition: crop.backgroundPosition,
      imageLabel: EXPLORE_MAP_PREVIEW_LABEL,
    };
  }
  return { imageLabel: "" };
}
