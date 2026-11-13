import type { SeatRidePreferences } from "./seats-api";

const LUGGAGE_LABEL = { none: "No luggage", small: "Small bags", large: "Large bags" } as const;

/** Short labels for what the driver stated. Anything not stated is not shown. */
export function rideDetailChips(prefs: SeatRidePreferences | null | undefined): string[] {
  if (!prefs) return [];
  const chips: string[] = [];
  if (prefs.depart_window_minutes && prefs.depart_window_minutes > 0) {
    chips.push(`Flexible ± ${prefs.depart_window_minutes} min`);
  }
  if (prefs.luggage && prefs.luggage in LUGGAGE_LABEL) chips.push(LUGGAGE_LABEL[prefs.luggage]);
  if (prefs.pets_allowed) chips.push("Pets allowed");
  if (prefs.smoking_allowed) chips.push("Smoking allowed");
  if (prefs.quiet_ride) chips.push("Quiet ride");
  return chips;
}

/** Plain-text trip summary a driver can send to a friend or family member. No plate, no live tracking. */
export function buildShareTripText(input: {
  from: string;
  to: string;
  departLabel: string;
  car?: string | null;
  note?: string | null;
}): string {
  const lines = [
    `I'm driving from ${input.from} to ${input.to}.`,
    `Leaving: ${input.departLabel}`,
  ];
  if (input.car) lines.push(`Car: ${input.car}`);
  if (input.note) lines.push(`Pickup note: ${input.note}`);
  lines.push("Shared from Rovvy SeatShare.");
  return lines.join("\n");
}
