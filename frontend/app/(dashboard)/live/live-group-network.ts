import { apiFetch, apiFetchWithStatus } from "@/lib/safe-fetch";
import { getToken } from "@/lib/auth";
import type { GroupMemberSummary } from "./live-group-location-types";

export type StartGroupConvergeResult = {
  ok: boolean;
  sessionId?: string | null;
  message?: string | null;
};

export async function fetchLiveFirebaseToken(): Promise<string | null> {
  const token = getToken();
  if (!token) return null;

  const { data, status } = await apiFetchWithStatus<{ token: string }>("/live/firebase-token");
  if (status === 401 || status === 403 || !data?.token) return null;
  return data.token;
}

export async function startGroupConvergeSession(input: {
  tripId: string;
  destinationLat: number;
  destinationLng: number;
  travelMode: string;
}): Promise<StartGroupConvergeResult> {
  const authToken = getToken();
  if (!authToken) {
    return { ok: false, message: "Sign in to start Group Live." };
  }

  const { data, status } = await apiFetchWithStatus<{
    status: "ready" | "failed";
    sessionId?: string | null;
    message?: string | null;
  }>(
    "/live/group/converge/start",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tripId: input.tripId,
        destinationLat: input.destinationLat,
        destinationLng: input.destinationLng,
        travelMode: input.travelMode,
      }),
    },
  );

  if (status === 401 || status === 403) {
    return { ok: false, message: "Sign in to start Group Live." };
  }
  if (!data || data.status !== "ready") {
    return { ok: false, message: data?.message ?? "Could not start group converge." };
  }

  return { ok: true, sessionId: data.sessionId ?? null };
}

export async function fetchGroupMembers(groupId: string): Promise<GroupMemberSummary[]> {
  const token = getToken();
  if (!token) return [];

  try {
    const rows = await apiFetch<
      Array<{
        user_id: string;
        full_name: string;
        avatar_url: string | null;
      }>
    >(`/groups/${groupId}/members`);

    return rows.map((row) => ({
      userId: row.user_id,
      fullName: row.full_name,
      avatarUrl: row.avatar_url,
    }));
  } catch {
    return [];
  }
}

export async function fetchWayraLiveContextAlert(tripId: string): Promise<string | null> {
  const token = getToken();
  if (!token) return null;

  try {
    const data = await apiFetch<{ alert: string | null }>(`/wayra/live-context/${tripId}`);
    return data.alert?.trim() || null;
  } catch {
    return null;
  }
}
