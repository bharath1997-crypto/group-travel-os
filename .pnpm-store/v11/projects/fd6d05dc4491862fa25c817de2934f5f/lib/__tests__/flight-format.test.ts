import { describe, expect, it } from "vitest";
import type { FlightRow } from "@/lib/flight-types";
import { createDefaultFilters, filterFlights, sortFlights } from "@/lib/flight-format";

const sampleRows: FlightRow[] = [
  {
    id: "a",
    price: 300,
    currency: "USD",
    airlines: ["AA"],
    departure_at: "2026-08-22T14:00:00Z",
    arrival_at: "2026-08-22T18:00:00Z",
    origin: "ORD",
    destination: "LAX",
    duration_minutes: 240,
    deep_link: "",
    stops: 1,
  },
  {
    id: "b",
    price: 200,
    currency: "USD",
    airlines: ["UA"],
    departure_at: "2026-08-22T08:00:00Z",
    arrival_at: "2026-08-22T12:00:00Z",
    origin: "ORD",
    destination: "LAX",
    duration_minutes: 240,
    deep_link: "",
    stops: 0,
  },
];

describe("flight sort/filter", () => {
  it("sorts cheapest first", () => {
    const sorted = sortFlights(sampleRows, "cheapest");
    expect(sorted[0].id).toBe("b");
  });

  it("filters nonstop only", () => {
    const filtered = filterFlights(sampleRows, createDefaultFilters({ nonstopOnly: true, maxStops: 0 }));
    expect(filtered).toHaveLength(1);
    expect(filtered[0].stops).toBe(0);
  });
});
