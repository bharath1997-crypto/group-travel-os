/**
 * Live map layout — fixed right control rail + panel inset.
 * Map controls stay pinned to the right edge; panels sit to their left.
 */

/** Fixed position for the vertical map control stack. */
export const LIVE_MAP_CONTROLS_POSITION =
  "max-md:bottom-[calc(5.75rem+env(safe-area-inset-bottom,0px))] max-md:top-auto max-md:translate-y-0 max-md:right-3 md:top-1/2 md:-translate-y-1/2 md:right-5 lg:right-6";

/**
 * Right inset for desktop side panels so they never overlap the control rail.
 * ~24px edge + 40px button + 16px gap ≈ 5.75rem
 */
export const LIVE_PANEL_RIGHT_INSET =
  "right-4 sm:right-[5rem] md:right-[5.25rem] lg:right-[5.5rem] xl:right-[5.75rem]";

/** Max width for side panels accounting for control rail + page padding. */
export const LIVE_PANEL_MAX_WIDTH =
  "max-w-[min(410px,calc(100%-6.5rem))]";
