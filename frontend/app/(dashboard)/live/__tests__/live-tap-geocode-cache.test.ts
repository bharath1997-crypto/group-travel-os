import { describe, expect, it } from "vitest";
import {
  getTapGeocodeCache,
  isUsableTapGeocodeCache,
  setTapGeocodeCache,
  tapGeocodeCacheKey,
} from "../live-tap-geocode-cache";

describe("live-tap-geocode-cache", () => {
  it("rounds coordinates for stable cache keys", () => {
    expect(tapGeocodeCacheKey(41.922731, -87.701551)).toBe("41.92273,-87.70155");
  });

  it("stores and returns tap geocode entries", () => {
    setTapGeocodeCache(41.92273, -87.70155, {
      name: "West Lyndale Street",
      categoryLabel: "Address",
      address: "Chicago, IL",
    });
    const hit = getTapGeocodeCache(41.922731, -87.701551);
    expect(hit?.name).toBe("West Lyndale Street");
  });

  it("rejects generic dropped pin cache entries", () => {
    expect(
      isUsableTapGeocodeCache({
        name: "Dropped pin",
        categoryLabel: "Dropped pin",
        address: "Coordinates: 58.5583, 47.3897",
        cachedAt: Date.now(),
      }),
    ).toBe(false);
    expect(
      isUsableTapGeocodeCache({
        name: "Kirov Oblast, Russia",
        categoryLabel: "Place",
        address: "Kirov Oblast, Russia",
        cachedAt: Date.now(),
      }),
    ).toBe(true);
  });
});
