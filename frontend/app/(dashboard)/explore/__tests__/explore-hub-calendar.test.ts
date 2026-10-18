import { describe, expect, it } from "vitest";

import type { ExploreSlot } from "../explore-hub-data";
import { mergeWithCalendarFetchRange, calendarStripDateRange, formatIsoDate } from "../explore-hub-dates";
import { buildExploreCategoryStats } from "../explore-hub-counts";
import {
  buildCalendarDaySummaries,
  filterSlotsByTimeScope,
} from "../explore-hub-time-scope";
import {
  buildCalendarMonthGrid,
  calendarCellSelectable,
  calendarFetchDateRange,
  calendarMonthKey,
  calendarMonthLabel,
  calendarMonthRange,
  canShiftCalendarMonth,
  currentCalendarMonth,
  dayCountsFromSummaries,
  formatCalendarChipLabel,
  hubFetchRangeForSelectedDay,
  shiftCalendarMonth,
  totalCalendarMonthEvents,
} from "../explore-hub-calendar-month";
import { calendarCountsCacheKey, mapCalendarCountsResponse } from "../explore-hub-calendar-counts";
import { buildExploreHubFetchInput } from "../use-explore-hub";
import { dateInWhenRange, offsetIsoDate } from "./explore-test-date-fixtures";

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

  it("day summaries count dated events per day", () => {
    const tonight = dateInWhenRange("Tonight", 0);
    const summaries = buildCalendarDaySummaries([eventSlot("e1", tonight)], "Tonight");
    const withEvents = summaries.filter((d) => d.eventCount > 0);
    expect(withEvents.some((d) => d.iso === tonight)).toBe(true);
    expect(withEvents.every((d) => d.eventCount > 0)).toBe(true);
  });
});

describe("Explore hub 'Select the date' month calendar", () => {
  const now = new Date(2026, 9, 18, 12); // Sun Oct 18 2026 (local)
  const october = { year: 2026, month: 9 };

  it("month math: shift, key, label, range", () => {
    expect(shiftCalendarMonth(october, 1)).toEqual({ year: 2026, month: 10 });
    expect(shiftCalendarMonth(october, 3)).toEqual({ year: 2027, month: 0 });
    expect(shiftCalendarMonth(october, 12)).toEqual({ year: 2027, month: 9 });
    expect(calendarMonthKey(october)).toBe("2026-10");
    expect(calendarMonthLabel(october)).toBe("October 2026");
    expect(calendarMonthRange(october)).toEqual({ dateFrom: "2026-10-01", dateTo: "2026-10-31" });
    expect(calendarMonthRange({ year: 2028, month: 1 })).toEqual({ dateFrom: "2028-02-01", dateTo: "2028-02-29" });
  });

  it("cannot navigate into past months; future months and years stay open", () => {
    expect(currentCalendarMonth(now)).toEqual(october);
    expect(canShiftCalendarMonth(october, -1, now)).toBe(false);
    expect(canShiftCalendarMonth(october, -12, now)).toBe(false);
    expect(canShiftCalendarMonth(october, 1, now)).toBe(true);
    expect(canShiftCalendarMonth({ year: 2027, month: 2 }, -1, now)).toBe(true);
    expect(canShiftCalendarMonth({ year: 2027, month: 9 }, -12, now)).toBe(true);
    expect(canShiftCalendarMonth({ year: 2027, month: 8 }, -12, now)).toBe(false);
  });

  it("counts window starts today and covers the open month; optional floor and picked day", () => {
    expect(calendarFetchDateRange(october, null, now)).toEqual({ dateFrom: "2026-10-18", dateTo: "2026-10-31" });
    const lateNow = new Date(2026, 9, 30, 12);
    expect(calendarFetchDateRange(october, null, lateNow)).toEqual({ dateFrom: "2026-10-30", dateTo: "2026-10-31" });
    expect(calendarFetchDateRange(october, null, lateNow, 14)).toEqual({ dateFrom: "2026-10-30", dateTo: "2026-11-12" });
    // Future month: full month.
    expect(calendarFetchDateRange({ year: 2026, month: 11 }, null, now)).toEqual({
      dateFrom: "2026-12-01",
      dateTo: "2026-12-31",
    });
    // A picked day outside the open month stays inside the window.
    expect(calendarFetchDateRange({ year: 2026, month: 11 }, "2026-10-21", now)).toEqual({
      dateFrom: "2026-10-21",
      dateTo: "2026-12-31",
    });
  });

  it("picking a day narrows the hub events window to exactly that day (no page-cap dilution)", () => {
    expect(hubFetchRangeForSelectedDay(null)).toBeUndefined();
    const range = hubFetchRangeForSelectedDay("2026-12-05");
    expect(range).toEqual({ dateFrom: "2026-12-05", dateTo: "2026-12-05" });
    const input = buildExploreHubFetchInput("Chicago", null, "Tonight", range);
    expect(input.dateFrom).toBe("2026-12-05");
    expect(input.dateTo).toBe("2026-12-05");
    // Without a picked day the default 14-day calendar window still applies.
    const base = buildExploreHubFetchInput("Chicago", null, "Tonight");
    expect(base.dateFrom).toBe(dateInWhenRange("Tonight", 0));
    expect(base.dateTo! >= dateInWhenRange("Tonight", 13)).toBe(true);
  });

  it("maps /explore/events/calendar payload to per-day counts and drops zero days", () => {
    const mapped = mapCalendarCountsResponse({
      city: "Chicago",
      date_from: "2026-11-01",
      date_to: "2026-11-30",
      days: [
        { date: "2026-11-03", count: 4 },
        { date: "2026-11-04", count: 0 },
        { date: "2026-11-07T00:00:00", count: 1 },
      ],
      total: 5,
      supported: true,
    });
    expect(mapped).toEqual({ supported: true, countsByIso: { "2026-11-03": 4, "2026-11-07": 1 }, total: 5 });
    const unsupported = mapCalendarCountsResponse({
      city: "Naperville", date_from: "2026-11-01", date_to: "2026-11-30", days: [], total: 0, supported: false,
    });
    expect(unsupported.supported).toBe(false);
    expect(calendarCountsCacheKey("Chicago", "2026-11-01", "2026-11-30")).toBe("chicago|2026-11-01|2026-11-30");
  });

  it("month grid aligns to weekdays, marks past/today, carries counts, pads to full weeks", () => {
    const counts = dayCountsFromSummaries(
      buildCalendarDaySummaries(
        [eventSlot("a", "2026-10-21"), eventSlot("b", "2026-10-21"), eventSlot("c", "2026-10-25")],
        "Tonight",
        calendarMonthRange(october),
      ),
    );
    expect(counts).toEqual({ "2026-10-21": 2, "2026-10-25": 1 });
    const cells = buildCalendarMonthGrid(october, counts, { dateFrom: "2026-10-18", dateTo: "2026-10-31" }, now);
    expect(cells.length % 7).toBe(0);
    // Oct 1 2026 is a Thursday → 4 leading pads (Sun–Wed).
    expect(cells.slice(0, 4).every((c) => c === null)).toBe(true);
    const byIso = new Map(cells.flatMap((c) => (c ? [[c.iso, c] as const] : [])));
    expect(byIso.get("2026-10-01")?.isPast).toBe(true);
    expect(byIso.get("2026-10-18")?.isToday).toBe(true);
    expect(byIso.get("2026-10-21")?.eventCount).toBe(2);
    expect(byIso.get("2026-10-25")?.eventCount).toBe(1);
    expect(byIso.get("2026-10-22")?.eventCount).toBe(0);
    expect(byIso.get("2026-10-22")?.loaded).toBe(true);
    expect(byIso.get("2026-10-05")?.loaded).toBe(false);
    expect(totalCalendarMonthEvents(cells)).toBe(3);
  });

  it("only future days with dated events are selectable", () => {
    const cells = buildCalendarMonthGrid(october, { "2026-10-21": 1, "2026-10-02": 3 }, null, now);
    const byIso = new Map(cells.flatMap((c) => (c ? [[c.iso, c] as const] : [])));
    expect(calendarCellSelectable(byIso.get("2026-10-21")!)).toBe(true);
    expect(calendarCellSelectable(byIso.get("2026-10-22")!)).toBe(false);
    expect(calendarCellSelectable(byIso.get("2026-10-02")!)).toBe(false);
  });

  it("chip label is short weekday + month + day", () => {
    expect(formatCalendarChipLabel("2026-10-21")).toBe("Wed, Oct 21");
    const today = formatIsoDate(new Date());
    expect(formatCalendarChipLabel(offsetIsoDate(today, 0))).toMatch(/^[A-Z][a-z]{2}, [A-Z][a-z]{2} \d{1,2}$/);
  });
});
