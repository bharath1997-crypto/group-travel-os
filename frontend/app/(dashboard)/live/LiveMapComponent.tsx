"use client";

import React, { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

type Props = {
  activeLayer: "street" | "satellite" | "dark";
  mapRef: React.MutableRefObject<any>;
};

const LAYER_STYLES: Record<string, any> = {
  street: {
    version: 8,
    sources: {
      osm: {
        type: "raster",
        tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
        attribution: "© OpenStreetMap contributors",
      },
    },
    layers: [{ id: "osm-tiles", type: "raster", source: "osm", minzoom: 0, maxzoom: 19 }],
  },
  satellite: {
    version: 8,
    sources: {
      esri: {
        type: "raster",
        tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
        tileSize: 256,
        attribution: "© Esri",
      },
    },
    layers: [{ id: "esri-tiles", type: "raster", source: "esri", minzoom: 0, maxzoom: 19 }],
  },
  dark: {
    version: 8,
    sources: {
      carto: {
        type: "raster",
        tiles: ["https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png"],
        tileSize: 256,
        attribution: "© CARTO",
      },
    },
    layers: [{ id: "carto-tiles", type: "raster", source: "carto", minzoom: 0, maxzoom: 19 }],
  },
};

export default function LiveMapComponent({ activeLayer, mapRef }: Props) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<maplibregl.Map | null>(null);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);

  useEffect(() => {
    if (!mapContainer.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: LAYER_STYLES[activeLayer] || LAYER_STYLES.street,
      center: [-73.9855, 40.7484], // Default NYC / Empire State Building center
      zoom: 13,
      attributionControl: false,
    });

    instanceRef.current = map;

    // Custom CSS style pulse element for current location marker
    const el = document.createElement("div");
    el.className = "gt-user-location-marker";
    el.innerHTML = `
      <div style="position: relative; width: 24px; height: 24px; pointer-events: none;">
        <div style="position: absolute; inset: -4px; border-radius: 50%; background: rgba(59, 130, 246, 0.4); animation: pulse 2s infinite;"></div>
        <div style="position: absolute; inset: 3px; border-radius: 50%; background: #2563EB; border: 2px solid #FFFFFF; box-shadow: 0 2px 6px rgba(0,0,0,0.4);"></div>
      </div>
    `;

    const marker = new maplibregl.Marker({ element: el })
      .setLngLat([-73.9855, 40.7484])
      .addTo(map);
    userMarkerRef.current = marker;

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { longitude, latitude } = pos.coords;
          map.flyTo({ center: [longitude, latitude], zoom: 14 });
          marker.setLngLat([longitude, latitude]);
        },
        () => {}
      );
    }

    // Assign helper callbacks to external ref
    mapRef.current = {
      zoomIn: () => map.zoomIn(),
      zoomOut: () => map.zoomOut(),
      locateUser: () => {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const { longitude, latitude } = pos.coords;
              map.flyTo({ center: [longitude, latitude], zoom: 15 });
              marker.setLngLat([longitude, latitude]);
            },
            () => {}
          );
        }
      },
    };

    return () => {
      map.remove();
    };
  }, []);

  // Update map layer style when activeLayer changes
  useEffect(() => {
    if (!instanceRef.current) return;
    const style = LAYER_STYLES[activeLayer] || LAYER_STYLES.street;
    instanceRef.current.setStyle(style);
  }, [activeLayer]);

  return <div ref={mapContainer} className="w-full h-full" />;
}
