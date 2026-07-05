"use client";

import React, { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { geolocationUnavailableMessage, haversineM } from "@/lib/geo";
import {
  GPS_ACCEPTABLE_ACCURACY_M,
  displayAccuracyRadiusMeters,
  gpsStatusFromGeolocationError,
  logRovvyGps,
  shouldShowGpsDot,
  type GpsStatus,
  type GpsState,
} from "./live-gps";
import {
  getLiveMapLibreLayerStyles,
  LIVE_MAP_MAX_ZOOM,
  LIVE_MAP_MIN_ZOOM,
  warnIfUnsafeProductionTiles,
} from "@/lib/map-providers";
import type { RouteLine, UserLocationUpdate } from "./live-types";
import { LOCAL_LIVE_MAX_M } from "./live-types";

/** Extended arrow-cursor + custom Google Maps style pulse animations */
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
  0% {
    transform: scale(0.95);
    opacity: 1;
  }
  100% {
    transform: scale(2.8);
    opacity: 0;
  }
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

export type { GpsStatus, GpsState } from "./live-gps";

export type LiveMapRef = {
  zoomIn: () => void;
  zoomOut: () => void;
  locateUser: (forceFresh?: boolean) => void;
  getUserLocation: () => UserLocation | null;
  getMapCenter: () => UserLocation | null;
  isLiveGpsActive: () => boolean;
  clearClickedPin: () => void;
  resetNorth: () => void;
  getBearing: () => number;
  fitBounds: (bounds: [[number, number], [number, number]]) => void;
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
  onGpsStateChange?: (state: GpsState) => void;
  nearbyResults?: any[] | null;
  onNearbyMarkerClick?: (place: any) => void;
  onMapClick?: (lat: number, lng: number, features: any[]) => void;
  onLiveGpsChange?: (active: boolean) => void;
  onMapInteraction?: (interacting: boolean) => void;
};

function createUserMarkerElement(liveActive: boolean, navigating: boolean): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "gt-user-location-marker";
  el.style.cssText = "pointer-events:none;position:relative;";

  if (navigating) {
    el.innerHTML = `<div style="width:20px;height:20px;border-radius:50%;background:${liveActive ? "#0F766E" : "#2563EB"};border:3px solid #FFFFFF;box-shadow:0 0 14px rgba(37,99,235,0.55);"></div>`;
    return el;
  }

  if (liveActive) {
    el.innerHTML = `<div style="font-size:22px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.35));">🚗</div>`;
    return el;
  }

  // Pure Google Maps style HTML layer marker setup
  el.innerHTML = `
    <div style="
      position: relative;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <div style="
        position: absolute;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: rgba(26, 115, 232, 0.2);
        border: 1px solid rgba(26, 115, 232, 0.35);
        animation: rovvy-gps-pulse 2.2s infinite cubic-bezier(0.25, 0, 0, 1);
        pointer-events: none;
        z-index: 1;
      "></div>

      <div style="
        position: absolute;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: #ffffff;
        box-shadow: 0 1px 4px rgba(0,0,0,0.35);
        z-index: 2;
      "></div>

      <div style="
        position: absolute;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: #1A73E8;
        z-index: 3;
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

function isMapStyleReady(map: maplibregl.Map): boolean {
  try {
    return !!map.isStyleLoaded();
  } catch {
    return false;
  }
}

function whenMapStyleReady(map: maplibregl.Map, fn: () => void): void {
  if (isMapStyleReady(map)) {
    try {
      fn();
    } catch (err) {
      if (err instanceof Error && err.message.includes("Style is not done loading")) {
        map.once("idle", () => whenMapStyleReady(map, fn));
      }
    }
    return;
  }

  const run = () => {
    if (!isMapStyleReady(map)) return;
    map.off("styledata", run);
    try {
      fn();
    } catch {
    }
  };
  map.on("styledata", run);
}

function isRoutineTileFetchError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  return (
    message.includes("AJAXError") ||
    message.includes("Failed to fetch") ||
    message.includes("NetworkError")
  );
}

function syncRouteLayer(map: maplibregl.Map, routeLine: RouteLine | null | undefined) {
  whenMapStyleReady(map, () => syncRouteLayerNow(map, routeLine));
}

function syncRouteLayerNow(map: maplibregl.Map, routeLine: RouteLine | null | undefined) {
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
      coordinates: routeLine.geometry,
    },
  };

  const existing = map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;
  if (existing) {
    existing.setData(data);
    if (map.getLayer(layerId)) {
      map.setPaintProperty(layerId, "line-color", routeLine.active ? "#0F766E" : "#64748b");
      map.setPaintProperty(layerId, "line-width", [
        "interpolate",
        ["linear"],
        ["zoom"],
        5, routeLine.active ? 4 : 3,
        14, routeLine.active ? 8 : 5,
        18, routeLine.active ? 12 : 8
      ]);
      map.setPaintProperty(layerId, "line-opacity", routeLine.active ? 0.95 : 0.55);
    }
    return;
  }

  map.addSource(sourceId, { type: "geojson", data });

  let beforeId: string | undefined = undefined;
  const layers = map.getStyle().layers;
  if (layers) {
    const firstSymbolId = layers.find(l => l.type === 'symbol')?.id;
    if (firstSymbolId) beforeId = firstSymbolId;
  }

  map.addLayer({
    id: layerId,
    type: "line",
    source: sourceId,
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": routeLine.active ? "#0F766E" : "#64748b",
      "line-width": [
        "interpolate",
        ["linear"],
        ["zoom"],
        5, routeLine.active ? 4 : 3,
        14, routeLine.active ? 8 : 5,
        18, routeLine.active ? 12 : 8
      ],
      "line-opacity": routeLine.active ? 0.95 : 0.55,
    },
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
  onGpsStateChange,
  nearbyResults,
  onNearbyMarkerClick,
  onMapClick,
  onLiveGpsChange,
  onMapInteraction,
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
  const [gpsDebug, setGpsDebug] = useState<{
    status: GpsStatus;
    lat: number;
    lng: number;
    accuracy: number | null;
    timestamp: number | null;
    ageMs: number;
  } | null>(null);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const placeMarkerRef = useRef<maplibregl.Marker | null>(null);
  const userLocationRef = useRef<UserLocation | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const liveGpsActiveRef = useRef(false);
  const hasCenteredOnUserRef = useRef(false);

  const callbacksRef = useRef({ onGpsStateChange, onMapClick, onLiveGpsChange, onMapInteraction });
  callbacksRef.current = { onGpsStateChange, onMapClick, onLiveGpsChange, onMapInteraction };
  const isLiveActiveRef = useRef(isLiveActive);
  isLiveActiveRef.current = isLiveActive;
  const navigationModeRef = useRef(navigationMode);
  navigationModeRef.current = navigationMode;
  const navigationFollowUserRef = useRef(true);
  const mapFollowModeRef = useRef(mapFollowMode);
  mapFollowModeRef.current = mapFollowMode;
  const clickedPinMarkerRef = useRef<maplibregl.Marker | null>(null);
  const ensureUserMarkerRef = useRef<((lat: number, lng: number, accuracy: number | null, timestamp: number | null) => void) | null>(null);


  useEffect(() => {
    injectLiveMapCursorStyle();
  }, []);

  useEffect(() => {
    warnIfUnsafeProductionTiles("live");
  }, []);

  useEffect(() => {
    if (!mapContainer.current) return;

    const layerStyles = getLiveMapLibreLayerStyles();
    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: layerStyles[activeLayer] || layerStyles.street,
      center: [-87.726, 41.922], // Pulaski Road, Chicago baseline coordinates
      zoom: 14,
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

    map.on("error", (event) => {
      const error = event?.error;
      if (isRoutineTileFetchError(error)) return;
      if (process.env.NODE_ENV === "development") {
        console.warn("[Rovvy MapLibre]", error || event);
      }
    });

    map.on("click", (e) => {
      const { x, y } = e.point;
      const bbox: [maplibregl.PointLike, maplibregl.PointLike] = [
        [x - 16, y - 16],
        [x + 16, y + 16]
      ];
      const features = map.queryRenderedFeatures(bbox);

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

      if (mapContainer.current) {
        showClickRipple(mapContainer.current, x, y);
      }

      let targetedFeatures = features;
      if (features.length === 0) {
        const fallbackBbox: [maplibregl.PointLike, maplibregl.PointLike] = [
          [x - 24, y - 24],
          [x + 24, y + 24]
        ];
        targetedFeatures = map.queryRenderedFeatures(fallbackBbox);
      }

      const scoredFeatures = targetedFeatures
        .map((f: any) => ({ feature: f, score: scoreFeature(f) }))
        .sort((a, b) => b.score - a.score);

      const topFeatureObj = scoredFeatures[0]?.feature;
      const topName = topFeatureObj ? (topFeatureObj.properties?.name || topFeatureObj.properties?.display_name || topFeatureObj.properties?.title) : undefined;
      let topCategory = "";
      if (topFeatureObj) {
        const p = topFeatureObj.properties || {};
        topCategory = formatCategoryLabel(p.type || p.class || p.amenity, p.class);
      }

      setDebugInfo({
        lat: e.lngLat.lat,
        lng: e.lngLat.lng,
        count: targetedFeatures.length,
        layers: targetedFeatures.map((f: any) => f.layer?.id || "unknown"),
        topName,
        topCategory,
      });

      callbacksRef.current.onMapClick?.(e.lngLat.lat, e.lngLat.lng, targetedFeatures);
    });

    map.on("dragstart", () => {
      if (navigationModeRef.current) {
        navigationFollowUserRef.current = false;
      }
    });

    map.on("wheel", () => {
      if (navigationModeRef.current) {
        navigationFollowUserRef.current = false;
      }
    });

    map.on("movestart", () => {
      callbacksRef.current.onMapInteraction?.(true);
    });

    map.on("moveend", () => {
      callbacksRef.current.onMapInteraction?.(false);
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
    ensureUserMarkerRef.current = ensureUserMarker;


    function applyUserLocation(
      lat: number,
      lng: number,
      centerMap: boolean,
      speedMps: number | null,
      heading: number | null,
      accuracyMeters: number | null,
      timestamp: number | null,
    ) {
      if (!liveGpsActiveRef.current && watchIdRef.current != null) {
        liveGpsActiveRef.current = true;
        callbacksRef.current.onLiveGpsChange?.(true);
      }
      userLocationRef.current = { lat, lng, accuracy: accuracyMeters || undefined, timestamp: timestamp || undefined };

      ensureUserMarker(lat, lng, accuracyMeters, timestamp);

      const ageMs = timestamp ? Date.now() - timestamp : 0;
      let newStatus: GpsStatus = "active";
      if (timestamp && ageMs > 120000) {
        newStatus = "outdated";
      } else if (timestamp && ageMs > 30000) {
        newStatus = "stale";
      } else if (accuracyMeters && accuracyMeters > GPS_ACCEPTABLE_ACCURACY_M) {
        newStatus = "approximate";
      }

      const newState: GpsState = {
        status: newStatus,
        lat,
        lng,
        accuracyMeters,
        heading,
        speed: speedMps,
        timestamp,
        source: "browser_geolocation",
      };

      callbacksRef.current.onGpsStateChange?.(newState);

      if (process.env.NEXT_PUBLIC_ROVVY_MAP_DEBUG === "true") {
        setGpsDebug({
          status: newStatus,
          lat,
          lng,
          accuracy: accuracyMeters,
          timestamp,
          ageMs,
        });
      }

      logRovvyGps("position update", {
        accuracy: accuracyMeters,
        status: newStatus,
        fallbackUsed: false,
      });

      if (navigationModeRef.current && navigationFollowUserRef.current) {
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

      if (centerMap) {
        navigationFollowUserRef.current = true;
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
      callbacksRef.current.onGpsStateChange?.({
        status: "idle",
        lat: userLocationRef.current?.lat || null,
        lng: userLocationRef.current?.lng || null,
        accuracyMeters: userLocationRef.current?.accuracy || null,
        heading: null,
        speed: null,
        timestamp: userLocationRef.current?.timestamp || null,
        source: null,
      });
    }

    function handleGeolocationError(err: GeolocationPositionError, source: string) {
      const status = gpsStatusFromGeolocationError(err.code);
      logRovvyGps(`${source} error`, {
        code: err.code,
        status,
        timeout: err.code === 3,
        permissionDenied: err.code === 1,
      });

      if (err.code === 1) {
        stopLiveGps();
        userMarkerRef.current?.remove();
        userMarkerRef.current = null;
        userLocationRef.current = null;
        callbacksRef.current.onGpsStateChange?.({
          status: "denied", lat: null, lng: null, accuracyMeters: null, heading: null, speed: null, timestamp: null, source: null
        });
        return;
      }

      if (err.code === 3) {
        if (userLocationRef.current) {
          callbacksRef.current.onGpsStateChange?.({
            status: "timeout",
            lat: userLocationRef.current.lat,
            lng: userLocationRef.current.lng,
            accuracyMeters: userLocationRef.current.accuracy || null,
            heading: null,
            speed: null,
            timestamp: userLocationRef.current.timestamp || null,
            source: "browser_geolocation",
          });
          return;
        }
        liveGpsActiveRef.current = false;
        callbacksRef.current.onGpsStateChange?.({
          status: "timeout", lat: null, lng: null, accuracyMeters: null, heading: null, speed: null, timestamp: null, source: null
        });
        return;
      }

      stopLiveGps();
      callbacksRef.current.onGpsStateChange?.({
        status: "error", lat: null, lng: null, accuracyMeters: null, heading: null, speed: null, timestamp: null, source: null
      });
    }

    function startLiveGps() {
      const blocked = geolocationUnavailableMessage();
      if (blocked) {
        logRovvyGps("unavailable", { reason: blocked });
        callbacksRef.current.onGpsStateChange?.({
          status: "error", lat: null, lng: null, accuracyMeters: null, heading: null, speed: null, timestamp: null, source: null
        });
        return;
      }

      stopLiveGps();
      liveGpsActiveRef.current = true;
      callbacksRef.current.onGpsStateChange?.({
        status: "requesting",
        lat: userLocationRef.current?.lat || null,
        lng: userLocationRef.current?.lng || null,
        accuracyMeters: userLocationRef.current?.accuracy || null,
        heading: null,
        speed: null,
        timestamp: userLocationRef.current?.timestamp || null,
        source: null,
      });
      hasCenteredOnUserRef.current = false;

      logRovvyGps("requesting location");

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude, accuracy, speed, heading } = pos.coords;
          applyUserLocation(latitude, longitude, true, speed, heading, accuracy, pos.timestamp);
        },
        (err) => handleGeolocationError(err, "getCurrentPosition"),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
      );

      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude, accuracy, speed, heading } = pos.coords;
          applyUserLocation(latitude, longitude, false, speed, heading, accuracy, pos.timestamp);
        },
        (err) => handleGeolocationError(err, "watchPosition"),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
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
      resetNorth: () => {
        map.easeTo({ bearing: 0, pitch: 0, duration: 500, essential: true });
      },
      getBearing: () => map.getBearing(),
      fitBounds: (bounds) => {
        navigationFollowUserRef.current = false;
        map.fitBounds(bounds, { padding: 80, duration: 800 });
      },
      locateUser: (forceFresh?: boolean) => {
        const blocked = geolocationUnavailableMessage();
        if (blocked) {
          logRovvyGps("unavailable", { reason: blocked });
          callbacksRef.current.onGpsStateChange?.({
            status: "error", lat: null, lng: null, accuracyMeters: null, heading: null, speed: null, timestamp: null, source: null
          });
          return;
        }

        if (forceFresh) {
          logRovvyGps("forcing fresh location request");
          callbacksRef.current.onGpsStateChange?.({
            status: "requesting",
            lat: userLocationRef.current?.lat || null,
            lng: userLocationRef.current?.lng || null,
            accuracyMeters: userLocationRef.current?.accuracy || null,
            heading: null,
            speed: null,
            timestamp: userLocationRef.current?.timestamp || null,
            source: null,
          });
          navigationFollowUserRef.current = true;
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const { latitude, longitude, accuracy, speed, heading } = pos.coords;
              applyUserLocation(latitude, longitude, true, speed, heading, accuracy, pos.timestamp);
              userMarkerRef.current?.togglePopup();
              if (!liveGpsActiveRef.current) {
                startLiveGps();
              }
            },
            (err) => handleGeolocationError(err, "locateUser"),
            {
              enableHighAccuracy: true,
              timeout: 30000,     // Widen timeout to 30 seconds to allow slow hardware links to hook
              maximumAge: 10000,  // Allow a 10-second cache threshold so taps feel instant if a watch step just completed
            },
          );
          return;
        }

        if (liveGpsActiveRef.current) {
          navigationFollowUserRef.current = true;
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
      ensureUserMarkerRef.current = null;
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
    const layerStyles = getLiveMapLibreLayerStyles();
    const map = instanceRef.current;
    map.setStyle(layerStyles[activeLayer] || layerStyles.street);
    map.once("style.load", () => {
      map.setMaxZoom(LIVE_MAP_MAX_ZOOM);
      map.setMinZoom(LIVE_MAP_MIN_ZOOM);
      const loc = userLocationRef.current;
      if (loc) {
        ensureUserMarkerRef.current?.(loc.lat, loc.lng, loc.accuracy ?? null, loc.timestamp ?? null);
      }

      syncRouteLayer(map, routeLine);
    });
  }, [activeLayer, routeLine]);

  useEffect(() => {
    const map = instanceRef.current;
    if (!map) return;

    const applyRoute = () => syncRouteLayer(map, routeLine);
    if (isMapStyleReady(map)) applyRoute();
    map.on("styledata", applyRoute);

    return () => {
      map.off("styledata", applyRoute);
    };
  }, [routeLine, activeLayer]);

  useEffect(() => {
    const marker = userMarkerRef.current;
    if (!marker) return;
    const newEl = createUserMarkerElement(isLiveActive, navigationMode);
    const existing = marker.getElement();
    while (existing.firstChild) existing.removeChild(existing.firstChild);
    const tmp = document.createElement("div");
    tmp.innerHTML = newEl.innerHTML;
    while (tmp.firstChild) existing.appendChild(tmp.firstChild);
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
            <span>[Rovvy Map Click]</span>
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

      {process.env.NEXT_PUBLIC_ROVVY_MAP_DEBUG === "true" && gpsDebug && (
        <div className="absolute top-24 left-4 z-[100] bg-stone-900/90 text-stone-100 backdrop-blur-md border border-stone-800 p-3 rounded-xl shadow-lg max-w-xs text-[10px] font-mono flex flex-col gap-1 pointer-events-auto">
          <div className="font-bold text-stone-200 border-b border-stone-800 pb-1 mb-1 flex justify-between items-center">
            <span>[GPS Debug]</span>
            <button onClick={() => setGpsDebug(null)} className="text-stone-400 hover:text-stone-100 font-bold px-1.5 py-0.5">×</button>
          </div>
          <div><span className="text-stone-400">Status:</span> <span className="font-bold text-teal-400">{gpsDebug.status}</span></div>
          <div><span className="text-stone-400">Lat:</span> {gpsDebug.lat.toFixed(6)}</div>
          <div><span className="text-stone-400">Lng:</span> {gpsDebug.lng.toFixed(6)}</div>
          <div><span className="text-stone-400">Accuracy:</span> {gpsDebug.accuracy ? `${Math.round(gpsDebug.accuracy)}m` : "null"}</div>
          <div><span className="text-stone-400">Age:</span> {Math.round(gpsDebug.ageMs / 1000)}s</div>
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