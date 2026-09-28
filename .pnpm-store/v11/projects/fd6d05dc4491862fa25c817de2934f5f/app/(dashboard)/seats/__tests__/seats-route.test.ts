import { describe, expect, it } from "vitest";
import {
  buildSeatShareRouteOptions,
  isRouteEligible,
  isSeatShareSearchReady,
  metersToMiles,
  SEATSHARE_MAX_DISTANCE_MILES,
} from "../seats-route";
import { PROMPT_FROM, PROMPT_TO } from "../seats-location";

describe("seats-route", () => {
  it("marks routes over 200 miles ineligible", () => {
    const over = metersToMiles(200 * 1609.344 + 100);
    expect(isRouteEligible(over)).toBe(false);
    expect(isRouteEligible(SEATSHARE_MAX_DISTANCE_MILES)).toBe(true);
  });

  it("builds primary plus up to two alternates", () => {
    const options = buildSeatShareRouteOptions({
      route: {
        from: { lat: 1, lng: 2 },
        to: { lat: 3, lng: 4 },
        geometry: [
          [72.8, 19.1],
          [73.7, 18.5],
        ],
        distanceMeters: 50_000,
        durationSeconds: 3600,
        maneuvers: [],
        active: false,
      },
      alternatives: [
        {
          id: "alt-1",
          label: "Scenic",
          tollLabel: null,
          hasTolls: false,
          distanceMeters: 52_000,
          durationSeconds: 3800,
          geometry: [
            [72.81, 19.11],
            [73.71, 18.51],
          ],
          provider: "osrm",
        },
        {
          id: "alt-2",
          label: "Toll-free",
          tollLabel: null,
          hasTolls: false,
          distanceMeters: 54_000,
          durationSeconds: 4000,
          geometry: [
            [72.82, 19.12],
            [73.72, 18.52],
          ],
          provider: "osrm",
        },
        {
          id: "alt-3",
          label: "Extra",
          tollLabel: null,
          hasTolls: false,
          distanceMeters: 56_000,
          durationSeconds: 4100,
          geometry: [
            [72.83, 19.13],
            [73.73, 18.53],
          ],
          provider: "osrm",
        },
      ],
    });
    expect(options).toHaveLength(3);
    expect(options[0].id).toBe("primary");
    expect(options.every((o) => o.isEligible)).toBe(true);
  });

  it("requires confirmed endpoints and eligible route to search", () => {
    const from = { ...PROMPT_FROM, isConfirmed: true };
    const to = { ...PROMPT_TO, isConfirmed: true };
    const eligible = {
      id: "primary",
      label: "Primary",
      distanceMiles: 120,
      durationMinutes: 90,
      geometry: [
        [72.8, 19.1],
        [73.7, 18.5],
      ] as [number, number][],
      isEligible: true,
    };
    expect(isSeatShareSearchReady(from, to, eligible)).toBe(true);
    expect(isSeatShareSearchReady(from, to, { ...eligible, isEligible: false })).toBe(false);
    expect(isSeatShareSearchReady(from, { ...to, isConfirmed: false }, eligible)).toBe(false);
  });
});
