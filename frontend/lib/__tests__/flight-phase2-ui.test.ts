import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  countAdvancedOptions,
  isReturnBeforeDepart,
  validateMultiCityLegs,
  validateRoundTripDates,
} from "@/lib/flight-search-validation";
import {
  connectionProtectionLabel,
  getConnectionProtectionStatus,
  isOfferExpired,
  isRecommendedJourney,
} from "@/lib/flight-journey-ui";
import { countActiveFilters, createDefaultFilters, formatPrice } from "@/lib/flight-format";
import type { FlightJourney } from "@/lib/flight-types";

function sampleJourney(overrides: Partial<FlightJourney> = {}): FlightJourney {
  return {
    id: "off_1",
    price: 900,
    currency: "EUR",
    airlines: ["QR"],
    departure_at: "2026-10-10T08:00:00Z",
    arrival_at: "2026-10-25T18:00:00Z",
    origin: "ORD",
    destination: "ORD",
    duration_minutes: 2000,
    deep_link: "",
    stops: 2,
    provider: "duffel",
    provider_offer_id: "off_1",
    checked_at: "2026-09-01T00:00:00Z",
    expires_at: "2099-01-01T00:00:00Z",
    live_mode: false,
    slices: [
      {
        origin: "ORD",
        destination: "HYD",
        duration_minutes: 1000,
        stops: 1,
        segments: [],
        connections: [{ airport: "DOH", airport_name: "Doha", protected: true, arrival_at: null, next_departure_at: null, layover_minutes: 120, overnight: false, same_airport: true, airport_change: false, terminal_change: false }],
      },
      {
        origin: "HYD",
        destination: "ORD",
        duration_minutes: 1000,
        stops: 1,
        segments: [],
        connections: [{ airport: "DOH", airport_name: "Doha", protected: false, arrival_at: null, next_departure_at: null, layover_minutes: 90, overnight: false, same_airport: true, airport_change: false, terminal_change: false }],
      },
    ],
    total_duration_minutes: 2000,
    maximum_connections: 1,
    protected_connection: null,
    bookable_in_rovvy: true,
    carry_on_included: null,
    checked_bag_included: null,
    refundable: null,
    changeable: null,
    recommendation_score: 0.2,
    ...overrides,
  };
}

describe("flight search validation", () => {
  it("rejects invalid return dates", () => {
    expect(validateRoundTripDates("2026-10-20", "2026-10-10")).toMatch(/return date/i);
    expect(isReturnBeforeDepart("2026-10-20", "2026-10-10")).toBe(true);
  });

  it("validates multi-city chronological legs", () => {
    const error = validateMultiCityLegs(
      { from: "ORD", to: "HYD", depart: "2026-10-10" },
      [{ from: "HYD", to: "SIN", depart: "2026-10-05" }],
    );
    expect(error).toMatch(/Flight 2 date/i);
  });

  it("counts advanced options", () => {
    expect(
      countAdvancedOptions({
        departureTimeFrom: "08:00",
        nonstop: true,
        maximumConnections: 2,
      }),
    ).toBe(3);
  });
});

describe("flight journey ui helpers", () => {
  it("shows separate tickets when connection protection is false", () => {
    const status = getConnectionProtectionStatus(sampleJourney({ protected_connection: true }));
    expect(status).toBe("separate_tickets");
    expect(connectionProtectionLabel(status!)).toBe("Separate tickets");
  });

  it("omits protection label for nonstop journeys", () => {
    expect(getConnectionProtectionStatus(sampleJourney({ stops: 0, slices: [] }))).toBeNull();
  });

  it("does not claim protection when the provider has not confirmed it", () => {
    expect(getConnectionProtectionStatus(sampleJourney({ protected_connection: null }))).toBe("not_confirmed");
  });

  it("marks recommended journey using ranking score order", () => {
    const cheaper = sampleJourney({ id: "off_cheap", recommendation_score: 0.1, price: 700 });
    const faster = sampleJourney({ id: "off_fast", recommendation_score: 0.4, price: 950 });
    const sorted = [cheaper, faster];
    expect(isRecommendedJourney(cheaper, sorted, "best")).toBe(true);
    expect(isRecommendedJourney(faster, sorted, "best")).toBe(false);
    expect(isRecommendedJourney(cheaper, sorted, "cheapest")).toBe(false);
  });

  it("detects expired offers", () => {
    expect(isOfferExpired("2000-01-01T00:00:00Z")).toBe(true);
    expect(isOfferExpired("2099-01-01T00:00:00Z")).toBe(false);
  });
});

describe("flight filters and formatting", () => {
  it("formats non-USD currency without hardcoded dollar sign", () => {
    expect(formatPrice("EUR", 812)).toContain("812");
    expect(formatPrice("EUR", 812)).not.toBe("$812");
  });

  it("counts active filters and resets cleanly", () => {
    const filters = createDefaultFilters({
      nonstopOnly: true,
      maxStops: 0,
      airlines: ["QR"],
      maxPrice: 500,
    });
    expect(countActiveFilters(filters)).toBe(4);
    expect(countActiveFilters(createDefaultFilters())).toBe(0);
  });
});

describe("encoding cleanup guard", () => {
  const flightUiSources = [
    "components/travel/FlightSearchSummary.tsx",
    "components/travel/FlightSearchForm.tsx",
    "components/travel/FlightOfferCard.tsx",
    "components/travel/FlightPricePanel.tsx",
    "components/travel/FlightFilterPanel.tsx",
    "lib/flight-journey-ui.ts",
  ];

  it("flight UI source files do not contain mojibake", () => {
    for (const relativePath of flightUiSources) {
      const absolutePath = join(process.cwd(), relativePath);
      expect(existsSync(absolutePath)).toBe(true);
      const content = readFileSync(absolutePath, "utf8");
      expect(content).not.toMatch(/Â|â€|â†'/);
    }
  });

  it("uses the intended middle-dot separator in search summary", () => {
    const summaryPath = join(process.cwd(), "components/travel/FlightSearchSummary.tsx");
    const content = readFileSync(summaryPath, "utf8");
    expect(content).toContain("·");
    expect(connectionProtectionLabel("not_confirmed")).toBe("Connection protection not confirmed");
  });
});
