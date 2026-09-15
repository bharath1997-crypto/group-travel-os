import maplibregl from "maplibre-gl";
import { createConvoyPinElement } from "./live-convoy-marker-elements";
import type { ConvoyMapPin } from "./live-convoy-map-pins";

export function syncConvoyPinMarkers(
  map: maplibregl.Map,
  pins: ConvoyMapPin[],
  onPinClick: ((pinId: string) => void) | undefined,
  markersOut: maplibregl.Marker[],
): maplibregl.Marker[] {
  markersOut.forEach((marker) => marker.remove());
  if (!pins.length) return [];

  const next: maplibregl.Marker[] = [];
  for (const pin of pins) {
    const el = createConvoyPinElement(pin);
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
