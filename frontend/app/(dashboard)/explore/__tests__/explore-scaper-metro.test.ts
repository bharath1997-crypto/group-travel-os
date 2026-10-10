import { describe, expect, it } from "vitest";

import { resolveScaperMetroCity } from "../explore-scaper-metro";

describe("resolveScaperMetroCity", () => {
  it("maps Naperville coords to Chicago for Scaper events", () => {
    expect(
      resolveScaperMetroCity({
        lat: 41.7508,
        lon: -88.1535,
        fallbackCity: "Naperville",
      }),
    ).toBe("Chicago");
  });

  it("falls back when no metro within 80 km", () => {
    expect(
      resolveScaperMetroCity({
        lat: 0,
        lon: 0,
        fallbackCity: "Nowhere",
      }),
    ).toBe("Nowhere");
  });
});
