import { describe, expect, it } from "vitest";
import {
  buildLaneHints,
  buildNavigationManeuverView,
  formatManeuverDistanceMi,
  parseManeuverKind,
} from "../live-navigation-maneuver";

describe("live-navigation-maneuver", () => {
  it("parses left and right instructions", () => {
    expect(parseManeuverKind("Turn left onto Main St")).toBe("left");
    expect(parseManeuverKind("Bear right at the fork")).toBe("right");
    expect(parseManeuverKind("Continue straight")).toBe("straight");
  });

  it("builds lane hints for maneuver kind", () => {
    expect(buildLaneHints("left").find((l) => l.active)?.arrow).toBe("↰");
    expect(buildLaneHints("right").find((l) => l.active)?.arrow).toBe("↱");
  });

  it("does not inflate a zero-distance maneuver", () => {
    expect(formatManeuverDistanceMi(0)).toBe("0 m");
  });

  it("uses route maneuver when available", () => {
    const view = buildNavigationManeuverView({
      routeLine: {
        from: { lat: 0, lng: 0 },
        to: { lat: 1, lng: 1 },
        geometry: [],
        distanceMeters: 5000,
        durationSeconds: 600,
        active: true,
        maneuvers: [{ instruction: "Turn right onto Lake Shore Dr", location: [0, 0] }],
      },
      destinationName: "Millennium Park",
      remainingDistanceM: 3200,
    });
    expect(view.instruction).toBe("First route step: Turn right onto Lake Shore Dr");
    expect(view.kind).toBe("straight");
    expect(view.distanceMiLabel).toBeNull();
    expect(view.laneHints).toEqual([]);
  });
});
