import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import type { ExploreSlot } from "../explore-hub-data";
import { filterHubSlotsByChips } from "../explore-hub-v6-map";
import {
  EXPLORE_HUB_PAGE_SIZE,
  buildExploreCategoryStats,
  chipsForCategoryStatCount,
  computeExploreHubCounts,
  formatExploreHubFeedSummary,
  formatLoadMoreButtonLabel,
  interleaveExploreListingSlots,
  sliceVisibleListings,
} from "../explore-hub-counts";
import { dateRangeForWhen } from "../explore-hub-dates";
import {
  dateInWhenRange,
  expectFixturesAlignedWithTonightRange,
} from "./explore-test-date-fixtures";
import {
  deriveExploreHeroListingCountState,
  formatExploreHeroListingCountLine,
} from "../explore-hero-listing-count";
import {
  isExploreFreeInWhenRange,
  isExploreLandmarkListing,
} from "../explore-hub-listing-predicates";
import { fetchExploreHub } from "../explore-hub-data";

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from "@/lib/api";

const mockedFetch = vi.mocked(apiFetch);

function slot(partial: Partial<ExploreSlot> & Pick<ExploreSlot, "id">): ExploreSlot {
  return {
    source: "Ticketmaster",
    meta: "",
    title: partial.title ?? partial.id,
    summary: "",
    price: "$20",
    note: "",
    rating: "—",
    reviews: "",
    size: "medium",
    theme: "music",
    amount: 20,
    body: "",
    tags: [],
    area: "Chicago",
    distanceLabel: "—",
    availability: "Check provider",
    venue: "Venue",
    city: "Chicago",
    dateLabel: "Tonight",
    priceLabel: "$20",
    description: "",
    emoji: "",
    exploreListingKind: "event",
    priceKnown: true,
    ...partial,
  };
}

describe("explore-hub-counts contract", () => {
  it("aligns Free/Weekend fixtures with live dateRangeForWhen (calendar-safe)", () => {
    expectFixturesAlignedWithTonightRange();
  });

  it("computes loadedScopeCount, matchingCount, visibleCount, and hasMore", () => {
    const loaded = Array.from({ length: 30 }, (_, i) => slot({ id: `e-${i}` }));
    const matching = loaded;
    const counts = computeExploreHubCounts(loaded, matching, 24);
    expect(counts.loadedScopeCount).toBe(30);
    expect(counts.matchingCount).toBe(30);
    expect(counts.visibleCount).toBe(24);
    expect(counts.hasMore).toBe(true);
  });

  it("reveals 24 initially and load more expands visible slice", () => {
    const matching = Array.from({ length: 40 }, (_, i) => slot({ id: `x-${i}` }));
    expect(sliceVisibleListings(matching, 24)).toHaveLength(24);
    const afterMore = sliceVisibleListings(matching, 48);
    expect(afterMore).toHaveLength(40);
    expect(formatLoadMoreButtonLabel(24, 40)).toBe("Load 16 more");
  });

  it("formats load-more label for fewer than 24 remaining", () => {
    expect(formatLoadMoreButtonLabel(30, 35)).toBe("Load 5 more");
    expect(formatLoadMoreButtonLabel(35, 35)).toBe("Load more");
  });

  it("resets pagination limit via page effect key (city, date, filters)", () => {
    const page = readFileSync(join(process.cwd(), "app/(dashboard)/explore/page.tsx"), "utf8");
    expect(page).toContain("paginationResetKey");
    expect(page).toContain("setVisibleLimit(EXPLORE_HUB_PAGE_SIZE)");
    expect(page).toContain("when");
    expect(page).toContain("chips.join");
  });

  it("keeps filter-zero at zero without restoring inventory", () => {
    const loaded = [slot({ id: "1", meta: "Music", tags: ["Music"] })];
    const filtered = filterHubSlotsByChips(loaded, ["Comedy"], "Tonight");
    expect(filtered).toHaveLength(0);
    expect(loaded).toHaveLength(1);
  });

  it("aligns hero, pulse, and refine copy on the same count contract", () => {
    const summary = formatExploreHubFeedSummary({
      city: "Chicago",
      filtersActive: false,
      visibleCount: 24,
      loadedScopeCount: 40,
      matchingCount: 40,
    });
    expect(summary).toBe("Showing 24 of 40 loaded listings in Chicago");
    const filtered = formatExploreHubFeedSummary({
      city: "Chicago",
      filtersActive: true,
      visibleCount: 10,
      loadedScopeCount: 40,
      matchingCount: 10,
    });
    expect(filtered).toBe("10 matching loaded listings in Chicago");
    const page = readFileSync(join(process.cwd(), "app/(dashboard)/explore/page.tsx"), "utf8");
    expect(page).toContain("formatExploreHubFeedSummary");
    expect(page).toContain("Show {hubCounts.matchingCount} listings");
    expect(page).toContain("deriveExploreHeroListingCountState");
    const hero = readFileSync(join(process.cwd(), "app/(dashboard)/explore/HeroLocationWidget.tsx"), "utf8");
    const heroCount = readFileSync(join(process.cwd(), "app/(dashboard)/explore/explore-hero-listing-count.ts"), "utf8");
    expect(hero).toContain("formatExploreHeroListingCountLine");
    expect(heroCount).toContain("Listing count unavailable");
  });

  it("never falls back landmarks count to all places", () => {
    const museum = slot({
      id: "m1",
      exploreListingKind: "place",
      explorePlaceBucket: "attractions",
      meta: "Museum",
      tags: ["Museum"],
    });
    const restaurant = slot({
      id: "r1",
      exploreListingKind: "place",
      explorePlaceBucket: "restaurants",
      meta: "Restaurant",
      tags: ["Restaurant"],
    });
    expect(isExploreLandmarkListing(museum)).toBe(true);
    expect(isExploreLandmarkListing(restaurant)).toBe(false);
    const stats = buildExploreCategoryStats([museum, restaurant], [], "Tonight");
    const landmarks = stats.find(([, label]) => label === "Landmarks");
    expect(landmarks?.[0]).toBe("1");
  });

  it("weekend Free chip excludes undated, editorial, place, and out-of-range rows", () => {
    const when = "This weekend";
    const inRange = slot({
      id: "ok",
      price: "Free",
      priceKnown: true,
      eventDateIso: dateInWhenRange(when, 0),
    });
    const undated = slot({ id: "u", price: "Free", priceKnown: true, eventDateIso: null });
    const editorial = slot({
      id: "ed",
      price: "Free",
      priceKnown: true,
      editorial: true,
      eventDateIso: dateInWhenRange(when, 0),
    });
    const placeFree = slot({
      id: "p",
      price: "Free",
      priceKnown: true,
      exploreListingKind: "place",
      eventDateIso: dateInWhenRange(when, 0),
    });
    const outOfRange = slot({
      id: "out",
      price: "Free",
      priceKnown: true,
      eventDateIso: dateInWhenRange(when, 14),
    });
    const pool = [inRange, undated, editorial, placeFree, outOfRange];
    expect(filterHubSlotsByChips(pool, ["Free"], when)).toEqual([inRange]);
    expect(isExploreFreeInWhenRange(inRange, when)).toBe(true);
    expect(isExploreFreeInWhenRange(undated, when)).toBe(false);
    expect(isExploreFreeInWhenRange(editorial, when)).toBe(false);
    expect(isExploreFreeInWhenRange(placeFree, when)).toBe(false);
    expect(isExploreFreeInWhenRange(outOfRange, when)).toBe(false);
  });

  it("next week Free stat count equals filterHubSlotsByChips result length", () => {
    const when = "Next week";
    const pool = [
      slot({
        id: "a",
        price: "Free",
        priceKnown: true,
        eventDateIso: dateInWhenRange(when, 0),
      }),
      slot({
        id: "b",
        price: "Free",
        priceKnown: true,
        eventDateIso: dateInWhenRange(when, 3),
      }),
      slot({ id: "c", price: "Free", priceKnown: true, eventDateIso: null }),
    ];
    const stats = buildExploreCategoryStats(pool, [], when);
    const freeRow = stats.find(([, label]) => label === "Free");
    const filteredLen = filterHubSlotsByChips(pool, ["Free"], when).length;
    expect(freeRow?.[0]).toBe(String(filteredLen));
    expect(filteredLen).toBe(2);
  });

  it("category stat counts respect another active category chip and non-category filters", () => {
    const musicEvent = slot({ id: "ev-m", meta: "Music · Chicago", tags: ["Music"] });
    const foodEvent = slot({
      id: "ev-f",
      meta: "Food · Chicago",
      tags: ["Food"],
      title: "Tasting",
    });
    const foodPlace = slot({
      id: "pl-f",
      exploreListingKind: "place",
      explorePlaceBucket: "restaurants",
      meta: "Restaurant",
      tags: ["Restaurant"],
      title: "Bistro",
    });
    const pool = [musicEvent, foodEvent, foodPlace];
    const withEvents = buildExploreCategoryStats(pool, ["Events"], "Tonight");
    const foodCount = withEvents.find(([, label]) => label === "Food & drink");
    expect(foodCount?.[0]).toBe(
      String(filterHubSlotsByChips(pool, chipsForCategoryStatCount(["Events"], "Food & drink"), "Tonight").length),
    );
    expect(foodCount?.[0]).toBe("1");
    const withPrice = buildExploreCategoryStats(pool, ["Under $25"], "Tonight");
    const eventsUnder = withPrice.find(([, label]) => label === "Events");
    expect(eventsUnder?.[0]).toBe(
      String(filterHubSlotsByChips(pool, chipsForCategoryStatCount(["Under $25"], "Events"), "Tonight").length),
    );
  });

  it("adding a displayed category chip yields the count shown beside it", () => {
    const a = slot({ id: "1", meta: "Music", tags: ["Music"] });
    const b = slot({ id: "2", meta: "Comedy", tags: ["Comedy"], title: "Standup" });
    const pool = [a, b];
    const stats = buildExploreCategoryStats(pool, [], "Tonight");
    const liveMusic = stats.find(([, label]) => label === "Live music");
    expect(liveMusic?.[0]).toBe("1");
    expect(filterHubSlotsByChips(pool, ["Live music"], "Tonight")).toHaveLength(1);
    const activeStats = buildExploreCategoryStats(pool, ["Live music"], "Tonight");
    const liveMusicOn = activeStats.find(([, label]) => label === "Live music");
    expect(liveMusicOn?.[0]).toBe("1");
    expect(filterHubSlotsByChips(pool, ["Live music"], "Tonight")).toHaveLength(1);
  });

  it("hero listing count states distinguish loading, unavailable, and ready counts", () => {
    expect(formatExploreHeroListingCountLine({ phase: "loading" })).toBe("Checking listings");
    expect(formatExploreHeroListingCountLine({ phase: "unavailable" })).toBe("Listing count unavailable");
    expect(formatExploreHeroListingCountLine({ phase: "ready", count: 0 })).toBe("0 loaded listings");
    expect(formatExploreHeroListingCountLine({ phase: "ready", count: 12 })).toBe("12 loaded listings");

    expect(
      deriveExploreHeroListingCountState({
        loading: false,
        unexpectedError: false,
        hubLoadState: "failed",
        loadedScopeCount: 0,
      }).phase,
    ).toBe("unavailable");
    expect(
      deriveExploreHeroListingCountState({
        loading: false,
        unexpectedError: true,
        hubLoadState: "ready",
        loadedScopeCount: 5,
      }).phase,
    ).toBe("unavailable");
    expect(
      deriveExploreHeroListingCountState({
        loading: false,
        unexpectedError: false,
        hubLoadState: "partial",
        loadedScopeCount: 0,
      }).phase,
    ).toBe("unavailable");
    expect(
      deriveExploreHeroListingCountState({
        loading: false,
        unexpectedError: false,
        hubLoadState: "empty",
        loadedScopeCount: 0,
      }),
    ).toEqual({ phase: "ready", count: 0 });
    expect(
      deriveExploreHeroListingCountState({
        loading: false,
        unexpectedError: false,
        hubLoadState: "partial",
        loadedScopeCount: 4,
      }),
    ).toEqual({ phase: "ready", count: 4 });
    expect(
      deriveExploreHeroListingCountState({
        loading: false,
        unexpectedError: false,
        hubLoadState: "ready",
        loadedScopeCount: 24,
      }),
    ).toEqual({ phase: "ready", count: 24 });
  });

  it("removes showing-now and slots-live copy from hub UI", () => {
    const page = readFileSync(join(process.cwd(), "app/(dashboard)/explore/page.tsx"), "utf8");
    const hero = readFileSync(join(process.cwd(), "app/(dashboard)/explore/HeroLocationWidget.tsx"), "utf8");
    const data = readFileSync(join(process.cwd(), "app/(dashboard)/explore/explore-hub-data.ts"), "utf8");
    expect(page.toLowerCase()).not.toContain("slots live");
    expect(page).not.toContain("totalLive");
    expect(page).not.toContain("Showing now");
    expect(hero.toLowerCase()).not.toContain("slots live");
    expect(hero.toLowerCase()).not.toContain("live inventory");
    expect(data).not.toContain("Showing now");
    expect(data).not.toContain("totalLive");
  });

  it("counts only successful-source rows after partial failure", async () => {
    mockedFetch.mockReset();
    mockedFetch
      .mockRejectedValueOnce(new Error("events down"))
      .mockResolvedValueOnce({
        places: [
          { id: "a1", name: "Art museum", category: "museum", source: "openstreetmap" },
          { id: "a2", name: "Gallery", category: "gallery", source: "openstreetmap" },
        ],
      })
      .mockRejectedValueOnce(new Error("food down"));
    const payload = await fetchExploreHub({ city: "Chicago" });
    expect(payload.hubLoadState).toBe("partial");
    expect(payload.slots).toHaveLength(2);
    expect(payload.slots.every((s) => s.exploreListingKind === "place")).toBe(true);
  });

  it("explore picks use visible feed slice only", () => {
    const page = readFileSync(join(process.cwd(), "app/(dashboard)/explore/page.tsx"), "utf8");
    expect(page).toContain("hubSlotsToRanking(visibleSlots)");
    expect(page).toContain("slotsToWayraPlans(visibleSlots");
  });

  it("interleaves events and place buckets deterministically", () => {
    const events = [slot({ id: "e1" }), slot({ id: "e2" })];
    const attractions = [
      slot({ id: "a1", exploreListingKind: "place", explorePlaceBucket: "attractions" }),
    ];
    const restaurants = [
      slot({ id: "r1", exploreListingKind: "place", explorePlaceBucket: "restaurants" }),
    ];
    const mixed = interleaveExploreListingSlots(events, attractions, restaurants);
    expect(mixed.map((s) => s.id)).toEqual(["e1", "a1", "r1", "e2"]);
  });
});

describe("explore hub page size", () => {
  it("uses 24 as default page size", () => {
    expect(EXPLORE_HUB_PAGE_SIZE).toBe(24);
  });
});
