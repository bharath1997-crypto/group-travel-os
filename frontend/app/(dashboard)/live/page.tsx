"use client";

import { ChevronLeft, Loader2 } from "lucide-react";
import maplibregl, { type StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const OSM_STYLE_LIGHT: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

const OSM_STYLE_DARK: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [
    {
      id: "osm",
      type: "raster",
      source: "osm",
      paint: {
        "raster-brightness-min": 0,
        "raster-brightness-max": 0.3,
        "raster-saturation": -1,
        "raster-contrast": 0.2,
      },
    },
  ],
};

type GpsPermissionState = "pending" | "granted" | "denied";

type PositionSample = {
  lat: number;
  lng: number;
  ts: number;
};

type LiveUserMarker = {
  marker: maplibregl.Marker;
  setBearing: (bearing: number | null) => void;
};

function getSunTimes(lat: number, lng: number): { sunrise: number; sunset: number } {
  const now = new Date();
  const dayOfYear = Math.floor(
    (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000,
  );
  const solarDeclination =
    -23.45 * Math.cos((360 / 365) * (dayOfYear + 10) * (Math.PI / 180));
  const hourAngle =
    (Math.acos(
      -Math.tan((lat * Math.PI) / 180) * Math.tan((solarDeclination * Math.PI) / 180),
    ) *
      180) /
    Math.PI;
  const sunriseHour = 12 - hourAngle / 15 - lng / 15;
  const sunsetHour = 12 + hourAngle / 15 - lng / 15;
  return { sunrise: sunriseHour, sunset: sunsetHour };
}

function currentHourDecimal(): number {
  const now = new Date();
  return now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
}

function isNightMode(lat: number, lng: number): boolean {
  const { sunrise, sunset } = getSunTimes(lat, lng);
  const hour = currentHourDecimal();
  return hour < sunrise || hour > sunset;
}

function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const radiusM = 6371000;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const dPhi = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLng / 2) ** 2;
  return radiusM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}

function calcSpeedMph(
  previous: PositionSample | null,
  lat: number,
  lng: number,
  ts: number,
  nativeSpeed: number | null,
): number {
  if (nativeSpeed != null && !Number.isNaN(nativeSpeed) && nativeSpeed >= 0) {
    return Math.max(0, Math.round(nativeSpeed * 2.237));
  }
  if (!previous || ts <= previous.ts) return 0;
  const distanceM = haversineMeters(previous.lat, previous.lng, lat, lng);
  const elapsedSec = (ts - previous.ts) / 1000;
  if (elapsedSec <= 0) return 0;
  const mph = (distanceM / elapsedSec) * 2.237;
  return Math.max(0, Math.round(mph));
}

function createLiveUserMarker(): {
  element: HTMLDivElement;
  setBearing: (bearing: number | null) => void;
} {
  const root = document.createElement("div");
  root.className = "live-user-marker";

  const cone = document.createElement("div");
  cone.className = "live-user-cone is-hidden";

  const pulse = document.createElement("div");
  pulse.className = "live-user-pulse";

  const dot = document.createElement("div");
  dot.className = "live-user-dot";

  root.appendChild(cone);
  root.appendChild(pulse);
  root.appendChild(dot);

  const setBearing = (bearing: number | null) => {
    if (bearing == null || Number.isNaN(bearing)) {
      cone.classList.add("is-hidden");
      return;
    }
    cone.classList.remove("is-hidden");
    cone.style.transform = `translateX(-50%) rotate(${bearing}deg)`;
  };

  return { element: root, setBearing };
}

export default function LivePage() {
  const router = useRouter();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const markerRef = useRef<LiveUserMarker | null>(null);
  const previousSampleRef = useRef<PositionSample | null>(null);
  const bearingRef = useRef<number | null>(null);
  const gpsStateRef = useRef<GpsPermissionState>("pending");
  const hasCenteredRef = useRef(false);
  const isDarkRef = useRef<boolean | null>(null);
  const sunCoordsRef = useRef({ lat: 41.8781, lng: -87.6298 });

  const [gpsState, setGpsState] = useState<GpsPermissionState>("pending");
  const [speedMph, setSpeedMph] = useState(0);

  const applyMapStyle = useCallback((map: maplibregl.Map, dark: boolean) => {
    map.setStyle(dark ? OSM_STYLE_DARK : OSM_STYLE_LIGHT);
    isDarkRef.current = dark;
  }, []);

  const syncMarker = useCallback(
    (
      map: maplibregl.Map,
      lat: number,
      lng: number,
      bearing: number | null,
      showMarker: boolean,
    ) => {
      if (!showMarker) {
        markerRef.current?.marker.remove();
        markerRef.current = null;
        return;
      }

      if (!markerRef.current) {
        const { element, setBearing } = createLiveUserMarker();
        const marker = new maplibregl.Marker({ element, anchor: "center" })
          .setLngLat([lng, lat])
          .addTo(map);
        setBearing(bearing);
        markerRef.current = { marker, setBearing };
        return;
      }

      markerRef.current.marker.setLngLat([lng, lat]);
      markerRef.current.setBearing(bearing);
    },
    [],
  );

  useEffect(() => {
    document.body.classList.add("live-mode");
    return () => {
      document.body.classList.remove("live-mode");
    };
  }, []);

  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    const initialDark = isNightMode(
      sunCoordsRef.current.lat,
      sunCoordsRef.current.lng,
    );
    isDarkRef.current = initialDark;

    const map = new maplibregl.Map({
      container,
      style: initialDark ? OSM_STYLE_DARK : OSM_STYLE_LIGHT,
      center: [sunCoordsRef.current.lng, sunCoordsRef.current.lat],
      zoom: 14,
      attributionControl: false,
    });

    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-right",
    );

    mapRef.current = map;

    map.on("style.load", () => {
      const pos = previousSampleRef.current;
      if (!pos || gpsStateRef.current !== "granted") return;
      markerRef.current = null;
      syncMarker(map, pos.lat, pos.lng, bearingRef.current, true);
    });

    const resizeObserver = new ResizeObserver(() => {
      map.resize();
    });
    resizeObserver.observe(container);

    const styleCheck = window.setInterval(() => {
      const activeMap = mapRef.current;
      if (!activeMap) return;
      const dark = isNightMode(sunCoordsRef.current.lat, sunCoordsRef.current.lng);
      if (isDarkRef.current === dark) return;
      applyMapStyle(activeMap, dark);
    }, 60_000);

    return () => {
      window.clearInterval(styleCheck);
      resizeObserver.disconnect();
      markerRef.current?.marker.remove();
      markerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [applyMapStyle, syncMarker]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsState("denied");
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const map = mapRef.current;
        if (!map) return;

        setGpsState("granted");
        gpsStateRef.current = "granted";

        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const ts = position.timestamp;
        const bearing =
          position.coords.heading != null && !Number.isNaN(position.coords.heading)
            ? position.coords.heading
            : null;
        bearingRef.current = bearing;

        sunCoordsRef.current = { lat, lng };

        const mph = calcSpeedMph(
          previousSampleRef.current,
          lat,
          lng,
          ts,
          position.coords.speed,
        );
        previousSampleRef.current = { lat, lng, ts };
        setSpeedMph(mph);

        syncMarker(map, lat, lng, bearing, true);

        if (!hasCenteredRef.current) {
          map.jumpTo({ center: [lng, lat], zoom: 15 });
          hasCenteredRef.current = true;

          const dark = isNightMode(lat, lng);
          if (isDarkRef.current !== dark) {
            applyMapStyle(map, dark);
          }
        }
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          gpsStateRef.current = "denied";
          setGpsState("denied");
          markerRef.current?.marker.remove();
          markerRef.current = null;
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 20_000,
      },
    );

    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [applyMapStyle, syncMarker]);

  return (
    <div className="fixed inset-0 z-[100] h-[100dvh] w-full overflow-hidden bg-stone-900">
      <div ref={mapContainerRef} className="absolute inset-0 h-full w-full" />

      <div className="pointer-events-none absolute inset-0 z-10">
        <div className="pointer-events-auto absolute left-3 top-[max(0.75rem,env(safe-area-inset-top))]">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex items-center gap-1.5 rounded-full bg-[rgba(15,23,42,0.82)] px-3 py-2 text-sm font-semibold text-white shadow-lg backdrop-blur-sm transition hover:bg-[rgba(15,23,42,0.92)]"
            aria-label="Go back"
          >
            <ChevronLeft size={18} strokeWidth={2.5} className="text-white" />
            <span className="text-[#5EEAD4]">LIVE</span>
          </button>
        </div>

        {gpsState === "granted" ? (
          <div className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-3">
            <div className="rounded-2xl bg-white px-4 py-3 shadow-lg ring-1 ring-stone-200/80">
              <p className="text-3xl font-bold leading-none tabular-nums text-stone-900">
                {speedMph}
              </p>
              <p className="mt-1 text-xs font-medium uppercase tracking-wide text-stone-500">
                mph
              </p>
            </div>
          </div>
        ) : null}

        {gpsState === "denied" ? (
          <div className="pointer-events-none absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-3 right-3 flex justify-center">
            <div className="rounded-xl bg-white/95 px-4 py-3 text-center text-sm font-medium text-stone-700 shadow-lg ring-1 ring-stone-200">
              Enable location to see your position
            </div>
          </div>
        ) : null}
      </div>

      {gpsState === "pending" ? (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-stone-900/25">
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-white/95 px-6 py-5 shadow-xl">
            <Loader2
              size={28}
              className="animate-spin text-[#0F766E]"
              aria-hidden
            />
            <p className="text-sm font-medium text-stone-600">
              Getting your location…
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
