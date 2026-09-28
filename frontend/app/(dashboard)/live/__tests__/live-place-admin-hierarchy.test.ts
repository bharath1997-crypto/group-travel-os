import { describe, expect, it } from "vitest";

import {
  buildPlaceHierarchyFields,
  extractPlaceAdminHierarchy,
  formatDistanceFromUserLabel,
  formatPlaceHierarchySubtitle,
} from "../live-place-admin-hierarchy";

describe("live-place-admin-hierarchy", () => {
  it("extracts Russian village hierarchy from Nominatim address", () => {
    const admin = extractPlaceAdminHierarchy(
      {
        village: "Unzhitsa",
        county: "Shenkursky District",
        state: "Arkhangelsk Oblast",
        country: "Russia",
        country_code: "ru",
      },
      {
        name: "Unzhitsa",
        type: "village",
        class: "place",
        display_name: "Unzhitsa, Shenkursky District, Arkhangelsk Oblast, Russia",
      },
    );

    expect(admin.localityName).toBe("Unzhitsa");
    expect(admin.localityType).toBe("Village");
    expect(admin.district).toBe("Shenkursky District");
    expect(admin.stateOrProvince).toBe("Arkhangelsk Oblast");
    expect(admin.country).toBe("Russia");
  });

  it("formats subtitle and hierarchy fields for remote map picks", () => {
    const place = {
      name: "Unzhitsa",
      categoryLabel: "Village",
      localityName: "Unzhitsa",
      localityType: "Village",
      district: "Shenkursky District",
      state: "Arkhangelsk Oblast",
      country: "Russia",
      city: "Unzhitsa",
      postcode: null,
    };

    expect(formatPlaceHierarchySubtitle(place)).toBe(
      "Village · Shenkursky District · Arkhangelsk Oblast · Russia",
    );
    expect(buildPlaceHierarchyFields(place).map((field) => field.label)).toEqual([
      "Type",
      "District",
      "State / Province",
      "Country",
    ]);
  });

  it("formats distance from user in miles", () => {
    expect(formatDistanceFromUserLabel(804672)).toBe("500 mi from you");
    expect(formatDistanceFromUserLabel(1609)).toMatch(/mi from you/);
  });

  it("uses country as locality when only admin country is known", () => {
    const admin = extractPlaceAdminHierarchy(
      { country: "Greenland", country_code: "gl" },
      { name: "Arctic Ocean", type: "country", class: "place", display_name: "Greenland" },
    );
    expect(admin.localityName).toBe("Greenland");
    expect(admin.localityType).toBe("Territory");
    expect(admin.country).toBe("Greenland");
  });

  it("builds unique hierarchy fields for Nunavut admin regions", () => {
    const admin = extractPlaceAdminHierarchy(
      {
        state_district: "Kitikmeot Region",
        state: "Nunavut",
        country: "Canada",
        country_code: "ca",
      },
      {
        name: "Kitikmeot Region",
        type: "administrative",
        class: "boundary",
        display_name: "Kitikmeot Region, Nunavut, Canada",
      },
    );

    expect(admin.localityName).toBe("Kitikmeot Region");
    expect(admin.localityType).toBe("Region");
    expect(admin.district).toBe("Kitikmeot Region");

    const place = {
      name: "Kitikmeot Region",
      localityName: admin.localityName,
      localityType: admin.localityType,
      district: admin.district,
      state: admin.stateOrProvince,
      country: admin.country,
      city: null,
      postcode: null,
    };

    const fields = buildPlaceHierarchyFields(place);
    const keys = fields.map((field) => `${field.label}-${field.value}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toEqual(["Type-Region", "State / Province-Nunavut", "Country-Canada"]);
  });
});
