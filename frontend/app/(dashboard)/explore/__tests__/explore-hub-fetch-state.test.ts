import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { fetchExploreHub } from "../explore-hub-data";
import {
  classifyExplorePlacesSourceLoadState,
  classifyExploreSourceLoadState,
  deriveExploreHubLoadState,
  formatPartialSourceFailureLine,
  shouldApplyExploreHubResponse,
  type ExploreSourceStatusMap,
} from "../explore-hub-fetch-state";
import { buildExploreHubFetchInput } from "../use-explore-hub";
import { filterHubSlotsByChips } from "../explore-hub-v6-map";
import type { ExploreSlot } from "../explore-hub-data";

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from "@/lib/api";

const mockedFetch = vi.mocked(apiFetch);

function status(partial: Partial<ExploreSourceStatusMap>): ExploreSourceStatusMap {
  return {
    events: "empty",
    attractions: "empty",
    restaurants: "empty",
    ...partial,
  };
}

describe("explore-hub-fetch-state", () => {
  it("classifies source states from success and row counts", () => {
    expect(classifyExploreSourceLoadState(true, 3)).toBe("ready");
    expect(classifyExploreSourceLoadState(true, 0)).toBe("empty");
    expect(classifyExploreSourceLoadState(false, 0)).toBe("failed");
  });

  it("classifies places API source_status separately from HTTP success", () => {
    expect(classifyExplorePlacesSourceLoadState(true, { places: [], source_status: "empty" })).toBe(
      "empty",
    );
    expect(
      classifyExplorePlacesSourceLoadState(true, { places: [], source_status: "unavailable" }),
    ).toBe("failed");
    expect(
      classifyExplorePlacesSourceLoadState(true, {
        places: [{ id: "p1" }],
        source_status: "ready",
      }),
    ).toBe("ready");
    expect(classifyExplorePlacesSourceLoadState(false, null)).toBe("failed");
  });

  it("derives ready when inventory exists and no failures", () => {
    expect(deriveExploreHubLoadState(status({ events: "ready" }), 4)).toBe("ready");
  });

  it("derives partial when one source fails and another returns rows", () => {
    expect(
      deriveExploreHubLoadState(status({ events: "ready", attractions: "failed" }), 2),
    ).toBe("partial");
  });

  it("derives partial when one source fails and others succeed with zero rows", () => {
    expect(
      deriveExploreHubLoadState(
        status({ events: "failed", attractions: "empty", restaurants: "empty" }),
        0,
      ),
    ).toBe("partial");
  });

  it("derives empty when all succeed with zero inventory", () => {
    expect(deriveExploreHubLoadState(status({}), 0)).toBe("empty");
  });

  it("derives failed when all sources fail", () => {
    expect(
      deriveExploreHubLoadState(
        status({ events: "failed", attractions: "failed", restaurants: "failed" }),
        0,
      ),
    ).toBe("failed");
  });

  it("formats partial failure copy when inventory survives", () => {
    const line = formatPartialSourceFailureLine(
      status({ attractions: "failed", restaurants: "failed" }),
      3,
    );
    expect(line).toContain("Attractions · Restaurants");
    expect(line).toContain("Showing available results");
  });

  it("formats partial failure copy when no slots survive", () => {
    const line = formatPartialSourceFailureLine(status({ events: "failed" }), 0);
    expect(line).toContain("Events");
    expect(line).toContain("Available sources returned no listings");
    expect(line).not.toContain("Showing available results");
  });

  it("ignores late hub responses", () => {
    expect(shouldApplyExploreHubResponse(1, 2)).toBe(false);
    expect(shouldApplyExploreHubResponse(2, 2)).toBe(true);
  });

  it("retry input retains scope, coordinates, and date range", () => {
    const input = buildExploreHubFetchInput(
      "Chicago",
      {
        label: "Chicago, IL, US",
        city: "Chicago",
        state: "Illinois",
        country: "United States",
        lat: 41.88,
        lon: -87.63,
      },
      "Weekend",
    );
    expect(input.city).toBe("Chicago");
    expect(input.state).toBe("Illinois");
    expect(input.country).toBe("United States");
    expect(input.lat).toBe(41.88);
    expect(input.lon).toBe(-87.63);
    expect(input.dateFrom).toBeTruthy();
    expect(input.dateTo).toBeTruthy();
  });

  it("zero filter matches stay empty without restoring full feed", () => {
    const slots: ExploreSlot[] = [
      {
        id: "1",
        source: "Ticketmaster",
        meta: "Music",
        title: "Jazz",
        summary: "Venue",
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
      },
    ];
    const filtered = filterHubSlotsByChips(slots, ["Comedy"]);
    expect(filtered).toHaveLength(0);
    expect(slots).toHaveLength(1);
  });
});

describe("fetchExploreHub source outcomes", () => {
  beforeEach(() => {
    mockedFetch.mockReset();
  });

  it("marks failed sources and omits them from sources list", async () => {
    mockedFetch.mockImplementation(async (path: string) => {
      const url = String(path);
      if (url.includes("/explore/events")) throw new Error("events down");
      if (url.includes("category=restaurants")) throw new Error("food down");
      return { places: [{ id: "a1", name: "Museum", source: "openstreetmap" }] };
    });

    const payload = await fetchExploreHub({ city: "Chicago" });
    expect(payload.hubLoadState).toBe("partial");
    expect(payload.sourceStatus.events).toBe("failed");
    expect(payload.sourceStatus.restaurants).toBe("failed");
    expect(payload.sourceStatus.attractions).toBe("ready");
    expect(payload.sources).not.toContain("Ticketmaster");
    expect(payload.slots.length).toBeGreaterThan(0);
  });

  it("returns failed when all sources reject", async () => {
    mockedFetch.mockRejectedValue(new Error("down"));
    const payload = await fetchExploreHub({ city: "Chicago" });
    expect(payload.hubLoadState).toBe("failed");
    expect(payload.slots).toHaveLength(0);
    expect(payload.sources).toHaveLength(0);
  });

  it("returns empty when all succeed with zero rows", async () => {
    mockedFetch
      .mockResolvedValueOnce({ city: "Chicago", events: [] })
      .mockResolvedValueOnce({ places: [], source_status: "empty" })
      .mockResolvedValueOnce({ places: [], source_status: "empty" });
    const payload = await fetchExploreHub({ city: "Chicago" });
    expect(payload.hubLoadState).toBe("empty");
    expect(payload.slots).toHaveLength(0);
  });

  it("shows event cards when places sources fail (503) with partial failure copy", async () => {
    mockedFetch.mockImplementation(async (path: string) => {
      const url = String(path);
      if (url.includes("/explore/events")) {
        return {
          city: "Chicago",
          events: [
            {
              id: "ev1",
              name: "Jazz Night",
              date: "2026-09-26",
              source: "ticketmaster",
              category: "Music",
              venue: "Hall",
              city: "Chicago",
            },
          ],
        };
      }
      throw new Error("503 Places index unavailable");
    });

    const payload = await fetchExploreHub({ city: "Chicago" });
    expect(payload.hubLoadState).toBe("partial");
    expect(payload.sourceStatus.events).toBe("ready");
    expect(payload.sourceStatus.attractions).toBe("failed");
    expect(payload.sourceStatus.restaurants).toBe("failed");
    expect(payload.slots.length).toBeGreaterThan(0);
    const line = formatPartialSourceFailureLine(payload.sourceStatus, payload.slots.length);
    expect(line).toContain("Attractions");
    expect(line).toContain("Restaurants");
    expect(line).toContain("Showing available results");
  });

  it("returns partial with zero slots when some sources fail and others are empty", async () => {
    mockedFetch.mockImplementation(async (path: string) => {
      if (String(path).includes("/explore/events")) throw new Error("events down");
      return { places: [] };
    });
    const payload = await fetchExploreHub({ city: "Chicago" });
    expect(payload.hubLoadState).toBe("partial");
    expect(payload.slots).toHaveLength(0);
    expect(payload.sourceStatus.events).toBe("failed");
    expect(formatPartialSourceFailureLine(payload.sourceStatus, payload.slots.length)).toContain(
      "Available sources returned no listings",
    );
  });

  it("reports places early while a slow events query is still running", async () => {
    let releaseEvents: () => void = () => {};
    const eventsGate = new Promise<void>((resolve) => {
      releaseEvents = resolve;
    });
    mockedFetch.mockImplementation(async (path: string) => {
      const url = String(path);
      if (url.includes("/explore/events")) {
        await eventsGate;
        return { city: "Chicago", events: [] };
      }
      return {
        places: [
          { id: "g1", gers_id: "g1", name: "Cafe One", category: "restaurants", lat: 41.9, lng: -87.6, distance_m: 500 },
        ],
        source_status: "ready",
      };
    });

    const early: Array<{ pending?: boolean; slots: number }> = [];
    const done = fetchExploreHub({ city: "Chicago", lat: 41.9, lon: -87.6 }, (p) =>
      early.push({ pending: p.eventsPending, slots: p.slots.length }),
    );
    await vi.waitFor(() => expect(early.length).toBe(1));
    expect(early[0].pending).toBe(true);
    expect(early[0].slots).toBeGreaterThan(0);

    releaseEvents();
    const final = await done;
    expect(final.eventsPending).toBeUndefined();
  });

  it("uses the pin for events and places, not the nearest hub city", async () => {
    mockedFetch
      .mockResolvedValueOnce({ city: "Chicago", events: [] })
      .mockResolvedValueOnce({ places: [] })
      .mockResolvedValueOnce({ places: [] });

    await fetchExploreHub({
      city: "Naperville",
      lat: 41.7508,
      lon: -88.1535,
      displayLabel: "Naperville, Illinois",
    });

    const calls = mockedFetch.mock.calls.map((c) => String(c[0]));
    const eventsCall = calls.find((u) => u.includes("/explore/events")) ?? "";
    const placesCall = calls.find((u) => u.includes("/explore/places")) ?? "";
    expect(eventsCall).toMatch(/within_miles=25/);
    expect(eventsCall).toMatch(/lat=41\.7508/);
    expect(eventsCall).not.toMatch(/city=Chicago/i);
    expect(placesCall).toMatch(/lat=41\.7508/);
    expect(placesCall).toMatch(/lon=-88\.1535/);
    expect(placesCall).toMatch(/radius_m=40234/);
  });

  it("recovers a source on the second attempt after a transient failure", async () => {
    vi.useFakeTimers();
    const eventAttempts = { n: 0 };
    mockedFetch.mockImplementation(async (path: string) => {
      const url = String(path);
      if (url.includes("/explore/events")) {
        eventAttempts.n += 1;
        if (eventAttempts.n === 1) throw new Error("timeout");
        return { city: "Chicago", events: [{ id: "ev1", name: "Show", date: "2026-10-09", source: "ticketmaster", category: "Music", venue: "Hall", city: "Chicago" }] };
      }
      return { places: [], source_status: "empty" as const };
    });

    const pending = fetchExploreHub({ city: "Chicago" });
    await vi.runAllTimersAsync();
    const payload = await pending;
    vi.useRealTimers();

    expect(payload.hubLoadState).not.toBe("failed");
    expect(payload.sourceStatus.events).toBe("ready");
    expect(eventAttempts.n).toBe(2);
  });

  it("starts all three source requests before any resolve", async () => {
    const resolvers: Array<(value: unknown) => void> = [];
    mockedFetch.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvers.push(resolve);
        }),
    );
    const pending = fetchExploreHub({ city: "Chicago" });
    await Promise.resolve();
    expect(mockedFetch).toHaveBeenCalledTimes(3);
    for (const resolve of resolvers) {
      resolve({ city: "Chicago", events: [] });
    }
    await pending;
  });
});

describe("explore hub load-state regression", () => {
  it("removes feed-never-empty copy and zero-inventory-as-error patterns", () => {
    const page = readFileSync(join(process.cwd(), "app/(dashboard)/explore/page.tsx"), "utf8");
    const hook = readFileSync(join(process.cwd(), "app/(dashboard)/explore/use-explore-hub.ts"), "utf8");
    expect(page.toLowerCase()).not.toContain("feed never comes back empty");
    expect(page).not.toContain("reload(city)");
    expect(page).not.toContain("totalLive");
    expect(page.toLowerCase()).not.toContain("slots live");
    expect(hook).not.toMatch(/No live listings in the database/i);
  });
});
