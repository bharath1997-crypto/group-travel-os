import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi, beforeEach } from "vitest";

import type { ExploreSlot } from "../explore-hub-data";
import { fetchExploreHub } from "../explore-hub-data";
import { buildExploreCategoryStats } from "../explore-hub-counts";
import { filterHubSlotsByChips } from "../explore-hub-v6-map";
import {
  filterVerifiedExploreApiEventRows,
  isEditorialExploreListing,
} from "../explore-editorial-inventory";
import { dateInWhenRange, expectFixturesAlignedWithTonightRange } from "./explore-test-date-fixtures";

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from "@/lib/api";

const mockedFetch = vi.mocked(apiFetch);

const EXPLORE_ROOT = join(process.cwd(), "app/(dashboard)/explore");

function normPath(p: string): string {
  return p.replace(/\\/g, "/");
}

const AI_INVENTORY_ALLOWLIST = new Set(
  ["explore-editorial-inventory.ts", "__tests__/explore-g07-f04-no-ai-inventory.test.ts"].map((rel) =>
    normPath(join(EXPLORE_ROOT, rel)),
  ),
);

function walkTsFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === "__tests__" && dir === EXPLORE_ROOT) {
        walkTsFiles(full, out);
        continue;
      }
      if (name !== "node_modules" && name !== ".next") walkTsFiles(full, out);
      continue;
    }
    if (/\.(tsx|ts)$/.test(name)) out.push(full);
  }
  return out;
}

function slot(id: string, overrides: Partial<ExploreSlot> = {}): ExploreSlot {
  return {
    id,
    source: "Ticketmaster",
    meta: "Music",
    title: "Show",
    summary: "",
    price: "$20",
    note: "",
    rating: "—",
    reviews: "",
    size: "medium",
    theme: "music",
    amount: 20,
    body: "",
    tags: ["Music"],
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
    ...overrides,
  };
}

const verifiedApiEvent = {
  id: "tm-1",
  name: "Verified Show",
  category: "Music",
  date: "2026-12-01",
  venue: "Hall",
  city: "Chicago",
  source: "ticketmaster",
  ticket_url: "https://ticketmaster.com/tm-1",
};

describe("G07/F04 — no AI in Explore inventory", () => {
  beforeEach(() => {
    mockedFetch.mockReset();
  });

  it("city events page does not request seasonal-events-ai", () => {
    const page = readFileSync(join(EXPLORE_ROOT, "[city]/events/page.tsx"), "utf8");
    expect(page).not.toContain("/explore/seasonal-events-ai");
    expect(page).not.toContain("seasonalAiRowToTrend");
  });

  it("allows ai_fallback only in editorial isolation helper or regression test", () => {
    const files = walkTsFiles(EXPLORE_ROOT);
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      if (!text.includes("ai_fallback")) continue;
      expect(AI_INVENTORY_ALLOWLIST.has(normPath(file))).toBe(true);
    }
  });

  it("filterVerifiedExploreApiEventRows removes generated API rows", () => {
    const rows = filterVerifiedExploreApiEventRows([
      verifiedApiEvent,
      { id: "ai-ev-1", name: "AI", source: "ai_fallback" },
      { id: "editorial-1", name: "Ed", source: "ticketmaster" },
      { id: "eb-1", name: "EB", source: "eventbrite" },
    ]);
    expect(rows.map((r) => r.id)).toEqual(["tm-1", "eb-1"]);
  });

  it("does not treat ticketmaster as generated because of letters ai", () => {
    expect(isEditorialExploreListing("ticketmaster", "tm-99")).toBe(false);
    expect(isEditorialExploreListing("ai", "tm-99")).toBe(true);
  });

  it("fetchExploreHub maps only verified events into slots and source status", async () => {
    mockedFetch.mockImplementation((path: string) => {
      if (path.startsWith("/explore/events?")) {
        return Promise.resolve({
          city: "Chicago",
          display_city: "Chicago",
          events: [
            { id: "ai-ev-1", name: "AI Fest", source: "ai_fallback", category: "Festival", date: "2026-12-01" },
            verifiedApiEvent,
          ],
          trending: [{ id: "editorial-1", name: "Hint", source: "ai_fallback", category: "Festival", date: "2026-12-01" }],
          weekend: [],
          popular: [],
          freshness: { refreshed_at: null, cache_status: "ready" },
        });
      }
      if (path.includes("category=attractions")) {
        return Promise.resolve({ places: [], freshness: { refreshed_at: null, cache_status: "empty" } });
      }
      if (path.includes("category=restaurants")) {
        return Promise.resolve({ places: [], freshness: { refreshed_at: null, cache_status: "empty" } });
      }
      return Promise.reject(new Error(`unexpected ${path}`));
    });

    const payload = await fetchExploreHub({ city: "Chicago" });
    const eventSlots = payload.slots.filter((s) => s.exploreListingKind === "event");
    expect(eventSlots).toHaveLength(1);
    expect(eventSlots[0]?.id).toBe("tm-1");
    expect(payload.sourceStatus.events).toBe("ready");
    expect(payload.sources).not.toContain("Editorial");
    expect(payload.sources).toContain("Ticketmaster");
  });

  it("fetchExploreHub treats editorial-only API payload as empty events source", async () => {
    mockedFetch.mockImplementation((path: string) => {
      if (path.startsWith("/explore/events?")) {
        return Promise.resolve({
          city: "Chicago",
          events: [
            { id: "ai-ev-0", name: "Only AI", source: "ai_fallback", category: "Festival", date: "2026-12-01" },
            { id: "editorial-2", name: "Only editorial id", source: "ticketmaster", category: "Festival", date: "2026-12-01" },
          ],
          trending: [],
          weekend: [],
          popular: [],
          freshness: { refreshed_at: null, cache_status: "ready" },
        });
      }
      if (path.includes("places")) {
        return Promise.resolve({ places: [], freshness: { refreshed_at: null, cache_status: "empty" } });
      }
      return Promise.reject(new Error(`unexpected ${path}`));
    });

    const payload = await fetchExploreHub({ city: "Chicago" });
    expect(payload.slots.filter((s) => s.exploreListingKind === "event")).toHaveLength(0);
    expect(payload.sourceStatus.events).toBe("empty");
    expect(payload.sources.every((s) => s !== "Editorial")).toBe(true);
  });

  it("hub category counts exclude editorial suggestions from Events and Free", () => {
    expectFixturesAlignedWithTonightRange();
    const tonightIso = dateInWhenRange("Tonight", 0);
    const editorial = slot("ai-ev-1", {
      source: "ai_fallback",
      price: "Free",
      priceKnown: true,
      eventDateIso: tonightIso,
      editorial: true,
    });
    const verified = slot("tm-1", {
      source: "Ticketmaster",
      price: "Free",
      priceKnown: true,
      eventDateIso: tonightIso,
      exploreListingKind: "event",
    });
    const pool = [editorial, verified];
    const stats = buildExploreCategoryStats(pool, [], "Tonight");
    const eventsStat = stats.find(([, label]) => label === "Events");
    const freeStat = stats.find(([, label]) => label === "Free tonight");
    expect(eventsStat?.[0]).toBe("1");
    expect(freeStat?.[0]).toBe("1");
    expect(filterHubSlotsByChips(pool, ["Events"], "Tonight")).toHaveLength(1);
    expect(filterHubSlotsByChips(pool, ["Free tonight"], "Tonight")).toHaveLength(1);
    expect(isEditorialExploreListing("ai_fallback", "ai-ev-1")).toBe(true);
  });
});
