import { describe, expect, it } from "vitest";

import {
  buildRegionLabel,
  isGenericPlaceName,
  resolvePlaceDisplayName,
} from "@/lib/wayra/place-region";

describe("place-region", () => {
  it("detects generic dropped pin names", () => {
    expect(isGenericPlaceName("Dropped pin")).toBe(true);
    expect(isGenericPlaceName("Selected location")).toBe(true);
    expect(isGenericPlaceName("Dehcho Region")).toBe(false);
  });

  it("builds a region label from city/state/country", () => {
    expect(
      buildRegionLabel({ city: "Guangyuan", state: "Sichuan", country: "China" }),
    ).toBe("Guangyuan, Sichuan, China");
  });

  it("resolves display name from region when pin is generic", () => {
    expect(
      resolvePlaceDisplayName("Dropped pin", {
        city: "Guangyuan",
        state: "Sichuan",
        country: "China",
      }),
    ).toBe("Guangyuan, Sichuan, China");
  });
});
