"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";
import { patchMapLibreTileAbortRace } from "@/app/(dashboard)/live/live-maplibre-tile-abort-fix";
import { mountSeatShareMap } from "./seats-map-init";
import { fitMapToRoute, syncSeatShareRouteLayers } from "./seats-route-map-sync";
import { SeatsRouteOptionCards } from "./SeatsRouteOptionCards";
import { findRouteOption, SEATSHARE_MAX_DISTANCE_MILES, type RouteOption } from "./seats-route";
import type { LocationPoint } from "./seats-location";
import { areSeatShareEndpointsReady } from "./seats-location";
import styles from "./seats.module.css";
import type maplibregl from "maplibre-gl";

type Props = {
  from: LocationPoint;
  to: LocationPoint;
  options: RouteOption[];
  loading: boolean;
  error: string | null;
  selectedRouteId: string | null;
  onSelectRouteId: (id: string) => void;
};

export function SeatsRoutePanel({
  from,
  to,
  options,
  loading,
  error,
  selectedRouteId,
  onSelectRouteId,
}: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const optionsRef = useRef(options);
  const selectedRouteIdRef = useRef(selectedRouteId);
  const onSelectRef = useRef(onSelectRouteId);

  optionsRef.current = options;
  selectedRouteIdRef.current = selectedRouteId;
  onSelectRef.current = onSelectRouteId;

  const endpointsReady = areSeatShareEndpointsReady(from, to);
  const selected = findRouteOption(options, selectedRouteId);

  useEffect(() => {
    if (!endpointsReady || !mapContainerRef.current) return;

    const centerLng = (from.lng + to.lng) / 2;
    const centerLat = (from.lat + to.lat) / 2;
    const mount = mountSeatShareMap(mapContainerRef.current, [centerLng, centerLat], 8);
    patchMapLibreTileAbortRace(mount.map);
    mapRef.current = mount.map;

    return () => {
      mount.destroy();
      mapRef.current = null;
    };
  }, [endpointsReady, from.lat, from.lng, to.lat, to.lng]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !endpointsReady) return;

    let layerCleanup: (() => void) | undefined;
    let cancelled = false;

    const applyRoutes = () => {
      if (cancelled || !mapRef.current) return;
      layerCleanup?.();
      layerCleanup = syncSeatShareRouteLayers(
        map,
        optionsRef.current,
        selectedRouteIdRef.current,
        (id) => onSelectRef.current(id),
      );

      const selectedOpt = findRouteOption(optionsRef.current, selectedRouteIdRef.current);
      if (selectedOpt?.geometry.length) {
        fitMapToRoute(map, selectedOpt.geometry);
      } else {
        map.fitBounds(
          [
            [Math.min(from.lng, to.lng), Math.min(from.lat, to.lat)],
            [Math.max(from.lng, to.lng), Math.max(from.lat, to.lat)],
          ],
          { padding: 48, duration: 0 },
        );
      }
      map.resize();
    };

    if (map.isStyleLoaded()) {
      applyRoutes();
    } else {
      map.once("load", applyRoutes);
    }
    map.on("style.load", applyRoutes);

    return () => {
      cancelled = true;
      map.off("style.load", applyRoutes);
      layerCleanup?.();
    };
  }, [
    endpointsReady,
    options,
    selectedRouteId,
    from.lat,
    from.lng,
    to.lat,
    to.lng,
  ]);

  if (!endpointsReady) return null;

  return (
    <section className={styles.routeSection} aria-label="Drive route options">
      {loading ? (
        <p className={`${styles.routeStatus} ${styles.mono}`}>Calculating drivable routes…</p>
      ) : null}
      {error && options.length === 0 && !loading ? (
        <p className={styles.routeError} role="alert">
          {error}
        </p>
      ) : null}

      {selected && !selected.isEligible ? (
        <div className={styles.routeWarnBanner} role="alert">
          SeatShare supports road trips up to {SEATSHARE_MAX_DISTANCE_MILES} miles.
        </div>
      ) : null}

      <div className={styles.routeLayout}>
        <div ref={mapContainerRef} className={styles.routeMap} aria-hidden={options.length === 0} />
        <SeatsRouteOptionCards
          options={options}
          selectedRouteId={selectedRouteId}
          onSelectRouteId={onSelectRouteId}
        />
      </div>
      <p className={styles.routeFootnote}>Car, SUV, or van only — no bikes, transit, or walking.</p>
    </section>
  );
}
