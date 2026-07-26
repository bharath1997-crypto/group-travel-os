"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  ChevronRight,
  MapPin,
  Search,
  Star,
} from "lucide-react";
import { useDashboardUser } from "@/contexts/dashboard-user-context";
import TravelModeChip from "./TravelModeChip";
import LiveMiniHud from "./LiveMiniHud";
import InlineSignInModal from "./InlineSignInModal";
import { haversineM } from "@/lib/geo";
import { emitClearWayraContext, emitOpenWayra, WAYRA_CONTEXT_EVENT } from "@/lib/open-wayra";
import { emitWayraPlacePicked } from "@/lib/wayra/live-map-context";
import PlacePreviewCard, { type PlacePreviewData } from "./PlacePreviewCard";
import FarAwayPlacePanel from "./FarAwayPlacePanel";
import SoloRoutePreviewPanel from "./SoloRoutePreviewPanel";
import LiveRouteSummaryBar from "./LiveRouteSummaryBar";
import LiveRouteOriginSetup from "./LiveRouteOriginSetup";
import LiveMapLocationSheet, {
  type MapLocationSheetPoint,
} from "./LiveMapLocationSheet";
import SoloLiveActivePanel from "./SoloLiveActivePanel";
import SoloLiveNavigationOverlay from "./SoloLiveNavigationOverlay";
import type {
  LiveStage,
  RouteLine,
  RouteOrigin,
  RoutePreviewStatus,
  TripStatus,
  UserLocationUpdate,
} from "./live-types";
import { isFarFromUser } from "./live-types";
import { buildRoutePreviewAiSuggestions } from "./live-ai-suggestions";
import { type FriendLocation } from "./live-friend-layer-sync";
import { fetchLiveRoute } from "./live-routing";
import {
  buildGpsRouteOrigin,
  buildMapCenterRouteOrigin,
  buildMapPickRouteOrigin,
  isUserChosenRouteOrigin,
  routeOriginsEquivalent,
  validateRouteOriginCoords,
} from "./live-route-origin";
import {
  liveGeocodingReverse,
  liveAutocompleteSearch,
  autocompleteResultToPlacePreview,
  SEARCH_DEBOUNCE_MS,
  normalizePlaceCategory,
  type AutocompleteResult,
  type SearchBias,
} from "./live-geocoding";
import {
  buildLocationContext,
  buildRoviCacheKey,
  shouldShowAskRoviAi,
  type LiveLocationContext,
} from "./live-location-context";
import {
  fetchRoviPlaceExplanation,
  type RoviPlaceExplanation,
} from "./live-rovi";
import { buildPlaceKey, extractCityCountry } from "./live-place-key";
import { resolvePlaceDisplayName } from "@/lib/wayra/place-region";
import {
  resolvePlaceMedia,
  type PlaceMediaItem,
  type PlaceMediaResolution,
} from "./live-place-media";
import {
  recordRecentSearch,
  getRecentSearches,
  clearRecentSearches,
  buildPlaceRecentSearch,
  buildCategoryRecentSearch,
  buildDroppedPinRecentSearch,
  DEFAULT_RECENT_SUGGESTIONS,
  type RecentSearchItem,
} from "./live-recent-searches";
import { filterInstantSuggestions } from "./live-search-suggestions";
import {
  getNearbyCategoryTitle,
  isExactCategoryQuery,
  nearbyResultLimitForScreen,
  resolveLiveSearchCategory,
} from "./live-search-categories";
import { parsePastedLocation } from "./live-pasted-location";
import {
  enrichNearbyResultsForTravel,
  enrichPlaceForTravel,
} from "./live-place-enrich";
import type { LiveMapRef, MapFollowMode } from "./LiveMapComponent";
import {
  gpsStatusLabel,
  gpsStatusNeedsHelper,
  isFreshGpsStatus,
  logRovvyGps,
  logRovvyLiveDebug,
  logRovvyLiveError,
  logRovvyMapClickResolver,
  type GpsStatus,
  type GpsState,
} from "./live-gps";
import { LIVE_MAP_CONTROLS_POSITION, type LiveMapViewMode } from "./live-layout";
import LiveImmersiveChrome from "./LiveImmersiveChrome";
import { isImmersiveDarkMapLayer, setLiveImmersiveChrome, clearLiveImmersiveChrome } from "./live-immersive-chrome";
import LiveMapRightControls from "./LiveMapRightControls";
import LiveMapAttributionStrip from "./LiveMapAttributionStrip";
import type { LiveMapAttributionFocus } from "./live-map-attribution";
import { formatMapCoordinates } from "./live-map-pick-context";
import type { MapClickPayload } from "./LiveMapComponent";
import {
  DEFAULT_LIVE_MAP_LAYER,
  loadLiveMapLayerPreference,
  saveLiveMapLayerPreference,
} from "./live-map-layer-preference";
import {
  loadLiveTravelLayerPreference,
  saveLiveTravelLayerPreference,
} from "./live-travel-layer-preference";
import {
  loadLiveCruiseRoutesPreference,
  loadLiveSeaRoutesPreference,
  saveLiveCruiseRoutesPreference,
  saveLiveSeaRoutesPreference,
} from "./live-sea-routes-preference";
import {
  loadLiveFootRoutesPreference,
  saveLiveFootRoutesPreference,
} from "./live-foot-routes-preference";
import {
  loadLiveFriendTrackingPreference,
  saveLiveFriendTrackingPreference,
} from "./live-friend-preference";
import { mergeAutocompleteResults } from "./live-search-merge";
import {
  getPoiMarkerPresentation,
  resolvePoiMapIcon,
} from "./live-poi-icons";
import { getLiveMapMaxZoom, type LiveMapLayer } from "@/lib/map-providers";
import { mapLabelFeatureToPlacePreview } from "./live-map-labels";
import RoviRouteIntelligencePanel from "./RoviRouteIntelligencePanel";
import {
  fetchRouteIntelligence,
  placeToLocationSummary,
  userRegionToLocationSummary,
} from "./route-intelligence";
import type { RouteIntelligenceResponse, RouteOption } from "./route-intelligence-types";

const LiveMapComponent = dynamic(() => import("./LiveMapComponent"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-stone-100 flex items-center justify-center text-stone-400 text-sm font-medium">
      Loading Map...
    </div>
  ),
});

const TRAVEL_MODES = ["Drive", "Bike", "Trek", "Walk"] as const;
const WORKFLOW_TYPES = ["Solo", "Group Travel", "Seat Share"] as const;

function formatCategoryLabel(type?: string, cls?: string): string {
  const parts = [type, cls]
    .filter(Boolean)
    .map((part) => part!.replace(/_/g, " "))
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1));
  const unique = [...new Set(parts)];
  return unique.length ? unique.join(" · ") : "Place";
}

function scoreFeature(f: any): number {
  const p = f.properties || {};
  const hasName = !!(p.name || p.display_name || p.title);
  
  const isPoi = !!(
    p.amenity ||
    p.shop ||
    p.tourism ||
    p.leisure ||
    p.healthcare ||
    p.public_transport ||
    p.highway === "bus_stop" ||
    p.highway === "bus_station" ||
    (p.class && !["building", "road", "highway", "water", "landuse", "boundary", "transit", "administrative"].includes(p.class)) ||
    (p.type && !["building", "road", "highway", "water", "landuse", "boundary", "transit", "administrative"].includes(p.type))
  );

  const isBuilding = !!(
    p.building ||
    p.class === "building" ||
    p.type === "building" ||
    f.layer?.id?.includes("building") ||
    f.layer?.["source-layer"]?.includes("building")
  );

  const isSymbol = f.layer?.type === "symbol";

  if (hasName && isPoi && isSymbol) return 100;
  if (hasName && isPoi) return 90;
  if (hasName && isBuilding) return 80;
  if (isPoi) return 70;
  if (isBuilding && (p["addr:housenumber"] || p.house_number || p.street || p["addr:street"])) return 60;
  if (isBuilding) return 50;
  if (hasName) return 40;
  if (Object.keys(p).length > 0) return 10;
  return 0;
}

function parseOpenStatus(openingHours: string | undefined): string | null {
  if (!openingHours) return null;
  if (openingHours.includes("24/7")) return "Open Now";
  return "Open Now";
}

function roundCoord(value: number): number {
  return Math.round(value * 100000) / 100000;
}

function buildDroppedPinPlace(
  lat: number,
  lng: number,
  userLoc: { lat: number; lng: number } | null,
): PlacePreviewData {
  const roundedLat = roundCoord(lat);
  const roundedLng = roundCoord(lng);
  return {
    name: "Dropped pin",
    categoryLabel: "Dropped pin",
    address: `Coordinates: ${roundedLat}, ${roundedLng}`,
    phone: null,
    lat,
    lng,
    distanceM: userLoc ? haversineM(userLoc.lat, userLoc.lng, lat, lng) : null,
    openingHours: null,
    openStatus: null,
    placeKey: `dropped-pin:${roundedLat},${roundedLng}`,
    osmType: null,
    osmId: null,
    source: "dropped_pin",
    tags: {},
  };
}

function mapResolveClickPlace(
  p: any,
  userLoc: { lat: number; lng: number } | null,
): PlacePreviewData {
  return {
    name: p.name,
    categoryLabel: p.category,
    address: p.address || "",
    phone: p.tags?.phone || p.tags?.["contact:phone"] || null,
    lat: p.lat,
    lng: p.lng,
    distanceM: userLoc ? haversineM(userLoc.lat, userLoc.lng, p.lat, p.lng) : p.distanceMeters,
    openingHours: p.tags?.opening_hours || null,
    openStatus: p.tags?.opening_hours ? parseOpenStatus(p.tags.opening_hours) : null,
    placeKey: p.placeKey,
    osmType: p.tags?.osm_type || null,
    osmId: p.tags?.osm_id ? parseInt(p.tags.osm_id, 10) : null,
    source: p.source,
    tags: p.tags || {},
  };
}

function extractPhone(extratags?: Record<string, string>): string | null {
  if (!extratags) return null;
  return extratags.phone || extratags["contact:phone"] || extratags["phone:mobile"] || null;
}

function formatStreetAddress(
  address?: Record<string, string>,
  fallback?: string,
): string {
  if (!address) return fallback || "";
  const line1 = [address.house_number, address.road].filter(Boolean).join(" ");
  const line2 = [
    address.city || address.town || address.village || address.municipality,
    address.state,
    address.postcode,
  ]
    .filter(Boolean)
    .join(", ");
  const formatted = [line1, line2].filter(Boolean).join(", ");
  return formatted || fallback || "";
}

import { apiFetch } from "@/lib/api";
type BackendNearbyPlace = {
  id: string;
  placeKey: string;
  name: string;
  category: string;
  address: string;
  lat: number;
  lng: number;
  distanceMiles: number;
  source: string;
  osmType: string;
  osmId: string;
};

type BackendNearbyResponse = {
  results: BackendNearbyPlace[];
};

function resolveCategoryLabelFromPlace(place: PlacePreviewData): string {
  const fromTags = normalizePlaceCategory(place.tags);
  if (fromTags) return fromTags;
  if (place.categoryLabel && !/^(node|way|relation)$/i.test(place.categoryLabel.trim())) {
    return place.categoryLabel;
  }
  return "Place";
}

function resolveNearbyCategoryLabel(item: BackendNearbyPlace): string {
  const raw = item.category?.trim();
  if (raw && !/^(node|way|relation)$/i.test(raw)) return raw;
  return normalizePlaceCategory((item as any).tags) || "Place";
}

async function searchNearbyPlaces(
  category: string,
  center: { lat: number; lng: number },
  limit = nearbyResultLimitForScreen(),
): Promise<PlacePreviewData[]> {
  try {
    const radiusMeters = limit >= 36 ? 15000 : limit >= 24 ? 12000 : 8000;
    const data = await apiFetch<BackendNearbyResponse>(
      `/places/nearby?category=${encodeURIComponent(category)}&lat=${center.lat}&lng=${center.lng}&radius_meters=${radiusMeters}&limit=${limit}`,
    );
    if (!data || !data.results) return [];
    const mapped = data.results.map((item) => ({
      name: item.name,
      categoryLabel: resolveNearbyCategoryLabel(item),
      address: item.address,
      phone: null,
      lat: item.lat,
      lng: item.lng,
      distanceM: item.distanceMiles * 1609.34, // convert miles to meters
      openingHours: null,
      openStatus: null,
      placeKey: item.placeKey || item.id,
      osmType: item.osmType || null,
      osmId: item.osmId ? parseInt(item.osmId, 10) : null,
      city: null,
      country: null,
      tags: (item as any).tags
    }));
    return enrichNearbyResultsForTravel(mapped, { max: 12 });
  } catch (err) {
    logRovvyLiveError("Failed to search nearby places", err);
    throw err;
  }
}

function fitMapToNearbyResults(
  map: LiveMapRef | null,
  results: PlacePreviewData[],
) {
  if (!map || results.length === 0) return;
  if (results.length === 1) {
    map.flyToPlace(results[0].lat, results[0].lng, 14);
    return;
  }
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const r of results) {
    minLat = Math.min(minLat, r.lat);
    maxLat = Math.max(maxLat, r.lat);
    minLng = Math.min(minLng, r.lng);
    maxLng = Math.max(maxLng, r.lng);
  }
  map.fitBounds([
    [minLng, minLat],
    [maxLng, maxLat],
  ]);
}

export default function LivePage() {
  const { user } = useDashboardUser();
  const [showSetupPanel, setShowSetupPanel] = useState(false);
  const [showSignInModal, setShowSignInModal] = useState(false);

  const mapRef = useRef<LiveMapRef | null>(null);
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchBlurRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [activeLayer, setActiveLayer] = useState<LiveMapLayer>(() => loadLiveMapLayerPreference());
  const [travelLayerEnabled, setTravelLayerEnabled] = useState(() =>
    loadLiveTravelLayerPreference(),
  );
  const [seaRoutesEnabled, setSeaRoutesEnabled] = useState(() =>
    loadLiveSeaRoutesPreference(),
  );
  const [cruiseRoutesEnabled, setCruiseRoutesEnabled] = useState(() =>
    loadLiveCruiseRoutesPreference(),
  );
  const [footRoutesEnabled, setFootRoutesEnabled] = useState(() =>
    loadLiveFootRoutesPreference(),
  );

  const handleLayerChange = useCallback(
    (layer: LiveMapLayer) => {
      setActiveLayer(layer);
      setMapMaxZoom(getLiveMapMaxZoom(layer, { travelLayerEnabled }));
      saveLiveMapLayerPreference(layer);
      setAttributionRefreshedAt(new Date());
    },
    [travelLayerEnabled],
  );

  const handleTravelLayerChange = useCallback(
    (enabled: boolean) => {
      setTravelLayerEnabled(enabled);
      saveLiveTravelLayerPreference(enabled);
      setMapMaxZoom(getLiveMapMaxZoom(activeLayer, { travelLayerEnabled: enabled }));
    },
    [activeLayer],
  );

  const handleSeaRoutesChange = useCallback((enabled: boolean) => {
    setSeaRoutesEnabled(enabled);
    saveLiveSeaRoutesPreference(enabled);
  }, []);

  const handleCruiseRoutesChange = useCallback((enabled: boolean) => {
    setCruiseRoutesEnabled(enabled);
    saveLiveCruiseRoutesPreference(enabled);
  }, []);

  const handleFootRoutesChange = useCallback((enabled: boolean) => {
    setFootRoutesEnabled(enabled);
    saveLiveFootRoutesPreference(enabled);
  }, []);

  const handleFriendTrackingChange = useCallback((enabled: boolean) => {
    setFriendTrackingEnabled(enabled);
    saveLiveFriendTrackingPreference(enabled);
  }, []);

  const [layersPanelOpen, setLayersPanelOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [liveImmersive, setLiveImmersive] = useState(false);

  const toggleLiveImmersive = useCallback(() => {
    setLiveImmersive((prev) => {
      const next = !prev;
      setLiveImmersiveChrome({
        active: next,
        darkMap: isImmersiveDarkMapLayer(activeLayer),
      });
      return next;
    });
  }, [activeLayer]);

  useEffect(() => {
    return () => {
      clearLiveImmersiveChrome();
    };
  }, []);

  useEffect(() => {
    if (!liveImmersive) return;
    setLiveImmersiveChrome({
      active: true,
      darkMap: isImmersiveDarkMapLayer(activeLayer),
    });
  }, [activeLayer, liveImmersive]);

  const [liveStage, setLiveStage] = useState<LiveStage>("static_landing");
  const [workflowType, setWorkflowType] =
    useState<(typeof WORKFLOW_TYPES)[number]>("Solo");
  const [travelMode, setTravelMode] =
    useState<(typeof TRAVEL_MODES)[number]>("Drive");
  const [isMapInteracting, setIsMapInteracting] = useState(false);
  const [attributionFocus, setAttributionFocus] = useState<LiveMapAttributionFocus | null>(null);
  const [attributionRefreshedAt, setAttributionRefreshedAt] = useState(() => new Date());

  const [selectedPlace, setSelectedPlace] = useState<PlacePreviewData | null>(null);
  const [destination, setDestination] = useState<PlacePreviewData | null>(null);
  const [activeRoute, setActiveRoute] = useState<RouteLine | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routePreviewStatus, setRoutePreviewStatus] = useState<RoutePreviewStatus>("idle");
  const [routePreviewError, setRoutePreviewError] = useState<string | null>(null);
  const [routeOrigin, setRouteOrigin] = useState<RouteOrigin | null>(null);
  const [originPickMode, setOriginPickMode] = useState(false);
  const [showOriginSetup, setShowOriginSetup] = useState(false);
  const [showPlaceDetailsPanel, setShowPlaceDetailsPanel] = useState(false);
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [tripStatus, setTripStatus] = useState<TripStatus>("on_the_way");
  const [plannedStops, setPlannedStops] = useState<PlacePreviewData[]>([]);
  const [gpsState, setGpsState] = useState<GpsState>({
    status: "idle",
    lat: null,
    lng: null,
    accuracyMeters: null,
    heading: null,
    speed: null,
    timestamp: null,
    source: null,
  });

  const userLocation = useMemo(() => 
    gpsState.lat !== null && gpsState.lng !== null
      ? { lat: gpsState.lat, lng: gpsState.lng }
      : null,
    [gpsState.lat, gpsState.lng]
  );

  const DEV_SHOW_MOCK_FRIENDS = false;
  const [friendTrackingEnabled, setFriendTrackingEnabled] = useState(() =>
    loadLiveFriendTrackingPreference(),
  );
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const friendsLocations = useMemo<FriendLocation[]>(() => {
    if (!DEV_SHOW_MOCK_FRIENDS || workflowType !== "Group Travel") return [];
    
    // Base coordinates to offset from (use userLocation, routeOrigin, or Chicago baseline)
    const baseLat = userLocation?.lat ?? routeOrigin?.latitude ?? 41.922;
    const baseLng = userLocation?.lng ?? routeOrigin?.longitude ?? -87.726;

    return [
      {
        userId: "friend-1",
        name: "Aiden (Drive)",
        lat: baseLat + 0.006,
        lng: baseLng - 0.005,
        lastSeenAt: new Date().toISOString(),
        status: "active",
        speedMps: 12.5,
        heading: 45,
      },
      {
        userId: "friend-2",
        name: "Chloe (Bike)",
        lat: baseLat - 0.004,
        lng: baseLng + 0.006,
        lastSeenAt: new Date().toISOString(),
        status: "active",
        speedMps: 5.2,
        heading: 180,
      },
      {
        userId: "friend-3",
        name: "Marcus (Walk)",
        lat: baseLat + 0.003,
        lng: baseLng + 0.012,
        lastSeenAt: new Date().toISOString(),
        status: "active",
        speedMps: 1.4,
        heading: 90,
      },
      {
        userId: "friend-4",
        name: "Sophia (Idle)",
        lat: baseLat + 0.008,
        lng: baseLng - 0.004,
        lastSeenAt: new Date().toISOString(),
        status: "idle",
        speedMps: 0,
        heading: 0,
      },
    ];
  }, [workflowType, userLocation, routeOrigin]);
  const speedMps = gpsState.speed;
  const gpsStatus = gpsState.status;
  const gpsStatusRef = useRef(gpsStatus);
  gpsStatusRef.current = gpsStatus;
  const liveGpsActive = gpsStatus === "active" || gpsStatus === "approximate" || gpsStatus === "requesting" || gpsStatus === "stale";

  const [toast, setToast] = useState<string | null>(null);
  const [loadingPlaceDetails, setLoadingPlaceDetails] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchPopup, setShowSearchPopup] = useState(false);
  const [showSuggestionsCard, setShowSuggestionsCard] = useState(false);
  const [searchResults, setSearchResults] = useState<AutocompleteResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchBias, setSearchBias] = useState<SearchBias | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const routePreviewRequestRef = useRef(0);
  const lastFetchedRouteRef = useRef<{
    originLat: number;
    originLng: number;
    destLat: number;
    destLng: number;
    travelMode: string;
  } | null>(null);
  const activeRouteRef = useRef<RouteLine | null>(null);
  activeRouteRef.current = activeRoute;
  const routeOriginRef = useRef<RouteOrigin | null>(null);
  routeOriginRef.current = routeOrigin;
  const routePreviewStatusRef = useRef(routePreviewStatus);
  routePreviewStatusRef.current = routePreviewStatus;
  const kickRoutePreviewRef = useRef<
    (
      dest: PlacePreviewData,
      options?: { active?: boolean; fitMap?: boolean; origin?: RouteOrigin | null; refreshGps?: boolean },
    ) => void
  >(() => {});

  const [showGpsHelper, setShowGpsHelper] = useState(false);
  const [mapLocationSheet, setMapLocationSheet] = useState<MapLocationSheetPoint | null>(null);
  const [mapLocationSheetLoading, setMapLocationSheetLoading] = useState(false);
  const [mapLocationSheetManual, setMapLocationSheetManual] = useState(false);
  const [searchAnchorHint, setSearchAnchorHint] = useState<string | null>(null);
  const [searchNeedsLocation, setSearchNeedsLocation] = useState(false);
  const [mapBearing, setMapBearing] = useState(0);
  const [mapZoom, setMapZoom] = useState(14);
  const [mapMaxZoom, setMapMaxZoom] = useState(() =>
    getLiveMapMaxZoom(loadLiveMapLayerPreference(), {
      travelLayerEnabled: loadLiveTravelLayerPreference(),
    }),
  );
  const [mapViewMode, setMapViewMode] = useState<LiveMapViewMode>("2d");
  const lowAccuracyToastShownRef = useRef(false);
  const [userRegion, setUserRegion] = useState<{
    lat?: number;
    lng?: number;
    city?: string;
    state?: string;
    country?: string;
  } | null>(null);
  const [roviExplanationLoading, setRoviExplanationLoading] = useState(false);
  const [roviExplanation, setRoviExplanation] = useState<RoviPlaceExplanation | null>(null);
  const [roviExplanationError, setRoviExplanationError] = useState<string | null>(null);
  const roviExplanationCacheRef = useRef<Map<string, RoviPlaceExplanation>>(new Map());
  const userRegionLoadedRef = useRef(false);

  // ─── Route Intelligence (long-distance / global destinations) ─────────────
  const [routeIntelligenceLoading, setRouteIntelligenceLoading] = useState(false);
  const [routeIntelligenceResponse, setRouteIntelligenceResponse] =
    useState<RouteIntelligenceResponse | null>(null);
  const [routeIntelligenceError, setRouteIntelligenceError] = useState<string | null>(null);
  const [placeMedia, setPlaceMedia] = useState<PlaceMediaItem[]>([]);
  const [placeTags, setPlaceTags] = useState<string[]>([]);
  const [placeMediaLoading, setPlaceMediaLoading] = useState(false);

  const [nearbyResults, setNearbyResults] = useState<PlacePreviewData[] | null>(null);
  const [nearbyCategory, setNearbyCategory] = useState<string | null>(null);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState<string | null>(null);
  const [expandedResultIndex, setExpandedResultIndex] = useState<number | null>(null);
  const [viewingDetailsFromNearby, setViewingDetailsFromNearby] = useState(false);
  const [addStopMode, setAddStopMode] = useState(false);
  const [clickedLocation, setClickedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [mapClickPin, setMapClickPin] = useState<{ lat: number; lng: number } | null>(null);
  const [nearbyPlacesAtClick, setNearbyPlacesAtClick] = useState<PlacePreviewData[] | null>(null);
  const [coordinateOverlay, setCoordinateOverlay] = useState<{ lat: number; lng: number } | null>(null);
  const coordinateOverlayRef = useRef(coordinateOverlay);
  coordinateOverlayRef.current = coordinateOverlay;

  // ─── Recent searches (dynamic, localStorage-backed) ────────────────────────
  const [recentSearches, setRecentSearches] = useState<RecentSearchItem[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  /** Refresh the displayed recent searches from localStorage (stable callback) */
  const refreshRecentSearches = useCallback(() => {
    if (typeof window === "undefined") return;
    // Read currentUserId from localStorage directly to avoid stale closure
    const uid = typeof window !== "undefined"
      ? (localStorage.getItem("gt_avatar_user_id") ?? null)
      : null;
    const saved = getRecentSearches(5, uid);
    setRecentSearches(saved);
  }, []);

  const savedPlaces = [
    { name: "Home", address: "123 Main St" },
    { name: "Work", address: "456 Broadway" },
    { name: "Gym", address: "789 Fitness Ave" },
  ];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowSetupPanel(false);
        setShowSuggestionsCard(false);
        setShowSearchPopup(false);
        if (!coordinateOverlayRef.current) {
          setMapClickPin(null);
          setAttributionFocus(null);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const resolveSearchAnchor = useCallback((): SearchBias | null => {
    if (userLocation && isFreshGpsStatus(gpsStatus)) return userLocation;
    const mapCenter = mapRef.current?.getMapCenter();
    if (mapCenter) return mapCenter;
    return null;
  }, [userLocation, gpsStatus]);

  const resolveSearchBias = useCallback((): SearchBias | null => {
    if (clickedLocation) return clickedLocation;
    if (userLocation && isFreshGpsStatus(gpsStatus)) return userLocation;
    const mapCenter = mapRef.current?.getMapCenter();
    if (mapCenter) return mapCenter;
    if (destination && isLiveActive && liveStage === "solo_drive_navigation") {
      return { lat: destination.lat, lng: destination.lng };
    }
    return searchBias;
  }, [clickedLocation, userLocation, searchBias, gpsStatus, destination, isLiveActive, liveStage]);

  const resolveAnchorCoordinate = useCallback((): {
    lat: number;
    lng: number;
    source: "click" | "gps" | "map" | "destination";
  } | null => {
    if (clickedLocation) return { ...clickedLocation, source: "click" };
    if (userLocation && isFreshGpsStatus(gpsStatus)) return { ...userLocation, source: "gps" };
    const mapCenter = mapRef.current?.getMapCenter();
    if (mapCenter) return { ...mapCenter, source: "map" };
    if (destination && isLiveActive && liveStage === "solo_drive_navigation") {
      return { lat: destination.lat, lng: destination.lng, source: "destination" };
    }
    return null;
  }, [clickedLocation, userLocation, destination, isLiveActive, liveStage, gpsStatus]);

  const resolveDefaultRouteOrigin = useCallback((): RouteOrigin | null => {
    if (userLocation) {
      return buildGpsRouteOrigin(userLocation.lat, userLocation.lng, gpsState.accuracyMeters);
    }
    const center = mapRef.current?.getMapCenter();
    if (center) {
      return buildMapCenterRouteOrigin(center.lat, center.lng);
    }
    return null;
  }, [userLocation, gpsState.accuracyMeters]);

  /** GPS-first route origin; keeps manual picks unless GPS is available. */
  const resolveRoutePreviewOrigin = useCallback(
    (explicit?: RouteOrigin | null): RouteOrigin | null => {
      if (explicit !== undefined) return explicit;
      const gpsOrigin = userLocation
        ? buildGpsRouteOrigin(userLocation.lat, userLocation.lng, gpsState.accuracyMeters)
        : null;
      if (gpsOrigin) return gpsOrigin;
      if (isUserChosenRouteOrigin(routeOriginRef.current)) return routeOriginRef.current;
      const center = mapRef.current?.getMapCenter();
      if (center) return buildMapCenterRouteOrigin(center.lat, center.lng);
      return routeOriginRef.current ?? null;
    },
    [userLocation, gpsState.accuracyMeters],
  );

  const loadRoutePreview = useCallback(
    async (
      dest: PlacePreviewData,
      options?: { active?: boolean; fitMap?: boolean; origin?: RouteOrigin | null },
    ) => {
      if (!Number.isFinite(dest.lat) || !Number.isFinite(dest.lng)) {
        setRoutePreviewStatus("failed");
        setRoutePreviewError("Invalid destination coordinates.");
        setActiveRoute(null);
        return;
      }

      const origin =
        options?.origin !== undefined ? options.origin : resolveRoutePreviewOrigin();
      if (!dest || !validateRouteOriginCoords(origin)) {
        setRoutePreviewStatus("failed");
        if (!origin) {
          if (gpsState.status === "denied") {
            setRoutePreviewError("Location off — enable GPS or move the map to your area.");
          } else {
            setRoutePreviewError("Finding your location…");
          }
        } else {
          setRoutePreviewError("Destination is required to preview the route.");
        }
        setActiveRoute(null);
        setRouteLoading(false);
        return;
      }

      const currentArgs = {
        originLat: origin.latitude,
        originLng: origin.longitude,
        destLat: dest.lat,
        destLng: dest.lng,
        travelMode,
      };

      const isDuplicate =
        lastFetchedRouteRef.current &&
        lastFetchedRouteRef.current.originLat === currentArgs.originLat &&
        lastFetchedRouteRef.current.originLng === currentArgs.originLng &&
        lastFetchedRouteRef.current.destLat === currentArgs.destLat &&
        lastFetchedRouteRef.current.destLng === currentArgs.destLng &&
        lastFetchedRouteRef.current.travelMode === currentArgs.travelMode;

      if (isDuplicate) {
        if (options?.active && activeRouteRef.current) {
          setActiveRoute({ ...activeRouteRef.current, active: true });
          setRoutePreviewStatus("ready");
          setRouteLoading(false);
        }
        return;
      }
      lastFetchedRouteRef.current = currentArgs;

      const requestId = ++routePreviewRequestRef.current;
      setRouteOrigin((prev) => (routeOriginsEquivalent(prev, origin) ? prev : origin));
      setRoutePreviewStatus("loading");
      setRoutePreviewError(null);
      setRouteLoading(true);
      setActiveRoute(null);

      try {
        const result = await fetchLiveRoute(
          { lat: origin.latitude, lng: origin.longitude },
          { lat: dest.lat, lng: dest.lng },
          travelMode,
          options?.active ?? false,
          origin.source,
          {
            originCountry: userRegion?.country ?? null,
            destinationCountry: dest.country ?? null,
            destinationName: dest.name ?? null,
          },
        );

        if (requestId !== routePreviewRequestRef.current) return;

        if (result.error) {
          setRoutePreviewStatus("failed");
          setRoutePreviewError(result.error);
          setActiveRoute(null);
          return;
        }

        const route = result.route;
        if (!route || route.geometry.length < 2) {
          setRoutePreviewStatus("failed");
          if (travelMode === "Drive") {
            const distance = dest.distanceM || haversineM(origin.latitude, origin.longitude, dest.lat, dest.lng);
            if (distance < 300) {
              setRoutePreviewError("This is nearby. Walking route may work better.");
            } else {
              setRoutePreviewError("Drive route unavailable to this exact point. Try walking route or Pick nearby road as destination.");
            }
          } else {
            setRoutePreviewError("No route found for selected travel mode.");
          }
          setActiveRoute(null);
          return;
        }

        setActiveRoute(route);
        setRoutePreviewStatus("ready");
        setDestination((prev) =>
          prev && prev.lat === dest.lat && prev.lng === dest.lng
            ? { ...prev, distanceM: route.distanceMeters }
            : prev,
        );
        setSelectedPlace((prev) =>
          prev && prev.lat === dest.lat && prev.lng === dest.lng
            ? { ...prev, distanceM: route.distanceMeters }
            : prev,
        );

        if (options?.fitMap !== false && route.geometry.length >= 2) {
          const lngs = route.geometry.map((c) => c[0]);
          const lats = route.geometry.map((c) => c[1]);
          mapRef.current?.fitBounds([
            [Math.min(...lngs), Math.min(...lats)],
            [Math.max(...lngs), Math.max(...lats)],
          ]);
        }
      } catch (err) {
        if (requestId !== routePreviewRequestRef.current) return;
        logRovvyLiveError("[Rovvy Route] loadRoutePreview catch error:", err);
        setRoutePreviewStatus("failed");
        setRoutePreviewError("Directions service unavailable.");
        setActiveRoute(null);
      } finally {
        if (requestId === routePreviewRequestRef.current) {
          setRouteLoading(false);
        }
      }
    },
    [resolveRoutePreviewOrigin, travelMode, gpsState, userRegion?.country],
  );

  const kickRoutePreview = useCallback(
    (
      dest: PlacePreviewData,
      options?: {
        active?: boolean;
        fitMap?: boolean;
        origin?: RouteOrigin | null;
        refreshGps?: boolean;
      },
    ) => {
      if (options?.refreshGps) {
        mapRef.current?.locateUser(true);
      }
      const origin = resolveRoutePreviewOrigin(options?.origin);
      if (!origin) {
        setRoutePreviewStatus("loading");
        setRoutePreviewError(null);
        setRouteLoading(true);
        return;
      }
      void loadRoutePreview(dest, { ...options, origin });
    },
    [resolveRoutePreviewOrigin, loadRoutePreview],
  );
  kickRoutePreviewRef.current = kickRoutePreview;

  const applyRouteOriginAndPreview = useCallback(
    (origin: RouteOrigin) => {
      setRouteOrigin(origin);
      setShowOriginSetup(false);
      setOriginPickMode(false);
      const previewTarget = destination ?? selectedPlace;
      if (previewTarget) {
        void loadRoutePreview(previewTarget, { origin });
      }
    },
    [destination, selectedPlace, loadRoutePreview],
  );

  const closeMapLocationSheet = useCallback(() => {
    setMapLocationSheet(null);
    setMapLocationSheetLoading(false);
    setMapLocationSheetManual(false);
  }, []);

  const openMapLocationSheet = useCallback(
    async (lat: number, lng: number, options?: { manual?: boolean }) => {
      setMapLocationSheet({ lat, lng });
      setMapLocationSheetManual(Boolean(options?.manual));
      setMapLocationSheetLoading(true);
      setShowGpsHelper(false);
      try {
        const details = await liveGeocodingReverse(lat, lng);
        if (details) {
          setMapLocationSheet({
            lat,
            lng,
            name:
              details.name ||
              details.display_name?.split(",")[0]?.trim() ||
              "Selected location",
            address: details.display_name,
          });
        }
      } catch {
        // Coordinates-only sheet is fine when reverse geocode fails.
      } finally {
        setMapLocationSheetLoading(false);
      }
    },
    [],
  );

  const mapPointToPlace = useCallback(
    (point: MapLocationSheetPoint): PlacePreviewData => ({
      name: point.name || "Selected location",
      categoryLabel: "Place",
      address: point.address || `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`,
      phone: null,
      lat: point.lat,
      lng: point.lng,
      distanceM: userLocation
        ? haversineM(userLocation.lat, userLocation.lng, point.lat, point.lng)
        : destination
          ? haversineM(destination.lat, destination.lng, point.lat, point.lng)
          : null,
      openingHours: null,
      openStatus: null,
      placeKey: undefined,
      osmType: null,
      osmId: null,
      city: null,
      country: null,
      source: "search",
      tags: {},
    }),
    [userLocation, destination],
  );

  const handleUseCurrentLocationOrigin = useCallback(() => {
    if (!userLocation) {
      mapRef.current?.locateUser(true);
      showToast("Finding your location…");
      return;
    }
    applyRouteOriginAndPreview(
      buildGpsRouteOrigin(userLocation.lat, userLocation.lng, gpsState.accuracyMeters),
    );
  }, [userLocation, gpsState.accuracyMeters, applyRouteOriginAndPreview]);

  const handleUseMapCenterOrigin = useCallback(() => {
    const center = mapRef.current?.getMapCenter();
    if (!center) {
      showToast("Move the map first.");
      return;
    }
    applyRouteOriginAndPreview(buildMapCenterRouteOrigin(center.lat, center.lng));
  }, [applyRouteOriginAndPreview]);

  const handleSearchOriginSelect = useCallback(
    (origin: RouteOrigin) => {
      applyRouteOriginAndPreview(origin);
    },
    [applyRouteOriginAndPreview],
  );

  const handleStartOriginPick = useCallback(() => {
    setShowOriginSetup(false);
    setOriginPickMode(true);
    showToast("Tap the map to set your starting point");
  }, []);

  const handleOriginMapPick = useCallback(
    async (lat: number, lng: number) => {
      let name = "Custom start point";
      let address: string | undefined;
      try {
        const details = await liveGeocodingReverse(lat, lng);
        if (details) {
          name = details.name || details.display_name?.split(",")[0]?.trim() || name;
          address = details.display_name;
        }
      } catch {
        // Reverse geocode is optional for map pick.
      }
      applyRouteOriginAndPreview(buildMapPickRouteOrigin(lat, lng, name, address));
    },
    [applyRouteOriginAndPreview],
  );

  const handleNearbySearch = useCallback(async (query: string) => {
    setSelectedPlace(null);
    setDestination(null);
    setLiveStage("static_landing");
    setToast(null);
    setViewingDetailsFromNearby(false);

    setShowSearchPopup(false);
    setShowSuggestionsCard(false);

    setNearbyCategory(resolveLiveSearchCategory(query)?.key ?? query);
    setNearbyLoading(true);
    setNearbyError(null);
    setNearbyResults([]);
    setExpandedResultIndex(null);

    // reset rovi explanation states
    setRoviExplanation(null);
    setRoviExplanationError(null);
    setRoviExplanationLoading(false);

    // Clear teal clicked-pin when starting a fresh nearby search
    mapRef.current?.clearClickedPin();

    // Record category search in recent searches
    recordRecentSearch(buildCategoryRecentSearch(query), currentUserId);
    refreshRecentSearches();

    const anchor = resolveAnchorCoordinate();
    if (!anchor) {
      setNearbyError("Move the map to choose an area first.");
      setNearbyLoading(false);
      return;
    }

    if (anchor.source === "map" || anchor.source === "destination") {
      setSearchAnchorHint("Searching this map area");
      logRovvyGps("fallback used", { source: anchor.source });
    } else if (anchor.source === "gps" && gpsStatus === "approximate") {
      setSearchAnchorHint("Using approximate location");
    } else {
      setSearchAnchorHint(null);
    }

    try {
      const limit = nearbyResultLimitForScreen();
      const categoryKey = resolveLiveSearchCategory(query)?.key ?? query;
      const results = await searchNearbyPlaces(categoryKey, anchor, limit);
      setNearbyResults(results);
      fitMapToNearbyResults(mapRef.current, results);
    } catch (err) {
      setNearbyError("Nearby search is unavailable right now.");
    } finally {
      setNearbyLoading(false);
    }
  }, [resolveAnchorCoordinate, currentUserId, refreshRecentSearches, gpsStatus]);

  const instantSuggestions = useMemo(
    () => filterInstantSuggestions(searchQuery, recentSearches, 8),
    [searchQuery, recentSearches],
  );

  const detectedSearchCategory = useMemo(
    () => resolveLiveSearchCategory(searchQuery),
    [searchQuery],
  );

  const detectedPastedLocation = useMemo(
    () => parsePastedLocation(searchQuery),
    [searchQuery],
  );

  const addPlaceAsRouteStop = useCallback((place: PlacePreviewData) => {
    if (!destination) {
      showToast("Set a destination first, then add stops.");
      return;
    }
    if (
      place.placeKey &&
      destination.placeKey &&
      place.placeKey === destination.placeKey
    ) {
      showToast("This is already your destination.");
      return;
    }
    if (
      Math.abs(place.lat - destination.lat) < 0.00005 &&
      Math.abs(place.lng - destination.lng) < 0.00005
    ) {
      showToast("This is already your destination.");
      return;
    }
    let added = false;
    setPlannedStops((prev) => {
      const duplicate = prev.some(
        (stop) =>
          (stop.placeKey && place.placeKey && stop.placeKey === place.placeKey) ||
          (Math.abs(stop.lat - place.lat) < 0.00005 &&
            Math.abs(stop.lng - place.lng) < 0.00005),
      );
      if (duplicate) return prev;
      added = true;
      return [...prev, place];
    });
    if (!added) {
      showToast("That stop is already on your route.");
      return;
    }
    setAddStopMode(false);
    setTripStatus("on_the_way");
    showToast(`Stop added: ${place.name}`);
  }, [destination]);

  const dismissPlacePreviewForLive = useCallback(() => {
    setViewingDetailsFromNearby(false);
    setSelectedPlace(null);
    setNearbyResults(null);
    setNearbyCategory(null);
    setExpandedResultIndex(null);
    mapRef.current?.clearClickedPin();
  }, []);

  const handleCloseNearbyResults = useCallback(() => {
    setNearbyResults(null);
    setNearbyCategory(null);
    setNearbyError(null);
    setSearchAnchorHint(null);
    setExpandedResultIndex(null);
    setViewingDetailsFromNearby(false);
  }, []);

  const handleResultClick = useCallback(async (result: PlacePreviewData) => {
    if (addStopMode && isLiveActive && destination) {
      const enriched = await enrichPlaceForTravel(result);
      addPlaceAsRouteStop(enriched);
      return;
    }

    mapRef.current?.flyToPlace(result.lat, result.lng, 15);
    setLoadingPlaceDetails(true);
    setPlaceMediaLoading(true);
    const enriched = await enrichPlaceForTravel(result);
    const categoryLabel = resolveCategoryLabelFromPlace(enriched);
    const withCategory = { ...enriched, categoryLabel };
    setSelectedPlace(withCategory);
    setViewingDetailsFromNearby(true);
    setLiveStage("place_preview");
    recordRecentSearch(buildPlaceRecentSearch(withCategory), currentUserId);
    refreshRecentSearches();

    void resolvePlaceMedia(withCategory).then((resolution: PlaceMediaResolution) => {
      setSelectedPlace((prev) => {
        if (!prev || prev.lat !== withCategory.lat || prev.lng !== withCategory.lng) return prev;
        return { ...prev, placeKey: resolution.placeKey };
      });
      setPlaceMedia(resolution.media);
      setPlaceTags(resolution.tags);
      setPlaceMediaLoading(false);
    });

    try {
      const details = await liveGeocodingReverse(withCategory.lat, withCategory.lng);
      if (details) {
        const reverseGeo = extractCityCountry(details.address);
        setSelectedPlace((prev) => {
          if (!prev || prev.lat !== withCategory.lat || prev.lng !== withCategory.lng) return prev;
          return {
            ...prev,
            name: details.name || prev.name,
            categoryLabel: normalizePlaceCategory(details) || prev.categoryLabel,
            address: formatStreetAddress(details.address, details.display_name || prev.address),
            city: reverseGeo.city ?? prev.city,
            state: details.address?.state ?? prev.state,
            country: reverseGeo.country ?? prev.country,
          };
        });
      }
    } finally {
      setLoadingPlaceDetails(false);
    }

    kickRoutePreview(withCategory, { fitMap: true });
  }, [currentUserId, refreshRecentSearches, addStopMode, isLiveActive, destination, addPlaceAsRouteStop, kickRoutePreview]);

  const handleAddStopFromNearby = useCallback((result: PlacePreviewData) => {
    addPlaceAsRouteStop(result);
    setExpandedResultIndex(null);
  }, [addPlaceAsRouteStop]);

  const handleViewDetailsFromNearby = useCallback((result: PlacePreviewData) => {
    setSelectedPlace(result);
    setViewingDetailsFromNearby(true);
    setShowPlaceDetailsPanel(true);
  }, []);

  const handleMakeDestinationFromNearby = useCallback(async (result: PlacePreviewData) => {
    const enriched = await enrichPlaceForTravel(result);
    setDestination(enriched);
    setLiveStage("destination_set");
    setIsLiveActive(false);
    setExpandedResultIndex(null);
    setNearbyResults(null);
    setNearbyCategory(null);
    showToast(`Destination changed to ${enriched.name}.`);
    kickRoutePreview(enriched);
  }, [kickRoutePreview]);

  const handleSavePlaceFromNearby = useCallback(() => {
    showToast("Place saved.");
    setExpandedResultIndex(null);
  }, []);

  const handleSelectNearbyPlaceAtClick = useCallback((poi: PlacePreviewData) => {
    setSelectedPlace(poi);
    setNearbyPlacesAtClick(null);
  }, []);

  const selectDestination = useCallback(async (
    place: PlacePreviewData,
    options?: {
      origin?: "search" | "map_click";
      clickLat?: number;
      clickLng?: number;
      openDetailsPanel?: boolean;
    },
  ) => {
    const lat = place.lat;
    const lng = place.lng;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      showToast("Invalid place location.");
      return;
    }

    if (addStopMode && isLiveActive && destination) {
      addPlaceAsRouteStop(place);
      return;
    }

    logRovvyLiveDebug("[Rovvy Live Search] selectDestination", {
      place,
      targetLocation: { lat, lng },
      origin: options?.origin,
    });

    setDestination(null);
    setIsLiveActive(false);
    setActiveRoute(null);
    setRoutePreviewStatus("idle");
    setRoutePreviewError(null);
    setRouteLoading(false);
    lastFetchedRouteRef.current = null;
    setRouteOrigin(null);
    setOriginPickMode(false);
    setShowOriginSetup(false);
    setShowPlaceDetailsPanel(Boolean(options?.openDetailsPanel));
    setCoordinateOverlay(null);
    setMapClickPin(null);
    setViewingDetailsFromNearby(false);
    setNearbyResults(null);
    setNearbyCategory(null);
    setNearbyError(null);
    setExpandedResultIndex(null);
    setShowSearchPopup(false);
    setShowSuggestionsCard(false);
    setSearchResults([]);
    setSearchNeedsLocation(false);
    setRoviExplanation(null);
    setRoviExplanationError(null);
    setRoviExplanationLoading(false);
    setPlaceMedia([]);
    setPlaceTags([]);
    setPlaceMediaLoading(true);

    if (options?.origin === "search") {
      setClickedLocation(null);
      setNearbyPlacesAtClick(null);
      mapRef.current?.clearClickedPin();
    } else if (options?.origin === "map_click") {
      setClickedLocation({
        lat: options.clickLat ?? lat,
        lng: options.clickLng ?? lng,
      });
    }

    setSelectedPlace(place);
    setLiveStage("place_preview");
    setSearchQuery(place.name);
    setLoadingPlaceDetails(true);
    mapRef.current?.flyToPlace(lat, lng, 12);

    recordRecentSearch(
      place.source === "dropped_pin"
        ? buildDroppedPinRecentSearch(lat, lng, place.address)
        : buildPlaceRecentSearch(place),
      currentUserId,
    );
    refreshRecentSearches();

    void resolvePlaceMedia(place).then((resolution: PlaceMediaResolution) => {
      setSelectedPlace((prev) => {
        if (!prev || prev.lat !== lat || prev.lng !== lng) return prev;
        return { ...prev, placeKey: resolution.placeKey };
      });
      setPlaceMedia(resolution.media);
      setPlaceTags(resolution.tags);
      setPlaceMediaLoading(false);
    });

    try {
      let resolvedPlace = place;
      if (place.source !== "map_pick") {
        const details = await liveGeocodingReverse(lat, lng);
        if (details) {
          const hours = details.extratags?.opening_hours;
          const reverseGeo = extractCityCountry(details.address);
          const nextOsmType = details.osm_type ?? place.osmType;
          const nextOsmId = details.osm_id ?? place.osmId;
          const nextCity = reverseGeo.city ?? place.city;
          const nextCountry = reverseGeo.country ?? place.country;
          const nextKey = buildPlaceKey({
            name: details.name || place.name,
            lat,
            lng,
            city: nextCity,
            country: nextCountry,
            osmType: nextOsmType,
            osmId: nextOsmId,
          });
          resolvedPlace = {
            ...place,
            name: resolvePlaceDisplayName(details.name || place.name, {
              city: nextCity,
              state: details.address?.state ?? place.state,
              country: nextCountry,
              address: formatStreetAddress(details.address, details.display_name || place.address),
            }),
            categoryLabel:
              normalizePlaceCategory(details) ||
              (details.extratags ? normalizePlaceCategory(details.extratags) : null) ||
              (details.name || place.name ? "Place" : "Address") ||
              place.categoryLabel,
            address: formatStreetAddress(details.address, details.display_name || place.address),
            phone: extractPhone(details.extratags),
            openingHours: hours ?? null,
            openStatus: parseOpenStatus(hours),
            osmType: nextOsmType,
            osmId: nextOsmId,
            city: nextCity,
            state: details.address?.state ?? place.state,
            country: nextCountry,
            placeKey: nextKey,
          };
          setSelectedPlace(resolvedPlace);
        }
      }
    } finally {
      setLoadingPlaceDetails(false);
    }

    kickRoutePreview(place, { fitMap: true });
  }, [currentUserId, refreshRecentSearches, addStopMode, isLiveActive, destination, addPlaceAsRouteStop, kickRoutePreview]);

  const selectDestinationFromPlace = selectDestination;

  const zoomToMapTap = useCallback(
    (payload: Pick<MapClickPayload, "lat" | "lng">) => {
      setViewingDetailsFromNearby(false);
      setShowSearchPopup(false);
      setShowSuggestionsCard(false);
      setNearbyResults(null);
      setNearbyCategory(null);
      setNearbyError(null);
      setExpandedResultIndex(null);
      resetRoviExplanation();
      setNearbyPlacesAtClick(null);
      setCoordinateOverlay(null);
      setMapClickPin({ lat: payload.lat, lng: payload.lng });
      setAttributionFocus({ lat: payload.lat, lng: payload.lng, pinned: true });
      setAttributionRefreshedAt(new Date());
      const maxZoom = getLiveMapMaxZoom(activeLayer, { travelLayerEnabled });
      mapRef.current?.flyToPlace(payload.lat, payload.lng, maxZoom);
    },
    [activeLayer, travelLayerEnabled],
  );

  const resolveMapClickPlace = useCallback(
    (payload: MapClickPayload): PlacePreviewData => {
      const top = payload.features
        .map((feature) => ({ feature, score: scoreFeature(feature) }))
        .sort((a, b) => b.score - a.score)[0];
      if (top && top.score >= 40) {
        return mapLabelFeatureToPlacePreview(
          top.feature,
          payload.lat,
          payload.lng,
          userLocation,
        );
      }
      return buildDroppedPinPlace(payload.lat, payload.lng, userLocation);
    },
    [userLocation],
  );

  const openMapTapPreview = useCallback(
    (payload: MapClickPayload) => {
      closeMapLocationSheet();
      setAttributionFocus({ lat: payload.lat, lng: payload.lng, pinned: true });
      setAttributionRefreshedAt(new Date());

      if (
        selectedPlace &&
        !showPlaceDetailsPanel &&
        haversineM(selectedPlace.lat, selectedPlace.lng, payload.lat, payload.lng) < 25
      ) {
        setShowPlaceDetailsPanel(true);
        setLiveStage("place_preview");
        mapRef.current?.flyToPlace(selectedPlace.lat, selectedPlace.lng, 14);
        return;
      }

      const place = resolveMapClickPlace(payload);
      emitWayraPlacePicked({
        lat: payload.lat,
        lng: payload.lng,
        name: place.name ?? null,
      });
      void selectDestination(place, {
        origin: "map_click",
        clickLat: payload.lat,
        clickLng: payload.lng,
        openDetailsPanel: true,
      });
    },
    [
      closeMapLocationSheet,
      resolveMapClickPlace,
      selectDestination,
      selectedPlace,
      showPlaceDetailsPanel,
    ],
  );

  const handleMapDoubleClick = useCallback(
    (payload: Omit<MapClickPayload, "features">) => {
      if (isLiveActive) {
        if (originPickMode) {
          void handleOriginMapPick(payload.lat, payload.lng);
          return;
        }
        if (addStopMode) {
          void enrichPlaceForTravel(mapPointToPlace({ lat: payload.lat, lng: payload.lng })).then(
            addPlaceAsRouteStop,
          );
          return;
        }
      }
      if (originPickMode) {
        void handleOriginMapPick(payload.lat, payload.lng);
        return;
      }
      zoomToMapTap({ lat: payload.lat, lng: payload.lng });
    },
    [
      isLiveActive,
      originPickMode,
      addStopMode,
      handleOriginMapPick,
      mapPointToPlace,
      addPlaceAsRouteStop,
      zoomToMapTap,
    ],
  );

  const handleMapClick = useCallback(
    (payload: MapClickPayload) => {
      if (isLiveActive) {
        if (originPickMode) {
          void handleOriginMapPick(payload.lat, payload.lng);
          return;
        }
        if (addStopMode) {
          void enrichPlaceForTravel(mapPointToPlace({ lat: payload.lat, lng: payload.lng })).then(
            addPlaceAsRouteStop,
          );
          return;
        }
      }

      if (originPickMode) {
        void handleOriginMapPick(payload.lat, payload.lng);
        return;
      }

      openMapTapPreview(payload);
    },
    [
      isLiveActive,
      originPickMode,
      addStopMode,
      handleOriginMapPick,
      mapPointToPlace,
      addPlaceAsRouteStop,
      openMapTapPreview,
    ],
  );

  const selectPlace = useCallback(async (result: AutocompleteResult) => {
    const anchor = resolveSearchAnchor();
    await selectDestination(
      autocompleteResultToPlacePreview(result, anchor ?? userLocation),
      { origin: "search" },
    );
  }, [selectDestination, resolveSearchAnchor, userLocation]);

  const searchPlaceByName = useCallback(
    async (name: string) => {
      setSearchQuery(name);
      setShowSearchPopup(false);
      setShowSuggestionsCard(false);
      setSearchError(null);

      const category = resolveLiveSearchCategory(name);
      if (category) {
        void handleNearbySearch(category.key);
        return;
      }

      const pasted = parsePastedLocation(name);
      if (pasted) {
        setSearchLoading(true);
        setSearchNeedsLocation(false);
        try {
          if (pasted.kind === "coordinates" && pasted.lat != null && pasted.lng != null) {
            const lat = pasted.lat;
            const lng = pasted.lng;
            let placeName = pasted.label;
            let address = pasted.label;
            let categoryLabel = "Pasted location";
            try {
              const details = await liveGeocodingReverse(lat, lng);
              if (details?.display_name) {
                address = details.display_name;
                placeName = details.name || details.display_name.split(",")[0] || placeName;
                categoryLabel = details.type?.replace(/_/g, " ") || categoryLabel;
              }
            } catch {
              // Reverse geocode is optional for pasted coordinates.
            }
            await selectDestination(
              {
                name: placeName,
                categoryLabel,
                address,
                phone: null,
                lat,
                lng,
                distanceM: userLocation ? haversineM(userLocation.lat, userLocation.lng, lat, lng) : null,
                openingHours: null,
                openStatus: null,
                placeKey: undefined,
                osmType: null,
                osmId: null,
                city: null,
                country: null,
                source: "search",
                tags: {},
              },
              { origin: "search" },
            );
            return;
          }

          if (pasted.kind === "address" && pasted.address) {
            const anchor = resolveSearchAnchor();
            const results = await liveAutocompleteSearch(pasted.address, anchor ?? undefined);
            const best = results[0];
            if (best) {
              await selectPlace(best);
            } else {
              setSearchResults([]);
              setToast("Could not find that pasted location. Try a shorter address.");
              window.setTimeout(() => setToast(null), 3200);
            }
            return;
          }
        } catch {
          setSearchError("Search is unavailable right now.");
          setSearchResults([]);
        } finally {
          setSearchLoading(false);
        }
        return;
      }

      setSearchLoading(true);
      setSearchNeedsLocation(false);
      try {
        const anchor = resolveSearchAnchor();
        if (!anchor) {
          setSearchNeedsLocation(true);
          setSearchResults([]);
          return;
        }
        const results = await liveAutocompleteSearch(name, anchor);
        const best = results[0];
        if (best) {
          await selectPlace(best);
        } else {
          setSearchResults([]);
          setToast("No nearby places found. Try a different search.");
          window.setTimeout(() => setToast(null), 3200);
        }
      } catch {
        setSearchError("Search is unavailable right now.");
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    },
    [resolveSearchAnchor, selectPlace, handleNearbySearch, selectDestination, userLocation],
  );

  const handleInstantSuggestionClick = useCallback(
    (item: RecentSearchItem) => {
      setShowSearchPopup(false);
      setShowSuggestionsCard(false);

      if (item.type === "category_search" && item.query) {
        setSearchQuery(item.label);
        void handleNearbySearch(item.query);
        return;
      }

      if (
        (item.type === "place" ||
          item.type === "destination" ||
          item.type === "dropped_pin") &&
        item.lat != null &&
        item.lng != null
      ) {
        setSearchQuery(item.label);
        void selectDestination(
          {
            name: item.label,
            categoryLabel: item.category ?? item.subtitle ?? "Place",
            address: item.address ?? "",
            phone: null,
            lat: item.lat,
            lng: item.lng,
            distanceM: null,
            openingHours: null,
            openStatus: null,
            placeKey: item.placeKey,
            osmType: null,
            osmId: null,
            city: null,
            country: null,
            source: item.source ?? "recent",
            tags: {},
          },
          { origin: "search" },
        );
        return;
      }

      if (item.query) {
        setSearchQuery(item.query);
        void searchPlaceByName(item.query);
      }
    },
    [handleNearbySearch, selectDestination, searchPlaceByName],
  );

  useEffect(() => {
    if (!showSearchPopup && !showSuggestionsCard) return;
    const handleDocumentClick = (e: MouseEvent) => {
      const container = document.getElementById("search-container");
      if (container && !container.contains(e.target as Node)) {
        setShowSearchPopup(false);
        setShowSuggestionsCard(false);
      }
    };
    document.addEventListener("click", handleDocumentClick);
    return () => {
      document.removeEventListener("click", handleDocumentClick);
    };
  }, [showSearchPopup, showSuggestionsCard]);

  // ─── Load user ID + hydrate recent searches from localStorage ──────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedUserId = localStorage.getItem("gt_avatar_user_id") ?? null;
    setCurrentUserId(storedUserId);
    const saved = getRecentSearches(5, storedUserId);
    setRecentSearches(saved);
  }, []);

  useEffect(() => {
    if (selectedPlace) {
      window.dispatchEvent(new CustomEvent("minimize-rovvy-lounge"));
    }
  }, [selectedPlace]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults((prev) => (prev.length ? [] : prev));
      setSearchNeedsLocation(false);
      setSearchError(null);
      return;
    }

    if (searchQuery.trim().length < 2) {
      setSearchResults((prev) => (prev.length ? [] : prev));
      setSearchNeedsLocation(false);
      setSearchError(null);
      return;
    }

    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    searchDebounceRef.current = setTimeout(async () => {
      const anchor = resolveSearchAnchor();
      if (!anchor) {
        setSearchNeedsLocation(true);
        setSearchResults([]);
        setSearchError(null);
        setSearchLoading(false);
        return;
      }

      if (isExactCategoryQuery(searchQuery)) {
        setSearchNeedsLocation(false);
        setSearchError(null);
        setSearchResults([]);
        setSearchLoading(false);
        return;
      }

      setSearchNeedsLocation(false);
      setSearchError(null);
      setSearchLoading(true);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      try {
        const results = await liveAutocompleteSearch(
          searchQuery,
          anchor,
          abortControllerRef.current.signal,
        );
        const map = mapRef.current;
        const mapResults =
          map?.supportsLabelSearch() && map
            ? map.searchMapLabels(searchQuery, anchor, 6)
            : [];
        setSearchResults(mergeAutocompleteResults(results, mapResults));
        setSearchError(null);
      } catch (err: any) {
        if (err.name !== "AbortError") {
          setSearchResults([]);
          setSearchError(
            err?.message?.includes("Could not reach") || err?.message?.includes("Network error")
              ? "Search server unreachable. Is the backend running on port 8000?"
              : "Search is unavailable right now.",
          );
        }
      } finally {
        setSearchLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery, resolveSearchAnchor]);

  useEffect(() => {
    const timer = window.setTimeout(() => mapRef.current?.locateUser(), 600);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const viewMode = mapRef.current?.getViewMode();
      if (viewMode) setMapViewMode(viewMode);
    }, 500);
    return () => window.clearInterval(timer);
  }, []);

  const handleBearingChange = useCallback((bearing: number) => {
    setMapBearing(Math.round(bearing));
  }, []);

  const handleZoomChange = useCallback((zoom: number) => {
    setMapZoom(zoom);
    setAttributionRefreshedAt(new Date());
  }, []);

  const handleMaxZoomCapChange = useCallback((maxZoom: number) => {
    setMapMaxZoom(maxZoom);
  }, []);

  const handleMapInteraction = useCallback((interacting: boolean) => {
    setIsMapInteracting((prev) => (prev === interacting ? prev : interacting));
  }, []);

  const handleMapCenterChange = useCallback((center: { lat: number; lng: number }) => {
    setAttributionRefreshedAt(new Date());
    setAttributionFocus((prev) => {
      if (prev?.pinned) return prev;
      return { lat: center.lat, lng: center.lng };
    });
  }, []);

  const handleToggleViewMode = useCallback(() => {
    const next: LiveMapViewMode = mapViewMode === "2d" ? "3d" : "2d";
    mapRef.current?.setViewMode(next);
    setMapViewMode(next);
  }, [mapViewMode]);

  useEffect(() => {
    if (isFreshGpsStatus(gpsStatus)) {
      setShowGpsHelper(false);
    }
  }, [gpsStatus]);

  // Check geolocation permission state on mount and reflect it in gpsStatus immediately
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.permissions) return;
    navigator.permissions.query({ name: "geolocation" as PermissionName }).then((result) => {
      logRovvyGps("permission state", { state: result.state });
      if (result.state === "denied") {
        setGpsState((prev) => ({ ...prev, status: "denied" }));
      } else if (result.state === "granted") {
        setGpsState((prev) => ({ ...prev, status: "requesting" }));
      }
      result.onchange = () => {
        logRovvyGps("permission state changed", { state: result.state });
        if (result.state === "denied") {
          setGpsState((prev) => ({ ...prev, status: "denied" }));
        } else if (result.state === "granted" && gpsStatusRef.current !== "active") {
          mapRef.current?.locateUser(true);
        }
      };
    }).catch(() => {
      // permissions API not available — silent fallback
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (userLocation) {
      setSearchBias(userLocation);
    }
  }, [userLocation]);

  // Auto-update process when arriving at destination during Solo Live
  useEffect(() => {
    if (!isLiveActive || !destination || !userLocation) return;
    const distM = haversineM(
      userLocation.lat,
      userLocation.lng,
      destination.lat,
      destination.lng,
    );
    if (distM <= 150 && tripStatus !== "reached") {
      setTripStatus("reached");
    } else if (distM > 250 && tripStatus === "reached" && !addStopMode) {
      setTripStatus("on_the_way");
    }
  }, [isLiveActive, destination, userLocation, tripStatus, addStopMode]);

  useEffect(() => {
    if (!userLocation) return;
    let cancelled = false;
    void (async () => {
      const reverse = await liveGeocodingReverse(userLocation.lat, userLocation.lng);
      if (cancelled || !reverse?.address) return;
      setUserRegion({
        lat: userLocation.lat,
        lng: userLocation.lng,
        city:
          reverse.address.city ||
          reverse.address.town ||
          reverse.address.village ||
          undefined,
        state: reverse.address.state,
        country: reverse.address.country,
      });
      userRegionLoadedRef.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, [userLocation]);

  useEffect(() => {
    return () => {
      if (searchBlurRef.current) clearTimeout(searchBlurRef.current);
    };
  }, []);

  useEffect(() => {
    const previewTarget = destination ?? selectedPlace;
    if (previewTarget) {
      kickRoutePreviewRef.current(previewTarget, { fitMap: false });
    }
  }, [travelMode, destination?.lat, destination?.lng, destination?.placeKey, selectedPlace?.lat, selectedPlace?.lng, selectedPlace?.placeKey]);

  useEffect(() => {
    if (viewingDetailsFromNearby) {
      setShowPlaceDetailsPanel(true);
    }
  }, [viewingDetailsFromNearby]);

  useEffect(() => {
    const refocusSelectedPlaceOnMap = () => {
      if (document.visibilityState !== "visible") return;
      mapRef.current?.restoreMapOverlays();
      if (!showPlaceDetailsPanel || !selectedPlace) return;
      mapRef.current?.flyToPlace(selectedPlace.lat, selectedPlace.lng, 14);
    };

    document.addEventListener("visibilitychange", refocusSelectedPlaceOnMap);
    window.addEventListener("focus", refocusSelectedPlaceOnMap);
    return () => {
      document.removeEventListener("visibilitychange", refocusSelectedPlaceOnMap);
      window.removeEventListener("focus", refocusSelectedPlaceOnMap);
    };
  }, [showPlaceDetailsPanel, selectedPlace?.lat, selectedPlace?.lng]);

  function resetRoviExplanation() {
    setRoviExplanation(null);
    setRoviExplanationError(null);
    setRoviExplanationLoading(false);
  }

  function placeToContextInput(place: PlacePreviewData) {
    return {
      name: place.name,
      address: place.address,
      lat: place.lat,
      lng: place.lng,
      city: place.city ?? undefined,
      state: place.state ?? undefined,
      country: place.country ?? undefined,
      category: place.categoryLabel,
      hasOpeningHours: Boolean(place.openingHours || place.openStatus),
      source: place.source,
    };
  }

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 3200);
  }

  function updatePlaceDistance(
    place: PlacePreviewData,
    loc: { lat: number; lng: number },
  ): PlacePreviewData {
    return {
      ...place,
      distanceM: haversineM(loc.lat, loc.lng, place.lat, place.lng),
    };
  }

  function handleGpsStateChange(newState: GpsState) {
    logRovvyLiveDebug("[Rovvy Debug] gpsState after update:", newState);
    setGpsState(newState);

    if (newState.status === "stale" && gpsState.status !== "stale") {
      showToast("GPS signal stale, re-acquiring…");
    }

    if (newState.lat !== null && newState.lng !== null) {
      const loc = { lat: newState.lat, lng: newState.lng };
      setSelectedPlace((prev) => (prev ? updatePlaceDistance(prev, loc) : prev));
      setDestination((prev) => (prev ? updatePlaceDistance(prev, loc) : prev));
      setRouteOrigin((prev) => {
        if (!prev || prev.source === "gps" || prev.source === "map_center") {
          const next = buildGpsRouteOrigin(newState.lat!, newState.lng!, newState.accuracyMeters);
          return routeOriginsEquivalent(prev, next) ? prev : next;
        }
        return prev;
      });
    }

    if (newState.accuracyMeters && newState.accuracyMeters > 500 && !lowAccuracyToastShownRef.current) {
      lowAccuracyToastShownRef.current = true;
      showToast("Your location may be approximate.");
    }
  }

  function handleClosePlaceDetails() {
    setShowPlaceDetailsPanel(false);
    setViewingDetailsFromNearby(false);
  }

  function clearSelectedPlace() {
    setSelectedPlace(null);
    setClickedLocation(null);
    setNearbyPlacesAtClick(null);
    setPlaceMedia([]);
    setPlaceTags([]);
    setPlaceMediaLoading(false);
    resetRoviExplanation();
    setViewingDetailsFromNearby(false);
    setShowPlaceDetailsPanel(false);
    setMapClickPin(null);
    setCoordinateOverlay(null);
    setActiveRoute(null);
    setRoutePreviewStatus("idle");
    setRoutePreviewError(null);
    setRouteLoading(false);
    lastFetchedRouteRef.current = null;
    setRouteOrigin(null);
    mapRef.current?.clearClickedPin();

    if (isLiveActive) return;
    setDestination(null);
    setLiveStage("static_landing");
    setSearchQuery("");
  }

  function requireSolo(): boolean {
    if (workflowType === "Solo") return true;
    showToast("Solo flow only in this version.");
    return false;
  }

  function handleMakeDestination() {
    if (!requireSolo() || !selectedPlace) return;
    setDestination(selectedPlace);
    setIsLiveActive(false);
    setLiveStage("destination_set");
    mapRef.current?.clearClickedPin();
    recordRecentSearch(
      { ...buildPlaceRecentSearch(selectedPlace), type: "destination" },
      currentUserId,
    );
    refreshRecentSearches();
    kickRoutePreview(selectedPlace, { fitMap: true, refreshGps: true });
  }

  function handleStartFromPlacePreview() {
    handleMakeDestination();
  }

  function activateRouteForNavigation() {
    setActiveRoute((prev) => (prev ? { ...prev, active: true } : prev));
  }

  function startWazeNavigation() {
    setMapViewMode("3d");
    mapRef.current?.setViewMode("3d");
    mapRef.current?.enterNavigationView();
    mapRef.current?.locateUser(true);
  }

  function handleGetDirections() {
    if (!requireSolo() || !selectedPlace) return;
    if (routePreviewStatus !== "ready" || !activeRoute) {
      showToast(routePreviewError || "Route unavailable right now.");
      return;
    }
    const dest = selectedPlace;
    setDestination(dest);
    dismissPlacePreviewForLive();
    setIsLiveActive(true);
    setLiveStage("solo_drive_navigation");
    setTripStatus("on_the_way");
    mapRef.current?.clearClickedPin();
    recordRecentSearch(
      { ...buildPlaceRecentSearch(dest), type: "destination" },
      currentUserId,
    );
    refreshRecentSearches();
    activateRouteForNavigation();
    startWazeNavigation();
  }

  function handleContinueFromPreview() {
    if (!requireSolo() || !selectedPlace) return;
    handleMakeDestination();
  }

  function handleContinueAnyway() {
    handleContinueFromPreview();
  }

  function handleSearchNearMe() {
    if (selectedPlace) {
      setClickedLocation({ lat: selectedPlace.lat, lng: selectedPlace.lng });
      setSearchBias({ lat: selectedPlace.lat, lng: selectedPlace.lng });
    }
    setSelectedPlace(null);
    setDestination(null);
    setLiveStage("static_landing");
    setSearchQuery("");
    setSearchResults([]);
    setShowSearchPopup(true);
    window.setTimeout(() => searchInputRef.current?.focus(), 120);
  }

  function handlePlanTrip() {
    showToast("Plan this as a future trip.");
    router.push("/trips/plan");
  }

  function handleStartSoloLive() {
    if (!requireSolo() || !destination) return;
    if (routePreviewStatus !== "ready" || !activeRoute) {
      showToast(routePreviewError || "Route unavailable right now.");
      return;
    }
    dismissPlacePreviewForLive();
    setIsLiveActive(true);
    setLiveStage("solo_drive_navigation");
    setTripStatus("on_the_way");
    activateRouteForNavigation();
    startWazeNavigation();
  }

  function handleChangeDestination() {
    setDestination(null);
    setActiveRoute(null);
    setRoutePreviewStatus("idle");
    setRoutePreviewError(null);
    setRouteLoading(false);
    setRouteOrigin(null);
    setOriginPickMode(false);
    setShowOriginSetup(false);
    setIsLiveActive(false);
    setLiveStage(selectedPlace ? "place_preview" : "static_landing");
  }

  function handleRetryRoutePreview() {
    if (!destination) return;
    kickRoutePreview(destination);
  }

  function handleBeginNavigation() {
    if (!requireSolo() || !destination) return;
    if (routePreviewStatus !== "ready" || !activeRoute) {
      showToast(routePreviewError || "Route unavailable right now.");
      return;
    }
    dismissPlacePreviewForLive();
    setLiveStage("solo_drive_navigation");
    setIsLiveActive(true);
    setTripStatus("on_the_way");
    activateRouteForNavigation();
    startWazeNavigation();
  }

  function handleRouteOverview() {
    if (activeRoute) {
      mapRef.current?.fitBounds([
        [activeRoute.from.lng, activeRoute.from.lat],
        [activeRoute.to.lng, activeRoute.to.lat]
      ]);
    }
  }

  function handleEndSoloLive() {
    setIsLiveActive(false);
    setAddStopMode(false);
    setTripStatus("on_the_way");
    setMapViewMode("2d");
    mapRef.current?.setViewMode("2d");

    setLiveStage("destination_set");
    showToast("Solo Live ended.");
  }

  function handleAddStopFromPreview() {
    if (!requireSolo() || !selectedPlace) return;
    addPlaceAsRouteStop(selectedPlace);
  }

  function handleAddStopFromLive() {
    if (!destination) return;
    setAddStopMode(true);
    setTripStatus("stopping");
    setShowSearchPopup(true);
    searchInputRef.current?.focus();
    showToast("Search or tap the map to add a stop.");
  }

  function handleLocateClick() {
    if (gpsStatus === "denied") {
      const center = mapRef.current?.getMapCenter();
      if (center) {
        void openMapLocationSheet(center.lat, center.lng, { manual: true });
      } else {
        setShowOriginSetup(true);
      }
      mapRef.current?.locateUser(false);
      return;
    }
    mapRef.current?.locateUser(true);
  }

  function handleSheetSetStartingPoint(point: MapLocationSheetPoint) {
    closeMapLocationSheet();
    applyRouteOriginAndPreview(
      buildMapPickRouteOrigin(
        point.lat,
        point.lng,
        point.name || "Starting point",
        point.address,
      ),
    );
    showToast("Starting point set.");
  }

  function handleSheetSetDestination(point: MapLocationSheetPoint) {
    closeMapLocationSheet();
    const place = mapPointToPlace(point);
    if (isLiveActive) {
      setDestination(place);
      kickRoutePreview(place);
      showToast(`Destination updated to ${place.name}.`);
      return;
    }
    void selectDestination(place, { origin: "search" });
  }

  function handleSheetAddStop(point: MapLocationSheetPoint) {
    closeMapLocationSheet();
    addPlaceAsRouteStop(mapPointToPlace(point));
  }

  async function handleSheetCopyCoordinates(point: MapLocationSheetPoint) {
    const text = `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`;
    try {
      await navigator.clipboard.writeText(text);
      showToast("Coordinates copied.");
    } catch {
      showToast(text);
    }
  }

  function handleSheetSavePlace(point: MapLocationSheetPoint) {
    closeMapLocationSheet();
    const place = mapPointToPlace(point);
    recordRecentSearch(buildPlaceRecentSearch(place), currentUserId);
    refreshRecentSearches();
    showToast("Place saved to recent.");
  }

  function handleUseMapArea() {
    setShowGpsHelper(false);
    logRovvyGps("fallback used", { source: "map", manual: true });
  }

  function handleGpsStatusBadgeClick() {
    if (gpsStatusNeedsHelper(gpsStatus)) {
      setShowGpsHelper((prev) => !prev);
    }
  }

  const isNavigating = liveStage === "solo_drive_navigation";
  const isLongDistancePreview = liveStage === "long_distance_preview";
  const roviTargetPlace = selectedPlace ?? destination;
  const locationContext: LiveLocationContext | null = useMemo(() => {
    if (!roviTargetPlace) return null;
    return buildLocationContext({
      userLocation: userRegion ?? userLocation,
      selectedPlace: placeToContextInput(roviTargetPlace),
      workflowType,
      travelMode,
      liveStage,
    });
  }, [roviTargetPlace, userRegion, userLocation, workflowType, travelMode, liveStage]);

  async function handleAskRovi() {
    if (!locationContext) return;

    const cacheKey = buildRoviCacheKey(locationContext.compact);
    const cached = roviExplanationCacheRef.current.get(cacheKey);
    if (cached) {
      setRoviExplanation(cached);
      setRoviExplanationError(null);
      return;
    }

    setRoviExplanationLoading(true);
    setRoviExplanationError(null);
    try {
      const result = await fetchRoviPlaceExplanation(locationContext.compact);
      roviExplanationCacheRef.current.set(cacheKey, result);
      setRoviExplanation(result);
    } catch {
      setRoviExplanation({
        summary: locationContext.template.summary,
        recommendation: locationContext.template.recommendation,
        actions: locationContext.recommendedActions,
        risk_level: locationContext.liveSafe ? "normal" : "very_far",
      });
      setRoviExplanationError(null);
    } finally {
      setRoviExplanationLoading(false);
    }
  }

  function handleAskWayraFromPreview() {
    const target = selectedPlace ?? destination;
    if (!target) return;
    emitWayraPlacePicked({
      lat: target.lat,
      lng: target.lng,
      name: target.name ?? target.categoryLabel ?? null,
      autoOpen: true,
    });
    const name =
      target.name?.trim() ||
      target.categoryLabel?.trim() ||
      formatMapCoordinates(target.lat, target.lng);
    const prompt = `I'm looking at ${name} on Rovvy Live (${target.lat.toFixed(4)}, ${target.lng.toFixed(4)}). What should I know about this place, and what are interesting things to see or do nearby?`;
    emitOpenWayra({ prompt, autoSend: true });
  }

  const showFarAwayPanel = false;
  const showRouteSummaryBar =
    !isLiveActive &&
    liveStage === "place_preview" &&
    Boolean(selectedPlace) &&
    !showFarAwayPanel &&
    !showPlaceDetailsPanel;
  const showPlacePreview =
    !isLiveActive &&
    Boolean(selectedPlace) &&
    showPlaceDetailsPanel &&
    !showFarAwayPanel;

  /** Preview-card Wayra: bound to the light place card only — clears when the card closes. */
  useEffect(() => {
    const buildUserLocationPayload = () => {
      if (!userLocation || !isFreshGpsStatus(gpsStatus)) return null;
      return {
        lat: userLocation.lat,
        lng: userLocation.lng,
        city: userRegion?.city ?? null,
        state: userRegion?.state ?? null,
        country: userRegion?.country ?? null,
      };
    };

    const buildWayraDetail = (target: PlacePreviewData, wayraScope: "place_preview" | "destination") => {
      const routeReady = routePreviewStatus === "ready" && activeRoute;
      const contextNotice =
        locationContext && locationContext.classification !== "local_place"
          ? locationContext.template?.recommendation ?? null
          : null;
      const aiSuggestions = buildRoutePreviewAiSuggestions({
        destinationName: target.name ?? target.categoryLabel ?? "this place",
        farFromUser: isFarFromUser(target.distanceM ?? null),
        contextNotice,
        lastMileNotice:
          routeReady && activeRoute.lastMileMode === "walk"
            ? activeRoute.lastMileNotice ?? null
            : null,
        borderNotice: routeReady ? activeRoute.borderNotice ?? null : null,
        routeError:
          routePreviewStatus === "failed" && routePreviewError
            ? routePreviewError
            : null,
      });

      return {
        pathname: "/live",
        wayraScope,
        selectedPlace: {
          name: target.name ?? null,
          lat: target.lat,
          lng: target.lng,
          category: target.categoryLabel ?? null,
          address: target.address ?? null,
          city: target.city ?? null,
          state: target.state ?? null,
          country: target.country ?? null,
        },
        userLocation: buildUserLocationPayload(),
        liveStage,
        contextNotice,
        aiSuggestions: aiSuggestions.map((item) => ({
          message: item.message,
          kind: item.kind,
        })),
        routePreview: routeReady
          ? {
              durationSeconds: activeRoute.durationSeconds,
              distanceMeters: activeRoute.distanceMeters,
              lastMileNotice: activeRoute.lastMileNotice ?? null,
              borderNotice: activeRoute.borderNotice ?? null,
              lastMileMode: activeRoute.lastMileMode ?? null,
            }
          : null,
      };
    };

    if (showPlacePreview && selectedPlace && locationContext) {
      window.dispatchEvent(
        new CustomEvent(WAYRA_CONTEXT_EVENT, {
          detail: buildWayraDetail(selectedPlace, "place_preview"),
        }),
      );
      return;
    }

    if ((isLiveActive || liveStage === "destination_set") && destination) {
      window.dispatchEvent(
        new CustomEvent(WAYRA_CONTEXT_EVENT, {
          detail: buildWayraDetail(destination, "destination"),
        }),
      );
      return;
    }

    const gpsOnly = buildUserLocationPayload();
    if (gpsOnly) {
      window.dispatchEvent(
        new CustomEvent(WAYRA_CONTEXT_EVENT, {
          detail: {
            pathname: "/live",
            wayraScope: "gps_only",
            userLocation: gpsOnly,
            liveStage,
          },
        }),
      );
      return;
    }

    emitClearWayraContext();
  }, [
    showPlacePreview,
    selectedPlace,
    destination,
    isLiveActive,
    liveStage,
    activeRoute,
    routePreviewStatus,
    routePreviewError,
    locationContext,
    userLocation,
    gpsStatus,
    userRegion,
  ]);

  const showRoutePreview =
    (liveStage === "destination_set" || isLongDistancePreview) &&
    destination &&
    !isLiveActive;
  const showSoloLivePanel =
    isLiveActive && liveStage === "solo_drive_command" && destination;
  const showNavigationOverlay =
    isLiveActive && isNavigating && destination;

  const mapPinSource = destination ?? selectedPlace;
  const mapPin = mapPinSource
    ? { lat: mapPinSource.lat, lng: mapPinSource.lng }
    : null;

  const mapFollowMode: MapFollowMode = useMemo(() => {
    if (showFarAwayPanel) return "off";
    if (isLongDistancePreview) return "default";
    if (liveStage === "place_preview" || liveStage === "destination_set") {
      return "local-only";
    }
    return "default";
  }, [showFarAwayPanel, isLongDistancePreview, liveStage]);

  const routeLine: RouteLine | null = useMemo(() => {
    if (!activeRoute) return null;
    const showRoute =
      isLiveActive ||
      liveStage === "destination_set" ||
      liveStage === "long_distance_preview" ||
      liveStage === "place_preview" ||
      liveStage === "solo_drive_navigation" ||
      liveStage === "solo_drive_command";
    if (!showRoute) return null;
    return {
      ...activeRoute,
      active: isLiveActive,
    };
  }, [activeRoute, liveStage, isLiveActive]);

  const routeOriginPin = useMemo(() => {
    if (!routeOrigin || routeOrigin.source === "gps") return null;
    if (routePreviewStatus === "ready" && activeRoute) return null;
    return { lat: routeOrigin.latitude, lng: routeOrigin.longitude };
  }, [routeOrigin, routePreviewStatus, activeRoute]);

  const showAskRoviAi = shouldShowAskRoviAi(locationContext);

  function statusPillLabel(): string {
    if (isLiveActive && liveStage === "solo_drive_navigation") return "Solo Live · Navigating";
    if (isLiveActive) return "Solo Live On";
    if (liveStage === "destination_set") return "Destination set";
    if (liveStage === "long_distance_preview") return "Long-distance preview";
    if (liveStage === "place_preview") return "Place selected";
    return "Live not started";
  }

  function statusPillClass(): string {
    if (isLiveActive) return "text-emerald-800 bg-emerald-100";
    if (liveStage === "destination_set") return "text-sky-800 bg-sky-100";
    if (liveStage === "long_distance_preview") return "text-amber-800 bg-amber-100";
    if (liveStage === "place_preview") return "text-amber-800 bg-amber-100";
    return "text-emerald-700 bg-emerald-100";
  }

  function statusDotClass(): string {
    if (isLiveActive) return "bg-emerald-500 animate-pulse";
    if (liveStage === "destination_set") return "bg-sky-500";
    if (liveStage === "long_distance_preview") return "bg-amber-500";
    if (liveStage === "place_preview") return "bg-amber-500";
    return "bg-emerald-500";
  }

  const crossBorderAlert = useMemo(() => {
    if (!locationContext?.countryMismatch) return null;
    return {
      fromCountry: userRegion?.country ?? null,
      toCountry: roviTargetPlace?.country ?? null,
    };
  }, [locationContext?.countryMismatch, userRegion?.country, roviTargetPlace?.country]);

  const autoFitRouteOnMap =
    !isNavigating &&
    (liveStage === "destination_set" ||
      liveStage === "long_distance_preview" ||
      (isLiveActive && liveStage === "solo_drive_command"));

  return (
    <div
      className="live-page-shell fixed inset-x-0 bottom-0 z-[1] overflow-hidden select-none transition-all duration-300 ease-in-out"
      style={{ top: "var(--rovvy-header-h, 56px)" }}
    >
      <LiveImmersiveChrome activeLayer={activeLayer} />
      <LiveMapComponent
        activeLayer={activeLayer}
        onLayerChange={handleLayerChange}
        travelLayerEnabled={travelLayerEnabled}
        seaRoutesEnabled={seaRoutesEnabled}
        cruiseRoutesEnabled={cruiseRoutesEnabled}
        footRoutesEnabled={footRoutesEnabled}
        friends={friendsLocations}
        friendTrackingEnabled={friendTrackingEnabled}
        mapRef={mapRef}
        mapPin={mapPin ? { lat: mapPin.lat, lng: mapPin.lng } : null}
        pinMode={destination ? "meetup" : "selected"}
        pinLabel={destination?.name ?? selectedPlace?.name ?? null}
        mapZoom={mapZoom}
        mapClickPin={mapClickPin}
        coordinateOverlay={coordinateOverlay}
        routeOriginPin={routeOriginPin}
        routeLine={routeLine}
        isLiveActive={isLiveActive}
        navigationMode={isNavigating}
        mapFollowMode={mapFollowMode}
        onGpsStateChange={handleGpsStateChange}
        nearbyResults={nearbyResults}
        onNearbyMarkerClick={handleResultClick}
        onMapClick={handleMapClick}
        onMapDoubleClick={handleMapDoubleClick}
        onMapInteraction={handleMapInteraction}
        onMapCenterChange={handleMapCenterChange}
        onBearingChange={handleBearingChange}
        onZoomChange={handleZoomChange}
        onMaxZoomCapChange={handleMaxZoomCapChange}
        crossBorderAlert={crossBorderAlert}
        autoFitRoute={autoFitRouteOnMap}
      />

      <LiveMapAttributionStrip
        activeLayer={activeLayer}
        focus={attributionFocus}
        isPanning={isMapInteracting}
        refreshedAt={attributionRefreshedAt}
        zoom={mapZoom}
        maxZoom={mapMaxZoom}
        onZoomIn={() => mapRef.current?.zoomIn()}
        onZoomOut={() => mapRef.current?.zoomOut()}
        onZoomChange={(zoom) => mapRef.current?.setZoom(zoom)}
        immersive={liveImmersive}
        isImmersiveFullscreen={liveImmersive}
        onToggleImmersiveFullscreen={toggleLiveImmersive}
      />

      <LiveMapRightControls
        bearing={mapBearing}
        activeLayer={activeLayer}
        onResetNorth={() => mapRef.current?.resetNorth()}
        gpsStatus={gpsStatus}
        gpsErrorMessage={gpsState.errorMessage ?? null}
        onLocate={handleLocateClick}
        showGpsHelper={showGpsHelper}
        onCloseGpsHelper={() => setShowGpsHelper(false)}
        onUseMapArea={handleUseMapArea}
        layersPanelOpen={layersPanelOpen}
        onLayersPanelOpenChange={setLayersPanelOpen}
        onLayerChange={handleLayerChange}
        travelLayerEnabled={travelLayerEnabled}
        onTravelLayerChange={handleTravelLayerChange}
        seaRoutesEnabled={seaRoutesEnabled}
        onSeaRoutesChange={handleSeaRoutesChange}
        cruiseRoutesEnabled={cruiseRoutesEnabled}
        onCruiseRoutesChange={handleCruiseRoutesChange}
        footRoutesEnabled={footRoutesEnabled}
        onFootRoutesChange={handleFootRoutesChange}
        friendTrackingEnabled={friendTrackingEnabled}
        onFriendTrackingChange={DEV_SHOW_MOCK_FRIENDS ? handleFriendTrackingChange : undefined}
        mapViewMode={mapViewMode}
        onToggleViewMode={handleToggleViewMode}
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled((prev) => !prev)}
        notificationsEnabled={notificationsEnabled}
        onToggleNotifications={() => setNotificationsEnabled((prev) => !prev)}
      />

      {toast ? (
        <div className="absolute left-1/2 top-20 z-40 max-w-sm -translate-x-1/2 rounded-xl bg-stone-900 px-4 py-2 text-center text-sm text-white shadow-lg">
          {toast}
        </div>
      ) : null}

      {/* Click-away backdrop overlay to reduce background interaction and close suggestions/setup panel */}
      {(showSuggestionsCard || showSetupPanel) && (
        <div
          className="fixed inset-0 z-20 cursor-default bg-stone-900/[0.02] backdrop-blur-[0.5px]"
          onClick={() => {
            setShowSuggestionsCard(false);
            setShowSetupPanel(false);
          }}
        />
      )}

      {/* Floating in-map search bar & selectors */}
      {!isNavigating ? (
        <div
          className={`absolute left-1/2 top-[calc(0.5rem+env(safe-area-inset-top,0px))] z-30 flex w-[min(100%,28rem)] -translate-x-1/2 flex-col gap-3 px-3 transition-all duration-300 sm:w-[min(100%,32rem)] md:top-[calc(0.65rem+env(safe-area-inset-top,0px))] ${
            isMapInteracting
              ? "pointer-events-none translate-y-[-10px] opacity-0"
              : "pointer-events-auto translate-y-0 opacity-100"
          }`}
        >
          {/* Centered search bar */}
          <div className="relative w-full" id="search-container">
            <div
              className={`flex h-11 w-full items-center gap-2 rounded-full border pl-2 pr-1.5 shadow-[0_8px_24px_rgba(15,23,42,0.10)] backdrop-blur-md ${
                isImmersiveDarkMapLayer(activeLayer)
                  ? "border-white/15 bg-slate-950/72 text-white"
                  : "border-[rgba(15,23,42,0.10)] bg-white/95"
              }`}
            >
                <TravelModeChip
                  travelMode={travelMode}
                  workflowType={workflowType}
                  status={
                    isLiveActive
                      ? "live_active"
                      : destination && routePreviewStatus === "ready"
                        ? "route_ready"
                        : "idle"
                  }
                  onClickEdit={(e) => {
                    e.stopPropagation();
                    setShowSetupPanel((prev) => !prev);
                    setShowSuggestionsCard(false);
                    setShowSearchPopup(false);
                  }}
                  isOpen={showSetupPanel}
                />
                 <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowSearchPopup(true);
                    setShowSuggestionsCard(false);
                  }}
                  onFocus={(e) => {
                    e.stopPropagation();
                    setShowSearchPopup(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void searchPlaceByName(searchQuery);
                    }
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSearchPopup(true);
                  }}
                  placeholder="Search places, stops, meet points"
                  className={`w-full bg-transparent text-sm focus:outline-none ${
                    isImmersiveDarkMapLayer(activeLayer)
                      ? "text-white placeholder:text-slate-400"
                      : "text-stone-800 placeholder:text-stone-400"
                  }`}
                />
                {searchLoading ? (
                  <span className="mr-1 shrink-0 text-[10px] text-stone-400 animate-pulse">…</span>
                ) : null}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSearchPopup((prev) => !prev);
                    setShowSuggestionsCard(false);
                    searchInputRef.current?.focus();
                  }}
                  className={`flex h-8 shrink-0 cursor-pointer items-center justify-center rounded-full px-4 text-xs font-semibold transition-all ${
                    showSearchPopup
                      ? "bg-[#007F73] text-white shadow-sm"
                      : "bg-[#E6F7F4] text-[#007F73] hover:bg-[#d5f2ed]"
                  }`}
                >
                  Suggestions
                </button>
              </div>

              {/* Unified search dropdown — instant picks + API results */}
              {showSearchPopup ? (
                <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-auto rounded-2xl bg-white/95 shadow-[0_8px_32px_rgba(0,0,0,0.12)] backdrop-blur-md">
                  {detectedSearchCategory ? (
                    <div className="border-b border-stone-100/80 p-1.5">
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 rounded-xl bg-[#E6F7F4] px-3 py-2.5 text-left transition-colors hover:bg-[#d5f2ed]"
                        onClick={() => void handleNearbySearch(detectedSearchCategory.key)}
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-lg shadow-sm">
                          {detectedSearchCategory.icon}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-[#007F73]">
                            {detectedSearchCategory.label}
                          </span>
                          <span className="block text-[11px] text-stone-500">
                            Show up to {nearbyResultLimitForScreen()} on map · tap or Enter
                          </span>
                        </span>
                      </button>
                    </div>
                  ) : null}

                  {detectedPastedLocation && !detectedSearchCategory ? (
                    <div className="border-b border-stone-100/80 p-1.5">
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 rounded-xl bg-amber-50 px-3 py-2.5 text-left transition-colors hover:bg-amber-100/80"
                        onClick={() => void searchPlaceByName(searchQuery)}
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-lg shadow-sm">
                          📍
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-amber-900">
                            Go to pasted location
                          </span>
                          <span className="block text-[11px] text-stone-500 line-clamp-2">
                            {detectedPastedLocation.label}
                          </span>
                        </span>
                      </button>
                    </div>
                  ) : null}

                  {instantSuggestions.length > 0 ? (
                    <div className="border-b border-stone-100/80 p-1.5">
                      <p className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-stone-400">
                        {searchQuery.trim() ? "Quick matches" : recentSearches.length > 0 ? "Recent" : "Quick picks"}
                      </p>
                      <ul>
                        {instantSuggestions.map((item) => (
                          <li key={item.id}>
                            <button
                              type="button"
                              className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-stone-50"
                              onClick={() => handleInstantSuggestionClick(item)}
                            >
                              <span className="shrink-0 text-sm" aria-hidden>
                                {item.type === "category_search"
                                  ? (resolveLiveSearchCategory(item.category ?? "")?.icon ?? "🔎")
                                  : "🕘"}
                              </span>
                              <span className="min-w-0">
                                <span className="block text-sm font-medium text-stone-800 line-clamp-1">
                                  {item.label}
                                </span>
                                {item.subtitle ? (
                                  <span className="block text-[11px] text-stone-500 line-clamp-1">
                                    {item.subtitle}
                                  </span>
                                ) : null}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {searchQuery.trim().length >= 2 && searchNeedsLocation && !searchLoading ? (
                    <div className="px-3 py-2.5 text-xs text-stone-500">
                      Turn on location or move the map to search nearby.
                    </div>
                  ) : null}

                  {searchQuery.trim().length >= 2 && searchLoading ? (
                    <div className="flex items-center gap-2 px-3 py-2.5 text-xs text-stone-400">
                      <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-stone-200 border-t-[#007F73]" />
                      Searching places…
                    </div>
                  ) : null}

                  {searchQuery.trim().length >= 2 && searchError && !searchLoading ? (
                    <div className="px-3 py-2.5 text-xs text-amber-700">{searchError}</div>
                  ) : null}

                  {searchQuery.trim().length >= 2 &&
                  !searchLoading &&
                  !searchNeedsLocation &&
                  !searchError &&
                  searchResults.length === 0 &&
                  instantSuggestions.length === 0 ? (
                    <div className="px-3 py-2.5 text-xs text-stone-500">
                      No places found. Try a different spelling or pick a quick match above.
                    </div>
                  ) : null}

                  {searchResults.length > 0 ? (
                    <ul className="p-1.5">
                      {searchQuery.trim().length >= 2 ? (
                        <li className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-stone-400">
                          Places
                        </li>
                      ) : null}
                      {searchResults.map((result) => {
                        const subtitleParts = [];
                        if (result.category && result.category !== "Place") subtitleParts.push(result.category);
                        if (result.distanceLabel) subtitleParts.push(result.distanceLabel);

                        const subtitle = subtitleParts.join(" · ");
                        const addressLine = result.address !== result.name ? result.address : null;

                        return (
                          <li key={result.id}>
                            <button
                              type="button"
                              className="flex w-full gap-2 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-stone-50/80"
                              onClick={() => {
                                void selectPlace(result);
                              }}
                            >
                              <span className="shrink-0 pt-0.5">
                                {resolvePoiMapIcon({ categoryLabel: result.category, name: result.name })}
                              </span>
                              <span className="min-w-0">
                                <span className="block text-sm font-medium text-stone-800 line-clamp-1">
                                  {result.name}
                                </span>
                                {subtitle ? (
                                  <span className="mt-0.5 block text-xs font-medium text-teal-700 line-clamp-1">
                                    {subtitle}
                                  </span>
                                ) : null}
                                {addressLine ? (
                                  <span className="mt-0.5 block text-[10px] text-stone-500 line-clamp-1">
                                    {addressLine}
                                  </span>
                                ) : null}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </div>
              ) : null}

              {/* Setup Panel */}
              {showSetupPanel && (
                <div className="absolute left-0 top-full z-30 mt-2 w-80 sm:w-96 rounded-2xl bg-white/95 backdrop-blur-xl p-4 shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-stone-200/50 text-stone-800 flex flex-col gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
                  {/* Travel Mode Row */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Travel Mode</label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {TRAVEL_MODES.map((mode) => {
                        const isActive = travelMode === mode;
                        const icons: Record<string, string> = {
                          Drive: "🚗",
                          Bike: "🚲",
                          Trek: "🥾",
                          Walk: "🚶",
                        };
                        return (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => {
                              setTravelMode(mode);
                            }}
                            className={`h-9 px-2 flex flex-col items-center justify-center rounded-xl text-[10px] font-bold transition-all border ${
                              isActive
                                ? "bg-[#E6F7F4] text-[#007F73] border-[#007F73] shadow-sm"
                                : "bg-white border-stone-200 text-stone-600 hover:text-stone-800 hover:bg-stone-50"
                            }`}
                          >
                            <span className="text-sm mb-0.5">{icons[mode]}</span>
                            <span>{mode}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Workflow Row */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Workflow</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {WORKFLOW_TYPES.map((type) => {
                        const isActive = workflowType === type;
                        const icons: Record<string, string> = {
                          Solo: "👤",
                          "Group Travel": "👥",
                          "Seat Share": "💺",
                        };
                        return (
                          <button
                            key={type}
                            type="button"
                            onClick={() => {
                              setWorkflowType(type);
                            }}
                            className={`h-9 px-1.5 flex items-center justify-center gap-1.5 rounded-xl text-[10px] font-bold transition-all border ${
                              isActive
                                ? "bg-[#E6F7F4] text-[#007F73] border-[#007F73] shadow-sm"
                                : "bg-white border-stone-200 text-stone-600 hover:text-stone-800 hover:bg-stone-50"
                            }`}
                          >
                            <span className="text-xs">{icons[type]}</span>
                            <span className="truncate">{type}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Destination / Search Row */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Destination</label>
                    <div className="flex items-center justify-between p-2.5 rounded-xl border border-stone-200 bg-stone-50/50">
                      <div className="min-w-0 flex-1 pr-2">
                        <p className="text-xs font-semibold text-stone-700 truncate">
                          {destination ? destination.name : "No destination set"}
                        </p>
                        {destination && (
                          <p className="text-[10px] text-stone-500 truncate mt-0.5">{destination.address}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setShowSetupPanel(false);
                          searchInputRef.current?.focus();
                          setShowSearchPopup(true);
                        }}
                        className="shrink-0 text-xs font-bold text-[#007F73] hover:underline"
                      >
                        {destination ? "Change" : "Set"}
                      </button>
                    </div>
                  </div>

                  {/* Action Area */}
                  <div className="border-t border-stone-100 pt-3">
                    {!user ? (
                      <div className="text-center py-1">
                        <button
                          type="button"
                          onClick={() => {
                            setShowSetupPanel(false);
                            setShowSignInModal(true);
                          }}
                          className="text-xs font-bold text-[#007F73] hover:underline transition-all"
                        >
                          Sign in to start
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          handleStartSoloLive();
                          setShowSetupPanel(false);
                        }}
                        disabled={routePreviewStatus !== "ready" || !activeRoute || routeLoading}
                        className="w-full h-10 rounded-xl flex items-center justify-center text-xs font-bold text-white bg-[#007F73] hover:bg-[#00665C] disabled:bg-stone-200 disabled:text-stone-400 disabled:cursor-not-allowed transition-all"
                      >
                        {routeLoading || routePreviewStatus === "loading"
                          ? "Loading route..."
                          : workflowType === "Solo"
                            ? "Start Solo Live"
                            : workflowType === "Group Travel"
                              ? "Start Group Live"
                              : "Start Seat Share Live"}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Status Pill Chip */}
            {liveStage !== "static_landing" && (
              <div
                className={`mx-auto flex h-9 shrink-0 select-none items-center gap-1.5 self-center rounded-full border border-current/10 px-3.5 text-xs font-semibold shadow-[0_4px_18px_rgba(15,23,42,0.05)] transition-all duration-200 ${statusPillClass()}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${statusDotClass()}`} />
                {statusPillLabel()}
              </div>
            )}

          {/* Nearby Suggestions Results Panel */}
          {nearbyCategory && !selectedPlace && (
            <div className="w-80 sm:w-96 rounded-2xl bg-white/95 backdrop-blur-xl p-4 shadow-[0_8px_32px_rgba(0,0,0,0.12)] text-stone-800 flex flex-col max-h-[calc(100vh-140px)] animate-in fade-in slide-in-from-top-2 duration-200">
              {/* Header */}
              <div className="flex items-center justify-between mb-3 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E6F7F4] text-base">
                    {resolveLiveSearchCategory(nearbyCategory)?.icon ?? "🔎"}
                  </span>
                  <div>
                    <h3 className="font-bold text-stone-800 text-sm">
                      {getNearbyCategoryTitle(nearbyCategory)}
                    </h3>
                    <p className="text-[10px] text-stone-500 font-medium">Sorted by distance</p>
                    {searchAnchorHint ? (
                      <p className="text-[10px] text-amber-700 font-medium">{searchAnchorHint}</p>
                    ) : null}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCloseNearbyResults}
                  className="p-1 rounded-full hover:bg-stone-200/50 text-stone-500 hover:text-stone-700 transition-colors cursor-pointer"
                  title="Close Results"
                >
                  <span className="text-xs font-bold px-1.5 py-0.5">✕</span>
                </button>
              </div>

              {/* Error State */}
              {nearbyError && (
                <div className="py-6 text-center text-xs text-red-600 font-medium shrink-0">
                  {nearbyError}
                </div>
              )}

              {/* Loading State */}
              {nearbyLoading && (
                <div className="py-12 flex flex-col items-center justify-center gap-2 shrink-0">
                  <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-stone-500 font-medium animate-pulse">Searching nearby...</span>
                </div>
              )}

              {/* Empty/Not Found State */}
              {!nearbyLoading && !nearbyError && nearbyResults && nearbyResults.length === 0 && (
                <div className="py-8 text-center text-xs text-stone-500 shrink-0">
                  No places found for "{nearbyCategory}" in this area.
                </div>
              )}

              {/* List View */}
              {!nearbyLoading && !nearbyError && nearbyResults && nearbyResults.length > 0 && (
                <div className="overflow-y-auto pr-1 flex-1 space-y-2 max-h-[380px]">
                  {nearbyResults.map((res, index) => {
                    const distanceMiles = res.distanceM ? (res.distanceM / 1609.34).toFixed(1) : null;
                    const presentation = getPoiMarkerPresentation(res);
                    return (
                      <div
                        key={res.placeKey}
                        className={`p-3 rounded-xl border transition-all cursor-pointer bg-white/40 hover:bg-white/60 ${
                          presentation.landmark
                            ? "border-amber-300/70 hover:border-amber-400/80"
                            : "border-stone-200/40 hover:border-stone-300/60"
                        }`}
                        onClick={() => handleResultClick(res)}
                      >
                        <div className="flex items-start gap-2.5">
                          <div
                            className={`relative w-7 h-7 rounded-full text-white flex items-center justify-center text-sm shrink-0 mt-0.5 ${
                              presentation.landmark ? "ring-2 ring-amber-200" : ""
                            }`}
                            style={{ backgroundColor: presentation.background }}
                          >
                            <span aria-hidden>{presentation.icon}</span>
                            <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-0.5 rounded-full bg-[#1E293B] text-white text-[9px] font-bold flex items-center justify-center border border-white">
                              {index + 1}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="font-semibold text-stone-800 text-xs truncate flex items-center gap-1">
                              <span className="truncate">{res.name}</span>
                              {presentation.landmark ? (
                                <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide text-amber-700">
                                  Landmark
                                </span>
                              ) : null}
                            </h4>
                            <p className="text-[11px] text-stone-500 truncate mt-0.5">
                              {res.categoryLabel}{distanceMiles ? ` · ${distanceMiles} mi` : ""}
                            </p>
                            <p className="text-[11px] text-stone-400 truncate mt-0.5">
                              {res.address}
                            </p>
                            <p className="text-[9px] text-stone-400 mt-1 font-light">
                              Place data from OpenStreetMap
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      ) : null}

      {showFarAwayPanel && selectedPlace && locationContext ? (
        <FarAwayPlacePanel
          place={selectedPlace}
          locationContext={locationContext}
          showAskRovi={showAskRoviAi}
          roviLoading={roviExplanationLoading}
          roviExplanation={roviExplanation}
          roviError={roviExplanationError}
          onAskRovi={handleAskWayraFromPreview}
          onSearchNearMe={handleSearchNearMe}
          onChangeDestination={clearSelectedPlace}
          onPlanTrip={handlePlanTrip}
          onContinueAnyway={handleContinueAnyway}
          onClose={clearSelectedPlace}
        />
      ) : null}

      {/* Place Preview Panel */}
      {showPlacePreview && selectedPlace && locationContext ? (
        <PlacePreviewCard
          place={selectedPlace}
          loadingDetails={loadingPlaceDetails}
          placeMedia={placeMedia}
          placeMediaLoading={placeMediaLoading}
          placeTags={placeTags}
          hasUserLocation={Boolean(userLocation)}
          locationContext={locationContext}
          showAskRovi={showAskRoviAi}
          roviLoading={roviExplanationLoading}
          roviExplanation={roviExplanation}
          roviError={roviExplanationError}
          onAskRovi={handleAskWayraFromPreview}
          onSearchNearMe={handleSearchNearMe}
          onChangeDestination={clearSelectedPlace}
          onPlanTrip={handlePlanTrip}
          onContinueAnyway={handleContinueFromPreview}
          onClose={handleClosePlaceDetails}
          onSavePlace={() => {
            // TODO: ensure_place_registry_on_action + upload photo flow
            showToast("Place saved.");
          }}
          onAddStop={handleAddStopFromPreview}
          onAddToTrip={() => showToast("Choose trip — coming soon.")}
          onCreateMeetPoint={() => showToast("Meet point created.")}
          onMakeDestination={handleMakeDestination}
          onGetDirections={handleGetDirections}
          onStartLive={handleStartFromPlacePreview}
          immersive={liveImmersive}
          stackAboveRouteSummary={showRouteSummaryBar}
          routePreviewStatus={routePreviewStatus}
          routeLoading={routeLoading}
          routePreviewError={routePreviewError}
          routeDurationSeconds={activeRoute?.durationSeconds ?? null}
          routeDistanceMeters={activeRoute?.distanceMeters ?? null}
          routeLastMileNotice={activeRoute?.lastMileNotice ?? null}
          routeBorderNotice={activeRoute?.borderNotice ?? null}
          routeLastMileMode={activeRoute?.lastMileMode ?? null}
          travelMode={travelMode}
          nearbyPlacesAtClick={nearbyPlacesAtClick}
          onSelectNearbyPlaceAtClick={handleSelectNearbyPlaceAtClick}
          liveStage={liveStage}
          previewContext={
            viewingDetailsFromNearby && nearbyCategory
              ? {
                  icon: resolveLiveSearchCategory(nearbyCategory)?.icon ?? "📍",
                  searchLabel: getNearbyCategoryTitle(nearbyCategory),
                }
              : null
          }
        />
      ) : null}

      {/* Route Preview — local/regional destination */}
      {originPickMode ? (
        <div className="pointer-events-none absolute left-1/2 top-24 z-35 max-w-sm -translate-x-1/2 rounded-xl bg-stone-900/90 px-4 py-2 text-center text-sm text-white shadow-lg">
          Tap the map to set your starting point
        </div>
      ) : null}

      {showRoutePreview && destination ? (
        <SoloRoutePreviewPanel
          destination={destination}
          travelMode={travelMode}
          plannedStops={plannedStops}
          planningMode={false}
          onStartSoloLive={handleStartSoloLive}
          onChangeDestination={handleChangeDestination}
          onClose={handleChangeDestination}
          onPlanTrip={handlePlanTrip}
          onRetryRoute={handleRetryRoutePreview}
          onEditOrigin={() => setShowOriginSetup(true)}
          routeOrigin={routeOrigin}
          routeLine={activeRoute}
          routeLoading={routeLoading}
          routePreviewStatus={routePreviewStatus}
          routePreviewError={routePreviewError}
        />
      ) : null}

      {showRouteSummaryBar && selectedPlace ? (
        <LiveRouteSummaryBar
          destinationName={selectedPlace.name}
          durationSeconds={activeRoute?.durationSeconds ?? null}
          routePreviewStatus={routePreviewStatus}
          routeLoading={routeLoading}
          identifying={loadingPlaceDetails}
          travelMode={travelMode}
          routeLastMileNotice={activeRoute?.lastMileNotice ?? null}
          routeBorderNotice={activeRoute?.borderNotice ?? null}
          routeLastMileMode={activeRoute?.lastMileMode ?? null}
          onOpenDetails={() => setShowPlaceDetailsPanel(true)}
          onGo={handleGetDirections}
          onClose={clearSelectedPlace}
        />
      ) : null}

      {showOriginSetup ? (
        <LiveRouteOriginSetup
          open={showOriginSetup}
          onClose={() => setShowOriginSetup(false)}
          onUseCurrentLocation={handleUseCurrentLocationOrigin}
          onUseMapCenter={handleUseMapCenterOrigin}
          onPickOnMap={handleStartOriginPick}
          onSelectSearchOrigin={handleSearchOriginSelect}
          gpsAvailable={isFreshGpsStatus(gpsStatus)}
          gpsAccuracyMeters={gpsState.accuracyMeters}
          mapCenterAvailable={Boolean(mapRef.current?.getMapCenter())}
          searchBias={resolveSearchAnchor()}
        />
      ) : null}

      {/* Rovi Route Intelligence — long-distance / global destination */}
      {isLongDistancePreview && destination ? (
        <RoviRouteIntelligencePanel
          originName={
            userRegion?.city ??
            userRegion?.state ??
            (userLocation ? `${userLocation.lat.toFixed(2)}, ${userLocation.lng.toFixed(2)}` : "Your location")
          }
          destinationName={destination.name}
          loading={routeIntelligenceLoading}
          error={routeIntelligenceError}
          response={routeIntelligenceResponse}
          onSelectOption={(option: RouteOption) => {
            showToast(`Route selected: ${option.title}`);
          }}
          onClose={handleChangeDestination}
          onPlanTrip={handlePlanTrip}
        />
      ) : null}

      {showSoloLivePanel && destination ? (
        <SoloLiveActivePanel
          destination={destination}
          plannedStops={plannedStops}
          addStopMode={addStopMode}
          gpsManualMode={!isFreshGpsStatus(gpsStatus)}
          liveStage={liveStage}
          tripStatus={tripStatus}
          travelMode={travelMode}
          onTripStatusChange={setTripStatus}
          onBeginNavigation={handleBeginNavigation}
          onEndSoloLive={handleEndSoloLive}
          onSetStartingPoint={() => setShowOriginSetup(true)}
          onSaveParking={() => showToast("Parking saved.")}
          onShareTrip={() => showToast("Share trip — coming soon.")}
          onAddStop={handleAddStopFromLive}
          routeLine={activeRoute}
        />
      ) : null}

      {showNavigationOverlay && destination ? (
        <SoloLiveNavigationOverlay
          destination={destination}
          travelMode={travelMode}
          speedMps={speedMps}
          tripStatus={tripStatus}
          onTripStatusChange={setTripStatus}
          onEndSoloLive={handleEndSoloLive}
          onSaveParking={() => showToast("Parking saved.")}
          onShareTrip={() => showToast("Share trip — coming soon.")}
          onAddStop={handleAddStopFromLive}
          routeLine={activeRoute}
        />
      ) : null}

      <LiveMapLocationSheet
        open={mapLocationSheet != null}
        point={mapLocationSheet}
        loading={mapLocationSheetLoading}
        manualMode={mapLocationSheetManual}
        destinationName={destination?.name ?? null}
        destinationLat={destination?.lat ?? null}
        destinationLng={destination?.lng ?? null}
        canAddStop={Boolean(destination && (isLiveActive || liveStage === "destination_set"))}
        onClose={closeMapLocationSheet}
        onSetStartingPoint={handleSheetSetStartingPoint}
        onSetDestination={handleSheetSetDestination}
        onAddStop={handleSheetAddStop}
        onCopyCoordinates={(p) => void handleSheetCopyCoordinates(p)}
        onSavePlace={handleSheetSavePlace}
      />

      {/* Live Mini HUD */}
      {isLiveActive && (
        <div className="absolute top-[72px] left-4 z-30">
          <LiveMiniHud
            travelMode={travelMode}
            workflowType={workflowType}
            speedMps={speedMps}
            durationSeconds={activeRoute ? activeRoute.durationSeconds : null}
            onEdit={() => setShowSetupPanel(true)}
          />
        </div>
      )}

      {/* Inline Sign-In Modal */}
      <InlineSignInModal
        isOpen={showSignInModal}
        onClose={() => setShowSignInModal(false)}
      />
    </div>
  );
}
