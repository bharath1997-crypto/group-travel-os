/**
 * Live map visual design tokens — GMaps-caliber glass chrome, Rovvy teal accent.
 * Industry-standard map UI patterns; Rovvy-owned colors, Lucide icons, MapLibre/OSM stack.
 */

import { BRAND } from "@/lib/brand";

/** Primary accent on Live — Rovvy teal (not third-party map brand colors). */
export const LIVE_ACCENT = BRAND.colors.primary;

/** Frosted white surface — Tailwind-safe opacity steps only (/90, /95). */
const LIVE_GLASS_BG = "bg-white/95 backdrop-blur-xl";
const LIVE_GLASS_BORDER = "border border-stone-200/70";
const LIVE_GLASS_SHADOW = "shadow-[0_8px_32px_rgba(15,23,42,0.10)]";

/** Shared frosted panel — place card, dropdowns, map-adjacent sheets. */
export const LIVE_GLASS_PANEL = `rounded-2xl ${LIVE_GLASS_BORDER} ${LIVE_GLASS_BG} ${LIVE_GLASS_SHADOW}`;

/** Bottom sheet variant — flush on attribution strip. */
export const LIVE_GLASS_SHEET = `rounded-t-2xl rounded-b-none ${LIVE_GLASS_BORDER} border-b-0 ${LIVE_GLASS_BG} shadow-[0_8px_32px_rgba(15,23,42,0.12)]`;

/** Desktop side panel — slightly tighter radius on bottom edge. */
export const LIVE_GLASS_SIDE_PANEL = `rounded-xl rounded-b-none ${LIVE_GLASS_BORDER} border-b-0 ${LIVE_GLASS_BG} shadow-[0_8px_32px_rgba(15,23,42,0.12)]`;

/** Hero search pill — primary visual anchor on the map. */
export const LIVE_SEARCH_PILL = `flex h-12 w-full items-center gap-2 rounded-full border border-stone-200/60 bg-white/95 pl-2.5 pr-1.5 shadow-[0_4px_20px_rgba(15,23,42,0.10)] backdrop-blur-xl`;

export const LIVE_SEARCH_PILL_DARK =
  "flex h-12 w-full items-center gap-2 rounded-full border border-white/15 bg-slate-950/78 pl-2.5 pr-1.5 shadow-[0_4px_20px_rgba(0,0,0,0.35)] backdrop-blur-xl text-white";

/** Search dropdown surface. */
export const LIVE_SEARCH_DROPDOWN = LIVE_GLASS_PANEL;

/** Map floating control button — matches right-rail controls. */
export const LIVE_MAP_CONTROL_BTN =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-stone-200/50 bg-white/95 text-stone-700 shadow-[0_2px_12px_rgba(15,23,42,0.10)] backdrop-blur-md transition-all duration-200 hover:bg-white active:scale-[0.97]";

/** Panel open/close motion (spatial, not teleport). */
export const LIVE_PANEL_MOTION =
  "transition-[bottom,right,left,width,max-height,opacity,transform] duration-300 ease-out";

/** Minimum readable meta label on Live chrome. */
export const LIVE_META_TEXT = "text-xs text-stone-500";

/** Section label in dropdowns / cards. */
export const LIVE_SECTION_LABEL =
  "text-[11px] font-semibold uppercase tracking-wide text-stone-400";

/** Place name in preview card. */
export const LIVE_PLACE_TITLE = "text-lg font-bold leading-tight text-stone-900";

/** Primary CTA on Live panels. */
export const LIVE_PRIMARY_BTN =
  "inline-flex items-center justify-center rounded-xl bg-[#0F766E] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 active:scale-[0.98]";

/** Secondary / outline CTA. */
export const LIVE_SECONDARY_BTN =
  "inline-flex items-center justify-center rounded-xl border border-[#0F766E]/30 bg-teal-50/60 px-4 py-2.5 text-sm font-semibold text-[#0F766E] transition hover:bg-teal-50";

/** Wayra docked column width — keep in sync with live-layout clamps. */
export const LIVE_WAYRA_PANEL_WIDTH = "clamp(18rem, 24vw, 32rem)";

/** Right inset clearing the map control rail (~5.75rem). */
export const LIVE_WAYRA_SHEET_RIGHT = "max(1rem, min(5.75rem, 6vw))";

/** Wayra on Live — unified with map chrome (teal, glass). */
export const LIVE_WAYRA_PANEL = `pointer-events-auto fixed z-[3000] flex flex-col overflow-hidden ${LIVE_GLASS_BORDER} ${LIVE_GLASS_BG} shadow-[0_8px_32px_rgba(15,23,42,0.12)]`;

export const LIVE_WAYRA_PANEL_DOCKED = `${LIVE_WAYRA_PANEL} rounded-none rounded-l-2xl border-r-0`;

export const LIVE_WAYRA_HEADER =
  "flex shrink-0 items-start justify-between gap-2 border-b border-stone-200/70 bg-white/95 px-3.5 py-2.5";

export const LIVE_WAYRA_MESSAGES =
  "min-h-0 flex-1 space-y-3 overflow-y-auto bg-stone-50/80 px-3 py-3";

export const LIVE_WAYRA_USER_BUBBLE =
  "rounded-2xl rounded-br-md bg-teal-50 px-3 py-2 text-sm leading-normal text-stone-800";

export const LIVE_WAYRA_ASSISTANT_BUBBLE =
  "rounded-2xl rounded-bl-md border border-stone-200/60 bg-white px-3 py-2 text-sm leading-normal text-stone-800 whitespace-pre-wrap";

export const LIVE_WAYRA_SEND_BTN =
  "h-fit shrink-0 self-end rounded-xl bg-[#0F766E] px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50";

export const LIVE_WAYRA_FOOTER = "shrink-0 border-t border-stone-200/70 bg-white/95 p-2.5";
