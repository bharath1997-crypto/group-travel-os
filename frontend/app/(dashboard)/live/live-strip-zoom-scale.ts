import { clampLiveMapZoomValue } from "./live-map-zoom-limits";

/** Normalized zoom position on the strip scale (0 = min, 1 = max). */
export function liveStripZoomPercent(
  zoom: number,
  minZoom: number,
  maxZoom: number,
): number {
  const span = Math.max(maxZoom - minZoom, 0.001);
  return Math.min(1, Math.max(0, (zoom - minZoom) / span));
}

/** Map pointer x on the scale track back to a clamped zoom level. */
export function liveStripZoomFromTrackX(
  clientX: number,
  trackLeft: number,
  trackWidth: number,
  minZoom: number,
  maxZoom: number,
): number {
  if (trackWidth <= 0) {
    return clampLiveMapZoomValue(minZoom, minZoom, maxZoom);
  }
  const ratio = Math.min(1, Math.max(0, (clientX - trackLeft) / trackWidth));
  const next = minZoom + ratio * (maxZoom - minZoom);
  return clampLiveMapZoomValue(next, minZoom, maxZoom);
}

/** Tick mark heights (px) — varied like a map scale ruler. */
export const LIVE_STRIP_ZOOM_TICK_HEIGHTS = [3, 5, 4, 6, 3, 5, 4, 7, 3, 5, 4, 6, 3] as const;
