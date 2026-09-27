import { describe, expect, it } from "vitest";

import type { ExploreSlot } from "../explore-hub-data";
import { filterSlotsByLocationScope } from "../explore-location-scope";

function slot(partial: Partial<ExploreSlot>): ExploreSlot {
  return {
    id: "1",
    source: "Ticketmaster",
    meta: "Sat · Chicago · Music",
    title: "Blues night",
    summary: "Uptown",
    price: "$30",
    note: "all-in",
    rating: "4.8 ★",
    reviews: "10",
    size: "medium",
    theme: "music",
    amount: 30,
    body: "Live music",
    tags: ["Music"],
    area: "Uptown",
    distanceLabel: "2 km",
    availability: "Open",
    venue: "Green Mill",
    city: "Chicago",
    dateLabel: "Tonight",
    priceLabel: "$30",
    description: "Blues",
    emoji: "",
    stateLabel: "Illinois",
    exploreListingKind: "event",
    ...partial,
  };
}

describe("explore-location-scope", () => {
  it("filters by state when only state is selected", () => {
    const rows = [
      slot({ id: "a", stateLabel: "Illinois", city: "Chicago" }),
      slot({ id: "b", stateLabel: "Texas", city: "Austin", meta: "Sat · Austin · Music" }),
    ];
    const filtered = filterSlotsByLocationScope(rows, {
      label: "Illinois, United States",
      state: "Illinois",
      country: "United States",
    });
    expect(filtered.map((r) => r.id)).toEqual(["a"]);
  });
});
