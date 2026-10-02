import { describe, expect, it } from "vitest";

import { exploreDirectionsUrl, explorePhoneHref } from "../explore-place-actions";

describe("exploreDirectionsUrl", () => {
  it("uses the pin when coordinates exist", () => {
    expect(exploreDirectionsUrl({ lat: 41.875, lng: -87.627, name: "Pritzker Park" })).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=41.875%2C-87.627",
    );
  });

  it("falls back to name + address without a pin", () => {
    expect(exploreDirectionsUrl({ name: "Pritzker Park", address: "547 S State St, Chicago, IL" })).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=Pritzker%20Park%2C%20547%20S%20State%20St%2C%20Chicago%2C%20IL",
    );
  });

  it("returns null when neither a pin nor an address is known", () => {
    expect(exploreDirectionsUrl({ name: "Somewhere" })).toBeNull();
  });
});

describe("explorePhoneHref", () => {
  it("builds a dialable tel: link", () => {
    expect(explorePhoneHref("+1 (312) 555-0100")).toBe("tel:+13125550100");
  });

  it("rejects missing or too-short numbers", () => {
    expect(explorePhoneHref(null)).toBeNull();
    expect(explorePhoneHref("ext 12")).toBeNull();
  });
});
