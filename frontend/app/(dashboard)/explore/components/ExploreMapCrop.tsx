"use client";

import { useEffect, useRef, useState } from "react";

import { mountExploreStaticMap } from "../explore-static-map";
import styles from "../explore.module.css";

type ExploreMapCropProps = {
  lat: number;
  lng: number;
  /** Card media height in px */
  height?: number;
  zoom?: number;
  className?: string;
  lazy?: boolean;
};

/** z17 map crop for feed cards — MapLibre + OpenFreeMap (not raster tile URLs). */
export function ExploreMapCrop({
  lat,
  lng,
  height,
  zoom = 17,
  className,
  lazy = true,
}: ExploreMapCropProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [shouldMount, setShouldMount] = useState(!lazy);

  useEffect(() => {
    if (!lazy) return;
    const host = hostRef.current;
    if (!host) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setShouldMount(true);
      },
      { rootMargin: "120px", threshold: 0.01 },
    );
    observer.observe(host);
    return () => observer.disconnect();
  }, [lazy]);

  useEffect(() => {
    if (!shouldMount) return;
    const container = hostRef.current;
    if (!container) return;
    let cancelled = false;
    let teardown: (() => void) | null = null;

    void mountExploreStaticMap(container, { lat, lng, zoom, showMarker: true }).then((remove) => {
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
  }, [shouldMount, lat, lng, zoom]);

  return (
    <div
      ref={hostRef}
      className={className ?? styles.slotMapCropHost}
      style={height != null ? { height } : undefined}
      aria-hidden={lazy && !shouldMount}
    />
  );
}
