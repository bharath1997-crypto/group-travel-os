import { describe, expect, it } from "vitest";
import { labelForFlightIata, resolveFlightIataFromText } from "@/lib/flight-place-suggestions";

describe("flight place suggestion helpers", () => {
  it("labelForFlightIata returns the code when no cached label exists", () => {
    expect(labelForFlightIata("ORD")).toBe("ORD");
  });

  it("resolveFlightIataFromText accepts only explicit three-letter codes", () => {
    expect(resolveFlightIataFromText("ORD")).toBe("ORD");
    expect(resolveFlightIataFromText("Chicago, IL, United States")).toBeNull();
  });
});
