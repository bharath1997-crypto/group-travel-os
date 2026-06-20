"use client";

import { ConvoySheet } from "@/components/live/ConvoySheet";
import { DestinationSheet } from "@/components/live/DestinationSheet";
import { EmergencyContactsSheet } from "@/components/live/EmergencyContactsSheet";
import { GeofenceSetupSheet } from "@/components/live/GeofenceSetupSheet";
import { GroupLiveChatButton, GroupLiveChatSheet } from "@/components/live/GroupLiveChatSheet";
import { GroupPanel, GroupPanelToggle } from "@/components/live/GroupPanel";
import { GuestPrompt } from "@/components/live/GuestPrompt";
import { NavigationSheet } from "@/components/live/NavigationSheet";
import { PoiDetailSheet, type PoiPlace } from "@/components/live/PoiDetailSheet";
import { PoiSearchSheet, type PoiCategory } from "@/components/live/PoiSearchSheet";
import { ReportSheet } from "@/components/live/ReportSheet";
import { ReportTypeSheet } from "@/components/live/ReportTypeSheet";
import { SOSConfirmSheet } from "@/components/live/SOSConfirmSheet";
import { WayraChatSheet } from "@/components/live/WayraChatSheet";
import { apiFetch, apiFetchPublic } from "@/lib/api";
import { useDashboardUser } from "@/contexts/dashboard-user-context";
import { initFirebase } from "@/lib/firebase-client";
import {
  firstName,
  geofenceCircleGeoJson,
  memberStatusValue,
  type ConvoyData,
  type EmergencyContact,
  type GeofenceData,
  type GroupValidateResponse,
  type MeetingPoint,
  type MemberLiveData,
  type QuickStatus,
  type SOSResponse,
  type TripMember,
} from "@/lib/live/group";
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
  distanceToRouteLine,
  routeBounds,
  type Destination,
  type RouteData,
} from "@/lib/live/navigation";
import {
  AlertCircle,
  ChevronLeft,
  Loader2,
  MessageCircle,
  Search,
  MapPin,
} from "lucide-react";
import maplibregl, { type StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { off, onValue, ref, remove, set, type Database } from "firebase/database";
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
const ROUTE_REFETCH_MS = 30_000;
const STEP_ADVANCE_M = 30;
const ARRIVAL_M = 50;
const DEVIATION_M = 100;
const HAZARD_ON_ROUTE_M = 200;
const HAZARD_ON_ROUTE_BANNER_MS = 15_000;
const ARRIVAL_BANNER_MS = 5_000;

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

const MEETING_ARRIVAL_M = 50;

type MemberMarkerEntry = {
  marker: maplibregl.Marker;
  setBearing: (bearing: number | null) => void;
  setOpacity: (opacity: number) => void;
  setLowBattery: (show: boolean) => void;
};

type SafetyBanner = {
  message: string;
  tone: "amber" | "red";
};

type HazardBanner = {
  report: RoadReport;
  distanceM: number;
};

function createMemberMarker(color: string, label: string): {
  element: HTMLDivElement;
  setBearing: (bearing: number | null) => void;
  setOpacity: (opacity: number) => void;
  setLowBattery: (show: boolean) => void;
} {
  const root = document.createElement("div");
  root.className = "live-member-marker";

  const cone = document.createElement("div");
  cone.className = "live-member-cone is-hidden";

  const dot = document.createElement("div");
  dot.className = "live-member-dot";
  dot.style.backgroundColor = color;

  const battery = document.createElement("div");
  battery.className = "live-member-battery is-hidden";
  battery.textContent = "🔋";

  const name = document.createElement("div");
  name.className = "live-member-label";
  name.textContent = label;

  root.appendChild(cone);
  root.appendChild(dot);
  root.appendChild(battery);
  root.appendChild(name);

  const setBearing = (bearing: number | null) => {
    if (bearing == null || Number.isNaN(bearing)) {
      cone.classList.add("is-hidden");
      return;
    }
    cone.classList.remove("is-hidden");
    cone.style.transform = `translateX(-50%) rotate(${bearing}deg)`;
  };

  const setOpacity = (opacity: number) => {
    root.style.opacity = String(opacity);
  };

  const setLowBattery = (show: boolean) => {
    battery.classList.toggle("is-hidden", !show);
  };

  return { element: root, setBearing, setOpacity, setLowBattery };
}

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

function ensureRouteLayer(map: maplibregl.Map, geometry: GeoJSON.LineString) {
  const data: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: [{ type: "Feature", geometry, properties: {} }],
  };
  const existing = map.getSource("route-line") as maplibregl.GeoJSONSource | undefined;
  if (existing) {
    existing.setData(data);
    return;
  }
  map.addSource("route-line", { type: "geojson", data });
  map.addLayer({
    id: "route-layer",
    type: "line",
    source: "route-line",
    paint: {
      "line-color": "#0F766E",
      "line-width": 5,
      "line-opacity": 0.85,
    },
    layout: {
      "line-cap": "round",
      "line-join": "round",
    },
  });
}

function clearRouteLayer(map: maplibregl.Map) {
  if (map.getLayer("route-layer")) map.removeLayer("route-layer");
  if (map.getSource("route-line")) map.removeSource("route-line");
}

function ensureGeofenceLayer(map: maplibregl.Map, data: GeoJSON.FeatureCollection) {
  const existing = map.getSource("geofence-area") as maplibregl.GeoJSONSource | undefined;
  if (existing) {
    existing.setData(data);
    return;
  }

  map.addSource("geofence-area", { type: "geojson", data });
  map.addLayer({
    id: "geofence-fill",
    type: "fill",
    source: "geofence-area",
    paint: {
      "fill-color": "#14b8a6",
      "fill-opacity": 0.1,
    },
  });
  map.addLayer({
    id: "geofence-border",
    type: "line",
    source: "geofence-area",
    paint: {
      "line-color": "#14b8a6",
      "line-width": 2,
    },
  });
}

function clearGeofenceLayer(map: maplibregl.Map) {
  if (map.getLayer("geofence-border")) map.removeLayer("geofence-border");
  if (map.getLayer("geofence-fill")) map.removeLayer("geofence-fill");
  if (map.getSource("geofence-area")) map.removeSource("geofence-area");
}

export default function LivePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user: dashboardUser } = useDashboardUser();
  const tripId = searchParams.get("trip_id") || null;
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const markerRef = useRef<LiveUserMarker | null>(null);
  const reportMarkersRef = useRef<maplibregl.Marker[]>([]);
  const poiMarkersRef = useRef<maplibregl.Marker[]>([]);
  const destinationMarkerRef = useRef<maplibregl.Marker | null>(null);
  const destinationRef = useRef<Destination | null>(null);
  const routeRef = useRef<RouteData | null>(null);
  const navigationActiveRef = useRef(false);
  const activeStepIndexRef = useRef(0);
  const recalculatingRef = useRef(false);
  const routeHazardTimerRef = useRef<number | null>(null);
  const arrivalTimerRef = useRef<number | null>(null);
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
  const reportChatCountsRef = useRef<Record<string, number>>({});
  const hazardTimerRef = useRef<number | null>(null);
  const openReportRef = useRef<(report: RoadReport) => void>(() => {});
  const memberMarkersRef = useRef<Map<string, MemberMarkerEntry>>(new Map());
  const meetingPointMarkerRef = useRef<maplibregl.Marker | null>(null);
  const firebaseDbRef = useRef<Database | null>(null);
  const groupModeRef = useRef(false);
  const memberLiveRef = useRef<Record<string, MemberLiveData>>({});
  const memberStatusesRef = useRef<Record<string, QuickStatus>>({});
  const meetingPointRef = useRef<MeetingPoint | null>(null);
  const convoyRef = useRef<ConvoyData | null>(null);
  const meetingArrivalSentRef = useRef(false);
  const convoyEndedSeenRef = useRef(false);
  const mapClickHandlerRef = useRef<((event: maplibregl.MapMouseEvent) => void) | null>(
    null,
  );
  const geofenceRef = useRef<GeofenceData | null>(null);
  const geofenceInsideRef = useRef<boolean | null>(null);
  const geofenceLabelMarkerRef = useRef<maplibregl.Marker | null>(null);
  const lastBatteryLevelRef = useRef(-1);
  const sosTimerRef = useRef<number | null>(null);
  const sosHoldProgressRef = useRef(0);
  const deadZoneAlertedRef = useRef<Set<string>>(new Set());
  const safetyBannerTimerRef = useRef<number | null>(null);
  const emergencyContactsPromptedRef = useRef(false);

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
  const [destination, setDestination] = useState<Destination | null>(null);
  const [route, setRoute] = useState<RouteData | null>(null);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [navigationActive, setNavigationActive] = useState(false);
  const [showDestinationSheet, setShowDestinationSheet] = useState(false);
  const [routeLoading, setRouteLoading] = useState(false);
  const [recalculatingBanner, setRecalculatingBanner] = useState(false);
  const [arrivalBanner, setArrivalBanner] = useState(false);
  const [routeHazardBanner, setRouteHazardBanner] = useState<HazardBanner | null>(
    null,
  );
  const [reportChatCounts, setReportChatCounts] = useState<Record<string, number>>(
    {},
  );
  const [groupMode, setGroupMode] = useState(false);
  const [tripMembers, setTripMembers] = useState<TripMember[]>([]);
  const [tripName, setTripName] = useState("");
  const [isGroupAdmin, setIsGroupAdmin] = useState(false);
  const [meetingPoint, setMeetingPoint] = useState<MeetingPoint | null>(null);
  const [convoy, setConvoy] = useState<ConvoyData | null>(null);
  const [memberStatuses, setMemberStatuses] = useState<Record<string, QuickStatus>>({});
  const [memberLive, setMemberLive] = useState<Record<string, MemberLiveData>>({});
  const [groupPanelOpen, setGroupPanelOpen] = useState(false);
  const [showConvoySheet, setShowConvoySheet] = useState(false);
  const [showGroupChat, setShowGroupChat] = useState(false);
  const [settingMeetingPoint, setSettingMeetingPoint] = useState(false);
  const [groupStatusBusy, setGroupStatusBusy] = useState(false);
  const [convoyBusy, setConvoyBusy] = useState(false);
  const [convoyBanner, setConvoyBanner] = useState<string | null>(null);
  const [meetingArrivalBanner, setMeetingArrivalBanner] = useState<string | null>(null);
  const [everyoneArrivedBanner, setEveryoneArrivedBanner] = useState(false);
  const [firebaseDb, setFirebaseDb] = useState<Database | null>(null);
  const [geofence, setGeofence] = useState<GeofenceData | null>(null);
  const [showEmergencyContacts, setShowEmergencyContacts] = useState(false);
  const [showSosConfirm, setShowSosConfirm] = useState(false);
  const [sosResponse, setSosResponse] = useState<SOSResponse | null>(null);
  const [sosHoldProgress, setSosHoldProgress] = useState(0);
  const [showGeofenceSetup, setShowGeofenceSetup] = useState(false);
  const [geofenceSetupCenter, setGeofenceSetupCenter] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [geofenceBusy, setGeofenceBusy] = useState(false);
  const [settingGeofence, setSettingGeofence] = useState(false);
  const [safetyBanner, setSafetyBanner] = useState<SafetyBanner | null>(null);
  const currentUserId = dashboardUser?.id ?? null;
  const currentUserName = dashboardUser?.full_name ?? "You";

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

  useEffect(() => {
    destinationRef.current = destination;
  }, [destination]);

  useEffect(() => {
    routeRef.current = route;
  }, [route]);

  useEffect(() => {
    navigationActiveRef.current = navigationActive;
  }, [navigationActive]);

  useEffect(() => {
    activeStepIndexRef.current = activeStepIndex;
  }, [activeStepIndex]);

  useEffect(() => {
    groupModeRef.current = groupMode;
  }, [groupMode]);

  useEffect(() => {
    memberStatusesRef.current = memberStatuses;
  }, [memberStatuses]);

  useEffect(() => {
    memberLiveRef.current = memberLive;
  }, [memberLive]);

  useEffect(() => {
    meetingPointRef.current = meetingPoint;
  }, [meetingPoint]);

  useEffect(() => {
    convoyRef.current = convoy;
  }, [convoy]);

  useEffect(() => {
    geofenceRef.current = geofence;
    geofenceInsideRef.current = null;
  }, [geofence]);

  useEffect(() => {
    const fb = initFirebase();
    if (fb.ok && fb.db) {
      firebaseDbRef.current = fb.db;
      setFirebaseDb(fb.db);
    }
  }, []);

  const showToastMessage = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 3000);
  }, []);

  const showBanner = useCallback((message: string, tone: "amber" | "red") => {
    setSafetyBanner({ message, tone });
    if (safetyBannerTimerRef.current != null) {
      window.clearTimeout(safetyBannerTimerRef.current);
    }
    safetyBannerTimerRef.current = window.setTimeout(() => {
      setSafetyBanner(null);
      safetyBannerTimerRef.current = null;
    }, 10_000);
  }, []);

  const validTripId =
    tripId &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      tripId,
    )
      ? tripId
      : null;

  const clearMemberMarkers = useCallback(() => {
    memberMarkersRef.current.forEach((entry) => entry.marker.remove());
    memberMarkersRef.current.clear();
  }, []);

  const syncGeofenceOnMap = useCallback((fence: GeofenceData | null) => {
    const map = mapRef.current;
    if (!map) return;

    geofenceLabelMarkerRef.current?.remove();
    geofenceLabelMarkerRef.current = null;

    if (!fence) {
      clearGeofenceLayer(map);
      return;
    }

    ensureGeofenceLayer(
      map,
      geofenceCircleGeoJson(fence.center_lat, fence.center_lng, fence.radius_m),
    );

    const label = document.createElement("div");
    label.className = "live-geofence-label";
    label.textContent = fence.label;

    geofenceLabelMarkerRef.current = new maplibregl.Marker({
      element: label,
      anchor: "center",
    })
      .setLngLat([fence.center_lng, fence.center_lat])
      .addTo(map);
  }, []);

  const syncMeetingPointMarker = useCallback((point: MeetingPoint | null) => {
    const map = mapRef.current;
    if (!map) return;
    meetingPointMarkerRef.current?.remove();
    meetingPointMarkerRef.current = null;
    if (!point) return;

    const element = document.createElement("div");
    element.className = "live-meeting-point-marker";
    element.innerHTML = `<span class="live-meeting-point-star">★</span><span class="live-meeting-point-label">${point.label}</span>`;

    meetingPointMarkerRef.current = new maplibregl.Marker({
      element,
      anchor: "bottom",
    })
      .setLngLat([point.lng, point.lat])
      .addTo(map);
  }, []);

  const updateMemberDots = useCallback(
    (data: Record<string, MemberLiveData>) => {
      const map = mapRef.current;
      if (!map || !groupModeRef.current) return;

      const seen = new Set<string>();
      tripMembers.forEach((member, index) => {
        if (member.user_id === currentUserId) return;
        const live = data[member.user_id];
        if (!live || live.lat == null || live.lng == null) return;

        seen.add(member.user_id);
        const color = ["#7c3aed", "#d97706", "#f97316", "#2563eb"][index % 4];
        const offline =
          live.last_seen != null &&
          Date.now() - new Date(live.last_seen).getTime() > 5 * 60 * 1000;

        let entry = memberMarkersRef.current.get(member.user_id);
        if (!entry) {
          const { element, setBearing, setOpacity, setLowBattery } = createMemberMarker(
            color,
            firstName(member.display_name),
          );
          const marker = new maplibregl.Marker({ element, anchor: "center" })
            .setLngLat([live.lng, live.lat])
            .addTo(map);
          entry = { marker, setBearing, setOpacity, setLowBattery };
          memberMarkersRef.current.set(member.user_id, entry);
        } else {
          entry.marker.setLngLat([live.lng, live.lat]);
        }

        entry.setBearing(
          live.bearing != null && !Number.isNaN(live.bearing) ? live.bearing : null,
        );
        entry.setOpacity(offline ? 0.5 : 1);
        entry.setLowBattery(
          live.battery_level != null && live.battery_level <= 20,
        );
      });

      memberMarkersRef.current.forEach((entry, userId) => {
        if (!seen.has(userId)) {
          entry.marker.remove();
          memberMarkersRef.current.delete(userId);
        }
      });
    },
    [currentUserId, tripMembers],
  );

  const updateMemberStatusesFromLive = useCallback((data: Record<string, MemberLiveData>) => {
    const next: Record<string, QuickStatus> = {};
    for (const [userId, live] of Object.entries(data)) {
      const status = memberStatusValue(live);
      if (status) next[userId] = status;
    }
    setMemberStatuses((prev) => ({ ...prev, ...next }));
  }, []);

  const writeUserLocation = useCallback(
    (lat: number, lng: number, bearing: number | null, speed: number) => {
      const db = firebaseDbRef.current;
      if (!groupModeRef.current || !validTripId || !currentUserId || !db) return;
      const locationRef = ref(db, `trips/${validTripId}/live/members/${currentUserId}`);
      void set(locationRef, {
        lat,
        lng,
        bearing,
        speed_mph: speed,
        last_seen: new Date().toISOString(),
        status: memberStatusesRef.current[currentUserId] || "on_my_way",
      });
    },
    [currentUserId, validTripId],
  );

  const stopMeetingPointPlacement = useCallback(() => {
    const map = mapRef.current;
    if (map && mapClickHandlerRef.current) {
      map.off("click", mapClickHandlerRef.current);
      mapClickHandlerRef.current = null;
    }
    if (map) {
      map.getCanvas().style.cursor = "";
    }
    setSettingMeetingPoint(false);
    setSettingGeofence(false);
  }, []);

  const clearRouteFromMap = useCallback(() => {
    const map = mapRef.current;
    if (map) clearRouteLayer(map);
    destinationMarkerRef.current?.remove();
    destinationMarkerRef.current = null;
  }, []);

  const clearNavigation = useCallback(() => {
    clearRouteFromMap();
    setDestination(null);
    setRoute(null);
    setNavigationActive(false);
    setActiveStepIndex(0);
    setRouteHazardBanner(null);
    setRecalculatingBanner(false);
    recalculatingRef.current = false;
    destinationRef.current = null;
    routeRef.current = null;
    navigationActiveRef.current = false;
    activeStepIndexRef.current = 0;
    if (routeHazardTimerRef.current != null) {
      window.clearTimeout(routeHazardTimerRef.current);
      routeHazardTimerRef.current = null;
    }
    const pos = userPositionRef.current;
    const map = mapRef.current;
    if (pos && map) {
      map.jumpTo({ center: [pos.lng, pos.lat], zoom: 15 });
    }
  }, [clearRouteFromMap]);

  const drawRouteOnMap = useCallback(
    (geometry: GeoJSON.LineString, dest: Destination, fitBounds = true) => {
      const map = mapRef.current;
      if (!map) return;

      ensureRouteLayer(map, geometry);
      destinationMarkerRef.current?.remove();

      const label = document.createElement("div");
      label.className =
        "max-w-[140px] truncate rounded-full bg-red-600 px-2 py-1 text-center text-xs font-semibold text-white shadow-lg";
      label.textContent = dest.name.slice(0, 20);

      destinationMarkerRef.current = new maplibregl.Marker({
        element: label,
        anchor: "bottom",
      })
        .setLngLat([dest.lng, dest.lat])
        .addTo(map);

      if (fitBounds) {
        const bounds = routeBounds(geometry);
        if (bounds) {
          map.fitBounds(bounds, { padding: 80, duration: 800 });
        }
      }
    },
    [],
  );

  const fetchRoute = useCallback(
    async (
      userLat: number,
      userLng: number,
      dest: Destination,
      options?: { fitBounds?: boolean; resetStep?: boolean },
    ) => {
      setRouteLoading(true);
      try {
        const params = new URLSearchParams({
          start_lat: userLat.toString(),
          start_lng: userLng.toString(),
          end_lat: dest.lat.toString(),
          end_lng: dest.lng.toString(),
        });
        const data = await apiFetchPublic<RouteData>(`/live/route?${params}`);
        setRoute(data);
        routeRef.current = data;
        drawRouteOnMap(data.geometry, dest, options?.fitBounds ?? true);
        if (options?.resetStep) {
          setActiveStepIndex(0);
          activeStepIndexRef.current = 0;
        }
      } catch {
        showToastMessage("Routing unavailable. Try again.");
        if (!routeRef.current) clearNavigation();
      } finally {
        setRouteLoading(false);
      }
    },
    [clearNavigation, drawRouteOnMap, showToastMessage],
  );

  const handleArrival = useCallback(() => {
    clearNavigation();
    setArrivalBanner(true);
    if (arrivalTimerRef.current != null) {
      window.clearTimeout(arrivalTimerRef.current);
    }
    arrivalTimerRef.current = window.setTimeout(() => {
      setArrivalBanner(false);
      arrivalTimerRef.current = null;
    }, ARRIVAL_BANNER_MS);
  }, [clearNavigation]);

  const checkRouteHazards = useCallback((items: RoadReport[]) => {
    if (!navigationActiveRef.current || !routeRef.current) return;
    let closest: HazardBanner | null = null;
    for (const report of items) {
      const distanceM = distanceToRouteLine(
        report.lat,
        report.lng,
        routeRef.current.geometry,
      );
      if (distanceM > HAZARD_ON_ROUTE_M) continue;
      if (!closest || distanceM < closest.distanceM) {
        closest = { report, distanceM };
      }
    }
    if (!closest) return;
    setRouteHazardBanner(closest);
    if (routeHazardTimerRef.current != null) {
      window.clearTimeout(routeHazardTimerRef.current);
    }
    routeHazardTimerRef.current = window.setTimeout(() => {
      setRouteHazardBanner(null);
      routeHazardTimerRef.current = null;
    }, HAZARD_ON_ROUTE_BANNER_MS);
  }, []);

  const processNavigationUpdate = useCallback(
    (lat: number, lng: number) => {
      if (!navigationActiveRef.current || !routeRef.current || !destinationRef.current) {
        return;
      }

      const currentRoute = routeRef.current;
      const dest = destinationRef.current;
      const stepIndex = activeStepIndexRef.current;
      const currentStep = currentRoute.steps[stepIndex];
      const distToRoute = distanceToRouteLine(lat, lng, currentRoute.geometry);

      if (distToRoute > DEVIATION_M && !recalculatingRef.current) {
        recalculatingRef.current = true;
        setRecalculatingBanner(true);
        void fetchRoute(lat, lng, dest, { fitBounds: false, resetStep: true }).finally(
          () => {
            recalculatingRef.current = false;
            setRecalculatingBanner(false);
          },
        );
        return;
      }

      if (currentStep) {
        const distToStep = haversineMeters(lat, lng, currentStep.lat, currentStep.lng);
        if (distToStep < STEP_ADVANCE_M && stepIndex < currentRoute.steps.length - 1) {
          const nextIndex = stepIndex + 1;
          setActiveStepIndex(nextIndex);
          activeStepIndexRef.current = nextIndex;
        }
      }

      const distToDest = haversineMeters(lat, lng, dest.lat, dest.lng);
      if (distToDest < ARRIVAL_M) {
        handleArrival();
      }
    },
    [fetchRoute, handleArrival],
  );

  const handleDestinationSelect = useCallback(
    (place: Destination) => {
      setShowDestinationSheet(false);
      if (isGuest) {
        setGuestPrompt("Sign in to get turn-by-turn directions");
        return;
      }
      if (groupMode && convoy?.active && !isGroupAdmin) {
        showToastMessage("Convoy is active — follow the group route");
        return;
      }
      const pos = userPositionRef.current;
      if (!pos) {
        showToastMessage("Waiting for GPS position…");
        return;
      }
      setDestination(place);
      destinationRef.current = place;
      setNavigationActive(false);
      setActiveStepIndex(0);
      void fetchRoute(pos.lat, pos.lng, place, { fitBounds: true, resetStep: true });
    },
    [convoy?.active, fetchRoute, groupMode, isGroupAdmin, isGuest, showToastMessage],
  );

  const postQuickStatus = useCallback(
    async (status: QuickStatus) => {
      if (!validTripId) return;
      setGroupStatusBusy(true);
      try {
        const result = await apiFetch<{ status: QuickStatus; updated_at: string }>(
          `/live/group/${validTripId}/status`,
          {
            method: "POST",
            body: JSON.stringify({ status }),
          },
        );
        setMemberStatuses((prev) => ({
          ...prev,
          ...(currentUserId ? { [currentUserId]: result.status } : {}),
        }));
        if (status === "need_help") {
          showToastMessage("Help request sent to the group");
        }
      } catch {
        showToastMessage("Could not update status. Try again.");
      } finally {
        setGroupStatusBusy(false);
      }
    },
    [currentUserId, showToastMessage, validTripId],
  );

  const checkGeofence = useCallback(
    (userLat: number, userLng: number) => {
      const fence = geofenceRef.current;
      if (!fence) return;

      const dist = haversineMeters(userLat, userLng, fence.center_lat, fence.center_lng);
      const wasInside = geofenceInsideRef.current;
      const isInside = dist <= fence.radius_m;

      if (wasInside == null) {
        geofenceInsideRef.current = isInside;
        return;
      }

      if (wasInside && !isInside) {
        showBanner(`⚠️ You left the ${fence.label}`, "amber");
        void postQuickStatus("on_my_way");
      }

      geofenceInsideRef.current = isInside;
    },
    [postQuickStatus, showBanner],
  );

  const checkBattery = useCallback(async () => {
    if (!groupModeRef.current || !validTripId) return;
    const nav = navigator as Navigator & {
      getBattery?: () => Promise<{ level: number }>;
    };
    if (!("getBattery" in nav) || typeof nav.getBattery !== "function") return;

    try {
      const battery = await nav.getBattery();
      const level = Math.round(battery.level * 100);
      if (Math.abs(level - lastBatteryLevelRef.current) >= 5) {
        await apiFetch(`/live/group/${validTripId}/battery`, {
          method: "POST",
          body: JSON.stringify({ level }),
        });
        lastBatteryLevelRef.current = level;
      }
    } catch {
      // Battery API is optional.
    }
  }, [validTripId]);

  const triggerSOS = useCallback(async () => {
    let lat = userPositionRef.current?.lat;
    let lng = userPositionRef.current?.lng;
    let usedCache = false;

    if (lat == null || lng == null) {
      try {
        const cached = JSON.parse(
          localStorage.getItem("rovvy_last_position") || "null",
        ) as { lat?: number; lng?: number } | null;
        if (cached?.lat != null && cached?.lng != null) {
          lat = cached.lat;
          lng = cached.lng;
          usedCache = true;
        }
      } catch {
        // Ignore invalid cache.
      }
    }

    if (lat == null || lng == null) {
      showToastMessage("Location unavailable for SOS");
      return;
    }

    try {
      const result = await apiFetch<SOSResponse>("/live/sos", {
        method: "POST",
        body: JSON.stringify({
          lat,
          lng,
          trip_id: validTripId,
        }),
      });

      let smsTemplate = result.sms_template;
      if (usedCache && !smsTemplate.includes("(last known)")) {
        smsTemplate = smsTemplate.replace(
          "Last known location:",
          "Last known location (last known):",
        );
      }

      setSosResponse({ ...result, sms_template: smsTemplate });
      setShowSosConfirm(true);
      localStorage.setItem(
        "rovvy_last_position",
        JSON.stringify({ lat, lng, ts: new Date().toISOString() }),
      );
    } catch {
      showToastMessage("Could not trigger SOS. Try again.");
    }
  }, [showToastMessage, validTripId]);

  const handleSOSPressStart = useCallback(() => {
    let progress = 0;
    sosTimerRef.current = window.setInterval(() => {
      progress += 100 / 30;
      const next = Math.min(progress, 100);
      sosHoldProgressRef.current = next;
      setSosHoldProgress(next);
      if (progress >= 100) {
        if (sosTimerRef.current != null) {
          window.clearInterval(sosTimerRef.current);
          sosTimerRef.current = null;
        }
        sosHoldProgressRef.current = 0;
        setSosHoldProgress(0);
        void triggerSOS();
      }
    }, 100);
  }, [triggerSOS]);

  const handleSOSPressEnd = useCallback(() => {
    if (sosTimerRef.current != null) {
      window.clearInterval(sosTimerRef.current);
      sosTimerRef.current = null;
    }
    if (sosHoldProgressRef.current >= 20 && sosHoldProgressRef.current < 100) {
      setShowEmergencyContacts(true);
    }
    sosHoldProgressRef.current = 0;
    setSosHoldProgress(0);
  }, []);

  const handleCancelSos = useCallback(async () => {
    const db = firebaseDbRef.current;
    if (db && validTripId) {
      await remove(ref(db, `trips/${validTripId}/live/sos`));
    }
    setShowSosConfirm(false);
    setSosResponse(null);
  }, [validTripId]);

  const checkMeetingArrival = useCallback(
    (lat: number, lng: number) => {
      const point = meetingPointRef.current;
      if (!point || meetingArrivalSentRef.current) return;

      const distanceM = haversineMeters(lat, lng, point.lat, point.lng);
      if (distanceM >= MEETING_ARRIVAL_M) return;

      meetingArrivalSentRef.current = true;
      setMeetingArrivalBanner(`You arrived at ${point.label}!`);
      void postQuickStatus("at_the_spot");
      clearNavigation();
      window.setTimeout(() => setMeetingArrivalBanner(null), ARRIVAL_BANNER_MS);
    },
    [clearNavigation, postQuickStatus],
  );

  const checkEveryoneArrived = useCallback(() => {
    if (!isGroupAdmin || tripMembers.length === 0) return;
    const allArrived = tripMembers.every(
      (member) => memberStatuses[member.user_id] === "at_the_spot",
    );
    setEveryoneArrivedBanner(allArrived);
  }, [isGroupAdmin, memberStatuses, tripMembers]);

  const handleSetMeetingPointMode = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    setSettingMeetingPoint(true);
    map.getCanvas().style.cursor = "crosshair";
    showToastMessage("Tap anywhere on the map to set meeting point");

    const onClick = async (event: maplibregl.MapMouseEvent) => {
      if (!validTripId) return;
      stopMeetingPointPlacement();
      try {
        await apiFetch(`/live/group/${validTripId}/meeting-point`, {
          method: "POST",
          body: JSON.stringify({
            lat: event.lngLat.lat,
            lng: event.lngLat.lng,
            label: "Meeting Point",
          }),
        });
        showToastMessage("Meeting point set");
      } catch {
        showToastMessage("Could not set meeting point");
      }
    };

    mapClickHandlerRef.current = onClick;
    map.once("click", onClick);
  }, [showToastMessage, stopMeetingPointPlacement, validTripId]);

  const handleClearMeetingPoint = useCallback(async () => {
    if (!validTripId) return;
    try {
      await apiFetch(`/live/group/${validTripId}/meeting-point`, { method: "DELETE" });
      showToastMessage("Meeting point cleared");
    } catch {
      showToastMessage("Could not clear meeting point");
    }
  }, [showToastMessage, validTripId]);

  const handleSetGeofenceMode = useCallback(() => {
    const map = mapRef.current;
    if (!map || !validTripId) return;
    stopMeetingPointPlacement();
    setSettingGeofence(true);
    map.getCanvas().style.cursor = "crosshair";
    showToastMessage("Tap anywhere on the map to set safe zone center");

    const onClick = (event: maplibregl.MapMouseEvent) => {
      stopMeetingPointPlacement();
      setGeofenceSetupCenter({ lat: event.lngLat.lat, lng: event.lngLat.lng });
      setShowGeofenceSetup(true);
    };

    mapClickHandlerRef.current = onClick;
    map.once("click", onClick);
  }, [showToastMessage, stopMeetingPointPlacement, validTripId]);

  const handleConfirmGeofence = useCallback(
    async (radiusM: number, label: string) => {
      if (!validTripId || !geofenceSetupCenter) return;
      setGeofenceBusy(true);
      try {
        await apiFetch(`/live/group/${validTripId}/geofence`, {
          method: "POST",
          body: JSON.stringify({
            center_lat: geofenceSetupCenter.lat,
            center_lng: geofenceSetupCenter.lng,
            radius_m: radiusM,
            label,
          }),
        });
        setShowGeofenceSetup(false);
        setGeofenceSetupCenter(null);
        showToastMessage("Safe zone set");
      } catch {
        showToastMessage("Could not set safe zone");
      } finally {
        setGeofenceBusy(false);
      }
    },
    [geofenceSetupCenter, showToastMessage, validTripId],
  );

  const handleClearGeofence = useCallback(async () => {
    if (!validTripId) return;
    try {
      await apiFetch(`/live/group/${validTripId}/geofence`, { method: "DELETE" });
      showToastMessage("Safe zone cleared");
    } catch {
      showToastMessage("Could not clear safe zone");
    }
  }, [showToastMessage, validTripId]);

  const handleStartConvoy = useCallback(
    async (place: { lat: number; lng: number; name: string }) => {
      if (!validTripId) return;
      setConvoyBusy(true);
      try {
        await apiFetch(`/live/group/${validTripId}/convoy`, {
          method: "POST",
          body: JSON.stringify({
            destination_lat: place.lat,
            destination_lng: place.lng,
            destination_name: place.name,
          }),
        });
        setShowConvoySheet(false);
        showToastMessage("Convoy started");
      } catch {
        showToastMessage("Could not start convoy");
      } finally {
        setConvoyBusy(false);
      }
    },
    [showToastMessage, validTripId],
  );

  const handleEndConvoy = useCallback(async () => {
    if (!validTripId) return;
    try {
      await apiFetch(`/live/group/${validTripId}/convoy`, { method: "DELETE" });
    } catch {
      showToastMessage("Could not end convoy");
    }
  }, [showToastMessage, validTripId]);

  useEffect(() => {
    checkEveryoneArrived();
  }, [checkEveryoneArrived, memberStatuses]);

  useEffect(() => {
    if (!validTripId || isGuest) return;

    let cancelled = false;
    void (async () => {
      try {
        const data = await apiFetch<GroupValidateResponse>(
          `/live/group/${validTripId}/validate`,
        );
        if (cancelled) return;
        setGroupMode(true);
        setGroupPanelOpen(true);
        setTripMembers(data.members);
        setTripName(data.trip_name);
        setIsGroupAdmin(data.is_admin);
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "";
        if (message.toLowerCase().includes("not a trip member")) {
          showToastMessage("You are not a member of this trip");
          router.push("/trips");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isGuest, router, showToastMessage, validTripId]);

  useEffect(() => {
    const db = firebaseDb;
    if (!groupMode || !validTripId || !db) return;

    const membersRef = ref(db, `trips/${validTripId}/live/members`);
    const unsubscribe = onValue(membersRef, (snapshot) => {
      const data = (snapshot.val() ?? {}) as Record<string, MemberLiveData>;
      setMemberLive(data);
      updateMemberDots(data);
      updateMemberStatusesFromLive(data);
    });
    return () => off(membersRef, "value", unsubscribe);
  }, [firebaseDb, groupMode, updateMemberDots, updateMemberStatusesFromLive, validTripId]);

  useEffect(() => {
    const db = firebaseDb;
    if (!groupMode || !validTripId || !db) return;

    const mpRef = ref(db, `trips/${validTripId}/live/meeting_point`);
    const unsubscribe = onValue(mpRef, (snapshot) => {
      const value = snapshot.val() as MeetingPoint | null;
      setMeetingPoint(value);
      syncMeetingPointMarker(value);
    });
    return () => off(mpRef, "value", unsubscribe);
  }, [firebaseDb, groupMode, syncMeetingPointMarker, validTripId]);

  useEffect(() => {
    const db = firebaseDb;
    if (!groupMode || !validTripId || !db) return;

    const convoyRefPath = ref(db, `trips/${validTripId}/live/convoy`);
    const unsubscribe = onValue(convoyRefPath, (snapshot) => {
      const value = snapshot.val() as ConvoyData | null;
      setConvoy(value);
    });
    return () => off(convoyRefPath, "value", unsubscribe);
  }, [firebaseDb, groupMode, validTripId]);

  useEffect(() => {
    const db = firebaseDb;
    if (!groupMode || !validTripId || !db) return;

    const geofenceRefPath = ref(db, `trips/${validTripId}/live/geofence`);
    const unsubscribe = onValue(geofenceRefPath, (snapshot) => {
      const value = snapshot.val() as GeofenceData | null;
      setGeofence(value);
      syncGeofenceOnMap(value);
    });
    return () => off(geofenceRefPath, "value", unsubscribe);
  }, [firebaseDb, groupMode, syncGeofenceOnMap, validTripId]);

  useEffect(() => {
    if (!groupMode || !validTripId || !firebaseDb) return;

    const membersRef = ref(firebaseDb, `trips/${validTripId}/live/members`);
    const handler = (snapshot: { val: () => Record<string, MemberLiveData> | null }) => {
      const members = snapshot.val() || {};
      const now = Date.now();
      Object.entries(members).forEach(([userId, data]) => {
        if (userId === currentUserId) return;
        const lastSeen = data.last_seen ? new Date(data.last_seen).getTime() : 0;
        const minutesAgo = (now - lastSeen) / 60000;
        if (minutesAgo > 30) {
          if (deadZoneAlertedRef.current.has(userId)) return;
          deadZoneAlertedRef.current.add(userId);
          const memberName =
            tripMembers.find((member) => member.user_id === userId)?.display_name ||
            "A member";
          showBanner(
            `⚠️ ${firstName(memberName)} hasn't updated in ${Math.round(minutesAgo)} min`,
            "red",
          );
        } else {
          deadZoneAlertedRef.current.delete(userId);
        }
      });
    };

    onValue(membersRef, handler);
    return () => off(membersRef, "value", handler);
  }, [currentUserId, firebaseDb, groupMode, showBanner, tripMembers, validTripId]);

  useEffect(() => {
    if (!groupMode || !validTripId) return;
    void checkBattery();
    const interval = window.setInterval(() => {
      void checkBattery();
    }, 5 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, [checkBattery, groupMode, validTripId]);

  useEffect(() => {
    if (isGuest || emergencyContactsPromptedRef.current) return;
    emergencyContactsPromptedRef.current = true;
    void (async () => {
      try {
        const contacts = await apiFetch<EmergencyContact[]>("/live/emergency-contacts");
        if (contacts.length === 0) {
          setShowEmergencyContacts(true);
        }
      } catch {
        // Optional onboarding prompt.
      }
    })();
  }, [isGuest]);

  useEffect(() => {
    if (!meetingPoint || convoy?.active) {
      if (!meetingPoint) meetingArrivalSentRef.current = false;
      return;
    }
    const pos = userPositionRef.current;
    if (!pos || navigationActiveRef.current) return;
    const dest = {
      lat: meetingPoint.lat,
      lng: meetingPoint.lng,
      name: meetingPoint.label,
    };
    setDestination(dest);
    destinationRef.current = dest;
    void fetchRoute(pos.lat, pos.lng, dest, { fitBounds: true, resetStep: true }).then(
      () => {
        setNavigationActive(true);
        navigationActiveRef.current = true;
      },
    );
  }, [convoy?.active, fetchRoute, meetingPoint]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !convoy?.active || !convoy.route_geometry) return;

    ensureRouteLayer(map, convoy.route_geometry);
    if (!isGroupAdmin) {
      const leader = tripMembers.find((member) => member.user_id === convoy.leader_id);
      setConvoyBanner(
        `Convoy active · Following ${firstName(leader?.display_name ?? "leader")} to ${convoy.destination_name}`,
      );
    } else {
      setConvoyBanner(null);
    }
    convoyEndedSeenRef.current = true;
  }, [convoy, isGroupAdmin, tripMembers]);

  useEffect(() => {
    if (convoy) return;
    if (convoyEndedSeenRef.current) {
      showToastMessage("Convoy ended");
      convoyEndedSeenRef.current = false;
      setConvoyBanner(null);
      if (!meetingPointRef.current) {
        clearRouteFromMap();
      }
    }
  }, [clearRouteFromMap, convoy, showToastMessage]);

  useEffect(() => {
    reportChatCountsRef.current = reportChatCounts;
  }, [reportChatCounts]);

  const fetchReportChatCounts = useCallback(async (items: RoadReport[]) => {
    const entries = await Promise.all(
      items.map(async (report) => {
        try {
          const data = await apiFetchPublic<{ count: number }>(
            `/live/reports/${report.id}/chat/count`,
          );
          return [report.id, data.count] as const;
        } catch {
          return [report.id, 0] as const;
        }
      }),
    );
    const counts = Object.fromEntries(entries);
    setReportChatCounts(counts);
    reportChatCountsRef.current = counts;
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
      checkRouteHazards(data);
      void fetchReportChatCounts(data);
    } catch {
      // Map works without pins; avoid noisy console errors on transient network/API issues.
    }
  }, [checkRouteHazards, fetchReportChatCounts]);

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
      const element = createReportPinElement(
        report.report_type,
        () => {
          openReportRef.current(report);
        },
        (reportChatCountsRef.current[report.id] ?? 0) > 0,
      );
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
      if (safetyBannerTimerRef.current != null) {
        window.clearTimeout(safetyBannerTimerRef.current);
      }
      if (sosTimerRef.current != null) {
        window.clearInterval(sosTimerRef.current);
      }
      if (routeHazardTimerRef.current != null) {
        window.clearTimeout(routeHazardTimerRef.current);
      }
      if (arrivalTimerRef.current != null) {
        window.clearTimeout(arrivalTimerRef.current);
      }
      const id = sessionIdRef.current;
      const token =
        typeof window !== "undefined" ? localStorage.getItem("gt_token") : null;
      if (id && token) {
        void apiFetch(`/live/session/${id}/end`, { method: "POST" });
      }
      stopMeetingPointPlacement();
      clearMemberMarkers();
      meetingPointMarkerRef.current?.remove();
      meetingPointMarkerRef.current = null;
      geofenceLabelMarkerRef.current?.remove();
      geofenceLabelMarkerRef.current = null;
      const db = firebaseDbRef.current;
      const trip = validTripId;
      const userId = dashboardUser?.id;
      if (groupModeRef.current && db && trip && userId) {
        void remove(ref(db, `trips/${trip}/live/members/${userId}`));
      }
    };
  }, [clearMemberMarkers, dashboardUser?.id, stopMeetingPointPlacement, validTripId]);

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
      if (routeRef.current && destinationRef.current) {
        ensureRouteLayer(map, routeRef.current.geometry);
        const dest = destinationRef.current;
        destinationMarkerRef.current?.remove();
        const label = document.createElement("div");
        label.className =
          "max-w-[140px] truncate rounded-full bg-red-600 px-2 py-1 text-center text-xs font-semibold text-white shadow-lg";
        label.textContent = dest.name.slice(0, 20);
        destinationMarkerRef.current = new maplibregl.Marker({
          element: label,
          anchor: "bottom",
        })
          .setLngLat([dest.lng, dest.lat])
          .addTo(map);
      }
      const pos = previousSampleRef.current;
      if (!pos || gpsStateRef.current !== "granted") return;
      markerRef.current = null;
      syncMarker(map, pos.lat, pos.lng, bearingRef.current, true);
      if (geofenceRef.current) {
        syncGeofenceOnMap(geofenceRef.current);
      }
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
      clearRouteFromMap();
      markerRef.current?.marker.remove();
      markerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [applyMapStyle, clearPoiMarkers, clearRouteFromMap, syncGeofenceOnMap, syncMarker, syncReportMarkers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    syncReportMarkers(map, reports);
  }, [reportChatCounts, reports, syncReportMarkers]);

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

        localStorage.setItem(
          "rovvy_last_position",
          JSON.stringify({ lat, lng, ts: new Date().toISOString() }),
        );

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
        writeUserLocation(lat, lng, bearing, mph);
        void fetchNearbyReports(lat, lng);
        void fetchTrafficDensity(lat, lng);
        processNavigationUpdate(lat, lng);
        if (groupModeRef.current) {
          checkMeetingArrival(lat, lng);
          checkGeofence(lat, lng);
        }

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
  }, [applyMapStyle, checkGeofence, checkMeetingArrival, fetchNearbyReports, fetchTrafficDensity, fetchWeather, processNavigationUpdate, startLiveSession, syncMarker, writeUserLocation]);

  useEffect(() => {
    if (!navigationActive) return;
    const interval = window.setInterval(() => {
      const pos = userPositionRef.current;
      const dest = destinationRef.current;
      if (!pos || !dest) return;
      void fetchRoute(pos.lat, pos.lng, dest, {
        fitBounds: false,
        resetStep: false,
      });
    }, ROUTE_REFETCH_MS);
    return () => window.clearInterval(interval);
  }, [fetchRoute, navigationActive]);

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
  const routeHazardConfig = routeHazardBanner
    ? REPORT_CONFIG[routeHazardBanner.report.report_type]
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

        {groupMode ? (
          <GroupPanelToggle
            active={groupPanelOpen}
            onClick={() => setGroupPanelOpen((open) => !open)}
          />
        ) : null}

        {settingMeetingPoint ? (
          <div className="pointer-events-none absolute left-3 right-3 top-[calc(max(0.75rem,env(safe-area-inset-top))+6.5rem)] z-[130]">
            <div className="rounded-xl bg-teal-700 px-4 py-3 text-center text-sm font-semibold text-white shadow-lg">
              Tap anywhere on the map to set meeting point
            </div>
          </div>
        ) : null}

        {settingGeofence ? (
          <div className="pointer-events-none absolute left-3 right-3 top-[calc(max(0.75rem,env(safe-area-inset-top))+6.5rem)] z-[130]">
            <div className="rounded-xl bg-teal-700 px-4 py-3 text-center text-sm font-semibold text-white shadow-lg">
              Tap anywhere on the map to set safe zone center
            </div>
          </div>
        ) : null}

        {safetyBanner ? (
          <div className="pointer-events-none absolute left-3 right-3 top-[calc(max(0.75rem,env(safe-area-inset-top))+6.5rem)] z-[130]">
            <div
              className={`rounded-xl px-4 py-3 text-center text-sm font-semibold text-white shadow-lg ${
                safetyBanner.tone === "red" ? "bg-red-600" : "bg-amber-500"
              }`}
            >
              {safetyBanner.message}
            </div>
          </div>
        ) : null}

        {convoyBanner ? (
          <div className="pointer-events-none absolute left-3 right-3 top-[calc(max(0.75rem,env(safe-area-inset-top))+6.5rem)] z-[130]">
            <div className="rounded-xl bg-[#0F766E] px-4 py-3 text-center text-sm font-semibold text-white shadow-lg">
              {convoyBanner}
            </div>
          </div>
        ) : null}

        {meetingArrivalBanner ? (
          <div className="pointer-events-none absolute left-3 right-3 top-[calc(max(0.75rem,env(safe-area-inset-top))+6.5rem)] z-[130]">
            <div className="rounded-xl bg-green-600 px-4 py-3 text-center text-sm font-semibold text-white shadow-lg">
              {meetingArrivalBanner}
            </div>
          </div>
        ) : null}

        {everyoneArrivedBanner ? (
          <div className="pointer-events-none absolute left-3 right-3 top-[calc(max(0.75rem,env(safe-area-inset-top))+9rem)] z-[130]">
            <div className="rounded-xl bg-green-600 px-4 py-3 text-center text-sm font-semibold text-white shadow-lg">
              Everyone has arrived! 🎉
            </div>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => {
            if (groupMode && convoy?.active && !isGroupAdmin) {
              showToastMessage("Convoy is active — follow the group route");
              return;
            }
            setShowDestinationSheet(true);
          }}
          className="pointer-events-auto absolute left-3 right-3 top-[calc(max(0.75rem,env(safe-area-inset-top))+3.25rem)] flex items-center gap-2 rounded-full bg-[rgba(15,23,42,0.82)] px-4 py-2.5 text-left text-sm text-white shadow-lg backdrop-blur-sm transition hover:bg-[rgba(15,23,42,0.92)]"
        >
          <MapPin size={16} className="shrink-0 text-[#5EEAD4]" />
          <span className={`truncate ${destination ? "font-medium" : "text-white/70"}`}>
            {destination?.name || "Search destination..."}
          </span>
          {routeLoading ? (
            <Loader2 size={14} className="ml-auto animate-spin text-[#5EEAD4]" />
          ) : null}
        </button>

        {arrivalBanner ? (
          <div className="pointer-events-none absolute left-3 right-3 top-[calc(max(0.75rem,env(safe-area-inset-top))+6.5rem)] z-[130]">
            <div className="rounded-xl bg-green-600 px-4 py-3 text-center text-sm font-semibold text-white shadow-lg">
              You have arrived!
            </div>
          </div>
        ) : null}

        {recalculatingBanner ? (
          <div className="pointer-events-none absolute left-3 right-3 top-[calc(max(0.75rem,env(safe-area-inset-top))+6.5rem)] z-[130]">
            <div className="rounded-xl bg-amber-500 px-4 py-3 text-center text-sm font-semibold text-white shadow-lg">
              Recalculating…
            </div>
          </div>
        ) : null}

        {weatherLabel ? (
          <div className="pointer-events-none absolute right-3 top-[calc(max(0.75rem,env(safe-area-inset-top))+6.5rem)]">
            <div className="rounded-full bg-[rgba(15,23,42,0.82)] px-3 py-1.5 text-xs font-semibold text-white shadow-lg backdrop-blur-sm">
              {weatherLabel}
            </div>
          </div>
        ) : null}

        {hazardBanner && hazardConfig ? (
          <div className="pointer-events-none absolute left-3 right-3 top-[calc(max(0.75rem,env(safe-area-inset-top))+9rem)]">
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

        {routeHazardBanner && routeHazardConfig ? (
          <div className="pointer-events-none absolute left-3 right-3 top-[calc(max(0.75rem,env(safe-area-inset-top))+9rem)]">
            <div className="rounded-xl bg-amber-500 px-4 py-3 text-white shadow-lg">
              <p className="text-sm font-semibold">
                {routeHazardConfig.emoji} {routeHazardConfig.label} ahead on your route —{" "}
                {formatDistance(routeHazardBanner.distanceM)} away
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

        {!isGuest ? (
          <div
            className={`pointer-events-auto absolute z-20 ${
              groupMode ? "bottom-[14.5rem] right-4" : "bottom-[10.5rem] right-4"
            }`}
          >
            <button
              type="button"
              aria-label="Hold for 3 seconds to trigger SOS"
              onPointerDown={handleSOSPressStart}
              onPointerUp={handleSOSPressEnd}
              onPointerLeave={handleSOSPressEnd}
              onPointerCancel={handleSOSPressEnd}
              className={`live-sos-button ${groupMode ? "live-sos-button--group" : ""}`}
            >
              <svg className="live-sos-progress" viewBox="0 0 64 64" aria-hidden>
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  fill="none"
                  stroke="rgba(255,255,255,0.35)"
                  strokeWidth="3"
                />
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={175.93}
                  strokeDashoffset={175.93 - (175.93 * sosHoldProgress) / 100}
                  transform="rotate(-90 32 32)"
                />
              </svg>
              <span className="live-sos-label">SOS</span>
            </button>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => {
            if (isGuest && guestWayraRemaining <= 0) {
              setGuestPrompt("Create free account for unlimited Wayra access");
              return;
            }
            setShowWayra(true);
          }}
          className={`pointer-events-auto absolute bottom-24 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-[#0F766E] text-white shadow-lg transition hover:bg-[#0d655c] ${
            groupMode ? "right-20" : "right-4"
          }`}
          aria-label="Open Wayra chat"
        >
          <MessageCircle size={22} />
        </button>

        {groupMode && firebaseDb && validTripId && currentUserId ? (
          <GroupLiveChatButton onClick={() => setShowGroupChat(true)} />
        ) : null}

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
          onToast={showToastMessage}
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

      {showDestinationSheet ? (
        <DestinationSheet
          onClose={() => setShowDestinationSheet(false)}
          onSelect={handleDestinationSelect}
        />
      ) : null}

      {route && destination ? (
        <NavigationSheet
          destinationName={destination.name}
          route={route}
          activeStepIndex={activeStepIndex}
          navigationActive={navigationActive}
          onStart={() => setNavigationActive(true)}
          onCancel={clearNavigation}
          onEnd={clearNavigation}
        />
      ) : null}

      {guestPrompt ? (
        <GuestPrompt
          message={guestPrompt}
          onDismiss={() => setGuestPrompt(null)}
        />
      ) : null}

      {groupMode ? (
        <GroupPanel
          open={groupPanelOpen}
          tripName={tripName}
          members={tripMembers}
          memberLive={memberLive}
          memberStatuses={memberStatuses}
          meetingPoint={meetingPoint}
          convoy={convoy}
          geofence={geofence}
          isGroupAdmin={isGroupAdmin}
          currentUserId={currentUserId}
          currentUserSpeedMph={speedMph}
          statusBusy={groupStatusBusy}
          onClose={() => setGroupPanelOpen(false)}
          onSetMeetingPoint={handleSetMeetingPointMode}
          onClearMeetingPoint={() => void handleClearMeetingPoint()}
          onStartConvoy={() => setShowConvoySheet(true)}
          onEndConvoy={() => void handleEndConvoy()}
          onSetGeofence={handleSetGeofenceMode}
          onClearGeofence={() => void handleClearGeofence()}
          onQuickStatus={(status) => void postQuickStatus(status)}
        />
      ) : null}

      {showConvoySheet ? (
        <ConvoySheet
          busy={convoyBusy}
          onClose={() => setShowConvoySheet(false)}
          onStart={(place) => void handleStartConvoy(place)}
        />
      ) : null}

      {showGroupChat && firebaseDb && validTripId && currentUserId ? (
        <GroupLiveChatSheet
          tripId={validTripId}
          db={firebaseDb}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          onClose={() => setShowGroupChat(false)}
        />
      ) : null}

      {showEmergencyContacts && !isGuest ? (
        <EmergencyContactsSheet
          onClose={() => setShowEmergencyContacts(false)}
          onSkip={() => setShowEmergencyContacts(false)}
        />
      ) : null}

      {showSosConfirm && sosResponse ? (
        <SOSConfirmSheet
          fcmSentTo={sosResponse.fcm_sent_to}
          groupMode={groupMode}
          emergencyContacts={sosResponse.emergency_contacts}
          smsTemplate={sosResponse.sms_template}
          googleMapsUrl={sosResponse.google_maps_url}
          onCancelSos={() => void handleCancelSos()}
          onAddContacts={() => setShowEmergencyContacts(true)}
        />
      ) : null}

      {showGeofenceSetup && geofenceSetupCenter ? (
        <GeofenceSetupSheet
          label="Safe Zone"
          centerLat={geofenceSetupCenter.lat}
          centerLng={geofenceSetupCenter.lng}
          busy={geofenceBusy}
          onClose={() => {
            setShowGeofenceSetup(false);
            setGeofenceSetupCenter(null);
          }}
          onConfirm={(radiusM, label) => void handleConfirmGeofence(radiusM, label)}
        />
      ) : null}
    </div>
  );
}
