import { describe, expect, it } from "vitest";
import {
  buildSkyscannerSearchUrl,
  buildTravelHandoffPath,
  parseTravelHandoff,
  resolveTravelIata,
  travelHandoffSearchLabel,
} from "@/lib/travel-handoff";

describe("travel-handoff", () => {
  it("parses Live map query params", () => {
    const params = new URLSearchParams(
      "dest=Rajupala%2C%20Guntur&destCity=Guntur&destCountry=India&destLat=16.07&destLng=80.25&origin=Chicago&originCountry=United%20States",
    );
    const handoff = parseTravelHandoff(params);
    expect(handoff).not.toBeNull();
    expect(handoff?.destination.name).toContain("Rajupala");
    expect(handoff?.originIata).toBe("CHI");
    expect(handoff?.destinationIata).toBe("VGA");
  });

  it("resolves Hyderabad for flight search", () => {
    expect(resolveTravelIata("Hyderabad, India")).toBe("HYD");
  });

  it("builds travel handoff path for flights", () => {
    const path = buildTravelHandoffPath(
      "flights",
      {
        name: "Rajupala",
        city: "Guntur",
        country: "India",
        lat: 16.07,
        lng: 80.25,
      },
      { name: "Chicago", country: "United States" },
    );
    expect(path).toContain("/flights?");
    expect(path).toContain("dest=Rajupala");
    expect(path).toContain("origin=Chicago");
  });

  it("builds public Skyscanner URL without affiliate env", () => {
    const handoff = parseTravelHandoff(
      new URLSearchParams("dest=Hyderabad&origin=Chicago&destCountry=India"),
    );
    const url = buildSkyscannerSearchUrl(handoff, "2026-09-01");
    expect(url).toContain("skyscanner.net/transport/flights/chi/hyd/2026-09-01");
  });

  it("formats ground search labels from handoff places", () => {
    expect(
      travelHandoffSearchLabel({ name: "Pennandipadu", city: "Guntur", country: "India" }),
    ).toBe("Guntur, India");
  });
});
