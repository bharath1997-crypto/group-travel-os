import type {
  BaggageTransfer,
  ConnectionProtection,
  FlightConnectionDetail,
  FlightJourney,
  TicketType,
} from "@/lib/flight-types";

export function ticketTypeLabel(value: TicketType): string {
  switch (value) {
    case "single_ticket":
      return "Single ticket";
    case "separate_tickets":
      return "Separate tickets";
    default:
      return "Ticket type not confirmed";
  }
}

export function connectionProtectionLabelFromEnum(value: ConnectionProtection): string {
  switch (value) {
    case "protected":
      return "Protected connection";
    case "unprotected":
      return "Unprotected connection";
    default:
      return "Connection protection not confirmed";
  }
}

export function baggageTransferLabel(value: BaggageTransfer, provider?: string): string {
  switch (value) {
    case "automatic":
      return `Baggage transfer indicated by ${provider || "provider"}. Confirm the final baggage destination when checking in.`;
    case "self_transfer":
      return "Self-transfer required";
    default:
      return "Baggage transfer is not confirmed. Verify with the airline or seller before continuing.";
  }
}

export function selfTransferExplanation(): string {
  return "These flights are issued separately or the provider requires the traveler to manage the connection. You may need to collect checked baggage, complete immigration or customs requirements, travel between terminals or airports, and check in again. Missing the onward flight may not be covered.";
}

export function selfTransferWhyExplanation(): string {
  return "Why is self-transfer required? The provider indicates that the onward journey is not covered by automatic baggage transfer or a protected through-ticket. The traveler is responsible for completing the connection.";
}

export function terminalLabel(terminal: string | undefined | null): string {
  if (terminal && terminal.trim()) return `T${terminal.replace(/^T/i, "")}`;
  return "Terminal not supplied by the provider";
}

export function connectionWarnings(connection: FlightConnectionDetail): string[] {
  const warnings: string[] = [];
  if (connection.overnight) warnings.push("Overnight");
  if (connection.airport_change_status === "yes" || connection.airport_change) warnings.push("Airport change");
  if (connection.terminal_change_status === "yes" || connection.terminal_change) warnings.push("Terminal change");
  if (connection.connection_protection === "unprotected") warnings.push("Unprotected connection");
  if (connection.baggage_transfer === "self_transfer") warnings.push("Self-transfer");
  return warnings;
}

export function journeySegmentCount(journey: FlightJourney): number {
  return journey.slices.reduce((sum, slice) => sum + slice.segments.length, 0);
}

export function journeyConnectionCount(journey: FlightJourney): number {
  return journey.slices.reduce((sum, slice) => sum + slice.connections.length, 0);
}

export function maxLayoverMinutes(journey: FlightJourney): number {
  let max = 0;
  for (const slice of journey.slices) {
    for (const connection of slice.connections) {
      if (connection.layover_minutes != null && connection.layover_minutes > max) {
        max = connection.layover_minutes;
      }
    }
  }
  return max;
}

export function hasOvernightConnection(journey: FlightJourney): boolean {
  return journey.slices.some((slice) => slice.connections.some((conn) => conn.overnight));
}

export function hasAirportChange(journey: FlightJourney): boolean {
  return journey.slices.some(
    (slice) =>
      slice.connections.some(
        (conn) => conn.airport_change_status === "yes" || conn.airport_change === true,
      ),
  );
}
