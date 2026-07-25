import { describe, expect, it } from "vitest";

import {
  buildLiveImplicitContextBlock,
  buildLiveMapTapBrief,
  liveQuickPromptsForPlace,
  withLiveImplicitContext,
} from "@/lib/wayra/live-map-context";

describe("live-map-context", () => {
  const ctx = {
    pathname: "/live",
    liveStage: "place_preview",
    selectedPlace: {
      name: "Dehcho Region",
      lat: 61.58256,
      lng: -121.81618,
      address: "Northwest Territories",
    },
    aiSuggestions: [{ message: "Far from your current area.", kind: "tip" }],
    routePreview: {
      durationSeconds: 54 * 3600,
      distanceMeters: 3987000,
      borderNotice: "Cross-border travel.",
    },
  };

  it("builds implicit LLM context block", () => {
    const block = buildLiveImplicitContextBlock(ctx);
    expect(block).toContain("Dehcho Region");
    expect(block).toContain("61.58256");
    expect(block).toContain("Far from your current area");
    expect(block).toContain("culture, language");
  });

  it("merges implicit flags into API context", () => {
    const merged = withLiveImplicitContext("live", ctx);
    expect(merged.implicitLocation).toBe(true);
    expect(merged.liveContextBlock).toContain("ACTIVE MAP PIN");
  });

  it("builds local tap brief without LLM", () => {
    const brief = buildLiveMapTapBrief(ctx);
    expect(brief).toContain("Dehcho Region");
    expect(brief).toContain("Ask me");
  });

  it("customizes quick prompts for active pin", () => {
    expect(liveQuickPromptsForPlace("Dehcho Region")[0]).toContain("Dehcho Region");
  });
});
