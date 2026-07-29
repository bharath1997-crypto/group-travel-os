/**
 * Live place preview panel — viewport-ratio sizing + optional user resize.
 * Uses vw/vh/rem clamps so font-size and screen width both scale the card.
 */

import type { CSSProperties } from "react";

export const LIVE_PREVIEW_PANEL_SIZE_KEY = "rovvy_live_preview_panel_size_v1";
export const LIVE_WAYRA_WIDTH_CSS_VAR = "--live-wayra-width";
export const LIVE_PREVIEW_WIDTH_CSS_VAR = "--live-preview-width";

/** Default width as % of viewport (scales with window, not fixed px). */
export const LIVE_PREVIEW_DEFAULT_WIDTH_VW = 22;
export const LIVE_PREVIEW_MIN_WIDTH_VW = 14;
export const LIVE_PREVIEW_MAX_WIDTH_VW = 36;

export const LIVE_PREVIEW_DEFAULT_MAX_HEIGHT_VH = 75;
export const LIVE_PREVIEW_MIN_MAX_HEIGHT_VH = 40;
export const LIVE_PREVIEW_MAX_MAX_HEIGHT_VH = 90;

export type LivePreviewPanelSize = {
  widthVw: number;
  maxHeightVh: number;
};

export const LIVE_PREVIEW_DEFAULT_SIZE: LivePreviewPanelSize = {
  widthVw: LIVE_PREVIEW_DEFAULT_WIDTH_VW,
  maxHeightVh: LIVE_PREVIEW_DEFAULT_MAX_HEIGHT_VH,
};

export function clampPanelSize(size: Partial<LivePreviewPanelSize>): LivePreviewPanelSize {
  const widthVw = Math.min(
    LIVE_PREVIEW_MAX_WIDTH_VW,
    Math.max(LIVE_PREVIEW_MIN_WIDTH_VW, size.widthVw ?? LIVE_PREVIEW_DEFAULT_WIDTH_VW),
  );
  const maxHeightVh = Math.min(
    LIVE_PREVIEW_MAX_MAX_HEIGHT_VH,
    Math.max(LIVE_PREVIEW_MIN_MAX_HEIGHT_VH, size.maxHeightVh ?? LIVE_PREVIEW_DEFAULT_MAX_HEIGHT_VH),
  );
  return { widthVw, maxHeightVh };
}

export function loadLivePreviewPanelSize(): LivePreviewPanelSize {
  if (typeof window === "undefined") return LIVE_PREVIEW_DEFAULT_SIZE;
  try {
    const raw = localStorage.getItem(LIVE_PREVIEW_PANEL_SIZE_KEY);
    if (!raw) return LIVE_PREVIEW_DEFAULT_SIZE;
    const parsed = JSON.parse(raw) as Partial<LivePreviewPanelSize>;
    return clampPanelSize(parsed);
  } catch {
    return LIVE_PREVIEW_DEFAULT_SIZE;
  }
}

export function saveLivePreviewPanelSize(size: LivePreviewPanelSize): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LIVE_PREVIEW_PANEL_SIZE_KEY, JSON.stringify(clampPanelSize(size)));
}

/** CSS clamp fallbacks when user has not resized (rem + vw). */
export const LIVE_PREVIEW_WIDTH_CLAMP =
  "clamp(14rem, var(--live-preview-width, 22vw), min(36rem, 42vw))";

export const LIVE_WAYRA_WIDTH_CLAMP =
  "clamp(18rem, var(--live-wayra-width, 24vw), min(32rem, 38vw))";

export function livePreviewPanelStyle(size: LivePreviewPanelSize): CSSProperties {
  return {
    [LIVE_PREVIEW_WIDTH_CSS_VAR]: `${size.widthVw}vw`,
    ["--live-preview-max-height" as string]: `${size.maxHeightVh}dvh`,
    width: `min(${size.widthVw}vw, calc(100vw - 5rem))`,
    maxWidth: `${LIVE_PREVIEW_MAX_WIDTH_VW}rem`,
    minWidth: "14rem",
    maxHeight: `min(${size.maxHeightVh}dvh, calc(100dvh - var(--live-sheet-bottom, 4rem) - 2rem))`,
  };
}

export function livePreviewRightWhenWayraOpen(): string {
  return `calc(${LIVE_WAYRA_WIDTH_CLAMP} + 0.75rem)`;
}

type PreviewPanelFrameOpts = {
  sheetBottom: string;
  isPhoneLayout: boolean;
  wayraChatOpen: boolean;
  isDesktop: boolean;
  size: LivePreviewPanelSize;
};

/** Viewport-anchored frame — inline styles so layout never depends on fragile Tailwind calcs. */
export function buildLivePreviewPanelFrameStyle({
  sheetBottom,
  isPhoneLayout,
  wayraChatOpen,
  isDesktop,
  size,
}: PreviewPanelFrameOpts): CSSProperties {
  const base: CSSProperties = {
    position: "fixed",
    zIndex: 140,
    bottom: sheetBottom,
    pointerEvents: "auto",
  };

  if (isPhoneLayout) {
    return {
      ...base,
      left: 0,
      right: 0,
      width: "100%",
      maxWidth: "100%",
      maxHeight: `min(85dvh, calc(100dvh - ${sheetBottom} - 3rem))`,
    };
  }

  const maxHeight = `min(${size.maxHeightVh}dvh, calc(100dvh - ${sheetBottom} - 2rem))`;

  if (wayraChatOpen && isDesktop) {
    return {
      ...base,
      left: "auto",
      right: "calc(clamp(18rem, 24vw, 32rem) + 0.75rem)",
      width: `min(${size.widthVw}vw, calc(100vw - clamp(18rem, 24vw, 32rem) - 3rem))`,
      minWidth: "14rem",
      maxWidth: "36rem",
      maxHeight,
    };
  }

  if (wayraChatOpen && !isDesktop) {
    return {
      ...base,
      left: "0.5rem",
      right: "auto",
      width: "min(88vw, calc(100vw - 1rem))",
      minWidth: "14rem",
      maxHeight: "min(45dvh, calc(100dvh - 20rem))",
    };
  }

  return {
    ...base,
    left: "auto",
    right: "max(1rem, min(5.75rem, 6vw))",
    width: `min(${size.widthVw}vw, calc(100vw - 6rem))`,
    minWidth: "14rem",
    maxWidth: "36rem",
    maxHeight,
  };
}
