/**
 * Live map layout — fixed bottom-left control dock + panel inset.
 * Map controls stay pinned to the bottom-left; panels sit on the right.
 */

/** Fixed position for the compact map control dock (Google Maps–style, bottom-left). */
export const LIVE_MAP_CONTROLS_POSITION =
  "bottom-[calc(0.75rem+env(safe-area-inset-bottom,0px))] left-3 md:bottom-5 md:left-4 lg:left-5";

/**
 * Right inset for desktop side panels so they never overlap the control rail.
 * ~24px edge + 40px button + 16px gap ≈ 5.75rem
 */
export const LIVE_PANEL_RIGHT_INSET =
  "right-4 sm:right-[5rem] md:right-[5.25rem] lg:right-[5.5rem] xl:right-[5.75rem]";

/** Max width for compact side panels (rem-based — scales with user font size). */
export const LIVE_PANEL_MAX_WIDTH =
  "max-w-[min(17.5rem,calc(100%-5rem))]";

/**
 * Viewport-anchored side/bottom sheet — use instead of absolute inside the map shell
 * (overflow-hidden ancestors clip absolute panels).
 */
export const LIVE_FIXED_PANEL =
  "pointer-events-auto fixed z-[140] flex flex-col overflow-hidden bg-white text-sm shadow-[0_8px_30px_rgba(0,0,0,0.12)]";

/** Mobile bottom sheet; desktop compact right rail — height grows with content up to max. */
export const LIVE_RESPONSIVE_PANEL_LAYOUT = [
  LIVE_FIXED_PANEL,
  "inset-x-0 bottom-0 max-h-[min(70vh,calc(100dvh-4.5rem))] rounded-t-xl border-t border-stone-200/80",
  "lg:inset-x-auto lg:bottom-4 lg:top-auto lg:max-h-[min(85vh,calc(100dvh-5.5rem))]",
  LIVE_PANEL_RIGHT_INSET,
  "lg:w-[min(17.5rem,calc(100vw-5.5rem))] lg:rounded-xl lg:border lg:border-stone-200/80",
].join(" ");

/** Compact route summary above the bottom-left map dock. */
export const LIVE_ROUTE_SUMMARY_BOTTOM =
  "bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))] md:bottom-[calc(5.75rem+env(safe-area-inset-bottom,0px))]";

/** Live map view tilt — flat vs perspective (Google Maps–style 2D/3D). */
export type LiveMapViewMode = "2d" | "3d";

export const LIVE_MAP_2D_PITCH = 0;
export const LIVE_MAP_3D_PITCH = 60;
/** Pitch at or above this value is treated as 3D view. */
export const LIVE_MAP_3D_PITCH_THRESHOLD = 30;
