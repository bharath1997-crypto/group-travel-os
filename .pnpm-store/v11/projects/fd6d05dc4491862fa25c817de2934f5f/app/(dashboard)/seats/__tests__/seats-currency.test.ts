import { describe, expect, it } from "vitest";
import {
  countryCodeToCurrency,
  inferCountryCodeFromCoords,
  resolveSeatShareCurrency,
} from "../seats-currency";
import type { LocationPoint } from "../seats-location";

function point(partial: Partial<LocationPoint> & Pick<LocationPoint, "lat" | "lng">): LocationPoint {
  return {
    address: partial.address ?? "",
    isConfirmed: partial.isConfirmed ?? true,
    source: partial.source ?? "map_pin",
    ...partial,
  };
}

describe("resolveSeatShareCurrency", () => {
  it("uses USD for US origin country code", () => {
    const from = point({
      lat: 41.88,
      lng: -87.62,
      address: "Chicago, IL",
      countryCode: "US",
    });
    expect(resolveSeatShareCurrency(from)).toBe("USD");
  });

  it("infers USD from Chicago coordinates when country code missing", () => {
    const from = point({
      lat: 41.8781,
      lng: -87.6298,
      address: "2015 North Pulaski Road, Chicago",
    });
    expect(resolveSeatShareCurrency(from)).toBe("USD");
  });

  it("uses INR for India", () => {
    const from = point({
      lat: 19.1136,
      lng: 72.8697,
      address: "Mumbai",
      countryCode: "IN",
    });
    expect(resolveSeatShareCurrency(from)).toBe("INR");
  });
});

describe("countryCodeToCurrency", () => {
  it("maps common markets", () => {
    expect(countryCodeToCurrency("US")).toBe("USD");
    expect(countryCodeToCurrency("IN")).toBe("INR");
  });
});

describe("inferCountryCodeFromCoords", () => {
  it("classifies Mumbai as IN and Chicago as US", () => {
    expect(inferCountryCodeFromCoords(19.11, 72.87)).toBe("IN");
    expect(inferCountryCodeFromCoords(41.88, -87.62)).toBe("US");
  });
});
