import { describe, expect, it } from "vitest";

import {
  GPS_ACCEPTABLE_ACCURACY_M,
  GPS_ACCURACY_CIRCLE_MAX_DISPLAY_M,
  GPS_ACCURACY_CIRCLE_MIN_M,
  displayAccuracyRadiusMeters,
  gpsStatusFromGeolocationError,
  gpsStatusLabel,
  gpsStatusNeedsHelper,
  isFreshGpsStatus,
  shouldShowGpsDot,
} from "../live-gps";

describe("live-gps thresholds", () => {
  it("uses 150m as acceptable navigation accuracy", () => {
    expect(GPS_ACCEPTABLE_ACCURACY_M).toBe(150);
  });

  it("shows uncertainty circle between min and max display caps", () => {
    expect(GPS_ACCURACY_CIRCLE_MIN_M).toBe(20);
    expect(GPS_ACCURACY_CIRCLE_MAX_DISPLAY_M).toBe(120);
  });
});

describe("displayAccuracyRadiusMeters", () => {
  it("returns null when accuracy is missing or very good", () => {
    expect(displayAccuracyRadiusMeters(null)).toBeNull();
    expect(displayAccuracyRadiusMeters(undefined)).toBeNull();
    expect(displayAccuracyRadiusMeters(20)).toBeNull();
    expect(displayAccuracyRadiusMeters(10)).toBeNull();
  });

  it("returns raw accuracy above the minimum threshold", () => {
    expect(displayAccuracyRadiusMeters(21)).toBe(21);
    expect(displayAccuracyRadiusMeters(80)).toBe(80);
  });

  it("caps displayed radius for coarse desktop Wi-Fi fixes", () => {
    expect(displayAccuracyRadiusMeters(500)).toBe(120);
    expect(displayAccuracyRadiusMeters(2000)).toBe(120);
  });
});

describe("shouldShowGpsDot", () => {
  it("always shows the GPS dot regardless of accuracy", () => {
    expect(shouldShowGpsDot(null)).toBe(true);
    expect(shouldShowGpsDot(500)).toBe(true);
  });
});

describe("isFreshGpsStatus", () => {
  it("treats active and approximate fixes as fresh", () => {
    expect(isFreshGpsStatus("active")).toBe(true);
    expect(isFreshGpsStatus("approximate")).toBe(true);
  });

  it("treats failed or stale states as not fresh", () => {
    expect(isFreshGpsStatus("denied")).toBe(false);
    expect(isFreshGpsStatus("timeout")).toBe(false);
    expect(isFreshGpsStatus("stale")).toBe(false);
    expect(isFreshGpsStatus("idle")).toBe(false);
  });
});

describe("gpsStatusFromGeolocationError", () => {
  it("maps browser geolocation error codes", () => {
    expect(gpsStatusFromGeolocationError(1)).toBe("denied");
    expect(gpsStatusFromGeolocationError(3)).toBe("timeout");
    expect(gpsStatusFromGeolocationError(2)).toBe("error");
    expect(gpsStatusFromGeolocationError(99)).toBe("error");
  });
});

describe("gpsStatusNeedsHelper", () => {
  it("requires manual fallback for denied, timeout, and error", () => {
    expect(gpsStatusNeedsHelper("denied")).toBe(true);
    expect(gpsStatusNeedsHelper("timeout")).toBe(true);
    expect(gpsStatusNeedsHelper("error")).toBe(true);
  });

  it("does not require helper for usable GPS states", () => {
    expect(gpsStatusNeedsHelper("active")).toBe(false);
    expect(gpsStatusNeedsHelper("approximate")).toBe(false);
    expect(gpsStatusNeedsHelper("requesting")).toBe(false);
  });
});

describe("gpsStatusLabel", () => {
  it("returns user-facing labels for known states", () => {
    expect(gpsStatusLabel("active")).toBe("GPS active");
    expect(gpsStatusLabel("approximate")).toBe("Approx location");
    expect(gpsStatusLabel("timeout")).toBe("Location unavailable");
  });

  it("returns null for idle", () => {
    expect(gpsStatusLabel("idle")).toBeNull();
  });
});
