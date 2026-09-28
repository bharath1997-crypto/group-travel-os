import { describe, expect, it } from "vitest";
import {
  buildCreateVoteOptions,
  liveVotePanelToGroupVote,
} from "../live-group-vote";

describe("live-group-vote", () => {
  it("maps API vote panels into Live group vote state", () => {
    const vote = liveVotePanelToGroupVote({
      pollId: "poll-1",
      question: "Where are we eating?",
      closesAtLabel: "Closes 8:00",
      memberCount: 6,
      myOptionId: "opt-1",
      status: "open",
      options: [
        { id: "opt-1", name: "Fulton Kitchen", meta: "7:00", voteCount: 2 },
        { id: "opt-2", name: "Taco crawl", meta: "1:00", voteCount: 1 },
      ],
    });

    expect(vote.myVoteId).toBe("opt-1");
    expect(vote.options).toHaveLength(2);
  });

  it("builds at least two create options from Live places", () => {
    const options = buildCreateVoteOptions({
      selectedPlace: { name: "Fulton Kitchen", address: "Chicago" },
      destination: { name: "Union Station", address: "Chicago" },
    });

    expect(options.length).toBeGreaterThanOrEqual(2);
  });
});
