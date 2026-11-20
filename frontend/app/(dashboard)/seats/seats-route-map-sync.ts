import type maplibregl from "maplibre-gl";
import type { RouteOption } from "./seats-route";

const SOURCE_ID = "seats-routes";
const LAYER_PREFIX = "seats-route-line-";

/** Safe when the map is mid-teardown (MapLibre throws after map.remove()). */
export function removeSeatShareRouteLayers(map: maplibregl.Map | null | undefined): void {
  if (!map) return;
  try {
    for (let i = 0; i < 3; i += 1) {
      const layerId = `${LAYER_PREFIX}${i}`;
      if (map.getLayer(layerId)) map.removeLayer(layerId);
    }
    if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
  } catch {
    /* map already destroyed */
  }
}

export function syncSeatShareRouteLayers(
  map: maplibregl.Map,
  options: RouteOption[],
  selectedId: string | null,
  onSelect: (id: string) => void,
): () => void {
  const handlers: { layerId: string; fn: (e: maplibregl.MapLayerMouseEvent) => void }[] = [];

  removeSeatShareRouteLayers(map);

  if (options.length === 0) {
    return () => undefined;
  }

  const features: GeoJSON.Feature<GeoJSON.LineString>[] = options.map((opt) => ({
    type: "Feature",
    properties: { routeId: opt.id },
    geometry: { type: "LineString", coordinates: opt.geometry },
  }));

  map.addSource(SOURCE_ID, {
    type: "geojson",
    data: { type: "FeatureCollection", features },
  });

  options.forEach((opt, index) => {
    const layerId = `${LAYER_PREFIX}${index}`;
    const active = opt.id === selectedId || (!selectedId && index === 0);
    map.addLayer({
      id: layerId,
      type: "line",
      source: SOURCE_ID,
      filter: ["==", ["get", "routeId"], opt.id],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": active ? "#0F766E" : "#94A3B8",
        "line-width": active ? 6 : 4,
        "line-opacity": active ? 0.95 : 0.55,
      },
    });

    map.on("mouseenter", layerId, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", layerId, () => {
      map.getCanvas().style.cursor = "";
    });

    const fn = (e: maplibregl.MapLayerMouseEvent) => {
      e.preventDefault();
      const id = e.features?.[0]?.properties?.routeId;
      if (typeof id === "string") onSelect(id);
    };
    map.on("click", layerId, fn);
    handlers.push({ layerId, fn });
  });

  return () => {
    for (const { layerId, fn } of handlers) {
      try {
        map.off("click", layerId, fn);
      } catch {
        /* map already destroyed */
      }
    }
    removeSeatShareRouteLayers(map);
  };
}

export function fitMapToRoute(map: maplibregl.Map, geometry: [number, number][]): void {
  if (geometry.length < 2) return;
  let minLng = geometry[0][0];
  let maxLng = geometry[0][0];
  let minLat = geometry[0][1];
  let maxLat = geometry[0][1];
  for (const [lng, lat] of geometry) {
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }
  map.fitBounds(
    [
      [minLng, minLat],
      [maxLng, maxLat],
    ],
    { padding: 48, duration: 450, maxZoom: 12 },
  );
}
