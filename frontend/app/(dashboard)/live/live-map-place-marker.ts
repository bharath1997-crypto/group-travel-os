import { createDestinationMarkerElement } from "./live-marker-elements";
import { createMeetupMarkerElement } from "./live-meetup-marker";

export type LivePlacePinMode = "meetup" | "selected";

export function resolveLivePlaceMarkerAnchor(input: {
  pinMode: LivePlacePinMode;
  navigationMode: boolean;
  pinLabel?: string | null;
}): "center" | "bottom" {
  if (input.navigationMode && !input.pinLabel?.trim()) return "center";
  return "bottom";
}

/** Build the HTML marker + MapLibre anchor for the active place pin. */
export function resolveLivePlaceMarkerContent(input: {
  pinMode: LivePlacePinMode;
  navigationMode: boolean;
  pinLabel?: string | null;
  mapZoom: number;
}): { element: HTMLDivElement; anchor: "center" | "bottom" } {
  const { pinMode, navigationMode, pinLabel, mapZoom } = input;
  const label = pinLabel?.trim() || "Dropped pin";
  const anchor = resolveLivePlaceMarkerAnchor({ pinMode, navigationMode, pinLabel });

  if (navigationMode && !pinLabel?.trim()) {
    return {
      element: createDestinationMarkerElement(true),
      anchor,
    };
  }

  return {
    element: createMeetupMarkerElement(label, mapZoom),
    anchor,
  };
}
