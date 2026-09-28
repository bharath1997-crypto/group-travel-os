"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { LocateFixed, MapPin, X } from "lucide-react";
import { patchMapLibreTileAbortRace } from "@/app/(dashboard)/live/live-maplibre-tile-abort-fix";
import { liveGeocodingReverse } from "@/app/(dashboard)/live/live-geocoding";
import type { LiveGeocodingReverseResult } from "@/app/(dashboard)/live/live-geocoding";
import { geolocationUnavailableMessage } from "@/lib/geo";
import { attachSeatShareMapTileFallback, seatShareMapOptions } from "./seats-map-init";
import { fitMapToLngLats } from "./seats-map-bounds";
import {
  geodesicCircleBounds,
  isWithinSeatShareRadius,
  straightLineMiles,
} from "./seats-map-geo";
import {
  createSeatShareActiveMarkerElement,
  createSeatShareLiveGpsMarkerElement,
  createSeatShareReferenceMarkerElement,
  isEndpointVisibleOnMap,
} from "./seats-map-markers";
import { syncSeatShareRadiusOverlay } from "./seats-map-live-sync";
import {
  formatSeatShareReverseAddress,
  locationPointFromReverse,
  type LocationPoint,
  type LocationSource,
} from "./seats-location";
import { SEATSHARE_MAX_DISTANCE_MILES } from "./seats-route";
import styles from "./seats.module.css";

type MapPickSource = Extract<LocationSource, "map_pin" | "gps_confirmed">;
type PickTarget = "from" | "to";

type Props = {
  open: boolean;
  title: string;
  pickTarget: PickTarget;
  initial?: LocationPoint | null;
  /** The other trip endpoint (From when picking To, and vice versa). */
  otherEndpoint?: LocationPoint | null;
  radiusAnchor?: LocationPoint | null;
  gpsSeed?: { lat: number; lng: number } | null;
  confirmSource?: MapPickSource;
  confirmLabel?: string;
  onClose: () => void;
  onConfirm: (place: LocationPoint) => void;
};

type LiveGps = { lat: number; lng: number; accuracyM: number | null };

export function SeatsMapPickModal({
  open,
  title,
  pickTarget,
  initial,
  otherEndpoint,
  radiusAnchor,
  gpsSeed,
  confirmSource = "map_pin",
  confirmLabel = "Use this location",
  onClose,
  onConfirm,
}: Props) {
  const shellRef = useRef<HTMLDivElement>(null);
  const mapElRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const activeMarkerRef = useRef<maplibregl.Marker | null>(null);
  const gpsMarkerRef = useRef<maplibregl.Marker | null>(null);
  const otherMarkerRef = useRef<maplibregl.Marker | null>(null);
  const lastRevRef = useRef<LiveGeocodingReverseResult | null>(null);
  const liveGpsRef = useRef<LiveGps | null>(null);
  const userMovedPinRef = useRef(false);
  const gpsPinSyncedRef = useRef(false);
  const pinRef = useRef<{ lat: number; lng: number } | null>(null);
  const otherEndpointRef = useRef(otherEndpoint);
  const pickTargetRef = useRef(pickTarget);
  const radiusAnchorRef = useRef(radiusAnchor);
  const setPinAtRef = useRef<
    (lat: number, lng: number, opts?: { skipReverse?: boolean; userMoved?: boolean }) => void
  >(() => undefined);

  const [mapSession, setMapSession] = useState(0);
  const [ready, setReady] = useState(false);
  const [label, setLabel] = useState("");
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [liveGps, setLiveGps] = useState<LiveGps | null>(null);
  const [gpsStatus, setGpsStatus] = useState<string | null>(null);
  const [outOfRadius, setOutOfRadius] = useState(false);
  const [distanceMi, setDistanceMi] = useState<number | null>(null);

  const otherRole: "from" | "to" = pickTarget === "from" ? "to" : "from";
  const showOther = isEndpointVisibleOnMap(otherEndpoint);

  const resolveRadiusCenter = useCallback((): { lat: number; lng: number } | null => {
    if (pickTarget === "to" && radiusAnchor?.isConfirmed) {
      return { lat: radiusAnchor.lat, lng: radiusAnchor.lng };
    }
    return liveGpsRef.current;
  }, [pickTarget, radiusAnchor]);

  const applyRadiusCheck = useCallback(
    (lat: number, lng: number) => {
      const center = resolveRadiusCenter();
      if (!center || pickTarget !== "to") {
        setOutOfRadius(false);
        setDistanceMi(null);
        return;
      }
      const miles = straightLineMiles(center, { lat, lng });
      setDistanceMi(miles);
      setOutOfRadius(!isWithinSeatShareRadius(center, { lat, lng }));
    },
    [pickTarget, resolveRadiusCenter],
  );

  pickTargetRef.current = pickTarget;
  otherEndpointRef.current = otherEndpoint;
  radiusAnchorRef.current = radiusAnchor;

  const setPinAt = useCallback(
    async (lat: number, lng: number, opts?: { skipReverse?: boolean; userMoved?: boolean }) => {
      if (opts?.userMoved) userMovedPinRef.current = true;
      const nextPin = { lat, lng };
      pinRef.current = nextPin;
      setPin(nextPin);
      activeMarkerRef.current?.setLngLat([lng, lat]);
      applyRadiusCheck(lat, lng);
      const map = mapRef.current;
      if (map && opts?.userMoved) {
        map.flyTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 13), duration: 450 });
      }
      if (opts?.skipReverse) return;
      setBusy(true);
      try {
        const rev = await liveGeocodingReverse(lat, lng);
        lastRevRef.current = rev;
        setLabel(formatSeatShareReverseAddress(rev, lat, lng));
      } catch {
        lastRevRef.current = null;
        setLabel(formatSeatShareReverseAddress(null, lat, lng));
      } finally {
        setBusy(false);
      }
    },
    [applyRadiusCheck],
  );

  setPinAtRef.current = setPinAt;

  const fitMapToContextStable = useCallback(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const other = otherEndpointRef.current;
    const showOtherPin = isEndpointVisibleOnMap(other);
    const points: Array<{ lng: number; lat: number }> = [];
    const activePin = pinRef.current;
    if (activePin) points.push({ lng: activePin.lng, lat: activePin.lat });
    if (showOtherPin && other) {
      points.push({ lng: other.lng, lat: other.lat });
    }
    if (liveGpsRef.current) {
      points.push({ lng: liveGpsRef.current.lng, lat: liveGpsRef.current.lat });
    }
    if (points.length >= 2) {
      fitMapToLngLats(map, points, 64, 12);
      return;
    }

    const target = pickTargetRef.current;
    const anchor = radiusAnchorRef.current;
    const center =
      target === "to" && anchor?.isConfirmed
        ? { lat: anchor.lat, lng: anchor.lng }
        : liveGpsRef.current;

    if (center) {
      syncSeatShareRadiusOverlay(map, center);
      try {
        map.fitBounds(geodesicCircleBounds(center, SEATSHARE_MAX_DISTANCE_MILES), {
          padding: 48,
          duration: 0,
          maxZoom: 10,
        });
      } catch {
        map.setCenter([center.lng, center.lat]);
        map.setZoom(12);
      }
    }
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setReady(false);
      return;
    }
    setMapSession((n) => n + 1);
    userMovedPinRef.current = false;
    gpsPinSyncedRef.current = false;
    pinRef.current = null;
    setGpsStatus(null);
    setOutOfRadius(false);
    setDistanceMi(null);
    const el = mapElRef.current;
    const shell = shellRef.current;
    if (!el) return;
    const check = () => {
      if (el.clientWidth > 0 && el.clientHeight > 0) setReady(true);
    };
    check();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(check) : null;
    ro?.observe(el);
    if (shell) ro?.observe(shell);
    window.addEventListener("resize", check);
    const raf = window.requestAnimationFrame(check);
    const timer = window.setTimeout(check, 120);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", check);
      window.cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      setReady(false);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const unavailable = geolocationUnavailableMessage();
    if (unavailable) {
      setGpsStatus(unavailable);
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const next: LiveGps = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracyM: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null,
        };
        liveGpsRef.current = next;
        setLiveGps(next);
        setGpsStatus(null);
        gpsMarkerRef.current?.setLngLat([next.lng, next.lat]);

        const map = mapRef.current;
        const center = resolveRadiusCenter() ?? next;
        if (map?.isStyleLoaded()) {
          syncSeatShareRadiusOverlay(map, center);
        }

        if (
          !userMovedPinRef.current &&
          !gpsPinSyncedRef.current &&
          (pickTargetRef.current === "from" || gpsSeed)
        ) {
          gpsPinSyncedRef.current = true;
          void setPinAtRef.current(next.lat, next.lng);
        }
      },
      (err) => {
        setGpsStatus(
          err.code === 1
            ? "Allow location to see your live position on the map."
            : "Live GPS unavailable — tap the map to pick a spot.",
        );
      },
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 20_000 },
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
      liveGpsRef.current = null;
      setLiveGps(null);
    };
  }, [open, gpsSeed]);

  useEffect(() => {
    if (!open || !ready || !mapElRef.current) return;

    const seed = gpsSeed ?? liveGpsRef.current;
    const startLat = seed?.lat ?? initial?.lat ?? 39.8283;
    const startLng = seed?.lng ?? initial?.lng ?? -98.5795;
    const startZoom = seed || gpsSeed || initial?.isConfirmed ? 14 : 5;

    const map = new maplibregl.Map(
      seatShareMapOptions({
        container: mapElRef.current,
        center: [startLng, startLat],
        zoom: startZoom,
      }),
    );
    patchMapLibreTileAbortRace(map);
    attachSeatShareMapTileFallback(map);
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    mapRef.current = map;

    const activeMarker = new maplibregl.Marker({
      element: createSeatShareActiveMarkerElement(pickTargetRef.current),
      draggable: true,
      anchor: "bottom",
    })
      .setLngLat([startLng, startLat])
      .addTo(map);
    activeMarker.on("dragend", () => {
      const lngLat = activeMarker.getLngLat();
      void setPinAtRef.current(lngLat.lat, lngLat.lng, { userMoved: true });
    });
    activeMarkerRef.current = activeMarker;

    const gpsMarker = new maplibregl.Marker({
      element: createSeatShareLiveGpsMarkerElement(),
      anchor: "center",
    })
      .setLngLat([startLng, startLat])
      .addTo(map);
    gpsMarkerRef.current = gpsMarker;

    const onClick = (e: maplibregl.MapMouseEvent) => {
      void setPinAtRef.current(e.lngLat.lat, e.lngLat.lng, { userMoved: true });
    };
    map.on("click", onClick);

    const onMapReady = () => {
      map.resize();
      void setPinAtRef.current(startLat, startLng);
      window.setTimeout(() => fitMapToContextStable(), 120);
    };

    map.once("load", onMapReady);

    const resize = () => map.resize();
    map.once("idle", resize);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    ro?.observe(mapElRef.current);
    const resizeTimer = window.setTimeout(resize, 150);

    return () => {
      window.clearTimeout(resizeTimer);
      ro?.disconnect();
      map.off("click", onClick);
      otherMarkerRef.current?.remove();
      otherMarkerRef.current = null;
      gpsMarker.remove();
      activeMarker.remove();
      map.remove();
      mapRef.current = null;
      activeMarkerRef.current = null;
      gpsMarkerRef.current = null;
      lastRevRef.current = null;
    };
    // One MapLibre instance per modal open — do not add pin/GPS callbacks to deps (causes blink).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ready, mapSession]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !open) return;
    const center = resolveRadiusCenter();
    if (!map.isStyleLoaded()) {
      map.once("load", () => syncSeatShareRadiusOverlay(map, center));
      return;
    }
    syncSeatShareRadiusOverlay(map, center);
  }, [open, liveGps, radiusAnchor, pickTarget, resolveRadiusCenter]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !open) return;

    otherMarkerRef.current?.remove();
    otherMarkerRef.current = null;

    if (showOther && otherEndpoint) {
      const marker = new maplibregl.Marker({
        element: createSeatShareReferenceMarkerElement(
          otherRole,
          otherEndpoint.address || "Saved stop",
        ),
        anchor: "bottom",
      })
        .setLngLat([otherEndpoint.lng, otherEndpoint.lat])
        .addTo(map);
      otherMarkerRef.current = marker;
    }

    const t = window.setTimeout(() => fitMapToContextStable(), 50);
    return () => window.clearTimeout(t);
  }, [open, showOther, otherEndpoint, otherRole, fitMapToContextStable]);

  const confirmDisabled = !pin || busy || outOfRadius;

  function centerOnLiveGps() {
    const g = liveGpsRef.current;
    const map = mapRef.current;
    if (!g || !map) {
      setGpsStatus("Waiting for GPS… allow location or try again.");
      return;
    }
    gpsMarkerRef.current?.setLngLat([g.lng, g.lat]);
    map.flyTo({ center: [g.lng, g.lat], zoom: 15, duration: 500 });
    if (pickTarget === "from" || !userMovedPinRef.current) {
      userMovedPinRef.current = false;
      void setPinAt(g.lat, g.lng);
    }
  }

  function jumpToOtherEndpoint() {
    if (!showOther || !otherEndpoint) return;
    const map = mapRef.current;
    if (!map) return;
    map.flyTo({ center: [otherEndpoint.lng, otherEndpoint.lat], zoom: 14, duration: 500 });
  }

  const hint =
    pickTarget === "from"
      ? "Blue dot = live GPS · Teal pin = pickup · Orange = your To stop (if set)."
      : showOther
        ? `Teal pin = destination · Orange = From · Stay within ${SEATSHARE_MAX_DISTANCE_MILES} mi.`
        : `Blue dot = live GPS · Pick within the ${SEATSHARE_MAX_DISTANCE_MILES}-mile circle.`;

  if (!open) return null;

  return (
    <div className={styles.mapModalOverlay} role="dialog" aria-modal="true" aria-label={title}>
      <div className={styles.mapModal} ref={shellRef}>
        <div className={styles.mapModalHead}>
          <h2>{title}</h2>
          <button type="button" className={styles.mapModalClose} onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <p className={styles.mapModalHint}>{hint}</p>
        <div className={styles.mapModalBody}>
          <div ref={mapElRef} className={styles.mapCanvas} />
          <div className={styles.mapFloatingActions}>
            <button
              type="button"
              className={`${styles.mapLocateMe} ${liveGps ? styles.mapLocateMeActive : ""}`}
              onClick={centerOnLiveGps}
              title="Center on my live location"
            >
              <LocateFixed size={18} strokeWidth={2.2} />
              <span>Live GPS</span>
            </button>
            {showOther && otherEndpoint ? (
              <button
                type="button"
                className={styles.mapJumpOther}
                onClick={jumpToOtherEndpoint}
                title={`Show ${otherRole} on map`}
              >
                <MapPin size={16} />
                <span>{otherRole === "from" ? "View From" : "View To"}</span>
              </button>
            ) : null}
          </div>
        </div>
        {gpsStatus ? <p className={styles.mapGpsWarn}>{gpsStatus}</p> : null}
        {outOfRadius ? (
          <p className={styles.routeWarnBanner} role="alert">
            That spot is {distanceMi?.toFixed(0)} mi away — SeatShare trips must stay within{" "}
            {SEATSHARE_MAX_DISTANCE_MILES} miles.
          </p>
        ) : null}
        <div className={styles.mapModalFoot}>
          <div className={styles.mapModalAddress}>
            <span className={`${styles.mapModalAddressLabel} ${styles.mono}`}>
              {pickTarget === "from" ? "Pickup" : "Drop-off"}
            </span>
            <p className={styles.mono}>
              {busy
                ? "Loading place…"
                : label || "Tap the map or use Live GPS to place the pin"}
              {distanceMi != null && pickTarget === "to" && !outOfRadius
                ? ` · ${distanceMi.toFixed(1)} mi from start`
                : ""}
            </p>
          </div>
          <button
            type="button"
            className={styles.mapConfirmBtn}
            disabled={confirmDisabled}
            title={outOfRadius ? `Within ${SEATSHARE_MAX_DISTANCE_MILES} miles only` : undefined}
            onClick={() => {
              if (!pin) return;
              const source: MapPickSource =
                pickTarget === "from" && liveGps && !userMovedPinRef.current
                  ? "gps_confirmed"
                  : confirmSource;
              onConfirm(locationPointFromReverse(lastRevRef.current, pin.lat, pin.lng, source));
              onClose();
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
