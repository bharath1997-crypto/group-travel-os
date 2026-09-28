import { describe, expect, it } from "vitest";
import {
  buildFlightResultsPath,
  normalizeFlightSearchParams,
  parseFlightSearchParams,
} from "@/lib/flight-search-params";
import type { FlightSearchParams } from "@/lib/flight-types";

describe("flight-search-params", () => {
  it("round-trips search params in URL", () => {
    const qs = new URLSearchParams({
      from: "ORD",
      to: "LAX",
      depart: "2026-08-22",
      return: "2026-08-28",
      adults: "2",
      children: "1",
      infants: "0",
      cabin: "M",
      nonstop: "1",
    });
    const parsed = parseFlightSearchParams(qs);
    expect(parsed).not.toBeNull();
    expect(parsed?.from).toBe("ORD");
    expect(parsed?.return).toBe("2026-08-28");
    expect(parsed?.adults).toBe(2);
    expect(parsed?.nonstop).toBe(true);
    expect(buildFlightResultsPath(parsed!)).toContain("/flights/results?");
  });

  it("drops legacy depTo=12:00 without depFrom", () => {
    const qs = new URLSearchParams({
      from: "CHI",
      to: "HYD",
      depart: "2026-08-27",
      return: "2026-09-28",
      adults: "1",
      children: "0",
      infants: "0",
      cabin: "M",
      depTo: "12:00",
    });
    const parsed = parseFlightSearchParams(qs);
    expect(parsed?.departureTimeTo).toBeUndefined();
    expect(buildFlightResultsPath(parsed!)).not.toContain("depTo=");
  });

  it("keeps explicit departure windows", () => {
    const params: FlightSearchParams = {
      from: "CHI",
      to: "HYD",
      depart: "2026-08-27",
      adults: 1,
      children: 0,
      infants: 0,
      cabin: "M",
      tripType: "roundtrip",
      departureTimeFrom: "06:00",
      departureTimeTo: "12:00",
    };
    const normalized = normalizeFlightSearchParams(params);
    expect(normalized.departureTimeFrom).toBe("06:00");
    expect(normalized.departureTimeTo).toBe("12:00");
    expect(buildFlightResultsPath(normalized)).toContain("depFrom=06%3A00");
    expect(buildFlightResultsPath(normalized)).toContain("depTo=12%3A00");
  });
});
