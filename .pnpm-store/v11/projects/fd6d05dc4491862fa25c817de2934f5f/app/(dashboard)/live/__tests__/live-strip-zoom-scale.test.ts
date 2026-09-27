import { describe, expect, it } from "vitest";

import {
  liveStripZoomFromTrackX,
  liveStripZoomPercent,
} from "../live-strip-zoom-scale";

describe("live-strip-zoom-scale", () => {
  it("maps zoom to percent across min/max", () => {
    expect(liveStripZoomPercent(0, 0, 20)).toBe(0);
    expect(liveStripZoomPercent(10, 0, 20)).toBe(0.5);
    expect(liveStripZoomPercent(20, 0, 20)).toBe(1);
  });

  it("clamps percent at edges", () => {
    expect(liveStripZoomPercent(-2, 0, 20)).toBe(0);
    expect(liveStripZoomPercent(25, 0, 20)).toBe(1);
  });

  it("converts track position back to zoom", () => {
    expect(liveStripZoomFromTrackX(50, 0, 100, 0, 20)).toBe(10);
    expect(liveStripZoomFromTrackX(0, 0, 100, 0, 20)).toBe(0);
    expect(liveStripZoomFromTrackX(100, 0, 100, 0, 20)).toBe(20);
  });
});
