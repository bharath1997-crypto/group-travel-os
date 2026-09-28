import type { Map as MaplibreMap, MapMouseEvent, MapTouchEvent } from "maplibre-gl";

import {
  LIVE_MAP_LONG_PRESS_MS,
  LIVE_MAP_LONG_PRESS_MOVE_PX,
  type MapLongPressPayload,
} from "./live-map-long-press";
import { resolveMapTapLngLat } from "./live-map-tap-coords";

export type MapLongPressBinding = {
  cancel: () => void;
};

export function bindMapLongPress(
  map: MaplibreMap,
  onLongPress: (payload: MapLongPressPayload) => void,
  onSuppressClick?: () => void,
): MapLongPressBinding {
  let timer: number | null = null;
  let startPoint: { x: number; y: number } | null = null;
  let pendingLngLat: { lat: number; lng: number } | null = null;

  const clear = () => {
    if (timer) window.clearTimeout(timer);
    timer = null;
    startPoint = null;
    pendingLngLat = null;
  };

  const fire = (screenX: number, screenY: number) => {
    if (!pendingLngLat) return;
    onSuppressClick?.();
    onLongPress({
      lat: pendingLngLat.lat,
      lng: pendingLngLat.lng,
      screenX,
      screenY,
    });
    clear();
  };

  const start = (point: { x: number; y: number }, lngLat?: { lat: number; lng: number }) => {
    clear();
    const resolved = resolveMapTapLngLat(map, point, lngLat);
    if (!resolved) return;
    startPoint = point;
    pendingLngLat = resolved;
    timer = window.setTimeout(() => fire(point.x, point.y), LIVE_MAP_LONG_PRESS_MS);
  };

  const onMove = (point: { x: number; y: number }) => {
    if (!startPoint) return;
    const dx = point.x - startPoint.x;
    const dy = point.y - startPoint.y;
    if (Math.hypot(dx, dy) > LIVE_MAP_LONG_PRESS_MOVE_PX) clear();
  };

  const onMouseDown = (event: MapMouseEvent) => {
    if (event.originalEvent.button !== 0) return;
    start(event.point, event.lngLat);
  };

  const onTouchStart = (event: MapTouchEvent) => {
    if (event.points.length !== 1) {
      clear();
      return;
    }
    start(event.points[0], event.lngLat);
  };

  map.on("mousedown", onMouseDown);
  map.on("mouseup", clear);
  map.on("mouseout", clear);
  map.on("mousemove", (event) => onMove(event.point));
  map.on("dragstart", clear);
  map.on("touchstart", onTouchStart);
  map.on("touchend", clear);
  map.on("touchcancel", clear);
  map.on("touchmove", (event) => {
    if (event.points[0]) onMove(event.points[0]);
  });

  return { cancel: clear };
}
