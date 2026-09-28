import { describe, expect, it } from "vitest";

import {
  buildOpenWaterPlace,
  isGenericWaterLabel,
  isLandCoverGeocode,
  isNamedOceanBasinLabel,
  isWaterMapFeature,
  isWaterReverseGeocode,
  resolveOceanRegionName,
} from "../live-open-water-place";

describe("live-open-water-place", () => {
  it("names South Pacific for eastern tropical Pacific coordinates", () => {
    expect(resolveOceanRegionName(-15.183, -89.901)).toBe("South Pacific Ocean");
  });

  it("treats generic Ocean labels as water", () => {
    expect(isGenericWaterLabel("Ocean")).toBe(true);
    expect(isGenericWaterLabel("South Pacific Ocean")).toBe(false);
  });

  it("treats named ocean basins as map labels, not land clicks", () => {
    expect(isNamedOceanBasinLabel("Arctic Ocean")).toBe(true);
    expect(isWaterMapFeature({ class: "water", name: "Arctic Ocean" })).toBe(false);
  });

  it("detects water map features without ocean basin names", () => {
    expect(isWaterMapFeature({ class: "water", name: "Ocean" })).toBe(true);
    expect(isWaterMapFeature({ natural: "water" })).toBe(true);
    expect(isWaterMapFeature({ class: "amenity", name: "Starbucks" })).toBe(false);
  });

  it("does not classify Greenland land as open water", () => {
    expect(
      isWaterReverseGeocode({
        display_name: "Greenland",
        name: "Arctic Ocean",
        class: "place",
        type: "country",
        address: { country: "Greenland", country_code: "gl" },
      }),
    ).toBe(false);
    expect(
      isLandCoverGeocode({
        display_name: "Greenland ice sheet",
        class: "natural",
        type: "glacier",
        address: { country: "Greenland" },
      }),
    ).toBe(true);
  });

  it("still classifies mid-ocean water with no country", () => {
    expect(
      isWaterReverseGeocode({
        display_name: "Pacific Ocean",
        name: "Pacific Ocean",
        class: "natural",
        type: "water",
      }),
    ).toBe(true);
  });

  it("builds an honest open-ocean preview card", () => {
    const place = buildOpenWaterPlace(-15.183, -89.901, null, "map_click");
    expect(place.name).toBe("South Pacific Ocean");
    expect(place.categoryLabel).toBe("Open ocean");
    expect(place.address).toContain("Open water");
    expect(place.tags?.open_water).toBe("true");
  });
});
