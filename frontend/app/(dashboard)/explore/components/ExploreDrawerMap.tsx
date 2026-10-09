"use client";

import { useEffect, useRef } from "react";

import { mountExploreStaticMap } from "../explore-static-map";
import styles from "../explore.module.css";

type ExploreDrawerMapProps = {
  lat: number;
  lng: number;
  label: string;
  zoom?: number;
  className?: string;
};

/** Small static pin map for the listing drawer (same OpenFreeMap style as Live). */
export function ExploreDrawerMap({ lat, lng, label, zoom = 15, className }: ExploreDrawerMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    let teardown: (() => void) | null = null;

    void mountExploreStaticMap(container, { lat, lng, zoom }).then((remove) => {
      if (cancelled) {
        remove();
        return;
      }
      teardown = remove;
    });

    return () => {
      cancelled = true;
      teardown?.();
    };
  }, [lat, lng, zoom]);

  return (
    <div
      ref={containerRef}
      className={className ?? styles.drawerMapLive}
      role="img"
      aria-label={`Map of ${label}`}
    />
  );
}
