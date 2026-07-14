"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { geolocationUnavailableMessage, geolocationErrorMessage, haversineM } from "@/lib/geo";
import {
  GPS_ACCEPTABLE_ACCURACY_M,
  displayAccuracyRadiusMeters,
  gpsStatusFromGeolocationError,
  logRovvyGps,
  logRovvyLiveDebug,
  logRovvyLiveWarn,
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
import { ensureCleanMapHouseNumberLabels } from "./live-clean-map-housenumbers";
import { getPoiMarkerPresentation } from "./live-poi-icons";
import type { AutocompleteResult } from "./live-geocoding";
import type { RouteLine, UserLocationUpdate } from "./live-types";
import { LOCAL_LIVE_MAX_M } from "./live-types";
import {
  getRouteVisualStyle,
  routeBorderCasingWidth,
  routeBorderCoreWidth,
  routeCasingWidth,
  routeCoreWidth,
} from "./live-route-style";
import {
  LIVE_MAP_2D_PITCH,
  LIVE_MAP_3D_PITCH,
  LIVE_MAP_3D_PITCH_THRESHOLD,
  type LiveMapViewMode,
} from "./live-layout";

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
.rovvy-live-map-container .maplibregl-marker:has(.gt-user-location-marker) {
  z-index: 6 !important;
}
.gt-user-location-marker {
  position: relative;
  z-index: 6;
  width: 28px;
  height: 28px;
  pointer-events: none;
}
.gt-user-location-marker .gt-user-location-dot {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.35);
  z-index: 4;
  display: flex;
  align-items: center;
  justify-content: center;
}
.gt-user-location-marker .gt-user-location-dot-core {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #1a73e8;
}
.user-location-popup.maplibregl-popup {
  z-index: 5;
}
.user-location-popup.maplibregl-popup .maplibregl-popup-tip {
  border-top-color: #ffffff;
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
  if (typeof document === "undefined") return;
  let style = document.getElementById("rovvy-live-map-css") as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = "rovvy-live-map-css";
    document.head.appendChild(style);
    liveCssInjected = true;
  }
  style.textContent = LIVE_MAP_CSS;
}

export type UserLocation = { lat: number; lng: number; accuracy?: number; timestamp?: number };

export type { GpsStatus, GpsState } from "./live-gps";

export type { LiveMapViewMode } from "./live-layout";

export type LiveMapRef = {
  zoomIn: () => void;
  zoomOut: () => void;
  getZoom: () => number;
  setZoom: (zoom: number) => void;
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
  getPitch: () => number;
  getViewMode: () => LiveMapViewMode;
  setViewMode: (mode: LiveMapViewMode) => void;
  fitBounds: (bounds: [[number, number], [number, number]]) => void;
};

export type MapFollowMode = "default" | "local-only" | "off";

export type MapClickPayload = {
  lat: number;
  lng: number;
  screenX: number;
  screenY: number;
  features: any[];
};

type Props = {
  activeLayer: LiveMapLayer;
  mapRef: React.MutableRefObject<LiveMapRef | null>;
  mapPin?: { lat: number; lng: number } | null;
  mapClickPin?: { lat: number; lng: number } | null;
  coordinateOverlay?: { lat: number; lng: number } | null;
  routeOriginPin?: { lat: number; lng: number } | null;
  routeLine?: RouteLine | null;
  isLiveActive?: boolean;
  navigationMode?: boolean;
  mapFollowMode?: MapFollowMode;
  onGpsStateChange?: (state: GpsState) => void;
  nearbyResults?: any[] | null;
  onNearbyMarkerClick?: (place: any) => void;
  onMapClick?: (payload: MapClickPayload) => void;
  onMapDoubleClick?: (payload: Omit<MapClickPayload, "features">) => void;
  onLiveGpsChange?: (active: boolean) => void;
  onMapInteraction?: (interacting: boolean) => void;
  onBearingChange?: (bearing: number) => void;
  onZoomChange?: (zoom: number) => void;
  crossBorderAlert?: {
    fromCountry?: string | null;
    toCountry?: string | null;
  } | null;
};

function createUserMarkerElement(liveActive: boolean, navigating: boolean): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "gt-user-location-marker";
  el.style.cssText =
    "position:relative;width:28px;height:28px;pointer-events:none;z-index:6;";

  const dotColor = navigating || liveActive ? (liveActive ? "#0F766E" : "#2563EB") : "#1A73E8";
  const pulseColor = navigating || liveActive ? "15, 118, 110" : "26, 115, 232";

  // All dot styling is inline — never depend on injected CSS for visibility.
  el.innerHTML = `
    <div style="position:relative;width:28px;height:28px;display:flex;align-items:center;justify-content:center;">
      <div style="position:absolute;width:28px;height:28px;border-radius:50%;background:rgba(${pulseColor},0.18);border:1.5px solid rgba(${pulseColor},0.35);animation:rovvy-gps-pulse 2.4s infinite cubic-bezier(0.25,0,0,1);pointer-events:none;z-index:1;"></div>
      <div style="position:absolute;width:28px;height:28px;border-radius:50%;background:rgba(${pulseColor},0.10);border:1px solid rgba(${pulseColor},0.20);animation:rovvy-gps-pulse 2.4s infinite cubic-bezier(0.25,0,0,1);animation-delay:1.2s;pointer-events:none;z-index:1;"></div>
      <div data-gps-dot="true" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:20px;height:20px;border-radius:50%;background:#ffffff;box-shadow:0 1px 6px rgba(0,0,0,0.4);z-index:4;display:flex;align-items:center;justify-content:center;">
        <div style="width:14px;height:14px;border-radius:50%;background:${dotColor};"></div>
      </div>
    </div>
  `;
  return el;
}

function applyUserMarkerContent(
  target: HTMLElement,
  liveActive: boolean,
  navigating: boolean,
): void {
  const fresh = createUserMarkerElement(liveActive, navigating);
  target.className = fresh.className;
  target.style.cssText = fresh.style.cssText;
  target.innerHTML = fresh.innerHTML;
}

function ensureMarkerOnMap(marker: maplibregl.Marker, map: maplibregl.Map): void {
  const el = marker.getElement();
  if (!el.isConnected) {
    reattachHtmlMarker(marker, map);
  }
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

function createRovvyTeardropPinElement(size: "md" | "lg" = "md"): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText = "pointer-events:none;";
  const pinSize = size === "lg" ? 28 : 24;
  const wrapH = size === "lg" ? 40 : 36;
  el.innerHTML = `
    <div style="
      position: relative;
      width: ${pinSize + 4}px;
      height: ${wrapH}px;
      display: flex;
      align-items: flex-start;
      justify-content: center;
    ">
      <div style="
        width: ${pinSize}px;
        height: ${pinSize}px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        background: #0F766E;
        border: 3px solid #ffffff;
        box-shadow: 0 3px 10px rgba(0,0,0,0.35);
      "></div>
      <div style="
        position: absolute;
        top: ${size === "lg" ? 8 : 7}px;
        left: 50%;
        transform: translateX(-50%);
        width: ${size === "lg" ? 9 : 8}px;
        height: ${size === "lg" ? 9 : 8}px;
        border-radius: 50%;
        background: #ffffff;
      "></div>
    </div>
  `;
  return el;
}

function createDestinationMarkerElement(navigating: boolean): HTMLDivElement {
  if (navigating) {
    const el = document.createElement("div");
    el.innerHTML = `<div style="width:22px;height:22px;border-radius:50%;background:#FFFFFF;border:4px solid #0F766E;box-shadow:0 2px 8px rgba(0,0,0,0.25);"></div>`;
    return el;
  }
  return createRovvyTeardropPinElement("lg");
}

function createClickedPinMarkerElement(): HTMLDivElement {
  return createRovvyTeardropPinElement("md");
}

function createCoordinateOverlayElement(lat: number, lng: number): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText = "pointer-events:none;z-index:8;";
  const latDir = lat >= 0 ? "N" : "S";
  const lngDir = lng >= 0 ? "E" : "W";
  el.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:4px;transform:translateY(-4px);">
      <div style="width:12px;height:12px;border-radius:50%;background:#0F766E;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>
      <div style="max-width:220px;padding:6px 8px;border-radius:8px;background:rgba(255,255,255,0.96);border:1px solid #e7e5e4;font-size:11px;font-weight:600;color:#1c1917;text-align:center;box-shadow:0 4px 12px rgba(0,0,0,0.12);font-family:ui-monospace,monospace;line-height:1.35;">
        ${Math.abs(lat).toFixed(5)}° ${latDir}<br/>${Math.abs(lng).toFixed(5)}° ${lngDir}
      </div>
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
  const run = () => {
    if (!isMapStyleReady(map)) return;
    try {
      fn();
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message.includes("Style is not done loading") ||
          err.message.includes("not done loading"))
      ) {
        map.once("idle", run);
      }
    }
  };

  if (isMapStyleReady(map)) {
    run();
    return;
  }

  const onStyleData = () => {
    if (!isMapStyleReady(map)) return;
    map.off("styledata", onStyleData);
    run();
  };
  map.on("styledata", onStyleData);
}

function routeOverlayBeforeId(map: maplibregl.Map): string | undefined {
  const layers = map.getStyle()?.layers;
  if (!layers) return undefined;
  return layers.find((layer) => layer.type === "symbol")?.id;
}

/** @deprecated Legacy single-layer paint — kept so stale HMR bundles do not crash. */
function routeLinePaint(
  routeLine: RouteLine,
  activeLayer: LiveMapLayer = "street",
): maplibregl.LineLayerSpecification["paint"] {
  const visual = getRouteVisualStyle(activeLayer, routeLine.active);
  return {
    "line-color": visual.coreColor,
    "line-width": routeCoreWidth(routeLine.active),
    "line-opacity": visual.coreOpacity,
  };
}

function routeArrowLayout(): maplibregl.SymbolLayerSpecification["layout"] {
  return {
    "symbol-placement": "line",
    "symbol-spacing": 60,
    "text-field": "▶",
    "text-size": [
      "interpolate",
      ["linear"],
      ["zoom"],
      5,
      8,
      14,
      11,
      18,
      14,
    ],
    "text-keep-upright": false,
    "text-rotation-alignment": "map",
    "text-pitch-alignment": "map",
    "text-offset": [0, 0],
  };
}

function createExactSelectedPlaceMarkerElement(lat: number, lng: number): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText = "pointer-events:none;z-index:8;";
  const latDir = lat >= 0 ? "N" : "S";
  const lngDir = lng >= 0 ? "E" : "W";
  el.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:6px;transform:translateY(-4px);">
      <div style="position:relative;width:42px;height:42px;">
        <div style="position:absolute;inset:0;border-radius:50%;background:rgba(245,158,11,0.22);border:2px solid rgba(245,158,11,0.75);animation:rovvy-gps-pulse 2s infinite cubic-bezier(0.25,0,0,1);"></div>
        <div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:16px;height:16px;border-radius:50%;background:#F59E0B;border:3px solid #ffffff;box-shadow:0 0 16px rgba(245,158,11,0.85);"></div>
        <div style="position:absolute;left:50%;top:4px;bottom:4px;width:2px;transform:translateX(-50%);background:rgba(255,255,255,0.9);"></div>
        <div style="position:absolute;top:50%;left:4px;right:4px;height:2px;transform:translateY(-50%);background:rgba(255,255,255,0.9);"></div>
      </div>
      <div style="max-width:220px;padding:5px 9px;border-radius:9px;background:rgba(15,23,42,0.94);border:1px solid rgba(255,255,255,0.18);color:#fff;font-size:10px;font-weight:700;font-family:ui-monospace,monospace;text-align:center;line-height:1.35;box-shadow:0 4px 16px rgba(0,0,0,0.38);">
        Selected place<br/>
        ${Math.abs(lat).toFixed(5)}° ${latDir}<br/>
        ${Math.abs(lng).toFixed(5)}° ${lngDir}
      </div>
    </div>
  `;
  return el;
}

function createFarDestinationMarkerElement(): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText = "pointer-events:none;z-index:7;";
  el.innerHTML = `
    <div style="position:relative;width:36px;height:48px;display:flex;align-items:flex-start;justify-content:center;">
      <div style="position:absolute;width:36px;height:36px;border-radius:50%;background:rgba(15,118,110,0.18);border:2px solid rgba(15,118,110,0.45);animation:rovvy-gps-pulse 2.4s infinite cubic-bezier(0.25,0,0,1);"></div>
      <div style="position:relative;width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#0F766E;border:3px solid #ffffff;box-shadow:0 0 18px rgba(15,118,110,0.65),0 4px 12px rgba(0,0,0,0.28);"></div>
      <div style="position:absolute;top:9px;left:50%;transform:translateX(-50%);width:10px;height:10px;border-radius:50%;background:#ffffff;"></div>
    </div>
  `;
  return el;
}

function createBorderCheckpointMarkerElement(label: string): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText = "pointer-events:none;z-index:9;";
  el.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:4px;transform:translateY(-6px);">
      <div style="width:30px;height:30px;border-radius:10px;background:#F59E0B;border:2.5px solid #ffffff;box-shadow:0 0 16px rgba(245,158,11,0.55),0 4px 12px rgba(0,0,0,0.28);display:flex;align-items:center;justify-content:center;font-size:15px;line-height:1;">
        🛂
      </div>
      <div style="max-width:240px;padding:6px 10px;border-radius:10px;background:rgba(255,251,235,0.97);border:1.5px solid #F59E0B;font-size:11px;font-weight:700;color:#92400E;text-align:center;box-shadow:0 4px 14px rgba(0,0,0,0.18);line-height:1.35;">
        ${label}
      </div>
    </div>
  `;
  return el;
}

function syncBorderCrossingLayersNow(
  map: maplibregl.Map,
  routeLine: RouteLine | null | undefined,
  activeLayer: LiveMapLayer,
) {
  const sourceId = "live-route-border-highlight";
  const casingLayerId = "live-route-border-highlight-casing";
  const layerId = "live-route-border-highlight-line";
  const hasRoadRoute =
    !!routeLine?.geometry && routeLine.geometry.length >= 2;
  const crossings = hasRoadRoute ? (routeLine?.borderCrossings ?? []) : [];

  if (!crossings.length) {
    if (map.getLayer(layerId)) map.removeLayer(layerId);
    if (map.getLayer(casingLayerId)) map.removeLayer(casingLayerId);
    if (map.getSource(sourceId)) map.removeSource(sourceId);
    return;
  }

  const style = getRouteVisualStyle(activeLayer, routeLine?.active ?? false);

  const features: GeoJSON.Feature<GeoJSON.LineString>[] = crossings
    .filter((crossing) => crossing.highlightGeometry && crossing.highlightGeometry.length >= 2)
    .map((crossing, index) => ({
      type: "Feature",
      properties: { index },
      geometry: {
        type: "LineString",
        coordinates: crossing.highlightGeometry as [number, number][],
      },
    }));

  if (!features.length) {
    if (map.getLayer(layerId)) map.removeLayer(layerId);
    if (map.getLayer(casingLayerId)) map.removeLayer(casingLayerId);
    if (map.getSource(sourceId)) map.removeSource(sourceId);
    return;
  }

  const data: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features,
  };

  const existingSource = map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;
  if (existingSource) {
    existingSource.setData(data);
  } else {
    map.addSource(sourceId, { type: "geojson", data });
  }

  const beforeId = routeOverlayBeforeId(map);
  const active = routeLine?.active ?? false;
  const borderPaint = {
    casing: {
      "line-color": style.borderCasingColor,
      "line-width": routeBorderCasingWidth(active),
      "line-opacity": style.casingOpacity,
    },
    core: {
      "line-color": style.borderColor,
      "line-width": routeBorderCoreWidth(active),
      "line-opacity": active ? 0.98 : 0.92,
      "line-dasharray": [1.4, 1.1] as [number, number],
    },
  };

  if (map.getLayer(casingLayerId)) {
    map.setPaintProperty(casingLayerId, "line-color", borderPaint.casing["line-color"]);
    map.setPaintProperty(casingLayerId, "line-width", borderPaint.casing["line-width"]);
    map.setPaintProperty(casingLayerId, "line-opacity", borderPaint.casing["line-opacity"]);
  } else {
    map.addLayer(
      {
        id: casingLayerId,
        type: "line",
        source: sourceId,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: borderPaint.casing,
      },
      beforeId,
    );
  }

  if (map.getLayer(layerId)) {
    map.setPaintProperty(layerId, "line-color", borderPaint.core["line-color"]);
    map.setPaintProperty(layerId, "line-width", borderPaint.core["line-width"]);
    map.setPaintProperty(layerId, "line-opacity", borderPaint.core["line-opacity"]);
    map.setPaintProperty(layerId, "line-dasharray", borderPaint.core["line-dasharray"]);
  } else {
    map.addLayer(
      {
        id: layerId,
        type: "line",
        source: sourceId,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: borderPaint.core,
      },
      beforeId,
    );
  }
}

function syncRouteLayerNow(
  map: maplibregl.Map,
  routeLine: RouteLine | null | undefined,
  activeLayer: LiveMapLayer,
) {
  const sourceId = "live-route";
  const casingLayerId = "live-route-casing";
  const layerId = "live-route-line";
  const arrowsLayerId = "live-route-arrows";

  if (!routeLine || routeLine.geometry.length === 0) {
    if (map.getLayer(arrowsLayerId)) map.removeLayer(arrowsLayerId);
    if (map.getLayer(layerId)) map.removeLayer(layerId);
    if (map.getLayer(casingLayerId)) map.removeLayer(casingLayerId);
    if (map.getSource(sourceId)) map.removeSource(sourceId);
    syncBorderCrossingLayersNow(map, null, activeLayer);
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

  const existingSource = map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;
  if (existingSource) {
    existingSource.setData(data);
  } else {
    map.addSource(sourceId, { type: "geojson", data });
  }

  const beforeId = routeOverlayBeforeId(map);
  const visual = getRouteVisualStyle(activeLayer, routeLine.active);
  const casingPaint = {
    "line-color": visual.casingColor,
    "line-width": routeCasingWidth(routeLine.active),
    "line-opacity": visual.casingOpacity,
  };
  const corePaint = {
    "line-color": visual.coreColor,
    "line-width": routeCoreWidth(routeLine.active),
    "line-opacity": visual.coreOpacity,
  };

  if (map.getLayer(casingLayerId)) {
    map.setPaintProperty(casingLayerId, "line-color", casingPaint["line-color"]);
    map.setPaintProperty(casingLayerId, "line-width", casingPaint["line-width"]);
    map.setPaintProperty(casingLayerId, "line-opacity", casingPaint["line-opacity"]);
  } else {
    map.addLayer(
      {
        id: casingLayerId,
        type: "line",
        source: sourceId,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: casingPaint,
      },
      beforeId,
    );
  }

  if (map.getLayer(layerId)) {
    map.setPaintProperty(layerId, "line-color", corePaint["line-color"]);
    map.setPaintProperty(layerId, "line-width", corePaint["line-width"]);
    map.setPaintProperty(layerId, "line-opacity", corePaint["line-opacity"]);
  } else {
    map.addLayer(
      {
        id: layerId,
        type: "line",
        source: sourceId,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: corePaint,
      },
      beforeId,
    );
  }

  const arrowOpacity = routeLine.active ? 0.85 : 0;
  if (map.getLayer(arrowsLayerId)) {
    map.setPaintProperty(arrowsLayerId, "text-opacity", arrowOpacity);
    map.setPaintProperty(arrowsLayerId, "text-color", visual.arrowColor);
  } else {
    map.addLayer(
      {
        id: arrowsLayerId,
        type: "symbol",
        source: sourceId,
        layout: routeArrowLayout(),
        paint: {
          "text-color": visual.arrowColor,
          "text-halo-color": visual.casingColor,
          "text-halo-width": 1.5,
          "text-opacity": arrowOpacity,
        },
      },
      beforeId,
    );
  }

  syncBorderCrossingLayersNow(map, routeLine, activeLayer);
}

function syncRouteLayer(
  map: maplibregl.Map,
  routeLine: RouteLine | null | undefined,
  activeLayer: LiveMapLayer,
) {
  whenMapStyleReady(map, () => syncRouteLayerNow(map, routeLine, activeLayer));
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

  const dense = nearbyResults.length > 20;
  const showNumbers = !dense && nearbyResults.length <= 20;

  const next: maplibregl.Marker[] = [];
  nearbyResults.forEach((res, index) => {
    const presentation = getPoiMarkerPresentation(res);
    const el = document.createElement("div");
    el.className = "nearby-result-marker";
    const size = dense ? 14 : presentation.size;
    const title = presentation.landmark
      ? `${res.name ?? "Place"} (Landmark)`
      : (res.name ?? "Place");

    if (dense) {
      el.innerHTML = `<div style="
          width:${size}px;height:${size}px;border-radius:50%;
          background:${presentation.background};border:2px solid white;
          box-shadow:0 1px 4px rgba(0,0,0,0.35);cursor:pointer;
        " title="${title}"></div>`;
    } else if (showNumbers) {
      el.innerHTML = `<div style="position:relative;display:inline-flex;cursor:pointer;" title="${title}">
          <div style="
            display:flex;align-items:center;justify-content:center;
            min-width:${presentation.size}px;height:${presentation.size}px;padding:0 5px;border-radius:999px;
            background:${presentation.background};color:white;font-size:12px;font-weight:700;
            border:${presentation.landmark ? "3px" : "2px"} solid ${presentation.landmark ? "#FDE68A" : "white"};
            box-shadow:0 2px 6px rgba(0,0,0,0.3);
          ">${presentation.icon}</div>
          <span style="
            position:absolute;top:-6px;right:-6px;min-width:14px;height:14px;padding:0 3px;
            border-radius:999px;background:#1E293B;color:white;font-size:9px;font-weight:700;
            display:flex;align-items:center;justify-content:center;border:1px solid white;
          ">${index + 1}</span>
        </div>`;
    } else {
      el.innerHTML = `<div style="
          display:flex;align-items:center;justify-content:center;
          min-width:${presentation.size}px;height:${presentation.size}px;padding:0 5px;border-radius:999px;
          background:${presentation.background};color:white;font-size:12px;font-weight:700;
          border:${presentation.landmark ? "3px" : "2px"} solid ${presentation.landmark ? "#FDE68A" : "white"};
          box-shadow:0 2px 6px rgba(0,0,0,0.3);cursor:pointer;
        " title="${title}">${presentation.icon}</div>`;
    }

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

export default function LiveMapComponent({
  activeLayer,
  mapRef,
  mapPin,
  mapClickPin,
  coordinateOverlay,
  routeOriginPin,
  routeLine,
  isLiveActive = false,
  navigationMode = false,
  mapFollowMode = "default",
  onGpsStateChange,
  nearbyResults,
  onNearbyMarkerClick,
  onMapClick,
  onMapDoubleClick,
  onLiveGpsChange,
  onMapInteraction,
  onBearingChange,
  onZoomChange,
  crossBorderAlert = null,
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
  const programmaticCameraMoveRef = useRef(false);

  const markProgrammaticCameraMove = useCallback(() => {
    programmaticCameraMoveRef.current = true;
  }, []);

  const callbacksRef = useRef({ onGpsStateChange, onMapClick, onMapDoubleClick, onLiveGpsChange, onMapInteraction, onBearingChange, onZoomChange });
  callbacksRef.current = { onGpsStateChange, onMapClick, onMapDoubleClick, onLiveGpsChange, onMapInteraction, onBearingChange, onZoomChange };
  const isLiveActiveRef = useRef(isLiveActive);
  isLiveActiveRef.current = isLiveActive;
  const navigationModeRef = useRef(navigationMode);
  navigationModeRef.current = navigationMode;
  const navigationFollowUserRef = useRef(true);
  const mapFollowModeRef = useRef(mapFollowMode);
  mapFollowModeRef.current = mapFollowMode;
  const crossBorderAlertRef = useRef(crossBorderAlert);
  crossBorderAlertRef.current = crossBorderAlert;
  const clickedPinMarkerRef = useRef<maplibregl.Marker | null>(null);
  const coordinateOverlayMarkerRef = useRef<maplibregl.Marker | null>(null);
  const ensureUserMarkerRef = useRef<((lat: number, lng: number, accuracy: number | null, timestamp: number | null) => void) | null>(null);
  const nearbyMarkersRef = useRef<maplibregl.Marker[]>([]);
  const borderCheckpointMarkersRef = useRef<maplibregl.Marker[]>([]);
  const skipInitialStyleSwitchRef = useRef(true);
  const styleTransitionRef = useRef(false);
  const viewModeRef = useRef<LiveMapViewMode>("2d");
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
  const activeLayerRef = useRef(activeLayer);
  activeLayerRef.current = activeLayer;

  const restoreOverlaysAfterStyleChange = useCallback((map: maplibregl.Map) => {
    logRovvyLiveDebug("[Rovvy Debug] marker restore after style.load, userLocation:", userLocationRef.current);
    syncRouteLayerNow(map, routeLineRef.current, activeLayerRef.current);

    const loc = userLocationRef.current;
    if (loc) {
      ensureUserMarkerRef.current?.(
        loc.lat,
        loc.lng,
        loc.accuracy ?? null,
        loc.timestamp ?? null,
      );
      if (userMarkerRef.current) {
        reattachHtmlMarker(userMarkerRef.current, map);
      }
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
          element: createExactSelectedPlaceMarkerElement(pin.lat, pin.lng),
          anchor: "center",
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

    const borderCrossings =
      routeLineRef.current?.geometry && routeLineRef.current.geometry.length >= 2
        ? (routeLineRef.current.borderCrossings ?? [])
        : [];
    borderCheckpointMarkersRef.current.forEach((marker) => marker.remove());
    borderCheckpointMarkersRef.current = borderCrossings.map((crossing) =>
      new maplibregl.Marker({
        element: createBorderCheckpointMarkerElement(
          crossing.approximate ? "Immigration check likely here" : "Immigration check here",
        ),
        anchor: "bottom",
      })
        .setLngLat([crossing.lng, crossing.lat])
        .addTo(map),
    );

    if (activeLayerRef.current === "clean") {
      ensureCleanMapHouseNumberLabels(map);
    }
  }, []);

  const restoreOverlaysRef = useRef(restoreOverlaysAfterStyleChange);
  restoreOverlaysRef.current = restoreOverlaysAfterStyleChange;


  useEffect(() => {
    injectLiveMapCursorStyle();
  }, []);

  useEffect(() => {
    warnIfUnsafeProductionTiles("live");
  }, []);

  useEffect(() => {
    if (!mapContainer.current) return;
    isUnmountedRef.current = false;

    const layerStyles = getLiveMapLibreLayerStyles();
    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: layerStyles[activeLayer] || layerStyles.street,
      center: [-87.726, 41.922], // Pulaski Road, Chicago baseline coordinates
      zoom: 14,
      minZoom: LIVE_MAP_MIN_ZOOM,
      maxZoom: LIVE_MAP_MAX_ZOOM,
      pitch: LIVE_MAP_2D_PITCH,
      maxPitch: LIVE_MAP_3D_PITCH,
      attributionControl: false,
      doubleClickZoom: false,
    });

    instanceRef.current = map;

    map.on("styleimagemissing", (e) => {
      const id = e.id;
      const width = 1;
      const height = 1;
      const data = new Uint8Array(4); // transparent pixel [0,0,0,0]
      if (!map.hasImage(id)) {
        map.addImage(id, { width, height, data });
      }
    });

    map.on("load", () => {
      if (map.getZoom() > LIVE_MAP_MAX_ZOOM) {
        map.setZoom(LIVE_MAP_MAX_ZOOM);
      }
      logRovvyLiveDebug("[Rovvy Debug] Map loaded, restoring overlays");
      restoreOverlaysRef.current(map);
    });

    map.on("error", (event) => {
      const error = event?.error;
      if (isRoutineTileFetchError(error)) return;
      logRovvyLiveWarn("[Rovvy MapLibre]", error || event);
    });

    let suppressClickUntil = 0;

    map.on("dblclick", (e) => {
      e.preventDefault();
      suppressClickUntil = Date.now() + 450;
      if (mapContainer.current) {
        showClickRipple(mapContainer.current, e.point.x, e.point.y);
      }
      callbacksRef.current.onMapDoubleClick?.({
        lat: e.lngLat.lat,
        lng: e.lngLat.lng,
        screenX: e.point.x,
        screenY: e.point.y,
      });
    });

    map.on("click", (e) => {
      if (Date.now() < suppressClickUntil) return;
      const { x, y } = e.point;
      const bbox: [maplibregl.PointLike, maplibregl.PointLike] = [
        [x - 16, y - 16],
        [x + 16, y + 16]
      ];
      const features = map.queryRenderedFeatures(bbox);

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

      callbacksRef.current.onMapClick?.({
        lat: e.lngLat.lat,
        lng: e.lngLat.lng,
        screenX: x,
        screenY: y,
        features: targetedFeatures,
      });
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
      if (programmaticCameraMoveRef.current) return;
      callbacksRef.current.onMapInteraction?.(true);
    });

    map.on("moveend", () => {
      if (programmaticCameraMoveRef.current) {
        programmaticCameraMoveRef.current = false;
        return;
      }
      callbacksRef.current.onMapInteraction?.(false);
    });

    map.on("pitchend", () => {
      viewModeRef.current =
        map.getPitch() >= LIVE_MAP_3D_PITCH_THRESHOLD ? "3d" : "2d";
    });

    const emitBearing = () => {
      callbacksRef.current.onBearingChange?.(map.getBearing());
    };
    map.on("rotate", emitBearing);
    map.on("rotateend", emitBearing);
    emitBearing();

    const emitZoom = () => {
      callbacksRef.current.onZoomChange?.(map.getZoom());
    };
    map.on("zoom", emitZoom);
    map.on("zoomend", emitZoom);
    emitZoom();

    function ensureUserMarker(lat: number, lng: number, accuracy: number | null, timestamp: number | null) {
      if (userMarkerRef.current) {
        userMarkerRef.current.setLngLat([lng, lat]);
        applyUserMarkerContent(
          userMarkerRef.current.getElement(),
          isLiveActiveRef.current,
          navigationModeRef.current,
        );
        ensureMarkerOnMap(userMarkerRef.current, map);
      } else {
        userMarkerRef.current = new maplibregl.Marker({
          element: createUserMarkerElement(isLiveActiveRef.current, navigationModeRef.current),
          anchor: "center",
        })
          .setLngLat([lng, lat])
          .addTo(map);

        const popup = new maplibregl.Popup({
          closeButton: false,
          offset: 32,
          anchor: "bottom",
          className: "user-location-popup",
        });
        userMarkerRef.current.setPopup(popup);
      }

      const markerEl = userMarkerRef.current.getElement();
      markerEl.style.display = "";
      markerEl.style.zIndex = "6";

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
      errorMsg?: string,
    ) {
      logRovvyLiveDebug("[Rovvy Debug] applyUserLocation called", { lat, lng, centerMap, accuracyMeters, timestamp });
      if (isUnmountedRef.current) {
        logRovvyLiveDebug("[Rovvy Debug] applyUserLocation skipped because unmounted");
        return;
      }
      if (!liveGpsActiveRef.current && watchIdsRef.current.length > 0) {
        liveGpsActiveRef.current = true;
        callbacksRef.current.onLiveGpsChange?.(true);
      }
      userLocationRef.current = { lat, lng, accuracy: accuracyMeters || undefined, timestamp: timestamp || undefined };
      logRovvyLiveDebug("[Rovvy Debug] LiveMapComponent set userLocationRef:", userLocationRef.current);

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
        errorMessage: errorMsg,
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
        markProgrammaticCameraMove();
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
        const pin = mapPinRef.current;
        const followMode = mapFollowModeRef.current;
        const crossBorder = crossBorderAlertRef.current;
        if (pin && !centerMap && (followMode === "local-only" || crossBorder)) {
          const pinDistanceM = haversineM(lat, lng, pin.lat, pin.lng);
          if (pinDistanceM > LOCAL_LIVE_MAX_M) {
            hasCenteredOnUserRef.current = true;
            return;
          }
        }

        markProgrammaticCameraMove();
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
            logRovvyLiveWarn("[Rovvy GPS] error clearing watch id", { id, error: e });
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
      const errMsg = geolocationErrorMessage(err);
      logRovvyLiveDebug("[Rovvy Debug] geolocation failure", { code: err.code, message: errMsg, source });
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
          status: "denied",
          lat: null,
          lng: null,
          accuracyMeters: null,
          heading: null,
          speed: null,
          timestamp: null,
          source: null,
          errorMessage: errMsg,
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
            errorMessage: errMsg,
          });
          return;
        }
        liveGpsActiveRef.current = false;
        callbacksRef.current.onGpsStateChange?.({
          status: "timeout",
          lat: null,
          lng: null,
          accuracyMeters: null,
          heading: null,
          speed: null,
          timestamp: null,
          source: null,
          errorMessage: errMsg,
        });
        return;
      }

      stopLiveGps();
      callbacksRef.current.onGpsStateChange?.({
        status: "error",
        lat: null,
        lng: null,
        accuracyMeters: null,
        heading: null,
        speed: null,
        timestamp: null,
        source: null,
        errorMessage: errMsg,
      });
    }

    function startLiveGps() {
      const blocked = geolocationUnavailableMessage();
      if (blocked) {
        logRovvyGps("unavailable", { reason: blocked });
        callbacksRef.current.onGpsStateChange?.({
          status: "error",
          lat: null,
          lng: null,
          accuracyMeters: null,
          heading: null,
          speed: null,
          timestamp: null,
          source: null,
          errorMessage: blocked,
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
      logRovvyLiveDebug("[Rovvy Debug] geolocation requested via startLiveGps");

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude, accuracy, speed, heading } = pos.coords;
          applyUserLocation(latitude, longitude, true, speed, heading, accuracy, pos.timestamp);
        },
        (err) => handleGeolocationError(err, "getCurrentPosition"),
        { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 },
      );

      const wId = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude, accuracy, speed, heading } = pos.coords;
          applyUserLocation(latitude, longitude, false, speed, heading, accuracy, pos.timestamp);
        },
        (err) => handleGeolocationError(err, "watchPosition"),
        { enableHighAccuracy: true, timeout: 30000, maximumAge: 5000 },
      );
      watchIdsRef.current.push(wId);
    }

    mapRef.current = {
      zoomIn: () => {
        if (map.getZoom() < LIVE_MAP_MAX_ZOOM) map.zoomIn();
      },
      zoomOut: () => map.zoomOut(),
      getZoom: () => map.getZoom(),
      setZoom: (zoom: number) => {
        const next = Math.min(LIVE_MAP_MAX_ZOOM, Math.max(LIVE_MAP_MIN_ZOOM, zoom));
        map.easeTo({ zoom: next, duration: 180, essential: true });
      },
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
        markProgrammaticCameraMove();
        map.flyTo({ center: [lng, lat], zoom, essential: true });
      },
      searchMapLabels: (query, anchor, limit = 8) =>
        searchVisibleMapLabels(map, query, anchor, limit),
      supportsLabelSearch: () => mapSupportsLabelSearch(map),
      resetNorth: () => {
        map.easeTo({
          bearing: 0,
          pitch: map.getPitch(),
          duration: 500,
          essential: true,
        });
      },
      getBearing: () => map.getBearing(),
      getPitch: () => map.getPitch(),
      getViewMode: () =>
        map.getPitch() >= LIVE_MAP_3D_PITCH_THRESHOLD ? "3d" : "2d",
      setViewMode: (mode: LiveMapViewMode) => {
        viewModeRef.current = mode;
        map.easeTo({
          pitch: mode === "3d" ? LIVE_MAP_3D_PITCH : LIVE_MAP_2D_PITCH,
          duration: 500,
          essential: true,
        });
      },
      fitBounds: (bounds) => {
        navigationFollowUserRef.current = false;
        map.fitBounds(bounds, { padding: 80, duration: 800 });
      },
      locateUser: (forceFresh?: boolean) => {
        logRovvyLiveDebug("[Rovvy Debug] locateUser called", { forceFresh });
        const blocked = geolocationUnavailableMessage();
        if (blocked) {
          logRovvyGps("unavailable", { reason: blocked });
          callbacksRef.current.onGpsStateChange?.({
            status: "error",
            lat: null,
            lng: null,
            accuracyMeters: null,
            heading: null,
            speed: null,
            timestamp: null,
            source: null,
            errorMessage: blocked,
          });
          return;
        }

        if (forceFresh) {
          logRovvyGps("forcing fresh location request");
          logRovvyLiveDebug("[Rovvy Debug] geolocation requested via locateUser (forceFresh)");
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
            markProgrammaticCameraMove();
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
        logRovvyLiveWarn("[Rovvy GPS] error in stopLiveGps unmount", err);
      }
      try {
        userMarkerRef.current?.remove();
      } catch (err) {
        logRovvyLiveWarn("[Rovvy GPS] error userMarkerRef remove", err);
      }
      userMarkerRef.current = null;
      try {
        placeMarkerRef.current?.remove();
      } catch (err) {
        logRovvyLiveWarn("[Rovvy GPS] error placeMarkerRef remove", err);
      }
      placeMarkerRef.current = null;
      try {
        originMarkerRef.current?.remove();
      } catch (err) {
        logRovvyLiveWarn("[Rovvy GPS] error originMarkerRef remove", err);
      }
      originMarkerRef.current = null;
      try {
        startMarkerRef.current?.remove();
      } catch (err) {
        logRovvyLiveWarn("[Rovvy GPS] error startMarkerRef remove", err);
      }
      startMarkerRef.current = null;
      try {
        clickedPinMarkerRef.current?.remove();
      } catch (err) {
        logRovvyLiveWarn("[Rovvy GPS] error clickedPinMarkerRef remove", err);
      }
      clickedPinMarkerRef.current = null;
      try {
        nearbyMarkersRef.current.forEach((m) => m.remove());
      } catch (err) {
        logRovvyLiveWarn("[Rovvy GPS] error nearbyMarkers remove", err);
      }
      nearbyMarkersRef.current = [];
      try {
        borderCheckpointMarkersRef.current.forEach((marker) => marker.remove());
      } catch (err) {
        logRovvyLiveWarn("[Rovvy GPS] error borderCheckpointMarkers remove", err);
      }
      borderCheckpointMarkersRef.current = [];
      try {
        map.remove();
      } catch (err) {
        logRovvyLiveWarn("[Rovvy GPS] error map remove", err);
      }
      mapRef.current = null;
    };

  }, [mapRef]);

  useEffect(() => {
    if (!instanceRef.current) return;
    const map = instanceRef.current;

    if (skipInitialStyleSwitchRef.current) {
      skipInitialStyleSwitchRef.current = false;
      syncRouteLayer(map, routeLineRef.current, activeLayerRef.current);
      return;
    }

    const layerStyles = getLiveMapLibreLayerStyles();
    styleTransitionRef.current = true;
    map.setStyle(layerStyles[activeLayer] || layerStyles.street, { diff: false });
    map.once("style.load", () => {
      map.setMaxZoom(LIVE_MAP_MAX_ZOOM);
      map.setMinZoom(LIVE_MAP_MIN_ZOOM);
      map.setMaxPitch(LIVE_MAP_3D_PITCH);
      const targetPitch =
        viewModeRef.current === "3d" ? LIVE_MAP_3D_PITCH : LIVE_MAP_2D_PITCH;
      if (Math.abs(map.getPitch() - targetPitch) > 0.5) {
        map.setPitch(targetPitch);
      }
      map.once("idle", () => {
        styleTransitionRef.current = false;
        restoreOverlaysAfterStyleChange(map);
      });
    });
  }, [activeLayer, restoreOverlaysAfterStyleChange]);

  useEffect(() => {
    const map = instanceRef.current;
    if (!map) return;

    const applyRoute = () => {
      if (styleTransitionRef.current || !isMapStyleReady(map)) return;
      syncRouteLayerNow(map, routeLine, activeLayer);
    };
    if (isMapStyleReady(map) && !styleTransitionRef.current) applyRoute();
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
    const map = instanceRef.current;
    if (!map) return;

    borderCheckpointMarkersRef.current.forEach((marker) => marker.remove());
    borderCheckpointMarkersRef.current = [];

    const crossings =
      routeLine?.geometry && routeLine.geometry.length >= 2
        ? (routeLine.borderCrossings ?? [])
        : [];
    if (!crossings.length) return;

    borderCheckpointMarkersRef.current = crossings.map((crossing) =>
      new maplibregl.Marker({
        element: createBorderCheckpointMarkerElement(
          crossing.approximate ? "Immigration check likely here" : "Immigration check here",
        ),
        anchor: "bottom",
      })
        .setLngLat([crossing.lng, crossing.lat])
        .addTo(map),
    );
  }, [routeLine]);

  useEffect(() => {
    const marker = userMarkerRef.current;
    if (!marker) return;
    applyUserMarkerContent(marker.getElement(), isLiveActive, navigationMode);
    const map = instanceRef.current;
    if (map) ensureMarkerOnMap(marker, map);
  }, [isLiveActive, navigationMode]);

  useEffect(() => {
    const map = instanceRef.current;
    if (!map) return;

    if (!mapPin) {
      placeMarkerRef.current?.remove();
      placeMarkerRef.current = null;
      return;
    }

    const el = navigationMode
      ? createDestinationMarkerElement(navigationMode)
      : createExactSelectedPlaceMarkerElement(mapPin.lat, mapPin.lng);

    if (placeMarkerRef.current) {
      placeMarkerRef.current.remove();
      placeMarkerRef.current = null;
    }

    placeMarkerRef.current = new maplibregl.Marker({
      element: el,
      anchor: navigationMode ? "center" : "center",
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
    const map = instanceRef.current;
    if (!map) return;

    if (!mapClickPin) {
      if (clickedPinMarkerRef.current && !mapPin) {
        clickedPinMarkerRef.current.remove();
        clickedPinMarkerRef.current = null;
      }
      return;
    }

    if (mapPin) return;

    if (clickedPinMarkerRef.current) {
      clickedPinMarkerRef.current.setLngLat([mapClickPin.lng, mapClickPin.lat]);
    } else {
      clickedPinMarkerRef.current = new maplibregl.Marker({
        element: createClickedPinMarkerElement(),
        anchor: "bottom",
      })
        .setLngLat([mapClickPin.lng, mapClickPin.lat])
        .addTo(map);
    }
  }, [mapClickPin, mapPin]);

  useEffect(() => {
    const map = instanceRef.current;
    if (!map) return;

    if (!coordinateOverlay) {
      coordinateOverlayMarkerRef.current?.remove();
      coordinateOverlayMarkerRef.current = null;
      return;
    }

    const { lat, lng } = coordinateOverlay;
    if (coordinateOverlayMarkerRef.current) {
      coordinateOverlayMarkerRef.current.remove();
      coordinateOverlayMarkerRef.current = null;
    }
    coordinateOverlayMarkerRef.current = new maplibregl.Marker({
      element: createCoordinateOverlayElement(lat, lng),
      anchor: "bottom",
    })
      .setLngLat([lng, lat])
      .addTo(map);
  }, [coordinateOverlay]);

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
      : crossBorderAlert
        ? `cross:${mapPin.lat.toFixed(4)},${mapPin.lng.toFixed(4)}`
        : `pin:${mapPin.lat.toFixed(4)},${mapPin.lng.toFixed(4)}`;
    if (routeFitKeyRef.current === fitKey) return;
    routeFitKeyRef.current = fitKey;

    if (!routeLine && mapPin) {
      markProgrammaticCameraMove();
      map.flyTo({ center: [mapPin.lng, mapPin.lat], zoom: 14, essential: true });
      return;
    }

    if (routeLine) {
      const routeDistanceM = haversineM(
        routeLine.from.lat,
        routeLine.from.lng,
        routeLine.to.lat,
        routeLine.to.lng,
      );
      if (routeDistanceM > LOCAL_LIVE_MAX_M) {
        const userLoc = userLocationRef.current;
        if (userLoc) {
          const bounds = new maplibregl.LngLatBounds();
          bounds.extend([userLoc.lng, userLoc.lat]);
          bounds.extend([routeLine.to.lng, routeLine.to.lat]);
          markProgrammaticCameraMove();
          map.fitBounds(bounds, {
            padding: { top: 110, bottom: 170, left: 70, right: 340 },
            maxZoom: 7,
            essential: true,
          });
        }
        return;
      }

      const bounds = new maplibregl.LngLatBounds();
      bounds.extend([routeLine.from.lng, routeLine.from.lat]);
      bounds.extend([routeLine.to.lng, routeLine.to.lat]);
      markProgrammaticCameraMove();
      map.fitBounds(bounds, { padding: 80, maxZoom: 14, essential: true });
      return;
    }

    const userLoc = userLocationRef.current;
    const crossBorder = crossBorderAlertRef.current;
    const pinDistanceM =
      userLoc && mapPin
        ? haversineM(userLoc.lat, userLoc.lng, mapPin.lat, mapPin.lng)
        : null;

    if (
      userLoc &&
      mapPin &&
      pinDistanceM != null &&
      pinDistanceM > LOCAL_LIVE_MAX_M &&
      (followMode === "local-only" || crossBorder)
    ) {
      const bounds = new maplibregl.LngLatBounds();
      bounds.extend([userLoc.lng, userLoc.lat]);
      bounds.extend([mapPin.lng, mapPin.lat]);
      markProgrammaticCameraMove();
      map.fitBounds(bounds, {
        padding: { top: 110, bottom: 170, left: 70, right: 340 },
        maxZoom: crossBorder ? 6 : 8,
        essential: true,
      });
      return;
    }

    if (followMode === "local-only") {
      if (userLoc) {
        const distanceM = pinDistanceM ?? haversineM(userLoc.lat, userLoc.lng, mapPin.lat, mapPin.lng);
        if (distanceM > LOCAL_LIVE_MAX_M) return;
      }
    }

    markProgrammaticCameraMove();
    map.flyTo({ center: [mapPin.lng, mapPin.lat], zoom: 15, essential: true });
  }, [mapPin, routeLine, mapFollowMode, navigationMode, markProgrammaticCameraMove, crossBorderAlert]);

  return (
    <div className="relative w-full h-full rovvy-live-map-container">
      <div ref={mapContainer} className="w-full h-full" />
      {crossBorderAlert ? (
        <div className="pointer-events-none absolute left-1/2 top-3 z-[90] w-[min(92%,22rem)] -translate-x-1/2 rounded-xl border border-amber-300/80 bg-amber-50/95 px-3 py-2 text-center text-xs font-semibold leading-snug text-amber-900 shadow-[0_0_18px_rgba(245,158,11,0.35)] backdrop-blur-sm">
          Cross-border travel
          {crossBorderAlert.fromCountry && crossBorderAlert.toCountry
            ? ` (${crossBorderAlert.fromCountry} → ${crossBorderAlert.toCountry})`
            : ""}
          . Expect passport checks and immigration inspection at the border.
          {routeLine?.borderCrossings?.length
            ? " Immigration check is marked on your driving route."
            : routeLine
              ? " Calculating immigration checkpoint on your route…"
              : " Route preview will show the immigration checkpoint on the road."}
        </div>
      ) : null}
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
    logRovvyLiveDebug("[Rovvy Debug] accuracy circle cleared/removed");
    try {
      if (map.getLayer(fillLayerId)) map.removeLayer(fillLayerId);
      if (map.getLayer(strokeLayerId)) map.removeLayer(strokeLayerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    } catch (err) {
      logRovvyLiveWarn("[Rovvy Map] Error cleaning up accuracy layer", err);
    }
    return;
  }

  const circleFeature = createGeoJsonCircle([lng, lat], radius / 1000);
  logRovvyLiveDebug("[Rovvy Debug] accuracy circle created/updated at:", { lng, lat, radius });

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
    logRovvyLiveWarn("[Rovvy Map] Error syncing accuracy layer", err);
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