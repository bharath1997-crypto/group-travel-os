import { describe, expect, it } from "vitest";

import {
  cityFromGeocodeAddress,
  formatGeocodeResultSubtitle,
  formatGeocodeResultTitle,
  regionFromGeocodeAddress,
} from "../explore-hero-location";

describe("explore-hero-location", () => {
  it("prefers city from geocode address fields worldwide", () => {
    expect(cityFromGeocodeAddress({ city: "Chicago", state: "Illinois" })).toBe("Chicago");
    expect(cityFromGeocodeAddress({ town: "Oxford", county: "Oxfordshire" })).toBe("Oxford");
    expect(cityFromGeocodeAddress({ city: "Tokyo", province: "Tokyo" })).toBe("Tokyo");
  });

  it("resolves region labels across country formats", () => {
    expect(regionFromGeocodeAddress({ state: "Illinois", country: "United States" })).toBe("Illinois");
    expect(regionFromGeocodeAddress({ province: "Ontario", country: "Canada" })).toBe("Ontario");
    expect(regionFromGeocodeAddress({ region: "Île-de-France", country: "France" })).toBe("Île-de-France");
    expect(regionFromGeocodeAddress({ country: "Japan" })).toBe("Japan");
  });

  it("formats postal and city results from multiple countries", () => {
    const usZip = {
      place_id: 1,
      lat: "41.8781",
      lon: "-87.6298",
      display_name: "60614, Chicago, Cook County, Illinois, United States",
      address: { postcode: "60614", city: "Chicago", state: "Illinois", country: "United States" },
    };
    expect(formatGeocodeResultTitle(usZip)).toBe("Chicago, Illinois");

    const ukPostcode = {
      place_id: 2,
      lat: "51.5074",
      lon: "-0.1278",
      display_name: "SW1A 1AA, Westminster, London, England, United Kingdom",
      address: { postcode: "SW1A 1AA", city: "London", country: "United Kingdom" },
    };
    expect(formatGeocodeResultTitle(ukPostcode)).toBe("London, United Kingdom");

    const indiaPin = {
      place_id: 3,
      lat: "28.6139",
      lon: "77.2090",
      display_name: "110001, Delhi, India",
      address: { postcode: "110001", city: "Delhi", country: "India" },
    };
    expect(formatGeocodeResultTitle(indiaPin)).toBe("Delhi, India");
    expect(formatGeocodeResultSubtitle(indiaPin)).toContain("Delhi");
  });
});
