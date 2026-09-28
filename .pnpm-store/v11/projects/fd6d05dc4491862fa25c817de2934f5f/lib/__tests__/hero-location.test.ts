import { describe, expect, it } from "vitest";

import { keepIpHeroAfterGeolocationDenied, mapDistanceToPlace, unknownHero } from "@/lib/hero-location";

const base = {
  direction: "west",
  insideCityBounds: false,
  neighbourhood: "Uptown",
  locality: "Oak Park",
  hubCity: "Chicago",
  precision: "gps" as const,
};

describe("distance-aware hero labels", () => {
  it("uses neighbourhood precision inside city bounds", () => {
    expect(mapDistanceToPlace({ ...base, distanceMiles: 0, insideCityBounds: true })).toEqual({
      placeLabel: "Uptown, Chicago",
      precisionNote: "exact",
      suggestedRadiusMiles: 15,
    });
  });

  it("maps the under-10-mile boundary to the nearby locality", () => {
    expect(mapDistanceToPlace({ ...base, distanceMiles: 9.99 })).toMatchObject({
      placeLabel: "Oak Park",
      precisionNote: "10 mi west of Chicago",
    });
  });

  it("maps 10 through 40 miles to the metro area", () => {
    expect(mapDistanceToPlace({ ...base, distanceMiles: 10 }).placeLabel).toBe("Chicago area");
    expect(mapDistanceToPlace({ ...base, distanceMiles: 40 }).placeLabel).toBe("Chicago area");
  });

  it("maps over 40 through 100 miles to the locality and nearest hub", () => {
    expect(mapDistanceToPlace({ ...base, distanceMiles: 40.01 })).toMatchObject({
      placeLabel: "Oak Park",
      precisionNote: "40 mi west · nearest hub Chicago",
      suggestedRadiusMiles: 60,
    });
    expect(mapDistanceToPlace({ ...base, distanceMiles: 100 }).placeLabel).toBe("Oak Park");
  });

  it("maps over 100 miles to no nearby city", () => {
    expect(mapDistanceToPlace({ ...base, distanceMiles: 300 })).toEqual({
      placeLabel: "No city nearby",
      precisionNote: "showing what's within 60 mi",
      suggestedRadiusMiles: 60,
    });
  });
});

describe("GPS denial", () => {
  it("keeps the IP result and treats denial as a valid approximate choice", () => {
    const current = { ...unknownHero(), city: "Chicago", placeLabel: "Chicago", precision: "ip" as const, precisionNote: "approximate" };
    expect(keepIpHeroAfterGeolocationDenied(current)).toEqual(current);
  });
});
