import { extractLiveSelectedPlace } from "@/lib/wayra/intent";

/** Stable key for a map pin — one ephemeral Wayra chat per key on Live. */
export function livePlacePinKey(lat: number, lng: number): string {
  return `${lat.toFixed(5)},${lng.toFixed(5)}`;
}

/** Live preview / destination pins use temporary chat threads that must not carry over. */
export function extractLivePinKey(context: Record<string, unknown>): string | null {
  const scope = context.wayraScope;
  if (scope !== "place_preview" && scope !== "destination") return null;
  const place = extractLiveSelectedPlace(context);
  if (!place) return null;
  return livePlacePinKey(place.lat, place.lng);
}

export function isLivePreviewPinContext(context: Record<string, unknown>): boolean {
  return context.wayraScope === "place_preview" && extractLivePinKey(context) !== null;
}

export function isLivePinScopedMessage(message: { livePinKey?: string | null }): boolean {
  return Boolean(message.livePinKey);
}

export function withoutLivePinMessages<T extends { livePinKey?: string | null }>(
  messages: T[],
): T[] {
  return messages.filter((row) => !row.livePinKey);
}
