"use client";

import { useCallback, useEffect, useState } from "react";
import type { GroupVoteState } from "./live-group-vote-mock";
import { liveVotePanelToGroupVote, type LiveVotePanelResponse } from "./live-group-vote";
import {
  castLivePollVote,
  createLiveVotePoll,
  fetchLiveVotePanel,
} from "./live-group-vote-network";

type UseLiveGroupVoteOptions = {
  enabled: boolean;
  tripId: string | null;
};

export function useLiveGroupVote(options: UseLiveGroupVoteOptions) {
  const { enabled, tripId } = options;
  const usingRealPoll = enabled && Boolean(tripId);

  const [pollId, setPollId] = useState<string | null>(null);
  const [vote, setVote] = useState<GroupVoteState | null>(null);
  const [loading, setLoading] = useState(false);

  const syncPanel = useCallback((panel: LiveVotePanelResponse) => {
    if (panel.status === "empty" || !panel.pollId) return;
    setPollId(panel.pollId);
    setVote(liveVotePanelToGroupVote(panel));
  }, []);

  const refresh = useCallback(async () => {
    if (!usingRealPoll || !tripId) return;
    const panel = await fetchLiveVotePanel(tripId);
    if (panel) syncPanel(panel);
  }, [syncPanel, tripId, usingRealPoll]);

  useEffect(() => {
    if (!usingRealPoll) {
      setPollId(null);
      setVote(null);
      return;
    }

    void refresh();
    const timer = setInterval(() => {
      void refresh();
    }, 15_000);
    return () => clearInterval(timer);
  }, [refresh, usingRealPoll]);

  const createPoll = useCallback(
    async (input: {
      question?: string;
      options: Array<{ label: string; meta?: string }>;
    }) => {
      if (!usingRealPoll || !tripId) {
        return { ok: false, message: "Open Live from a trip to start a real group vote." };
      }

      setLoading(true);
      try {
        const result = await createLiveVotePoll(tripId, input);
        if (!result.panel) {
          return { ok: false, message: result.error ?? "Could not create vote." };
        }
        syncPanel(result.panel);
        return { ok: true };
      } finally {
        setLoading(false);
      }
    },
    [syncPanel, tripId, usingRealPoll],
  );

  const selectOption = useCallback(
    async (optionId: string) => {
      if (!usingRealPoll || !pollId) {
        return { ok: false, message: "No active poll yet." };
      }

      const result = await castLivePollVote(pollId, optionId);
      if (result.panel) syncPanel(result.panel);
      if (result.error) return { ok: false, message: result.error };
      return { ok: Boolean(result.panel) };
    },
    [pollId, syncPanel, usingRealPoll],
  );

  return {
    usingRealPoll,
    pollId,
    vote,
    loading,
    refresh,
    createPoll,
    selectOption,
  };
}
