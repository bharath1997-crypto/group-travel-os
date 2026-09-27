import { describe, expect, it } from "vitest";

import { citiesForCountrySelection, countriesForContinent, EXPLORE_CONTINENT_TABS } from "../explore-location-catalog";

describe("explore-location-catalog", () => {
  it("lists continent tabs including Asia", () => {
    expect(EXPLORE_CONTINENT_TABS.map((t) => t.label)).toEqual(["Americas", "Europe", "Asia", "Oceania"]);
  });

  it("shows countries first, then cities within a country", () => {
    const americas = countriesForContinent("americas").map((c) => c.name);
    expect(americas).toContain("United States");
    expect(americas).toContain("Mexico");

    const usCities = citiesForCountrySelection("us", null).map((c) => c.name);
    expect(usCities).toContain("Chicago");
    expect(usCities).toContain("New York");

    const ilCities = citiesForCountrySelection("us", "us-il").map((c) => c.name);
    expect(ilCities).toEqual(["Chicago"]);
  });
});
