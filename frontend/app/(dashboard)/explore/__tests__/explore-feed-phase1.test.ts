import { describe, expect, it } from "vitest";

import { exploreCardReasonLabel } from "../explore-card-reason";
import {
  exploreEventProviderInterleaveKey,
  interleaveEventSlotsByDayAndProvider,
} from "../explore-event-interleave";
import {
  EXPLORE_DEMOTE_CHAIN_NAMES,
  isExploreNationalChainName,
  rankExploreHubSlots,
} from "../explore-feed-quality";
import type { ExploreSlot } from "../explore-hub-data";
import { resolveExploreCardMedia, EXPLORE_MAP_PREVIEW_LABEL } from "../explore-listing-media";
import { exploreLocationScopeFromHero } from "../explore-hero-scope";
import type { HeroResponse } from "@/lib/hero-location";

function eventSlot(partial: Partial<ExploreSlot> & { id: string; source: string }): ExploreSlot {
  return {
    id: partial.id,
    source: partial.source,
    meta: partial.meta ?? "",
    summary: partial.summary ?? "",
    price: partial.price ?? "—",
    note: partial.note ?? "",
    rating: "",
    reviews: "",
    size: "medium",
    theme: "music",
    amount: 0,
    body: "",
    tags: [],
    area: "",
    distanceLabel: partial.distanceLabel ?? "",
    availability: "Check provider",
    exploreListingKind: "event",
    title: partial.title ?? partial.id,
    venue: "Venue",
    city: "Chicago",
    dateLabel: "Tonight",
    priceLabel: "—",
    description: "",
    emoji: "",
    eventDateIso: partial.eventDateIso ?? "2099-06-01",
    eventStartsAtMs: partial.eventStartsAtMs,
    distanceMiles: partial.distanceMiles,
    lat: partial.lat,
    lng: partial.lng,
    priceKnown: partial.priceKnown,
  };
}

describe("explore feed phase 1", () => {
  it("interleaves Eventbrite and Ticketmaster within the same day", () => {
    const day = "2099-06-01";
    const events = [
      eventSlot({ id: "tm1", source: "Ticketmaster", eventDateIso: day }),
      eventSlot({ id: "tm2", source: "Ticketmaster", eventDateIso: day }),
      eventSlot({ id: "eb1", source: "Eventbrite", eventDateIso: day }),
      eventSlot({ id: "tm3", source: "Ticketmaster", eventDateIso: day }),
    ];
    const mixed = interleaveEventSlotsByDayAndProvider(events);
    expect(mixed.map((s) => s.id)).toEqual(["tm1", "eb1", "tm2", "tm3"]);
    expect(exploreEventProviderInterleaveKey("TicketWeb")).toBe("ticketmaster");
  });

  it("Chicago first 24 mock includes Eventbrite when present that day", () => {
    const day = "2099-06-01";
    const manyTm = Array.from({ length: 20 }, (_, i) =>
      eventSlot({ id: `tm-${i}`, source: "Ticketmaster", eventDateIso: day }),
    );
    const eb = eventSlot({ id: "eb-only", source: "Eventbrite", eventDateIso: day });
    const mixed = interleaveEventSlotsByDayAndProvider([...manyTm, eb]);
    const first24 = mixed.slice(0, 24);
    expect(first24.some((s) => s.source === "Eventbrite")).toBe(true);
  });

  it("demotes national chains in top 12", () => {
    const park = eventSlot({
      id: "park",
      source: "Overture",
      title: "Millennium Park",
      lat: 41.88,
      lng: -87.62,
      imageUrl: "https://x/1.jpg",
    });
    park.exploreListingKind = "place";
    const dunkin = eventSlot({
      id: "dunkin",
      source: "Overture",
      title: "Dunkin'",
      lat: 41.88,
      lng: -87.62,
      imageUrl: "https://x/2.jpg",
    });
    dunkin.exploreListingKind = "place";
    const ranked = rankExploreHubSlots([park, dunkin]);
    expect(ranked[0]?.title).toBe("Millennium Park");
    expect(isExploreNationalChainName("Starbucks Reserve")).toBe(true);
    expect(EXPLORE_DEMOTE_CHAIN_NAMES.length).toBeGreaterThan(4);
  });

  it("uses map crop when no photo but coordinates exist", () => {
    const media = resolveExploreCardMedia(
      eventSlot({ id: "p1", source: "Overture", lat: 41.8781, lng: -87.6298, imageUrl: null }),
    );
    expect(media.imageUrl).toBeUndefined();
    expect(media.mapCropUrl).toMatch(/\/17\//);
    expect(media.imageLabel).toBe(EXPLORE_MAP_PREVIEW_LABEL);
  });

  it("reason labels trace to backing fields only", () => {
    const now = new Date("2099-06-01T18:00:00Z");
    expect(
      exploreCardReasonLabel(
        eventSlot({ id: "f", source: "Ticketmaster", price: "Free", priceKnown: true }),
        { when: "Tonight", now },
      ),
    ).toBe("Free");
    expect(
      exploreCardReasonLabel(
        eventSlot({
          id: "d",
          source: "Ticketmaster",
          eventDateIso: "2099-12-15",
          distanceMiles: 0.3,
          distanceLabel: "0.3 mi",
        }),
        { when: "Weekend", now },
      ),
    ).toBe("0.3 mi");
    expect(
      exploreCardReasonLabel(
        eventSlot({
          id: "s",
          source: "Ticketmaster",
          eventStartsAtMs: now.getTime() + 75 * 60_000,
        }),
        { when: "Weekend", now },
      ),
    ).toBe("Starts in 1 h");
  });

  it("hero scope carries neighbourhood coordinates for places fetch", () => {
    const hero: HeroResponse = {
      placeLabel: "Naperville, Illinois",
      precisionNote: "approximate",
      precision: "ip",
      city: "Chicago",
      region: "Illinois",
      country: "US",
      distanceMiles: 28,
      bearing: null,
      suggestedRadiusMiles: null,
      weather: null,
      photo: null,
      dominantColor: "#000",
      hourBucket: null,
      cachedAt: null,
    };
    const scope = exploreLocationScopeFromHero(hero, { lat: 41.7508, lon: -88.1535 });
    expect(scope.label).toContain("Naperville");
    expect(scope.lat).toBeCloseTo(41.7508, 3);
    expect(scope.fetchCity).toBe("Chicago");
  });
});
