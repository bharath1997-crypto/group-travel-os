import { describe, expect, it } from "vitest";

import {
  classifyMode,
  isLiveMapContextQuestion,
  isLivePlaceDeepQuestion,
  isLiveTravelPrepQuestion,
  resolveAppGuideReply,
  resolveLiveMapContextReply,
  resolveLiveTravelPrepReply,
} from "@/lib/wayra/intent";

const liveContext = {
  pathname: "/live",
  selectedPlace: {
    name: "Dropped pin",
    lat: 49.90511,
    lng: -116.8219,
    category: null,
  },
  liveStage: "place_preview",
};

describe("live map context replies", () => {
  it("detects pick-location questions", () => {
    expect(isLiveMapContextQuestion("What location did I pick over there?")).toBe(
      true,
    );
    expect(
      isLiveMapContextQuestion("I just want to know about the pick location"),
    ).toBe(true);
    expect(isLiveMapContextQuestion("How do I create a group?")).toBe(false);
  });

  it("answers using selectedPlace on live page", () => {
    const reply = resolveLiveMapContextReply(
      "What location did I pick?",
      "live",
      liveContext,
    );
    expect(reply).toContain("Dropped pin");
    expect(reply).toContain("49.90511");
    expect(reply).toContain("116.8219");
    expect(reply?.toLowerCase()).not.toContain("travel hub");
  });

  it("does not treat Rovvy Live trip prep as app guide live_map", () => {
    const prompt =
      "I'm planning a trip to Dehcho Region on Rovvy Live. Here are the tips and warnings I see:\n- Far from your current area.\n\nWhat should I know and how should I prepare?";
    expect(resolveAppGuideReply(prompt)).toBeNull();
    expect(isLiveTravelPrepQuestion(prompt)).toBe(true);
  });

  it("builds offline prep reply from route context", () => {
    const reply = resolveLiveTravelPrepReply(
      "What should I know and how should I prepare?",
      "live",
      {
        pathname: "/live",
        selectedPlace: { name: "Dehcho Region", lat: 61.58, lng: -121.81 },
        aiSuggestions: [{ message: "Far from your current area.", kind: "tip" }],
        routePreview: {
          durationSeconds: 54 * 3600,
          distanceMeters: 3987000,
          borderNotice: "Cross-border travel.",
        },
      },
    );
    expect(reply).toContain("Dehcho Region");
    expect(reply).toContain("Far from your current area");
    expect(reply?.toLowerCase()).not.toContain("travel hub");
  });

  it("sends rich location questions to the LLM not the coordinate stub", () => {
    const msg = `I just want to know about this location properly.
- What is this location?
- What do people use to do?
- What is the language?
- What is the culture?`;
    expect(isLivePlaceDeepQuestion(msg)).toBe(true);
    expect(resolveLiveMapContextReply(msg, "live", {
      pathname: "/live",
      selectedPlace: { name: "Dropped pin", lat: 31.66156, lng: 106.07001 },
    })).toBeNull();
  });

  it("still answers narrow pin identity questions locally", () => {
    const reply = resolveLiveMapContextReply("What location did I pick?", "live", {
      pathname: "/live",
      selectedPlace: { name: "Dropped pin", lat: 31.66, lng: 106.07 },
    });
    expect(reply).toContain("Dropped pin");
    expect(reply).toContain("31.66");
  });

  it("treats what's special out there as a travel question", () => {
    expect(isLivePlaceDeepQuestion("What is the special out there?")).toBe(true);
    expect(classifyMode("What is the special out there?")).toBe("travel");
  });
});
