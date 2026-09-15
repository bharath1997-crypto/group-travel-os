import { describe, expect, it } from "vitest";

import {
  buildFollowUpPrompts,
  classifyFollowUpCategory,
  materializeFollowUpChip,
} from "@/lib/wayra/follow-up-prompts";

describe("follow-up-prompts", () => {
  it("classifies place-at chip questions", () => {
    expect(classifyFollowUpCategory("What's at Kitikmeot Region?")).toBe("place_at");
  });

  it("materializes named place chips", () => {
    expect(
      materializeFollowUpChip("What's at {place}?", "Inuvialuit Settlement Region"),
    ).toBe("What's at Inuvialuit Settlement Region?");
  });

  it("materializes deictic chips when no place name", () => {
    expect(materializeFollowUpChip("How far is {place} from me?", null)).toBe(
      "How far is this from me?",
    );
  });

  it("suggests related follow-ups after place-at question", () => {
    const chips = buildFollowUpPrompts({
      lastUserMessage: "What's at Inuvialuit Settlement Region?",
      placeName: "Inuvialuit Settlement Region",
      onLive: true,
    });
    expect(chips.length).toBe(3);
    expect(chips.some((c) => /culture|do|food/i.test(c))).toBe(true);
    expect(chips).not.toContain("What's at Inuvialuit Settlement Region?");
  });

  it("returns initial live chips for tap brief", () => {
    const chips = buildFollowUpPrompts({
      placeName: "Dehcho Region",
      onLive: true,
    });
    expect(chips[0]).toContain("Dehcho Region");
    expect(chips).toContain("How far is Dehcho Region from me?");
    expect(chips).toContain("What should I prepare for this trip?");
  });
});
