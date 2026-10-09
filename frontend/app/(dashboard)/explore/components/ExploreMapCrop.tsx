"use client";

import { useEffect, useRef, useState } from "react";

import {
  EXPLORE_MAP_CROP_ATTRIBUTION,
  getCachedExploreMapCropSnapshot,
  queueExploreMapCropSnapshot,
} from "../explore-map-crop-snapshot";
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

/** z17 map crop for feed cards — snapshot MapLibre + OpenFreeMap (not raster tile URLs). */
export function ExploreMapCrop({
  lat,
  lng,
  height,
  zoom = 17,
  className,
  lazy = true,
}: ExploreMapCropProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const mapHostRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(!lazy);
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(() =>
    getCachedExploreMapCropSnapshot(lat, lng, zoom),
  );

  useEffect(() => {
    if (!lazy) return;
    const host = wrapperRef.current;
    if (!host) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry?.isIntersecting ?? false);
      },
      { rootMargin: "120px", threshold: 0.01 },
    );
    observer.observe(host);
    return () => observer.disconnect();
  }, [lazy]);

  useEffect(() => {
    if (!visible || snapshotUrl) return;
    const container = mapHostRef.current;
    if (!container) return;

    let cancelled = false;
    let cancelQueueWait: (() => void) | undefined;
    const isCancelled = () => cancelled;

    void queueExploreMapCropSnapshot(
      container,
      { lat, lng, zoom, showMarker: false },
      isCancelled,
      (cancelWait) => {
        cancelQueueWait = cancelWait;
      },
    ).then((url) => {
      if (!cancelled && url) setSnapshotUrl(url);
    });

    return () => {
      cancelled = true;
      cancelQueueWait?.();
    };
  }, [visible, snapshotUrl, lat, lng, zoom]);

  const showLiveMapHost = visible && !snapshotUrl;

  return (
    <div
      ref={wrapperRef}
      className={className ?? styles.slotMapCropHost}
      style={height != null ? { height } : undefined}
      aria-hidden={lazy && !visible && !snapshotUrl}
    >
      {snapshotUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={snapshotUrl} alt="" className={styles.slotMapCropSnapshot} decoding="async" />
      ) : showLiveMapHost ? (
        <div ref={mapHostRef} className={styles.slotMapCropMapHost} />
      ) : null}
      {(snapshotUrl || showLiveMapHost) && (
        <>
          <span className={styles.slotMapCropPin} aria-hidden />
          <span className={styles.slotMapAttribution}>{EXPLORE_MAP_CROP_ATTRIBUTION}</span>
        </>
      )}
    </div>
  );
}
