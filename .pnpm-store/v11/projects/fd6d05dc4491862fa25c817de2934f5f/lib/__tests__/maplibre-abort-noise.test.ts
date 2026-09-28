import { describe, expect, it } from "vitest";

import { isMapLibreTileAbortNoise } from "@/lib/maplibre-abort-noise";

function errorWithStack(message: string, stack: string): Error {
  const err = new Error(message);
  err.stack = stack;
  return err;
}

const MAPLIBRE_STACK = [
  "TypeError: Cannot read properties of undefined (reading 'signal')",
  "    at n (webpack-internal:///(app-pages-browser)/./node_modules/maplibre-gl/dist/maplibre-gl.js:21922:40)",
  "    at Generator.next (<anonymous>)",
].join("\n");

describe("isMapLibreTileAbortNoise", () => {
  it("matches the MapLibre tile abort race rejection", () => {
    expect(
      isMapLibreTileAbortNoise(
        errorWithStack(
          "Cannot read properties of undefined (reading 'signal')",
          MAPLIBRE_STACK,
        ),
      ),
    ).toBe(true);
  });

  it("ignores the same message coming from app code", () => {
    expect(
      isMapLibreTileAbortNoise(
        errorWithStack(
          "Cannot read properties of undefined (reading 'signal')",
          "TypeError\n    at apiFetch (webpack-internal:///./lib/api.ts:150:20)",
        ),
      ),
    ).toBe(false);
  });

  it("ignores other MapLibre errors", () => {
    expect(
      isMapLibreTileAbortNoise(
        errorWithStack(
          "Style is not done loading",
          "Error\n    at Map (node_modules/maplibre-gl/dist/maplibre-gl.js:1:1)",
        ),
      ),
    ).toBe(false);
  });

  it("ignores non-error rejection values", () => {
    expect(isMapLibreTileAbortNoise(undefined)).toBe(false);
    expect(isMapLibreTileAbortNoise("signal")).toBe(false);
    expect(isMapLibreTileAbortNoise(null)).toBe(false);
  });

  it("matches the older browser phrasing too", () => {
    expect(
      isMapLibreTileAbortNoise(
        errorWithStack(
          "Cannot read property 'signal' of undefined",
          MAPLIBRE_STACK,
        ),
      ),
    ).toBe(true);
  });
});
