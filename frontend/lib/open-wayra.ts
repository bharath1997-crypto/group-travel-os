/**
 * Cross-component bridge: open the Wayra sidecar from any dashboard CTA.
 * AIAssistantSidecar listens for this event.
 */
export const OPEN_WAYRA_EVENT = "rovvy:open-wayra";
export const TOGGLE_WAYRA_EVENT = "rovvy:toggle-wayra";

export type OpenWayraDetail = {
  /** Optional seed text for the chat input (user can edit before send). */
  prompt?: string;
  /** When true, send the prompt immediately after opening the panel. */
  autoSend?: boolean;
};

/** Live map / preview cards push selected-place context for smarter replies. */
export const WAYRA_CONTEXT_EVENT = "rovvy:wayra-context";

/** Clear ephemeral Live pin chat (e.g. when the place preview card closes). */
export const WAYRA_CLEAR_CONTEXT_EVENT = "rovvy:wayra-clear-context";

export function emitOpenWayra(detail?: OpenWayraDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPEN_WAYRA_EVENT, { detail }));
}

export function emitToggleWayra(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(TOGGLE_WAYRA_EVENT));
}

export function emitClearWayraContext(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(WAYRA_CLEAR_CONTEXT_EVENT));
}
