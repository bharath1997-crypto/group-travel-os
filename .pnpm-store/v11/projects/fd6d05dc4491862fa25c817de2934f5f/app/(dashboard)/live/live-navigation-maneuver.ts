import type { RouteLine } from "./live-types";

export type ManeuverKind = "left" | "right" | "straight";

export type LaneHint = { arrow: string; active: boolean };

export type NavigationManeuverView = {
  instruction: string;
  distanceMiLabel: string | null;
  kind: ManeuverKind;
  laneHints: LaneHint[];
};

export function parseManeuverKind(instruction: string): ManeuverKind {
  const lower = instruction.toLowerCase();
  if (lower.includes("left")) return "left";
  if (lower.includes("right")) return "right";
  return "straight";
}

export function buildLaneHints(kind: ManeuverKind): LaneHint[] {
  if (kind === "left") {
    return [
      { arrow: "↰", active: true },
      { arrow: "↑", active: false },
      { arrow: "↑", active: false },
      { arrow: "↱", active: false },
    ];
  }
  if (kind === "right") {
    return [
      { arrow: "↰", active: false },
      { arrow: "↑", active: false },
      { arrow: "↑", active: false },
      { arrow: "↱", active: true },
    ];
  }
  return [
    { arrow: "↰", active: false },
    { arrow: "↑", active: true },
    { arrow: "↑", active: true },
    { arrow: "↱", active: false },
  ];
}

export function formatManeuverDistanceMi(remainingDistanceM: number | null): string {
  if (remainingDistanceM == null) return "—";
  const mi = remainingDistanceM / 1609.34;
  if (mi < 0.1) return `${Math.round(remainingDistanceM)} m`;
  return mi < 10 ? mi.toFixed(1) : Math.round(mi).toString();
}

export function buildNavigationManeuverView(input: {
  routeLine: RouteLine | null;
  destinationName: string;
  remainingDistanceM: number | null;
}): NavigationManeuverView {
  const firstInstruction =
    input.routeLine?.maneuvers && input.routeLine.maneuvers.length > 0
      ? input.routeLine.maneuvers[0].instruction
      : null;

  // The route provider supplies an ordered plan, not live step progress or lane geometry.
  // Show the first step as a preview without claiming it is the current turn.
  const instruction = firstInstruction
    ? `First route step: ${firstInstruction}`
    : input.routeLine
      ? "Follow highlighted route"
      : `Route to ${input.destinationName} unavailable`;

  return {
    instruction,
    distanceMiLabel: null,
    kind: "straight",
    laneHints: [],
  };
}
