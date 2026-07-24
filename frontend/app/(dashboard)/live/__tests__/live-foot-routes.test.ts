import { describe, expect, it } from "vitest";

import {
  FOOT_HIKING_TRACK_FILTER,
  FOOT_TRAIL_CLASS_FILTER,
  getFootHikingLayerPaint,
  getFootRouteLayerPaint,
} from "@/lib/live-foot-routes";

describe("live-foot-routes", () => {
  it("filters walkable path classes", () => {
    expect(FOOT_TRAIL_CLASS_FILTER).toEqual([
      "in",
      ["get", "class"],
      ["literal", ["path", "footway", "steps", "pedestrian"]],
    ]);
  });

  it("filters hiking tracks separately from roads", () => {
    expect(FOOT_HIKING_TRACK_FILTER[0]).toBe("all");
    expect(FOOT_HIKING_TRACK_FILTER[1]).toEqual(["==", ["get", "class"], "track"]);
  });

  it("uses vivid colors on satellite for trail visibility", () => {
    const sat = getFootRouteLayerPaint("satellite");
    const street = getFootRouteLayerPaint("street");
    expect(sat.core?.["line-color"]).toBe("#4ADE80");
    expect(street.core?.["line-color"]).toBe("#15803D");
    expect(sat.minzoom).toBe(7);
  });

  it("styles hiking tracks with distinct gold tone", () => {
    const hiking = getFootHikingLayerPaint("terrain");
    expect(hiking.core?.["line-color"]).toBe("#FDE047");
  });
});
