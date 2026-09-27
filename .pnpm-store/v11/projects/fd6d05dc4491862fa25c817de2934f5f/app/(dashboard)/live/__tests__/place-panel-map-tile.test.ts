import { describe, expect, it } from "vitest";

import {
  buildMapCropTileUrl,
  resolveMapCropTileTemplate,
  ROVVY_TILE_WORKER_DEFAULT,
} from "../place-panel-map-tile";
import { PLACE_PANEL_FIXTURE_TIER0 } from "../place-panel-fixtures";

describe("place-panel-map-tile", () => {
  it("defaults to Rovvy tile Worker, not OSM", () => {
    expect(resolveMapCropTileTemplate()).toBe(ROVVY_TILE_WORKER_DEFAULT);
    const url = buildMapCropTileUrl(
      PLACE_PANEL_FIXTURE_TIER0.lat,
      PLACE_PANEL_FIXTURE_TIER0.lon,
    );
    expect(url.startsWith("https://tiles.rovvy.app/t/")).toBe(true);
    expect(url).not.toContain("openstreetmap.org");
  });
});
