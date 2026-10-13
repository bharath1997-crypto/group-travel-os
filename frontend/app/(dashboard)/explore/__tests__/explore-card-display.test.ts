import { describe, expect, it } from "vitest";

import {
  EXPLORE_PRICE_ON_PROVIDER_SITE,
  eventCardVenueLine,
  eventCardWhenLine,
  exploreFeedCardPriceLine,
  exploreRankingHasKnownPrice,
  isOvertureExploreSource,
  orderExploreSlotCardsForMasonry,
  placeCardCategoryLine,
  placeCardStreetLine,
  showExploreCardProviderBadge,
} from "../explore-card-display";
import { EXPLORE_PRICE_UNKNOWN } from "../explore-listing-field-state";

describe("explore-card-display", () => {
  it("formats place cards as category plus street only", () => {
    expect(placeCardCategoryLine({ tags: ["Bar"], meta: "Bar · Milwaukee" })).toBe("Bar");
    expect(
      placeCardStreetLine("1401 E Brady St, Milwaukee, WI 53202", "1401 E Brady St, Milwaukee, WI 53202"),
    ).toBe("1401 E Brady St");
  });

  it("hides Overture provider badge on place cards", () => {
    expect(showExploreCardProviderBadge({ listingKind: "place", source: "Overture" })).toBe(false);
    expect(showExploreCardProviderBadge({ listingKind: "place", source: "Ticketmaster" })).toBe(true);
    expect(showExploreCardProviderBadge({ listingKind: "event", source: "Overture" })).toBe(true);
    expect(isOvertureExploreSource("Overture")).toBe(true);
  });

  it("formats event schedule and venue on separate lines", () => {
    const slot = {
      listingKind: "event" as const,
      dateLabel: "Thu, Oct 24 · 7:00 PM",
      venue: "Turner Hall Ballroom",
      meta: "Thu, Oct 24 · 7:00 PM · Turner Hall Ballroom · Music",
      area: "Milwaukee",
    };
    expect(eventCardWhenLine(slot)).toBe("Thu, Oct 24 · 7:00 PM");
    expect(eventCardVenueLine(slot)).toBe("Turner Hall Ballroom");
  });

  it("uses provider-site copy and Ticketmaster fee label for event prices", () => {
    expect(
      exploreFeedCardPriceLine({
        listingKind: "event",
        priceKnown: false,
        price: EXPLORE_PRICE_UNKNOWN,
      }),
    ).toBe(EXPLORE_PRICE_ON_PROVIDER_SITE);
    expect(
      exploreFeedCardPriceLine({
        listingKind: "event",
        source: "Ticketmaster",
        priceKnown: true,
        amount: 35,
        price: "$35",
      }),
    ).toBe("From $35 + fees");
    expect(exploreFeedCardPriceLine({ listingKind: "place", price: EXPLORE_PRICE_UNKNOWN })).toBeNull();
  });

  it("interleaves photo and text cards for masonry columns", () => {
    const ordered = orderExploreSlotCardsForMasonry([
      { imageUrl: "https://a/1.jpg" },
      { imageUrl: "https://a/2.jpg" },
      { imageUrl: null },
      { imageUrl: undefined },
      { imageUrl: "https://a/3.jpg" },
    ]);
    expect(ordered.map((c) => Boolean(c.imageUrl))).toEqual([true, false, true, false, true]);
  });

  it("hides ranking when every row price is unknown", () => {
    expect(
      exploreRankingHasKnownPrice([
        { id: "a", title: "A", subtitle: "", price: EXPLORE_PRICE_UNKNOWN, availability: "Check provider" },
      ]),
    ).toBe(false);
    expect(
      exploreRankingHasKnownPrice([
        { id: "b", title: "B", subtitle: "", price: "$20", availability: "Check provider" },
      ]),
    ).toBe(true);
  });
});
