import type { GroupVoteState } from "./live-group-vote-mock";
import { voteStatusLabel } from "./live-group-vote-mock";

export type LiveVotePanelResponse = {
  pollId: string | null;
  question: string;
  closesAtLabel: string | null;
  memberCount: number;
  options: Array<{
    id: string;
    name: string;
    meta: string;
    voteCount: number;
  }>;
  myOptionId: string | null;
  status: "open" | "closed" | "resolved" | "empty";
};

export function liveVotePanelToGroupVote(panel: LiveVotePanelResponse): GroupVoteState {
  return {
    question: panel.question,
    closesAtLabel: panel.closesAtLabel ?? "Vote open",
    memberCount: panel.memberCount,
    myVoteId: panel.myOptionId,
    options: panel.options.map((option) => ({
      id: option.id,
      name: option.name,
      meta: option.meta,
      voteCount: option.voteCount,
    })),
  };
}

export function liveVoteStatusLabel(myVoteId: string | null, usingRealPoll: boolean): string {
  if (!usingRealPoll) return voteStatusLabel(myVoteId);
  return myVoteId ? "Vote counted on this poll" : "Tap an option to vote once";
}

export function buildCreateVoteOptions(input: {
  selectedPlace?: { name?: string | null; address?: string | null } | null;
  destination?: { name?: string | null; address?: string | null } | null;
}): Array<{ label: string; meta?: string }> {
  const primary = input.selectedPlace?.name?.trim() || input.destination?.name?.trim();
  const secondary = input.destination?.name?.trim();
  const options: Array<{ label: string; meta?: string }> = [];

  if (primary) {
    options.push({
      label: primary,
      meta: input.selectedPlace?.address ?? input.destination?.address ?? "Added from Live",
    });
  }
  if (secondary && secondary !== primary) {
    options.push({
      label: secondary,
      meta: input.destination?.address ?? "Current destination",
    });
  }
  if (options.length < 2) {
    options.push({ label: "Anywhere works", meta: "Flexible pick" });
  }
  if (options.length < 2) {
    options.push({ label: "Stay nearby", meta: "Walkable options" });
  }
  return options.slice(0, 4);
}
