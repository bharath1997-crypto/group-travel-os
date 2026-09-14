import type { FlightSearchParams, MultiCityLeg } from "@/lib/flight-types";

export const MAX_MULTI_CITY_LEGS = 6;

/** Legacy FlightSearchForm default for the outbound "to" time field — not a real filter. */
export const LEGACY_PLACEHOLDER_DEPARTURE_TIME_TO = "12:00";

export function todayIso(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isDateBeforeToday(isoDate: string): boolean {
  return isoDate < todayIso();
}

export function isReturnBeforeDepart(depart: string, returnDate: string): boolean {
  if (!depart || !returnDate) return false;
  return returnDate < depart;
}

export function countAdvancedOptions(input: {
  departureTimeFrom?: string;
  departureTimeTo?: string;
  nonstop?: boolean;
  maximumConnections?: number;
}): number {
  let count = 0;
  if (input.departureTimeFrom) count += 1;
  if (input.departureTimeTo && input.departureTimeTo !== LEGACY_PLACEHOLDER_DEPARTURE_TIME_TO) count += 1;
  if (input.nonstop) count += 1;
  if (input.maximumConnections !== undefined && input.maximumConnections !== 1) count += 1;
  return count;
}

export function validateRoundTripDates(depart: string, returnDate: string): string | null {
  if (!depart) return "Choose a departure date.";
  if (isDateBeforeToday(depart)) return "Departure date cannot be in the past.";
  if (!returnDate) return "Pick a return date for round trip.";
  if (isReturnBeforeDepart(depart, returnDate)) {
    return "Return date must be on or after departure.";
  }
  return null;
}

export function validateMultiCityLegs(
  firstLeg: { from: string; to: string; depart: string },
  extraLegs: MultiCityLeg[],
): string | null {
  const legs = [
    firstLeg,
    ...extraLegs.map((leg) => ({ from: leg.from, to: leg.to, depart: leg.depart })),
  ].filter((leg) => leg.from || leg.to || leg.depart);

  if (legs.length < 2) return "Multi-city searches need at least two complete flights.";

  let previousDate = "";
  for (let i = 0; i < legs.length; i += 1) {
    const leg = legs[i];
    const label = `Flight ${i + 1}`;
    if (!leg.from || !leg.to || !leg.depart) {
      return `${label} needs an origin, destination, and date.`;
    }
    if (leg.from === leg.to) {
      return `${label} origin and destination must be different.`;
    }
    if (isDateBeforeToday(leg.depart)) {
      return `${label} date cannot be in the past.`;
    }
    if (previousDate && leg.depart < previousDate) {
      return `${label} date must be on or after the previous flight.`;
    }
    previousDate = leg.depart;
  }
  return null;
}

/** Validates every itinerary date before a live provider request is made. */
export function validateFlightSearchDates(criteria: FlightSearchParams): string | null {
  if (criteria.tripType === "multicity") {
    return validateMultiCityLegs(
      { from: criteria.from, to: criteria.to, depart: criteria.depart },
      criteria.multiCityLegs ?? [],
    );
  }

  if (criteria.tripType === "roundtrip" || Boolean(criteria.return)) {
    return validateRoundTripDates(criteria.depart, criteria.return ?? "");
  }

  if (!criteria.depart) return "Choose a departure date.";
  if (isDateBeforeToday(criteria.depart)) return "Departure date cannot be in the past.";
  return null;
}
