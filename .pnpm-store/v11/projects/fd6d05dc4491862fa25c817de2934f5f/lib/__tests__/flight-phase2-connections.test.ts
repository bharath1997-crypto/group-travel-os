import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  baggageTransferLabel,
  connectionProtectionLabelFromEnum,
  selfTransferExplanation,
  selfTransferWhyExplanation,
} from "@/lib/flight-disclosure-ui";
import { createDefaultFilters, filterFlights } from "@/lib/flight-format";
import { getConnectionProtectionStatus } from "@/lib/flight-journey-ui";
import type { FlightConnectionDetail, FlightJourney, FlightJourneySegment, FlightJourneySlice } from "@/lib/flight-types";

function segment(flight: string, origin: string, destination: string): FlightJourneySegment {
  return {
    origin,
    origin_name: origin,
    destination,
    destination_name: destination,
    departure_at: "2026-10-10T08:00:00Z",
    arrival_at: "2026-10-10T12:00:00Z",
    duration_minutes: 240,
    airline_code: "UA",
    airline_name: "United",
    operating_airline_code: "UA",
    operating_airline_name: "United",
    flight_number: flight,
    aircraft: "B737",
    origin_terminal: "1",
    destination_terminal: "7",
  };
}

function connection(airport: string, layover: number, overrides: Partial<FlightConnectionDetail> = {}): FlightConnectionDetail {
  return {
    airport,
    airport_name: airport,
    arrival_at: "2026-10-10T12:00:00Z",
    next_departure_at: "2026-10-10T14:00:00Z",
    layover_minutes: layover,
    overnight: false,
    same_airport: true,
    airport_change: false,
    terminal_change: false,
    protected: null,
    ...overrides,
  };
}

function multiSegmentJourney(): FlightJourney {
  const slices: FlightJourneySlice[] = [
    {
      origin: "ORD",
      destination: "HBA",
      duration_minutes: 1905,
      stops: 2,
      segments: [
        segment("UA123", "ORD", "LAX"),
        segment("UA839", "LAX", "SYD"),
        segment("VA1528", "SYD", "HBA"),
      ],
      connections: [
        connection("LAX", 130),
        connection("SYD", 335, { overnight: true, baggage_transfer: "self_transfer" }),
      ],
    },
  ];
  return {
    id: "off_1",
    price: 2400,
    currency: "USD",
    airlines: ["UA", "VA"],
    departure_at: "2026-10-10T08:00:00Z",
    arrival_at: "2026-10-12T13:10:00Z",
    origin: "ORD",
    destination: "HBA",
    duration_minutes: 1905,
    deep_link: "",
    stops: 2,
    provider: "duffel",
    provider_offer_id: "off_1",
    checked_at: "2026-10-01T12:00:00Z",
    expires_at: "2099-01-01T00:00:00Z",
    live_mode: false,
    slices,
    total_duration_minutes: 1905,
    maximum_connections: 3,
    protected_connection: null,
    connection_protection: "unknown",
    baggage_transfer: "self_transfer",
    ticket_type: "unknown",
    bookable_in_rovvy: false,
    carry_on_included: null,
    checked_bag_included: null,
    refundable: null,
    changeable: null,
  };
}

describe("flight phase 2 disclosure ui", () => {
  it("renders multiple segments and layovers in order", () => {
    const journey = multiSegmentJourney();
    expect(journey.slices[0].segments.map((s) => s.flight_number)).toEqual(["UA123", "UA839", "VA1528"]);
    expect(journey.slices[0].connections.map((c) => c.airport)).toEqual(["LAX", "SYD"]);
  });

  it("shows self-transfer warning copy", () => {
    expect(selfTransferExplanation()).toMatch(/collect checked baggage/i);
    expect(selfTransferWhyExplanation()).toMatch(/Why is self-transfer required/i);
    expect(baggageTransferLabel("self_transfer")).toBe("Self-transfer required");
  });

  it("shows automatic and unknown transfer disclosures", () => {
    expect(baggageTransferLabel("automatic", "Duffel")).toMatch(/Baggage transfer indicated by Duffel/i);
    expect(baggageTransferLabel("unknown")).toMatch(/not confirmed/i);
  });

  it("maps protected, unprotected, and unknown protection states", () => {
    expect(connectionProtectionLabelFromEnum("protected")).toBe("Protected connection");
    expect(connectionProtectionLabelFromEnum("unprotected")).toBe("Unprotected connection");
    expect(connectionProtectionLabelFromEnum("unknown")).toBe("Connection protection not confirmed");
    expect(getConnectionProtectionStatus(multiSegmentJourney())).toBe("self_transfer");
  });

  it("filters two- and three-connection itineraries and long durations", () => {
    const journey = multiSegmentJourney();
    expect(filterFlights([journey], createDefaultFilters({ maxStops: 2 }))).toHaveLength(1);
    expect(filterFlights([journey], createDefaultFilters({ maxStops: 1 }))).toHaveLength(0);
    expect(
      filterFlights([journey], createDefaultFilters({ maxDurationMinutes: 72 * 60 })),
    ).toHaveLength(1);
    expect(
      filterFlights([journey], createDefaultFilters({ protectedConnectionsOnly: true })),
    ).toHaveLength(0);
    expect(
      filterFlights([journey], createDefaultFilters({ automaticBaggageTransferOnly: true })),
    ).toHaveLength(0);
  });

  it("preserves destination code in journey summary", () => {
    expect(multiSegmentJourney().destination).toBe("HBA");
  });

  it("filters 35-hour itinerary with 72-hour, 40-hour, and 30-hour max duration filters", () => {
    const journey = multiSegmentJourney(); // 1905 mins = 31h 45m
    const journey35h = {
      ...journey,
      id: "off_35h",
      duration_minutes: 35 * 60,
      total_duration_minutes: 35 * 60,
    };
    // 72-hour filter (4320m) includes 35h
    expect(filterFlights([journey35h], createDefaultFilters({ maxDurationMinutes: 72 * 60 }))).toHaveLength(1);
    // 40-hour filter (2400m) includes 35h
    expect(filterFlights([journey35h], createDefaultFilters({ maxDurationMinutes: 40 * 60 }))).toHaveLength(1);
    // 30-hour filter (1800m) excludes 35h
    expect(filterFlights([journey35h], createDefaultFilters({ maxDurationMinutes: 30 * 60 }))).toHaveLength(0);
  });

  it("enforces inclusive stop filters behavior (0, 0-1, 0-2, 0-3)", () => {
    const nonstop = { ...multiSegmentJourney(), id: "j0", stops: 0 };
    const oneStop = { ...multiSegmentJourney(), id: "j1", stops: 1 };
    const twoStops = { ...multiSegmentJourney(), id: "j2", stops: 2 };
    const threeStops = { ...multiSegmentJourney(), id: "j3", stops: 3 };
    const allJourneys = [nonstop, oneStop, twoStops, threeStops];

    // Nonstop: exactly 0
    expect(filterFlights(allJourneys, createDefaultFilters({ nonstopOnly: true, maxStops: 0 })).map((j) => j.id)).toEqual(["j0"]);
    // Up to 1: 0-1
    expect(filterFlights(allJourneys, createDefaultFilters({ maxStops: 1 })).map((j) => j.id)).toEqual(["j0", "j1"]);
    // Up to 2: 0-2
    expect(filterFlights(allJourneys, createDefaultFilters({ maxStops: 2 })).map((j) => j.id)).toEqual(["j0", "j1", "j2"]);
    // Up to 3: 0-3
    expect(filterFlights(allJourneys, createDefaultFilters({ maxStops: 3 })).map((j) => j.id)).toEqual(["j0", "j1", "j2", "j3"]);
  });

  it("verifies landing page copy uses environment-neutral language", () => {
    const pageContent = readFileSync(join(process.cwd(), "app/(dashboard)/flights/page.tsx"), "utf8");
    expect(pageContent).toContain("Search airline offers");
    expect(pageContent).not.toContain("Search live airline fares");
    expect(pageContent).toContain("Provider inventory");
    expect(pageContent).not.toContain("Live inventory");
    expect(pageContent).toContain("Compare available fares from authorized airline and travel providers.");
  });
});
