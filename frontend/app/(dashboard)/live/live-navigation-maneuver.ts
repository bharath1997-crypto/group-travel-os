import type { RouteLine } from "./live-types";

export type ManeuverKind = "left" | "right" | "straight";

export type LaneHint = { arrow: string; active: boolean };

export type NavigationManeuverView = {
  instruction: string;
  distanceMiLabel: string;
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
  const mi = Math.max(0.1, remainingDistanceM / 1609.34);
  return mi < 10 ? mi.toFixed(1) : Math.round(mi).toString();
}

/** Approximate distance to next maneuver when step distance is unavailable. */
export function estimateNextManeuverDistanceM(totalRemainingM: number | null): number | null {
  if (totalRemainingM == null) return null;
  return totalRemainingM * 0.35;
}

export function buildNavigationManeuverView(input: {
  routeLine: RouteLine | null;
  destinationName: string;
  remainingDistanceM: number | null;
}): NavigationManeuverView {
  const nextInstruction =
    input.routeLine?.maneuvers && input.routeLine.maneuvers.length > 0
      ? input.routeLine.maneuvers[0].instruction
      : input.routeLine
        ? "Follow highlighted route"
        : `Continue toward ${input.destinationName}`;

  const kind = parseManeuverKind(nextInstruction);
  const maneuverDistanceM = estimateNextManeuverDistanceM(input.remainingDistanceM);

  return {
    instruction: nextInstruction,
    distanceMiLabel: formatManeuverDistanceMi(maneuverDistanceM),
    kind,
    laneHints: buildLaneHints(kind),
  };
}
