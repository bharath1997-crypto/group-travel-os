import { describe, expect, it } from "vitest";
import { isWithinSeatShareRadius, straightLineMiles } from "../seats-map-geo";

describe("seats-map-geo", () => {
  it("checks 200 mile straight-line gate", () => {
    const chicago = { lat: 41.8781, lng: -87.6298 };
    const nearby = { lat: 41.95, lng: -87.7 };
    const far = { lat: 34.05, lng: -118.24 };
    expect(straightLineMiles(chicago, nearby)).toBeLessThan(50);
    expect(isWithinSeatShareRadius(chicago, nearby)).toBe(true);
    expect(isWithinSeatShareRadius(chicago, far)).toBe(false);
  });
});
