import { describe, expect, it } from "vitest";

import { buildLiveDirectionsHref, parseLiveDeepLink } from "../live-explore-deeplink";

function queryParam(href: string, key: string): string | null {
  const qs = href.includes("?") ? href.slice(href.indexOf("?") + 1) : "";
  return new URLSearchParams(qs).get(key);
}

describe("buildLiveDirectionsHref", () => {
  it("builds href with gers_id, coords, and encoded name", () => {
    const href = buildLiveDirectionsHref({
      gersId: "08f2664a1c2b3d4e5f6789012345678",
      lat: 41.881,
      lng: -87.623,
      name: "Center for Native Futures",
    });
    expect(href).toContain("/live?");
    expect(href).toContain("gers_id=08f2664a1c2b3d4e5f6789012345678");
    expect(href).toContain("lat=41.881");
    expect(href).toContain("lng=-87.623");
    expect(href).not.toBeNull();
    expect(queryParam(href!, "name")).toBe("Center for Native Futures");
  });

  it("includes Overture UUID gers_id", () => {
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

  it("encodes special characters in name", () => {
    const href = buildLiveDirectionsHref({ lat: 1, lng: 2, name: "Foo & Bar" });
    expect(href).not.toBeNull();
    expect(queryParam(href!, "name")).toBe("Foo & Bar");
  });
});

describe("parseLiveDeepLink", () => {
  it("parses valid params", () => {
    const params = new URLSearchParams(
      "gers_id=08f2664a1c2b3d4e5f6789012345678&lat=41.88&lng=-87.62&name=Pritzker+Park",
    );
    expect(parseLiveDeepLink(params)).toEqual({
      gersId: "08f2664a1c2b3d4e5f6789012345678",
      lat: 41.88,
      lng: -87.62,
      name: "Pritzker Park",
    });
  });

  it("allows missing gers_id", () => {
    const params = new URLSearchParams("lat=28.5&lng=-81.3&name=Event");
    expect(parseLiveDeepLink(params)?.gersId).toBeNull();
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
