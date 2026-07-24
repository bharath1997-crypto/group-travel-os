import { describe, expect, it } from "vitest";

import { LIVE_MAP_MIN_ZOOM } from "@/lib/map-providers";
import {
  clampLiveMapZoomValue,
  liveMapZoomInButtonLevel,
  liveMapZoomOutButtonLevel,
} from "../live-map-zoom-limits";

describe("liveMapZoomInButtonLevel", () => {
  it("returns max at the layer cap", () => {
    expect(liveMapZoomInButtonLevel(16, 16)).toBe("max");
    expect(liveMapZoomInButtonLevel(16.499, 16.5)).toBe("max");
  });

  it("returns approaching near the cap", () => {
    expect(liveMapZoomInButtonLevel(15.5, 16)).toBe("approaching");
  });

  it("returns normal in the middle of the range", () => {
    expect(liveMapZoomInButtonLevel(10, 16)).toBe("normal");
  });
});

describe("liveMapZoomOutButtonLevel", () => {
  it("returns min at the floor", () => {
    expect(liveMapZoomOutButtonLevel(LIVE_MAP_MIN_ZOOM)).toBe("min");
  });

  it("returns normal above the floor", () => {
    expect(liveMapZoomOutButtonLevel(LIVE_MAP_MIN_ZOOM + 1)).toBe("normal");
  });
});

describe("clampLiveMapZoomValue", () => {
  it("never exceeds max or drops below min", () => {
    expect(clampLiveMapZoomValue(99, 0, 16)).toBe(16);
    expect(clampLiveMapZoomValue(-1, 0, 16)).toBe(0);
    expect(clampLiveMapZoomValue(12.5, 0, 16)).toBe(12.5);
  });
});
