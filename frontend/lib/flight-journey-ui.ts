import type { FlightJourney, FlightSortMode } from "@/lib/flight-types";

export type ConnectionProtectionStatus =
  | "protected"
  | "self_transfer"
  | "separate_tickets"
  | "not_confirmed";

export function journeyHasConnections(journey: FlightJourney): boolean {
  return journey.stops > 0 || journey.slices.some((slice) => slice.connections.length > 0);
}

export function getConnectionProtectionStatus(
  journey: FlightJourney,
): ConnectionProtectionStatus | null {
  if (!journeyHasConnections(journey)) return null;

  if (journey.protected_connection === true) {
    const hasSeparateTickets = journey.slices.some((slice) =>
      slice.connections.some((connection) => connection.protected === false),
    );
    return hasSeparateTickets ? "separate_tickets" : "protected";
  }

  if (journey.protected_connection === false) return "self_transfer";
  return "not_confirmed";
}

export function connectionProtectionLabel(status: ConnectionProtectionStatus): string {
  switch (status) {
    case "protected":
      return "Protected connection";
    case "self_transfer":
      return "Self-transfer required";
    case "separate_tickets":
      return "Separate tickets";
    case "not_confirmed":
      return "Connection protection not confirmed";
  }
}

export function isOfferExpired(expiresAt: string | undefined | null): boolean {
  if (!expiresAt) return false;
  const exp = new Date(expiresAt).getTime();
  return !Number.isNaN(exp) && exp <= Date.now();
}

export function isRecommendedJourney(
  journey: FlightJourney,
  sorted: FlightJourney[],
  sortMode: FlightSortMode,
): boolean {
  if (sortMode !== "best" || sorted.length === 0) return false;
  const top = sorted[0];
  if (journey.recommendation_score != null && top.recommendation_score != null) {
    return journey.id === top.id;
  }
  return journey.id === top.id;
}

export function airlineLogoUrl(code: string): string | null {
  const normalized = code.trim().toUpperCase();
  if (!/^[A-Z0-9]{2,3}$/.test(normalized)) return null;
  return `https://content.airhex.com/content/logos/airlines_${normalized}_50_50_r.png`;
}

export function sliceHeading(index: number, total: number, roundTrip: boolean): string {
  if (total <= 1) return "Flight";
  if (roundTrip && total === 2) return index === 0 ? "Outbound" : "Return";
  return `Leg ${index + 1}`;
}

export function connectionAirportCodes(journey: FlightJourney): string[] {
  const codes = new Set<string>();
  for (const slice of journey.slices) {
    for (const connection of slice.connections) {
      if (connection.airport) codes.add(connection.airport);
    }
  }
  return [...codes];
}
