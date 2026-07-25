import { describe, expect, it } from "vitest";

import {
  buildLiveMapAttributionLine,
  estimateLocalTimeAtLng,
  formatMapGroundScaleFeet,
  getLiveMapDataCredits,
  resolveAttributionMode,
} from "../live-map-attribution";

describe("live-map-attribution", () => {
  it("includes OSM credit on every basemap", () => {
    expect(getLiveMapDataCredits("street")).toContain("OpenStreetMap");
    expect(getLiveMapDataCredits("clean")).toContain("OpenStreetMap");
    expect(getLiveMapDataCredits("hybrid")).toContain("OpenStreetMap");
  });

  it("adds Esri credit on satellite hybrid layers", () => {
    expect(getLiveMapDataCredits("satellite")).toContain("Esri");
    expect(getLiveMapDataCredits("hybrid")).toContain("Esri");
  });

  it("marks panning vs pinned modes", () => {
    expect(resolveAttributionMode(null, true)).toBe("panning");
    expect(resolveAttributionMode({ lat: 0, lng: 0, pinned: true }, false)).toBe("pinned");
    expect(resolveAttributionMode({ lat: 0, lng: 0 }, false)).toBe("idle");
  });

  it("shows coordinates and feet scale at street zoom", () => {
    const line = buildLiveMapAttributionLine({
      layer: "hybrid",
      focus: { lat: 41.8781, lng: -87.6298, pinned: true },
      isPanning: false,
      refreshedAt: new Date("2026-07-22T10:30:00"),
      zoom: 16,
    });
    expect(line).toMatch(/41\.87810° N/);
    expect(line).toMatch(/ft|mi/);
    expect(line).not.toContain("Refreshed");
  });

  it("hides feet scale when zoomed out", () => {
    expect(formatMapGroundScaleFeet(10, 41.8781)).toBeNull();
    expect(formatMapGroundScaleFeet(16, 41.8781)).toMatch(/ft|mi/);
  });

  it("formats a local time label from longitude", () => {
    const label = estimateLocalTimeAtLng(0, new Date(Date.UTC(2026, 6, 22, 12, 0, 0)));
    expect(label).toMatch(/local$/);
    expect(label).toMatch(/\d{1,2}:\d{2}/);
  });
});
