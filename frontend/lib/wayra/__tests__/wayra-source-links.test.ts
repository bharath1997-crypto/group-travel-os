import { describe, expect, it } from "vitest";

import {
  parseCoordsFromMapsUrl,
  resolveWayraSourceMapFocus,
  shouldOpenWayraSourceOnLiveMap,
} from "@/lib/wayra/wayra-source-links";

describe("wayra-source-links", () => {
  it("resolves lat/lng from source payload", () => {
    const focus = resolveWayraSourceMapFocus({
      label: "Joe's Diner · 0.4 mi",
      url: "https://www.openstreetmap.org/node/1",
      source_type: "osm",
      lat: 41.88,
      lng: -87.62,
    });
    expect(focus).toEqual({ lat: 41.88, lng: -87.62, name: "Joe's Diner" });
  });

  it("parses google maps coordinate query", () => {
    expect(
      parseCoordsFromMapsUrl(
        "https://www.google.com/maps/search/?api=1&query=41.881,-87.623",
      ),
    ).toEqual({ lat: 41.881, lng: -87.623 });
  });

  it("opens osm/maps sources on live only", () => {
    const source = {
      label: "Cafe · 0.2 mi",
      url: "https://www.openstreetmap.org/node/9",
      source_type: "osm",
      lat: 1,
      lng: 2,
    };
    expect(shouldOpenWayraSourceOnLiveMap(source, true)).toBe(true);
    expect(shouldOpenWayraSourceOnLiveMap(source, false)).toBe(false);
    expect(
      shouldOpenWayraSourceOnLiveMap(
        {
          label: "Wikipedia · Chicago",
          url: "https://en.wikipedia.org/wiki/Chicago",
          source_type: "wikipedia",
        },
        true,
      ),
    ).toBe(false);
  });
});
