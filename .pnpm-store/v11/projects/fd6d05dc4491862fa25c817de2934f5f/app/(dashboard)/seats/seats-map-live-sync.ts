import type maplibregl from "maplibre-gl";
import { geodesicCircleRing } from "./seats-map-geo";
import { SEATSHARE_MAX_DISTANCE_MILES } from "./seats-route";

const RADIUS_SOURCE = "seats-live-radius";
const RADIUS_FILL = "seats-live-radius-fill";
const RADIUS_LINE = "seats-live-radius-line";

export function syncSeatShareRadiusOverlay(
  map: maplibregl.Map,
  center: { lat: number; lng: number } | null,
  radiusMiles = SEATSHARE_MAX_DISTANCE_MILES,
): void {
  if (map.getLayer(RADIUS_FILL)) map.removeLayer(RADIUS_FILL);
  if (map.getLayer(RADIUS_LINE)) map.removeLayer(RADIUS_LINE);
  if (map.getSource(RADIUS_SOURCE)) map.removeSource(RADIUS_SOURCE);

  if (!center) return;

  const ring = geodesicCircleRing(center, radiusMiles);
  const data: GeoJSON.Feature<GeoJSON.Polygon> = {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [ring] },
  };

  map.addSource(RADIUS_SOURCE, { type: "geojson", data });
  map.addLayer({
    id: RADIUS_FILL,
    type: "fill",
    source: RADIUS_SOURCE,
    paint: {
      "fill-color": "#0F766E",
      "fill-opacity": 0.06,
    },
  });
  map.addLayer({
    id: RADIUS_LINE,
    type: "line",
    source: RADIUS_SOURCE,
    paint: {
      "line-color": "#0F766E",
      "line-width": 2,
      "line-opacity": 0.55,
      "line-dasharray": [2, 2],
    },
  });
}
