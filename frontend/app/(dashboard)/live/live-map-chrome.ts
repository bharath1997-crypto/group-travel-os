import type { LiveMapLayer } from "@/lib/map-providers";

/**
 * Single source of truth for Live map UI chrome (search, left rail, right controls, layers).
 * v3 cream chrome on all layers except explicit Dark basemap.
 */
export function isLiveMapDarkChrome(layer: LiveMapLayer | string): boolean {
  return layer === "dark";
}

/** @deprecated use isLiveMapDarkChrome — kept for immersive body sync. */
export function isImmersiveDarkMapLayer(layer: LiveMapLayer | string): boolean {
  return isLiveMapDarkChrome(layer);
}

export const LIVE_CHROME_RAIL_BASE =
  "pointer-events-auto absolute left-[max(0.75rem,14px)] top-2 z-[47] flex flex-col gap-0.5 rounded-2xl p-1.5 font-sans backdrop-blur-md transition-all duration-300 md:top-2";

export function liveChromeRailShell(dark: boolean): string {
  return dark
    ? `${LIVE_CHROME_RAIL_BASE} border border-white/12 bg-[rgba(9,17,24,0.88)] shadow-[0_14px_36px_-16px_rgba(0,0,0,0.55)]`
    : `${LIVE_CHROME_RAIL_BASE} border border-[rgba(15,22,20,0.12)] bg-[#FBFAF7] shadow-[0_14px_36px_-16px_rgba(0,0,0,0.35)]`;
}

export function liveChromeRailButtonClass(
  dark: boolean,
  active: boolean,
  interactive: boolean,
): string {
  if (active) {
    return dark
      ? "bg-white/15 text-white ring-1 ring-white/25"
      : "bg-primary-soft text-[#0F1614] ring-1 ring-primary/25";
  }
  if (interactive) {
    return dark
      ? "text-white/90 hover:bg-white/10"
      : "text-[#0F1614] hover:bg-[#F1EFE8]";
  }
  return dark
    ? "text-white/55 hover:bg-white/10 hover:text-white/90"
    : "text-[#5F665F] hover:bg-[#F1EFE8] hover:text-[#0F1614]";
}
