import type maplibregl from "maplibre-gl";

import type { FriendLocation } from "./live-friend-layer-sync";

export type GroupConvergeRouteSegment = {
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
  userId: string;
  color: string;
  dashed?: boolean;
};

const SOURCE_ID = "rovvy-group-converge-routes-source";
const CASING_LAYER_ID = "rovvy-group-converge-routes-casing";
const CORE_LAYER_ID = "rovvy-group-converge-routes-core";

const FRIEND_ROUTE_COLORS = ["#F0C978", "#C9BFFF", "#A8B0AA", "#6FE0C0"];

export function buildGroupConvergeRoutes(
  friends: FriendLocation[],
  destination: { lat: number; lng: number },
  selfLocation: { lat: number; lng: number } | null,
): GroupConvergeRouteSegment[] {
  const segments: GroupConvergeRouteSegment[] = [];

  if (selfLocation) {
    segments.push({
      from: selfLocation,
      to: destination,
      userId: "you",
      color: "#6FE0C0",
      dashed: false,
    });
  }

  friends.forEach((friend, index) => {
    segments.push({
      from: { lat: friend.lat, lng: friend.lng },
      to: destination,
      userId: friend.userId,
      color: FRIEND_ROUTE_COLORS[index % FRIEND_ROUTE_COLORS.length] ?? "#A8B0AA",
      dashed: index % 2 === 0,
    });
  });

  return segments;
}

export function syncGroupConvergeRoutesOverlay(
  map: maplibregl.Map,
  routes: GroupConvergeRouteSegment[],
  enabled: boolean,
): void {
  if (!map) return;

  const cleanUp = () => {
    if (map.getLayer(CORE_LAYER_ID)) map.removeLayer(CORE_LAYER_ID);
    if (map.getLayer(CASING_LAYER_ID)) map.removeLayer(CASING_LAYER_ID);
    if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
  };

  if (!enabled || routes.length === 0) {
    cleanUp();
    return;
  }

  const geojson: GeoJSON.FeatureCollection<GeoJSON.LineString> = {
    type: "FeatureCollection",
    features: routes.map((route) => ({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [route.from.lng, route.from.lat],
          [route.to.lng, route.to.lat],
        ],
      },
      properties: {
        userId: route.userId,
        color: route.color,
        dashed: route.dashed ? 1 : 0,
      },
    })),
  };

  try {
    let source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    if (!source) {
      map.addSource(SOURCE_ID, { type: "geojson", data: geojson });
      source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource;
    } else {
      source.setData(geojson);
    }

    if (!map.getLayer(CASING_LAYER_ID)) {
      map.addLayer({
        id: CASING_LAYER_ID,
        type: "line",
        source: SOURCE_ID,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#FFFFFF",
          "line-width": 5,
          "line-opacity": 0.55,
        },
      });
    }

    if (!map.getLayer(CORE_LAYER_ID)) {
      map.addLayer({
        id: CORE_LAYER_ID,
        type: "line",
        source: SOURCE_ID,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": ["get", "color"],
          "line-width": 3,
          "line-opacity": 0.88,
          "line-dasharray": [
            "case",
            ["==", ["get", "dashed"], 1],
            ["literal", [2.5, 2]],
            ["literal", [1, 0]],
          ],
        },
      });
    }
  } catch {
    cleanUp();
  }
}
