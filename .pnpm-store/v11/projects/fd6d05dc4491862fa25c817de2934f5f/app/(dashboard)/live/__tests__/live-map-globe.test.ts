import { describe, expect, it } from "vitest";

import {
  LIVE_GLOBE_VIEW_MAX_ZOOM,
  isLiveGlobeViewZoom,
  resolveLiveLocateZoom,
} from "../live-map-globe";

describe("live-map-globe", () => {
  it("treats low zoom as globe view", () => {
    expect(isLiveGlobeViewZoom(LIVE_GLOBE_VIEW_MAX_ZOOM)).toBe(true);
    expect(isLiveGlobeViewZoom(0)).toBe(true);
    expect(isLiveGlobeViewZoom(5)).toBe(false);
  });

  it("keeps globe zoom for passive updates at world view", () => {
    expect(resolveLiveLocateZoom(0, 20)).toBe(2.2);
    expect(resolveLiveLocateZoom(LIVE_GLOBE_VIEW_MAX_ZOOM, 500)).toBe(2.2);
  });

  it("zooms to street level when user explicitly locates from globe view", () => {
    expect(resolveLiveLocateZoom(0, 20, { zoomToStreet: true })).toBe(14);
    expect(resolveLiveLocateZoom(LIVE_GLOBE_VIEW_MAX_ZOOM, 500, { zoomToStreet: true })).toBe(
      12,
    );
  });

  it("uses street zoom when already zoomed in locally", () => {
    expect(resolveLiveLocateZoom(14, 20)).toBe(16);
    expect(resolveLiveLocateZoom(14, 200)).toBe(14);
    expect(resolveLiveLocateZoom(6, 200)).toBe(12);
  });
});
