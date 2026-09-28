import { describe, expect, it } from "vitest";

import { cardRatingDisplay, exploreCardTitleRenderCount, normalizeCardSummary } from "../explore-card-copy";
import { hubSlotToCard } from "../explore-hub-v6-map";
import type { ExploreSlot } from "../explore-hub-data";

describe("explore-card-copy", () => {
  it("removes summary line when it repeats the card title", () => {
    expect(normalizeCardSummary("The Green Mill", "The Green Mill · Chicago")).toBe("Chicago");
    expect(normalizeCardSummary("Jazz in the Park", "Jazz in the Park")).toBeUndefined();
  });

  it("keeps a single primary title for overlay and body card layouts", () => {
    expect(
      exploreCardTitleRenderCount({
        overlayTitle: true,
        title: "Jazz in the Park",
        summary: "Millennium Park · Chicago",
      }),
    ).toBe(1);
    expect(
      exploreCardTitleRenderCount({
        overlayTitle: false,
        title: "Blues night",
        summary: "Green Mill · Chicago",
      }),
    ).toBe(1);
  });

  it("omits em-dash rating placeholder on mapped cards", () => {
    const slot: ExploreSlot = {
      id: "x",
      source: "Ticketmaster",
      meta: "Tonight · Music",
      title: "Show",
      summary: "Venue · Chicago",
      price: "$20",
      note: "from provider",
      rating: "—",
      reviews: "",
      size: "medium",
      theme: "music",
      amount: 20,
      body: "",
      tags: [],
      area: "Venue",
      distanceLabel: "—",
      availability: "Check provider",
      venue: "Venue",
      city: "Chicago",
      dateLabel: "Tonight",
      priceLabel: "$20",
      description: "",
      emoji: "",
      priceKnown: true,
      exploreListingKind: "event",
    };
    const card = hubSlotToCard(slot, 0);
    expect(card.rating).toBe("");
    expect(cardRatingDisplay(card.rating)).toBeUndefined();
  });
});
