import type { ExploreSlot } from "./explore-hub-data";
import { dateRangeForWhen } from "./explore-hub-dates";
import { filterHubSlotsByChips } from "./explore-hub-chip-match";
import { freePriceStatLabel } from "./explore-hub-listing-predicates";

export const EXPLORE_HUB_PAGE_SIZE = 24;

export type ExploreHubCountSnapshot = {
  loadedScopeCount: number;
  matchingCount: number;
  visibleCount: number;
  pageSize: number;
  hasMore: boolean;
};

export function computeExploreHubCounts(
  loadedScope: ExploreSlot[],
  matching: ExploreSlot[],
  visibleLimit: number,
): ExploreHubCountSnapshot {
  const matchingCount = matching.length;
  const visibleCount = Math.min(visibleLimit, matchingCount);
  return {
    loadedScopeCount: loadedScope.length,
    matchingCount,
    visibleCount,
    pageSize: EXPLORE_HUB_PAGE_SIZE,
    hasMore: visibleCount < matchingCount,
  };
}

export function sliceVisibleListings<T>(matching: T[], visibleLimit: number): T[] {
  return matching.slice(0, visibleLimit);
}

export function loadMoreIncrement(visibleCount: number, matchingCount: number): number {
  return Math.min(EXPLORE_HUB_PAGE_SIZE, Math.max(0, matchingCount - visibleCount));
}

export function formatLoadMoreButtonLabel(visibleCount: number, matchingCount: number): string {
  const remaining = matchingCount - visibleCount;
  if (remaining <= 0) return "Load more";
  if (remaining < EXPLORE_HUB_PAGE_SIZE) return `Load ${remaining} more`;
  return "Load 24 more";
}

export function formatExploreHubFeedSummary(args: {
  city: string;
  filtersActive: boolean;
  visibleCount: number;
  loadedScopeCount: number;
  matchingCount: number;
}): string {
  const { city, filtersActive, visibleCount, loadedScopeCount, matchingCount } = args;
  if (filtersActive) {
    if (visibleCount >= matchingCount && matchingCount > 0) {
      return `${matchingCount} matching loaded listings in ${city}`;
    }
    return `Showing ${visibleCount} of ${matchingCount} matching loaded listings in ${city}`;
  }
  if (visibleCount >= loadedScopeCount && loadedScopeCount > 0) {
    return `${loadedScopeCount} loaded listings in ${city}`;
  }
  return `Showing ${visibleCount} of ${loadedScopeCount} loaded listings in ${city}`;
}

export function chipsForCategoryStatCount(activeChips: string[], categoryChip: string): string[] {
  if (activeChips.includes(categoryChip)) {
    return activeChips;
  }
  return [...activeChips, categoryChip];
}

export function buildExploreCategoryStats(
  loadedScope: ExploreSlot[],
  activeChips: string[],
  when: string,
  calendarDayIso?: string | null,
): [string, string][] {
  const freeLabel = freePriceStatLabel(when);

  const countForChip = (chip: string): number =>
    filterHubSlotsByChips(
      loadedScope,
      chipsForCategoryStatCount(activeChips, chip),
      when,
      calendarDayIso,
    ).length;

  const rows: [string, string][] = [
    [String(countForChip("Events")), "Events"],
    [String(countForChip("Food & drink")), "Food & drink"],
    [String(countForChip("Live music")), "Live music"],
    [String(countForChip("Outdoors")), "Outdoors"],
    [String(countForChip("Landmarks")), "Landmarks"],
  ];

  if (when.trim().toLowerCase() === "tonight" || dateRangeForWhen(when).dateFrom) {
    rows.push([String(countForChip(freeLabel)), freeLabel]);
  }

  return rows.filter(([count]) => Number(count) > 0);
}

export function interleaveExploreListingSlots(
  eventSlots: ExploreSlot[],
  attractionSlots: ExploreSlot[],
  restaurantSlots: ExploreSlot[],
): ExploreSlot[] {
  const queues = [eventSlots, attractionSlots, restaurantSlots];
  const indices = [0, 0, 0];
  const out: ExploreSlot[] = [];
  let progressed = true;
  while (progressed) {
    progressed = false;
    for (let i = 0; i < queues.length; i++) {
      const queue = queues[i];
      if (indices[i]! < queue.length) {
        out.push(queue[indices[i]!]!);
        indices[i]! += 1;
        progressed = true;
      }
    }
  }
  return out;
}

export { freePriceStatLabel } from "./explore-hub-listing-predicates";
