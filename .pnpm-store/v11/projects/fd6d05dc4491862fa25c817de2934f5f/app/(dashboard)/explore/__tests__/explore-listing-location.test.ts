import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readdirSync, statSync } from "node:fs";

import {
  cleanListingLocationComponent,
  formatEventListingBody,
  formatEventListingDescription,
  formatEventListingSummary,
  formatListingLocationDisplay,
  formatMapsSearchQuery,
  joinExploreMetaParts,
} from "../explore-listing-location";

const badProse = /\b(at undefined|null|for undefined|null|at \.|for \.|at None|for None)\b/i;

describe("explore-listing-location", () => {
  it("formats valid city, state, and country", () => {
    expect(
      formatListingLocationDisplay({ city: "Chicago", state: "IL", country: "US" }),
    ).toBe("Chicago · IL · US");
    expect(formatListingLocationDisplay({ city: "Chicago", state: "IL" })).toBe("Chicago · IL");
    expect(formatListingLocationDisplay({ city: "Chicago" })).toBe("Chicago");
  });

  it("omits country-only when city is missing", () => {
    expect(formatListingLocationDisplay({ country: "US" })).toBeUndefined();
    expect(formatListingLocationDisplay({ city: "  ", country: "US" })).toBeUndefined();
  });

  it("treats literal null and whitespace as missing", () => {
    expect(formatListingLocationDisplay({ city: "null", country: "US" })).toBeUndefined();
    expect(formatListingLocationDisplay({ city: "NULL", state: "undefined" })).toBeUndefined();
    expect(cleanListingLocationComponent("  None  ")).toBeNull();
    expect(cleanListingLocationComponent("  Austin  ")).toBe("Austin");
  });

  it("dedupes duplicate components case-insensitively", () => {
    expect(
      formatListingLocationDisplay({ city: "Chicago", state: "Chicago", country: "US" }),
    ).toBe("Chicago · US");
  });

  it("never leaves dangling separators in meta joins", () => {
    expect(joinExploreMetaParts("Sat 9 PM", undefined, "Music")).toBe("Sat 9 PM · Music");
    expect(joinExploreMetaParts("", "  ", "null")).toBe("");
    expect(
      formatEventListingSummary({ venue: "Venue Hall", city: "", country: "US", title: "Show" }),
    ).toBe("Venue Hall");
  });

  it("builds drawer body prose without at/for when location is missing or literal-null", () => {
    const missing = formatEventListingBody({
      name: "Jazz Night",
      category: "Music",
      provider: "Ticketmaster",
      editorial: false,
      venue: "null",
      city: "undefined",
      title: "Jazz Night",
    });
    expect(missing).toBe("Jazz Night. Music. Listed via Ticketmaster.");
    expect(missing).not.toMatch(badProse);

    const editorialNull = formatEventListingBody({
      name: "Fest Idea",
      category: "Festival",
      provider: "Editorial suggestion",
      editorial: true,
      city: "None",
      title: "Fest Idea",
    });
    expect(editorialNull).toBe("Fest Idea — editorial suggestion. Not verified live inventory.");
    expect(editorialNull).not.toMatch(/for None/i);

    const valid = formatEventListingBody({
      name: "Blues Show",
      category: "Music",
      provider: "Ticketmaster",
      editorial: false,
      venue: "Green Mill",
      city: "Chicago",
      state: "IL",
      title: "Blues Show",
    });
    expect(valid).toContain("at Green Mill · Chicago · IL");
    expect(valid).toContain("Listed via Ticketmaster");
  });

  it("builds description prose and maps query from sanitized fields", () => {
    expect(
      formatEventListingDescription({
        name: "Show",
        category: "Music",
        venue: "undefined",
        city: "null",
        title: "Show",
      }),
    ).toBe("Show. Music.");

    expect(formatMapsSearchQuery({ venue: "undefined", city: "null" })).toBe("");
    expect(
      formatMapsSearchQuery({ venue: "Green Mill", city: "Chicago", state: "IL" }),
    ).toBe("Green Mill · Chicago · IL");
  });

  it("regression: no unsafe listing location interpolation in display prose", () => {
    const root = join(process.cwd(), "app/(dashboard)/explore");
    const offenders: string[] = [];
    const unsafePatterns: RegExp[] = [
      /at \$\{event\.(venue|city)/,
      /for \$\{event\.city/,
      /\$\{event\.venue \|\| event\.city\}/,
      /encodeURIComponent\(`\$\{event\.venue\}\s*\$\{event\.city\}`\)/,
      /`\s*,\s*\$\{event\.state\}/,
      /— editorial suggestion for \$\{/,
    ];

    function walk(dir: string) {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) {
          if (name === "__tests__") continue;
          walk(path);
          continue;
        }
        if (!/\.(tsx|ts)$/.test(name)) continue;
        if (name === "explore-listing-location.ts") continue;
        if (name.includes("hero-location") || name.includes("location-scope")) continue;
        if (name.includes("location-catalog") || name.includes("LocationSearch")) continue;
        const src = readFileSync(path, "utf8");
        for (const pattern of unsafePatterns) {
          if (pattern.test(src)) {
            offenders.push(`${path}: ${pattern.source}`);
          }
        }
      }
    }
    walk(root);
    expect(offenders).toEqual([]);
  });
});
