import { cleanListingLocationComponent } from "./explore-listing-location";
import { EXPLORE_PRICE_UNKNOWN } from "./explore-listing-field-state";
import type { ExploreRankingRow } from "./explore-fixtures";

export const EXPLORE_PRICE_ON_PROVIDER_SITE = "Price on provider site";

export function isOvertureExploreSource(source: string): boolean {
  return source.trim().toLowerCase() === "overture";
}

/** Hide redundant Overture inventory badge on feed cards (provider is implicit). */
export function showExploreCardProviderBadge(input: {
  listingKind?: "event" | "place";
  source: string;
}): boolean {
  if (input.listingKind === "place" && isOvertureExploreSource(input.source)) return false;
  return true;
}

export function placeCardCategoryLine(slot: { tags?: string[]; meta?: string }): string {
  const tag = slot.tags?.[0]?.trim();
  if (tag) return tag;
  const meta = slot.meta?.trim();
  if (!meta) return "";
  return meta.split(" · ")[0]?.trim() ?? meta;
}

/** Street line only — drop city/state/ZIP (display copy, not geo logic). */
export function placeCardStreetLine(area?: string | null, address?: string | null): string {
  const raw =
    cleanListingLocationComponent(address) ?? cleanListingLocationComponent(area ?? undefined);
  if (!raw) return "";
  const street = raw.split(",")[0]?.trim();
  return street || raw;
}

export function eventCardWhenLine(slot: {
  listingKind?: "event" | "place";
  dateLabel?: string;
  meta?: string;
}): string {
  if (slot.listingKind !== "event") return "";
  const when = slot.dateLabel?.trim();
  if (when) return when;
  const meta = slot.meta?.trim();
  if (!meta) return "";
  return meta.split(" · ")[0]?.trim() ?? meta;
}

export function eventCardVenueLine(slot: {
  listingKind?: "event" | "place";
  venue?: string;
  area?: string;
  meta?: string;
}): string {
  if (slot.listingKind !== "event") return "";
  const venue = cleanListingLocationComponent(slot.venue);
  if (venue) return venue;
  const meta = slot.meta?.trim();
  if (meta) {
    const parts = meta.split(" · ").map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) return parts[1] ?? "";
  }
  return cleanListingLocationComponent(slot.area) ?? "";
}

export function exploreFeedCardPriceLine(slot: {
  listingKind?: "event" | "place";
  source?: string;
  price?: string;
  priceKnown?: boolean;
  amount?: number;
}): string | null {
  if (slot.listingKind === "place") return null;
  if (slot.priceKnown === false) return EXPLORE_PRICE_ON_PROVIDER_SITE;
  const amount = slot.amount ?? 0;
  if (slot.priceKnown && amount > 0) {
    const src = (slot.source || "").toLowerCase();
    if (src.includes("ticketmaster")) {
      return `From $${Math.round(amount)} + fees`;
    }
  }
  const p = (slot.price || "").trim();
  if (!p || p === EXPLORE_PRICE_UNKNOWN) return EXPLORE_PRICE_ON_PROVIDER_SITE;
  return p;
}

export function exploreRankingHasKnownPrice(rows: ExploreRankingRow[]): boolean {
  return rows.some((row) => {
    const price = row.price.trim();
    return Boolean(price) && price !== EXPLORE_PRICE_UNKNOWN;
  });
}

export function exploreSlotCardHasPhoto(card: { imageUrl?: string | null }): boolean {
  return Boolean((card.imageUrl || "").trim().match(/^https?:\/\//i));
}

/** Interleave photo and text cards so CSS columns do not stack all photos in column 1. */
export function orderExploreSlotCardsForMasonry<T extends { imageUrl?: string | null }>(
  cards: T[],
): T[] {
  const photos: T[] = [];
  const compact: T[] = [];
  for (const card of cards) {
    (exploreSlotCardHasPhoto(card) ? photos : compact).push(card);
  }
  const out: T[] = [];
  const max = Math.max(photos.length, compact.length);
  for (let i = 0; i < max; i += 1) {
    if (i < photos.length) out.push(photos[i]!);
    if (i < compact.length) out.push(compact[i]!);
  }
  return out;
}
