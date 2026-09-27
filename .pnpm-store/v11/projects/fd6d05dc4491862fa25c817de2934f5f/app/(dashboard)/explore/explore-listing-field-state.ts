import type { ExploreEvent } from "@/lib/explore-events";

import { HOURS_LISTED_LABEL, normalizeListingAvailability } from "./explore-availability-copy";

export type ExploreFieldState = {
  kind: "known" | "unknown";
  label: string;
  source?: string;
};

export const EXPLORE_PHOTO_UNAVAILABLE = "Photo unavailable";
export const EXPLORE_PRICE_UNKNOWN = "Price unknown";
export const EXPLORE_HOURS_UNKNOWN = "Hours unknown";
export const EXPLORE_CHECK_PROVIDER = "Check provider";
export const EXPLORE_SOLD_OUT = "Sold out";

function eventSoldOut(event: Pick<ExploreEvent, "status" | "availability">): boolean {
  const status = (event.status || "").trim().toLowerCase();
  const availability = (event.availability || "").trim().toLowerCase();
  return status === "sold_out" || availability === "sold_out" || status === "soldout" || availability === "soldout";
}

export type ExplorePriceFieldState = ExploreFieldState & {
  priceKnown: boolean;
  amount: number;
  isFree: boolean;
  cardLabel: string;
};

function roundUsd(n: number): string {
  return `$${Math.round(n)}`;
}

/** Provider-backed event price — never infers Free without explicit zero from provider. */
export function exploreEventPriceState(
  event: Pick<ExploreEvent, "price_min" | "price_max" | "status" | "availability">,
): ExplorePriceFieldState {
  if (eventSoldOut(event)) {
    return {
      kind: "known",
      label: EXPLORE_SOLD_OUT,
      cardLabel: EXPLORE_SOLD_OUT,
      priceKnown: true,
      amount: 0,
      isFree: false,
    };
  }

  const min = event.price_min;
  const max = event.price_max;

  if (min == null && max == null) {
    return {
      kind: "unknown",
      label: EXPLORE_PRICE_UNKNOWN,
      cardLabel: EXPLORE_PRICE_UNKNOWN,
      priceKnown: false,
      amount: 0,
      isFree: false,
    };
  }

  if (min === 0 && (max == null || max === 0)) {
    return {
      kind: "known",
      label: "Free",
      cardLabel: "Free",
      priceKnown: true,
      amount: 0,
      isFree: true,
    };
  }

  if (min != null && max != null && max > min) {
    const label = `${roundUsd(min)}–${roundUsd(max)}`;
    return {
      kind: "known",
      label,
      cardLabel: roundUsd(min),
      priceKnown: true,
      amount: min,
      isFree: false,
    };
  }

  if (min != null) {
    const label = min === 0 ? "Free" : `From ${roundUsd(min)}`;
    const cardLabel = min === 0 ? "Free" : roundUsd(min);
    return {
      kind: "known",
      label,
      cardLabel,
      priceKnown: true,
      amount: min,
      isFree: min === 0,
    };
  }

  return {
    kind: "unknown",
    label: EXPLORE_PRICE_UNKNOWN,
    cardLabel: EXPLORE_PRICE_UNKNOWN,
    priceKnown: false,
    amount: 0,
    isFree: false,
  };
}

export function exploreSlotPriceLabel(slot: {
  priceKnown?: boolean;
  price?: string;
  amount?: number;
}): string {
  if (slot.priceKnown === false) return EXPLORE_PRICE_UNKNOWN;
  const p = (slot.price || "").trim();
  const legacyUnknown = new Set(["see listing", "see pricing"]);
  if (!p || legacyUnknown.has(p.toLowerCase())) return EXPLORE_PRICE_UNKNOWN;
  return p;
}

export function exploreListingPhotoState(imageUrl?: string | null): ExploreFieldState & { url?: string } {
  const url = (imageUrl || "").trim();
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return { kind: "known", label: "", url };
  }
  return { kind: "unknown", label: EXPLORE_PHOTO_UNAVAILABLE };
}

export type ExploreCardPhotoMode = "provider" | "unavailable" | "category-stock";

export function exploreInventoryPhotoDisplay(input: {
  fallbackMode: "category" | "unknown";
  imageUrl?: string | null;
  imageLoadFailed?: boolean;
}): ExploreCardPhotoMode {
  if (input.fallbackMode === "category" && !input.imageLoadFailed) {
    const url = (input.imageUrl || "").trim();
    if (url.startsWith("http://") || url.startsWith("https://")) return "provider";
    return "category-stock";
  }
  const photo = exploreListingPhotoState(input.imageUrl);
  if (photo.kind === "known" && !input.imageLoadFailed) return "provider";
  return "unavailable";
}

/** Card/table rating line — omit unless a verified provider score exists later. */
export function exploreVerifiedRatingLine(rating?: string | null, reviews?: string | null): string | undefined {
  const r = (rating || "").trim();
  if (!r || r === "—" || r.startsWith("—")) return undefined;
  const rev = (reviews || "").trim();
  return rev ? `${r} ${rev}`.trim() : r;
}

export function exploreDrawerHoursState(input: {
  openingHours?: string | null;
  hoursSource?: string | null;
}): ExploreFieldState {
  const hours = (input.openingHours || "").trim();
  if (hours) {
    return {
      kind: "known",
      label: hours,
      source: input.hoursSource || undefined,
    };
  }
  return { kind: "unknown", label: EXPLORE_HOURS_UNKNOWN };
}

export function exploreAvailabilityFieldState(
  raw: string | undefined | null,
  options?: { editorial?: boolean },
): ExploreFieldState {
  const label = normalizeListingAvailability(raw, options);
  if (label === EXPLORE_CHECK_PROVIDER) {
    return { kind: "unknown", label: EXPLORE_CHECK_PROVIDER };
  }
  if (label === EXPLORE_SOLD_OUT || label === HOURS_LISTED_LABEL) {
    return { kind: "known", label };
  }
  if (!raw?.trim()) {
    return { kind: "unknown", label: EXPLORE_CHECK_PROVIDER };
  }
  return { kind: "known", label };
}

export function exploreDrawerProviderActionLabel(input: {
  sourceUrl?: string | null;
  editorial?: boolean;
  priceKnown?: boolean;
  priceLabel: string;
}): string {
  const canOpen = Boolean(input.sourceUrl?.trim()) && !input.editorial;
  if (!canOpen) return "No booking link";
  if (input.priceKnown === false) return "View provider";
  return `Book · ${input.priceLabel}`;
}

/** Numeric price chips — unknown prices match none. */
export function exploreSlotMatchesNumericPriceChip(
  slot: { priceKnown?: boolean; amount?: number },
  chip: string,
): boolean {
  const label = chip.toLowerCase();
  if (label.startsWith("under $25")) {
    return slot.priceKnown === true && (slot.amount ?? 0) > 0 && (slot.amount ?? 0) < 25;
  }
  if (label.includes("$25") && label.includes("60")) {
    return slot.priceKnown === true && (slot.amount ?? 0) >= 25 && (slot.amount ?? 0) <= 60;
  }
  if (label.includes("$60+")) {
    return slot.priceKnown === true && (slot.amount ?? 0) > 60;
  }
  return false;
}

export function exploreSlotPriceKnownForFilters(slot: {
  priceKnown?: boolean;
  amount?: number;
  price?: string;
}): boolean {
  if (slot.priceKnown === false) return false;
  if ((slot.price || "").trim() === "Free" && slot.priceKnown === true) return true;
  return slot.priceKnown === true;
}
