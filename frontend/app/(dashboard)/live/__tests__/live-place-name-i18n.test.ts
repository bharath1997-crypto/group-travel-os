import { describe, expect, it } from "vitest";
import { applyPlaceNameDisplay } from "../live-place-name-i18n";
import {
  isMostlyLatinPlaceName,
  transliteratePlaceNameToLatin,
} from "../live-place-transliteration";
import type { PlacePreviewData } from "../PlacePreviewCard";

const basePlace: PlacePreviewData = {
  name: "Обход п. Октябрьский",
  categoryLabel: "Place",
  address: "Moscow Oblast",
  phone: null,
  lat: 55.61,
  lng: 38.0,
  distanceM: null,
  openingHours: null,
  openStatus: null,
  country: "Russia",
};

describe("isMostlyLatinPlaceName", () => {
  it("treats Cyrillic names as non-Latin", () => {
    expect(isMostlyLatinPlaceName("Обход п. Октябрьский")).toBe(false);
  });

  it("treats English names as Latin", () => {
    expect(isMostlyLatinPlaceName("Central Park")).toBe(true);
  });
});

describe("transliteratePlaceNameToLatin", () => {
  it("converts Cyrillic to readable Latin letters without translating meaning", () => {
    const latin = transliteratePlaceNameToLatin("Обход п. Октябрьский");
    expect(latin).toBeTruthy();
    expect(latin!.startsWith("Obkhod")).toBe(true);
    expect(latin).toContain("Oktyabr");
    expect(latin).not.toContain("Bypass");
  });
});

describe("applyPlaceNameDisplay", () => {
  it("applies Latin spelling and Russian badge metadata", () => {
    const updated = applyPlaceNameDisplay(basePlace, {
      displayName: "Obkhod p. Oktyabrskiy",
      originalName: "Обход п. Октябрьский",
      sourceLanguageLabel: "Russian",
      sourceLanguageCode: "ru",
      translated: true,
    });

    expect(updated.name).toBe("Obkhod p. Oktyabrskiy");
    expect(updated.nameOriginal).toBe("Обход п. Октябрьский");
    expect(updated.nameSourceLanguage).toBe("Russian");
    expect(updated.nameTranslated).toBe(true);
  });

  it("leaves English names unchanged", () => {
    const english = { ...basePlace, name: "Central Park" };
    const updated = applyPlaceNameDisplay(english, {
      displayName: "Central Park",
      translated: false,
    });
    expect(updated).toEqual(english);
  });
});
