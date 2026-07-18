import type maplibregl from "maplibre-gl";

export type FriendLocation = {
  userId: string;
  name: string;
  lat: number;
  lng: number;
  lastSeenAt: string;
  status: "active" | "idle" | "stale";
  avatarUrl?: string;
  speedMps?: number | null;
  heading?: number | null;
};

const FRIENDS_SOURCE_ID = "rovvy-friends-source";
const FRIENDS_DOT_LAYER_ID = "rovvy-friends-dot";
const FRIENDS_CASING_LAYER_ID = "rovvy-friends-casing";
const FRIENDS_LABEL_LAYER_ID = "rovvy-friends-labels";

/**
 * Synchronize real-time friend/member positions on the MapLibre canvas.
 * Follows the standard GeoJSON source/layer orchestration pattern.
 */
export function syncFriendLocationsOverlay(
  map: maplibregl.Map,
  friends: FriendLocation[],
  enabled: boolean,
): void {
  if (!map) return;

  const cleanUp = () => {
    if (map.getLayer(FRIENDS_LABEL_LAYER_ID)) map.removeLayer(FRIENDS_LABEL_LAYER_ID);
    if (map.getLayer(FRIENDS_DOT_LAYER_ID)) map.removeLayer(FRIENDS_DOT_LAYER_ID);
    if (map.getLayer(FRIENDS_CASING_LAYER_ID)) map.removeLayer(FRIENDS_CASING_LAYER_ID);
    if (map.getSource(FRIENDS_SOURCE_ID)) map.removeSource(FRIENDS_SOURCE_ID);
  };

  if (!enabled || friends.length === 0) {
    cleanUp();
    return;
  }

  // Construct FeatureCollection GeoJSON
  const geojson: GeoJSON.FeatureCollection<GeoJSON.Point> = {
    type: "FeatureCollection",
    features: friends.map((f) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [f.lng, f.lat],
      },
      properties: {
        id: f.userId,
        name: f.name,
        status: f.status,
        heading: f.heading || 0,
        speedMps: f.speedMps || 0,
      },
    })),
  };

  try {
    // 1. Ensure GeoJSON source exists
    let source = map.getSource(FRIENDS_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    if (!source) {
      map.addSource(FRIENDS_SOURCE_ID, {
        type: "geojson",
        data: geojson,
      });
      source = map.getSource(FRIENDS_SOURCE_ID) as maplibregl.GeoJSONSource;
    } else {
      source.setData(geojson);
    }

    // 2. Add white glow casing/border layer
    if (!map.getLayer(FRIENDS_CASING_LAYER_ID)) {
      map.addLayer({
        id: FRIENDS_CASING_LAYER_ID,
        type: "circle",
        source: FRIENDS_SOURCE_ID,
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            4, 4,
            12, 8,
            20, 14
          ],
          "circle-color": "#ffffff",
          "circle-opacity": 0.85,
          "circle-stroke-width": 1,
          "circle-stroke-color": "rgba(15,23,42,0.15)",
        },
      });
    }

    // 3. Add core dot layer (colors based on status)
    if (!map.getLayer(FRIENDS_DOT_LAYER_ID)) {
      map.addLayer({
        id: FRIENDS_DOT_LAYER_ID,
        type: "circle",
        source: FRIENDS_SOURCE_ID,
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            4, 2.5,
            12, 5.5,
            20, 10
          ],
          "circle-color": [
            "match",
            ["get", "status"],
            "active", "#0F766E", // Brand primary teal
            "idle", "#F59E0B",   // Warning amber
            "#6B7280"           // Stale gray
          ],
          "circle-opacity": 0.95,
        },
      });
    }

    // 4. Add text label layer (shows member name)
    if (!map.getLayer(FRIENDS_LABEL_LAYER_ID)) {
      map.addLayer({
        id: FRIENDS_LABEL_LAYER_ID,
        type: "symbol",
        source: FRIENDS_SOURCE_ID,
        layout: {
          "text-field": ["get", "name"],
          "text-size": [
            "interpolate",
            ["linear"],
            ["zoom"],
            4, 8,
            12, 11,
            20, 13
          ],
          "text-offset": [0, 1.5],
          "text-anchor": "top",
          "text-max-width": 8,
          "text-allow-overlap": false,
          "text-ignore-placement": false,
        },
        paint: {
          "text-color": "#0F172A", // Dark navy slate
          "text-halo-color": "#ffffff",
          "text-halo-width": 2,
        },
      });
    }
  } catch (error) {
    console.error("Failed to synchronize friend tracking map layers:", error);
  }
}
