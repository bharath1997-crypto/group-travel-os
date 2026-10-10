import type { ExploreSlot } from "./explore-hub-data";

export const EXPLORE_MAP_PREVIEW_LABEL = "Map preview";

export function exploreListingHasRealPhoto(imageUrl?: string | null): boolean {
  const url = (imageUrl || "").trim();
  return url.startsWith("http://") || url.startsWith("https://");
}

export type ExploreCardMedia = {
  imageUrl?: string;
  imageLabel: string;
};

/** Real provider photo only — no feed map crop (G12 deferred to server-side R2). */
export function resolveExploreCardMedia(slot: ExploreSlot): ExploreCardMedia {
  if (exploreListingHasRealPhoto(slot.imageUrl)) {
    return { imageUrl: slot.imageUrl!.trim(), imageLabel: "" };
  }
  return { imageLabel: "" };
}
