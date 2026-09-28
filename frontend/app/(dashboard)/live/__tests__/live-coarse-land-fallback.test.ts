import { describe, expect, it } from "vitest";

import {
  buildCoarseLandFallbackPlace,
  resolveCoarseLandRegion,
} from "../live-coarse-land-fallback";

describe("live-coarse-land-fallback", () => {
  it("resolves Greenland for inland ice sheet coordinates", () => {
    const region = resolveCoarseLandRegion(65.43711, -44.69036);
    expect(region).toEqual({
      name: "Greenland",
      country: "Greenland",
      localityType: "Territory",
    });
  });

  it("builds a preview place when reverse geocode is unavailable", () => {
    const place = buildCoarseLandFallbackPlace(65.43711, -44.69036, null);
    expect(place?.name).toBe("Greenland");
    expect(place?.country).toBe("Greenland");
    expect(place?.categoryLabel).toBe("Territory");
    expect(place?.coordinatesLabel).toContain("65.43711");
  });

  it("returns null for mid-ocean coordinates", () => {
    expect(resolveCoarseLandRegion(0, -30)).toBeNull();
    expect(buildCoarseLandFallbackPlace(0, -30, null)).toBeNull();
  });
});
