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

/** v3 left-dock section label (JetBrains-style tracking). */
export const LIVE_DOCK_SECTION_LABEL =
  "font-mono text-[9.5px] font-medium uppercase tracking-[0.16em] text-[#5F665F]";

/** v3 cream setup card surface (#FBFAF7). */
export const LIVE_DOCK_PANEL =
  "rounded-[22px] border border-[rgba(15,22,20,0.08)] bg-[#FBFAF7] shadow-[0_18px_44px_-18px_rgba(0,0,0,0.5)]";

/** v3 nested warm surface inside dock cards. */
export const LIVE_DOCK_NESTED_SURFACE = "rounded-2xl bg-[#F1EFE8]";

/** v3 dark glass stage tab bar on map. */
export const LIVE_DOCK_STAGE_BAR =
  "flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full border border-white/15 bg-[rgba(9,17,24,0.8)] p-1 backdrop-blur-md";

/** v3 gradient primary CTA (Start Live). */
export const LIVE_DOCK_PRIMARY_CTA =
  "w-full rounded-full bg-gradient-to-br from-[#12856F] to-[#0A4A3E] py-3.5 text-sm font-semibold text-white shadow-[0_12px_26px_-14px_rgba(10,74,62,0.9)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:from-stone-300 disabled:to-stone-300 disabled:text-stone-500 disabled:shadow-none";

/** Top-right hero search anchor (clears right map controls). */
export const LIVE_HERO_SEARCH_TOP =
  "top-[calc(0.5rem+env(safe-area-inset-top,0px))] md:top-[calc(0.65rem+env(safe-area-inset-top,0px))]";

export const LIVE_HERO_SEARCH_RIGHT =
  "right-[max(5.25rem,min(5.75rem,6vw))] w-[min(408px,calc(100vw-7rem))] sm:w-[min(408px,calc(100vw-490px))]";

/** v3 empty-state card title (Instrument Serif fallback). */
export const LIVE_EMPTY_STATE_TITLE = "font-serif text-lg leading-tight text-[#0F1614]";

/** v3 solo nav — dark glass turn banner under safe area. */
export const LIVE_NAV_TURN_BANNER =
  "rounded-[20px] border border-white/12 bg-[rgba(9,17,24,0.88)] px-4 py-3.5 shadow-[0_16px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl";

/** v3 solo nav — cream bottom ETA bar above attribution strip. */
export const LIVE_NAV_ETA_BAR =
  "border-t border-[rgba(15,22,20,0.08)] bg-[#FBFAF7]/97 px-4 py-3 shadow-[0_-12px_36px_rgba(0,0,0,0.18)] backdrop-blur-md";

/** v3 solo nav — compact speed readout. */
export const LIVE_NAV_SPEED_PILL =
  "rounded-2xl border border-white/12 bg-[rgba(9,17,24,0.82)] px-3.5 py-2.5 shadow-[0_8px_24px_rgba(0,0,0,0.35)] backdrop-blur-md";

/** Place name in preview card. */
export const LIVE_PLACE_TITLE = "text-lg font-bold leading-tight text-stone-900";

/** Primary CTA on Live panels. */
export const LIVE_PRIMARY_BTN =
  "inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-hover active:scale-[0.98]";

/** Secondary / outline CTA. */
export const LIVE_SECONDARY_BTN =
  "inline-flex items-center justify-center rounded-xl border border-primary/30 bg-primary-soft/60 px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary-soft";

/** Wayra docked column width — keep in sync with live-layout clamps. */
export const LIVE_WAYRA_PANEL_WIDTH = "clamp(18rem, 24vw, 32rem)";

/** Right inset clearing the map control rail (~5.75rem). */
export const LIVE_WAYRA_SHEET_RIGHT = "max(1rem, min(5.75rem, 6vw))";

/** @deprecated Import from @/lib/wayra/wayra-chat-tokens — global Wayra shell. */
export {
  WAYRA_ASSISTANT_BODY as LIVE_WAYRA_ASSISTANT_BUBBLE,
  WAYRA_FOOTER as LIVE_WAYRA_FOOTER,
  WAYRA_HEADER as LIVE_WAYRA_HEADER,
  WAYRA_MESSAGES as LIVE_WAYRA_MESSAGES,
  WAYRA_PANEL_BASE as LIVE_WAYRA_PANEL,
  WAYRA_PANEL_DOCKED as LIVE_WAYRA_PANEL_DOCKED,
  WAYRA_SEND_BTN as LIVE_WAYRA_SEND_BTN,
  WAYRA_USER_BUBBLE as LIVE_WAYRA_USER_BUBBLE,
} from "@/lib/wayra/wayra-chat-tokens";
