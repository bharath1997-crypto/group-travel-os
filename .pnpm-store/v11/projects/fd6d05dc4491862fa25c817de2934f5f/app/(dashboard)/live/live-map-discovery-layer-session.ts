const SESSION_KEY = "rovvy_live_parks_landmarks_layer";

export function readDiscoveryLayerSessionEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored === "0") return false;
    if (stored === "1") return true;
    return true;
  } catch {
    return false;
  }
}

export function writeDiscoveryLayerSessionEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SESSION_KEY, enabled ? "1" : "0");
  } catch {
    /* ignore */
  }
}

/** Regional city view (~Z8+) — query is clamped to a small km² box at map center, not the full viewport. */
export const LIVE_DISCOVERY_MIN_ZOOM = 8;
