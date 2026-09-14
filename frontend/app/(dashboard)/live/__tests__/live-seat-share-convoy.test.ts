import { describe, expect, it } from "vitest";
import {
  convoyOffersToSeatShare,
  formatRouteLabel,
  parseConvoySnapshot,
} from "../live-seat-share-convoy";

describe("live-seat-share-convoy", () => {
  it("parses convoy RTDB offers", () => {
    const offers = parseConvoySnapshot({
      "user-1": {
        driverName: "Ana",
        label: "Ana's SUV",
        seatsTotal: 4,
        seatsOpen: 2,
        costPerHead: 16,
        currency: "USD",
        routeLabel: "Direct · 12 mi",
        destinationName: "Union Station",
        updatedAt: Date.now(),
      },
    });

    expect(offers).toHaveLength(1);
    expect(offers[0]?.driverName).toBe("Ana");
  });

  it("maps convoy offers into seat share panel state", () => {
    const share = convoyOffersToSeatShare(
      parseConvoySnapshot({
        "user-1": {
          driverName: "Ana",
          label: "Ana's SUV",
          seatsTotal: 4,
          seatsOpen: 2,
          costPerHead: 16,
          currency: "USD",
          routeLabel: "Direct · 12 mi",
          destinationName: "Union Station",
          updatedAt: Date.now(),
        },
      }),
      "Union Station",
      "user-2",
    );

    expect(share.vehicles).toHaveLength(1);
    expect(share.destinationName).toBe("Union Station");
  });

  it("formats route labels from live route metrics", () => {
    expect(
      formatRouteLabel({
        distanceMeters: 18_000,
        durationSeconds: 1_800,
      }),
    ).toContain("mi");
  });
});
