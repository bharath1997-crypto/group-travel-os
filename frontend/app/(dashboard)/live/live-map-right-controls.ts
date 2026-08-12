import type { LiveMapLayer } from "@/lib/map-providers";
import { LIVE_MAP_FLOAT_BTN } from "./live-layout";

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
  return `flex h-9 w-9 items-center justify-center transition-colors duration-200 ${base} ${
    disabled ? "cursor-not-allowed opacity-35" : ""
  }`;
}

/** Zoom + button: yellow when nearing cap, solid red at max. */
export function liveMapZoomInBtn(
  isDark: boolean,
  level: "normal" | "approaching" | "max",
): string {
  const base =
    "flex h-9 w-9 items-center justify-center transition-colors duration-200 font-semibold";
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
    "flex h-9 w-9 items-center justify-center transition-colors duration-200 font-semibold";
  if (level === "min") {
    return `${base} cursor-default bg-emerald-500 text-white shadow-inner ring-1 ring-emerald-600/40`;
  }
  return liveMapRightBtn(isDark, false);
}

/** Google Maps–style dark control stack (zoom / GPS). */
export function liveMapGoogleControlShell(): string {
  return "bg-[rgba(60,64,67,0.94)] text-white shadow-[0_1px_4px_rgba(0,0,0,0.45)] backdrop-blur-sm";
}

export function liveMapGoogleControlBtn(disabled = false): string {
  return `flex h-9 w-9 items-center justify-center transition-colors duration-200 text-white hover:bg-white/10 active:bg-white/15 ${
    disabled ? "cursor-not-allowed opacity-40" : ""
  }`;
}

/** Zoom + on dark stack: yellow near cap, red at max. */
export function liveMapGoogleZoomInBtn(level: "normal" | "approaching" | "max"): string {
  const base =
    "flex h-9 w-9 items-center justify-center transition-colors duration-200 font-semibold text-white";
  if (level === "max") {
    return `${base} cursor-default bg-red-600 text-white`;
  }
  if (level === "approaching") {
    return `${base} text-amber-300 hover:bg-white/10`;
  }
  return liveMapGoogleControlBtn(false);
}

/** Zoom − on dark stack: green at minimum. */
export function liveMapGoogleZoomOutBtn(level: "normal" | "min"): string {
  const base =
    "flex h-9 w-9 items-center justify-center transition-colors duration-200 font-semibold text-white";
  if (level === "min") {
    return `${base} cursor-default bg-emerald-600 text-white`;
  }
  return liveMapGoogleControlBtn(false);
}

export const LIVE_MAP_ZOOM_SCALE_VISIBLE_MS = 2400;

/** Light floating control (layers, compass). */
export function liveMapFloatBtnLight(active = false, isDark = false): string {
  if (active) {
    return `${LIVE_MAP_FLOAT_BTN} ${
      isDark
        ? "bg-teal-500/25 text-teal-200 ring-1 ring-teal-400/35"
        : "bg-[#E6F4F2] text-[#0F766E] ring-1 ring-[#0F766E]/20"
    }`;
  }
  return `${LIVE_MAP_FLOAT_BTN} ${
    isDark
      ? "bg-[rgba(32,33,36,0.92)] text-white/90 hover:bg-[rgba(48,49,52,0.96)]"
      : "bg-white text-[#3C4043] hover:bg-[#F8F9FA]"
  }`;
}

/** Dark floating control (GPS) — Google Maps location pill. */
export function liveMapFloatBtnDark(active = false): string {
  const shell =
    "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-stone-200/50 shadow-[0_2px_12px_rgba(15,23,42,0.10)] backdrop-blur-md transition-all duration-200 focus:outline-none cursor-pointer active:scale-[0.97]";
  if (active) {
    return `${shell} !text-white bg-[#1A73E8] shadow-[0_1px_6px_rgba(26,115,232,0.45)] hover:bg-[#1967D2]`;
  }
  return `${shell} !text-white bg-[rgba(60,64,67,0.94)] hover:bg-[rgba(48,49,52,0.98)]`;
}
