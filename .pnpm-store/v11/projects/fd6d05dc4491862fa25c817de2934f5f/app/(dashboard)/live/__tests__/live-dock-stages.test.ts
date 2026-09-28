import { describe, expect, it } from "vitest";
import {
  LIVE_DOCK_PANEL_WIDTH,
  LIVE_DOCK_STAGE_ENABLED,
} from "../live-dock-stages";

describe("live-dock-stages", () => {
  it("defines panel widths for every stage", () => {
    const stages = Object.keys(LIVE_DOCK_STAGE_ENABLED);
    expect(Object.keys(LIVE_DOCK_PANEL_WIDTH).sort()).toEqual(stages.sort());
  });

  it("enables setup and nearby for the current Live build", () => {
    expect(LIVE_DOCK_STAGE_ENABLED.setup).toBe(true);
    expect(LIVE_DOCK_STAGE_ENABLED.nearby).toBe(true);
    expect(LIVE_DOCK_STAGE_ENABLED.vote).toBe(true);
    expect(LIVE_DOCK_STAGE_ENABLED.seat).toBe(true);
    expect(LIVE_DOCK_STAGE_ENABLED.settle).toBe(true);
    expect(LIVE_DOCK_STAGE_ENABLED.converge).toBe(true);
  });
});
