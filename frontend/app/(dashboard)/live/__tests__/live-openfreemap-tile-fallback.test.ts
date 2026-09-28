import { describe, expect, it } from "vitest";
import {
  extractStyleUrlFromMapError,
  resolveOpenFreeMapFallbackFromMapError,
  resolveOpenFreeMapPublicFallbackStyleUrl,
} from "../live-openfreemap-tile-fallback";

describe("live-openfreemap-tile-fallback", () => {
  it("extracts style URL from MapLibre AJAX errors", () => {
    expect(
      extractStyleUrlFromMapError(
        "AJAXError: Failed to fetch (0): https://tiles.rovvy.app/styles/liberty",
      ),
    ).toBe("https://tiles.rovvy.app/styles/liberty");
  });

  it("maps Rovvy worker style URLs to the public OpenFreeMap CDN", () => {
    expect(
      resolveOpenFreeMapPublicFallbackStyleUrl("https://tiles.rovvy.app/styles/liberty"),
    ).toBe("https://tiles.openfreemap.org/styles/liberty");
    expect(
      resolveOpenFreeMapPublicFallbackStyleUrl("https://tiles.openfreemap.org/styles/liberty"),
    ).toBeNull();
  });

  it("resolves fallback from full error text", () => {
    expect(
      resolveOpenFreeMapFallbackFromMapError(
        "AJAXError: Failed to fetch (0): https://tiles.rovvy.app/styles/bright",
      ),
    ).toBe("https://tiles.openfreemap.org/styles/bright");
  });
});
