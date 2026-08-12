import type { FlightJourney, FlightRow, FlightSortMode } from "@/lib/flight-types";

export function formatClock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatDuration(minutes: number): string {
  if (!minutes) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function formatPrice(currency: string, price: number): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(price);
  } catch {
    return `${currency} ${price.toFixed(0)}`;
  }
}

export function formatPriceExact(currency: string, price: number): string {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(price);
  } catch {
    return `${currency} ${price.toFixed(2)}`;
  }
}

export function formatShortDate(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function stopsLabel(stops: number): string {
  if (stops === 0) return "Nonstop";
  if (stops === 1) return "1 stop";
  return `${stops} stops`;
}

export function departureHourBucket(iso: string): "morning" | "afternoon" | "evening" | "night" {
  const d = new Date(iso);
  const h = d.getHours();
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 17) return "afternoon";
  if (h >= 17 && h < 21) return "evening";
  return "night";
}

export function sortFlights(rows: Array<FlightRow | FlightJourney>, mode: FlightSortMode): Array<FlightRow | FlightJourney> {
  const copy = [...rows];
  switch (mode) {
    case "cheapest":
      return copy.sort((a, b) => a.price - b.price);
    case "fastest":
      return copy.sort((a, b) => journeyDuration(a) - journeyDuration(b));
    case "earliest":
      return copy.sort((a, b) => a.departure_at.localeCompare(b.departure_at));
    case "best":
    default:
      return copy.sort((a, b) => scoreBest(a) - scoreBest(b));
  }
}

function journeyDuration(row: FlightRow | FlightJourney): number {
  return ("total_duration_minutes" in row && row.total_duration_minutes) || row.duration_minutes || 0;
}

function scoreBest(row: FlightRow | FlightJourney): number {
  if ("recommendation_score" in row && row.recommendation_score != null) {
    return row.recommendation_score;
  }
  const stopPenalty = row.stops * 35;
  const durationPenalty = journeyDuration(row) * 0.15;
  return row.price + stopPenalty + durationPenalty;
}

export type FlightFilters = {
  nonstopOnly: boolean;
  maxStops: number | null;
  airlines: string[];
  departureBuckets: Array<"morning" | "afternoon" | "evening" | "night">;
  maxPrice: number | null;
  maxDurationMinutes: number | null;
  baggageIncluded: boolean;
  refundableOnly: boolean;
  changeableOnly: boolean;
};

export function createDefaultFilters(partial?: Partial<FlightFilters>): FlightFilters {
  return {
    nonstopOnly: false,
    maxStops: null,
    airlines: [],
    departureBuckets: [],
    maxPrice: null,
    maxDurationMinutes: null,
    baggageIncluded: false,
    refundableOnly: false,
    changeableOnly: false,
    ...partial,
  };
}

export function countActiveFilters(filters: FlightFilters): number {
  let count = 0;
  if (filters.nonstopOnly) count += 1;
  if (filters.maxStops !== null) count += 1;
  if (filters.airlines.length > 0) count += 1;
  if (filters.departureBuckets.length > 0) count += 1;
  if (filters.maxPrice !== null) count += 1;
  if (filters.maxDurationMinutes !== null) count += 1;
  if (filters.baggageIncluded) count += 1;
  if (filters.refundableOnly) count += 1;
  if (filters.changeableOnly) count += 1;
  return count;
}

export function filterFlights(
  rows: Array<FlightRow | FlightJourney>,
  filters: FlightFilters,
): Array<FlightRow | FlightJourney> {
  return rows.filter((row) => {
    if (filters.nonstopOnly && row.stops > 0) return false;
    if (filters.maxStops !== null && row.stops > filters.maxStops) return false;
    if (filters.airlines.length > 0 && !row.airlines.some((a) => filters.airlines.includes(a))) {
      return false;
    }
    if (filters.departureBuckets.length > 0) {
      const bucket = departureHourBucket(row.departure_at);
      if (!filters.departureBuckets.includes(bucket)) return false;
    }
    if (filters.maxPrice !== null && row.price > filters.maxPrice) return false;
    const duration = journeyDuration(row);
    if (filters.maxDurationMinutes !== null && duration > filters.maxDurationMinutes) return false;

    if ("carry_on_included" in row || "checked_bag_included" in row) {
      const journey = row as FlightJourney;
      if (filters.baggageIncluded) {
        const hasBaggage = journey.carry_on_included === true || journey.checked_bag_included === true;
        if (!hasBaggage) return false;
      }
      if (filters.refundableOnly && journey.refundable !== true) return false;
      if (filters.changeableOnly && journey.changeable !== true) return false;
    }

    return true;
  });
}

export function formatExpiresIn(expiresAt: string): string {
  const exp = new Date(expiresAt).getTime();
  if (Number.isNaN(exp)) return "Offer expiry not confirmed";
  const mins = Math.max(0, Math.round((exp - Date.now()) / 60_000));
  if (mins <= 0) return "Offer expired";
  if (mins < 60) return `Expires in ${mins}m`;
  return `Expires in ${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export function uniqueAirlines(rows: Array<FlightRow | FlightJourney>): string[] {
  const set = new Set<string>();
  for (const row of rows) {
    for (const code of row.airlines) set.add(code);
  }
  return [...set].sort();
}
