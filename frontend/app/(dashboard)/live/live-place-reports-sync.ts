import type maplibregl from "maplibre-gl";
import type { LivePlaceReportSummary } from "./live-place-report-types";
import { livePlaceReportLabel } from "./live-place-report-types";

export const PLACE_REPORTS_SOURCE_ID = "rovvy-place-reports-source";
export const PLACE_REPORTS_PIN_LAYER_ID = "rovvy-place-reports-pin";
export const PLACE_REPORTS_LABEL_LAYER_ID = "rovvy-place-reports-label";

function removePlaceReportsLayers(map: maplibregl.Map): void {
  try {
    if (map.getLayer(PLACE_REPORTS_LABEL_LAYER_ID)) map.removeLayer(PLACE_REPORTS_LABEL_LAYER_ID);
    if (map.getLayer(PLACE_REPORTS_PIN_LAYER_ID)) map.removeLayer(PLACE_REPORTS_PIN_LAYER_ID);
    if (map.getSource(PLACE_REPORTS_SOURCE_ID)) map.removeSource(PLACE_REPORTS_SOURCE_ID);
  } catch {
    /* style swap race */
  }
}

export function syncPlaceReportsOverlay(
  map: maplibregl.Map,
  reports: LivePlaceReportSummary[],
  enabled: boolean,
): void {
  if (!map) return;

  if (!enabled || reports.length === 0) {
    removePlaceReportsLayers(map);
    return;
  }

  const geojson: GeoJSON.FeatureCollection<GeoJSON.Point> = {
    type: "FeatureCollection",
    features: reports.map((report, index) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [report.lng, report.lat] },
      properties: {
        id: `${report.reportType}:${index}`,
        label: livePlaceReportLabel(report.reportType),
        confirmed: report.confirmed ? 1 : 0,
        matchCount: report.matchCount,
      },
    })),
  };

  try {
    let source = map.getSource(PLACE_REPORTS_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    if (!source) {
      map.addSource(PLACE_REPORTS_SOURCE_ID, { type: "geojson", data: geojson });
      source = map.getSource(PLACE_REPORTS_SOURCE_ID) as maplibregl.GeoJSONSource;
    } else {
      source.setData(geojson);
    }

    if (!map.getLayer(PLACE_REPORTS_PIN_LAYER_ID)) {
      map.addLayer({
        id: PLACE_REPORTS_PIN_LAYER_ID,
        type: "circle",
        source: PLACE_REPORTS_SOURCE_ID,
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            10,
            5,
            14,
            8,
            18,
            11,
          ],
          "circle-color": [
            "case",
            ["==", ["get", "confirmed"], 1],
            "#0E6E5C",
            "#B4453D",
          ],
          "circle-stroke-color": "#FFFFFF",
          "circle-stroke-width": 2,
          "circle-opacity": 0.92,
        },
      });
    }

    if (!map.getLayer(PLACE_REPORTS_LABEL_LAYER_ID)) {
      map.addLayer({
        id: PLACE_REPORTS_LABEL_LAYER_ID,
        type: "symbol",
        source: PLACE_REPORTS_SOURCE_ID,
        minzoom: 13,
        layout: {
          "text-field": ["get", "label"],
          "text-size": 11,
          "text-offset": [0, 1.4],
          "text-anchor": "top",
          "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
        },
        paint: {
          "text-color": "#0F1614",
          "text-halo-color": "#FFFFFF",
          "text-halo-width": 1.2,
        },
      });
    }
  } catch {
    removePlaceReportsLayers(map);
  }
}
