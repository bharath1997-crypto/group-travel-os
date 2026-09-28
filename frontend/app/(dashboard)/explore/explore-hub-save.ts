import type { ExploreSlot } from "./explore-hub-data";
import type { CollectionItem } from "../collection/collection-types";

export const EXPLORE_LISTING_SAVE_PREFIX = "explore:listing:";

/** Stable Collection `saved_from` key for idempotent Explore saves. */
export function exploreListingSaveKey(slot: Pick<ExploreSlot, "id" | "exploreListingKind">): string {
  if (slot.exploreListingKind === "place") {
    return `${EXPLORE_LISTING_SAVE_PREFIX}place:${slot.id}`;
  }
  return `${EXPLORE_LISTING_SAVE_PREFIX}event:${slot.id}`;
}

export function slotIdFromExploreSaveKey(savedFrom: string | null | undefined): string | null {
  const raw = (savedFrom || "").trim();
  if (!raw.startsWith(EXPLORE_LISTING_SAVE_PREFIX)) return null;
  const rest = raw.slice(EXPLORE_LISTING_SAVE_PREFIX.length);
  const sep = rest.indexOf(":");
  if (sep <= 0) return null;
  const id = rest.slice(sep + 1).trim();
  return id || null;
}

export function isExploreListingSaveKey(savedFrom: string | null | undefined): boolean {
  return Boolean(savedFrom?.trim().startsWith(EXPLORE_LISTING_SAVE_PREFIX));
}

export function restoredExploreSavedSlotIds(items: CollectionItem[]): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const slotId = slotIdFromExploreSaveKey(item.saved_from);
    if (!slotId || seen.has(slotId)) continue;
    seen.add(slotId);
    ids.push(slotId);
  }
  return ids;
}

export type ExploreSaveUiState = "idle" | "saving" | "saved" | "error";

export function collectionCreateBodyFromExploreSlot(
  slot: ExploreSlot,
  displayCity: string,
): {
  name: string;
  city?: string | null;
  country?: string | null;
  category?: string | null;
  subcategory?: string | null;
  source: string;
  saved_from: string;
  note?: string | null;
  is_unsorted: boolean;
} {
  const category = slot.tags[0] || (slot.exploreListingKind === "event" ? "Events" : "Places");
  return {
    name: slot.title.trim().slice(0, 200) || "Saved listing",
    city: (slot.city || displayCity).split(",")[0].trim() || displayCity,
    country: slot.countryLabel ?? null,
    category: category.slice(0, 80),
    subcategory: slot.explorePlaceBucket ?? null,
    source: "Search",
    saved_from: exploreListingSaveKey(slot),
    note: slot.summary?.trim().slice(0, 1000) || null,
    is_unsorted: true,
  };
}
