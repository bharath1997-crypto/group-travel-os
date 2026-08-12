import { describe, expect, it } from "vitest";

import { isLikelyBacksideMapTap, resolveMapTapLngLat } from "../live-map-tap-coords";

describe("isLikelyBacksideMapTap", () => {
  const chicago = { lat: 41.8781, lng: -87.6298 };

  it("allows nearby taps when zoomed in", () => {
    expect(isLikelyBacksideMapTap({ lat: 41.88, lng: -87.63 }, chicago, 14)).toBe(false);
  });

  it("flags antipodal taps when zoomed in locally", () => {
    expect(isLikelyBacksideMapTap({ lat: -41.88, lng: 92.37 }, chicago, 14)).toBe(true);
  });

  it("allows distant taps at world zoom", () => {
    expect(isLikelyBacksideMapTap({ lat: -41.88, lng: 92.37 }, chicago, 2)).toBe(false);
  });
});

describe("resolveMapTapLngLat", () => {
  it("normalizes longitude near map center", () => {
    const map = {
      getCenter: () => ({ lat: 41.88, lng: -87.63 }),
      getZoom: () => 14,
      unproject: () => ({ lat: 41.881, lng: 272.37 }),
    } as never;

    const result = resolveMapTapLngLat(map, { x: 400, y: 300 });
    expect(result?.lng).toBeCloseTo(-87.63, 0);
  });

  it("rejects backside taps when zoomed in", () => {
    const map = {
      getCenter: () => ({ lat: 41.88, lng: -87.63 }),
      getZoom: () => 15,
      unproject: () => ({ lat: -41.88, lng: 92.37 }),
    } as never;

    expect(resolveMapTapLngLat(map, { x: 200, y: 200 })).toBeNull();
  });
});
