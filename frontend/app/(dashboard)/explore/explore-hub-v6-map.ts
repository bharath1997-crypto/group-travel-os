import { cardRatingDisplay, normalizeCardSummary } from "./explore-card-copy";
import { formatSlotListingArea } from "./explore-listing-location";
import { hubListingBadge, normalizeListingAvailability } from "./explore-availability-copy";
import {
  EXPLORE_PHOTO_UNAVAILABLE,
  exploreSlotPriceLabel,
  exploreVerifiedRatingLine,
} from "./explore-listing-field-state";
import { filterSlotsByPrompt, type ExploreSlot } from "./explore-hub-data";
import { filterHubSlotsByChips as filterHubSlotsByChipsWithWhen } from "./explore-hub-chip-match";
import {
  EXPLORE_FEED,
  type ExploreFeedItem,
  type ExploreRankingRow,
  type ExploreSlotCard,
  type ExploreSlotDetail,
  type ExploreStat,
  type ExploreWayraPlan,
} from "./explore-fixtures";

const CARD_HEIGHTS = [178, 206, 164, 192, 132, 150, 126, 142, 158];

const STAT_ACCENT = new Set(["Free tonight", "Free"]);

function badgeVariantFor(_slot: ExploreSlot): ExploreSlotCard["badgeVariant"] {
  return "neutral";
}

export function hubSlotToCard(slot: ExploreSlot, index: number): ExploreSlotCard {
  const ratingRaw = exploreVerifiedRatingLine(slot.rating, slot.reviews);
  return {
    kind: "slot",
    id: slot.id,
    source: slot.source,
    meta: slot.meta,
    title: slot.title,
    price: slot.price,
    note: slot.note,
    rating: cardRatingDisplay(ratingRaw) ?? "",
    area: slot.area,
    body: slot.body,
    tags: slot.tags,
    amount: slot.amount,
    imageHeight: CARD_HEIGHTS[index % CARD_HEIGHTS.length],
    imageLabel: slot.imageUrl ? "" : EXPLORE_PHOTO_UNAVAILABLE,
    imageUrl: slot.imageUrl,
    imageCredit: slot.imageCredit ?? null,
    badge: hubListingBadge(slot),
    badgeVariant: badgeVariantFor(slot),
    summary: normalizeCardSummary(slot.title, slot.summary),
    overlayTitle: Boolean(slot.imageUrl && slot.price === "Free"),
  };
}

export function hubSlotToDetail(slot: ExploreSlot | undefined): ExploreSlotDetail | null {
  if (!slot) return null;
  return {
    id: slot.id,
    source: slot.source,
    meta: slot.meta,
    title: slot.title,
    price: slot.price,
    note: slot.note,
    rating: exploreVerifiedRatingLine(slot.rating, slot.reviews) ?? "",
    area: formatSlotListingArea(slot) ?? "",
    body: slot.body,
    tags: slot.tags,
    amount: slot.amount,
    sourceUrl: slot.sourceUrl,
    editorial: slot.editorial,
    priceKnown: slot.priceKnown,
    imageUrl: slot.imageUrl,
    openingHours: slot.openingHours ?? null,
    hoursSource: slot.hoursSource ?? null,
    address: slot.placeAddress ?? null,
    phone: slot.phone ?? null,
    lat: slot.lat ?? null,
    lng: slot.lng ?? null,
    imageCredit: slot.imageCredit ?? null,
    listingKind: slot.exploreListingKind,
  };
}

export function statsTuplesToExploreStats(stats: [string, string][]): ExploreStat[] {
  return stats.map(([count, label]) => ({
    count,
    label,
    accent: STAT_ACCENT.has(label),
  }));
}

function rankingPriceLabel(slot: ExploreSlot): string {
  return exploreSlotPriceLabel(slot);
}

/** Neutral table copy — provider strings only; no implied verification. */
export function rankingAvailabilityLabel(slot: ExploreSlot): string {
  return normalizeListingAvailability(slot.availability || slot.badge, { editorial: slot.editorial });
}

/** First six hub feed slots in existing order — not a scored or rated ranking. */
export function hubSlotsToRanking(slots: ExploreSlot[]): ExploreRankingRow[] {
  return slots.slice(0, 6).map((slot) => ({
    id: slot.id,
    title: slot.title,
    subtitle: slot.summary,
    price: rankingPriceLabel(slot),
    availability: rankingAvailabilityLabel(slot),
  }));
}

export function filterHubSlotsByChips(
  slots: ExploreSlot[],
  chips: string[],
  when = "Tonight",
  calendarDayIso?: string | null,
): ExploreSlot[] {
  return filterHubSlotsByChipsWithWhen(slots, chips, when, calendarDayIso);
}

export { exploreSlotMatchesChip, isCategoryStatChipLabel } from "./explore-hub-chip-match";

export function buildMasonryFeed(liveSlots: ExploreSlotCard[]): ExploreFeedItem[] {
  const queue = [...liveSlots];
  const out: ExploreFeedItem[] = [];
  for (const template of EXPLORE_FEED) {
    if (template.kind === "slot") {
      const next = queue.shift();
      if (next) out.push(next);
    } else {
      out.push(template);
    }
  }
  while (queue.length) out.push(queue.shift()!);
  return out;
}

export function slotsToWayraPlans(slots: ExploreSlot[], prompt: string): ExploreWayraPlan[] {
  const picks = filterSlotsByPrompt(slots, prompt);
  const tiers = ["Low-key", "Best fit", "Big night"];
  if (!picks.length) return [];

  return picks.map((slot, index) => ({
    id: slot.id,
    tier: tiers[index] ?? `Option ${index + 1}`,
    price: slot.price === "Free" ? "Free" : `${slot.price} ea`,
    highlighted: index === 1,
    steps: [
      { time: slot.dateLabel?.split("·")[0]?.trim() || "Tonight", label: slot.title },
      { time: "", label: slot.summary, connector: "walk" },
    ],
  }));
}

export function formatFetchedAgo(iso: string | undefined): string {
  if (!iso) return "just now";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "just now";
  const mins = Math.max(0, Math.round((Date.now() - then) / 60_000));
  if (mins < 1) return "just now";
  if (mins === 1) return "1 min ago";
  return `${mins} min ago`;
}
