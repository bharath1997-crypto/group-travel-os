import { describe, expect, it } from "vitest";

import { GPS_ACCEPTABLE_ACCURACY_M } from "../live-gps";
import {
  buildGpsRouteOrigin,
  buildMapCenterRouteOrigin,
  buildMapPickRouteOrigin,
  isLowGpsAccuracy,
  isUserChosenRouteOrigin,
  routeOriginsEquivalent,
  validateRouteOriginCoords,
} from "../live-route-origin";

describe("isLowGpsAccuracy", () => {
  it("is false at or below the 150m threshold", () => {
    expect(isLowGpsAccuracy(null)).toBe(false);
    expect(isLowGpsAccuracy(undefined)).toBe(false);
    expect(isLowGpsAccuracy(GPS_ACCEPTABLE_ACCURACY_M)).toBe(false);
    expect(isLowGpsAccuracy(50)).toBe(false);
    expect(isLowGpsAccuracy(150)).toBe(false);
  });

  it("is true above the 150m threshold", () => {
    expect(isLowGpsAccuracy(151)).toBe(true);
    expect(isLowGpsAccuracy(500)).toBe(true);
    expect(isLowGpsAccuracy(2000)).toBe(true);
  });
});

describe("route preview low-GPS warning condition", () => {
  function shouldShowLowGpsWarning(
    origin: ReturnType<typeof buildGpsRouteOrigin> | ReturnType<typeof buildMapPickRouteOrigin>,
  ): boolean {
    return origin.source === "gps" && isLowGpsAccuracy(origin.accuracyMeters ?? null);
  }

  it("shows warning for coarse GPS current-location starts", () => {
    const origin = buildGpsRouteOrigin(41.88, -87.63, 420);
    expect(shouldShowLowGpsWarning(origin)).toBe(true);
  });

  it("hides warning for good GPS accuracy", () => {
    const origin = buildGpsRouteOrigin(41.88, -87.63, 25);
    expect(shouldShowLowGpsWarning(origin)).toBe(false);
  });

  it("hides warning when user picked a manual start", () => {
    const origin = buildMapPickRouteOrigin(41.88, -87.63, "North Pulaski Road");
    expect(shouldShowLowGpsWarning(origin)).toBe(false);
  });
});

describe("buildGpsRouteOrigin", () => {
  it("stores browser accuracy on the GPS origin", () => {
    const origin = buildGpsRouteOrigin(41.881, -87.623, 180);
    expect(origin).toMatchObject({
      id: "gps:current",
      name: "Current location",
      latitude: 41.881,
      longitude: -87.623,
      source: "gps",
      accuracyMeters: 180,
    });
  });
});

describe("isUserChosenRouteOrigin", () => {
  it("treats map pick and search as explicit user choices", () => {
    expect(
      isUserChosenRouteOrigin(buildMapPickRouteOrigin(41.88, -87.63, "Start")),
    ).toBe(true);
    expect(
      isUserChosenRouteOrigin({
        id: "search:foo",
        name: "Foo",
        latitude: 1,
        longitude: 2,
        source: "search",
      }),
    ).toBe(true);
  });

  it("does not treat GPS or map center as user-chosen", () => {
    expect(isUserChosenRouteOrigin(buildGpsRouteOrigin(1, 2, 10))).toBe(false);
    expect(isUserChosenRouteOrigin(buildMapCenterRouteOrigin(1, 2))).toBe(false);
  });
});

describe("validateRouteOriginCoords", () => {
  it("accepts finite coordinates", () => {
    expect(validateRouteOriginCoords(buildGpsRouteOrigin(41.88, -87.63, 10))).toBe(true);
  });

  it("rejects missing or invalid coordinates", () => {
    expect(validateRouteOriginCoords(null)).toBe(false);
    expect(
      validateRouteOriginCoords({
        id: "bad",
        name: "Bad",
        latitude: Number.NaN,
        longitude: -87.63,
        source: "gps",
      }),
    ).toBe(false);
  });
});

describe("routeOriginsEquivalent", () => {
  it("matches same GPS origin within coordinate tolerance", () => {
    const a = buildGpsRouteOrigin(41.881111, -87.623333, 40);
    const b = buildGpsRouteOrigin(41.881112, -87.623334, 80);
    expect(routeOriginsEquivalent(a, b)).toBe(true);
  });

  it("does not match different sources or far-apart points", () => {
    const gps = buildGpsRouteOrigin(41.88, -87.63, 40);
    const pick = buildMapPickRouteOrigin(41.88, -87.63, "Start");
    expect(routeOriginsEquivalent(gps, pick)).toBe(false);
    expect(routeOriginsEquivalent(gps, buildGpsRouteOrigin(42.0, -88.0, 40))).toBe(false);
  });
});
