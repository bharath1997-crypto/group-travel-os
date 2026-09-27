const KEY = "rovvy_live_saved_places_layer";

/** Default on — user's personal pins are the main reason to enable the layer. */
export function loadLiveSavedPlacesLayerPreference(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === "0") return false;
    if (raw === "1") return true;
    return true;
  } catch {
    return true;
  }
}

export function saveLiveSavedPlacesLayerPreference(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, enabled ? "1" : "0");
  } catch {
    /* quota / private mode */
  }
}
