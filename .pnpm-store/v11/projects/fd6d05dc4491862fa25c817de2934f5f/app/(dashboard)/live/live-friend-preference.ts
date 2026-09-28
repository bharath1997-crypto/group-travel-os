const STORAGE_KEY = "rovvy_live_friend_tracking";

export function loadLiveFriendTrackingPreference(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === null ? true : stored === "1";
  } catch {
    return true;
  }
}

export function saveLiveFriendTrackingPreference(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    /* quota / private mode */
  }
}
