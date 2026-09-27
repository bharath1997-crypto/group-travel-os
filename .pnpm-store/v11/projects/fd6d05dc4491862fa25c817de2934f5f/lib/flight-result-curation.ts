import type { FlightJourney } from "@/lib/flight-types";
import { formatDuration, formatPrice } from "@/lib/flight-format";

export const DEFAULT_PRIMARY_FLIGHT_COUNT = 5;

export type CuratedFlightResults = {
  primary: FlightJourney[];
  alternatives: FlightJourney[];
  tradeoffById: Record<string, string>;
};

function duration(row: FlightJourney): number {
  return row.total_duration_minutes || row.duration_minutes || 0;
}

function hasBetterFareBenefits(candidate: FlightJourney, other: FlightJourney): boolean {
  return (
    (candidate.refundable === true && other.refundable !== true) ||
    (candidate.changeable === true && other.changeable !== true) ||
    (candidate.checked_bag_included === true && other.checked_bag_included !== true)
  );
}

export function dominatingJourney(candidate: FlightJourney, rows: FlightJourney[]): FlightJourney | null {
  return rows.find((other) => {
    if (other.id === candidate.id || other.currency !== candidate.currency) return false;
    if (hasBetterFareBenefits(candidate, other)) return false;
    const noWorse =
      other.price <= candidate.price && duration(other) <= duration(candidate) && other.stops <= candidate.stops;
    const strictlyBetter =
      other.price < candidate.price || duration(other) < duration(candidate) || other.stops < candidate.stops;
    return noWorse && strictlyBetter;
  }) ?? null;
}

function tradeoffLabel(row: FlightJourney, winner: FlightJourney | null): string {
  if (!winner) return "Alternative schedule or airline preference.";
  const parts: string[] = [];
  const priceDifference = row.price - winner.price;
  const durationDifference = duration(row) - duration(winner);
  const stopDifference = row.stops - winner.stops;
  if (priceDifference > 0) parts.push(`${formatPrice(row.currency, priceDifference)} more`);
  if (durationDifference >= 30) parts.push(`${formatDuration(durationDifference)} longer`);
  if (stopDifference > 0) parts.push(`${stopDifference} more ${stopDifference === 1 ? "stop" : "stops"}`);
  return parts.length > 0
    ? `${parts.join(" · ")} than a stronger option.`
    : "Alternative schedule or airline preference.";
}

function addUnique(target: FlightJourney[], candidate: FlightJourney | undefined, limit: number): void {
  if (!candidate || target.length >= limit || target.some((row) => row.id === candidate.id)) return;
  target.push(candidate);
}

/** Select a diverse first page without deleting valid provider inventory. */
export function curateFlightResults(
  sorted: FlightJourney[],
  limit = DEFAULT_PRIMARY_FLIGHT_COUNT,
): CuratedFlightResults {
  if (sorted.length <= limit) return { primary: sorted, alternatives: [], tradeoffById: {} };

  const primary: FlightJourney[] = [];
  const byPrice = [...sorted].sort((a, b) => a.price - b.price);
  const byDuration = [...sorted].sort((a, b) => duration(a) - duration(b));
  const flexible = sorted.find((row) => row.refundable === true || row.changeable === true);
  const nonstop = sorted.find((row) => row.stops === 0);

  addUnique(primary, sorted[0], limit);
  addUnique(primary, byPrice[0], limit);
  addUnique(primary, byDuration[0], limit);
  addUnique(primary, nonstop, limit);
  addUnique(primary, flexible, limit);
  for (const row of sorted) {
    if (!dominatingJourney(row, sorted)) addUnique(primary, row, limit);
  }
  for (const row of sorted) addUnique(primary, row, limit);

  const primaryIds = new Set(primary.map((row) => row.id));
  const alternatives = sorted.filter((row) => !primaryIds.has(row.id));
  const tradeoffById = Object.fromEntries(
    alternatives.map((row) => [row.id, tradeoffLabel(row, dominatingJourney(row, sorted))]),
  );
  return { primary, alternatives, tradeoffById };
}
