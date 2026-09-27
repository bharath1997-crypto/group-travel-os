import { authenticateFirebase, initFirebase } from "@/lib/firebase-client";
import { fetchLiveFirebaseToken } from "./live-group-network";

export type LiveFirebaseSession = {
  ok: boolean;
  db: ReturnType<typeof initFirebase>["db"];
  error?: string | null;
};

export async function ensureLiveFirebaseSession(): Promise<LiveFirebaseSession> {
  const ready = initFirebase();
  if (!ready.ok || !ready.db) {
    return { ok: false, db: null, error: "Firebase is not configured for Live." };
  }

  const token = await fetchLiveFirebaseToken();
  if (!token) {
    return { ok: false, db: null, error: "Sign in to share live locations." };
  }

  const authed = await authenticateFirebase(token);
  if (!authed) {
    return { ok: false, db: null, error: "Could not connect to live location sharing." };
  }

  return { ok: true, db: ready.db };
}
