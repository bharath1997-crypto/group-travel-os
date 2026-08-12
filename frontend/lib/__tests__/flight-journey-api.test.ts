import { describe, expect, it } from "vitest";
import { buildFlightSearchRequestBody } from "@/lib/flight-journey-api";
import type { FlightSearchParams } from "@/lib/flight-types";

describe("buildFlightSearchRequestBody", () => {
  it("serializes one-way search", () => {
    const params: FlightSearchParams = {
      from: "ORD",
      to: "HYD",
      depart: "2026-10-10",
      adults: 1,
      children: 0,
      infants: 0,
      cabin: "M",
      tripType: "oneway",
      departureTimeFrom: "00:00",
      departureTimeTo: "12:00",
    };
    const body = buildFlightSearchRequestBody(params);
    expect(body.trip_type).toBe("one_way");
    expect(body.slices).toHaveLength(1);
    expect(body.slices[0].origin).toBe("ORD");
    expect(body.slices[0].departure_time_to).toBe("12:00");
  });

  it("serializes round-trip with reciprocal slices", () => {
    const params: FlightSearchParams = {
      from: "ORD",
      to: "HYD",
      depart: "2026-10-10",
      return: "2026-10-25",
      adults: 1,
      children: 0,
      infants: 0,
      cabin: "M",
      tripType: "roundtrip",
    };
    const body = buildFlightSearchRequestBody(params);
    expect(body.trip_type).toBe("round_trip");
    expect(body.slices).toHaveLength(2);
    expect(body.slices[1].origin).toBe("HYD");
    expect(body.slices[1].destination).toBe("ORD");
  });

  it("serializes multi-city including first leg", () => {
    const params: FlightSearchParams = {
      from: "ORD",
      to: "HYD",
      depart: "2026-10-10",
      adults: 1,
      children: 0,
      infants: 0,
      cabin: "M",
      tripType: "multicity",
      multiCityLegs: [{ from: "HYD", to: "SIN", depart: "2026-10-15" }],
    };
    const body = buildFlightSearchRequestBody(params);
    expect(body.trip_type).toBe("multi_city");
    expect(body.slices).toHaveLength(2);
    expect(body.slices[1].destination).toBe("SIN");
  });
});
