import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  formatExploreHubFreshnessLine,
  formatExploreListingSources,
  formatCacheAgeShort,
} from "../explore-freshness-copy";

const FIXED_NOW = Date.parse("2026-09-23T12:00:00.000Z");

describe("explore-freshness-copy", () => {
  it("formats single-source cache age without browser load time", () => {
    const line = formatExploreHubFreshnessLine(
      {
        events: {
          refreshed_at: "2026-09-23T11:48:00.000Z",
          cache_status: "fresh_cache",
        },
      },
      FIXED_NOW,
    );
    expect(line).toBe("Cache refreshed 12 min ago");
    expect(line).not.toMatch(/just now/i);
  });

  it("keeps mixed event and place ages distinguishable", () => {
    const line = formatExploreHubFreshnessLine(
      {
        events: {
          refreshed_at: "2026-09-23T11:48:00.000Z",
          cache_status: "provider_refresh",
        },
        attractions: {
          refreshed_at: "2026-09-23T10:00:00.000Z",
          cache_status: "fresh_cache",
        },
        restaurants: {
          refreshed_at: "2026-09-23T09:00:00.000Z",
          cache_status: "fresh_cache",
        },
      },
      FIXED_NOW,
    );
    expect(line).toContain("Data age ·");
    expect(line).toContain("events 12 min");
    expect(line).toMatch(/attractions 2 hr|attractions 3 hr/);
    expect(line).toMatch(/restaurants 3 hr/);
  });

  it("shows single stale fallback with per-source age", () => {
    const line = formatExploreHubFreshnessLine(
      {
        events: {
          refreshed_at: "2026-09-23T10:00:00.000Z",
          cache_status: "stale_fallback",
        },
      },
      FIXED_NOW,
    );
    expect(line).toBe("Older cached data · events 2 hr");
    expect(line).not.toMatch(/last cache refresh/i);
  });

  it("shows each stale source age when multiple are stale_fallback", () => {
    const line = formatExploreHubFreshnessLine(
      {
        events: {
          refreshed_at: "2026-09-23T07:00:00.000Z",
          cache_status: "stale_fallback",
        },
        attractions: {
          refreshed_at: "2026-09-23T10:00:00.000Z",
          cache_status: "stale_fallback",
        },
        restaurants: {
          refreshed_at: "2026-09-23T09:30:00.000Z",
          cache_status: "stale_fallback",
        },
      },
      FIXED_NOW,
    );
    expect(line).toBe("Older cached data · events 5 hr · attractions 2 hr · restaurants 3 hr");
  });

  it("uses Sources unavailable when provider list is empty", () => {
    expect(formatExploreListingSources([])).toBe("Sources unavailable");
    expect(formatExploreListingSources(undefined)).toBe("Sources unavailable");
    expect(formatExploreListingSources(["Ticketmaster", "OpenStreetMap"])).toBe(
      "Listing sources: Ticketmaster · OpenStreetMap",
    );
  });

  it("shows unavailable when no timestamps exist", () => {
    expect(
      formatExploreHubFreshnessLine({
        events: { refreshed_at: null, cache_status: "unavailable" },
      }),
    ).toBe("Freshness unavailable");
  });

  it("does not treat empty cache as just now", () => {
    expect(formatCacheAgeShort(null)).toBeNull();
    expect(
      formatExploreHubFreshnessLine({
        events: { refreshed_at: null, cache_status: "empty" },
      }),
    ).toBe("");
  });

  it("main explore page has no Live inventory or updated just now", () => {
    const pagePath = join(process.cwd(), "app/(dashboard)/explore/page.tsx");
    const src = readFileSync(pagePath, "utf8");
    expect(src).not.toContain("Live inventory");
    expect(src).not.toContain("formatFetchedAgo");
    expect(src).not.toMatch(/updated\s*\{/i);
    expect(src).toContain("Explore listings");
    expect(src).toContain("formatExploreHubFreshnessLine");
    expect(src).not.toContain("Ticketmaster · OpenStreetMap");
    expect(src).toContain("formatExploreListingSources");
  });
});
