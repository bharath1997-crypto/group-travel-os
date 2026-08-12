import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  findLiveSavedPlaceMatch,
  listLiveSavedPlaces,
  saveLivePlaceFromPreview,
} from "../live-saved-places-store";
import type { PlacePreviewData } from "../PlacePreviewCard";

vi.stubGlobal("window", { dispatchEvent: vi.fn() });
vi.stubGlobal(
  "localStorage",
  (() => {
    let store: Record<string, string> = {};
    return {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        store = {};
      },
    };
  })(),
);

const samplePlace = (): PlacePreviewData => ({
  name: "Big Horn County",
  categoryLabel: "County",
  address: "Montana, US",
  phone: null,
  lat: 45.73938,
  lng: -107.59441,
  distanceM: 1_900_000,
  openingHours: null,
  openStatus: null,
  placeKey: "test-place-key",
});

describe("live-saved-places-store", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("saves a place locally without server calls", () => {
    const saved = saveLivePlaceFromPreview(samplePlace());
    expect(saved.id).toBeTruthy();
    expect(listLiveSavedPlaces()).toHaveLength(1);
    expect(listLiveSavedPlaces()[0].name).toBe("Big Horn County");
  });

  it("matches existing save by placeKey and coordinates", () => {
    const first = saveLivePlaceFromPreview(samplePlace());
    const second = saveLivePlaceFromPreview({
      ...samplePlace(),
      name: "Big Horn County, Montana",
    });
    expect(second.id).toBe(first.id);
    expect(listLiveSavedPlaces()).toHaveLength(1);
    expect(findLiveSavedPlaceMatch(45.7394, -107.5944, "test-place-key")?.id).toBe(first.id);
  });
});
