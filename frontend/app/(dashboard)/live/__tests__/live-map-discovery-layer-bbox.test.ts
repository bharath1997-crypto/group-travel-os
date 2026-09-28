import { describe, expect, it } from "vitest";
import { bboxContains } from "../live-map-discovery-layer-bbox";

describe("bboxContains", () => {
  it("returns true when inner bbox is inside padded outer", () => {
    const outer = { south: 41.8, west: -87.7, north: 41.9, east: -87.6 };
    const inner = { south: 41.82, west: -87.68, north: 41.88, east: -87.62 };
    expect(bboxContains(outer, inner)).toBe(true);
  });

  it("returns false when inner extends beyond padded outer", () => {
    const outer = { south: 41.85, west: -87.65, north: 41.86, east: -87.64 };
    const inner = { south: 41.8, west: -87.7, north: 41.9, east: -87.6 };
    expect(bboxContains(outer, inner)).toBe(false);
  });
});
