const SEA_KEY = "rovvy_live_sea_routes";
const CRUISE_KEY = "rovvy_live_cruise_routes";

export function loadLiveSeaRoutesPreference(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(SEA_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveLiveSeaRoutesPreference(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SEA_KEY, enabled ? "1" : "0");
  } catch {
    /* quota / private mode */
  }
}

export function loadLiveCruiseRoutesPreference(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(CRUISE_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveLiveCruiseRoutesPreference(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CRUISE_KEY, enabled ? "1" : "0");
  } catch {
    /* quota / private mode */
  }
}
