import { describe, expect, it } from "vitest";

import type { ExploreSlot } from "../explore-hub-data";
import {
  collectionCreateBodyFromExploreSlot,
  exploreListingSaveKey,
  restoredExploreSavedSlotIds,
  slotIdFromExploreSaveKey,
} from "../explore-hub-save";

function samplePlaceSlot(id: string): ExploreSlot {
  return {
    id,
    exploreListingKind: "place",
    source: "Overture",
    meta: "Place",
    title: "Test Place",
    price: "Free",
    note: "",
    rating: "",
    reviews: "",
    area: "Downtown",
    body: "",
    tags: ["Parks"],
    amount: 0,
    city: "Chicago",
    countryLabel: "USA",
    summary: "A park",
    explorePlaceBucket: "attractions",
    venue: "",
    dateLabel: "",
    priceLabel: "Free",
    description: "",
    emoji: "",
    size: "short",
    theme: "mint",
    distanceLabel: "",
    availability: "",
  } as unknown as ExploreSlot;
}

describe("explore-hub-save", () => {
  it("uses stable gers id in place save key", () => {
    const gers = "gers:abc-123";
    expect(exploreListingSaveKey(samplePlaceSlot(gers))).toBe("explore:listing:place:gers:abc-123");
  });

  it("uses event id in event save key", () => {
    const slot = { ...samplePlaceSlot("evt-1"), exploreListingKind: "event" as const };
    expect(exploreListingSaveKey(slot)).toBe("explore:listing:event:evt-1");
  });

  it("round-trips slot id from saved_from", () => {
    const key = "explore:listing:place:gers:abc-123";
    expect(slotIdFromExploreSaveKey(key)).toBe("gers:abc-123");
  });

  it("restores unique slot ids from collection items", () => {
    const ids = restoredExploreSavedSlotIds([
      { saved_from: "explore:listing:place:a" } as never,
      { saved_from: "explore:listing:place:a" } as never,
      { saved_from: "explore:listing:event:e1" } as never,
      { saved_from: "instagram:reel" } as never,
    ]);
    expect(ids).toEqual(["a", "e1"]);
  });

  it("builds collection create body with saved_from", () => {
    const body = collectionCreateBodyFromExploreSlot(samplePlaceSlot("gers:x"), "Chicago, IL");
    expect(body.saved_from).toBe("explore:listing:place:gers:x");
    expect(body.source).toBe("Search");
    expect(body.is_unsorted).toBe(true);
  });
});
