/** Sync Live map chrome (header/search) with body data attributes for dashboard layout. */

export type LiveImmersiveChromeState = {
  active: boolean;
  darkMap: boolean;
};

const ACTIVE_KEY = "liveImmersive";
const DARK_KEY = "liveDarkMap";

export function readLiveImmersiveChrome(): LiveImmersiveChromeState {
  if (typeof document === "undefined") {
    return { active: false, darkMap: false };
  }
  return {
    active: document.body.dataset[ACTIVE_KEY] === "true",
    darkMap: document.body.dataset[DARK_KEY] === "true",
  };
}

export function setLiveImmersiveChrome(state: LiveImmersiveChromeState): void {
  if (typeof document === "undefined") return;
  if (state.active) document.body.dataset[ACTIVE_KEY] = "true";
  else delete document.body.dataset[ACTIVE_KEY];
  if (state.darkMap) document.body.dataset[DARK_KEY] = "true";
  else delete document.body.dataset[DARK_KEY];
  window.dispatchEvent(new CustomEvent("rovvy-live-chrome"));
}

export function clearLiveImmersiveChrome(): void {
  setLiveImmersiveChrome({ active: false, darkMap: false });
}

export function isImmersiveDarkMapLayer(
  layer: string,
): boolean {
  return layer === "dark" || layer === "satellite" || layer === "hybrid";
}
