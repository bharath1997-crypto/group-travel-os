const STORAGE_KEY = "rovvy_live_travel_layer";

export function loadLiveTravelLayerPreference(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveLiveTravelLayerPreference(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    /* quota / private mode */
  }
}
