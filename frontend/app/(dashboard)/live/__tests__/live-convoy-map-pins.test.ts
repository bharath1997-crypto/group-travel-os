import { describe, expect, it } from "vitest";
import { buildDefaultSeatShare } from "../live-seat-share-mock";
import {
  buildMockConvoyMapPins,
  convoyOffersToMapPins,
} from "../live-convoy-map-pins";

describe("live-convoy-map-pins", () => {
  it("maps convoy offers with coordinates into map pins", () => {
    const pins = convoyOffersToMapPins(
      [
        {
          userId: "driver-1",
          label: "Ana's SUV",
          driverName: "Ana",
          seatsTotal: 4,
          seatsOpen: 2,
          costPerHead: 16,
          currency: "USD",
          routeLabel: "Direct · 12 mi",
          destinationName: "Union Station",
          pickups: [],
          lat: 41.922,
          lng: -87.726,
          updatedAt: Date.now(),
        },
      ],
      "driver-2",
    );

    expect(pins).toHaveLength(1);
    expect(pins[0]?.label).toBe("Ana's SUV");
    expect(pins[0]?.seatsOpen).toBe(2);
  });

  it("skips convoy offers without GPS coordinates", () => {
    const pins = convoyOffersToMapPins(
      [
        {
          userId: "driver-1",
          label: "Ana's SUV",
          driverName: "Ana",
          seatsTotal: 4,
          seatsOpen: 2,
          costPerHead: 16,
          currency: "USD",
          routeLabel: "Direct · 12 mi",
          destinationName: "Union Station",
          pickups: [],
          lat: null,
          lng: null,
          updatedAt: Date.now(),
        },
      ],
      null,
    );

    expect(pins).toHaveLength(0);
  });

  it("builds mock convoy pins from seat share vehicles", () => {
    const share = buildDefaultSeatShare("Union Station");
    const pins = buildMockConvoyMapPins({
      vehicles: share.vehicles,
      anchorLat: 41.922,
      anchorLng: -87.726,
    });

    expect(pins).toHaveLength(share.vehicles.length);
    expect(pins[0]?.isSelf).toBe(true);
    expect(pins[0]?.lat).not.toBe(41.922);
  });
});
