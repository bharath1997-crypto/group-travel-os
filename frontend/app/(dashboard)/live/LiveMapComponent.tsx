"use client";

import React, { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  geolocationErrorMessage,
  geolocationUnavailableMessage,
  haversineM,
} from "@/lib/geo";
import {
  getLiveMapLibreLayerStyles,
  LIVE_MAP_MAX_ZOOM,
  LIVE_MAP_MIN_ZOOM,
  warnIfUnsafeProductionTiles,
} from "@/lib/map-providers";
import type { RouteLine, UserLocationUpdate } from "./live-types";
import { LOCAL_LIVE_MAX_M } from "./live-types";

export type UserLocation = { lat: number; lng: number };

export type LiveMapRef = {
  zoomIn: () => void;
  zoomOut: () => void;
  locateUser: () => void;
  getUserLocation: () => UserLocation | null;
  getMapCenter: () => UserLocation | null;
  isLiveGpsActive: () => boolean;
};

export type MapFollowMode = "default" | "local-only" | "off";

type Props = {
  activeLayer: "street" | "satellite" | "dark";
  mapRef: React.MutableRefObject<LiveMapRef | null>;
  mapPin?: { lat: number; lng: number } | null;
  routeLine?: RouteLine | null;
  isLiveActive?: boolean;
  navigationMode?: boolean;
  mapFollowMode?: MapFollowMode;
  onUserLocationChange?: (update: UserLocationUpdate) => void;
  onLiveGpsChange?: (active: boolean) => void;
  onGpsError?: (message: string) => void;
  nearbyResults?: any[] | null;
  onNearbyMarkerClick?: (place: any) => void;
  onMapClick?: (lat: number, lng: number, features: any[]) => void;
};

const GPS_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 0,
};

function getLayerStyles() {
  return getLiveMapLibreLayerStyles();
}

function createUserMarkerElement(liveActive: boolean, navigating: boolean): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "gt-user-location-marker";
  if (navigating) {
    el.innerHTML = `<div style="width:20px;height:20px;border-radius:50%;background:${liveActive ? "#0F766E" : "#2563EB"};border:3px solid #FFFFFF;box-shadow:0 0 14px rgba(15,118,110,0.55);"></div>`;
    return el;
  }
  if (liveActive) {
    el.innerHTML = `<div style="font-size:22px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.35));">🚗</div>`;
    return el;
  }
  el.innerHTML = `
    <div style="position: relative; width: 24px; height: 24px; pointer-events: none;">
      <div style="position: absolute; inset: -4px; border-radius: 50%; background: rgba(59, 130, 246, 0.4); animation: pulse 2s infinite;"></div>
      <div style="position: absolute; inset: 3px; border-radius: 50%; background: #2563EB; border: 2px solid #FFFFFF; box-shadow: 0 2px 6px rgba(0,0,0,0.4);"></div>
    </div>
  `;
  return el;
}

function createDestinationMarkerElement(navigating: boolean): HTMLDivElement {
  const el = document.createElement("div");
  if (navigating) {
    el.innerHTML = `<div style="width:22px;height:22px;border-radius:50%;background:#FFFFFF;border:4px solid #0F766E;box-shadow:0 2px 8px rgba(0,0,0,0.25);"></div>`;
    return el;
  }
  el.innerHTML = `<div style="font-size:28px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));">📍</div>`;
  return el;
}

function syncRouteLayer(map: maplibregl.Map, routeLine: RouteLine | null | undefined) {
  const sourceId = "live-route";
  const layerId = "live-route-line";

  if (!routeLine) {
    if (map.getLayer(layerId)) map.removeLayer(layerId);
    if (map.getSource(sourceId)) map.removeSource(sourceId);
    return;
  }

  const data: GeoJSON.Feature<GeoJSON.LineString> = {
    type: "Feature",
    properties: {},
    geometry: {
      type: "LineString",
      coordinates: [
        [routeLine.from.lng, routeLine.from.lat],
        [routeLine.to.lng, routeLine.to.lat],
      ],
    },
  };

  const existing = map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;
  if (existing) {
    existing.setData(data);
    if (map.getLayer(layerId)) {
      map.setPaintProperty(
        layerId,
        "line-color",
        routeLine.active ? "#0F766E" : "#64748b",
      );
      map.setPaintProperty(layerId, "line-width", routeLine.active ? 5 : 4);
      map.setPaintProperty(
        layerId,
        "line-dasharray",
        routeLine.active ? [1, 0] : [2, 2],
      );
      map.setPaintProperty(layerId, "line-opacity", routeLine.active ? 0.95 : 0.55);
    }
    return;
  }

  map.addSource(sourceId, { type: "geojson", data });
  map.addLayer({
    id: layerId,
    type: "line",
    source: sourceId,
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": routeLine.active ? "#0F766E" : "#64748b",
      "line-width": routeLine.active ? 5 : 4,
      "line-dasharray": routeLine.active ? [1, 0] : [2, 2],
      "line-opacity": routeLine.active ? 0.95 : 0.55,
    },
  });
}

export default function LiveMapComponent({
  activeLayer,
  mapRef,
  mapPin,
  routeLine,
  isLiveActive = false,
  navigationMode = false,
  mapFollowMode = "default",
  onUserLocationChange,
  onLiveGpsChange,
  onGpsError,
  nearbyResults,
  onNearbyMarkerClick,
  onMapClick,
}: Props) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<maplibregl.Map | null>(null);
  const [debugInfo, setDebugInfo] = useState<{
    lat: number;
    lng: number;
    count: number;
    layers: string[];
    topName?: string;
    topCategory?: string;
  } | null>(null);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const placeMarkerRef = useRef<maplibregl.Marker | null>(null);
  const userLocationRef = useRef<UserLocation | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const liveGpsActiveRef = useRef(false);
  const hasCenteredOnUserRef = useRef(false);

  const callbacksRef = useRef({ onUserLocationChange, onLiveGpsChange, onGpsError, onMapClick });
  callbacksRef.current = { onUserLocationChange, onLiveGpsChange, onGpsError, onMapClick };
  const isLiveActiveRef = useRef(isLiveActive);
  isLiveActiveRef.current = isLiveActive;
  const navigationModeRef = useRef(navigationMode);
  navigationModeRef.current = navigationMode;
  const mapFollowModeRef = useRef(mapFollowMode);
  mapFollowModeRef.current = mapFollowMode;

  useEffect(() => {
    warnIfUnsafeProductionTiles("live");
  }, []);

  useEffect(() => {
    if (!mapContainer.current) return;

    const layerStyles = getLayerStyles();
    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: layerStyles[activeLayer] || layerStyles.street,
      center: [-73.9855, 40.7484],
      zoom: 13,
      minZoom: LIVE_MAP_MIN_ZOOM,
      maxZoom: LIVE_MAP_MAX_ZOOM,
      attributionControl: false,
    });

    instanceRef.current = map;

    map.on("load", () => {
      if (map.getZoom() > LIVE_MAP_MAX_ZOOM) {
        map.setZoom(LIVE_MAP_MAX_ZOOM);
      }
    });

    map.on("click", (e) => {
      const bbox: [maplibregl.PointLike, maplibregl.PointLike] = [
        [e.point.x - 10, e.point.y - 10],
        [e.point.x + 10, e.point.y + 10]
      ];
      const features = map.queryRenderedFeatures(bbox);

      // Score features to find the top one
      const scoredFeatures = features
        .map((f: any) => ({ feature: f, score: scoreFeature(f) }))
        .sort((a, b) => b.score - a.score);

      const topFeatureObj = scoredFeatures[0]?.feature;
      const topName = topFeatureObj ? (topFeatureObj.properties?.name || topFeatureObj.properties?.display_name || topFeatureObj.properties?.title) : undefined;
      let topCategory = "";
      if (topFeatureObj) {
        const p = topFeatureObj.properties || {};
        topCategory = formatCategoryLabel(p.type || p.class || p.amenity, p.class);
      }

      console.log(`[Rovvy Map Feature Inspector] Clicked Lat/Lng: ${e.lngLat.lat}, ${e.lngLat.lng}`);
      if (features.length === 0) {
        console.log("[Rovvy Map Feature Inspector] Zero queryable POI/features found around this click.");
      } else {
        const tableData = features.map((f: any) => {
          const p = f.properties || {};
          return {
            "layer.id": f.layer?.id || "",
            "source": f.layer?.source || "",
            "sourceLayer": f.layer?.["source-layer"] || "",
            "geometry.type": f.geometry?.type || "",
            "name": p.name || p.display_name || p.title || "",
            "class": p.class || "",
            "type": p.type || "",
            "amenity": p.amenity || "",
            "shop": p.shop || "",
            "tourism": p.tourism || "",
            "leisure": p.leisure || "",
            "highway": p.highway || "",
            "osm_id": p.osm_id || "",
            "id": p.id || ""
          };
        });
        console.table(tableData);
      }

      setDebugInfo({
        lat: e.lngLat.lat,
        lng: e.lngLat.lng,
        count: features.length,
        layers: features.map((f: any) => f.layer?.id || "unknown"),
        topName,
        topCategory,
      });

      callbacksRef.current.onMapClick?.(e.lngLat.lat, e.lngLat.lng, features);
    });

    function ensureUserMarker(lat: number, lng: number) {
      if (userMarkerRef.current) {
        userMarkerRef.current.setLngLat([lng, lat]);
        return;
      }
      userMarkerRef.current = new maplibregl.Marker({
        element: createUserMarkerElement(isLiveActiveRef.current, navigationModeRef.current),
        anchor: "center",
      })
        .setLngLat([lng, lat])
        .addTo(map);
    }

    function applyUserLocation(
      lat: number,
      lng: number,
      centerMap: boolean,
      speedMps: number | null,
      heading: number | null,
    ) {
      userLocationRef.current = { lat, lng };
      ensureUserMarker(lat, lng);
      callbacksRef.current.onUserLocationChange?.({
        lat,
        lng,
        speedMps,
        heading,
      });

      if (navigationModeRef.current) {
        map.easeTo({
          center: [lng, lat],
          bearing: heading ?? map.getBearing(),
          zoom: 17,
          pitch: 0,
          padding: { top: 140, bottom: 220, left: 48, right: 48 },
          duration: 900,
          essential: true,
        });
        return;
      }

      if (centerMap || !hasCenteredOnUserRef.current) {
        map.flyTo({ center: [lng, lat], zoom: 16, essential: true });
        hasCenteredOnUserRef.current = true;
      }
    }

    function stopLiveGps() {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      liveGpsActiveRef.current = false;
      callbacksRef.current.onLiveGpsChange?.(false);
    }

    function startLiveGps() {
      const blocked = geolocationUnavailableMessage();
      if (blocked) {
        callbacksRef.current.onGpsError?.(blocked);
        return;
      }

      stopLiveGps();
      liveGpsActiveRef.current = true;
      callbacksRef.current.onLiveGpsChange?.(true);
      hasCenteredOnUserRef.current = false;

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          applyUserLocation(
            pos.coords.latitude,
            pos.coords.longitude,
            true,
            pos.coords.speed,
            pos.coords.heading,
          );
        },
        (err) => {
          stopLiveGps();
          callbacksRef.current.onGpsError?.(geolocationErrorMessage(err));
        },
        GPS_OPTIONS,
      );

      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          applyUserLocation(
            pos.coords.latitude,
            pos.coords.longitude,
            false,
            pos.coords.speed,
            pos.coords.heading,
          );
        },
        (err) => {
          stopLiveGps();
          callbacksRef.current.onGpsError?.(geolocationErrorMessage(err));
        },
        GPS_OPTIONS,
      );
    }

    mapRef.current = {
      zoomIn: () => {
        if (map.getZoom() < LIVE_MAP_MAX_ZOOM) map.zoomIn();
      },
      zoomOut: () => map.zoomOut(),
      getUserLocation: () => userLocationRef.current,
      getMapCenter: () => {
        const center = map.getCenter();
        return { lat: center.lat, lng: center.lng };
      },
      isLiveGpsActive: () => liveGpsActiveRef.current,
      locateUser: () => {
        if (liveGpsActiveRef.current) {
          const loc = userLocationRef.current;
          if (loc) {
            map.flyTo({ center: [loc.lng, loc.lat], zoom: 16, essential: true });
          } else {
            startLiveGps();
          }
          return;
        }
        startLiveGps();
      },
    };

    return () => {
      stopLiveGps();
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [mapRef]);

  useEffect(() => {
    if (!instanceRef.current) return;
    const layerStyles = getLayerStyles();
    const map = instanceRef.current;
    map.setStyle(layerStyles[activeLayer] || layerStyles.street);
    map.once("style.load", () => {
      map.setMaxZoom(LIVE_MAP_MAX_ZOOM);
      map.setMinZoom(LIVE_MAP_MIN_ZOOM);
    });
  }, [activeLayer]);

  useEffect(() => {
    const map = instanceRef.current;
    if (!map) return;

    const applyRoute = () => syncRouteLayer(map, routeLine);
    if (map.isStyleLoaded()) applyRoute();
    map.on("styledata", applyRoute);
    applyRoute();

    return () => {
      map.off("styledata", applyRoute);
    };
  }, [routeLine, activeLayer]);

  useEffect(() => {
    const map = instanceRef.current;
    if (!map || !userMarkerRef.current) return;
    const loc = userLocationRef.current;
    userMarkerRef.current.remove();
    userMarkerRef.current = new maplibregl.Marker({
      element: createUserMarkerElement(isLiveActive, navigationMode),
      anchor: "center",
    })
      .setLngLat(loc ? [loc.lng, loc.lat] : [-73.9855, 40.7484])
      .addTo(map);
  }, [isLiveActive, navigationMode]);

  useEffect(() => {
    const map = instanceRef.current;
    if (!map) return;

    if (!mapPin) {
      placeMarkerRef.current?.remove();
      placeMarkerRef.current = null;
      return;
    }

    const el = createDestinationMarkerElement(navigationMode);

    if (placeMarkerRef.current) {
      placeMarkerRef.current.remove();
      placeMarkerRef.current = null;
    }

    placeMarkerRef.current = new maplibregl.Marker({
      element: el,
      anchor: navigationMode ? "center" : "bottom",
    })
      .setLngLat([mapPin.lng, mapPin.lat])
      .addTo(map);
  }, [mapPin, navigationMode]);

  const nearbyMarkersRef = useRef<maplibregl.Marker[]>([]);

  useEffect(() => {
    const map = instanceRef.current;
    if (!map) return;

    nearbyMarkersRef.current.forEach((m) => m.remove());
    nearbyMarkersRef.current = [];

    if (!nearbyResults || nearbyResults.length === 0) return;

    nearbyResults.forEach((res, index) => {
      const el = document.createElement("div");
      el.className = "nearby-result-marker";
      el.innerHTML = `
        <div style="
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: #0F766E;
          color: white;
          font-size: 11px;
          font-weight: 700;
          border: 2px solid white;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          cursor: pointer;
        ">
          \${index + 1}
        </div>
      `;

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onNearbyMarkerClick?.(res);
      });

      const marker = new maplibregl.Marker({
        element: el,
        anchor: "center",
      })
        .setLngLat([res.lng, res.lat])
        .addTo(map);

      nearbyMarkersRef.current.push(marker);
    });

    return () => {
      nearbyMarkersRef.current.forEach((m) => m.remove());
      nearbyMarkersRef.current = [];
    };
  }, [nearbyResults, onNearbyMarkerClick]);

  const routeFitKeyRef = useRef("");

  useEffect(() => {
    if (navigationMode) return;
    const map = instanceRef.current;
    if (!map || !mapPin) return;

    const followMode = mapFollowModeRef.current;
    if (followMode === "off") return;

    const fitKey = routeLine
      ? `route:${mapPin.lat.toFixed(4)},${mapPin.lng.toFixed(4)}`
      : `pin:${mapPin.lat.toFixed(4)},${mapPin.lng.toFixed(4)}`;
    if (routeFitKeyRef.current === fitKey) return;
    routeFitKeyRef.current = fitKey;

    if (routeLine) {
      const routeDistanceM = haversineM(
        routeLine.from.lat,
        routeLine.from.lng,
        routeLine.to.lat,
        routeLine.to.lng,
      );
      if (routeDistanceM > LOCAL_LIVE_MAX_M) return;

      const bounds = new maplibregl.LngLatBounds();
      bounds.extend([routeLine.from.lng, routeLine.from.lat]);
      bounds.extend([routeLine.to.lng, routeLine.to.lat]);
      map.fitBounds(bounds, { padding: 80, maxZoom: 14, essential: true });
      return;
    }

    if (followMode === "local-only") {
      const userLoc = userLocationRef.current;
      if (userLoc) {
        const pinDistanceM = haversineM(
          userLoc.lat,
          userLoc.lng,
          mapPin.lat,
          mapPin.lng,
        );
        if (pinDistanceM > LOCAL_LIVE_MAX_M) return;
      }
    }

    map.flyTo({ center: [mapPin.lng, mapPin.lat], zoom: 15, essential: true });
  }, [mapPin, routeLine, mapFollowMode, navigationMode]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />
      {process.env.NEXT_PUBLIC_ROVVY_MAP_DEBUG === "true" && debugInfo && (
        <div className="absolute bottom-4 left-4 z-[100] bg-stone-900/90 text-stone-100 backdrop-blur-md border border-stone-800 p-4 rounded-xl shadow-lg max-w-xs text-xs font-mono flex flex-col gap-2 pointer-events-auto">
          <div className="font-bold text-stone-200 border-b border-stone-800 pb-1 flex justify-between items-center">
            <span>[Rovvy Map Debug]</span>
            <button onClick={() => setDebugInfo(null)} className="text-stone-400 hover:text-stone-100 font-bold px-1.5 py-0.5">×</button>
          </div>
          <div>Lat: {debugInfo.lat.toFixed(6)}</div>
          <div>Lng: {debugInfo.lng.toFixed(6)}</div>
          <div>Features Found: {debugInfo.count}</div>
          {debugInfo.topName && (
            <div>
              <span className="font-semibold text-teal-400">Top Feature:</span> {debugInfo.topName} ({debugInfo.topCategory || "unknown"})
            </div>
          )}
          <div>
            <span className="font-semibold text-teal-400">Top Layers:</span>
            <ul className="list-disc pl-4 mt-1 flex flex-col gap-0.5 max-h-[80px] overflow-y-auto">
              {debugInfo.layers.slice(0, 5).map((l, idx) => (
                <li key={idx} className="truncate max-w-[200px]">{l}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function scoreFeature(f: any): number {
  const p = f.properties || {};
  const hasName = !!(p.name || p.display_name || p.title);
  
  const isPoi = !!(
    p.amenity ||
    p.shop ||
    p.tourism ||
    p.leisure ||
    p.healthcare ||
    p.public_transport ||
    p.highway === "bus_stop" ||
    p.highway === "bus_station" ||
    (p.class && !["building", "road", "highway", "water", "landuse", "boundary", "transit", "administrative"].includes(p.class)) ||
    (p.type && !["building", "road", "highway", "water", "landuse", "boundary", "transit", "administrative"].includes(p.type))
  );

  const isBuilding = !!(
    p.building ||
    p.class === "building" ||
    p.type === "building" ||
    f.layer?.id?.includes("building") ||
    f.layer?.["source-layer"]?.includes("building")
  );

  const isSymbol = f.layer?.type === "symbol";

  if (hasName && isPoi && isSymbol) return 100;
  if (hasName && isPoi) return 90;
  if (hasName && isBuilding) return 80;
  if (isPoi) return 70;
  if (isBuilding && (p["addr:housenumber"] || p.house_number || p.street || p["addr:street"])) return 60;
  if (isBuilding) return 50;
  if (hasName) return 40;
  if (Object.keys(p).length > 0) return 10;
  return 0;
}

function formatCategoryLabel(type?: string, cls?: string): string {
  const parts = [type, cls]
    .filter(Boolean)
    .map((part) => part!.replace(/_/g, " "))
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1));
  const unique = [...new Set(parts)];
  return unique.length ? unique.join(" · ") : "Place";
}
