import { describe, expect, it } from "vitest";
import {
  buildOpenWaterPlace,
  isUnroutableOpenWaterPlace,
} from "../live-open-water-place";

describe("isUnroutableOpenWaterPlace", () => {
  it("flags open ocean places", () => {
    const place = buildOpenWaterPlace(-24.53, -11.95, null, "map_click");
    expect(isUnroutableOpenWaterPlace(place)).toBe(true);
  });

  it("allows normal land places", () => {
    expect(
      isUnroutableOpenWaterPlace({
        name: "Fulton Kitchen",
        categoryLabel: "Restaurant",
        terrainHint: null,
        tags: {},
      }),
    ).toBe(false);
  });
});
