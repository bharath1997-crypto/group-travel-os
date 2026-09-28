export type GroupVoteOption = {
  id: string;
  name: string;
  meta: string;
  voteCount: number;
  voterInitials?: string[];
  lat?: number;
  lng?: number;
};

export type GroupVoteState = {
  question: string;
  closesAtLabel: string;
  memberCount: number;
  options: GroupVoteOption[];
  myVoteId: string | null;
};

export function buildDefaultGroupVote(): GroupVoteState {
  return {
    question: "Where are we eating?",
    closesAtLabel: "Closes 8:00",
    memberCount: 6,
    myVoteId: null,
    options: [
      {
        id: "fulton",
        name: "Fulton Kitchen",
        meta: "7:00 · 2.6 mi · $32 ea",
        voteCount: 3,
        voterInitials: ["AR", "TK", "SM"],
      },
      {
        id: "tacos",
        name: "Taco crawl, Pilsen",
        meta: "1:00 · 4.0 mi · ~$28 ea",
        voteCount: 1,
        voterInitials: ["JP"],
      },
      {
        id: "ramen",
        name: "Ramen counter",
        meta: "6:30 · walk-in · $18 ea",
        voteCount: 0,
      },
    ],
  };
}

export function voteTotalVoted(state: GroupVoteState): number {
  const sum = state.options.reduce((total, option) => total + option.voteCount, 0);
  if (state.myVoteId) {
    return sum;
  }
  return sum;
}

/** Distinct voters approximated from counts for mock display. */
export function voteDistinctVoted(state: GroupVoteState): number {
  return Math.min(state.memberCount, voteTotalVoted(state));
}

export function voteBarWidthPercent(voteCount: number, memberCount: number): number {
  if (memberCount <= 0) return 0;
  return Math.round((voteCount / memberCount) * 100);
}

export function voteStatusLabel(myVoteId: string | null): string {
  return myVoteId ? "Vote counted — change any time" : "Tap an option to vote";
}

/** v3 mock copy for the map notice when a group vote opens. */
export function buildVoteOpenedNotice(closesAtLabel: string): string {
  const normalized = closesAtLabel.trim();
  if (/^closes/i.test(normalized)) {
    return `Ana opened a vote — ${normalized.replace(/^Closes\s/i, "closes at ")}`;
  }
  return `Ana opened a vote — closes at ${normalized}`;
}

export function applyGroupVote(state: GroupVoteState, optionId: string): GroupVoteState {
  if (state.myVoteId === optionId) return state;

  const options = state.options.map((option) => {
    let voteCount = option.voteCount;
    if (state.myVoteId === option.id) {
      voteCount = Math.max(0, voteCount - 1);
    }
    if (option.id === optionId) {
      voteCount += 1;
    }
    return { ...option, voteCount };
  });

  return {
    ...state,
    myVoteId: optionId,
    options,
  };
}

export function buildVoteMapPins(
  vote: GroupVoteState,
  anchor: { lat: number; lng: number },
): Array<{
  id: string;
  name: string;
  voteCount: number;
  lat: number;
  lng: number;
  leading: boolean;
}> {
  const offsets: Record<string, [number, number]> = {
    fulton: [0.008, 0.012],
    tacos: [-0.006, 0.018],
    ramen: [0.014, -0.01],
  };

  const leading = vote.options.reduce<(typeof vote.options)[number] | null>((best, option) => {
    if (!best || option.voteCount > best.voteCount) return option;
    return best;
  }, null);

  return vote.options.map((option, index) => {
    const fallbackOffset: [number, number] = [0.004 * (index + 1), 0.006 * (index + 1)];
    const [latOffset, lngOffset] = offsets[option.id] ?? fallbackOffset;
    const hasCoords =
      typeof option.lat === "number" &&
      typeof option.lng === "number" &&
      Number.isFinite(option.lat) &&
      Number.isFinite(option.lng);
    return {
      id: option.id,
      name: option.name,
      voteCount: option.voteCount,
      lat: hasCoords ? option.lat! : anchor.lat + latOffset,
      lng: hasCoords ? option.lng! : anchor.lng + lngOffset,
      leading: Boolean(leading && leading.voteCount > 0 && leading.id === option.id),
    };
  });
}

export function addGroupVoteOption(
  state: GroupVoteState,
  input: { id: string; name: string; meta?: string; lat?: number; lng?: number },
): GroupVoteState {
  if (state.options.some((option) => option.id === input.id)) {
    return state;
  }
  return {
    ...state,
    options: [
      ...state.options,
      {
        id: input.id,
        name: input.name,
        meta: input.meta ?? "Added from map",
        voteCount: 0,
        lat: input.lat,
        lng: input.lng,
      },
    ],
  };
}
