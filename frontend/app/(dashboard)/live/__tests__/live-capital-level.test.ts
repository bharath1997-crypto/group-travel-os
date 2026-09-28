import { describe, expect, it } from "vitest";
import {
  capitalLevelsVisibleAtZoom,
  parseOsmCapitalLevel,
  resolveCapitalCategoryLabel,
} from "../live-capital-level";

describe("live-capital-level", () => {
  it("parses OSM capital tags", () => {
    expect(parseOsmCapitalLevel({ capital: "yes" })).toBe(2);
    expect(parseOsmCapitalLevel({ capital: "4" })).toBe(4);
    expect(parseOsmCapitalLevel({ capital: "6" })).toBe(6);
  });

  it("labels national vs province vs state", () => {
    expect(resolveCapitalCategoryLabel({ capital: "yes", name: "Ottawa" })).toBe(
      "National capital",
    );
    expect(
      resolveCapitalCategoryLabel({ capital: "4", "addr:country": "US", name: "Topeka" }),
    ).toBe("State capital");
    expect(
      resolveCapitalCategoryLabel({ capital: "4", "addr:country": "CA", name: "Toronto" }),
    ).toBe("Province capital");
  });

  it("reveals finer capitals as zoom increases", () => {
    expect(capitalLevelsVisibleAtZoom(8).has(4)).toBe(false);
    expect(capitalLevelsVisibleAtZoom(11).has(4)).toBe(true);
    expect(capitalLevelsVisibleAtZoom(11).has(6)).toBe(false);
    expect(capitalLevelsVisibleAtZoom(13).has(6)).toBe(true);
  });
});
