import { describe, expect, it } from "vitest";

import type { ExploreSlot } from "../explore-hub-data";
import { dateRangeForWhen } from "../explore-hub-dates";
import { dateInWhenRange, expectFixturesAlignedWithTonightRange } from "./explore-test-date-fixtures";
import {
  buildMasonryFeed,
  filterHubSlotsByChips,
  hubSlotToCard,
  hubSlotToDetail,
  hubSlotsToRanking,
  rankingAvailabilityLabel,
  slotsToWayraPlans,
} from "../explore-hub-v6-map";

function sampleSlot(overrides: Partial<ExploreSlot> = {}): ExploreSlot {
  return {
    id: "evt-1",
    source: "Ticketmaster",
    meta: "Sat 9:00 PM · Uptown · Music",
    title: "Blues night",
    summary: "Green Mill · Chicago",
    price: "$30",
    note: "all-in",
    rating: "4.8 ★",
    reviews: "120",
    size: "medium",
    theme: "music",
    amount: 30,
    body: "Live blues set.",
    tags: ["Music", "Ticketmaster"],
    area: "Green Mill",
    distanceLabel: "2.1 km",
    availability: "12 left",
    venue: "Green Mill",
    city: "Chicago",
    dateLabel: "Sat · 9 PM",
    priceLabel: "$30",
    description: "Blues",
    emoji: "",
    exploreListingKind: "event",
    priceKnown: true,
    ...overrides,
  };
}

describe("explore-hub-v6-map", () => {
  it("maps hub slots to v6 cards and drawer detail", () => {
    const slot = sampleSlot();
    const card = hubSlotToCard(slot, 0);
    expect(card.kind).toBe("slot");
    expect(card.title).toBe("Blues night");
    expect(card.rating).toBe("4.8 ★ 120");
    expect(hubSlotToDetail(slot)?.amount).toBe(30);
    expect(hubSlotToCard(sampleSlot({ rating: "—", reviews: "" }), 1).rating).toBe("");
  });

  it("filters slots by category chips", () => {
    const music = sampleSlot({ id: "a", meta: "Music · Chicago", tags: ["Music"] });
    const food = sampleSlot({ id: "b", meta: "Food · Chicago", title: "Ramen counter", tags: ["Food"] });
    const filtered = filterHubSlotsByChips([music, food], ["Live music"]);
    expect(filtered.map((s) => s.id)).toEqual(["a"]);
  });

  it("filters slots by numeric price chips", () => {
    expectFixturesAlignedWithTonightRange();
    const tonight = dateRangeForWhen("Tonight").dateFrom!;
    const free = sampleSlot({
      id: "f",
      price: "Free",
      amount: 0,
      priceKnown: true,
      eventDateIso: dateInWhenRange("Tonight", 0),
    });
    expect(free.eventDateIso).toBe(tonight);
    const mid = sampleSlot({ id: "m", price: "$40", amount: 40, priceKnown: true });
    expect(filterHubSlotsByChips([free, mid], ["Free"], "Tonight").map((s) => s.id)).toEqual(["f"]);
    expect(filterHubSlotsByChips([free, mid], ["$25–60"]).map((s) => s.id)).toEqual(["m"]);
  });

  it("passes sourceUrl through drawer detail", () => {
    const detail = hubSlotToDetail(sampleSlot({ sourceUrl: "https://example.com/tickets" }));
    expect(detail?.sourceUrl).toBe("https://example.com/tickets");
  });

  it("maps explore picks table in feed order without ratings or rank index", () => {
    const first = sampleSlot({ id: "first", title: "First pick" });
    const second = sampleSlot({ id: "second", title: "Second pick" });
    const rows = hubSlotsToRanking([first, second]);
    expect(rows.map((r) => r.id)).toEqual(["first", "second"]);
    expect(rows[0]).toEqual({
      id: "first",
      title: "First pick",
      subtitle: first.summary,
      price: "$30",
      availability: "12 left",
    });
    expect(rankingAvailabilityLabel(sampleSlot({ availability: "Open" }))).toBe("Check provider");
    expect(rankingAvailabilityLabel(sampleSlot({ editorial: true, availability: "12 left" }))).toBe("Check provider");
  });

  it("builds masonry feed from live slots and keeps ask cards", () => {
    const feed = buildMasonryFeed([hubSlotToCard(sampleSlot(), 0)]);
    expect(feed.some((item) => item.kind === "slot")).toBe(true);
    expect(feed.some((item) => item.kind === "ask")).toBe(true);
  });

  it("builds Wayra plans from prompt matches", () => {
    const plans = slotsToWayraPlans([sampleSlot()], "blues night chicago");
    expect(plans.length).toBeGreaterThan(0);
    expect(plans[0].steps[0].label).toContain("Blues");
  });
});
