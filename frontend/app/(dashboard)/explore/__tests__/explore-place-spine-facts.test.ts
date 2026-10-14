import { describe, expect, it } from "vitest";

import {
  factByKey,
  firstParagraph,
  mergeHoursFromFacts,
} from "../explore-place-spine-facts";

describe("explore-place-spine-facts", () => {
  it("firstParagraph keeps only the opening paragraph", () => {
    expect(firstParagraph("One.\n\nTwo.")).toBe("One.");
  });

  it("mergeHoursFromFacts prefers listing hours over OSM facts", () => {
    const merged = mergeHoursFromFacts("Mon 9–5", "overture", [
      {
        key: "opening_hours",
        value: "24/7",
        source: "osm",
        license: "ODbL",
        attribution: "© OpenStreetMap contributors",
      },
    ]);
    expect(merged.openingHours).toBe("Mon 9–5");
    expect(merged.osmCredit).toBeNull();
  });

  it("mergeHoursFromFacts uses OSM when listing has no hours", () => {
    const merged = mergeHoursFromFacts(null, null, [
      {
        key: "opening_hours",
        value: "Mo-Fr 09:00-17:00",
        source: "osm",
        license: "ODbL",
        attribution: "© OpenStreetMap contributors",
      },
    ]);
    expect(merged.openingHours).toBe("Mo-Fr 09:00-17:00");
    expect(merged.hoursSource).toBe("openstreetmap");
    expect(merged.osmCredit).toContain("OpenStreetMap");
  });

  it("factByKey finds extract", () => {
    const fact = factByKey(
      [{ key: "extract", value: "Text", source: "wikipedia", license: "CC BY-SA 4.0", attribution: "Wikipedia" }],
      "extract",
    );
    expect(fact?.value).toBe("Text");
  });
});
