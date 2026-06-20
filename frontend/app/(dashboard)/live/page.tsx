"use client";

import { GuestPrompt } from "@/components/live/GuestPrompt";
import { PoiDetailSheet, type PoiPlace } from "@/components/live/PoiDetailSheet";
import { PoiSearchSheet, type PoiCategory } from "@/components/live/PoiSearchSheet";
import { ReportSheet } from "@/components/live/ReportSheet";
import { ReportTypeSheet } from "@/components/live/ReportTypeSheet";
import { WayraChatSheet } from "@/components/live/WayraChatSheet";
import { apiFetch, apiFetchPublic } from "@/lib/api";
import {
  REPORT_CONFIG,
  createReportPinElement,
  formatDistance,
  haversineMeters,
  minutesAgo,
  type LiveWeather,
  type ReportType,
  type RoadReport,
  type TrafficDensityPoint,
} from "@/lib/live/types";
import {
  AlertCircle,
  ChevronLeft,
  Loader2,
  MessageCircle,
  Search,
} from "lucide-react";
import maplibregl, { type StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useRouter, useSearchParams } from "next/navigation";
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

const WAYRA_GUEST_LIMIT = 3;
const HAZARD_RADIUS_M = 500;
const HAZARD_BANNER_MS = 10_000;
const TRAFFIC_FETCH_MS = 60_000;
const WEATHER_FETCH_MS = 600_000;

const TRAFFIC_RADIUS_M: Record<TrafficDensityPoint["level"], number> = {
  low: 300,
  medium: 500,
  high: 800,
};

type OverpassElement = {
  id: number;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
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

type HazardBanner = {
  report: RoadReport;
  distanceM: number;
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

function closestHazard(
  reports: RoadReport[],
  lat: number,
  lng: number,
): HazardBanner | null {
  let closest: HazardBanner | null = null;
  for (const report of reports) {
    const distanceM = haversineMeters(lat, lng, report.lat, report.lng);
    if (distanceM > HAZARD_RADIUS_M) continue;
    if (!closest || distanceM < closest.distanceM) {
      closest = { report, distanceM };
    }
  }
  return closest;
}

function weatherBadgeLabel(weather: LiveWeather | null): string | null {
  if (!weather) return null;
  if (weather.windspeed_10m > 50) return "💨 Strong wind";
  const code = weather.weathercode;
  if (code === 0) return null;
  if (code >= 1 && code <= 3) return "Partly cloudy";
  if (code === 45 || code === 48) return "⚠️ Foggy";
  if (code >= 51 && code <= 67) return "🌧️ Rain";
  if (code >= 71 && code <= 77) return "❄️ Snow";
  if (code >= 80 && code <= 82) return "🌧️ Showers";
  if (code >= 95 && code <= 99) return "⛈️ Storm";
  return null;
}

function trafficGeoJson(
  points: TrafficDensityPoint[],
): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: points.map((point) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [point.lng, point.lat],
      },
      properties: {
        level: point.level,
        count: point.count,
        radiusM: TRAFFIC_RADIUS_M[point.level],
      },
    })),
  };
}

function ensureTrafficLayer(
  map: maplibregl.Map,
  data: GeoJSON.FeatureCollection,
) {
  const existing = map.getSource("traffic-density") as maplibregl.GeoJSONSource | undefined;
  if (existing) {
    existing.setData(data);
    return;
  }

  map.addSource("traffic-density", {
    type: "geojson",
    data,
  });

  map.addLayer({
    id: "traffic-circles",
    type: "circle",
    source: "traffic-density",
    paint: {
      "circle-color": [
        "match",
        ["get", "level"],
        "low",
        "rgba(234,179,8,0.25)",
        "medium",
        "rgba(249,115,22,0.35)",
        "high",
        "rgba(239,68,68,0.45)",
        "rgba(234,179,8,0.25)",
      ],
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["zoom"],
        10,
        ["*", ["get", "radiusM"], 0.008],
        13,
        ["*", ["get", "radiusM"], 0.04],
        16,
        ["*", ["get", "radiusM"], 0.25],
      ],
    },
  });
}

export default function LivePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tripId = searchParams.get("trip_id") || null;
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const markerRef = useRef<LiveUserMarker | null>(null);
  const reportMarkersRef = useRef<maplibregl.Marker[]>([]);
  const poiMarkersRef = useRef<maplibregl.Marker[]>([]);
  const previousSampleRef = useRef<PositionSample | null>(null);
  const bearingRef = useRef<number | null>(null);
  const gpsStateRef = useRef<GpsPermissionState>("pending");
  const hasCenteredRef = useRef(false);
  const sessionStartedRef = useRef(false);
  const sessionIdRef = useRef<string | null>(null);
  const trafficDataRef = useRef<TrafficDensityPoint[]>([]);
  const isDarkRef = useRef<boolean | null>(null);
  const sunCoordsRef = useRef({ lat: 41.8781, lng: -87.6298 });
  const userPositionRef = useRef<{ lat: number; lng: number } | null>(null);
  const reportsRef = useRef<RoadReport[]>([]);
  const hazardTimerRef = useRef<number | null>(null);
  const openReportRef = useRef<(report: RoadReport) => void>(() => {});

  const [isGuest, setIsGuest] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [gpsState, setGpsState] = useState<GpsPermissionState>("pending");
  const [speedMph, setSpeedMph] = useState(0);
  const [reports, setReports] = useState<RoadReport[]>([]);
  const [weather, setWeather] = useState<LiveWeather | null>(null);
  const [selectedReport, setSelectedReport] = useState<RoadReport | null>(null);
  const [selectedPoi, setSelectedPoi] = useState<PoiPlace | null>(null);
  const [showReportTypes, setShowReportTypes] = useState(false);
  const [showWayra, setShowWayra] = useState(false);
  const [showPoiSearch, setShowPoiSearch] = useState(false);
  const [poiLoading, setPoiLoading] = useState(false);
  const [guestPrompt, setGuestPrompt] = useState<string | null>(null);
  const [reportBusy, setReportBusy] = useState(false);
  const [submittingReport, setSubmittingReport] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [hazardBanner, setHazardBanner] = useState<HazardBanner | null>(null);
  const [guestWayraRemaining, setGuestWayraRemaining] = useState(WAYRA_GUEST_LIMIT);

  openReportRef.current = (report: RoadReport) => setSelectedReport(report);

  useEffect(() => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("gt_token") : null;
    setIsGuest(!token);
  }, []);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    reportsRef.current = reports;
  }, [reports]);

  const showToastMessage = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchNearbyReports = useCallback(async (lat: number, lng: number) => {
    try {
      const params = new URLSearchParams({
        lat: lat.toString(),
        lng: lng.toString(),
        radius_km: "5",
      });
      const data = await apiFetchPublic<RoadReport[]>(
        `/live/reports/nearby?${params}`,
      );
      setReports(data);
    } catch {
      // Map works without pins; avoid noisy console errors on transient network/API issues.
    }
  }, []);

  const fetchTrafficDensity = useCallback(async (lat: number, lng: number) => {
    const map = mapRef.current;
    if (!map) return;
    try {
      const params = new URLSearchParams({
        lat: lat.toString(),
        lng: lng.toString(),
        radius_km: "10",
      });
      const data = await apiFetchPublic<TrafficDensityPoint[]>(
        `/live/traffic/density?${params}`,
      );
      trafficDataRef.current = data;
      ensureTrafficLayer(map, trafficGeoJson(data));
    } catch {
      // Traffic overlay is optional.
    }
  }, []);

  const fetchWeather = useCallback(async (lat: number, lng: number) => {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=precipitation,weathercode,windspeed_10m&timezone=auto`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data = (await res.json()) as {
        current?: LiveWeather;
      };
      if (data.current) setWeather(data.current);
    } catch {
      // Weather badge is optional.
    }
  }, []);

  const startLiveSession = useCallback(async () => {
    if (sessionStartedRef.current) return;
    const token =
      typeof window !== "undefined" ? localStorage.getItem("gt_token") : null;
    if (!token) return;

    sessionStartedRef.current = true;
    try {
      const validTripId =
        tripId &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          tripId,
        )
          ? tripId
          : null;
      const session = await apiFetch<{ id: string }>("/live/session/start", {
        method: "POST",
        body: JSON.stringify({
          mode: validTripId ? "group" : "solo",
          trip_id: validTripId,
        }),
      });
      setSessionId(session.id);
      sessionIdRef.current = session.id;
    } catch {
      sessionStartedRef.current = false;
    }
  }, [tripId]);

  const clearPoiMarkers = useCallback(() => {
    poiMarkersRef.current.forEach((marker) => marker.remove());
    poiMarkersRef.current = [];
  }, []);

  const syncPoiMarkers = useCallback(
    (map: maplibregl.Map, places: PoiPlace[]) => {
      clearPoiMarkers();
      for (const place of places) {
        const element = document.createElement("button");
        element.type = "button";
        element.className =
          "flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-xs font-bold text-white shadow-lg";
        element.style.backgroundColor = place.color;
        element.textContent = place.categoryLabel.slice(0, 1);
        element.addEventListener("click", (event) => {
          event.stopPropagation();
          setSelectedPoi(place);
        });
        const marker = new maplibregl.Marker({ element, anchor: "center" })
          .setLngLat([place.lng, place.lat])
          .addTo(map);
        poiMarkersRef.current.push(marker);
      }
    },
    [clearPoiMarkers],
  );

  const fetchPois = useCallback(
    async (lat: number, lng: number, category: PoiCategory) => {
      const map = mapRef.current;
      if (!map) return;

      setPoiLoading(true);
      try {
        const radius = 2000;
        const query = `[out:json][timeout:10];node[${category.query}](around:${radius},${lat},${lng});out 10;`;
        const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Overpass request failed");
        const data = (await res.json()) as { elements?: OverpassElement[] };
        const places: PoiPlace[] = (data.elements ?? [])
          .filter(
            (element) =>
              typeof element.lat === "number" &&
              typeof element.lon === "number",
          )
          .slice(0, 10)
          .map((element) => ({
            id: element.id,
            lat: element.lat!,
            lng: element.lon!,
            name:
              element.tags?.name ||
              element.tags?.brand ||
              `${category.label} location`,
            address:
              element.tags?.["addr:street"] ||
              element.tags?.["addr:full"] ||
              element.tags?.["addr:city"] ||
              "",
            categoryLabel: category.label,
            color: category.color,
          }));

        syncPoiMarkers(map, places);
        setShowPoiSearch(false);
        if (places.length === 0) {
          showToastMessage(`No ${category.label.toLowerCase()} found nearby.`);
        }
      } catch {
        showToastMessage("POI search failed. Try again.");
      } finally {
        setPoiLoading(false);
      }
    },
    [showToastMessage, syncPoiMarkers],
  );

  const syncReportMarkers = useCallback((map: maplibregl.Map, items: RoadReport[]) => {
    reportMarkersRef.current.forEach((marker) => marker.remove());
    reportMarkersRef.current = [];

    for (const report of items) {
      const element = createReportPinElement(report.report_type, () => {
        openReportRef.current(report);
      });
      const marker = new maplibregl.Marker({ element, anchor: "center" })
        .setLngLat([report.lng, report.lat])
        .addTo(map);
      reportMarkersRef.current.push(marker);
    }
  }, []);

  const updateHazardBanner = useCallback((lat: number, lng: number, items: RoadReport[]) => {
    const hazard = closestHazard(items, lat, lng);
    if (!hazard) {
      setHazardBanner(null);
      return;
    }
    setHazardBanner(hazard);
    if (hazardTimerRef.current != null) {
      window.clearTimeout(hazardTimerRef.current);
    }
    hazardTimerRef.current = window.setTimeout(() => {
      setHazardBanner(null);
      hazardTimerRef.current = null;
    }, HAZARD_BANNER_MS);
  }, []);

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
      if (hazardTimerRef.current != null) {
        window.clearTimeout(hazardTimerRef.current);
      }
      const id = sessionIdRef.current;
      const token =
        typeof window !== "undefined" ? localStorage.getItem("gt_token") : null;
      if (id && token) {
        void apiFetch(`/live/session/${id}/end`, { method: "POST" });
      }
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
      syncReportMarkers(map, reportsRef.current);
      ensureTrafficLayer(map, trafficGeoJson(trafficDataRef.current));
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
      reportMarkersRef.current.forEach((marker) => marker.remove());
      reportMarkersRef.current = [];
      clearPoiMarkers();
      markerRef.current?.marker.remove();
      markerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [applyMapStyle, clearPoiMarkers, syncMarker, syncReportMarkers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    syncReportMarkers(map, reports);
  }, [reports, syncReportMarkers]);

  useEffect(() => {
    const pos = userPositionRef.current;
    if (!pos) return;
    updateHazardBanner(pos.lat, pos.lng, reports);
  }, [reports, updateHazardBanner]);

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
        userPositionRef.current = { lat, lng };

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
        void fetchNearbyReports(lat, lng);
        void fetchTrafficDensity(lat, lng);

        if (!hasCenteredRef.current) {
          map.jumpTo({ center: [lng, lat], zoom: 15 });
          hasCenteredRef.current = true;
          void fetchWeather(lat, lng);
          void startLiveSession();

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
  }, [applyMapStyle, fetchNearbyReports, fetchTrafficDensity, fetchWeather, startLiveSession, syncMarker]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const pos = userPositionRef.current;
      if (!pos) return;
      void fetchNearbyReports(pos.lat, pos.lng);
    }, 30_000);
    return () => window.clearInterval(interval);
  }, [fetchNearbyReports]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const pos = userPositionRef.current;
      if (!pos) return;
      void fetchTrafficDensity(pos.lat, pos.lng);
    }, TRAFFIC_FETCH_MS);
    return () => window.clearInterval(interval);
  }, [fetchTrafficDensity]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const pos = userPositionRef.current;
      if (!pos) return;
      void fetchWeather(pos.lat, pos.lng);
    }, WEATHER_FETCH_MS);
    return () => window.clearInterval(interval);
  }, [fetchWeather]);

  const handleReportButton = () => {
    if (isGuest) {
      setGuestPrompt("Sign in to report road hazards");
      return;
    }
    setShowReportTypes(true);
  };

  const handleSubmitReport = async (reportType: ReportType) => {
    const pos = userPositionRef.current;
    if (!pos) {
      showToastMessage("Waiting for GPS position…");
      return;
    }

    setSubmittingReport(true);
    try {
      await apiFetch("/live/reports", {
        method: "POST",
        body: JSON.stringify({
          report_type: reportType,
          lat: pos.lat,
          lng: pos.lng,
          city: null,
          description: null,
        }),
      });
      setShowReportTypes(false);
      showToastMessage("Report submitted. Thanks!");
      await fetchNearbyReports(pos.lat, pos.lng);
    } catch {
      showToastMessage("Failed to submit. Try again.");
    } finally {
      setSubmittingReport(false);
    }
  };

  const handleConfirmReport = async (action: "confirm" | "dismiss") => {
    if (!selectedReport) return;
    setReportBusy(true);
    try {
      const updated = await apiFetch<RoadReport>(
        `/live/reports/${selectedReport.id}/confirm`,
        {
          method: "POST",
          body: JSON.stringify({ action }),
        },
      );
      setSelectedReport(updated);
      setReports((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item)),
      );
      showToastMessage(
        action === "confirm" ? "Thanks for confirming." : "Report dismissed.",
      );
    } catch {
      showToastMessage("Could not update report. Try again.");
    } finally {
      setReportBusy(false);
    }
  };

  const weatherLabel = weatherBadgeLabel(weather);
  const hazardConfig = hazardBanner
    ? REPORT_CONFIG[hazardBanner.report.report_type]
    : null;

  return (
    <div className="fixed inset-0 z-[100] h-[100dvh] w-full overflow-hidden bg-stone-900">
      <div ref={mapContainerRef} className="absolute inset-0 h-full w-full" />

      <div className="pointer-events-none absolute inset-0 z-10">
        <div className="pointer-events-none absolute left-3 right-3 top-[max(0.75rem,env(safe-area-inset-top))] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-[rgba(15,23,42,0.82)] px-3 py-2 text-sm font-semibold text-white shadow-lg backdrop-blur-sm transition hover:bg-[rgba(15,23,42,0.92)]"
            aria-label="Go back"
          >
            <ChevronLeft size={18} strokeWidth={2.5} className="text-white" />
            <span className="text-[#5EEAD4]">LIVE</span>
          </button>

          <button
            type="button"
            onClick={() => setShowPoiSearch(true)}
            className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(15,23,42,0.82)] text-white shadow-lg backdrop-blur-sm transition hover:bg-[rgba(15,23,42,0.92)]"
            aria-label="Search nearby places"
          >
            <Search size={18} />
          </button>
        </div>

        {weatherLabel ? (
          <div className="pointer-events-none absolute right-3 top-[calc(max(0.75rem,env(safe-area-inset-top))+3.5rem)]">
            <div className="rounded-full bg-[rgba(15,23,42,0.82)] px-3 py-1.5 text-xs font-semibold text-white shadow-lg backdrop-blur-sm">
              {weatherLabel}
            </div>
          </div>
        ) : null}

        {hazardBanner && hazardConfig ? (
          <div className="pointer-events-none absolute left-3 right-3 top-[calc(max(0.75rem,env(safe-area-inset-top))+3.5rem)]">
            <div className="rounded-xl bg-gradient-to-r from-orange-600 to-red-600 px-4 py-3 text-white shadow-lg">
              <p className="text-sm font-semibold">
                {hazardConfig.emoji} {hazardConfig.label} ·{" "}
                {formatDistance(hazardBanner.distanceM)} ·{" "}
                {minutesAgo(hazardBanner.report.created_at) === 0
                  ? "just now"
                  : `${minutesAgo(hazardBanner.report.created_at)} min ago`}
              </p>
            </div>
          </div>
        ) : null}

        <button
          type="button"
          onClick={handleReportButton}
          className="pointer-events-auto absolute bottom-36 left-4 z-20 flex items-center gap-2 rounded-full bg-[#0F766E] px-4 py-2 shadow-lg transition hover:bg-[#0d655c]"
        >
          <AlertCircle className="h-4 w-4 text-white" aria-hidden />
          <span className="text-sm font-medium text-white">Report</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (isGuest && guestWayraRemaining <= 0) {
              setGuestPrompt("Create free account for unlimited Wayra access");
              return;
            }
            setShowWayra(true);
          }}
          className="pointer-events-auto absolute bottom-24 right-4 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-[#0F766E] text-white shadow-lg transition hover:bg-[#0d655c]"
          aria-label="Open Wayra chat"
        >
          <MessageCircle size={22} />
        </button>

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

      {toast ? (
        <div className="pointer-events-none absolute left-1/2 top-[max(5rem,env(safe-area-inset-top))] z-[140] -translate-x-1/2 rounded-full bg-stone-900/90 px-4 py-2 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      ) : null}

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

      {selectedReport ? (
        <ReportSheet
          report={selectedReport}
          isGuest={isGuest}
          busy={reportBusy}
          onClose={() => setSelectedReport(null)}
          onConfirm={() => void handleConfirmReport("confirm")}
          onDismiss={() => void handleConfirmReport("dismiss")}
          onChat={() => showToastMessage("Route chat coming soon")}
          onGuestAction={setGuestPrompt}
        />
      ) : null}

      {showReportTypes ? (
        <ReportTypeSheet
          submitting={submittingReport}
          onClose={() => setShowReportTypes(false)}
          onSelect={(type) => void handleSubmitReport(type)}
        />
      ) : null}

      {showWayra ? (
        <WayraChatSheet
          isGuest={isGuest}
          guestRemaining={guestWayraRemaining}
          guestLimit={WAYRA_GUEST_LIMIT}
          onGuestRemainingChange={setGuestWayraRemaining}
          onGuestLimit={() => {
            setShowWayra(false);
            setGuestPrompt("Create free account for unlimited Wayra access");
          }}
          onClose={() => setShowWayra(false)}
        />
      ) : null}

      {showPoiSearch ? (
        <PoiSearchSheet
          loading={poiLoading}
          onClose={() => {
            setShowPoiSearch(false);
            clearPoiMarkers();
            setSelectedPoi(null);
          }}
          onSelect={(category) => {
            const pos = userPositionRef.current;
            if (!pos) {
              showToastMessage("Waiting for GPS position…");
              return;
            }
            void fetchPois(pos.lat, pos.lng, category);
          }}
        />
      ) : null}

      {selectedPoi ? (
        <PoiDetailSheet
          place={selectedPoi}
          onClose={() => setSelectedPoi(null)}
          onNavigate={() => showToastMessage("Navigation coming soon")}
        />
      ) : null}

      {guestPrompt ? (
        <GuestPrompt
          message={guestPrompt}
          onDismiss={() => setGuestPrompt(null)}
        />
      ) : null}
    </div>
  );
}
