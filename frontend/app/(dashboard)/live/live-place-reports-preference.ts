const KEY = "rovvy_live_reports_layer";

/** Default on — reports are a core Live L2 surface. */
export function loadLiveReportsLayerPreference(): boolean {
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

export function saveLiveReportsLayerPreference(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, enabled ? "1" : "0");
  } catch {
    /* quota / private mode */
  }
}
