import { describe, expect, it } from "vitest";

import type { ExploreSlot } from "../explore-hub-data";
import { filterSlotsByLocationScope } from "../explore-location-scope";

function placeSlot(id: string, city: string): ExploreSlot {
  return {
    id,
    source: "Overture",
    meta: "",
    summary: "",
    price: "—",
    note: "",
    rating: "",
    reviews: "",
    size: "medium",
    theme: "landmark",
    amount: 0,
    body: "",
    tags: [],
    area: city,
    distanceLabel: "2.1 mi",
    availability: "Check provider",
    exploreListingKind: "place",
    title: id,
    venue: city,
    city,
    stateLabel: "Illinois",
    dateLabel: "",
    priceLabel: "—",
    description: "",
    emoji: "",
  };
}

describe("filterSlotsByLocationScope with geo anchor", () => {
  it("does not drop places outside neighbourhood name when lat/lon set", () => {
    const slots = [placeSlot("millennium", "Chicago"), placeSlot("naperville-park", "Naperville")];
    const filtered = filterSlotsByLocationScope(slots, {
      label: "Naperville, Illinois",
      city: "Naperville",
      fetchCity: "Chicago",
      state: "Illinois",
      lat: 41.7508,
      lon: -88.1535,
    });
    expect(filtered).toHaveLength(2);
  });
});
