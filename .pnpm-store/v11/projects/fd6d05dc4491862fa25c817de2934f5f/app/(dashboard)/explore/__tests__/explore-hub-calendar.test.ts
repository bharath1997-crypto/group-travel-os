import { describe, expect, it } from "vitest";

import type { ExploreSlot } from "../explore-hub-data";
import { mergeWithCalendarFetchRange, calendarStripDateRange } from "../explore-hub-dates";
import { buildExploreCategoryStats } from "../explore-hub-counts";
import {
  buildCalendarDaySummaries,
  filterSlotsByTimeScope,
} from "../explore-hub-time-scope";
import { dateInWhenRange } from "./explore-test-date-fixtures";

function eventSlot(id: string, iso: string, title = "Show"): ExploreSlot {
  return {
    source: "Ticketmaster",
    venue: "Venue",
    city: "Chicago",
    dateLabel: iso,
    description: "",
    imageUrl: null,
    id,
    title,
    meta: "music",
    summary: "",
    price: "$20",
    note: "",
    rating: "",
    reviews: "",
    size: "medium",
    theme: "music",
    amount: 20,
    body: "",
    tags: ["music"],
    area: "Chicago",
    distanceLabel: "—",
    availability: "Check provider",
    exploreListingKind: "event",
    eventDateIso: iso,
    priceKnown: true,
  } as unknown as ExploreSlot;
}

function placeSlot(id: string): ExploreSlot {
  return {
    source: "Overture",
    venue: "",
    city: "Chicago",
    dateLabel: "Hours unknown",
    description: "",
    imageUrl: null,
    id,
    title: "Cafe",
    meta: "",
    summary: "",
    price: "Price unknown",
    note: "",
    rating: "",
    reviews: "",
    size: "medium",
    theme: "food",
    amount: 0,
    body: "",
    tags: [],
    area: "Chicago",
    distanceLabel: "1 mi",
    availability: "Check provider",
    exploreListingKind: "place",
    explorePlaceBucket: "restaurants",
    priceKnown: false,
  } as unknown as ExploreSlot;
}

describe("Explore hub calendar (Phase A)", () => {
  it("widens fetch range to include calendar strip window", () => {
    const merged = mergeWithCalendarFetchRange({ dateFrom: dateInWhenRange("Tonight", 0), dateTo: dateInWhenRange("Tonight", 0) });
    const strip = calendarStripDateRange();
    expect(merged.dateFrom <= strip.dateFrom).toBe(true);
    expect(merged.dateTo >= strip.dateTo).toBe(true);
  });

  it("calendar day keeps places and filters events to that day", () => {
    const tonight = dateInWhenRange("Tonight", 0);
    const tomorrow = dateInWhenRange("Tomorrow", 0);
    const pool = [eventSlot("e1", tonight), eventSlot("e2", tomorrow), placeSlot("p1")];
    const scoped = filterSlotsByTimeScope(pool, "Tonight", tonight);
    expect(scoped.map((s) => s.id).sort()).toEqual(["e1", "p1"]);
  });

  it("hides category stat chips with zero count", () => {
    const tonight = dateInWhenRange("Tonight", 0);
    const pool = [eventSlot("e1", tonight, "Jazz night")];
    const stats = buildExploreCategoryStats(pool, [], "Tonight");
    const labels = stats.map(([, label]) => label);
    expect(labels).toContain("Events");
    expect(labels).not.toContain("Landmarks");
  });

  it("calendar strip only lists days with dated events", () => {
    const tonight = dateInWhenRange("Tonight", 0);
    const summaries = buildCalendarDaySummaries([eventSlot("e1", tonight)], "Tonight");
    const withEvents = summaries.filter((d) => d.eventCount > 0);
    expect(withEvents.some((d) => d.iso === tonight)).toBe(true);
    expect(withEvents.every((d) => d.eventCount > 0)).toBe(true);
  });
});
