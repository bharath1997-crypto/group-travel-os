/**
 * Live map layout — fixed bottom-left control dock + panel inset.
 * Map controls stay pinned to the bottom-left; panels sit on the right.
 */

/** Fixed position for the compact map control dock (Google Maps–style, bottom-left). */
export const LIVE_MAP_CONTROLS_POSITION =
  "bottom-[calc(0.75rem+env(safe-area-inset-bottom,0px))] left-3 md:bottom-5 md:left-4 lg:left-5";

/** Right-side control rail — sits above the bottom strip. */
export const LIVE_MAP_CONTROLS_RAIL_POSITION =
  "fixed z-[40] right-2 bottom-[calc(3.5rem+26px+env(safe-area-inset-bottom,0px))] md:right-4 md:bottom-[calc(26px+0.75rem)]";

/** Unified floating map control — Google Maps ~40dp rounded square. */
export const LIVE_MAP_FLOAT_BTN =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg shadow-[0_1px_4px_rgba(0,0,0,0.32)] backdrop-blur-md transition-all duration-200 focus:outline-none cursor-pointer active:scale-[0.97]";

/** Chat FAB — sits just left of the coordinate strip. */
export const LIVE_MAP_CHAT_FAB_POSITION =
  "fixed z-[36] bottom-[calc(3.5rem+26px+env(safe-area-inset-bottom,0px))] left-2 md:bottom-[calc(26px+0.5rem)] md:left-3";

export const LIVE_MAP_CHAT_FAB_IMMERSIVE_POSITION =
  "fixed z-[36] bottom-[calc(26px+0.5rem)] left-2 md:left-3";

/** Mobile bottom tab bar (matches layout h-14). */
export const LIVE_MOBILE_TAB_BAR_HEIGHT = "3.5rem";

/** Map bottom baseline — attribution strip sits flush here (cornerstone of the map). */
export const LIVE_MAP_BOTTOM_BASE =
  "env(safe-area-inset-bottom, 0px)";

export const LIVE_MAP_BOTTOM_ABOVE_TAB =
  "calc(3.5rem + env(safe-area-inset-bottom, 0px))";

/** Compact coordinate strip — full-width baseline of the map viewport. */
export const LIVE_MAP_ATTRIBUTION_STRIP_POSITION =
  "fixed z-[35] bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] inset-x-0 md:bottom-0";

export const LIVE_MAP_ATTRIBUTION_STRIP_IMMERSIVE_POSITION =
  "fixed z-[35] bottom-0 inset-x-0";

/** Top edge of the attribution strip — panels stack flush above the strip. */
export const LIVE_SHEET_BOTTOM_DEFAULT =
  "calc(3.5rem + 26px + env(safe-area-inset-bottom, 0px))";

export const LIVE_SHEET_BOTTOM_IMMERSIVE =
  "calc(26px + env(safe-area-inset-bottom, 0px))";

export const LIVE_SHEET_BOTTOM_ABOVE_ROUTE =
  "calc(5.25rem + 3rem + env(safe-area-inset-bottom, 0px))";

/** Desktop: strip is flush at bottom-0. */
export const LIVE_SHEET_BOTTOM_DESKTOP = "26px";

/** Bottom attribution strip — height drives layout offsets and in-strip controls. */
export const LIVE_STRIP_HEIGHT_PX = 26;
export const LIVE_STRIP_HEIGHT_CSS = `${LIVE_STRIP_HEIGHT_PX}px`;
export const LIVE_STRIP_ZOOM_ICON_PX = 9;
export const LIVE_STRIP_ZOOM_HIT_PX = 26;

/**
 * Right inset for desktop side panels so they never overlap the control rail.
 * ~24px edge + 40px button + 16px gap ≈ 5.75rem
 */
export const LIVE_PANEL_RIGHT_INSET =
  "right-4 sm:right-[5rem] md:right-[5.25rem] lg:right-[5.5rem] xl:right-[5.75rem]";

/** Wayra chat column — viewport ratio (overridable via CSS var). */
export const LIVE_WAYRA_PANEL_WIDTH_CLAMP = "clamp(18rem, var(--live-wayra-width, 24vw), min(32rem, 38vw))";

/** Legacy px constant — prefer LIVE_WAYRA_PANEL_WIDTH_CLAMP in new layout code. */
export const LIVE_WAYRA_PANEL_WIDTH_PX = 380;

/** Place preview card right offset when Wayra chat column is open. */
export const LIVE_PANEL_RIGHT_WHEN_WAYRA_OPEN =
  "right-[calc(clamp(18rem,var(--live-wayra-width,24vw),min(32rem,38vw))+0.75rem)]";

export const LIVE_PANEL_MAX_WIDTH_WHEN_WAYRA_OPEN =
  "max-w-[min(clamp(14rem,var(--live-preview-width,22vw),min(36rem,42vw)),calc(100vw-clamp(18rem,var(--live-wayra-width,24vw),min(32rem,38vw))-2.5rem))]";

/** Max width for compact side panels — scales with viewport + rem. */
export const LIVE_PANEL_MAX_WIDTH =
  "max-w-[min(clamp(14rem,var(--live-preview-width,22vw),min(36rem,42vw)),calc(100vw-5rem))]";

/** @deprecated use LIVE_WAYRA_PANEL_WIDTH_CLAMP */
export const LIVE_WAYRA_PANEL_WIDTH_CSS = "clamp(18rem, 24vw, 32rem)";

/**
 * Viewport-anchored side/bottom sheet — use instead of absolute inside the map shell
 * (overflow-hidden ancestors clip absolute panels).
 */
export const LIVE_FIXED_PANEL =
  "pointer-events-auto fixed z-[140] flex flex-col overflow-hidden bg-white text-sm shadow-[0_8px_30px_rgba(0,0,0,0.12)]";

/** Phone: full-width bottom sheet anchored to viewport. */
export const LIVE_PHONE_SHEET_LAYOUT = [
  LIVE_FIXED_PANEL,
  "inset-x-0 left-0 right-0",
  "w-full max-w-none",
  "rounded-t-2xl rounded-b-none border border-stone-200/80 border-b-0",
  "bottom-[var(--live-sheet-bottom)]",
  "max-h-[min(85dvh,calc(100dvh-var(--live-sheet-bottom)-3rem))]",
  "bg-white shadow-2xl",
].join(" ");

/** Tablet/desktop: fixed to viewport bottom-right — never `absolute` or `left:0`. */
export const LIVE_DESKTOP_SIDE_LAYOUT = [
  LIVE_FIXED_PANEL,
  "left-auto",
  LIVE_PANEL_RIGHT_INSET,
  LIVE_PANEL_MAX_WIDTH,
  "w-[min(clamp(14rem,var(--live-preview-width,22vw),min(36rem,42vw)),calc(100vw-5rem))]",
  "min-w-[14rem]",
  "h-auto max-h-[min(var(--live-preview-max-height,75dvh),calc(100dvh-var(--live-sheet-bottom)-2rem))]",
  "rounded-xl rounded-b-none border border-stone-200/80 border-b-0 shadow-2xl",
  "bottom-[var(--live-sheet-bottom)]",
  "bg-white",
].join(" ");

/** Desktop side panel when Wayra chat column is open. */
export const LIVE_DESKTOP_SIDE_WAYRA_LAYOUT = [
  LIVE_FIXED_PANEL,
  "left-auto",
  LIVE_PANEL_RIGHT_WHEN_WAYRA_OPEN,
  LIVE_PANEL_MAX_WIDTH_WHEN_WAYRA_OPEN,
  "min-w-[14rem]",
  "h-auto max-h-[min(var(--live-preview-max-height,75dvh),calc(100dvh-var(--live-sheet-bottom)-2rem))]",
  "rounded-xl rounded-b-none border border-stone-200/80 border-b-0 shadow-2xl",
  "bottom-[var(--live-sheet-bottom)]",
  "bg-white",
].join(" ");

/** Right-bottom sheet — flush on attribution strip, height follows content. */
export const LIVE_RESPONSIVE_PANEL_LAYOUT = LIVE_DESKTOP_SIDE_LAYOUT;

/** Compact route summary above the bottom-left map dock. */
export const LIVE_ROUTE_SUMMARY_BOTTOM =
  "bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))] md:bottom-[calc(5.75rem+env(safe-area-inset-bottom,0px))]";

/** Gap between the layers panel and the map tools trigger (right rail opens left). */
export const LIVE_MAP_LAYERS_PANEL_OFFSET = "mr-2";

/** Top-right compass — below header with edge gaps, not touching nav bar or screen edge. */
export const LIVE_MAP_COMPASS_POSITION =
  "top-[calc(4.75rem+env(safe-area-inset-top,0px))] right-4 md:top-[calc(5rem+env(safe-area-inset-top,0px))] md:right-5";

/** Vertical zoom — stacked directly under the compass button. */
export const LIVE_MAP_ZOOM_CONTROL_POSITION =
  "top-[calc(7.75rem+env(safe-area-inset-top,0px))] right-4 md:top-[calc(8rem+env(safe-area-inset-top,0px))] md:right-5";

/** Live map view tilt — flat vs perspective (Google Maps–style 2D/3D). */
export type LiveMapViewMode = "2d" | "3d";

export const LIVE_MAP_2D_PITCH = 0;
export const LIVE_MAP_3D_PITCH = 60;
/** Pitch at or above this value is treated as 3D view. */
export const LIVE_MAP_3D_PITCH_THRESHOLD = 30;
