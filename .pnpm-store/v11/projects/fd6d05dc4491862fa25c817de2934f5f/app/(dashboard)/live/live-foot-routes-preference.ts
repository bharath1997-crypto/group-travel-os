const FOOT_ROUTES_KEY = "rovvy_live_foot_routes";

export function loadLiveFootRoutesPreference(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(FOOT_ROUTES_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveLiveFootRoutesPreference(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(FOOT_ROUTES_KEY, enabled ? "1" : "0");
  } catch {
    /* quota / private mode */
  }
}
