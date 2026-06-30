"use client";

import React, { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  geolocationErrorMessage,
  geolocationUnavailableMessage,
} from "@/lib/geo";
import {
  getLiveMapLibreLayerStyles,
  warnIfUnsafeProductionTiles,
} from "@/lib/map-providers";
import type { RouteLine, UserLocationUpdate } from "./live-types";

export type UserLocation = { lat: number; lng: number };

export type LiveMapRef = {
  zoomIn: () => void;
  zoomOut: () => void;
  locateUser: () => void;
  getUserLocation: () => UserLocation | null;
  isLiveGpsActive: () => boolean;
};

type Props = {
  activeLayer: "street" | "satellite" | "dark";
  mapRef: React.MutableRefObject<LiveMapRef | null>;
  mapPin?: { lat: number; lng: number } | null;
  routeLine?: RouteLine | null;
  isLiveActive?: boolean;
  navigationMode?: boolean;
  onUserLocationChange?: (update: UserLocationUpdate) => void;
  onLiveGpsChange?: (active: boolean) => void;
  onGpsError?: (message: string) => void;
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
  onUserLocationChange,
  onLiveGpsChange,
  onGpsError,
}: Props) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<maplibregl.Map | null>(null);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const placeMarkerRef = useRef<maplibregl.Marker | null>(null);
  const userLocationRef = useRef<UserLocation | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const liveGpsActiveRef = useRef(false);
  const hasCenteredOnUserRef = useRef(false);

  const callbacksRef = useRef({ onUserLocationChange, onLiveGpsChange, onGpsError });
  callbacksRef.current = { onUserLocationChange, onLiveGpsChange, onGpsError };
  const isLiveActiveRef = useRef(isLiveActive);
  isLiveActiveRef.current = isLiveActive;
  const navigationModeRef = useRef(navigationMode);
  navigationModeRef.current = navigationMode;

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
      attributionControl: false,
    });

    instanceRef.current = map;

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
      zoomIn: () => map.zoomIn(),
      zoomOut: () => map.zoomOut(),
      getUserLocation: () => userLocationRef.current,
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
    instanceRef.current.setStyle(layerStyles[activeLayer] || layerStyles.street);
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

  const routeFitKeyRef = useRef("");

  useEffect(() => {
    if (navigationMode) return;
    const map = instanceRef.current;
    if (!map || !mapPin) return;

    const fitKey = routeLine
      ? `route:${mapPin.lat.toFixed(4)},${mapPin.lng.toFixed(4)}`
      : `pin:${mapPin.lat.toFixed(4)},${mapPin.lng.toFixed(4)}`;
    if (routeFitKeyRef.current === fitKey) return;
    routeFitKeyRef.current = fitKey;

    if (routeLine) {
      const bounds = new maplibregl.LngLatBounds();
      bounds.extend([routeLine.from.lng, routeLine.from.lat]);
      bounds.extend([routeLine.to.lng, routeLine.to.lat]);
      map.fitBounds(bounds, { padding: 80, maxZoom: 14, essential: true });
      return;
    }

    map.flyTo({ center: [mapPin.lng, mapPin.lat], zoom: 15, essential: true });
  }, [mapPin, routeLine]);

  return <div ref={mapContainer} className="w-full h-full" />;
}
