"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { geolocationUnavailableMessage, haversineM } from "@/lib/geo";
import {
  GPS_ACCEPTABLE_ACCURACY_M,
  displayAccuracyRadiusMeters,
  gpsStatusFromGeolocationError,
  logRovvyGps,
  type GpsStatus,
  type GpsState,
} from "./live-gps";
import {
  getLiveMapLibreLayerStyles,
  LIVE_MAP_MAX_ZOOM,
  LIVE_MAP_MIN_ZOOM,
  warnIfUnsafeProductionTiles,
  type LiveMapLayer,
} from "@/lib/map-providers";
import {
  mapSupportsLabelSearch,
  searchVisibleMapLabels,
} from "./live-map-labels";
import type { AutocompleteResult } from "./live-geocoding";
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
    transform: scale(0.6);
    opacity: 0.85;
  }
  100% {
    transform: scale(4.5);
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
  flyToPlace: (lat: number, lng: number, zoom?: number) => void;
  searchMapLabels: (
    query: string,
    anchor: { lat: number; lng: number } | null,
    limit?: number,
  ) => AutocompleteResult[];
  supportsLabelSearch: () => boolean;
  resetNorth: () => void;
  getBearing: () => number;
  fitBounds: (bounds: [[number, number], [number, number]]) => void;
};

export type MapFollowMode = "default" | "local-only" | "off";

type Props = {
  activeLayer: LiveMapLayer;
  mapRef: React.MutableRefObject<LiveMapRef | null>;
  mapPin?: { lat: number; lng: number } | null;
  routeOriginPin?: { lat: number; lng: number } | null;
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
    el.innerHTML = `
      <div style="
        position: relative;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <!-- Pulse Wave 1 -->
        <div style="
          position: absolute;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: rgba(15, 118, 110, 0.15);
          border: 1.5px solid rgba(15, 118, 110, 0.3);
          animation: rovvy-gps-pulse 2.4s infinite cubic-bezier(0.25, 0, 0, 1);
          pointer-events: none;
          z-index: 1;
        "></div>
        <!-- Pulse Wave 2 -->
        <div style="
          position: absolute;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: rgba(15, 118, 110, 0.1);
          border: 1px solid rgba(15, 118, 110, 0.2);
          animation: rovvy-gps-pulse 2.4s infinite cubic-bezier(0.25, 0, 0, 1);
          animation-delay: 1.2s;
          pointer-events: none;
          z-index: 1;
        "></div>

        <!-- Navigation Dot -->
        <div style="
          position: absolute;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #ffffff;
          box-shadow: 0 1px 4px rgba(0,0,0,0.35);
          z-index: 2;
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <div style="
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: ${liveActive ? "#0F766E" : "#2563EB"};
          "></div>
        </div>
      </div>
    `;
    return el;
  }

  if (liveActive) {
    el.innerHTML = `
      <div style="
        position: relative;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <!-- Pulse Wave 1 -->
        <div style="
          position: absolute;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: rgba(15, 118, 110, 0.15);
          border: 1.5px solid rgba(15, 118, 110, 0.3);
          animation: rovvy-gps-pulse 2.4s infinite cubic-bezier(0.25, 0, 0, 1);
          pointer-events: none;
          z-index: 1;
        "></div>
        <!-- Pulse Wave 2 -->
        <div style="
          position: absolute;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: rgba(15, 118, 110, 0.1);
          border: 1px solid rgba(15, 118, 110, 0.2);
          animation: rovvy-gps-pulse 2.4s infinite cubic-bezier(0.25, 0, 0, 1);
          animation-delay: 1.2s;
          pointer-events: none;
          z-index: 1;
        "></div>

        <div style="
          position: absolute;
          font-size: 22px;
          line-height: 1;
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.35));
          z-index: 2;
        ">🚗</div>
      </div>
    `;
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
      <!-- Wave 1 -->
      <div style="
        position: absolute;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: rgba(26, 115, 232, 0.18);
        border: 1.5px solid rgba(26, 115, 232, 0.35);
        animation: rovvy-gps-pulse 2.4s infinite cubic-bezier(0.25, 0, 0, 1);
        pointer-events: none;
        z-index: 1;
      "></div>
      <!-- Wave 2 (delayed) -->
      <div style="
        position: absolute;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: rgba(26, 115, 232, 0.10);
        border: 1px solid rgba(26, 115, 232, 0.20);
        animation: rovvy-gps-pulse 2.4s infinite cubic-bezier(0.25, 0, 0, 1);
        animation-delay: 1.2s;
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

function createStartMarkerElement(): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "rovvy-start-marker";
  el.style.cssText = "display: flex; flex-direction: column; align-items: center; justify-content: center; pointer-events: none; user-select: none;";
  
  el.innerHTML = `
    <div style="
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #FFFFFF;
      border: 2.5px solid #64748B;
      box-shadow: 0 2px 6px rgba(0,0,0,0.25);
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <div style="width: 4px; height: 4px; border-radius: 50%; background: #0F766E;"></div>
    </div>
    <div style="
      margin-top: 4px;
      background: #0F172A;
      color: #FFFFFF;
      font-family: sans-serif;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      padding: 2.5px 6.5px;
      border-radius: 5px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.2);
      white-space: nowrap;
    ">
      Start
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

function reattachHtmlMarker(marker: maplibregl.Marker, map: maplibregl.Map): void {
  const lngLat = marker.getLngLat();
  marker.remove();
  marker.setLngLat(lngLat).addTo(map);
}

function syncNearbyMarkersNow(
  map: maplibregl.Map,
  nearbyResults: any[] | null | undefined,
  onNearbyMarkerClick: ((place: any) => void) | undefined,
  markersOut: maplibregl.Marker[],
): maplibregl.Marker[] {
  markersOut.forEach((m) => m.remove());
  if (!nearbyResults || nearbyResults.length === 0) return [];

  const next: maplibregl.Marker[] = [];
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
        ${index + 1}
      </div>
    `;

    el.addEventListener("click", (e) => {
      e.stopPropagation();
      onNearbyMarkerClick?.(res);
    });

    next.push(
      new maplibregl.Marker({ element: el, anchor: "center" })
        .setLngLat([res.lng, res.lat])
        .addTo(map),
    );
  });
  return next;
}

function syncRouteLayer(map: maplibregl.Map, routeLine: RouteLine | null | undefined) {
  whenMapStyleReady(map, () => syncRouteLayerNow(map, routeLine));
}

function syncRouteLayerNow(map: maplibregl.Map, routeLine: RouteLine | null | undefined) {
  const sourceId = "live-route";
  const layerId = "live-route-line";
  const arrowsLayerId = "live-route-arrows";

  if (!routeLine) {
    if (map.getLayer(arrowsLayerId)) map.removeLayer(arrowsLayerId);
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
    if (map.getLayer(arrowsLayerId)) {
      map.setPaintProperty(arrowsLayerId, "text-opacity", routeLine.active ? 0.85 : 0);
    } else {
      let beforeId: string | undefined = undefined;
      const layers = map.getStyle().layers;
      if (layers) {
        const firstSymbolId = layers.find(l => l.type === 'symbol')?.id;
        if (firstSymbolId) beforeId = firstSymbolId;
      }
      map.addLayer({
        id: arrowsLayerId,
        type: "symbol",
        source: sourceId,
        layout: {
          "symbol-placement": "line",
          "symbol-spacing": 60,
          "text-field": "▶",
          "text-size": [
            "interpolate",
            ["linear"],
            ["zoom"],
            5, 8,
            14, 11,
            18, 14
          ],
          "text-keep-upright": false,
          "text-rotation-alignment": "map",
          "text-pitch-alignment": "map",
          "text-offset": [0, 0],
        },
        paint: {
          "text-color": "#FFFFFF",
          "text-opacity": routeLine.active ? 0.85 : 0,
        },
      }, beforeId);
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

  map.addLayer({
    id: arrowsLayerId,
    type: "symbol",
    source: sourceId,
    layout: {
      "symbol-placement": "line",
      "symbol-spacing": 60,
      "text-field": "▶",
      "text-size": [
        "interpolate",
        ["linear"],
        ["zoom"],
        5, 8,
        14, 11,
        18, 14
      ],
      "text-keep-upright": false,
      "text-rotation-alignment": "map",
      "text-pitch-alignment": "map",
      "text-offset": [0, 0],
    },
    paint: {
      "text-color": "#FFFFFF",
      "text-opacity": routeLine.active ? 0.85 : 0,
    },
  }, beforeId);
}

export default function LiveMapComponent({
  activeLayer,
  mapRef,
  mapPin,
  routeOriginPin,
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
  const originMarkerRef = useRef<maplibregl.Marker | null>(null);
  const startMarkerRef = useRef<maplibregl.Marker | null>(null);
  const userLocationRef = useRef<UserLocation | null>(null);
  const watchIdsRef = useRef<number[]>([]);
  const isUnmountedRef = useRef(false);
  const lastStateReportedRef = useRef<{
    status: GpsStatus;
    lat: number | null;
    lng: number | null;
    timestamp: number | null;
  } | null>(null);
  const liveGpsActiveRef = useRef(false);
  const hasCenteredOnUserRef = useRef(false);
  const bestAccuracyCenteredRef = useRef<number | null>(null);

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
  const nearbyMarkersRef = useRef<maplibregl.Marker[]>([]);
  const skipInitialStyleSwitchRef = useRef(true);
  const mapPinRef = useRef(mapPin);
  mapPinRef.current = mapPin;
  const routeOriginPinRef = useRef(routeOriginPin);
  routeOriginPinRef.current = routeOriginPin;
  const routeLineRef = useRef(routeLine);
  routeLineRef.current = routeLine;
  const nearbyResultsRef = useRef(nearbyResults);
  nearbyResultsRef.current = nearbyResults;
  const onNearbyMarkerClickRef = useRef(onNearbyMarkerClick);
  onNearbyMarkerClickRef.current = onNearbyMarkerClick;

  const restoreOverlaysAfterStyleChange = useCallback((map: maplibregl.Map) => {
    syncRouteLayer(map, routeLineRef.current);

    const loc = userLocationRef.current;
    if (loc) {
      ensureUserMarkerRef.current?.(
        loc.lat,
        loc.lng,
        loc.accuracy ?? null,
        loc.timestamp ?? null,
      );
      syncAccuracyLayer(map, loc.lat, loc.lng, loc.accuracy ?? null);
    } else if (userMarkerRef.current) {
      reattachHtmlMarker(userMarkerRef.current, map);
    }

    const pin = mapPinRef.current;
    if (pin) {
      if (placeMarkerRef.current) {
        placeMarkerRef.current.setLngLat([pin.lng, pin.lat]);
        reattachHtmlMarker(placeMarkerRef.current, map);
      } else {
        placeMarkerRef.current = new maplibregl.Marker({
          element: createDestinationMarkerElement(navigationModeRef.current),
          anchor: navigationModeRef.current ? "center" : "bottom",
        })
          .setLngLat([pin.lng, pin.lat])
          .addTo(map);
      }
    }

    const originPin = routeOriginPinRef.current;
    if (originPin) {
      if (originMarkerRef.current) {
        originMarkerRef.current.setLngLat([originPin.lng, originPin.lat]);
        reattachHtmlMarker(originMarkerRef.current, map);
      } else {
        originMarkerRef.current = new maplibregl.Marker({
          element: createStartMarkerElement(),
          anchor: "center",
        })
          .setLngLat([originPin.lng, originPin.lat])
          .addTo(map);
      }
    } else {
      originMarkerRef.current?.remove();
      originMarkerRef.current = null;
    }

    const route = routeLineRef.current;
    if (route?.geometry?.length) {
      const startCoord = route.geometry[0];
      if (startMarkerRef.current) {
        startMarkerRef.current.setLngLat([startCoord[0], startCoord[1]]);
        reattachHtmlMarker(startMarkerRef.current, map);
      } else {
        startMarkerRef.current = new maplibregl.Marker({
          element: createStartMarkerElement(),
          anchor: "center",
        })
          .setLngLat([startCoord[0], startCoord[1]])
          .addTo(map);
      }
    }

    if (clickedPinMarkerRef.current) {
      reattachHtmlMarker(clickedPinMarkerRef.current, map);
    }

    nearbyMarkersRef.current = syncNearbyMarkersNow(
      map,
      nearbyResultsRef.current,
      onNearbyMarkerClickRef.current,
      nearbyMarkersRef.current,
    );
  }, []);


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
      // Always show the blue location dot (user marker), even inside the accuracy uncertainty circle, matching Google Maps.
      const showDot = true;

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

      const markerEl = userMarkerRef.current.getElement();
      if (markerEl) {
        markerEl.style.display = showDot ? "" : "none";
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
      if (isUnmountedRef.current) return;
      if (!liveGpsActiveRef.current && watchIdsRef.current.length > 0) {
        liveGpsActiveRef.current = true;
        callbacksRef.current.onLiveGpsChange?.(true);
      }
      userLocationRef.current = { lat, lng, accuracy: accuracyMeters || undefined, timestamp: timestamp || undefined };

      ensureUserMarker(lat, lng, accuracyMeters, timestamp);

      syncAccuracyLayer(map, lat, lng, accuracyMeters);

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

      // Throttling React state updates: report only if status changes, 
      // or at least 3 seconds have passed, or user moved > 10 meters.
      const now = Date.now();
      const last = lastStateReportedRef.current;
      let shouldReport = false;
      if (!last) {
        shouldReport = true;
      } else if (last.status !== newStatus) {
        shouldReport = true;
      } else if (now - (last.timestamp || 0) > 3000) {
        shouldReport = true;
      } else if (last.lat !== null && last.lng !== null) {
        const dist = haversineM(last.lat, last.lng, lat, lng);
        if (dist > 10) {
          shouldReport = true;
        }
      }

      if (shouldReport) {
        lastStateReportedRef.current = {
          status: newStatus,
          lat,
          lng,
          timestamp: now,
        };
        callbacksRef.current.onGpsStateChange?.(newState);
      }

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

      const isSignificantlyMoreAccurate =
        accuracyMeters != null &&
        (bestAccuracyCenteredRef.current == null || bestAccuracyCenteredRef.current > 100) &&
        accuracyMeters <= 100;

      if (centerMap || !hasCenteredOnUserRef.current || isSignificantlyMoreAccurate) {
        map.flyTo({ center: [lng, lat], zoom: 16, essential: true });
        hasCenteredOnUserRef.current = true;
        bestAccuracyCenteredRef.current = accuracyMeters;
      }
    }

    function stopLiveGps() {
      if (watchIdsRef.current.length > 0) {
        watchIdsRef.current.forEach((id) => {
          try {
            navigator.geolocation.clearWatch(id);
          } catch (e) {
            console.warn("[Rovvy GPS] error clearing watch id", id, e);
          }
        });
        watchIdsRef.current = [];
      }
      liveGpsActiveRef.current = false;
      lastStateReportedRef.current = null;
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
      syncAccuracyLayer(map, null, null, null);
    }

    function handleGeolocationError(err: GeolocationPositionError, source: string) {
      if (isUnmountedRef.current) return;
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
        syncAccuracyLayer(map, null, null, null);
        callbacksRef.current.onGpsStateChange?.({
          status: "denied", lat: null, lng: null, accuracyMeters: null, heading: null, speed: null, timestamp: null, source: null
        });
        return;
      }

      // If we have a fresh coordinate (e.g. from watchPosition), ignore temporary timeouts/errors
      if (userLocationRef.current && userLocationRef.current.timestamp) {
        const ageMs = Date.now() - userLocationRef.current.timestamp;
        if (ageMs < 45000) {
          logRovvyGps(`ignoring geolocation error/timeout in ${source} because we have a fresh coordinate (${Math.round(ageMs / 1000)}s old)`);
          return;
        }
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
      bestAccuracyCenteredRef.current = null;

      logRovvyGps("requesting location");

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude, accuracy, speed, heading } = pos.coords;
          applyUserLocation(latitude, longitude, true, speed, heading, accuracy, pos.timestamp);
        },
        (err) => handleGeolocationError(err, "getCurrentPosition"),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
      );

      const wId = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude, accuracy, speed, heading } = pos.coords;
          applyUserLocation(latitude, longitude, false, speed, heading, accuracy, pos.timestamp);
        },
        (err) => handleGeolocationError(err, "watchPosition"),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
      );
      watchIdsRef.current.push(wId);
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
      flyToPlace: (lat: number, lng: number, zoom = 15) => {
        routeFitKeyRef.current = "";
        map.flyTo({ center: [lng, lat], zoom, essential: true });
      },
      searchMapLabels: (query, anchor, limit = 8) =>
        searchVisibleMapLabels(map, query, anchor, limit),
      supportsLabelSearch: () => mapSupportsLabelSearch(map),
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
          const ageMs = userLocationRef.current?.timestamp ? Date.now() - userLocationRef.current.timestamp : Infinity;
          const isFresh = userLocationRef.current && ageMs < 15000;
          if (!isFresh) {
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
          }
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
      isUnmountedRef.current = true;
      ensureUserMarkerRef.current = null;
      try {
        stopLiveGps();
      } catch (err) {
        console.warn("[Rovvy GPS] error in stopLiveGps unmount", err);
      }
      try {
        userMarkerRef.current?.remove();
      } catch (err) {
        console.warn("[Rovvy GPS] error userMarkerRef remove", err);
      }
      userMarkerRef.current = null;
      try {
        placeMarkerRef.current?.remove();
      } catch (err) {
        console.warn("[Rovvy GPS] error placeMarkerRef remove", err);
      }
      placeMarkerRef.current = null;
      try {
        originMarkerRef.current?.remove();
      } catch (err) {
        console.warn("[Rovvy GPS] error originMarkerRef remove", err);
      }
      originMarkerRef.current = null;
      try {
        startMarkerRef.current?.remove();
      } catch (err) {
        console.warn("[Rovvy GPS] error startMarkerRef remove", err);
      }
      startMarkerRef.current = null;
      try {
        clickedPinMarkerRef.current?.remove();
      } catch (err) {
        console.warn("[Rovvy GPS] error clickedPinMarkerRef remove", err);
      }
      clickedPinMarkerRef.current = null;
      try {
        nearbyMarkersRef.current.forEach((m) => m.remove());
      } catch (err) {
        console.warn("[Rovvy GPS] error nearbyMarkers remove", err);
      }
      nearbyMarkersRef.current = [];
      try {
        map.remove();
      } catch (err) {
        console.warn("[Rovvy GPS] error map remove", err);
      }
      mapRef.current = null;
    };

  }, [mapRef]);

  useEffect(() => {
    if (!instanceRef.current) return;
    const map = instanceRef.current;

    if (skipInitialStyleSwitchRef.current) {
      skipInitialStyleSwitchRef.current = false;
      syncRouteLayer(map, routeLineRef.current);
      return;
    }

    const layerStyles = getLiveMapLibreLayerStyles();
    map.setStyle(layerStyles[activeLayer] || layerStyles.street);
    map.once("style.load", () => {
      map.setMaxZoom(LIVE_MAP_MAX_ZOOM);
      map.setMinZoom(LIVE_MAP_MIN_ZOOM);
      restoreOverlaysAfterStyleChange(map);
    });
  }, [activeLayer, restoreOverlaysAfterStyleChange]);

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
    const map = instanceRef.current;
    if (!map) return;

    if (!routeLine || !routeLine.geometry || routeLine.geometry.length === 0) {
      startMarkerRef.current?.remove();
      startMarkerRef.current = null;
      return;
    }

    const startCoord = routeLine.geometry[0]; // [lng, lat]
    if (startMarkerRef.current) {
      startMarkerRef.current.setLngLat([startCoord[0], startCoord[1]]);
    } else {
      startMarkerRef.current = new maplibregl.Marker({
        element: createStartMarkerElement(),
        anchor: "center",
      })
        .setLngLat([startCoord[0], startCoord[1]])
        .addTo(map);
    }
  }, [routeLine]);

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
    const map = instanceRef.current;
    if (!map) return;

    if (!routeOriginPin) {
      originMarkerRef.current?.remove();
      originMarkerRef.current = null;
      return;
    }

    if (originMarkerRef.current) {
      originMarkerRef.current.setLngLat([routeOriginPin.lng, routeOriginPin.lat]);
    } else {
      originMarkerRef.current = new maplibregl.Marker({
        element: createStartMarkerElement(),
        anchor: "center",
      })
        .setLngLat([routeOriginPin.lng, routeOriginPin.lat])
        .addTo(map);
    }
  }, [routeOriginPin]);

  useEffect(() => {
    if (mapPin && clickedPinMarkerRef.current) {
      clickedPinMarkerRef.current.remove();
      clickedPinMarkerRef.current = null;
    }
  }, [mapPin]);

  useEffect(() => {
    const map = instanceRef.current;
    if (!map) return;

    nearbyMarkersRef.current = syncNearbyMarkersNow(
      map,
      nearbyResults,
      onNearbyMarkerClick,
      nearbyMarkersRef.current,
    );

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

function createGeoJsonCircle(
  center: [number, number],
  radiusInKm: number,
  points: number = 64
): GeoJSON.Feature<GeoJSON.Polygon> {
  const coords = {
    latitude: center[1],
    longitude: center[0],
  };

  const km = radiusInKm;

  const ret = [];
  const distanceX = km / (111.32 * Math.cos((coords.latitude * Math.PI) / 180));
  const distanceY = km / 110.574;

  let theta, x, y;
  for (let i = 0; i < points; i++) {
    theta = (i / points) * (2 * Math.PI);
    x = distanceX * Math.cos(theta);
    y = distanceY * Math.sin(theta);

    ret.push([coords.longitude + x, coords.latitude + y]);
  }
  ret.push(ret[0]); // close the loop

  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [ret],
    },
  };
}

function syncAccuracyLayer(
  map: maplibregl.Map,
  lat: number | null | undefined,
  lng: number | null | undefined,
  accuracyMeters: number | null | undefined
) {
  whenMapStyleReady(map, () => syncAccuracyLayerNow(map, lat, lng, accuracyMeters));
}

function syncAccuracyLayerNow(
  map: maplibregl.Map,
  lat: number | null | undefined,
  lng: number | null | undefined,
  accuracyMeters: number | null | undefined
) {
  const sourceId = "user-gps-accuracy";
  const fillLayerId = "user-gps-accuracy-fill";
  const strokeLayerId = "user-gps-accuracy-stroke";

  const radius = displayAccuracyRadiusMeters(accuracyMeters);

  if (lat == null || lng == null || radius == null) {
    try {
      if (map.getLayer(fillLayerId)) map.removeLayer(fillLayerId);
      if (map.getLayer(strokeLayerId)) map.removeLayer(strokeLayerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    } catch (err) {
      console.warn("[Rovvy Map] Error cleaning up accuracy layer", err);
    }
    return;
  }

  const circleFeature = createGeoJsonCircle([lng, lat], radius / 1000);

  try {
    const existing = map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;
    if (existing) {
      existing.setData(circleFeature);
      if (!map.getLayer(fillLayerId)) {
        addAccuracyLayers(map, sourceId, fillLayerId, strokeLayerId);
      }
    } else {
      map.addSource(sourceId, {
        type: "geojson",
        data: circleFeature,
      });
      addAccuracyLayers(map, sourceId, fillLayerId, strokeLayerId);
    }
  } catch (err) {
    console.warn("[Rovvy Map] Error syncing accuracy layer", err);
  }
}

function addAccuracyLayers(
  map: maplibregl.Map,
  sourceId: string,
  fillLayerId: string,
  strokeLayerId: string
) {
  let beforeId: string | undefined = undefined;
  const layers = map.getStyle().layers;
  if (layers) {
    const firstSymbolId = layers.find((l) => l.type === "symbol")?.id;
    if (firstSymbolId) beforeId = firstSymbolId;
  }

  map.addLayer(
    {
      id: fillLayerId,
      type: "fill",
      source: sourceId,
      paint: {
        "fill-color": "#1A73E8",
        "fill-opacity": 0.15,
      },
    },
    beforeId
  );

  map.addLayer(
    {
      id: strokeLayerId,
      type: "line",
      source: sourceId,
      paint: {
        "line-color": "#1A73E8",
        "line-width": 1,
        "line-opacity": 0.4,
      },
    },
    beforeId
  );
}