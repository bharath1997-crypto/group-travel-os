import { describe, expect, it } from "vitest";
import { buildFlightResultsPath, parseFlightSearchParams } from "@/lib/flight-search-params";

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
});
