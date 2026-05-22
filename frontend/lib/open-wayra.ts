/**
 * Cross-component bridge: open the Wayra sidecar from any dashboard CTA.
 * AIAssistantSidecar listens for this event.
 */
export const OPEN_WAYRA_EVENT = "rovvy:open-wayra";

export type OpenWayraDetail = {
  /** Optional seed text for the chat input (user can edit before send). */
  prompt?: string;
};

export function emitOpenWayra(detail?: OpenWayraDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPEN_WAYRA_EVENT, { detail }));
}
