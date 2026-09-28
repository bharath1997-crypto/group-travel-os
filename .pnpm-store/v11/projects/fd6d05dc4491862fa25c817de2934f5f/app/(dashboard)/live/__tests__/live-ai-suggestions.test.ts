import { describe, expect, it } from "vitest";
import { buildRoutePreviewAiSuggestions } from "../live-ai-suggestions";

describe("buildRoutePreviewAiSuggestions", () => {
  it("returns empty list when no signals", () => {
    expect(buildRoutePreviewAiSuggestions({ destinationName: "Test" })).toEqual([]);
  });

  it("includes far, last-mile, and border suggestions with kinds", () => {
    const items = buildRoutePreviewAiSuggestions({
      destinationName: "Northwest Arctic Borough",
      farFromUser: true,
      lastMileNotice: "Walk about 11 mi to reach this exact location.",
      borderNotice: "You may cross into Canada.",
    });

    expect(items.map((i) => i.id)).toEqual(["far", "last-mile", "border"]);
    expect(items[0].kind).toBe("tip");
    expect(items[1].kind).toBe("warning");
    expect(items[0].askPrompt).toContain("Northwest Arctic Borough");
  });

  it("includes route error and GPS warnings", () => {
    const items = buildRoutePreviewAiSuggestions({
      destinationName: "Slater Park Road",
      lowGps: true,
      routeError: "No route found",
    });

    expect(items.map((i) => i.id)).toEqual(["gps", "route-error"]);
    expect(items.every((item) => item.kind === "warning")).toBe(true);
  });
});
