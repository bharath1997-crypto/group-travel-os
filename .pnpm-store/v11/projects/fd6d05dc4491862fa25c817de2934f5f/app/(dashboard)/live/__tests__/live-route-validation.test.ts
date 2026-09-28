import { describe, expect, it } from "vitest";
import {
  CROSS_OCEAN_DIRECT_M,
  isLandConnectedDriveRoute,
  soloLiveBlockReason,
} from "../live-route-validation";

describe("isLandConnectedDriveRoute", () => {
  it("rejects a two-point straight line over long distance", () => {
    const origin = { lat: 41.88, lng: -87.63 };
    const dest = { lat: 60.17, lng: 24.94 };
    const geometry: [number, number][] = [
      [origin.lng, origin.lat],
      [dest.lng, dest.lat],
    ];
    expect(
      isLandConnectedDriveRoute(
        geometry,
        origin.lat,
        origin.lng,
        dest.lat,
        dest.lng,
      ),
    ).toBe(false);
  });

  it("rejects cross-ocean direct distance even with extra points", () => {
    const origin = { lat: 40.7, lng: -74.0 };
    const dest = { lat: 48.85, lng: 2.35 };
    expect(
      isLandConnectedDriveRoute(
        [
          [origin.lng, origin.lat],
          [-30, 45],
          [dest.lng, dest.lat],
        ],
        origin.lat,
        origin.lng,
        dest.lat,
        dest.lng,
      ),
    ).toBe(false);
    expect(
      (origin.lat - dest.lat) ** 2 + (origin.lng - dest.lng) ** 2,
    ).toBeGreaterThan(0);
    expect(CROSS_OCEAN_DIRECT_M).toBeGreaterThan(1_000_000);
  });
});

describe("soloLiveBlockReason", () => {
  it("blocks far destinations for Solo Live", () => {
    const reason = soloLiveBlockReason({
      travelMode: "Drive",
      distanceM: 8_000_000,
      route: {
        from: { lat: 41.88, lng: -87.63 },
        to: { lat: 60.17, lng: 24.94 },
        geometry: [
          [-87.63, 41.88],
          [24.94, 60.17],
        ],
        distanceMeters: 8_000_000,
        durationSeconds: 3600,
        active: false,
      },
      locationContext: {
        liveSafe: false,
        template: {
          summary: "Far",
          recommendation: "Plan as a future trip.",
        },
      } as never,
    });
    expect(reason).toContain("future trip");
  });
});
