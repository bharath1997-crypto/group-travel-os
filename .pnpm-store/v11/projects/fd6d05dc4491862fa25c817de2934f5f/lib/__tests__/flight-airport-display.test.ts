import { describe, expect, it } from "vitest";
import { airportDisplayCode } from "@/lib/flight-airport-display";

describe("airportDisplayCode", () => {
  it("renders Duffel airport objects as IATA codes", () => {
    expect(
      airportDisplayCode({
        iata_country_code: "US",
        iata_city_code: "CHI",
        city_name: "Chicago",
        icao_code: "KORD",
        iata_code: "ORD",
        type: "airport",
        name: "O'Hare International Airport",
        id: "arp_ord",
      }),
    ).toBe("ORD");
  });

  it("preserves string airport codes and safely handles missing values", () => {
    expect(airportDisplayCode("nag")).toBe("NAG");
    expect(airportDisplayCode(null)).toBe("—");
  });
});
