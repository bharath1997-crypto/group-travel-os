import { describe, expect, it } from "vitest";

import {
  categoryCardScheduleLine,
  drawerHoursSourceLabel,
  hubListingBadge,
  isProviderAvailabilityText,
  normalizeListingAvailability,
} from "../explore-availability-copy";
import { hubSlotToCard, hubSlotToDetail } from "../explore-hub-v6-map";
import type { ExploreSlot } from "../explore-hub-data";

describe("explore-availability-copy", () => {
  it("category cards never say Open daily without a date", () => {
    expect(categoryCardScheduleLine({ id: "1", name: "X" }, false)).toBe("Hours unknown");
    expect(categoryCardScheduleLine({ id: "1", name: "X", date: "2026-09-25" }, false)).not.toBe("Open daily");
    expect(categoryCardScheduleLine({ id: "1", name: "X" }, true)).toBe("Preview · hours unknown");
  });

  it("normalizes generic open copy to Check provider", () => {
    expect(normalizeListingAvailability("Open")).toBe("Check provider");
    expect(normalizeListingAvailability("Open now")).toBe("Check provider");
    expect(normalizeListingAvailability("12 left")).toBe("12 left");
    expect(normalizeListingAvailability("", { editorial: true })).toBe("Check provider");
  });

  it("normalizes Ticketmaster sold_out to Sold out without inventing counts", () => {
    expect(normalizeListingAvailability("sold_out")).toBe("Sold out");
    expect(normalizeListingAvailability("soldout")).toBe("Sold out");
    expect(hubListingBadge({ availability: "sold_out" })).toBe("Sold out");
  });

  it("passes OSM weekly hours to drawer detail without open-now conversion", () => {
    const detail = hubSlotToDetail({
      id: "osm-1",
      source: "OpenStreetMap",
      meta: "Cafe · Chicago",
      title: "Test Cafe",
      summary: "Main St",
      price: "Price unknown",
      note: "weekly hours from OpenStreetMap · not open-now",
      rating: "",
      reviews: "",
      size: "medium",
      theme: "food",
      amount: 0,
      body: "Test",
      tags: [],
      area: "Main St",
      distanceLabel: "—",
      availability: "Hours listed",
      venue: "Main St",
      city: "Chicago",
      dateLabel: "Hours unknown",
      priceLabel: "Price unknown",
      description: "",
      emoji: "",
      priceKnown: false,
      openingHours: "24/7",
      hoursSource: "openstreetmap",
      exploreListingKind: "place",
    });
    expect(detail?.openingHours).toBe("24/7");
    expect(detail?.hoursSource).toBe("openstreetmap");
    expect(drawerHoursSourceLabel("openstreetmap")).toBe("OpenStreetMap");
  });

  it("hub badges omit unverified generic availability", () => {
    expect(isProviderAvailabilityText("Open")).toBe(false);
    expect(hubListingBadge({ availability: "Open" })).toBeUndefined();
    expect(hubListingBadge({ availability: "Limited tickets" })).toBe("Limited tickets");
    expect(hubListingBadge({ availability: "Hours listed" })).toBe("Hours listed");
  });

  it("hub cards hide badge when only generic availability", () => {
    const slot: ExploreSlot = {
      id: "s",
      source: "TM",
      meta: "Tonight",
      title: "Show",
      summary: "Venue",
      price: "$10",
      note: "from provider",
      rating: "",
      reviews: "",
      size: "medium",
      theme: "music",
      amount: 10,
      body: "",
      tags: [],
      area: "Venue",
      distanceLabel: "—",
      availability: "Open",
      venue: "V",
      city: "Chicago",
      dateLabel: "Tonight",
      priceLabel: "$10",
      description: "",
      emoji: "",
      priceKnown: true,
      exploreListingKind: "event",
    };
    expect(hubSlotToCard(slot, 0).badge).toBeUndefined();
    expect(hubSlotToCard({ ...slot, availability: "8 left" }, 0).badge).toBe("8 left");
  });
});
