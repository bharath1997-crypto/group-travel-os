import { describe, expect, it } from "vitest";
import {
  LIVE_MAP_CONTROLS_RAIL_ELEVATED_Z,
  LIVE_MAP_CONTROLS_RAIL_Z,
  liveMapControlsRailZClass,
} from "../live-layout";

describe("liveMapControlsRailZClass", () => {
  it("uses default rail z-index when layers panel is closed", () => {
    expect(liveMapControlsRailZClass(false)).toBe(LIVE_MAP_CONTROLS_RAIL_Z);
  });

  it("raises rail above place preview when layers panel is open", () => {
    expect(liveMapControlsRailZClass(true)).toBe(LIVE_MAP_CONTROLS_RAIL_ELEVATED_Z);
  });
});
