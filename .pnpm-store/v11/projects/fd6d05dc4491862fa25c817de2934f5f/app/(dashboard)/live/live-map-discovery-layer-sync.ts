import {
  Popup,
  type GeoJSONSource,
  type Map as MaplibreMap,
  type MapLayerMouseEvent,
} from "maplibre-gl";
import type { LiveDiscoveryLayerPoint } from "./live-map-discovery-layer-network";
import { getPoiMarkerPresentation } from "./live-poi-icons";

export const LIVE_DISCOVERY_SOURCE_ID = "rovvy-discovery-layer";
export const LIVE_DISCOVERY_CLUSTER_LAYER = "rovvy-discovery-clusters";
export const LIVE_DISCOVERY_CLUSTER_COUNT_LAYER = "rovvy-discovery-cluster-count";
export const LIVE_DISCOVERY_PIN_LAYER = "rovvy-discovery-pins";

const CLUSTER_MAX_ZOOM = 16;
const CLUSTER_RADIUS = 42;

function pointsToFeatureCollection(points: LiveDiscoveryLayerPoint[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: points.map((p, index) => ({
      type: "Feature",
      id: p.placeKey ?? p.id ?? `discovery-${index}`,
      geometry: {
        type: "Point",
        coordinates: [p.lng, p.lat],
      },
      properties: {
        name: p.name,
        category: p.category,
        placeKey: p.placeKey ?? p.id ?? "",
        osmType: p.osmType ?? "",
        osmId: p.osmId != null ? String(p.osmId) : "",
        gersId: p.gersId ?? "",
        pinColor: getPoiMarkerPresentation({
          name: p.name,
          categoryLabel: p.category,
          tags: p.tags,
        }).background,
        spineJson: p.spine ? JSON.stringify(p.spine) : "",
        address: p.address ?? "",
      },
    })),
  };
}

export function syncLiveDiscoveryLayer(
  map: MaplibreMap,
  points: LiveDiscoveryLayerPoint[],
  enabled: boolean,
): void {
  if (!enabled) {
    if (map.getLayer(LIVE_DISCOVERY_PIN_LAYER)) map.removeLayer(LIVE_DISCOVERY_PIN_LAYER);
    if (map.getLayer(LIVE_DISCOVERY_CLUSTER_COUNT_LAYER)) {
      map.removeLayer(LIVE_DISCOVERY_CLUSTER_COUNT_LAYER);
    }
    if (map.getLayer(LIVE_DISCOVERY_CLUSTER_LAYER)) map.removeLayer(LIVE_DISCOVERY_CLUSTER_LAYER);
    if (map.getSource(LIVE_DISCOVERY_SOURCE_ID)) map.removeSource(LIVE_DISCOVERY_SOURCE_ID);
    return;
  }

  const data = pointsToFeatureCollection(points);
  const existing = map.getSource(LIVE_DISCOVERY_SOURCE_ID) as GeoJSONSource | undefined;
  if (existing) {
    existing.setData(data);
    return;
  }

  map.addSource(LIVE_DISCOVERY_SOURCE_ID, {
    type: "geojson",
    data,
    cluster: true,
    clusterMaxZoom: CLUSTER_MAX_ZOOM,
    clusterRadius: CLUSTER_RADIUS,
  });

  map.addLayer({
    id: LIVE_DISCOVERY_CLUSTER_LAYER,
    type: "circle",
    source: LIVE_DISCOVERY_SOURCE_ID,
    filter: ["has", "point_count"],
    paint: {
      "circle-color": "#0F766E",
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["zoom"],
        8,
        ["step", ["get", "point_count"], 20, 10, 24, 50, 30],
        12,
        ["step", ["get", "point_count"], 18, 10, 22, 50, 28],
        15,
        ["step", ["get", "point_count"], 14, 8, 18, 24, 24],
      ],
      "circle-opacity": 0.88,
      "circle-stroke-width": 2,
      "circle-stroke-color": "#ffffff",
    },
  });

  map.addLayer({
    id: LIVE_DISCOVERY_CLUSTER_COUNT_LAYER,
    type: "symbol",
    source: LIVE_DISCOVERY_SOURCE_ID,
    filter: ["has", "point_count"],
    layout: {
      "text-field": "{point_count_abbreviated}",
      "text-size": 11,
      "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
    },
    paint: {
      "text-color": "#ffffff",
    },
  });

  map.addLayer({
    id: LIVE_DISCOVERY_PIN_LAYER,
    type: "circle",
    source: LIVE_DISCOVERY_SOURCE_ID,
    filter: ["!", ["has", "point_count"]],
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 7, 12, 9, 16, 10],
      "circle-color": ["coalesce", ["get", "pinColor"], "#0F766E"],
      "circle-stroke-width": 2,
      "circle-stroke-color": "#ffffff",
      "circle-opacity": 0.95,
    },
  });
}

export type DiscoveryClusterHint = {
  count: number;
  lat: number;
  lng: number;
};

export function bindLiveDiscoveryLayerInteractions(
  map: MaplibreMap,
  onPinClick: (point: LiveDiscoveryLayerPoint) => void,
  options?: {
    onClusterClick?: (hint: DiscoveryClusterHint) => void;
  },
): () => void {
  let clusterPopup: Popup | null = null;

  const onClusterClick = (e: MapLayerMouseEvent) => {
    const features = map.queryRenderedFeatures(e.point, { layers: [LIVE_DISCOVERY_CLUSTER_LAYER] });
    if (!features.length) return;
    const count = Number(features[0].properties?.point_count ?? 0);
    const clusterId = features[0].properties?.cluster_id as number;
    const source = map.getSource(LIVE_DISCOVERY_SOURCE_ID) as GeoJSONSource;
    const coords = (features[0].geometry as GeoJSON.Point).coordinates as [number, number];
    if (count > 0) {
      options?.onClusterClick?.({ count, lat: coords[1], lng: coords[0] });
    }
    source.getClusterExpansionZoom(clusterId).then((zoom) => {
      map.easeTo({ center: coords, zoom: zoom ?? map.getZoom() + 1 });
    });
  };

  const onClusterEnter = (e: MapLayerMouseEvent) => {
    map.getCanvas().style.cursor = "pointer";
    const feature = e.features?.[0];
    if (!feature) return;
    const count = Number(feature.properties?.point_count ?? 0);
    if (!count) return;
    clusterPopup?.remove();
    clusterPopup = new Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 12,
      className: "rovvy-discovery-cluster-popup",
    })
      .setLngLat(e.lngLat)
      .setHTML(
        `<div style="font-family:system-ui,sans-serif;font-size:12px;line-height:1.35;max-width:200px;padding:2px 0;">
          <strong>${count} places here</strong><br/>
          Too close to show separately at this zoom. Click the circle to zoom in and split the group.
        </div>`,
      )
      .addTo(map);
  };

  const onClusterLeave = () => {
    map.getCanvas().style.cursor = "";
    clusterPopup?.remove();
    clusterPopup = null;
  };

  const handlePinLayerClick = (e: MapLayerMouseEvent) => {
    e.originalEvent?.stopPropagation?.();
    const feature = e.features?.[0];
    if (!feature) return;
    const props = feature.properties ?? {};
    let spine: Record<string, unknown> | null = null;
    if (props.spineJson && typeof props.spineJson === "string") {
      try {
        spine = JSON.parse(props.spineJson) as Record<string, unknown>;
      } catch {
        spine = null;
      }
    }
    const coords = (feature.geometry as GeoJSON.Point).coordinates;
    onPinClick({
      name: String(props.name ?? "Place"),
      category: String(props.category ?? "Place"),
      lat: coords[1],
      lng: coords[0],
      placeKey: String(props.placeKey ?? ""),
      osmType: props.osmType ? String(props.osmType) : null,
      osmId: props.osmId ? Number(props.osmId) : null,
      gersId: props.gersId ? String(props.gersId) : null,
      address: props.address ? String(props.address) : undefined,
      tags: props.gersId ? { gers_id: String(props.gersId) } : {},
      spine,
    });
  };

  map.on("click", LIVE_DISCOVERY_CLUSTER_LAYER, onClusterClick);
  map.on("click", LIVE_DISCOVERY_PIN_LAYER, handlePinLayerClick);
  map.on("mouseenter", LIVE_DISCOVERY_CLUSTER_LAYER, onClusterEnter);
  map.on("mouseleave", LIVE_DISCOVERY_CLUSTER_LAYER, onClusterLeave);
  let pinPopup: Popup | null = null;

  const onPinEnter = (e: MapLayerMouseEvent) => {
    map.getCanvas().style.cursor = "pointer";
    const feature = e.features?.[0];
    if (!feature) return;
    const name = String(feature.properties?.name ?? "Place");
    const category = String(feature.properties?.category ?? "");
    pinPopup?.remove();
    pinPopup = new Popup({ closeButton: false, closeOnClick: false, offset: 10 })
      .setLngLat(e.lngLat)
      .setHTML(
        `<div style="font-family:system-ui,sans-serif;font-size:12px;line-height:1.35;max-width:220px;padding:2px 0;">
          <strong>${name}</strong>${category ? `<br/><span style="color:#5f665f">${category}</span>` : ""}<br/>
          <span style="color:#5f665f">Tap to open place details.</span>
        </div>`,
      )
      .addTo(map);
  };

  const onPinLeave = () => {
    map.getCanvas().style.cursor = "";
    pinPopup?.remove();
    pinPopup = null;
  };

  map.on("mouseenter", LIVE_DISCOVERY_PIN_LAYER, onPinEnter);
  map.on("mouseleave", LIVE_DISCOVERY_PIN_LAYER, onPinLeave);

  return () => {
    clusterPopup?.remove();
    clusterPopup = null;
    pinPopup?.remove();
    pinPopup = null;
    map.off("click", LIVE_DISCOVERY_CLUSTER_LAYER, onClusterClick);
    map.off("click", LIVE_DISCOVERY_PIN_LAYER, handlePinLayerClick);
    map.off("mouseenter", LIVE_DISCOVERY_CLUSTER_LAYER, onClusterEnter);
    map.off("mouseleave", LIVE_DISCOVERY_CLUSTER_LAYER, onClusterLeave);
    map.off("mouseenter", LIVE_DISCOVERY_PIN_LAYER, onPinEnter);
    map.off("mouseleave", LIVE_DISCOVERY_PIN_LAYER, onPinLeave);
  };
}
