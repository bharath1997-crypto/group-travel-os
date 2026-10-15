import { describe, expect, it } from "vitest";

import { buildLiveDirectionsHref, parseLiveDeepLink } from "../live-explore-deeplink";

function queryParam(href: string, key: string): string | null {
  const qs = href.includes("?") ? href.slice(href.indexOf("?") + 1) : "";
  return new URLSearchParams(qs).get(key);
}

const OVERTURE_UUID = "5d1bbd9b-7a0d-4427-ba73-632cc1dc3f84";
const STREET_ADDRESS = "56 W Adams St, Chicago, IL, 60603";

describe("buildLiveDirectionsHref", () => {
  it("builds href with Overture UUID gers_id, coords, name, and address", () => {
    const href = buildLiveDirectionsHref({
      gersId: OVERTURE_UUID,
      lat: 41.881,
      lng: -87.623,
      name: "Center for Native Futures",
      address: STREET_ADDRESS,
    });
    expect(href).toContain("/live?");
    expect(href).toContain(`gers_id=${OVERTURE_UUID}`);
    expect(href).toContain("lat=41.881");
    expect(href).toContain("lng=-87.623");
    expect(href).not.toBeNull();
    expect(queryParam(href!, "name")).toBe("Center for Native Futures");
    expect(queryParam(href!, "address")).toBe(STREET_ADDRESS);
  });

  it("normalizes UUID gers_id to lowercase", () => {
    const href = buildLiveDirectionsHref({
      gersId: "78B4925D-0560-4352-8453-553395500EC6",
      lat: 41.88,
      lng: -87.62,
      name: "Grant Park",
    });
    expect(href).toContain("gers_id=78b4925d-0560-4352-8453-553395500ec6");
  });

  it("omits gers_id when absent or invalid", () => {
    const href = buildLiveDirectionsHref({ lat: 28.54, lng: -81.38, name: "Venue" });
    expect(href).not.toContain("gers_id=");
    expect(href).toMatch(/\/live\?lat=/);
  });

  it("returns null for invalid coordinates", () => {
    expect(buildLiveDirectionsHref({ lat: NaN, lng: 0, name: "X" })).toBeNull();
    expect(buildLiveDirectionsHref({ lat: 91, lng: 0 })).toBeNull();
    expect(buildLiveDirectionsHref({ lat: 0, lng: 200 })).toBeNull();
  });

  it("encodes special characters in name and address", () => {
    const href = buildLiveDirectionsHref({
      lat: 1,
      lng: 2,
      name: "Foo & Bar",
      address: "123 Main St & Co",
    });
    expect(href).not.toBeNull();
    expect(queryParam(href!, "name")).toBe("Foo & Bar");
    expect(queryParam(href!, "address")).toBe("123 Main St & Co");
  });
});

describe("parseLiveDeepLink", () => {
  it("parses valid params including UUID gers_id and address", () => {
    const params = new URLSearchParams(
      `gers_id=${OVERTURE_UUID}&lat=41.88&lng=-87.62&name=Pritzker+Park&address=${encodeURIComponent(STREET_ADDRESS)}`,
    );
    expect(parseLiveDeepLink(params)).toEqual({
      gersId: OVERTURE_UUID,
      lat: 41.88,
      lng: -87.62,
      name: "Pritzker Park",
      address: STREET_ADDRESS,
    });
  });

  it("allows missing gers_id and address", () => {
    const params = new URLSearchParams("lat=28.5&lng=-81.3&name=Event");
    const parsed = parseLiveDeepLink(params);
    expect(parsed?.gersId).toBeNull();
    expect(parsed?.address).toBeNull();
  });

  it("rejects bad numbers and out-of-range", () => {
    expect(parseLiveDeepLink(new URLSearchParams("lat=abc&lng=1"))).toBeNull();
    expect(parseLiveDeepLink(new URLSearchParams("lat=1&lng=abc"))).toBeNull();
    expect(parseLiveDeepLink(new URLSearchParams("lat=999&lng=0"))).toBeNull();
  });

  it("returns null when no handoff params present", () => {
    expect(parseLiveDeepLink(new URLSearchParams(""))).toBeNull();
    expect(parseLiveDeepLink(new URLSearchParams("trip_id=abc"))).toBeNull();
  });
});
