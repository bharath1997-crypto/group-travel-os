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
  return `flex h-8 w-8 items-center justify-center transition-colors duration-200 ${base} ${
    disabled ? "cursor-not-allowed opacity-35" : ""
  }`;
}

/** Zoom + button: yellow when nearing cap, solid red at max. */
export function liveMapZoomInBtn(
  isDark: boolean,
  level: "normal" | "approaching" | "max",
): string {
  const base =
    "flex h-8 w-8 items-center justify-center transition-colors duration-200 font-semibold";
  if (level === "max") {
    return `${base} cursor-default bg-red-500 text-white shadow-inner ring-1 ring-red-600/40`;
  }
  if (level === "approaching") {
    return isDark
      ? `${base} text-amber-300 hover:bg-amber-400/15 active:bg-amber-400/25`
      : `${base} text-amber-600 hover:bg-amber-50 active:bg-amber-100`;
  }
  return liveMapRightBtn(isDark, false);
}

/** Zoom − button: green when at minimum zoom. */
export function liveMapZoomOutBtn(
  isDark: boolean,
  level: "normal" | "min",
): string {
  const base =
    "flex h-8 w-8 items-center justify-center transition-colors duration-200 font-semibold";
  if (level === "min") {
    return `${base} cursor-default bg-emerald-500 text-white shadow-inner ring-1 ring-emerald-600/40`;
  }
  return liveMapRightBtn(isDark, false);
}

export const LIVE_MAP_ZOOM_SCALE_VISIBLE_MS = 2400;
