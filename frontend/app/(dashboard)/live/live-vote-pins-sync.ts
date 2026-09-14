import maplibregl from "maplibre-gl";
import { createVotePinElement, type VoteMapPin } from "./live-vote-marker-elements";

export function syncVotePinMarkers(
  map: maplibregl.Map,
  pins: VoteMapPin[],
  onPinClick: ((pinId: string) => void) | undefined,
  markersOut: maplibregl.Marker[],
): maplibregl.Marker[] {
  markersOut.forEach((marker) => marker.remove());
  if (!pins.length) return [];

  const next: maplibregl.Marker[] = [];
  for (const pin of pins) {
    const el = createVotePinElement(pin);
    el.addEventListener("click", (event) => {
      event.stopPropagation();
      onPinClick?.(pin.id);
    });
    next.push(
      new maplibregl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([pin.lng, pin.lat])
        .addTo(map),
    );
  }
  return next;
}
