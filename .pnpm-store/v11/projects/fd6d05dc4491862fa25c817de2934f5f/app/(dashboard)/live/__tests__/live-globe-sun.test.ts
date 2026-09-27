import { describe, expect, it } from "vitest";

import {
  getSubsolarPoint,
  normalizeLng,
  solarDeclinationRadians,
  subsolarToLightPosition,
} from "../live-globe-sun";

describe("live-globe-sun", () => {
  it("normalizes longitude to (-180, 180]", () => {
    expect(normalizeLng(190)).toBe(-170);
    expect(normalizeLng(-190)).toBe(170);
  });

  it("places subsolar point at prime meridian at UTC noon near equinox", () => {
    const point = getSubsolarPoint(new Date(Date.UTC(2026, 2, 20, 12, 0, 0)));
    expect(Math.abs(point.lat)).toBeLessThan(1.5);
    expect(Math.abs(point.lng)).toBeLessThan(0.01);
  });

  it("moves subsolar longitude west as UTC hours advance", () => {
    const noon = getSubsolarPoint(new Date(Date.UTC(2026, 6, 1, 12, 0, 0)));
    const evening = getSubsolarPoint(new Date(Date.UTC(2026, 6, 1, 18, 0, 0)));
    expect(evening.lng).toBeLessThan(noon.lng);
    expect(Math.abs(evening.lng - noon.lng)).toBeCloseTo(90, 0);
  });

  it("returns valid MapLibre light spherical coordinates", () => {
    const [r, azimuth, polar] = subsolarToLightPosition(0, 0);
    expect(r).toBe(1.5);
    expect(azimuth).toBeGreaterThanOrEqual(0);
    expect(azimuth).toBeLessThanOrEqual(360);
    expect(polar).toBeGreaterThanOrEqual(0);
    expect(polar).toBeLessThanOrEqual(180);
  });

  it("tilts declination with season", () => {
    const june = solarDeclinationRadians(new Date(Date.UTC(2026, 5, 21, 12, 0, 0)));
    const december = solarDeclinationRadians(new Date(Date.UTC(2026, 11, 21, 12, 0, 0)));
    expect(june).toBeGreaterThan(0.2);
    expect(december).toBeLessThan(-0.2);
  });
});
