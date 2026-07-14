import type { LiveMapLayer } from "@/lib/map-providers";

/** True when map tiles are dark — controls need a radiant / high-contrast shell. */
export function isLiveMapDarkLayer(layer: LiveMapLayer): boolean {
  return layer === "dark";
}

export function liveMapRightShell(isDark: boolean): string {
  return isDark
    ? "bg-slate-950/92 text-slate-100 ring-1 ring-white/35 shadow-[0_0_18px_rgba(255,255,255,0.32)] backdrop-blur-md"
    : "bg-white/96 text-stone-700 ring-1 ring-stone-200/90 shadow-[0_2px_10px_rgba(15,23,42,0.14)] backdrop-blur-sm";
}

export function liveMapRightBtn(isDark: boolean, disabled = false): string {
  const base = isDark
    ? "text-slate-100 hover:bg-white/10 active:bg-white/15"
    : "text-stone-700 hover:bg-stone-100/90 active:bg-stone-200/70";
  return `flex h-9 w-9 items-center justify-center transition-colors ${base} ${
    disabled ? "cursor-not-allowed opacity-35" : ""
  }`;
}

export const LIVE_MAP_ZOOM_SCALE_VISIBLE_MS = 2400;
