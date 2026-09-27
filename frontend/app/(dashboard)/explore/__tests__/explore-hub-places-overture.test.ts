import { describe, expect, it } from "vitest";

import {
  explorePlacesQuery,
  placeSourceLabel,
  slotIdentityForPlace,
  uniquePlacesByGersId,
} from "../explore-hub-places-overture";

describe("explore hub Overture places params", () => {
  it("includes selected coordinates and bounded radius in places query", () => {
    const qs = explorePlacesQuery("Chicago", { lat: 41.8781, lng: -87.6298 });
    const params = new URLSearchParams(qs);
    expect(params.get("city")).toBe("Chicago");
    expect(params.get("lat")).toBe("41.8781");
    expect(params.get("lon")).toBe("-87.6298");
    expect(Number(params.get("radius_m"))).toBeLessThanOrEqual(100_000);
    expect(params.get("limit")).toBe("48");
  });

  it("labels Overture rows and dedupes by gers_id", () => {
    const places = uniquePlacesByGersId([
      { id: "a", gers_id: "gers-1", name: "One", source: "overture" },
      { id: "b", gers_id: "gers-1", name: "Dup", source: "overture" },
      { id: "c", gers_id: "gers-2", name: "Two", source: "overture" },
    ]);
    expect(places).toHaveLength(2);
    expect(placeSourceLabel(places[0]!)).toBe("Overture");
    expect(slotIdentityForPlace(places[0]!)).toBe("gers-1");
  });
});
