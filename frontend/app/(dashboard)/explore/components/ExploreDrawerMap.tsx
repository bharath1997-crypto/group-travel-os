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
  const mountGenerationRef = useRef(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const generation = mountGenerationRef.current + 1;
    mountGenerationRef.current = generation;
    const isActive = () => mountGenerationRef.current === generation;

    let teardown: (() => void) | null = null;

    void mountExploreStaticMap(container, { lat, lng, zoom }, isActive).then((remove) => {
      if (!isActive()) {
        remove();
        return;
      }
      teardown = remove;
    });

    return () => {
      mountGenerationRef.current += 1;
      teardown?.();
      teardown = null;
      if (container.isConnected) {
        container.replaceChildren();
      }
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
