"use client";

import { ConvoySheet } from "@/components/live/ConvoySheet";
import { DestinationSheet, searchPlaces, type NominatimPlace } from "@/components/live/DestinationSheet";
import { EmergencyContactsSheet } from "@/components/live/EmergencyContactsSheet";
import { GeofenceSetupSheet } from "@/components/live/GeofenceSetupSheet";
import { GroupLiveChatButton, GroupLiveChatSheet } from "@/components/live/GroupLiveChatSheet";
import { FamilyPanel } from "@/components/live/FamilyPanel";
import { ChatSlidePanel } from "@/components/live/ChatSlidePanel";
import { LiveControlRail, type LiveRailButtonId } from "@/components/live/LiveControlRail";
import { RightPanel, buildAlertItems, type WeatherDetail } from "@/components/live/RightPanel";
import { GuestPrompt } from "@/components/live/GuestPrompt";
import { NavigationSheet } from "@/components/live/NavigationSheet";
import { PoiDetailSheet, type PoiPlace } from "@/components/live/PoiDetailSheet";
import { PoiSearchSheet, type PoiCategory } from "@/components/live/PoiSearchSheet";
import { ReportSheet } from "@/components/live/ReportSheet";
import { ReportTypeSheet } from "@/components/live/ReportTypeSheet";
import { SOSConfirmSheet } from "@/components/live/SOSConfirmSheet";
import { DriverModeOverlay } from "@/components/live/DriverModeOverlay";
import { TripSummarySheet } from "@/components/live/TripSummarySheet";
import { WayraChatSheet } from "@/components/live/WayraChatSheet";
import { apiFetch, apiFetchPublic } from "@/lib/api";
import { toggleLounge } from "@/lib/open-lounge";
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
  createSpeedCameraMarker,
  formatDistance,
  haversineMeters,
  minutesAgo,
  type LiveWeather,
  type CameraAlertItem,
  type NearbyTraveler,
  type ReportType,
  type RoadReport,
  type RouteAlertItem,
  type SpeedCameraItem,
  type TrafficDensityPoint,
} from "@/lib/live/types";
import {
  cancelSpeech,
  isVoiceMuted,
  setVoiceMuted,
  speakWayra,
} from "@/lib/live/wayra-voice";
import {
  distanceToRouteLine,
  formatETA,
  routeBounds,
  type Destination,
  type RouteData,
} from "@/lib/live/navigation";
import type { TripTrack } from "@/lib/live/track";
import type { SpectatorActiveCount, SpectatorInviteResponse } from "@/lib/live/spectator";
import {
  AlertCircle,
  ChevronLeft,
  Eye,
  Loader2,
  MapPin,
  Search,
  Share2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import maplibregl, { type StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { off, onValue, ref, remove, set, type Database } from "firebase/database";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const OSM_MAX_ZOOM = 19;

const OSM_STYLE_LIGHT: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: OSM_MAX_ZOOM,
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
      maxzoom: OSM_MAX_ZOOM,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [
    {
      id: "osm-dark",
      type: "raster",
      source: "osm",
      paint: {
        "raster-brightness-min": 0.0,
        "raster-brightness-max": 0.22,
        "raster-saturation": -1.0,
        "raster-contrast": 0.4,
        "raster-opacity": 1.0,
      },
    },
  ],
};

const OSM_STYLE_TERRAIN = OSM_STYLE_LIGHT;
// TODO: wire real terrain tiles when ready

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
  setLabel: (label: string) => void;
};

type TravelerMarkerEntry = {
  marker: maplibregl.Marker;
  setBearing: (bearing: number | null) => void;
  setLabel: (label: string) => void;
};

type SafetyBanner = {
  message: string;
  tone: "amber" | "red";
};

type WayraAlert = {
  alert_type: string;
  message: string;
  severity: "info" | "warning" | "danger";
  action?: string | null;
};

type HazardBanner = {
  report: RoadReport;
  distanceM: number;
};

type SheetHeight = "peek" | "half" | "full";
type SheetTab = "reports" | "route_chat" | "group" | "travelers";
type MapStyleMode = "auto" | "light" | "dark" | "terrain";

const SHEET_TRANSLATE: Record<SheetHeight, string> = {
  peek: "translateY(calc(100% - 110px))",
  half: "translateY(45%)",
  full: "translateY(0)",
};

type ExtendedWeather = LiveWeather & {
  temperature_2m?: number;
};

type PinOut = {
  id: string;
  latitude: number;
  longitude: number;
  name: string;
  note: string | null;
};

function createMemberMarker(color: string, label: string): {
  element: HTMLDivElement;
  setBearing: (bearing: number | null) => void;
  setOpacity: (opacity: number) => void;
  setLowBattery: (show: boolean) => void;
  setLabel: (label: string) => void;
} {
  const root = document.createElement("div");
  root.className = "live-member-marker";
  root.setAttribute("role", "button");
  root.tabIndex = 0;
  root.setAttribute("aria-label", `${label} — live location`);
  root.title = label;

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

  const setLabel = (nextLabel: string) => {
    name.textContent = nextLabel;
    root.setAttribute("aria-label", `${nextLabel} — live location`);
    root.title = nextLabel;
  };

  return { element: root, setBearing, setOpacity, setLowBattery, setLabel };
}

function createTravelerMarker(
  travelerId: string,
  label: string,
  onTap: (id: string) => void,
): {
  element: HTMLButtonElement;
  setBearing: (bearing: number | null) => void;
  setLabel: (label: string) => void;
} {
  const root = document.createElement("button");
  root.type = "button";
  root.className = "live-traveler-marker";
  root.setAttribute("aria-label", `${label} — nearby traveler`);
  root.title = label;
  root.addEventListener("click", (event) => {
    event.stopPropagation();
    onTap(travelerId);
  });

  const cone = document.createElement("div");
  cone.className = "live-traveler-cone is-hidden";

  const dot = document.createElement("div");
  dot.className = "live-traveler-dot";

  const name = document.createElement("div");
  name.className = "live-traveler-label";
  name.textContent = label;

  root.appendChild(cone);
  root.appendChild(dot);
  root.appendChild(name);

  const setBearing = (bearing: number | null) => {
    if (bearing == null || Number.isNaN(bearing)) {
      cone.classList.add("is-hidden");
      return;
    }
    cone.classList.remove("is-hidden");
    cone.style.transform = `translateX(-50%) rotate(${bearing}deg)`;
  };

  const setLabel = (nextLabel: string) => {
    name.textContent = nextLabel;
    root.setAttribute("aria-label", `${nextLabel} — nearby traveler`);
    root.title = nextLabel;
  };

  return { element: root, setBearing, setLabel };
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
  root.setAttribute("aria-label", "You — live location");
  root.title = "You";

  const cone = document.createElement("div");
  cone.className = "live-user-cone is-hidden";

  const pulse = document.createElement("div");
  pulse.className = "live-user-pulse";

  const dot = document.createElement("div");
  dot.className = "live-user-dot";

  const name = document.createElement("div");
  name.className = "live-user-label";
  name.textContent = "You";

  root.appendChild(cone);
  root.appendChild(pulse);
  root.appendChild(dot);
  root.appendChild(name);

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
  const replaySessionId = searchParams.get("replay_session");
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
  const travelerMarkersRef = useRef<Map<string, TravelerMarkerEntry>>(new Map());
  const meetingPointMarkerRef = useRef<maplibregl.Marker | null>(null);
  const firebaseDbRef = useRef<Database | null>(null);
  const groupModeRef = useRef(false);
  const memberLiveRef = useRef<Record<string, MemberLiveData>>({});
  const memberStatusesRef = useRef<Record<string, QuickStatus>>({});
  const meetingPointRef = useRef<MeetingPoint | null>(null);
  const convoyRef = useRef<ConvoyData | null>(null);
  const meetingArrivalSentRef = useRef(false);
  const meetingNavTargetRef = useRef<string | null>(null);
  const convoyEndedSeenRef = useRef(false);
  const isGroupAdminRef = useRef(false);
  const tripMembersRef = useRef<TripMember[]>([]);
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
  const wayraAlertTimerRef = useRef<number | null>(null);
  const routeAlertTimerRef = useRef<number | null>(null);
  const cameraAlertTimerRef = useRef<number | null>(null);
  const spokenRouteAlertsRef = useRef<Set<string>>(new Set());
  const spokenCameraAlertsRef = useRef<Set<string>>(new Set());
  const cameraMarkersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const speedOverspeedSpokenRef = useRef(false);
  const continuousListeningActive = useRef(false);
  const continuousRecognitionRef = useRef<{ start: () => void; stop: () => void } | null>(
    null,
  );
  const helpAlertSpokenRef = useRef<Set<string>>(new Set());
  const nearbyTravelersRef = useRef<NearbyTraveler[]>([]);
  const speedCamerasRef = useRef<SpeedCameraItem[]>([]);
  const driverModeRef = useRef(false);
  const prevDriverModeRef = useRef(false);
  const driverRecognitionRef = useRef<{ stop: () => void } | null>(null);
  const currentLatRef = useRef<number | null>(null);
  const currentLngRef = useRef<number | null>(null);
  const currentSpeedRef = useRef(0);
  const currentBearingRef = useRef<number | null>(null);
  const trackRecordingRef = useRef<number | null>(null);
  const trackEndedRef = useRef(false);
  const reportsEncounteredRef = useRef(0);
  const camerasPassedRef = useRef(0);
  const cameraAlertsCountedRef = useRef<Set<string>>(new Set());
  const roadNameRef = useRef<string | null>(null);

  const [isGuest, setIsGuest] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [gpsState, setGpsState] = useState<GpsPermissionState>("pending");
  const [speedMph, setSpeedMph] = useState(0);
  const [reports, setReports] = useState<RoadReport[]>([]);
  const [weather, setWeather] = useState<ExtendedWeather | null>(null);
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
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<NominatimPlace[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
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
  const [sheetHeight, setSheetHeight] = useState<SheetHeight>("peek");
  const [sheetTab, setSheetTab] = useState<SheetTab>("reports");
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapStyleMode, setMapStyleMode] = useState<MapStyleMode>("auto");
  const [activePanel, setActivePanel] = useState<LiveRailButtonId | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatTarget, setChatTarget] = useState<{
    id: string;
    label: string;
    type: "traveler" | "report";
  } | null>(null);
  const [weatherDetail, setWeatherDetail] = useState<WeatherDetail | null>(null);
  const [weatherDetailLoading, setWeatherDetailLoading] = useState(false);
  const [deviceBatteryLevel, setDeviceBatteryLevel] = useState<number | null>(null);
  const [savedPins, setSavedPins] = useState<PinOut[]>([]);
  const [pinsLoading, setPinsLoading] = useState(false);
  const [wayraListening, setWayraListening] = useState(false);
  const [sosBanner, setSosBanner] = useState(false);
  const [unreadLounge, setUnreadLounge] = useState(3);
  const [panelAnchorEl, setPanelAnchorEl] = useState<HTMLElement | null>(null);
  const railButtonRefs = useRef<Partial<Record<LiveRailButtonId, HTMLDivElement | null>>>({});
  const wayraRecognitionRef = useRef<{ stop: () => void } | null>(null);
  const sheetTouchStartYRef = useRef<number | null>(null);
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
  const [wayraAlert, setWayraAlert] = useState<WayraAlert | null>(null);
  const [wayraUnread, setWayraUnread] = useState(false);
  const [showWayraTooltip, setShowWayraTooltip] = useState(false);
  const [speedLimitMph, setSpeedLimitMph] = useState<number | null>(null);
  const [roadName, setRoadName] = useState<string | null>(null);
  const [activeSpectatorCount, setActiveSpectatorCount] = useState(0);
  const [routeAlert, setRouteAlert] = useState<RouteAlertItem | null>(null);
  const [speedCameras, setSpeedCameras] = useState<SpeedCameraItem[]>([]);
  const [cameraAlert, setCameraAlert] = useState<CameraAlertItem | null>(null);
  const [selectedCamera, setSelectedCamera] = useState<SpeedCameraItem | null>(null);
  const [nearbyTravelers, setNearbyTravelers] = useState<NearbyTraveler[]>([]);
  const [voiceMuted, setVoiceMutedState] = useState(false);
  const [continuousVoiceActive, setContinuousVoiceActive] = useState(false);
  const [driverMode, setDriverMode] = useState(false);
  const [driverModeBanner, setDriverModeBanner] = useState(false);
  const [distanceToNextTurn, setDistanceToNextTurn] = useState(0);
  const [driverWayraListening, setDriverWayraListening] = useState(false);
  const [summaryTrack, setSummaryTrack] = useState<TripTrack | null>(null);
  const [showTripSummary, setShowTripSummary] = useState(false);
  const [pendingNavigateAway, setPendingNavigateAway] = useState(false);
  const currentUserId = dashboardUser?.id ?? null;
  const currentUserName = dashboardUser?.full_name ?? "You";

  const validTripId =
    tripId &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      tripId,
    )
      ? tripId
      : null;

  openReportRef.current = (report: RoadReport) => setSelectedReport(report);

  useEffect(() => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("gt_token") : null;
    setIsGuest(!token);
  }, []);

  useEffect(() => {
    setShowWayraTooltip(true);
    const timer = window.setTimeout(() => setShowWayraTooltip(false), 3000);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    nearbyTravelersRef.current = nearbyTravelers;
  }, [nearbyTravelers]);

  useEffect(() => {
    speedCamerasRef.current = speedCameras;
  }, [speedCameras]);

  useEffect(() => {
    if (destination) {
      setSearchQuery(destination.name);
    } else {
      setSearchQuery("");
    }
  }, [destination]);

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      return;
    }

    if (destination && trimmed === destination.name) {
      setSearchResults([]);
      return;
    }

    const timer = window.setTimeout(() => {
      setSearchLoading(true);
      void searchPlaces(trimmed)
        .then(setSearchResults)
        .catch(() => setSearchResults([]))
        .finally(() => setSearchLoading(false));
    }, 400);

    return () => window.clearTimeout(timer);
  }, [searchQuery, destination]);

  const focusSearchInput = useCallback(() => {
    setTimeout(() => {
      searchInputRef.current?.focus();
      setShowSearchDropdown(true);
    }, 50);
  }, []);

  useEffect(() => {
    setVoiceMutedState(isVoiceMuted());
  }, []);

  useEffect(() => {
    if (!replaySessionId || isGuest) return;
    void (async () => {
      try {
        const track = await apiFetch<TripTrack>(`/live/track/${replaySessionId}`);
        if (track.track_points.length > 0) {
          setSummaryTrack(track);
          setShowTripSummary(true);
        }
      } catch {
        // Replay fetch is optional.
      }
    })();
  }, [isGuest, replaySessionId]);

  useEffect(() => {
    roadNameRef.current = roadName;
  }, [roadName]);

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
    isGroupAdminRef.current = isGroupAdmin;
  }, [isGroupAdmin]);

  useEffect(() => {
    tripMembersRef.current = tripMembers;
  }, [tripMembers]);

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
    driverModeRef.current = driverMode;
  }, [driverMode]);

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

  const shareSpectator = useCallback(async () => {
    if (isGuest || !sessionId) return;
    try {
      const data = await apiFetch<SpectatorInviteResponse>("/live/spectator/invite", {
        method: "POST",
      });
      const shareUrl = data.share_url;
      if (navigator.share) {
        await navigator.share({
          title: "Watch my live trip on Rovvy",
          text: "Follow along as I travel in real time!",
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        showToastMessage("Invite link copied!");
      }
    } catch {
      showToastMessage("Could not create spectator invite");
    }
  }, [isGuest, sessionId, showToastMessage]);

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

  const getMemberPositions = useCallback(() => {
    return tripMembers
      .map((member) => ({
        user_id: member.user_id,
        display_name: member.display_name,
        lat: memberLive[member.user_id]?.lat,
        lng: memberLive[member.user_id]?.lng,
        status: memberStatuses[member.user_id],
      }))
      .filter(
        (item): item is typeof item & { lat: number; lng: number } =>
          item.lat != null && item.lng != null,
      );
  }, [memberLive, memberStatuses, tripMembers]);

  const buildWayraContext = useCallback(() => {
    const pos = userPositionRef.current;
    return {
      lat: pos?.lat ?? null,
      lng: pos?.lng ?? null,
      speed_mph: speedMph,
      trip_id: validTripId,
      active_reports: reports.map((report) => report.report_type),
      weather_code: weather?.weathercode ?? null,
      members: tripMembers.map((member) => ({
        user_id: member.user_id,
        status: memberStatuses[member.user_id] ?? null,
      })),
      route_destination: destination?.name ?? null,
    };
  }, [
    destination?.name,
    reports,
    speedMph,
    tripMembers,
    memberStatuses,
    validTripId,
    weather?.weathercode,
  ]);

  const showWayraAlert = useCallback((alert: WayraAlert) => {
    setWayraAlert(alert);
    if (!showWayra) {
      setWayraUnread(true);
    }
    if (wayraAlertTimerRef.current != null) {
      window.clearTimeout(wayraAlertTimerRef.current);
      wayraAlertTimerRef.current = null;
    }
    if (alert.severity === "info") {
      wayraAlertTimerRef.current = window.setTimeout(() => {
        setWayraAlert(null);
        wayraAlertTimerRef.current = null;
      }, 8000);
    } else if (alert.severity === "warning") {
      wayraAlertTimerRef.current = window.setTimeout(() => {
        setWayraAlert(null);
        wayraAlertTimerRef.current = null;
      }, 12000);
    }
  }, [showWayra]);

  const openWayraChat = useCallback(() => {
    if (isGuest && guestWayraRemaining <= 0) {
      setGuestPrompt("Create free account for unlimited Wayra access");
      return;
    }
    setWayraUnread(false);
    setShowWayra(true);
  }, [guestWayraRemaining, isGuest]);

  const broadcastSoloLocation = useCallback(
    (lat: number, lng: number, bearing: number | null, speed: number) => {
      const db = firebaseDbRef.current;
      if (!currentUserId || !db) return;
      const locationRef = ref(db, `live_locations/${currentUserId}`);
      void set(locationRef, {
        lat,
        lng,
        bearing: bearing || 0,
        speed_mph: speed,
        road_name: roadNameRef.current,
        last_seen: new Date().toISOString(),
      });
    },
    [currentUserId],
  );

  const fetchSpeedLimit = useCallback(async (lat: number, lng: number) => {
    try {
      const params = new URLSearchParams({
        lat: lat.toString(),
        lng: lng.toString(),
      });
      const data = await apiFetch<{
        speed_limit_mph: number | null;
        road_name: string | null;
      }>(`/live/speed-limit?${params.toString()}`);
      setSpeedLimitMph(data.speed_limit_mph);
      setRoadName(data.road_name);
    } catch {
      // Speed limit overlay is optional.
    }
  }, []);

  const showRouteAlertBanner = useCallback((alert: RouteAlertItem) => {
    setRouteAlert(alert);
    if (routeAlertTimerRef.current != null) {
      window.clearTimeout(routeAlertTimerRef.current);
      routeAlertTimerRef.current = null;
    }
    if (!spokenRouteAlertsRef.current.has(alert.alert_id)) {
      spokenRouteAlertsRef.current.add(alert.alert_id);
      speakWayra(alert.message, alert.tier === "immediate" ? "urgent" : "normal");
    }
    if (alert.tier === "advance") {
      routeAlertTimerRef.current = window.setTimeout(() => {
        setRouteAlert(null);
        routeAlertTimerRef.current = null;
      }, 20_000);
    } else if (alert.tier === "soon") {
      routeAlertTimerRef.current = window.setTimeout(() => {
        setRouteAlert(null);
        routeAlertTimerRef.current = null;
      }, 15_000);
    }
  }, []);

  const showCameraAlertBanner = useCallback((alert: CameraAlertItem) => {
    setCameraAlert(alert);
    if (cameraAlertTimerRef.current != null) {
      window.clearTimeout(cameraAlertTimerRef.current);
      cameraAlertTimerRef.current = null;
    }
    const alertKey = `${alert.camera_id}:${alert.tier}`;
    if (!spokenCameraAlertsRef.current.has(alertKey)) {
      spokenCameraAlertsRef.current.add(alertKey);
      speakWayra(
        alert.message,
        alert.tier === "immediate" || alert.over_limit ? "urgent" : "normal",
      );
    }
    if (!cameraAlertsCountedRef.current.has(alert.camera_id)) {
      cameraAlertsCountedRef.current.add(alert.camera_id);
      camerasPassedRef.current += 1;
    }
    if (alert.tier === "advisory") {
      cameraAlertTimerRef.current = window.setTimeout(() => {
        setCameraAlert(null);
        cameraAlertTimerRef.current = null;
      }, 15_000);
    } else if (alert.tier === "warning") {
      cameraAlertTimerRef.current = window.setTimeout(() => {
        setCameraAlert(null);
        cameraAlertTimerRef.current = null;
      }, 10_000);
    }
  }, []);

  const syncCameraMarkers = useCallback((map: maplibregl.Map, cameras: SpeedCameraItem[]) => {
    const seen = new Set<string>();
    cameras.forEach((camera) => {
      seen.add(camera.camera_id);
      let marker = cameraMarkersRef.current.get(camera.camera_id);
      if (!marker) {
        const element = createSpeedCameraMarker(camera, (selected) => {
          setSelectedCamera(selected);
        });
        marker = new maplibregl.Marker({ element, anchor: "center" })
          .setLngLat([camera.lng, camera.lat])
          .addTo(map);
        cameraMarkersRef.current.set(camera.camera_id, marker);
      } else {
        marker.setLngLat([camera.lng, camera.lat]);
      }
    });
    cameraMarkersRef.current.forEach((marker, cameraId) => {
      if (!seen.has(cameraId)) {
        marker.remove();
        cameraMarkersRef.current.delete(cameraId);
      }
    });
  }, []);

  const fetchSpeedCameras = useCallback(async () => {
    const pos = userPositionRef.current;
    if (!pos) return;
    try {
      const params = new URLSearchParams({
        lat: pos.lat.toString(),
        lng: pos.lng.toString(),
        radius_m: "5000",
      });
      const data = await apiFetch<{ cameras: SpeedCameraItem[] }>(
        `/live/speed-cameras?${params.toString()}`,
      );
      setSpeedCameras(data.cameras);
      const map = mapRef.current;
      if (map) {
        syncCameraMarkers(map, data.cameras);
      }
    } catch {
      // Speed camera pins are optional.
    }
  }, [syncCameraMarkers]);

  const fetchCameraRouteAlert = useCallback(async () => {
    const pos = userPositionRef.current;
    if (!pos) return;
    try {
      const params = new URLSearchParams({
        lat: pos.lat.toString(),
        lng: pos.lng.toString(),
        bearing: String(bearingRef.current ?? 0),
        speed_mph: speedMph.toString(),
        radius_m: "5000",
      });
      const data = await apiFetch<{
        camera_id: string | null;
        tier: CameraAlertItem["tier"] | null;
        distance_miles: number | null;
        max_speed_mph: number | null;
        over_limit: boolean;
        message: string | null;
        lat: number | null;
        lng: number | null;
      }>(`/live/speed-cameras/route-alert?${params.toString()}`);
      if (
        data.camera_id &&
        data.message &&
        data.tier &&
        data.lat != null &&
        data.lng != null
      ) {
        showCameraAlertBanner({
          camera_id: data.camera_id,
          tier: data.tier,
          distance_miles: data.distance_miles ?? 0,
          max_speed_mph: data.max_speed_mph,
          over_limit: data.over_limit,
          message: data.message,
          lat: data.lat,
          lng: data.lng,
        });
      } else {
        setCameraAlert(null);
      }
    } catch {
      // Camera route alerts are optional.
    }
  }, [showCameraAlertBanner, speedMph]);

  const fetchRouteAlerts = useCallback(async () => {
    const pos = userPositionRef.current;
    if (!pos) return;
    try {
      const params = new URLSearchParams({
        lat: pos.lat.toString(),
        lng: pos.lng.toString(),
        bearing: String(bearingRef.current ?? 0),
        speed_mph: speedMph.toString(),
      });
      const data = await apiFetch<{ alerts: RouteAlertItem[] }>(
        `/live/route-alerts?${params.toString()}`,
      );
      const priority = { immediate: 0, soon: 1, advance: 2 };
      const next = [...data.alerts].sort(
        (a, b) =>
          priority[a.tier] - priority[b.tier] || a.distance_miles - b.distance_miles,
      )[0];
      if (next) {
        showRouteAlertBanner(next);
      } else {
        setRouteAlert(null);
      }
    } catch {
      // Route alerts are optional.
    }
  }, [showRouteAlertBanner, speedMph]);

  const updateTravelerDots = useCallback((travelers: NearbyTraveler[]) => {
    const map = mapRef.current;
    if (!map || isGuest) return;

    const seen = new Set<string>();
    travelers.forEach((traveler) => {
      seen.add(traveler.traveler_id);
      let entry = travelerMarkersRef.current.get(traveler.traveler_id);
      if (!entry) {
        const { element, setBearing, setLabel } = createTravelerMarker(
          traveler.traveler_id,
          traveler.label,
          (travelerId) => {
            const match = nearbyTravelersRef.current.find(
              (item) => item.traveler_id === travelerId,
            );
            if (match) {
              setActivePanel(null);
              setChatTarget({
                id: match.traveler_id,
                label: match.label,
                type: "traveler",
              });
              setChatOpen(true);
            }
          },
        );
        const marker = new maplibregl.Marker({ element, anchor: "center" })
          .setLngLat([traveler.lng, traveler.lat])
          .addTo(map);
        entry = { marker, setBearing, setLabel };
        travelerMarkersRef.current.set(traveler.traveler_id, entry);
      } else {
        entry.marker.setLngLat([traveler.lng, traveler.lat]);
        entry.setLabel(traveler.label);
      }
      entry.setBearing(
        traveler.bearing != null && !Number.isNaN(traveler.bearing)
          ? traveler.bearing
          : null,
      );
    });

    travelerMarkersRef.current.forEach((entry, travelerId) => {
      if (!seen.has(travelerId)) {
        entry.marker.remove();
        travelerMarkersRef.current.delete(travelerId);
      }
    });
  }, [isGuest]);

  const fetchNearbyTravelers = useCallback(async () => {
    const pos = userPositionRef.current;
    if (!pos || isGuest) return;
    try {
      const data = await apiFetch<NearbyTraveler[]>("/live/travelers/nearby", {
        method: "POST",
        body: JSON.stringify({
          lat: pos.lat,
          lng: pos.lng,
          bearing: bearingRef.current ?? 0,
          speed_mph: speedMph,
        }),
      });
      setNearbyTravelers(data);
      updateTravelerDots(data);
    } catch {
      // Traveler dots are optional.
    }
  }, [isGuest, speedMph, updateTravelerDots]);

  const toggleVoiceMute = useCallback(() => {
    const next = !isVoiceMuted();
    setVoiceMuted(next);
    setVoiceMutedState(next);
    if (next) cancelSpeech();
  }, []);

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
        const memberLabel = member.display_name?.trim() || "Trip member";
        if (!entry) {
          const { element, setBearing, setOpacity, setLowBattery, setLabel } =
            createMemberMarker(color, memberLabel);
          const marker = new maplibregl.Marker({ element, anchor: "center" })
            .setLngLat([live.lng, live.lat])
            .addTo(map);
          entry = { marker, setBearing, setOpacity, setLowBattery, setLabel };
          memberMarkersRef.current.set(member.user_id, entry);
        } else {
          entry.marker.setLngLat([live.lng, live.lat]);
          entry.setLabel(memberLabel);
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
    const hasChanges = Object.entries(next).some(
      ([userId, status]) => memberStatusesRef.current[userId] !== status,
    );
    const merged = hasChanges
      ? { ...memberStatusesRef.current, ...next }
      : memberStatusesRef.current;
    if (hasChanges) {
      memberStatusesRef.current = merged;
      setMemberStatuses(merged);
    }
    if (!isGroupAdminRef.current || tripMembersRef.current.length === 0) return;
    const allArrived = tripMembersRef.current.every(
      (member) => merged[member.user_id] === "at_the_spot",
    );
    setEveryoneArrivedBanner((prev) => (prev === allArrived ? prev : allArrived));
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
    const destName = destinationRef.current?.name;
    clearNavigation();
    setArrivalBanner(true);
    if (destName) {
      speakWayra(`You have arrived at ${destName}.`, "normal");
    }
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
        setDistanceToNextTurn(distToStep);
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
      setShowSearchDropdown(false);
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
        if (!currentUserId) return;
        const merged = {
          ...memberStatusesRef.current,
          [currentUserId]: result.status,
        };
        if (memberStatusesRef.current[currentUserId] === result.status) return;
        memberStatusesRef.current = merged;
        setMemberStatuses(merged);
        if (isGroupAdminRef.current && tripMembersRef.current.length > 0) {
          const allArrived = tripMembersRef.current.every(
            (member) => merged[member.user_id] === "at_the_spot",
          );
          setEveryoneArrivedBanner((prev) => (prev === allArrived ? prev : allArrived));
        }
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
      setSosBanner(true);
      window.setTimeout(() => setSosBanner(false), 5000);
      speakWayra("SOS activated. Sending alerts to your group.", "urgent");
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

  const handleWayraAction = useCallback(
    (action: "open_poi_search" | "open_navigation" | "call_sos") => {
      if (action === "open_poi_search") {
        setShowPoiSearch(true);
        return;
      }
      if (action === "open_navigation") {
        focusSearchInput();
        return;
      }
      void triggerSOS();
    },
    [triggerSOS],
  );

  const sendToWayra = useCallback(
    async (command: string) => {
      if (isGuest) return;
      try {
        const result = await apiFetch<{ reply: string; action?: string | null }>(
          "/live/wayra",
          {
            method: "POST",
            body: JSON.stringify({
              message: command,
              context: buildWayraContext(),
            }),
          },
        );
        speakWayra(result.reply);
        if (result.action === "open_poi_search") {
          setShowPoiSearch(true);
        } else if (result.action === "open_navigation") {
          focusSearchInput();
        } else if (result.action === "call_sos") {
          void triggerSOS();
        }
      } catch {
        // Voice command fallback is silent.
      }
    },
    [buildWayraContext, isGuest, triggerSOS],
  );

  const sendToWayraRef = useRef(sendToWayra);
  sendToWayraRef.current = sendToWayra;
  const openWayraChatRef = useRef(openWayraChat);
  openWayraChatRef.current = openWayraChat;

  const handleDriverModeWayra = useCallback(() => {
    if (isGuest || driverWayraListening) return;

    type SpeechRecognitionCtor = new () => {
      continuous: boolean;
      interimResults: boolean;
      lang: string;
      onresult:
        | ((event: {
            results: { length: number; [index: number]: { 0: { transcript: string } } };
          }) => void)
        | null;
      onend: (() => void) | null;
      onerror: (() => void) | null;
      start: () => void;
      stop: () => void;
    };

    const windowWithSpeech = window as Window & {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const SpeechRecognition =
      windowWithSpeech.SpeechRecognition || windowWithSpeech.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    continuousListeningActive.current = false;
    continuousRecognitionRef.current?.stop();

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim() ?? "";
      if (transcript) {
        void sendToWayra(transcript);
      }
    };

    recognition.onerror = () => {
      setDriverWayraListening(false);
      driverRecognitionRef.current = null;
    };

    recognition.onend = () => {
      setDriverWayraListening(false);
      driverRecognitionRef.current = null;
      if (driverModeRef.current) {
        continuousListeningActive.current = true;
        try {
          continuousRecognitionRef.current?.start();
          setContinuousVoiceActive(true);
        } catch {
          // Mic may be unavailable.
        }
      }
    };

    driverRecognitionRef.current = recognition;
    setDriverWayraListening(true);
    recognition.start();
  }, [driverWayraListening, isGuest, sendToWayra]);

  const stopWayraIfListening = useCallback(() => {
    wayraRecognitionRef.current?.stop();
    wayraRecognitionRef.current = null;
    setWayraListening(false);
  }, []);

  const closeActivePanel = useCallback(() => {
    setActivePanel((prev) => {
      if (prev === "wayra") stopWayraIfListening();
      return null;
    });
  }, [stopWayraIfListening]);

  useEffect(() => {
    if (!activePanel) {
      setPanelAnchorEl(null);
      return;
    }
    let cancelled = false;
    const resolveAnchor = () => {
      if (cancelled) return;
      const el = railButtonRefs.current[activePanel] ?? null;
      if (el) {
        setPanelAnchorEl(el);
        return;
      }
      requestAnimationFrame(resolveAnchor);
    };
    requestAnimationFrame(resolveAnchor);
    return () => {
      cancelled = true;
    };
  }, [activePanel, mapLoaded]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (chatOpen) {
        setChatOpen(false);
        setChatTarget(null);
        return;
      }
      if (activePanel) closeActivePanel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activePanel, chatOpen, closeActivePanel]);

  const toggleVoiceListening = useCallback(() => {
    if (isGuest) {
      setGuestPrompt("Create free account for unlimited Wayra access");
      return;
    }

    if (wayraListening) {
      wayraRecognitionRef.current?.stop();
      wayraRecognitionRef.current = null;
      setWayraListening(false);
      return;
    }

    type SpeechRecognitionCtor = new () => {
      continuous: boolean;
      interimResults: boolean;
      lang: string;
      onresult:
        | ((event: {
            results: { length: number; [index: number]: { 0: { transcript: string } } };
          }) => void)
        | null;
      onend: (() => void) | null;
      onerror: (() => void) | null;
      start: () => void;
      stop: () => void;
    };

    const windowWithSpeech = window as Window & {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const SpeechRecognition =
      windowWithSpeech.SpeechRecognition || windowWithSpeech.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    continuousListeningActive.current = false;
    continuousRecognitionRef.current?.stop();

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim() ?? "";
      if (transcript) {
        void sendToWayra(transcript);
      }
    };

    recognition.onerror = () => {
      setWayraListening(false);
      wayraRecognitionRef.current = null;
    };

    recognition.onend = () => {
      setWayraListening(false);
      wayraRecognitionRef.current = null;
    };

    wayraRecognitionRef.current = recognition;
    setWayraListening(true);
    recognition.start();
  }, [isGuest, sendToWayra, wayraListening]);

  const handleToolbarTap = useCallback(
    (id: LiveRailButtonId) => {
      if (id === "battery") return;

      if (id === "lounge") {
        toggleLounge();
        setUnreadLounge(0);
        setChatOpen(false);
        setChatTarget(null);
        return;
      }

      let openingWayra = false;

      setActivePanel((prev) => {
        const next = prev === id ? null : id;
        if (prev === "wayra" && next !== "wayra") {
          stopWayraIfListening();
        } else if (id === "wayra" && next === "wayra" && prev !== "wayra") {
          openingWayra = true;
        }
        return next;
      });

      if (openingWayra) toggleVoiceListening();

      setChatOpen(false);
      setChatTarget(null);
    },
    [stopWayraIfListening, toggleVoiceListening],
  );

  const handleClearAlerts = useCallback(() => {
    setRouteAlert(null);
    setCameraAlert(null);
    setWayraAlert(null);
    setHazardBanner(null);
  }, []);

  const openTravelerChat = useCallback((traveler: NearbyTraveler) => {
    setActivePanel(null);
    setChatTarget({
      id: traveler.traveler_id,
      label: traveler.label,
      type: "traveler",
    });
    setChatOpen(true);
  }, []);

  const openReportChat = useCallback((report: RoadReport) => {
    setActivePanel(null);
    const config = REPORT_CONFIG[report.report_type];
    setChatTarget({
      id: report.id,
      label: `Report chat · ${config.label}`,
      type: "report",
    });
    setChatOpen(true);
  }, []);

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
      setMemberLive((prev) => {
        const prevKeys = Object.keys(prev);
        const nextKeys = Object.keys(data);
        if (
          prevKeys.length === nextKeys.length &&
          prevKeys.every((key) => key in data)
        ) {
          let unchanged = true;
          for (const userId of nextKeys) {
            const before = prev[userId];
            const after = data[userId];
            if (
              !before ||
              before.lat !== after.lat ||
              before.lng !== after.lng ||
              before.last_seen !== after.last_seen ||
              before.status !== after.status ||
              before.speed_mph !== after.speed_mph ||
              before.bearing !== after.bearing
            ) {
              unchanged = false;
              break;
            }
          }
          if (unchanged) return prev;
        }
        return data;
      });
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
    if (isGuest) return;
    const pos = userPositionRef.current;
    if (pos) {
      void fetchSpeedLimit(pos.lat, pos.lng);
      void fetchRouteAlerts();
      void fetchSpeedCameras();
      void fetchCameraRouteAlert();
      void fetchNearbyTravelers();
    }
    const interval = window.setInterval(() => {
      const current = userPositionRef.current;
      if (!current) return;
      void fetchSpeedLimit(current.lat, current.lng);
      void fetchRouteAlerts();
      void fetchSpeedCameras();
      void fetchCameraRouteAlert();
      void fetchNearbyTravelers();
    }, 30_000);
    return () => window.clearInterval(interval);
  }, [
    fetchCameraRouteAlert,
    fetchNearbyTravelers,
    fetchRouteAlerts,
    fetchSpeedCameras,
    fetchSpeedLimit,
    isGuest,
  ]);

  useEffect(() => {
    if (!speedLimitMph || speedMph <= speedLimitMph) {
      speedOverspeedSpokenRef.current = false;
      return;
    }
    if (!speedOverspeedSpokenRef.current) {
      speakWayra(`Speed advisory. Limit is ${speedLimitMph} miles per hour.`);
      speedOverspeedSpokenRef.current = true;
    }
  }, [speedLimitMph, speedMph]);

  useEffect(() => {
    if (!groupMode) return;
    tripMembers.forEach((member) => {
      if (
        memberStatuses[member.user_id] === "need_help" &&
        !helpAlertSpokenRef.current.has(member.user_id)
      ) {
        helpAlertSpokenRef.current.add(member.user_id);
        speakWayra(`Alert. ${firstName(member.display_name)} needs help.`, "urgent");
      }
      if (memberStatuses[member.user_id] !== "need_help") {
        helpAlertSpokenRef.current.delete(member.user_id);
      }
    });
  }, [groupMode, memberStatuses, tripMembers]);

  useEffect(() => {
    if (isGuest || gpsState !== "granted") return;

    type SpeechRecognitionCtor = new () => {
      continuous: boolean;
      interimResults: boolean;
      lang: string;
      onresult: ((event: { results: { length: number; [index: number]: { 0: { transcript: string } } } }) => void) | null;
      onend: (() => void) | null;
      start: () => void;
      stop: () => void;
    };

    const windowWithSpeech = window as Window & {
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const SpeechRecognition = windowWithSpeech.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      const transcript = event.results[event.results.length - 1][0].transcript
        .toLowerCase()
        .trim();
      if (transcript.includes("wayra") || transcript.includes("hey rovvy")) {
        const command = transcript
          .replace(/hey wayra|wayra|hey rovvy/gi, "")
          .trim();
        if (command.length > 2) {
          void sendToWayraRef.current(command);
          speakWayra("Got it.");
        } else {
          speakWayra("Yes? What do you need?");
          openWayraChatRef.current();
        }
      }
    };

    recognition.onend = () => {
      setContinuousVoiceActive(false);
      if (continuousListeningActive.current) {
        try {
          recognition.start();
          setContinuousVoiceActive(true);
        } catch {
          // Mic may be unavailable.
        }
      }
    };

    try {
      continuousListeningActive.current = true;
      recognition.start();
      setContinuousVoiceActive(true);
      continuousRecognitionRef.current = recognition;
    } catch {
      // Mic permission denied — skip silently.
    }

    return () => {
      continuousListeningActive.current = false;
      recognition.stop();
      continuousRecognitionRef.current = null;
      setContinuousVoiceActive(false);
    };
  }, [gpsState, isGuest]);

  useEffect(() => {
    const map = mapRef.current;
    const wasActive = prevDriverModeRef.current;
    prevDriverModeRef.current = driverMode;
    if (!map) return;

    if (driverMode && !wasActive) {
      map.dragPan.disable();
      map.scrollZoom.disable();
      map.touchZoomRotate.disable();
      map.setPitch(45);
      map.setZoom(16);
      const pos = userPositionRef.current;
      const bearing = bearingRef.current ?? 0;
      if (pos) {
        map.easeTo({
          center: [pos.lng, pos.lat],
          bearing,
          pitch: 45,
          zoom: 16,
        });
      }
      speakWayra(
        "Driver mode on. Stay focused on the road. Say Hey Wayra for assistance.",
      );
      setDriverModeBanner(true);
      const bannerTimer = window.setTimeout(() => setDriverModeBanner(false), 3000);
      continuousListeningActive.current = true;
      try {
        continuousRecognitionRef.current?.start();
        setContinuousVoiceActive(true);
      } catch {
        // Mic may be unavailable.
      }
      return () => window.clearTimeout(bannerTimer);
    }

    if (!driverMode && wasActive) {
      map.dragPan.enable();
      map.scrollZoom.enable();
      map.touchZoomRotate.enable();
      cancelSpeech();
      speakWayra("Driver mode off.");
      const pos = userPositionRef.current;
      map.easeTo({
        center: pos ? [pos.lng, pos.lat] : map.getCenter(),
        bearing: 0,
        pitch: 0,
        zoom: 14,
        duration: 800,
      });
      driverRecognitionRef.current?.stop();
      setDriverWayraListening(false);
      return;
    }

    if (driverMode) {
      map.dragPan.disable();
      map.scrollZoom.disable();
      map.touchZoomRotate.disable();
    }
  }, [driverMode]);

  useEffect(() => {
    if (!driverMode) return;

    let wakeLock: WakeLockSentinel | null = null;

    const requestWakeLock = async () => {
      try {
        if ("wakeLock" in navigator) {
          wakeLock = await navigator.wakeLock.request("screen");
        }
      } catch {
        // Silent fail — not all browsers support this.
      }
    };

    void requestWakeLock();

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void requestWakeLock();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      void wakeLock?.release();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [driverMode]);

  useEffect(() => {
    if (isGuest) return;

    const runAnalyze = async () => {
      const pos = userPositionRef.current;
      if (!pos) return;

      try {
        const data = await apiFetch<{
          alert_type: string | null;
          message: string | null;
          severity?: "info" | "warning" | "danger";
          action?: string | null;
        }>("/live/wayra/analyze", {
          method: "POST",
          body: JSON.stringify({
            lat: pos.lat,
            lng: pos.lng,
            speed_mph: speedMph,
            trip_id: validTripId,
            member_positions: groupMode ? getMemberPositions() : null,
            active_reports: reports.map((report) => report.report_type),
            nearby_reports: reports.map((report) => ({
              lat: report.lat,
              lng: report.lng,
              report_type: report.report_type,
            })),
            weather_code: weather?.weathercode ?? null,
            route_geometry: route?.geometry ?? null,
          }),
        });

        if (data.alert_type && data.message && data.severity) {
          showWayraAlert({
            alert_type: data.alert_type,
            message: data.message,
            severity: data.severity,
            action: data.action,
          });
        }
      } catch {
        // Proactive alerts are optional.
      }
    };

    void runAnalyze();
    const interval = window.setInterval(() => {
      void runAnalyze();
    }, 120_000);

    return () => window.clearInterval(interval);
  }, [
    getMemberPositions,
    groupMode,
    isGuest,
    reports,
    route?.geometry,
    showWayraAlert,
    speedMph,
    validTripId,
    weather?.weathercode,
  ]);

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
      if (!meetingPoint) {
        meetingArrivalSentRef.current = false;
        meetingNavTargetRef.current = null;
      }
      return;
    }
    const pos = userPositionRef.current;
    if (!pos || navigationActiveRef.current) return;

    const targetKey = `${meetingPoint.lat},${meetingPoint.lng},${meetingPoint.label}`;
    if (meetingNavTargetRef.current === targetKey) return;
    meetingNavTargetRef.current = targetKey;

    const dest = {
      lat: meetingPoint.lat,
      lng: meetingPoint.lng,
      name: meetingPoint.label,
    };
    setDestination((prev) =>
      prev?.lat === dest.lat && prev?.lng === dest.lng && prev?.name === dest.name
        ? prev
        : dest,
    );
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
      const banner = `Convoy active · Following ${firstName(leader?.display_name ?? "leader")} to ${convoy.destination_name}`;
      setConvoyBanner((prev) => (prev === banner ? prev : banner));
    } else {
      setConvoyBanner((prev) => (prev === null ? prev : null));
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
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,precipitation,weathercode,windspeed_10m&temperature_unit=fahrenheit&timezone=auto`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data = (await res.json()) as {
        current?: ExtendedWeather;
      };
      if (data.current) setWeather(data.current);
    } catch {
      // Weather is optional.
    }
  }, []);

  const fetchWeatherDetail = useCallback(async (lat: number, lng: number) => {
    setWeatherDetailLoading(true);
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weathercode,windspeed_10m&temperature_unit=fahrenheit&windspeed_unit=mph&timezone=auto`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data = (await res.json()) as { current?: WeatherDetail };
      if (data.current) setWeatherDetail(data.current);
    } catch {
      // Weather detail is optional.
    } finally {
      setWeatherDetailLoading(false);
    }
  }, []);

  const fetchSavedPins = useCallback(async () => {
    if (isGuest) return;
    setPinsLoading(true);
    try {
      const data = await apiFetch<PinOut[]>("/pins");
      setSavedPins(data);
    } catch {
      // Pins are optional.
    } finally {
      setPinsLoading(false);
    }
  }, [isGuest]);

  const handleNavigateToPin = useCallback(
    (pin: PinOut) => {
      void handleDestinationSelect({
        lat: pin.latitude,
        lng: pin.longitude,
        name: pin.name,
      });
      setActivePanel(null);
    },
    [handleDestinationSelect],
  );

  const handleSaveCurrentLocation = useCallback(async () => {
    const pos = userPositionRef.current;
    if (!pos || isGuest) return;
    try {
      await apiFetch("/pins", {
        method: "POST",
        body: JSON.stringify({
          latitude: pos.lat,
          longitude: pos.lng,
          name: "Current location",
          note: roadNameRef.current ?? null,
          flag_type: "saved",
        }),
      });
      void fetchSavedPins();
      showToastMessage("Location saved");
    } catch {
      showToastMessage("Could not save location");
    }
  }, [fetchSavedPins, isGuest, showToastMessage]);

  const startTrackRecording = useCallback((activeSessionId: string) => {
    if (trackRecordingRef.current != null) return;
    trackRecordingRef.current = window.setInterval(() => {
      const lat = currentLatRef.current;
      const lng = currentLngRef.current;
      if (lat == null || lng == null) return;
      void apiFetch("/live/track/point", {
        method: "POST",
        body: JSON.stringify({
          session_id: activeSessionId,
          lat,
          lng,
          speed_mph: currentSpeedRef.current,
          bearing: currentBearingRef.current || 0,
          ts: new Date().toISOString(),
        }),
      }).catch(() => {
        // Track recording is best-effort.
      });
    }, 10_000);
  }, []);

  const endTrackRecording = useCallback(async (activeSessionId: string) => {
    if (trackEndedRef.current) return null;
    trackEndedRef.current = true;
    if (trackRecordingRef.current != null) {
      window.clearInterval(trackRecordingRef.current);
      trackRecordingRef.current = null;
    }
    try {
      return await apiFetch<TripTrack>("/live/track/end", {
        method: "POST",
        body: JSON.stringify({
          session_id: activeSessionId,
          reports_encountered: reportsEncounteredRef.current,
          cameras_passed: camerasPassedRef.current,
        }),
      });
    } catch {
      return null;
    }
  }, []);

  const handleLeaveLive = useCallback(async () => {
    const id = sessionIdRef.current;
    if (id && !isGuest) {
      const ended = await endTrackRecording(id);
      let track = ended;
      if (!track) {
        try {
          track = await apiFetch<TripTrack>(`/live/track/${id}`);
        } catch {
          track = null;
        }
      }
      if (track && track.track_points.length > 5) {
        setSummaryTrack(track);
        setShowTripSummary(true);
        setPendingNavigateAway(true);
        return;
      }
    }
    router.back();
  }, [endTrackRecording, isGuest, router]);

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
      startTrackRecording(session.id);
    } catch {
      sessionStartedRef.current = false;
    }
  }, [startTrackRecording, tripId]);

  useEffect(() => {
    if (isGuest || !sessionId) {
      setActiveSpectatorCount((prev) => (prev === 0 ? prev : 0));
      return;
    }

    let active = true;
    const fetchCount = async () => {
      try {
        const data = await apiFetch<SpectatorActiveCount>(
          `/live/spectator/active-count/${sessionId}`,
        );
        if (active) setActiveSpectatorCount(data.count);
      } catch {
        if (active) setActiveSpectatorCount(0);
      }
    };

    void fetchCount();
    const interval = window.setInterval(() => {
      void fetchCount();
    }, 30_000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [isGuest, sessionId]);

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
      setHazardBanner((prev) => (prev === null ? prev : null));
      return;
    }
    setHazardBanner((prev) =>
      prev?.report.id === hazard.report.id && prev.distanceM === hazard.distanceM
        ? prev
        : hazard,
    );
    if (hazardTimerRef.current != null) {
      window.clearTimeout(hazardTimerRef.current);
    }
    hazardTimerRef.current = window.setTimeout(() => {
      setHazardBanner(null);
      hazardTimerRef.current = null;
    }, HAZARD_BANNER_MS);
  }, []);

  const applyMapStyle = useCallback((map: maplibregl.Map) => {
    const { lat, lng } = sunCoordsRef.current;
    let style: StyleSpecification = OSM_STYLE_LIGHT;
    if (mapStyleMode === "terrain") style = OSM_STYLE_TERRAIN;
    else if (mapStyleMode === "dark") style = OSM_STYLE_DARK;
    else if (mapStyleMode === "light") style = OSM_STYLE_LIGHT;
    else style = isNightMode(lat, lng) ? OSM_STYLE_DARK : OSM_STYLE_LIGHT;
    map.setStyle(style);
    isDarkRef.current = style === OSM_STYLE_DARK;
  }, [mapStyleMode]);

  const cycleMapStyle = useCallback(() => {
    const { lat, lng } = sunCoordsRef.current;
    setMapStyleMode((mode) => {
      const effective =
        mode === "auto" ? (isNightMode(lat, lng) ? "dark" : "light") : mode;
      if (effective === "light") return "dark";
      if (effective === "dark") return "terrain";
      return "light";
    });
  }, []);

  const centerOnUser = useCallback(() => {
    const map = mapRef.current;
    const pos = userPositionRef.current;
    if (!map || !pos) return;
    map.easeTo({ center: [pos.lng, pos.lat], zoom: 15, duration: 500 });
  }, []);

  const cycleSheetHeight = useCallback(() => {
    setSheetHeight((state) => {
      if (state === "peek") return "half";
      if (state === "half") return "full";
      return "peek";
    });
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
      wayraRecognitionRef.current?.stop();
      wayraRecognitionRef.current = null;
      if (hazardTimerRef.current != null) {
        window.clearTimeout(hazardTimerRef.current);
      }
      if (safetyBannerTimerRef.current != null) {
        window.clearTimeout(safetyBannerTimerRef.current);
      }
      if (sosTimerRef.current != null) {
        window.clearInterval(sosTimerRef.current);
      }
      if (wayraAlertTimerRef.current != null) {
        window.clearTimeout(wayraAlertTimerRef.current);
      }
      if (routeAlertTimerRef.current != null) {
        window.clearTimeout(routeAlertTimerRef.current);
      }
      if (cameraAlertTimerRef.current != null) {
        window.clearTimeout(cameraAlertTimerRef.current);
      }
      continuousListeningActive.current = false;
      continuousRecognitionRef.current?.stop();
      cancelSpeech();
      if (routeHazardTimerRef.current != null) {
        window.clearTimeout(routeHazardTimerRef.current);
      }
      if (arrivalTimerRef.current != null) {
        window.clearTimeout(arrivalTimerRef.current);
      }
      const id = sessionIdRef.current;
      const token =
        typeof window !== "undefined" ? localStorage.getItem("gt_token") : null;
      if (id && token && !trackEndedRef.current) {
        void endTrackRecording(id);
      }
      if (id && token) {
        void apiFetch(`/live/session/${id}/end`, { method: "POST" });
      }
      stopMeetingPointPlacement();
      clearMemberMarkers();
      meetingPointMarkerRef.current?.remove();
      meetingPointMarkerRef.current = null;
      geofenceLabelMarkerRef.current?.remove();
      geofenceLabelMarkerRef.current = null;
      travelerMarkersRef.current.forEach((entry) => entry.marker.remove());
      travelerMarkersRef.current.clear();
      cameraMarkersRef.current.forEach((marker) => marker.remove());
      cameraMarkersRef.current.clear();
      const db = firebaseDbRef.current;
      const trip = validTripId;
      const userId = dashboardUser?.id;
      if (db && userId) {
        void remove(ref(db, `live_locations/${userId}`));
      }
      if (groupModeRef.current && db && trip && userId) {
        void remove(ref(db, `trips/${trip}/live/members/${userId}`));
      }
    };
  }, [clearMemberMarkers, dashboardUser?.id, endTrackRecording, stopMeetingPointPlacement, validTripId]);

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
      maxZoom: OSM_MAX_ZOOM,
      attributionControl: false,
    });

    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-right",
    );

    mapRef.current = map;

    map.on("load", () => {
      applyMapStyle(map);
      setMapLoaded(true);
    });

    map.on("style.load", () => {
      syncReportMarkers(map, reportsRef.current);
      ensureTrafficLayer(map, trafficGeoJson(trafficDataRef.current));
      syncCameraMarkers(map, speedCamerasRef.current);
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
      if (mapStyleMode !== "auto") return;
      const activeMap = mapRef.current;
      if (!activeMap) return;
      const dark = isNightMode(sunCoordsRef.current.lat, sunCoordsRef.current.lng);
      if (isDarkRef.current === dark) return;
      applyMapStyle(activeMap);
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
  }, [applyMapStyle, clearPoiMarkers, clearRouteFromMap, mapStyleMode, syncGeofenceOnMap, syncMarker, syncReportMarkers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    applyMapStyle(map);
  }, [applyMapStyle, mapLoaded, mapStyleMode]);

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
        currentLatRef.current = lat;
        currentLngRef.current = lng;
        currentSpeedRef.current = mph;
        currentBearingRef.current = bearing;

        syncMarker(map, lat, lng, bearing, true);
        writeUserLocation(lat, lng, bearing, mph);
        broadcastSoloLocation(lat, lng, bearing, mph);
        void fetchNearbyReports(lat, lng);
        void fetchTrafficDensity(lat, lng);
        processNavigationUpdate(lat, lng);
        if (driverModeRef.current) {
          map.easeTo({
            center: [lng, lat],
            bearing: bearing ?? 0,
            pitch: 45,
            zoom: 16,
            duration: 300,
          });
        }
        if (groupModeRef.current) {
          checkMeetingArrival(lat, lng);
          checkGeofence(lat, lng);
        }

        if (!hasCenteredRef.current) {
          map.jumpTo({ center: [lng, lat], zoom: 15 });
          hasCenteredRef.current = true;
          void fetchWeather(lat, lng);
          void startLiveSession();

          if (mapStyleMode === "auto") {
            applyMapStyle(map);
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
  }, [applyMapStyle, broadcastSoloLocation, checkGeofence, checkMeetingArrival, fetchNearbyReports, fetchTrafficDensity, fetchWeather, mapStyleMode, processNavigationUpdate, startLiveSession, syncMarker, writeUserLocation]);

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
      if (action === "confirm") {
        reportsEncounteredRef.current += 1;
      }
    } catch {
      showToastMessage("Could not update report. Try again.");
    } finally {
      setReportBusy(false);
    }
  };

  useEffect(() => {
    if (activePanel) setSheetHeight("peek");
  }, [activePanel]);

  useEffect(() => {
    const pos = userPositionRef.current;
    if (activePanel === "weather" && pos) {
      void fetchWeatherDetail(pos.lat, pos.lng);
    }
    if (activePanel === "pins") {
      void fetchSavedPins();
    }
  }, [activePanel, fetchSavedPins, fetchWeatherDetail]);

  const unreadAlerts = useMemo(() => {
    let count = 0;
    if (routeAlert) count += 1;
    if (cameraAlert) count += 1;
    if (wayraAlert) count += 1;
    if (hazardBanner) count += 1;
    return count;
  }, [routeAlert, cameraAlert, wayraAlert, hazardBanner]);

  useEffect(() => {
    const nav = navigator as Navigator & {
      getBattery?: () => Promise<{
        level: number;
        addEventListener: (type: string, listener: () => void) => void;
        removeEventListener: (type: string, listener: () => void) => void;
      }>;
    };
    if (!nav.getBattery) return undefined;

    let cleanup: (() => void) | undefined;
    void nav.getBattery().then((battery) => {
      const update = () => setDeviceBatteryLevel(Math.round(battery.level * 100));
      update();
      battery.addEventListener("levelchange", update);
      cleanup = () => battery.removeEventListener("levelchange", update);
    });
    return () => cleanup?.();
  }, []);

  useEffect(() => {
    let volumeDownPressTime: number | null = null;
    let holdTimer: ReturnType<typeof setTimeout> | null = null;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "AudioVolumeDown" || e.key === "VolumeDown") {
        if (!volumeDownPressTime) {
          volumeDownPressTime = Date.now();
          holdTimer = setTimeout(() => {
            void triggerSOS();
          }, 5000);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "AudioVolumeDown" || e.key === "VolumeDown") {
        volumeDownPressTime = null;
        if (holdTimer) clearTimeout(holdTimer);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      if (holdTimer) clearTimeout(holdTimer);
    };
  }, [triggerSOS]);

  const visibleReports =
    sheetHeight === "peek"
      ? reports.slice(0, 1)
      : sheetHeight === "half"
        ? reports.slice(0, 3)
        : reports;
  const alertItems = buildAlertItems(
    routeAlert,
    cameraAlert,
    wayraAlert,
    hazardBanner,
    REPORT_CONFIG,
  );
  const hazardConfig = hazardBanner
    ? REPORT_CONFIG[hazardBanner.report.report_type]
    : null;
  const routeHazardConfig = routeHazardBanner
    ? REPORT_CONFIG[routeHazardBanner.report.report_type]
    : null;

  return (
    <div
      className="fixed inset-0 z-[100] h-[100dvh] w-full overflow-hidden bg-stone-900"
      style={{ margin: 0, padding: 0 }}
    >
      <div ref={mapContainerRef} className="absolute inset-0 h-full w-full" />

      {driverMode ? (
        <DriverModeOverlay
          currentStep={route?.steps[activeStepIndex] ?? null}
          nextStep={route?.steps[activeStepIndex + 1] ?? null}
          distanceToNextTurn={distanceToNextTurn}
          currentSpeed={speedMph}
          speedLimit={speedLimitMph}
          roadName={roadName}
          activeAlert={routeAlert}
          cameraAlert={cameraAlert}
          destination={destination}
          navigationActive={navigationActive}
          eta={route ? formatETA(route.total_duration_s) : null}
          arrived={arrivalBanner}
          voiceMuted={voiceMuted}
          onToggleMute={toggleVoiceMute}
          wayraListening={driverWayraListening}
          onExitDriverMode={() => setDriverMode(false)}
          onWayraTap={handleDriverModeWayra}
          onSOSPressStart={handleSOSPressStart}
          onSOSPressEnd={handleSOSPressEnd}
          sosHoldProgress={sosHoldProgress}
        />
      ) : null}

      {driverModeBanner ? (
        <div className="pointer-events-none absolute left-3 right-3 top-[calc(max(0.75rem,env(safe-area-inset-top))+3.25rem)] z-[150]">
          <div className="rounded-xl bg-green-600 px-4 py-3 text-center text-sm font-semibold text-white shadow-lg">
            Driver mode — hands-free active
          </div>
        </div>
      ) : null}

      <div className="pointer-events-none absolute inset-0 z-10">
        {!driverMode ? (
          <>
        <div className="pointer-events-none absolute left-3 right-3 top-[max(0.75rem,env(safe-area-inset-top))] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => void handleLeaveLive()}
            className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-[rgba(15,23,42,0.82)] px-3 py-2 text-sm font-semibold text-white shadow-lg backdrop-blur-sm transition hover:bg-[rgba(15,23,42,0.92)]"
            aria-label="Go back"
          >
            <ChevronLeft size={18} strokeWidth={2.5} className="text-white" />
            <span className="text-[#5EEAD4]">LIVE</span>
          </button>

          <div className="pointer-events-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDriverMode(true)}
              className="rounded-full bg-[#0F766E] px-3 py-2 text-sm font-semibold text-white shadow-lg backdrop-blur-sm transition hover:bg-[#0d655c]"
            >
              Drive
            </button>
            <Link
              href="/live/history"
              className="rounded-full bg-[rgba(15,23,42,0.82)] px-3 py-2 text-sm font-semibold text-white shadow-lg backdrop-blur-sm transition hover:bg-[rgba(15,23,42,0.92)]"
            >
              History
            </Link>
            {!isGuest && sessionId && activeSpectatorCount > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(15,23,42,0.82)] px-3 py-2 text-xs font-semibold text-white shadow-lg backdrop-blur-sm">
                <Eye size={14} />
                {activeSpectatorCount} watching
              </span>
            ) : null}
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                continuousVoiceActive ? "bg-green-500" : "bg-stone-500"
              }`}
              aria-hidden
            />
            <button
              type="button"
              onClick={toggleVoiceMute}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(15,23,42,0.82)] text-white shadow-lg backdrop-blur-sm transition hover:bg-[rgba(15,23,42,0.92)]"
              aria-label={voiceMuted ? "Unmute Wayra voice" : "Mute Wayra voice"}
            >
              {voiceMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            {!isGuest && sessionId ? (
              <button
                type="button"
                onClick={() => void shareSpectator()}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(15,23,42,0.82)] text-white shadow-lg backdrop-blur-sm transition hover:bg-[rgba(15,23,42,0.92)]"
                aria-label="Share live trip"
              >
                <Share2 size={18} />
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setShowPoiSearch(true)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(15,23,42,0.82)] text-white shadow-lg backdrop-blur-sm transition hover:bg-[rgba(15,23,42,0.92)]"
              aria-label="Search nearby places"
            >
              <Search size={18} />
            </button>
          </div>
        </div>

        {sosBanner ? (
          <div className="pointer-events-none absolute left-3 right-3 top-[calc(max(0.75rem,env(safe-area-inset-top))+3.25rem)] z-[130]">
            <div className="rounded-xl bg-red-600 px-4 py-3 text-center text-sm font-semibold text-white shadow-lg">
              SOS activated — alerting your group
            </div>
          </div>
        ) : null}

        {groupMode && !driverMode ? (
          <button
            type="button"
            onClick={() => setGroupPanelOpen((open) => !open)}
            className="pointer-events-auto absolute left-3 top-[calc(max(0.75rem,env(safe-area-inset-top))+3.5rem)] z-[18] rounded-full bg-[rgba(15,23,42,0.82)] px-3 py-2 text-xs font-semibold text-white shadow-lg"
          >
            Group ({tripMembers.length})
          </button>
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

        {wayraAlert ? (
          <div className="pointer-events-auto absolute left-3 right-3 top-[calc(max(0.75rem,env(safe-area-inset-top))+9.5rem)] z-[130]">
            <div
              className={`flex items-start gap-3 rounded-xl px-4 py-3 text-white shadow-lg ${
                wayraAlert.severity === "danger"
                  ? "bg-red-600"
                  : wayraAlert.severity === "warning"
                    ? "bg-amber-500"
                    : "bg-[#0F766E]"
              }`}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20 text-sm font-bold">
                W
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{wayraAlert.message}</p>
                {wayraAlert.action ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (wayraAlert.action === "open_navigation") {
                        focusSearchInput();
                      } else if (wayraAlert.action === "open_poi_search") {
                        setShowPoiSearch(true);
                      }
                      setWayraAlert(null);
                    }}
                    className="mt-2 rounded-lg bg-white/20 px-3 py-1 text-xs font-semibold hover:bg-white/30"
                  >
                    {wayraAlert.action === "open_navigation"
                      ? "Open navigation"
                      : "Search nearby"}
                  </button>
                ) : null}
              </div>
              {wayraAlert.severity === "danger" ? (
                <button
                  type="button"
                  aria-label="Dismiss alert"
                  onClick={() => setWayraAlert(null)}
                  className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold hover:bg-white/20"
                >
                  Dismiss
                </button>
              ) : null}
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

        <div
          className="pointer-events-none absolute left-3 top-[calc(max(0.75rem,env(safe-area-inset-top))+3.25rem)] z-[125] flex flex-col w-[min(380px,calc(100%-1.5rem))]"
        >
          {showSearchDropdown ? (
            <div
              className="fixed inset-0 z-0 pointer-events-auto cursor-default"
              onClick={() => setShowSearchDropdown(false)}
            />
          ) : null}
          <div className="relative z-10 pointer-events-auto flex items-center gap-2 rounded-full bg-[rgba(15,23,42,0.82)] px-4 py-2 text-left text-sm text-white shadow-lg backdrop-blur-sm transition focus-within:bg-[rgba(15,23,42,0.92)]">
            <MapPin size={16} className="shrink-0 text-[#5EEAD4]" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSearchDropdown(true);
              }}
              onFocus={(e) => {
                if (groupMode && convoy?.active && !isGroupAdmin) {
                  showToastMessage("Convoy is active — follow the group route");
                  e.target.blur();
                  return;
                }
                setShowSearchDropdown(true);
              }}
              placeholder="Search destination..."
              className="w-full bg-transparent text-sm text-white placeholder-white/60 outline-none"
            />
            {routeLoading || searchLoading ? (
              <Loader2 size={14} className="ml-auto animate-spin text-[#5EEAD4] shrink-0" />
            ) : null}
            {searchQuery ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSearchResults([]);
                  setShowSearchDropdown(false);
                  if (destination) {
                    clearNavigation();
                  }
                }}
                className="ml-1 rounded-full p-1 text-white/60 hover:bg-white/10 hover:text-white shrink-0 transition"
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            ) : null}
          </div>

          {showSearchDropdown && (searchQuery.trim().length >= 2 || searchResults.length > 0) ? (
            <div className="relative z-10 mt-2 max-h-60 w-full overflow-y-auto rounded-2xl bg-white p-2 shadow-2xl ring-1 ring-black/5 pointer-events-auto">
              {searchLoading && searchResults.length === 0 ? (
                <div className="flex items-center justify-center gap-2 py-4 text-xs text-stone-500">
                  <Loader2 size={12} className="animate-spin text-[#0F766E]" />
                  Searching…
                </div>
              ) : null}
              {!searchLoading && searchQuery.trim().length >= 2 && searchResults.length === 0 ? (
                <div className="px-3 py-4 text-center text-xs text-stone-500">
                  No places found.
                </div>
              ) : null}
              {searchResults.map((place) => (
                <button
                  key={`${place.lat}-${place.lon}-${place.display_name}`}
                  type="button"
                  onClick={() => {
                    handleDestinationSelect({
                      lat: Number.parseFloat(place.lat),
                      lng: Number.parseFloat(place.lon),
                      name: place.display_name.split(",")[0] || place.display_name,
                    });
                    setSearchQuery(place.display_name.split(",")[0] || place.display_name);
                    setShowSearchDropdown(false);
                  }}
                  className="flex w-full items-start gap-2.5 rounded-xl px-3 py-2.5 text-left transition hover:bg-stone-50"
                >
                  <MapPin size={14} className="mt-0.5 shrink-0 text-[#0F766E]" />
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold text-stone-900">
                      {place.display_name.split(",")[0]}
                    </span>
                    <span className="block truncate text-[10px] text-stone-500">
                      {place.display_name}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : null}
        </div>

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

        {cameraAlert ? (
          <div
            className={`pointer-events-none absolute left-3 right-3 z-[125] ${
              hazardBanner ? "top-[calc(max(0.75rem,env(safe-area-inset-top))+12rem)]" : "top-[calc(max(0.75rem,env(safe-area-inset-top))+9rem)]"
            }`}
          >
            <div
              className={`rounded-xl px-4 py-3 text-white shadow-lg ${
                cameraAlert.tier === "immediate"
                  ? "bg-red-600"
                  : cameraAlert.tier === "warning"
                    ? "bg-amber-500"
                    : "bg-stone-600"
              } ${cameraAlert.over_limit ? "live-camera-banner-flash" : ""}`}
            >
              <p className="text-sm font-semibold">📷 {cameraAlert.message}</p>
            </div>
          </div>
        ) : null}

        {routeAlert ? (
          <div
            className={`pointer-events-none absolute left-3 right-3 z-[125] ${
              hazardBanner ? "top-[calc(max(0.75rem,env(safe-area-inset-top))+12rem)]" : "top-[calc(max(0.75rem,env(safe-area-inset-top))+9rem)]"
            }`}
          >
            <div
              className={`rounded-xl px-4 py-3 text-white shadow-lg ${
                routeAlert.tier === "immediate"
                  ? "bg-red-600"
                  : "bg-amber-500"
              }`}
            >
              <p className="text-sm font-semibold">{routeAlert.message}</p>
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
          <button
            type="button"
            onClick={() => void triggerSOS()}
            style={{
              position: "absolute",
              left: 12,
              bottom: 140,
              zIndex: 18,
              background: "none",
              border: "none",
              color: "rgba(255,255,255,0.5)",
              fontSize: 10,
              cursor: "pointer",
              padding: 4,
            }}
          >
            SOS
          </button>
        ) : null}

        {groupMode && firebaseDb && validTripId && currentUserId ? (
          <GroupLiveChatButton onClick={() => setShowGroupChat(true)} />
        ) : null}

        {selectedCamera ? (
          <div className="pointer-events-auto absolute bottom-40 left-1/2 z-30 w-[min(90%,20rem)] -translate-x-1/2 rounded-xl bg-[rgba(15,23,42,0.92)] px-4 py-3 text-white shadow-lg">
            <p className="text-sm font-semibold">📷 Speed camera</p>
            <p className="mt-1 text-xs text-white/80">
              {selectedCamera.max_speed_mph != null
                ? `Limit ${selectedCamera.max_speed_mph} mph`
                : "Fixed speed enforcement"}
              {selectedCamera.direction ? ` · ${selectedCamera.direction}` : ""}
            </p>
            <button
              type="button"
              onClick={() => setSelectedCamera(null)}
              className="mt-2 text-xs font-semibold text-[#5EEAD4]"
            >
              Close
            </button>
          </div>
        ) : null}

        {gpsState === "granted" ? (
          <div className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-3">
            {roadName ? (
              <p className="mb-1 max-w-[140px] truncate text-xs font-semibold text-white drop-shadow">
                {roadName}
              </p>
            ) : null}
            <div className="rounded-2xl bg-white px-4 py-3 shadow-lg ring-1 ring-stone-200/80">
              <p
                className={`text-3xl font-bold leading-none tabular-nums ${
                  speedLimitMph != null && speedMph > speedLimitMph
                    ? "text-red-600"
                    : speedLimitMph != null && speedMph >= speedLimitMph - 5
                      ? "text-amber-600"
                      : "text-stone-900"
                }`}
              >
                {speedMph}
              </p>
              <p className="mt-1 text-xs font-medium uppercase tracking-wide text-stone-500">
                mph{speedLimitMph != null ? ` · limit ${speedLimitMph}` : ""}
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
          </>
        ) : null}
      </div>

      {toast ? (
        <div className="pointer-events-none absolute left-1/2 top-[max(5rem,env(safe-area-inset-top))] z-[140] -translate-x-1/2 rounded-full bg-stone-900/90 px-4 py-2 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      ) : null}

      {!driverMode && !(route && destination) ? (
        <div
          className="pointer-events-auto absolute bottom-0 left-0 right-0 z-20 flex flex-col overflow-hidden"
          style={{
            height: "85vh",
            transform: SHEET_TRANSLATE[sheetHeight],
            transition: "transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)",
            background: "white",
            borderRadius: "16px 16px 0 0",
            borderTop: "0.5px solid #e2e8f0",
          }}
          onTouchStart={(event) => {
            sheetTouchStartYRef.current = event.touches[0]?.clientY ?? null;
          }}
          onTouchEnd={(event) => {
            const startY = sheetTouchStartYRef.current;
            const endY = event.changedTouches[0]?.clientY;
            sheetTouchStartYRef.current = null;
            if (startY == null || endY == null) return;
            const delta = startY - endY;
            if (delta > 40) setSheetHeight("half");
            else if (delta < -40) setSheetHeight("peek");
          }}
        >
          <div
            role="button"
            tabIndex={0}
            onClick={cycleSheetHeight}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") cycleSheetHeight();
            }}
            style={{ padding: "10px 0 6px", cursor: "pointer", textAlign: "center" }}
            aria-label="Adjust bottom sheet"
          >
            <div
              style={{
                width: 32,
                height: 3,
                background: "#cbd5e1",
                borderRadius: 2,
                margin: "0 auto",
              }}
            />
          </div>

          <div className="flex gap-1 border-b border-stone-200 px-3 pb-2">
            {(
              [
                ["reports", "Nearby reports"],
                ["route_chat", "Route chat"],
                ["group", "Group"],
                ["travelers", "Travelers"],
              ] as const
            ).map(([tab, label]) => (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  setSheetTab(tab);
                  if (tab === "group" && groupMode) setGroupPanelOpen(true);
                }}
                className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                  sheetTab === tab
                    ? "bg-[#0F766E] text-white"
                    : "bg-stone-100 text-stone-600"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div
            className={`flex-1 overflow-y-auto px-4 py-3 ${sheetHeight === "full" ? "" : "overflow-hidden"}`}
          >
            {sheetTab === "reports" ? (
              reports.length === 0 ? (
                <p className="text-sm text-stone-500">No nearby reports yet.</p>
              ) : (
                <ul className="space-y-2">
                  {visibleReports.map((report) => {
                    const config = REPORT_CONFIG[report.report_type];
                    return (
                      <li key={report.id}>
                        <button
                          type="button"
                          onClick={() => openReportRef.current(report)}
                          className="flex w-full items-center justify-between rounded-xl bg-stone-50 px-3 py-2 text-left"
                        >
                          <span className="text-sm font-medium text-stone-900">
                            {config.label}
                          </span>
                          <span className="text-xs text-stone-500">
                            {formatDistance(
                              haversineMeters(
                                userPositionRef.current?.lat ?? report.lat,
                                userPositionRef.current?.lng ?? report.lng,
                                report.lat,
                                report.lng,
                              ),
                            )}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )
            ) : null}

            {sheetTab === "route_chat" ? (
              selectedReport ? (
                <button
                  type="button"
                  onClick={() => openReportChat(selectedReport)}
                  className="w-full rounded-xl bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-800"
                >
                  Open chat for {REPORT_CONFIG[selectedReport.report_type].label}
                </button>
              ) : (
                <p className="text-sm text-stone-500">
                  Select a report on the map to open route chat.
                </p>
              )
            ) : null}

            {sheetTab === "group" ? (
              groupMode ? (
                <button
                  type="button"
                  onClick={() => setGroupPanelOpen(true)}
                  className="w-full rounded-xl bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-800"
                >
                  Open group panel ({tripMembers.length} members)
                </button>
              ) : (
                <p className="text-sm text-stone-500">Group mode is not active.</p>
              )
            ) : null}

            {sheetTab === "travelers" ? (
              nearbyTravelers.length === 0 ? (
                <p className="text-sm text-stone-500">No nearby travelers.</p>
              ) : (
                <ul className="space-y-2">
                  {(sheetHeight === "peek"
                    ? nearbyTravelers.slice(0, 1)
                    : sheetHeight === "half"
                      ? nearbyTravelers.slice(0, 3)
                      : nearbyTravelers
                  ).map((traveler) => (
                    <li key={traveler.traveler_id}>
                      <button
                        type="button"
                        onClick={() => openTravelerChat(traveler)}
                        className="flex w-full items-center justify-between rounded-xl bg-stone-50 px-3 py-2 text-left"
                      >
                        <span className="text-sm font-medium text-stone-900">
                          {traveler.label}
                        </span>
                        <span className="text-xs text-stone-500">
                          {traveler.distance_miles.toFixed(1)} mi
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )
            ) : null}
          </div>
        </div>
      ) : null}

      {!driverMode ? (
        <>
          <RightPanel
            activePanel={activePanel}
            anchorEl={activePanel ? panelAnchorEl : null}
            onClosePanel={closeActivePanel}
            weatherDetail={weatherDetail}
            weatherLoading={weatherDetailLoading}
            onRefreshWeather={() => {
              const pos = userPositionRef.current;
              if (pos) void fetchWeatherDetail(pos.lat, pos.lng);
            }}
            alerts={alertItems}
            onClearAlerts={handleClearAlerts}
            isListening={wayraListening}
            toggleVoiceListening={toggleVoiceListening}
            connectivityCount={nearbyTravelers.length}
            nearbyTravelers={nearbyTravelers}
            onTravelerTap={openTravelerChat}
            savedPins={savedPins}
            pinsLoading={pinsLoading}
            onNavigateToPin={handleNavigateToPin}
            onSaveCurrentLocation={() => void handleSaveCurrentLocation()}
          />
          <div className="pointer-events-none absolute inset-0">
            <LiveControlRail
              activePanel={activePanel}
              weatherTemp={weather?.temperature_2m ?? null}
              batteryLevel={deviceBatteryLevel}
              connectivityCount={nearbyTravelers.length}
              unreadAlerts={unreadAlerts}
              unreadLounge={unreadLounge}
              isListening={wayraListening}
              onToolbarTap={handleToolbarTap}
              onZoomIn={() => mapRef.current?.zoomIn()}
              onZoomOut={() => mapRef.current?.zoomOut()}
              onStyleTap={cycleMapStyle}
              buttonRefs={railButtonRefs}
            />
          </div>
          <ChatSlidePanel
            chatOpen={chatOpen}
            chatTarget={chatTarget}
            anchorEl={railButtonRefs.current.connectivity ?? null}
            onBack={() => {
              setChatOpen(false);
              setChatTarget(null);
            }}
            onToast={showToastMessage}
          />
        </>
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
          buildContext={buildWayraContext}
          onAction={handleWayraAction}
          onToast={showToastMessage}
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



      {route && destination && !driverMode ? (
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

      {groupMode && !driverMode ? (
        <FamilyPanel
          open={groupPanelOpen}
          tripMembers={tripMembers}
          memberStatuses={memberStatuses}
          memberLive={memberLive}
          meetingPoint={meetingPoint}
          isGroupAdmin={isGroupAdmin}
          currentUserId={currentUserId}
          currentUserSpeedMph={speedMph}
          onClose={() => setGroupPanelOpen(false)}
          onSetMeetingPoint={handleSetMeetingPointMode}
          onStartConvoy={() => setShowConvoySheet(true)}
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

      {showTripSummary && summaryTrack ? (
        <TripSummarySheet
          track={summaryTrack}
          onToast={showToastMessage}
          onClose={() => {
            setShowTripSummary(false);
            setSummaryTrack(null);
            if (pendingNavigateAway) {
              setPendingNavigateAway(false);
              router.back();
            }
          }}
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
