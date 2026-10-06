"use client";

import { useEffect, useRef } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { OPENFREEMAP_PUBLIC_ORIGIN, resolveOpenFreeMapCleanStyleUrlForLiveMap } from "@/lib/map-providers";
import styles from "../explore.module.css";

type ExploreDrawerMapProps = {
  lat: number;
  lng: number;
  label: string;
};

/** Small static pin map for the listing drawer (same OpenFreeMap style as Live). */
export function ExploreDrawerMap({ lat, lng, label }: ExploreDrawerMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let map: import("maplibre-gl").Map | null = null;
    let cancelled = false;

    void import("maplibre-gl").then(({ default: maplibregl }) => {
      if (cancelled) return;
      map = new maplibregl.Map({
        container,
        style: resolveOpenFreeMapCleanStyleUrlForLiveMap(),
        center: [lng, lat],
        zoom: 15,
        interactive: false,
        attributionControl: { compact: true },
      });
      new maplibregl.Marker({ color: "#0f6b5c" }).setLngLat([lng, lat]).addTo(map);
      // Self-hosted tiles may be unreachable (e.g. tiles.rovvy.app not provisioned): fall back once.
      let usedFallback = false;
      map.on("error", () => {
        if (usedFallback || !map) return;
        usedFallback = true;
        map.setStyle(`${OPENFREEMAP_PUBLIC_ORIGIN}/styles/liberty`);
      });
    });

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [lat, lng]);

  return <div ref={containerRef} className={styles.drawerMapLive} role="img" aria-label={`Map of ${label}`} />;
}
