import { describe, expect, it } from "vitest";

import { presentWikiAbout, wikiAboutEmptyCopy } from "@/app/(dashboard)/live/wiki-about-display";

describe("wiki-about-display", () => {
  it("labels nearby landmark mismatches", () => {
    const view = presentWikiAbout(
      {
        available: true,
        title: "St. Mary of the Angels",
        matchedOn: "nearby",
        approximate: true,
        summary: "A Catholic church in Chicago.",
      },
      "Hyatt Place Chicago/Wicker Park",
      "Chicago",
    );
    expect(view.badge).toBe("Area info");
    expect(view.heading).toContain("Nearby landmark");
    expect(view.disclaimer).toContain("Hyatt Place");
  });

  it("labels exact place matches as verified source", () => {
    const view = presentWikiAbout(
      {
        available: true,
        title: "Millennium Park",
        matchedOn: "place",
        approximate: false,
        summary: "A public park.",
      },
      "Millennium Park",
      "Chicago",
    );
    expect(view.badge).toBe("Verified source");
    expect(view.disclaimer).toBeNull();
  });

  it("empty copy names the pin", () => {
    expect(wikiAboutEmptyCopy("West Cortez Street", "Chicago")).toContain("West Cortez Street");
    expect(wikiAboutEmptyCopy("West Cortez Street", "Chicago")).toContain("Chicago");
  });
});
