import { apiFetch, apiFetchWithStatus } from "@/lib/safe-fetch";
import { getToken } from "@/lib/auth";
import type { LiveVotePanelResponse } from "./live-group-vote";

export async function fetchLiveVotePanel(tripId: string): Promise<LiveVotePanelResponse | null> {
  const token = getToken();
  if (!token) return null;

  try {
    return await apiFetch<LiveVotePanelResponse>(`/live/trips/${tripId}/vote-panel`);
  } catch {
    return null;
  }
}

export async function createLiveVotePoll(
  tripId: string,
  input: {
    question?: string;
    options: Array<{ label: string; meta?: string; locationId?: string }>;
  },
): Promise<{ panel: LiveVotePanelResponse | null; error?: string | null }> {
  const token = getToken();
  if (!token) {
    return { panel: null, error: "Sign in to start a group vote." };
  }

  const { data, status } = await apiFetchWithStatus<LiveVotePanelResponse>(
    `/live/trips/${tripId}/vote-panel`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: input.question ?? "Where are we eating?",
        options: input.options.map((option) => ({
          label: option.label,
          meta: option.meta ?? null,
          locationId: option.locationId ?? null,
        })),
      }),
    },
  );

  if (status === 401 || status === 403) {
    return { panel: null, error: "Sign in to start a group vote." };
  }
  if (!data) {
    return { panel: null, error: "Could not create the group vote." };
  }

  return { panel: data };
}

export async function castLivePollVote(
  pollId: string,
  optionId: string,
): Promise<{ panel: LiveVotePanelResponse | null; error?: string | null }> {
  const token = getToken();
  if (!token) {
    return { panel: null, error: "Sign in to vote." };
  }

  const { data, status } = await apiFetchWithStatus<LiveVotePanelResponse>(
    `/live/polls/${pollId}/vote`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ optionId }),
    },
  );

  if (status === 409) {
    return { panel: data, error: "You already voted on this poll." };
  }
  if (!data) {
    return { panel: null, error: "Could not record your vote." };
  }

  return { panel: data };
}
