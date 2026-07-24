import { describe, expect, it } from "vitest";

import { filterInstantSuggestions } from "../live-search-suggestions";

describe("filterInstantSuggestions", () => {
  it("shows travel shortcuts by default", () => {
    const items = filterInstantSuggestions("", []);
    const labels = items.map((item) => item.label);
    expect(labels).toContain("Beaches nearby");
    expect(labels).toContain("Ports & harbours nearby");
    expect(labels).toContain("Airports nearby");
    expect(labels).toContain("Coffee nearby");
    expect(labels).toContain("Movie theaters nearby");
  });

  it("surfaces category match when typing port or airport", () => {
    const ports = filterInstantSuggestions("port", []);
    expect(ports[0]?.category).toBe("ports");

    const airports = filterInstantSuggestions("airport", []);
    expect(airports[0]?.category).toBe("airports");

    const beaches = filterInstantSuggestions("beach", []);
    expect(beaches[0]?.category).toBe("beaches");
  });
});
