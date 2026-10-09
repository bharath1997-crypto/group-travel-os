import type { ExploreSlot } from "./explore-hub-data";

/** Configurable national chains demoted in top slots (F03), not removed. */
export const EXPLORE_DEMOTE_CHAIN_NAMES: readonly string[] = [
  "dunkin",
  "starbucks",
  "baskin-robbins",
  "baskin robbins",
  "mcdonald",
  "subway",
  "burger king",
  "wendy's",
  "taco bell",
  "kfc",
  "chipotle",
  "panera",
  "domino's",
  "pizza hut",
];

const DEMOTE_CATEGORY_PATTERN =
  /\b(church|chapel|mosque|synagogue|temple|religious|office|organization|organisation|nonprofit|non-profit|government|city hall|courthouse)\b/i;

export function isExploreNationalChainName(title: string): boolean {
  const normalized = title.trim().toLowerCase();
  if (!normalized) return false;
  return EXPLORE_DEMOTE_CHAIN_NAMES.some((chain) => normalized.includes(chain));
}

export function isExploreNonNightOutCategory(slot: ExploreSlot): boolean {
  if (slot.exploreListingKind !== "place") return false;
  const hay = `${slot.title} ${slot.meta} ${(slot.tags || []).join(" ")}`.toLowerCase();
  return DEMOTE_CATEGORY_PATTERN.test(hay);
}

/** Lower is better (sort ascending). */
export function exploreFeedSortScore(slot: ExploreSlot): number {
  let score = 0;
  const hasPhoto = Boolean((slot.imageUrl || "").trim().match(/^https?:\/\//i));
  if (!hasPhoto) score += 100;
  const hasCoords =
    slot.lat != null && slot.lng != null && Number.isFinite(slot.lat) && Number.isFinite(slot.lng);
  if (!hasPhoto && !hasCoords) score += 50;
  if (isExploreNationalChainName(slot.title)) score += 200;
  if (isExploreNonNightOutCategory(slot)) score += 150;
  return score;
}

export function rankExploreHubSlots(slots: ExploreSlot[]): ExploreSlot[] {
  return slots
    .map((slot, index) => ({ slot, index, score: exploreFeedSortScore(slot) }))
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .map((row) => row.slot);
}
