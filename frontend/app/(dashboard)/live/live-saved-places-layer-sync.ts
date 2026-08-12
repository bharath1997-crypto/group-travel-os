import type maplibregl from "maplibre-gl";
import type { LiveSavedPlace } from "./live-saved-places-store";

export const SAVED_PLACES_SOURCE_ID = "rovvy-saved-places-source";
export const SAVED_PLACES_PIN_LAYER_ID = "rovvy-saved-places-pin";
export const SAVED_PLACES_LABEL_LAYER_ID = "rovvy-saved-places-label";

function removeSavedPlacesLayers(map: maplibregl.Map): void {
  try {
    if (map.getLayer(SAVED_PLACES_LABEL_LAYER_ID)) map.removeLayer(SAVED_PLACES_LABEL_LAYER_ID);
    if (map.getLayer(SAVED_PLACES_PIN_LAYER_ID)) map.removeLayer(SAVED_PLACES_PIN_LAYER_ID);
    if (map.getSource(SAVED_PLACES_SOURCE_ID)) map.removeSource(SAVED_PLACES_SOURCE_ID);
  } catch {
    /* style swap race */
  }
}

export function syncSavedPlacesOverlay(
  map: maplibregl.Map,
  places: LiveSavedPlace[],
  enabled: boolean,
): void {
  if (!map) return;

  if (!enabled || places.length === 0) {
    removeSavedPlacesLayers(map);
    return;
  }

  const geojson: GeoJSON.FeatureCollection<GeoJSON.Point> = {
    type: "FeatureCollection",
    features: places.map((p) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [p.lng, p.lat] },
      properties: {
        id: p.id,
        name: p.name,
      },
    })),
  };

  try {
    let source = map.getSource(SAVED_PLACES_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    if (!source) {
      map.addSource(SAVED_PLACES_SOURCE_ID, { type: "geojson", data: geojson });
      source = map.getSource(SAVED_PLACES_SOURCE_ID) as maplibregl.GeoJSONSource;
    } else {
      source.setData(geojson);
    }

    if (!map.getLayer(SAVED_PLACES_PIN_LAYER_ID)) {
      map.addLayer({
        id: SAVED_PLACES_PIN_LAYER_ID,
        type: "circle",
        source: SAVED_PLACES_SOURCE_ID,
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            8,
            5,
            14,
            9,
            18,
            12,
          ],
          "circle-color": "#0F766E",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
          "circle-opacity": 0.95,
        },
      });
    }

    if (!map.getLayer(SAVED_PLACES_LABEL_LAYER_ID)) {
      map.addLayer({
        id: SAVED_PLACES_LABEL_LAYER_ID,
        type: "symbol",
        source: SAVED_PLACES_SOURCE_ID,
        minzoom: 12,
        layout: {
          "text-field": ["get", "name"],
          "text-size": 11,
          "text-offset": [0, 1.4],
          "text-anchor": "top",
          "text-max-width": 10,
          "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
        },
        paint: {
          "text-color": "#0F766E",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.5,
        },
      });
    }
  } catch {
    /* style not ready */
  }
}

/** Register click on saved-place pins. Returns cleanup. */
export function bindSavedPlacesLayerClick(
  map: maplibregl.Map,
  onSelect: (placeId: string) => void,
): () => void {
  const handler = (
    e: maplibregl.MapLayerMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] },
  ) => {
    const feature = e.features?.[0];
    const id = feature?.properties?.id;
    if (typeof id === "string" && id) {
      e.originalEvent.preventDefault();
      e.originalEvent.stopPropagation();
      onSelect(id);
    }
  };

  map.on("click", SAVED_PLACES_PIN_LAYER_ID, handler);
  map.on("mouseenter", SAVED_PLACES_PIN_LAYER_ID, () => {
    map.getCanvas().style.cursor = "pointer";
  });
  map.on("mouseleave", SAVED_PLACES_PIN_LAYER_ID, () => {
    map.getCanvas().style.cursor = "";
  });

  return () => {
    map.off("click", SAVED_PLACES_PIN_LAYER_ID, handler);
  };
}
