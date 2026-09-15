import { describe, expect, it } from "vitest";
import type { FlightJourney } from "@/lib/flight-types";
import { curateFlightResults, dominatingJourney } from "@/lib/flight-result-curation";

function journey(
  id: string,
  price: number,
  minutes: number,
  stops: number,
  extras: Partial<FlightJourney> = {},
): FlightJourney {
  return {
    id,
    provider: "duffel",
    provider_offer_id: id,
    price,
    currency: "USD",
    checked_at: "2026-08-20T08:00:00Z",
    expires_at: "2099-08-20T09:00:00Z",
    live_mode: true,
    slices: [],
    total_duration_minutes: minutes,
    maximum_connections: stops,
    protected_connection: null,
    bookable_in_rovvy: true,
    airlines: [id.toUpperCase()],
    carry_on_included: null,
    checked_bag_included: null,
    refundable: null,
    changeable: null,
    departure_at: `2026-09-03T${String(8 + stops).padStart(2, "0")}:00:00Z`,
    arrival_at: "2026-09-04T08:00:00Z",
    origin: "ORD",
    destination: "IDR",
    duration_minutes: minutes,
    deep_link: "",
    stops,
    ...extras,
  };
}

describe("flight result curation", () => {
  it("detects an offer that is worse on price, duration, and stops", () => {
    const strong = journey("strong", 500, 1_000, 0);
    const weak = journey("weak", 900, 1_500, 2);
    expect(dominatingJourney(weak, [strong, weak])?.id).toBe("strong");
  });

  it("does not suppress a materially better refundable fare", () => {
    const basic = journey("basic", 500, 1_000, 0);
    const flexible = journey("flex", 650, 1_100, 1, { refundable: true });
    expect(dominatingJourney(flexible, [basic, flexible])).toBeNull();
  });

  it("shows five diverse choices and keeps remaining inventory accessible", () => {
    const rows = [
      journey("best", 500, 1_000, 1),
      journey("cheap", 450, 1_400, 2),
      journey("fast", 700, 850, 1),
      journey("direct", 800, 950, 0),
      journey("flex", 850, 1_050, 1, { changeable: true }),
      journey("weak-1", 1_000, 1_600, 2),
      journey("weak-2", 1_100, 1_700, 2),
    ];
    const curated = curateFlightResults(rows);
    expect(curated.primary).toHaveLength(5);
    expect(curated.primary.map((row) => row.id)).toEqual(
      expect.arrayContaining(["best", "cheap", "fast", "direct", "flex"]),
    );
    expect(curated.alternatives.map((row) => row.id)).toEqual(["weak-1", "weak-2"]);
    expect(curated.tradeoffById["weak-1"]).toMatch(/more|longer|stops/i);
  });
});
