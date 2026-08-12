import { describe, expect, it } from "vitest";

import {
  buildUserMarkerHtml,
  normalizeGpsMarkerVisualState,
  resolveGpsMarkerMode,
  shouldShowGpsHeadingCone,
} from "../live-gps-marker";

describe("resolveGpsMarkerMode", () => {
  it("prioritizes navigate over live", () => {
    expect(resolveGpsMarkerMode(true, true)).toBe("navigate");
    expect(resolveGpsMarkerMode(false, true)).toBe("navigate");
    expect(resolveGpsMarkerMode(true, false)).toBe("live");
    expect(resolveGpsMarkerMode(false, false)).toBe("browse");
  });
});

describe("shouldShowGpsHeadingCone", () => {
  it("shows cone while navigating when heading exists", () => {
    expect(shouldShowGpsHeadingCone("navigate", 90, 0)).toBe(true);
  });

  it("shows cone while moving in browse mode", () => {
    expect(shouldShowGpsHeadingCone("browse", 180, 1.2)).toBe(true);
    expect(shouldShowGpsHeadingCone("browse", 180, 0.2)).toBe(false);
  });

  it("hides cone without heading", () => {
    expect(shouldShowGpsHeadingCone("navigate", null, 3)).toBe(false);
  });
});

describe("normalizeGpsMarkerVisualState", () => {
  it("supports legacy boolean live/navigate args", () => {
    expect(normalizeGpsMarkerVisualState(true, false).mode).toBe("live");
    expect(normalizeGpsMarkerVisualState(false, true).mode).toBe("navigate");
  });

  it("falls back to browse for invalid mode values", () => {
    expect(
      normalizeGpsMarkerVisualState({
        mode: "invalid" as never,
        heading: null,
        speedMps: null,
        acquiring: false,
        approximate: false,
      }).mode,
    ).toBe("browse");
  });
});

describe("buildUserMarkerHtml", () => {
  it("renders acquiring pulse state", () => {
    const html = buildUserMarkerHtml({
      mode: "browse",
      heading: null,
      speedMps: null,
      acquiring: true,
      approximate: false,
    });
    expect(html).toContain("rovvy-gps-marker--acquiring");
    expect(html).toContain("rovvy-gps-marker__pulse");
  });

  it("renders heading cone in navigation mode", () => {
    const html = buildUserMarkerHtml({
      mode: "navigate",
      heading: 45,
      speedMps: 0,
      acquiring: false,
      approximate: false,
    });
    expect(html).toContain("rovvy-gps-marker--heading");
    expect(html).toContain("--rovvy-gps-heading:45deg");
  });

  it("uses teal core for live mode", () => {
    const html = buildUserMarkerHtml({
      mode: "live",
      heading: null,
      speedMps: null,
      acquiring: false,
      approximate: false,
    });
    expect(html).toContain("--rovvy-gps-core:#0F766E");
  });

  it("accepts legacy boolean args without crashing", () => {
    const html = buildUserMarkerHtml(false, false);
    expect(html).toContain("--rovvy-gps-core:#1A73E8");
  });

  it("never crashes on garbage input", () => {
    expect(buildUserMarkerHtml(undefined)).toContain("rovvy-gps-marker");
    expect(buildUserMarkerHtml(42)).toContain("rovvy-gps-marker");
    expect(buildUserMarkerHtml("bad")).toContain("rovvy-gps-marker");
  });

  it("renders overlay without HTML dot shell (core dot is a map layer)", () => {
    const html = buildUserMarkerHtml({
      mode: "browse",
      heading: null,
      speedMps: null,
      acquiring: false,
      approximate: true,
    });
    expect(html).not.toContain('data-gps-dot="true"');
    expect(html).toContain("rovvy-gps-marker__pulse");
  });
});
