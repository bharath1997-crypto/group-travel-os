import type { UserSearchResultRow } from "@/lib/lounge/hub-types";

/**
 * Rovvy Lounge is a global, independent overlay — not owned by any page route.
 * Pages may request it to open via this event only (one-way). Lounge reads URL
 * deep-link params itself; pages must not write lounge session state.
 */
export const OPEN_LOUNGE_EVENT = "rovvy:open-lounge";

/** Query params the dock reads on its own (e.g. profile QR scans). */
export const LOUNGE_URL_CONNECT = "rovvy_connect";
export const LOUNGE_URL_CREATE_GROUP = "rovvy_create_group";

export type OpenLoungeDetail = {
  connectUserId?: string;
  createGroup?: boolean;
  openDmUserId?: string;
  openProfile?: UserSearchResultRow;
};

export function emitOpenLounge(detail?: OpenLoungeDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPEN_LOUNGE_EVENT, { detail }));
}

export function toggleLounge(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("toggle-rovvy-lounge"));
}
