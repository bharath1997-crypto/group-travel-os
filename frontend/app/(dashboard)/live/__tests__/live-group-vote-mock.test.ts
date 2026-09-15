import { describe, expect, it } from "vitest";
import {
  applyGroupVote,
  addGroupVoteOption,
  buildDefaultGroupVote,
  buildVoteMapPins,
  buildVoteOpenedNotice,
  voteBarWidthPercent,
} from "../live-group-vote-mock";

describe("live-group-vote-mock", () => {
  it("increments the selected option when the user votes", () => {
    const next = applyGroupVote(buildDefaultGroupVote(), "ramen");
    const ramen = next.options.find((option) => option.id === "ramen");
    expect(next.myVoteId).toBe("ramen");
    expect(ramen?.voteCount).toBe(1);
  });

  it("computes bar width as a share of group size", () => {
    expect(voteBarWidthPercent(3, 6)).toBe(50);
  });

  it("formats the v3 vote-opened notice", () => {
    expect(buildVoteOpenedNotice("Closes 8:00")).toBe("Ana opened a vote — closes at 8:00");
  });

  it("places vote pins at option coordinates when provided", () => {
    const vote = addGroupVoteOption(buildDefaultGroupVote(), {
      id: "coffee",
      name: "Tasa Coffee",
      meta: "Nearby",
      lat: 41.921,
      lng: -87.701,
    });
    const pins = buildVoteMapPins(vote, { lat: 41.9, lng: -87.65 });
    const coffee = pins.find((pin) => pin.id === "coffee");
    expect(coffee?.lat).toBe(41.921);
    expect(coffee?.lng).toBe(-87.701);
  });
});
