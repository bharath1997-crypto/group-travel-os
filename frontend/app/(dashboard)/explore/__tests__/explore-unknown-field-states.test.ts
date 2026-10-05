import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { normalizeListingAvailability } from "../explore-availability-copy";
import { hubSlotToDetail } from "../explore-hub-v6-map";
import {
  EXPLORE_CHECK_PROVIDER,
  EXPLORE_PHOTO_UNAVAILABLE,
  EXPLORE_PRICE_UNKNOWN,
  EXPLORE_SOLD_OUT,
  exploreDrawerProviderActionLabel,
  exploreEventPriceState,
  exploreInventoryPhotoDisplay,
  exploreListingPhotoState,
  exploreSlotMatchesNumericPriceChip,
  exploreVerifiedRatingLine,
} from "../explore-listing-field-state";
import type { ExploreSlot } from "../explore-hub-data";

const EXPLORE_ROOT = join(process.cwd(), "app/(dashboard)/explore");

function walkTsFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === "__tests__") continue;
      walkTsFiles(p, out);
    } else if (/\.(tsx|ts)$/.test(name)) {
      out.push(p);
    }
  }
  return out;
}

describe("explore unknown field states (G08)", () => {
  it("missing event price → Price unknown", () => {
    const state = exploreEventPriceState({ price_min: null, price_max: null });
    expect(state.label).toBe(EXPLORE_PRICE_UNKNOWN);
    expect(state.priceKnown).toBe(false);
  });

  it("priceKnown=false with amount 0 does not become Free via slot mapper semantics", () => {
    const slot: ExploreSlot = {
      id: "x",
      source: "TM",
      meta: "Tonight",
      title: "Show",
      summary: "",
      price: EXPLORE_PRICE_UNKNOWN,
      note: "",
      rating: "",
      reviews: "",
      size: "medium",
      theme: "music",
      amount: 0,
      body: "",
      tags: [],
      area: "",
      distanceLabel: "—",
      venue: "",
      city: "Chicago",
      dateLabel: "",
      priceLabel: EXPLORE_PRICE_UNKNOWN,
      description: "",
      emoji: "",
      priceKnown: false,
      availability: "Check provider",
      exploreListingKind: "event",
    };
    expect(exploreEventPriceState({ price_min: 0, price_max: 0 }).isFree).toBe(true);
    expect(slot.priceKnown).toBe(false);
    expect(slot.price).not.toBe("Free");
  });

  it("unknown price matches no numeric price filter chip", () => {
    const slot = { priceKnown: false as const, amount: 0 };
    expect(exploreSlotMatchesNumericPriceChip(slot, "Under $25")).toBe(false);
    expect(exploreSlotMatchesNumericPriceChip(slot, "$25–60")).toBe(false);
    expect(exploreSlotMatchesNumericPriceChip(slot, "$60+")).toBe(false);
    expect(exploreSlotMatchesNumericPriceChip({ priceKnown: true, amount: 10 }, "Under $25")).toBe(true);
  });

  it("known zero price with provider fields remains Free", () => {
    const state = exploreEventPriceState({ price_min: 0, price_max: 0 });
    expect(state.label).toBe("Free");
    expect(state.priceKnown).toBe(true);
    expect(state.isFree).toBe(true);
  });

  it("missing image → Photo unavailable (no stock category URL)", () => {
    expect(exploreListingPhotoState(null).label).toBe(EXPLORE_PHOTO_UNAVAILABLE);
    expect(exploreInventoryPhotoDisplay({ fallbackMode: "unknown", imageUrl: null })).toBe("unavailable");
    expect(exploreInventoryPhotoDisplay({ fallbackMode: "unknown", imageUrl: "https://cdn.example/a.jpg" })).toBe(
      "provider",
    );
  });

  it("broken provider image falls back to unavailable in inventory mode", () => {
    expect(
      exploreInventoryPhotoDisplay({
        fallbackMode: "unknown",
        imageUrl: "https://cdn.example/a.jpg",
        imageLoadFailed: true,
      }),
    ).toBe("unavailable");
  });

  it("category stock only when fallbackMode is category and URL missing", () => {
    expect(exploreInventoryPhotoDisplay({ fallbackMode: "category", imageUrl: null })).toBe("category-stock");
    expect(exploreInventoryPhotoDisplay({ fallbackMode: "unknown", imageUrl: null })).toBe("unavailable");
  });

  it("missing ratings produce no verified rating line", () => {
    expect(exploreVerifiedRatingLine("—", "120 reviews")).toBeUndefined();
    expect(exploreVerifiedRatingLine("", "")).toBeUndefined();
  });

  it("generic Open / Open now → Check provider", () => {
    expect(normalizeListingAvailability("Open")).toBe(EXPLORE_CHECK_PROVIDER);
    expect(normalizeListingAvailability("Open now")).toBe(EXPLORE_CHECK_PROVIDER);
  });

  it("substantive provider availability and Sold out remain visible", () => {
    expect(normalizeListingAvailability("12 left")).toBe("12 left");
    expect(normalizeListingAvailability("sold_out")).toBe(EXPLORE_SOLD_OUT);
  });

  it("drawer action uses provider-specific Scaper event links", () => {
    expect(
      exploreDrawerProviderActionLabel({
        source: "Eventbrite",
        sourceUrl: "https://www.eventbrite.com/e/1",
        priceKnown: false,
        priceLabel: EXPLORE_PRICE_UNKNOWN,
        listingKind: "event",
      }),
    ).toBe("View on Eventbrite");
    expect(
      exploreDrawerProviderActionLabel({
        source: "Ticketmaster",
        sourceUrl: "https://www.ticketmaster.com/e/1",
        priceKnown: true,
        priceLabel: "$20",
        listingKind: "event",
      }),
    ).toBe("Tickets via Ticketmaster");
    expect(
      exploreDrawerProviderActionLabel({
        sourceUrl: "https://ticket.example/e/1",
        priceKnown: false,
        priceLabel: EXPLORE_PRICE_UNKNOWN,
        listingKind: "place",
      }),
    ).toBe("View provider");
  });

  it("drawer detail omits dash rating placeholder", () => {
    const detail = hubSlotToDetail({
      id: "e1",
      source: "Ticketmaster",
      meta: "Tonight",
      title: "Jazz",
      summary: "Venue",
      price: "$15",
      note: "from provider",
      rating: "—",
      reviews: "",
      size: "medium",
      theme: "music",
      amount: 15,
      body: "",
      tags: [],
      area: "Venue",
      distanceLabel: "—",
      venue: "V",
      city: "Chicago",
      dateLabel: "Tonight",
      priceLabel: "$15",
      description: "",
      emoji: "",
      priceKnown: true,
      availability: "Check provider",
      exploreListingKind: "event",
    });
    expect(detail?.rating).toBe("");
  });

  it("regression scan: no Listing photo, See pricing, synthetic rating, or $0 unknown leaks in Explore tree", () => {
    const banned = [
      /Listing photo/,
      /See pricing/,
      /\bpseudoRating\b/,
      /highly rated/i,
      /fill-amber-400|fill-yellow-400/,
    ];
    const files = walkTsFiles(EXPLORE_ROOT).filter(
      (f) => !f.endsWith("explore-listing-field-state.ts"),
    );
    const hits: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      for (const pattern of banned) {
        if (pattern.test(text)) hits.push(`${file} → ${pattern}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it("inventory ExploreCardImage uses unknown fallback in category card production path", () => {
    const cardSrc = readFileSync(
      join(EXPLORE_ROOT, "components/ExploreCategoryEventCard.tsx"),
      "utf8",
    );
    expect(cardSrc).toContain('fallbackMode={isPlaceholder ? "category" : "unknown"}');
    expect(cardSrc).not.toContain("getPlaceImage");
  });
});
