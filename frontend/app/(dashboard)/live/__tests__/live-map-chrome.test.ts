import { describe, expect, it } from "vitest";
import { isImmersiveDarkMapLayer, isLiveMapDarkChrome } from "../live-map-chrome";

describe("live-map-chrome", () => {
  it("uses dark chrome only on the Dark basemap", () => {
    expect(isLiveMapDarkChrome("dark")).toBe(true);
    expect(isLiveMapDarkChrome("satellite")).toBe(false);
    expect(isLiveMapDarkChrome("hybrid")).toBe(false);
    expect(isLiveMapDarkChrome("street")).toBe(false);
  });

  it("keeps immersive alias in sync", () => {
    expect(isImmersiveDarkMapLayer("satellite")).toBe(false);
    expect(isImmersiveDarkMapLayer("dark")).toBe(true);
  });
});
