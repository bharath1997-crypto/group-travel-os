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

/** Arrow-cursor + GPS pulse animation styles injected once for the Live map */
const LIVE_MAP_CSS = `
.rovvy-live-map-container .maplibregl-canvas-container,
.rovvy-live-map-container .maplibregl-canvas {
  cursor: default !important;
}
.rovvy-live-map-container .maplibregl-canvas:active {
  cursor: default !important;
}
.rovvy-live-map-container .maplibregl-canvas-container:active {
  cursor: default !important;
}
@keyframes rovvy-gps-pulse {
  0%   { transform: scale(0.85); opacity: 0.9; }
  50%  { transform: scale(1.35); opacity: 0.35; }
  100% { transform: scale(0.85); opacity: 0.9; }
}
`;

let liveCssInjected = false;
function injectLiveMapCursorStyle() {
  if (typeof document === "undefined" || liveCssInjected) return;
  const style = document.createElement("style");
  style.id = "rovvy-live-map-css";
  style.textContent = LIVE_MAP_CSS;
  document.head.appendChild(style);
  liveCssInjected = true;
}

export type UserLocation = { lat: number; lng: number; accuracy?: number; timestamp?: number };

export type GpsStatus = "idle" | "requesting" | "active" | "denied" | "error" | "stale" | "low_accuracy";

export type LiveMapRef = {
  zoomIn: () => void;
  zoomOut: () => void;
  locateUser: (forceFresh?: boolean) => void;
  getUserLocation: () => UserLocation | null;
  getMapCenter: () => UserLocation | null;
  isLiveGpsActive: () => boolean;
  clearClickedPin: () => void;
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
  onGpsStatusChange?: (status: GpsStatus) => void;
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
  el.style.cssText = "pointer-events:none;position:relative;";

  if (navigating) {
    // Navigation mode: teal/blue solid dot
    el.innerHTML = `<div style="width:20px;height:20px;border-radius:50%;background:${liveActive ? "#0F766E" : "#2563EB"};border:3px solid #FFFFFF;box-shadow:0 0 14px rgba(37,99,235,0.55);"></div>`;
    return el;
  }

  if (liveActive) {
    // Live mode: car emoji
    el.innerHTML = `<div style="font-size:22px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.35));">🚗</div>`;
    return el;
  }

  // Default: Google Maps-style blue dot with animated outer ring
  // Uses rovvy-gps-pulse keyframes injected by injectLiveMapCursorStyle()
  el.innerHTML = `
    <div style="
      position: relative;
      width: 22px;
      height: 22px;
      pointer-events: none;
    ">
      <!-- Pulsing outer ring -->
      <div style="
        position: absolute;
        inset: -6px;
        border-radius: 50%;
        background: rgba(37, 99, 235, 0.25);
        animation: rovvy-gps-pulse 2s ease-in-out infinite;
      "></div>
      <!-- White border ring -->
      <div style="
        position: absolute;
        inset: -2px;
        border-radius: 50%;
        background: #ffffff;
        box-shadow: 0 1px 4px rgba(0,0,0,0.3);
      "></div>
      <!-- Blue inner dot -->
      <div style="
        position: absolute;
        inset: 3px;
        border-radius: 50%;
        background: #2563EB;
      "></div>
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

/** Teal map-click pin — distinct from the destination 📍 and from the blue user dot */
function createClickedPinMarkerElement(): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText = "pointer-events:none;";
  el.innerHTML = `
    <div style="
      position: relative;
      width: 28px;
      height: 36px;
      display: flex;
      align-items: flex-start;
      justify-content: center;
    ">
      <!-- pin body -->
      <div style="
        width: 24px;
        height: 24px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        background: #0F766E;
        border: 3px solid #ffffff;
        box-shadow: 0 2px 8px rgba(0,0,0,0.35);
      "></div>
    </div>
  `;
  return el;
}

/** Show a brief ripple at the screen pixel position then remove it. */
function showClickRipple(container: HTMLElement, x: number, y: number): void {
  const ripple = document.createElement("div");
  ripple.style.cssText = `
    position: absolute;
    left: ${x}px;
    top: ${y}px;
    width: 40px;
    height: 40px;
    transform: translate(-50%, -50%) scale(0);
    border-radius: 50%;
    border: 2px solid #0F766E;
    background: rgba(15,118,110,0.12);
    pointer-events: none;
    z-index: 9999;
    animation: rovvy-ripple 0.75s ease-out forwards;
  `;

  // Inject animation keyframes once
  if (!document.getElementById("rovvy-ripple-keyframes")) {
    const style = document.createElement("style");
    style.id = "rovvy-ripple-keyframes";
    style.textContent = `
      @keyframes rovvy-ripple {
        0%   { transform: translate(-50%,-50%) scale(0); opacity: 1; }
        70%  { transform: translate(-50%,-50%) scale(1.8); opacity: 0.5; }
        100% { transform: translate(-50%,-50%) scale(2.4); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  container.appendChild(ripple);
  setTimeout(() => ripple.remove(), 800);
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

function syncAccuracyLayer(map: maplibregl.Map, lat: number, lng: number, accuracyMeters: number | null) {
  const sourceId = "user-accuracy";
  const layerId = "user-accuracy-fill";
  const layerOutlineId = "user-accuracy-outline";

  if (!accuracyMeters || accuracyMeters <= 20) {
    if (map.getLayer(layerId)) map.removeLayer(layerId);
    if (map.getLayer(layerOutlineId)) map.removeLayer(layerOutlineId);
    if (map.getSource(sourceId)) map.removeSource(sourceId);
    return;
  }

  // Create circle polygon
  const points = 64;
  const coords = [];
  const R = 6378137;
  for (let i = 0; i < points; i++) {
    const theta = (i / points) * (2 * Math.PI);
    const dx = accuracyMeters * Math.cos(theta);
    const dy = accuracyMeters * Math.sin(theta);
    const latOffset = (dy / R) * (180 / Math.PI);
    const lngOffset = (dx / (R * Math.cos((lat * Math.PI) / 180))) * (180 / Math.PI);
    coords.push([lng + lngOffset, lat + latOffset]);
  }
  coords.push(coords[0]);

  const data: GeoJSON.Feature<GeoJSON.Polygon> = {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [coords] },
  };

  const existing = map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;
  if (existing) {
    existing.setData(data);
    return;
  }

  map.addSource(sourceId, { type: "geojson", data });
  
  // Try to insert below labels and symbols if possible, otherwise just add
  let beforeId: string | undefined = undefined;
  const layers = map.getStyle().layers;
  if (layers) {
    const firstSymbolId = layers.find(l => l.type === 'symbol')?.id;
    if (firstSymbolId) beforeId = firstSymbolId;
  }

  map.addLayer({
    id: layerId,
    type: "fill",
    source: sourceId,
    paint: { "fill-color": "#2563EB", "fill-opacity": 0.15 },
  }, beforeId);
  map.addLayer({
    id: layerOutlineId,
    type: "line",
    source: sourceId,
    paint: { "line-color": "#2563EB", "line-width": 1, "line-opacity": 0.35 },
  }, beforeId);
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
  onGpsStatusChange,
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

  const callbacksRef = useRef({ onUserLocationChange, onLiveGpsChange, onGpsError, onGpsStatusChange, onMapClick });
  callbacksRef.current = { onUserLocationChange, onLiveGpsChange, onGpsError, onGpsStatusChange, onMapClick };
  const isLiveActiveRef = useRef(isLiveActive);
  isLiveActiveRef.current = isLiveActive;
  const navigationModeRef = useRef(navigationMode);
  navigationModeRef.current = navigationMode;
  const mapFollowModeRef = useRef(mapFollowMode);
  mapFollowModeRef.current = mapFollowMode;
  const clickedPinMarkerRef = useRef<maplibregl.Marker | null>(null);

  useEffect(() => {
    injectLiveMapCursorStyle();
  }, []);

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
      const { x, y } = e.point;
      const bbox: [maplibregl.PointLike, maplibregl.PointLike] = [
        [x - 10, y - 10],
        [x + 10, y + 10]
      ];
      const features = map.queryRenderedFeatures(bbox);

      // ── Place teal dropped-pin marker immediately at clicked coordinate ──
      if (clickedPinMarkerRef.current) {
        clickedPinMarkerRef.current.remove();
        clickedPinMarkerRef.current = null;
      }
      clickedPinMarkerRef.current = new maplibregl.Marker({
        element: createClickedPinMarkerElement(),
        anchor: "bottom",
      })
        .setLngLat([e.lngLat.lng, e.lngLat.lat])
        .addTo(map);

      // ── Show ripple at click pixel position ──
      if (mapContainer.current) {
        showClickRipple(mapContainer.current, x, y);
      }

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

      console.log("[Rovvy Map Click Feature]", {
        clicked: { lat: e.lngLat.lat, lng: e.lngLat.lng },
        featuresCount: features.length,
        candidate: topFeatureObj ? {
          layerId: topFeatureObj.layer?.id,
          sourceLayer: topFeatureObj.layer?.["source-layer"],
          properties: topFeatureObj.properties
        } : null,
        allFeatures: features.map((f: any) => ({
          layerId: f.layer?.id,
          sourceLayer: f.layer?.["source-layer"],
          properties: f.properties
        }))
      });

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

    function ensureUserMarker(lat: number, lng: number, accuracy: number | null, timestamp: number | null) {
      if (userMarkerRef.current) {
        userMarkerRef.current.setLngLat([lng, lat]);
      } else {
        userMarkerRef.current = new maplibregl.Marker({
          element: createUserMarkerElement(isLiveActiveRef.current, navigationModeRef.current),
          anchor: "center",
        })
          .setLngLat([lng, lat])
          .addTo(map);
        
        const popup = new maplibregl.Popup({ closeButton: false, offset: 15, className: "user-location-popup" });
        userMarkerRef.current.setPopup(popup);
      }
      
      const popup = userMarkerRef.current.getPopup();
      if (popup) {
        const ageSec = timestamp ? Math.round((Date.now() - timestamp) / 1000) : 0;
        const content = `
          <div style="padding: 4px 8px; font-family: sans-serif; min-width: 140px;">
            <div style="font-weight: bold; font-size: 13px; margin-bottom: 4px; color: #1c1917;">You are here</div>
            <div style="font-size: 11px; color: #57534e;">Accuracy: ± ${accuracy ? Math.round(accuracy) : '?'} m</div>
            <div style="font-size: 11px; color: #78716c; margin-top: 2px;">Updated ${ageSec} sec ago</div>
          </div>
        `;
        popup.setHTML(content);
      }
    }

    function applyUserLocation(
      lat: number,
      lng: number,
      centerMap: boolean,
      speedMps: number | null,
      heading: number | null,
      accuracyMeters: number | null,
      timestamp: number | null,
    ) {
      userLocationRef.current = { lat, lng, accuracy: accuracyMeters || undefined, timestamp: timestamp || undefined };
      ensureUserMarker(lat, lng, accuracyMeters, timestamp);
      syncAccuracyLayer(map, lat, lng, accuracyMeters);
      
      // Update GpsStatus based on accuracy/freshness
      let newStatus: GpsStatus = "active";
      if (timestamp && Date.now() - timestamp > 30000) {
        newStatus = "stale";
      } else if (accuracyMeters && accuracyMeters > 150) {
        newStatus = "low_accuracy";
      }
      callbacksRef.current.onGpsStatusChange?.(newStatus);
      
      callbacksRef.current.onUserLocationChange?.({
        lat,
        lng,
        speedMps,
        heading,
        accuracyMeters,
        timestamp,
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
      callbacksRef.current.onGpsStatusChange?.("idle");
    }

    function startLiveGps() {
      const blocked = geolocationUnavailableMessage();
      if (blocked) {
        callbacksRef.current.onGpsError?.(blocked);
        callbacksRef.current.onGpsStatusChange?.("error");
        return;
      }

      stopLiveGps();
      liveGpsActiveRef.current = true;
      callbacksRef.current.onLiveGpsChange?.(true);
      callbacksRef.current.onGpsStatusChange?.("requesting");
      hasCenteredOnUserRef.current = false;

      if (process.env.NODE_ENV === "development") {
        console.log("[Rovvy GPS] Requesting location...");
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude, accuracy, speed, heading } = pos.coords;
          if (process.env.NODE_ENV === "development") {
            console.log("[Rovvy GPS] First fix", {
              lat: latitude, lng: longitude, accuracy, speed, heading,
            });
          }
          applyUserLocation(latitude, longitude, true, speed, heading, accuracy, pos.timestamp);
        },
        (err) => {
          const msg = geolocationErrorMessage(err);
          if (process.env.NODE_ENV === "development") {
            console.warn("[Rovvy GPS] getCurrentPosition error", err.code, msg);
          }
          stopLiveGps();
          callbacksRef.current.onGpsError?.(msg);
          callbacksRef.current.onGpsStatusChange?.(err.code === 1 ? "denied" : "error");
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );

      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude, accuracy, speed, heading } = pos.coords;
          if (process.env.NODE_ENV === "development") {
            // Only log when position meaningfully changes (> 1 meter)
            const prev = userLocationRef.current;
            if (!prev || Math.abs(prev.lat - latitude) > 0.00001 || Math.abs(prev.lng - longitude) > 0.00001) {
              console.log("[Rovvy GPS] watchPosition update", {
                lat: latitude, lng: longitude, accuracy, speed, heading,
              });
            }
          }
          applyUserLocation(latitude, longitude, false, speed, heading, accuracy, pos.timestamp);
        },
        (err) => {
          const msg = geolocationErrorMessage(err);
          if (process.env.NODE_ENV === "development") {
            console.warn("[Rovvy GPS] watchPosition error", err.code, msg);
          }
          stopLiveGps();
          callbacksRef.current.onGpsError?.(msg);
          callbacksRef.current.onGpsStatusChange?.(err.code === 1 ? "denied" : "error");
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
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
      clearClickedPin: () => {
        clickedPinMarkerRef.current?.remove();
        clickedPinMarkerRef.current = null;
      },
      locateUser: (forceFresh?: boolean) => {
        if (forceFresh) {
          if (process.env.NODE_ENV === "development") {
            console.log("[Rovvy GPS] Forcing fresh location request...");
          }
          callbacksRef.current.onGpsStatusChange?.("requesting");
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const { latitude, longitude, accuracy, speed, heading } = pos.coords;
              applyUserLocation(latitude, longitude, true, speed, heading, accuracy, pos.timestamp);
              // Open popup to say "You are here"
              userMarkerRef.current?.togglePopup();
              // Make sure to re-establish the watch if not already active
              if (!liveGpsActiveRef.current) {
                startLiveGps();
              }
            },
            (err) => {
              const msg = geolocationErrorMessage(err);
              callbacksRef.current.onGpsError?.(msg);
              callbacksRef.current.onGpsStatusChange?.(err.code === 1 ? "denied" : "error");
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
          );
          return;
        }
        
        if (liveGpsActiveRef.current) {
          const loc = userLocationRef.current;
          if (loc) {
            map.flyTo({ center: [loc.lng, loc.lat], zoom: loc.accuracy && loc.accuracy > 150 ? 14 : 16, essential: true });
            userMarkerRef.current?.togglePopup();
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
      clickedPinMarkerRef.current?.remove();
      clickedPinMarkerRef.current = null;
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

  // Remove the teal clicked-pin when a proper mapPin (destination/selected place) is provided,
  // so we don't show two pins at once after the user makes a destination.
  useEffect(() => {
    if (mapPin && clickedPinMarkerRef.current) {
      clickedPinMarkerRef.current.remove();
      clickedPinMarkerRef.current = null;
    }
  }, [mapPin]);

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
    <div className="relative w-full h-full rovvy-live-map-container">
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
