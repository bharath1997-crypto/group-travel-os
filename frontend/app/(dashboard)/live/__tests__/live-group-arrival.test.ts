import { describe, expect, it } from "vitest";
import { buildDefaultConvergeMembers } from "../live-group-converge-mock";
import {
  arrivalRadiusForTravelMode,
  computeGroupArrival,
  isWithinArrivalRadius,
  parseArrivalsSnapshot,
} from "../live-group-arrival";

describe("live-group-arrival", () => {
  it("uses tighter radius for walk mode", () => {
    expect(arrivalRadiusForTravelMode("Walk")).toBeLessThan(arrivalRadiusForTravelMode("Drive"));
  });

  it("detects coordinates within arrival radius", () => {
    expect(isWithinArrivalRadius(41.922, -87.726, 41.9221, -87.7261, 250)).toBe(true);
    expect(isWithinArrivalRadius(41.922, -87.726, 42.0, -88.0, 150)).toBe(false);
  });

  it("parses RTDB arrival snapshots", () => {
    const records = parseArrivalsSnapshot({
      "user-1": { lat: 41.922, lng: -87.726, arrivedAt: 1_700_000_000_000 },
    });

    expect(records).toHaveLength(1);
    expect(records[0]?.userId).toBe("user-1");
  });

  it("suggests night finished when a majority has arrived", () => {
    const destination = { lat: 41.922, lng: -87.726 };
    const result = computeGroupArrival({
      destination,
      memberCount: 4,
      selfUserId: "me",
      selfLat: 41.922,
      selfLng: -87.726,
      memberLocations: [
        {
          userId: "friend-1",
          lat: 41.9221,
          lng: -87.7261,
          speedMps: 0,
          heading: null,
          updatedAt: Date.now(),
          status: "active",
        },
      ],
      rtArrivals: [{ userId: "friend-2", lat: 41.922, lng: -87.726, arrivedAt: Date.now() }],
      convergeMembers: buildDefaultConvergeMembers(),
      travelMode: "Drive",
    });

    expect(result.arrivedCount).toBeGreaterThanOrEqual(3);
    expect(result.suggestNightFinished).toBe(true);
  });

  it("falls back to converge ETAs when no GPS arrivals exist", () => {
    const result = computeGroupArrival({
      destination: { lat: 41.922, lng: -87.726 },
      memberCount: 6,
      selfUserId: null,
      selfLat: null,
      selfLng: null,
      memberLocations: [],
      rtArrivals: [],
      convergeMembers: buildDefaultConvergeMembers(),
      travelMode: "Drive",
    });

    expect(result.arrivedCount).toBeGreaterThanOrEqual(1);
  });
});
