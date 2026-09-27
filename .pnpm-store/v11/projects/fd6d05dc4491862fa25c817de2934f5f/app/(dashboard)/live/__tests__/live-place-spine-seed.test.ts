import { describe, expect, it } from "vitest";

import type { PlacePreviewData } from "../live-place-preview-data";
import {
  isSpineGersId,
  placePreviewToPlacePanelPreview,
  placePreviewToPlaceSeed,
  readSpineGersId,
} from "../live-place-spine-seed";

describe("live-place-spine-seed", () => {
  it("builds seed for Overture picks with spine gers_id", () => {
    const place: PlacePreviewData = {
      name: "Lumen",
      categoryLabel: "Wine bar",
      address: "845 W Randolph",
      phone: null,
      lat: 41.88,
      lng: -87.63,
      distanceM: 1200,
      openingHours: null,
      openStatus: null,
      tags: { gers_id: "08f2664a1c2b3d4e5f6789012345678", category: "wine_bar" },
    };
    const seed = placePreviewToPlaceSeed(place);
    expect(seed.gers_id).toBe("08f2664a1c2b3d4e5f6789012345678");
    expect(seed.category).toBe("wine_bar");
    expect(isSpineGersId(seed.gers_id)).toBe(true);
  });

  it("builds local seed for OSM-only picks", () => {
    const place: PlacePreviewData = {
      name: "Shell Gas",
      categoryLabel: "Gas station",
      address: "",
      phone: null,
      lat: 41.91,
      lng: -87.68,
      distanceM: null,
      openingHours: null,
      openStatus: null,
      placeKey: "osm:node:123",
      tags: { amenity: "fuel" },
    };
    const seed = placePreviewToPlaceSeed(place);
    expect(seed.gers_id).toBe("local:osm:node:123");
    expect(readSpineGersId(place.tags)).toBeNull();
    expect(isSpineGersId(seed.gers_id)).toBe(false);
  });

  it("maps preview address into PlacePanel preview fields", () => {
    const place: PlacePreviewData = {
      name: "2929 West Armitage Avenue",
      categoryLabel: "Address",
      address: "2929 West Armitage Avenue, Chicago, IL 60647",
      phone: null,
      lat: 41.91725,
      lng: -87.70087,
      distanceM: 400,
      openingHours: null,
      openStatus: null,
      source: "nominatim",
    };
    const preview = placePreviewToPlacePanelPreview(place);
    expect(preview.address).toBe("2929 West Armitage Avenue, Chicago, IL 60647");
    expect(preview.name).toBe("2929 West Armitage Avenue");
  });

  it("drops raw highway category labels", () => {
    const place: PlacePreviewData = {
      name: "West Fullerton Avenue",
      categoryLabel: "Secondary",
      address: "",
      phone: null,
      lat: 41.91,
      lng: -87.68,
      distanceM: null,
      openingHours: null,
      openStatus: null,
      tags: { highway: "secondary" },
    };
    const seed = placePreviewToPlaceSeed(place);
    expect(seed.category_label).toBe("Place");
  });
});
