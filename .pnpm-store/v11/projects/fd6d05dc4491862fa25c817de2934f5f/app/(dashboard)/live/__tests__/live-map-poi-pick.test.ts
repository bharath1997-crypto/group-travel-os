import { describe, expect, it } from "vitest";

import {
  isRoadOrLineInfrastructure,
  isSelectablePlaceFeature,
  pickTopPlaceFeature,
  scorePlacePickFeature,
} from "../live-map-poi-pick";

function feature(
  props: Record<string, unknown>,
  sourceLayer = "poi",
  layerType: "symbol" | "line" = "symbol",
) {
  return {
    type: "Feature",
    properties: props,
    sourceLayer,
    layer: { type: layerType, id: `${sourceLayer}-layer` },
    geometry: { type: "Point", coordinates: [0, 0] },
  } as any;
}

describe("live-map-poi-pick", () => {
  it("rejects named highway features", () => {
    const road = feature(
      { name: "West Fullerton Avenue", highway: "secondary" },
      "transportation",
      "line",
    );
    expect(isRoadOrLineInfrastructure(road.properties)).toBe(true);
    expect(isSelectablePlaceFeature(road)).toBe(false);
    expect(scorePlacePickFeature(road)).toBe(0);
  });

  it("accepts named POI symbols", () => {
    const poi = feature({ name: "Lumen", amenity: "bar" }, "poi", "symbol");
    expect(isSelectablePlaceFeature(poi)).toBe(true);
    expect(scorePlacePickFeature(poi)).toBeGreaterThan(80);
  });

  it("accepts park polygons", () => {
    const park = feature({ name: "Grant Park", class: "park" }, "landuse", "line");
    expect(isSelectablePlaceFeature(park)).toBe(true);
  });

  it("returns null when only roads are under the tap", () => {
    const road = feature(
      { name: "West Fullerton Avenue", highway: "secondary" },
      "transportation",
      "line",
    );
    expect(pickTopPlaceFeature([road])).toBeNull();
  });
});
