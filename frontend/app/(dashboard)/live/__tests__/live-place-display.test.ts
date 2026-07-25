import { describe, expect, it } from "vitest";
import type { PlacePreviewData } from "../PlacePreviewCard";
import {
  compactRouteConditionLabel,
  formatPlaceSubtitle,
  getPlaceLocationFields,
  shouldShowOpeningHours,
} from "../live-place-display";

function basePlace(overrides: Partial<PlacePreviewData> = {}): PlacePreviewData {
  return {
    name: "North Slope Borough",
    categoryLabel: "Location",
    address: "",
    phone: null,
    lat: 68,
    lng: -153,
    distanceM: 5000000,
    openingHours: null,
    openStatus: null,
    city: "North Slope Borough",
    state: "Alaska",
    country: "United States",
    ...overrides,
  };
}

describe("live-place-display", () => {
  it("formats subtitle with type and region", () => {
    expect(formatPlaceSubtitle(basePlace())).toBe("Borough · Alaska, United States");
  });

  it("hides duplicate borough from location fields", () => {
    const fields = getPlaceLocationFields(basePlace());
    expect(fields.find((field) => field.label === "City")).toBeUndefined();
    expect(fields.find((field) => field.label === "Region")?.value).toBe("Alaska");
  });

  it("labels county-like admin areas as Borough", () => {
    const fields = getPlaceLocationFields(
      basePlace({
        name: "Anchorage",
        city: "Anchorage Borough",
        categoryLabel: "City",
      }),
    );
    expect(fields.find((field) => field.label === "Borough")?.value).toBe("Anchorage Borough");
  });

  it("omits hours for wilderness admin areas", () => {
    expect(shouldShowOpeningHours(basePlace())).toBe(false);
    expect(shouldShowOpeningHours(basePlace({ categoryLabel: "Restaurant" }))).toBe(true);
  });

  it("uses compact route warning labels", () => {
    expect(
      compactRouteConditionLabel({
        lastMileMode: "walk",
        lastMileNotice: "Driving ends at the nearest road. Walk about 322 mi...",
      }),
    ).toBe("Off-road access required");
    expect(
      compactRouteConditionLabel({ borderNotice: "You may cross into Canada." }),
    ).toBe("Border crossing on route");
  });
});
