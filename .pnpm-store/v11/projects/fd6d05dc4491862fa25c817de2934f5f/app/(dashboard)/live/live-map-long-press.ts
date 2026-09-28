/** Hold duration before the map point menu opens (desktop + touch). */
export const LIVE_MAP_LONG_PRESS_MS = 900;

/** Cancel long-press if pointer moves farther than this (px). */
export const LIVE_MAP_LONG_PRESS_MOVE_PX = 12;

export type MapLongPressPayload = {
  lat: number;
  lng: number;
  screenX: number;
  screenY: number;
};
