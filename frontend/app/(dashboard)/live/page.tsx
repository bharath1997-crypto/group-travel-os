"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  Compass,
  ChevronRight,
  MapPin,
  Search,
  Star,
  Volume2,
  VolumeX,
  Bell,
  Maximize2,
} from "lucide-react";
import { haversineM } from "@/lib/geo";
import PlacePreviewCard, { type PlacePreviewData } from "./PlacePreviewCard";
import FarAwayPlacePanel from "./FarAwayPlacePanel";
import SoloRoutePreviewPanel from "./SoloRoutePreviewPanel";
import LiveRouteOriginSetup from "./LiveRouteOriginSetup";
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
import { fetchLiveRoute } from "./live-routing";
import {
  buildGpsRouteOrigin,
  buildMapCenterRouteOrigin,
  buildMapPickRouteOrigin,
  validateRouteOriginCoords,
} from "./live-route-origin";
import {
  canStartSoloLive,
  isLongDistanceFromUser,
} from "./live-types";
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
import type { LiveMapRef, MapFollowMode } from "./LiveMapComponent";
import {
  gpsStatusLabel,
  gpsStatusNeedsHelper,
  isFreshGpsStatus,
  logRovvyGps,
  logRovvyMapClickResolver,
  type GpsStatus,
  type GpsState,
} from "./live-gps";
import { LIVE_MAP_CONTROLS_POSITION } from "./live-layout";
import LiveMapLayerControl from "./LiveMapLayerControl";
import type { LiveMapLayer } from "@/lib/map-providers";
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

async function searchNearbyPlaces(
  category: string,
  center: { lat: number; lng: number },
): Promise<PlacePreviewData[]> {
  try {
    const data = await apiFetch<BackendNearbyResponse>(
      `/places/nearby?category=${encodeURIComponent(category)}&lat=${center.lat}&lng=${center.lng}&limit=15`
    );
    if (!data || !data.results) return [];
    return data.results.map((item) => ({
      name: item.name,
      categoryLabel: item.category || normalizePlaceCategory((item as any).tags) || "Place",
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
  } catch (err) {
    console.error("Failed to search nearby places", err);
    throw err;
  }
}

function getNearbyCategoryTitle(query: string): string {
  const q = query.toLowerCase();
  if (q.includes("gas")) return "Gas stations near you";
  if (q.includes("coffee") || q.includes("cafe")) return "Coffee nearby";
  if (q.includes("food") || q.includes("restaurant")) return "Restaurants near you";
  if (q.includes("restroom") || q.includes("toilet")) return "Restrooms nearby";
  if (q.includes("hospital") || q.includes("clinic")) return "Hospitals nearby";
  if (q.includes("park")) return "Parks nearby";
  if (q.includes("atm") || q.includes("bank")) return "ATMs nearby";
  if (q.includes("parking")) return "Parking nearby";
  return `${query} nearby`;
}

export default function LivePage() {
  const mapRef = useRef<LiveMapRef | null>(null);
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchBlurRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [activeLayer, setActiveLayer] = useState<LiveMapLayer>("street");
  const [liveStage, setLiveStage] = useState<LiveStage>("static_landing");
  const [workflowType, setWorkflowType] =
    useState<(typeof WORKFLOW_TYPES)[number]>("Solo");
  const [travelMode, setTravelMode] =
    useState<(typeof TRAVEL_MODES)[number]>("Drive");
  const [isMapInteracting, setIsMapInteracting] = useState(false);

  const [selectedPlace, setSelectedPlace] = useState<PlacePreviewData | null>(null);
  const [destination, setDestination] = useState<PlacePreviewData | null>(null);
  const [activeRoute, setActiveRoute] = useState<RouteLine | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routePreviewStatus, setRoutePreviewStatus] = useState<RoutePreviewStatus>("idle");
  const [routePreviewError, setRoutePreviewError] = useState<string | null>(null);
  const [routeOrigin, setRouteOrigin] = useState<RouteOrigin | null>(null);
  const [originPickMode, setOriginPickMode] = useState(false);
  const [showOriginSetup, setShowOriginSetup] = useState(false);
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
  const speedMps = gpsState.speed;
  const gpsStatus = gpsState.status;
  const gpsStatusRef = useRef(gpsStatus);
  gpsStatusRef.current = gpsStatus;
  const liveGpsActive = gpsStatus === "active" || gpsStatus === "approximate" || gpsStatus === "requesting" || gpsStatus === "stale";

  useEffect(() => {
    console.log("[Rovvy Debug] userLocation computed value changed:", userLocation);
  }, [userLocation]);

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

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [showGpsHelper, setShowGpsHelper] = useState(false);
  const [searchAnchorHint, setSearchAnchorHint] = useState<string | null>(null);
  const [searchNeedsLocation, setSearchNeedsLocation] = useState(false);
  const [mapBearing, setMapBearing] = useState(0);
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
  const [clickedLocation, setClickedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [mapClickResolving, setMapClickResolving] = useState(false);
  const [nearbyPlacesAtClick, setNearbyPlacesAtClick] = useState<PlacePreviewData[] | null>(null);

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
    return null;
  }, [userLocation, gpsState.accuracyMeters]);

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

      if (isLongDistanceFromUser(dest.distanceM)) {
        setRoutePreviewStatus("idle");
        setRoutePreviewError(null);
        setActiveRoute(null);
        return;
      }

      const origin = options?.origin !== undefined ? options.origin : (routeOrigin ?? resolveDefaultRouteOrigin());
      if (!dest || !validateRouteOriginCoords(origin)) {
        setRoutePreviewStatus("failed");
        if (!origin) {
          if (gpsState.status === "denied") {
            setRoutePreviewError("GPS access denied. Enable location services or pick a starting point manually.");
          } else {
            setRoutePreviewError("GPS location unavailable. Try picking a starting point manually.");
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

      if (isDuplicate && !options?.active) {
        return;
      }
      lastFetchedRouteRef.current = currentArgs;

      const requestId = ++routePreviewRequestRef.current;
      setRouteOrigin(origin);
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

        if (options?.fitMap !== false) {
          mapRef.current?.fitBounds([
            [route.from.lng, route.from.lat],
            [route.to.lng, route.to.lat],
          ]);
        }
      } catch (err) {
        if (requestId !== routePreviewRequestRef.current) return;
        console.error("[Rovvy Route] loadRoutePreview catch error:", err);
        setRoutePreviewStatus("failed");
        setRoutePreviewError("Directions service unavailable.");
        setActiveRoute(null);
      } finally {
        if (requestId === routePreviewRequestRef.current) {
          setRouteLoading(false);
        }
      }
    },
    [routeOrigin, resolveDefaultRouteOrigin, travelMode, gpsState],
  );

  const applyRouteOriginAndPreview = useCallback(
    (origin: RouteOrigin) => {
      setRouteOrigin(origin);
      setShowOriginSetup(false);
      setOriginPickMode(false);
      if (destination) {
        void loadRoutePreview(destination, { origin });
      }
    },
    [destination, loadRoutePreview],
  );

  const handleUseCurrentLocationOrigin = useCallback(() => {
    if (!userLocation) {
      showToast("Location unavailable. Enable GPS or choose another start point.");
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

    setNearbyCategory(query);
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
      const results = await searchNearbyPlaces(query, anchor);
      setNearbyResults(results);
    } catch (err) {
      setNearbyError("Nearby search is unavailable right now.");
    } finally {
      setNearbyLoading(false);
    }
  }, [resolveAnchorCoordinate, currentUserId, refreshRecentSearches, gpsStatus]);


  const handleCloseNearbyResults = useCallback(() => {
    setNearbyResults(null);
    setNearbyCategory(null);
    setNearbyError(null);
    setSearchAnchorHint(null);
    setExpandedResultIndex(null);
    setViewingDetailsFromNearby(false);
  }, []);

  const handleResultClick = useCallback((result: PlacePreviewData) => {
    setSelectedPlace(result);
    setViewingDetailsFromNearby(true);
    setLiveStage("place_preview");
    // Record as recent search when user clicks a nearby result
    recordRecentSearch(buildPlaceRecentSearch(result), currentUserId);
    refreshRecentSearches();
  }, [currentUserId, refreshRecentSearches]);

  const handleAddStopFromNearby = useCallback((result: PlacePreviewData) => {
    if (!destination) {
      showToast("Make this a destination first, then add stops.");
      return;
    }
    setPlannedStops((prev) => [...prev, result]);
    showToast(`${result.name} added as a stop.`);
    setExpandedResultIndex(null);
  }, [destination]);

  const handleViewDetailsFromNearby = useCallback((result: PlacePreviewData) => {
    setSelectedPlace(result);
    setViewingDetailsFromNearby(true);
  }, []);

  const handleMakeDestinationFromNearby = useCallback((result: PlacePreviewData) => {
    setDestination(result);
    setLiveStage("destination_set");
    setIsLiveActive(false);
    setExpandedResultIndex(null);
    setNearbyResults(null);
    setNearbyCategory(null);
    showToast(`Destination changed to ${result.name}.`);
    void loadRoutePreview(result);
  }, [loadRoutePreview]);

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
    options?: { origin?: "search" | "map_click"; clickLat?: number; clickLng?: number },
  ) => {
    const lat = place.lat;
    const lng = place.lng;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      showToast("Invalid place location.");
      return;
    }

    if (process.env.NEXT_PUBLIC_ROVVY_MAP_DEBUG === "true") {
      console.info("[Rovvy Live Search] selectDestination", {
        place,
        targetLocation: { lat, lng },
        origin: options?.origin,
      });
    }

    setDestination(null);
    setIsLiveActive(false);
    setActiveRoute(null);
    setRoutePreviewStatus("idle");
    setRoutePreviewError(null);
    setRouteLoading(false);
    setRouteOrigin(null);
    setOriginPickMode(false);
    setShowOriginSetup(false);
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
    mapRef.current?.flyToPlace(lat, lng);

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
      const details = await liveGeocodingReverse(lat, lng);
      if (!details) return;

      const hours = details.extratags?.opening_hours;
      const reverseGeo = extractCityCountry(details.address);
      setSelectedPlace((prev) => {
        if (!prev || prev.lat !== lat || prev.lng !== lng) return prev;
        const nextOsmType = details.osm_type ?? prev.osmType;
        const nextOsmId = details.osm_id ?? prev.osmId;
        const nextCity = reverseGeo.city ?? prev.city;
        const nextCountry = reverseGeo.country ?? prev.country;
        const nextKey = buildPlaceKey({
          name: details.name || prev.name,
          lat,
          lng,
          city: nextCity,
          country: nextCountry,
          osmType: nextOsmType,
          osmId: nextOsmId,
        });
        return {
          ...prev,
          name: details.name || prev.name,
          categoryLabel:
            normalizePlaceCategory(details) ||
            (details.extratags ? normalizePlaceCategory(details.extratags) : null) ||
            (details.name || prev.name ? "Place" : "Address") ||
            prev.categoryLabel,
          address: formatStreetAddress(details.address, details.display_name || prev.address),
          phone: extractPhone(details.extratags),
          openingHours: hours ?? null,
          openStatus: parseOpenStatus(hours),
          osmType: nextOsmType,
          osmId: nextOsmId,
          city: nextCity,
          country: nextCountry,
          placeKey: nextKey,
        };
      });
    } finally {
      setLoadingPlaceDetails(false);
    }
  }, [currentUserId, refreshRecentSearches]);

  const selectDestinationFromPlace = selectDestination;

  const handleMapClick = useCallback(async (lat: number, lng: number, features: any[]) => {
    if (isLiveActive) return;

    if (originPickMode) {
      void handleOriginMapPick(lat, lng);
      return;
    }

    setViewingDetailsFromNearby(false);
    setShowSearchPopup(false);
    setShowSuggestionsCard(false);
    setNearbyResults(null);
    setNearbyCategory(null);
    setNearbyError(null);
    setExpandedResultIndex(null);
    resetRoviExplanation();

    setMapClickResolving(true);
    setNearbyPlacesAtClick(null);

    const fallbackPlace = buildDroppedPinPlace(lat, lng, userLocation);

    try {
      const scored = features
        .map((f) => ({ feature: f, score: scoreFeature(f) }))
        .sort((a, b) => b.score - a.score);

      const bestFeatureObj = scored[0];
      const bestFeature = bestFeatureObj?.feature;
      const clickedName = bestFeature
        ? (bestFeature.properties?.name ||
           bestFeature.properties?.name_en ||
           bestFeature.properties?.display_name ||
           bestFeature.properties?.title ||
           null)
        : null;

      if (bestFeature && clickedName && bestFeatureObj.score >= 40) {
        const labelPlace = mapLabelFeatureToPlacePreview(bestFeature, lat, lng, userLocation);
        setMapClickResolving(false);
        await selectDestinationFromPlace(labelPlace, {
          origin: "map_click",
          clickLat: lat,
          clickLng: lng,
        });
        return;
      }

      let featureProperties: any = null;
      if (bestFeature) {
        const p = bestFeature.properties || {};
        featureProperties = {};
        const keysToPreserve = [
          "name", "amenity", "shop", "tourism", "leisure", "healthcare",
          "public_transport", "highway", "brand", "operator",
          "class", "type", "category", "subclass", "kind",
          "maki", "icon", "symbol", "marker-symbol",
          "religion",
          "osm_id", "osm_type"
        ];
        keysToPreserve.forEach((key) => {
          if (p[key] !== undefined) {
            featureProperties[key] = p[key];
          }
        });
        if (bestFeature.layer?.id) {
          featureProperties["layer.id"] = bestFeature.layer.id;
        }
        if (bestFeature.layer?.["source-layer"]) {
          featureProperties["sourceLayer"] = bestFeature.layer["source-layer"];
        }
        if (bestFeature.id) {
          featureProperties["id"] = bestFeature.id;
        }
      }

      const response = await apiFetch<{ place: any; candidates: any[] }>("/places/resolve-click", {
        method: "POST",
        body: JSON.stringify({
          lat,
          lng,
          clickedName,
          featureProperties,
          radiusMeters: 75
        })
      });

      if (!response || !response.place) {
        throw new Error("Invalid response from click resolver");
      }

      const p = response.place;
      const primaryPlace = mapResolveClickPlace(p, userLocation);

      const otherCandidates = (response.candidates || [])
        .filter((c: any) => c.placeKey !== p.placeKey)
        .map((c: any) => mapResolveClickPlace(c, userLocation));

      setMapClickResolving(false);
      await selectDestinationFromPlace(primaryPlace, {
        origin: "map_click",
        clickLat: lat,
        clickLng: lng,
      });
      if (otherCandidates.length > 0) {
        setNearbyPlacesAtClick(otherCandidates);
      }
    } catch {
      logRovvyMapClickResolver("backend unavailable, using dropped pin fallback.");
      setMapClickResolving(false);
      await selectDestinationFromPlace(fallbackPlace, {
        origin: "map_click",
        clickLat: lat,
        clickLng: lng,
      });
    }
  }, [isLiveActive, userLocation, selectDestination, originPickMode, handleOriginMapPick]);

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
    [resolveSearchAnchor, selectPlace],
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
        setSearchResults(results);
      } catch (err: any) {
        if (err.name !== "AbortError") {
          setSearchResults([]);
          setSearchError("Search is unavailable right now.");
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
      const bearing = mapRef.current?.getBearing();
      if (bearing != null) setMapBearing(Math.round(bearing));
    }, 500);
    return () => window.clearInterval(timer);
  }, []);

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
    if (destination) {
      void loadRoutePreview(destination);
    }
  }, [travelMode, destination?.lat, destination?.lng, destination?.placeKey, loadRoutePreview]);

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
      category: place.categoryLabel,
      hasOpeningHours: Boolean(place.openingHours || place.openStatus),
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
    console.log("[Rovvy Debug] gpsState after update:", newState);
    setGpsState(newState);

    if (newState.lat !== null && newState.lng !== null) {
      const loc = { lat: newState.lat, lng: newState.lng };
      setSelectedPlace((prev) => (prev ? updatePlaceDistance(prev, loc) : prev));
      setDestination((prev) => (prev ? updatePlaceDistance(prev, loc) : prev));
      setRouteOrigin((prev) => {
        if (!prev || prev.source === "gps") {
          return buildGpsRouteOrigin(newState.lat!, newState.lng!, newState.accuracyMeters);
        }
        return prev;
      });
    }

    if (newState.accuracyMeters && newState.accuracyMeters > 500 && !lowAccuracyToastShownRef.current) {
      lowAccuracyToastShownRef.current = true;
      showToast("Your location may be approximate.");
    }
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
    if (locationContext && !locationContext.liveSafe) return;
    setDestination(selectedPlace);
    setIsLiveActive(false);
    setLiveStage("destination_set");
    mapRef.current?.clearClickedPin();
    recordRecentSearch(
      { ...buildPlaceRecentSearch(selectedPlace), type: "destination" },
      currentUserId,
    );
    refreshRecentSearches();
    const defaultOrigin = resolveDefaultRouteOrigin();
    if (defaultOrigin) setRouteOrigin(defaultOrigin);
    void loadRoutePreview(selectedPlace, { origin: defaultOrigin });
  }

  function handleStartFromPlacePreview() {
    handleMakeDestination();
  }

  function handleGetDirections() {
    if (!requireSolo() || !selectedPlace) return;
    if (locationContext && !locationContext.liveSafe) return;
    if (!canStartSoloLive(selectedPlace.distanceM)) {
      showToast("This destination is too far for Solo Live. Plan a trip first.");
      return;
    }
    setDestination(selectedPlace);
    setIsLiveActive(true);
    setLiveStage("solo_drive_command");
    mapRef.current?.clearClickedPin();
    recordRecentSearch(
      { ...buildPlaceRecentSearch(selectedPlace), type: "destination" },
      currentUserId,
    );
    refreshRecentSearches();
    const defaultOrigin = resolveDefaultRouteOrigin();
    if (defaultOrigin) setRouteOrigin(defaultOrigin);
    void loadRoutePreview(selectedPlace, { active: true, fitMap: false, origin: defaultOrigin });
    if (!liveGpsActive) mapRef.current?.locateUser();
  }

  function handleContinueFromPreview() {
    if (!requireSolo() || !selectedPlace) return;
    if (locationContext && !locationContext.liveSafe) {
      handleContinueAnyway();
      return;
    }
    handleMakeDestination();
  }

  function handleContinueAnyway() {
    if (!requireSolo() || !selectedPlace) return;
    const place = selectedPlace;
    setDestination(place);
    setIsLiveActive(false);
    setLiveStage("long_distance_preview");
    resetRoviExplanation();

    // ── Trigger Route Intelligence fetch ─────────────────────────────────────
    const destSummary = placeToLocationSummary(place);
    const originSummary = userRegionToLocationSummary(userRegion, userLocation);
    if (originSummary) {
      setRouteIntelligenceLoading(true);
      setRouteIntelligenceResponse(null);
      setRouteIntelligenceError(null);
      fetchRouteIntelligence(originSummary, destSummary)
        .then((resp) => {
          setRouteIntelligenceResponse(resp);
        })
        .catch((err) => {
          setRouteIntelligenceError(
            "Route intelligence unavailable. Check connection and try again."
          );
        })
        .finally(() => {
          setRouteIntelligenceLoading(false);
        });
    } else {
      // No origin resolved — skip intelligence, just show map
      setRouteIntelligenceError(
        "Your location is needed to resolve route options. Enable GPS or move the map."
      );
    }
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
    setShowSuggestionsCard(true);
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
    if (!canStartSoloLive(destination.distanceM)) {
      showToast("This destination is too far for Solo Live. Plan a trip first.");
      return;
    }
    setIsLiveActive(true);
    setLiveStage("solo_drive_command");
    mapRef.current?.locateUser(true);
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
    const currentOrigin = (routeOrigin && routeOrigin.source !== "gps")
      ? routeOrigin
      : resolveDefaultRouteOrigin();
    void loadRoutePreview(destination, { origin: currentOrigin });
  }

  function handleBeginNavigation() {
    if (!requireSolo() || !destination) return;
    if (routePreviewStatus !== "ready" || !activeRoute) {
      showToast(routePreviewError || "Route unavailable right now.");
      return;
    }
    if (!canStartSoloLive(destination.distanceM)) {
      showToast("This destination is too far for Solo Live navigation.");
      return;
    }
    setLiveStage("solo_drive_navigation");
    setIsLiveActive(true);
    mapRef.current?.locateUser(true);
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
    setTripStatus("on_the_way");

    setLiveStage("destination_set");
    showToast("Solo Live ended.");
  }

  function handleAddStopFromPreview() {
    if (!requireSolo()) return;
    if (!destination) {
      showToast("Make this a destination first, then add stops.");
      return;
    }
    if (selectedPlace) {
      setPlannedStops((prev) => [...prev, selectedPlace]);
      showToast("Stop added to route.");
    }
  }

  function handleAddStopFromLive() {
    if (!destination) return;
    showToast("Add Stop — coming soon.");
  }

  function handleLocateClick() {
    if (gpsStatusNeedsHelper(gpsStatus)) {
      setShowGpsHelper(true);
    }
    mapRef.current?.locateUser(true);
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

  const showFarAwayPanel =
    ((liveStage === "place_preview" && selectedPlace && !isLiveActive) ||
      (selectedPlace && viewingDetailsFromNearby)) &&
    locationContext != null &&
    (locationContext.classification === "very_far_destination" ||
      locationContext.classification === "country_mismatch");
  const showPlacePreview =
    ((liveStage === "place_preview" && selectedPlace && !isLiveActive) ||
      (selectedPlace && viewingDetailsFromNearby)) &&
    !showFarAwayPanel;
  const showRoutePreview =
    (liveStage === "destination_set" || isLongDistancePreview) &&
    destination &&
    !isLiveActive;
  const showSoloLivePanel =
    isLiveActive && liveStage === "solo_drive_command" && destination;
  const showNavigationOverlay =
    isLiveActive && isNavigating && destination;

  const mapPinSource =
    destination ?? (selectedPlace && !showFarAwayPanel ? selectedPlace : null);
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
    if (
      liveStage !== "destination_set" &&
      liveStage !== "long_distance_preview" &&
      !isLiveActive
    ) {
      return null;
    }
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

  return (
    <div className="h-full relative select-none">
      <LiveMapComponent
        activeLayer={activeLayer}
        mapRef={mapRef}
        mapPin={mapPin ? { lat: mapPin.lat, lng: mapPin.lng } : null}
        routeOriginPin={routeOriginPin}
        routeLine={routeLine}
        isLiveActive={isLiveActive}
        navigationMode={isNavigating}
        mapFollowMode={mapFollowMode}
        onGpsStateChange={handleGpsStateChange}
        nearbyResults={nearbyResults}
        onNearbyMarkerClick={handleResultClick}
        onMapClick={handleMapClick}
        onMapInteraction={setIsMapInteracting}
      />

      {toast ? (
        <div className="absolute left-1/2 top-20 z-40 max-w-sm -translate-x-1/2 rounded-xl bg-stone-900 px-4 py-2 text-center text-sm text-white shadow-lg">
          {toast}
        </div>
      ) : null}

      {/* Click-away backdrop overlay to reduce background interaction and close suggestions */}
      {showSuggestionsCard && (
        <div
          className="fixed inset-0 z-20 cursor-default bg-stone-900/[0.02] backdrop-blur-[0.5px]"
          onClick={() => setShowSuggestionsCard(false)}
        />
      )}

      {/* Floating in-map search bar & selectors */}
      {!isNavigating ? (
        <div
          className={`absolute top-4 left-4 z-30 flex flex-col gap-2 max-w-[calc(100%-2rem)] transition-all duration-300 ${
            isMapInteracting
              ? "opacity-0 pointer-events-none translate-y-[-10px]"
              : "opacity-100 pointer-events-auto translate-y-0"
          }`}
        >
          {/* Top Row: Search Bar & Selectors */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Bar Container */}
            <div className="relative" id="search-container">
              {/* Floating Search Bar */}
              <div
                className="flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-full bg-white/95 backdrop-blur-md shadow-[0_4px_24px_rgba(0,0,0,0.08)] w-72 sm:w-96"
              >
                <Search className="w-4 h-4 shrink-0 text-stone-400" />
                 <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (e.target.value.trim().length >= 2) {
                      setShowSuggestionsCard(false);
                      setShowSearchPopup(true);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void searchPlaceByName(searchQuery);
                    }
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (searchQuery.trim().length < 2) {
                      setShowSuggestionsCard(true);
                    } else {
                      setShowSearchPopup(true);
                    }
                  }}
                  placeholder="Search places, stops, meet points"
                  className="w-full bg-transparent focus:outline-none text-sm text-stone-800 placeholder:text-stone-400"
                />
                {searchLoading ? (
                  <span className="text-[10px] text-stone-400 shrink-0 mr-1 animate-pulse">…</span>
                ) : null}
                <div className="h-4 w-px bg-stone-200 mx-1 shrink-0" />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSuggestionsCard((prev) => !prev);
                    setShowSearchPopup(false);
                  }}
                  className="px-3 py-1 rounded-full text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 transition-colors shrink-0 cursor-pointer"
                >
                  Suggestions
                </button>
              </div>

              {/* Autocomplete Dropdown Search Results */}
              {searchQuery.trim().length >= 2 && showSearchPopup && searchNeedsLocation && !searchLoading && (
                <div className="absolute left-0 right-0 top-full z-30 mt-1 rounded-2xl bg-white/95 backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.12)] px-3 py-2.5 text-xs text-stone-500">
                  Turn on location or move the map to search nearby.
                </div>
              )}
              {searchQuery.trim().length >= 2 && showSearchPopup && searchLoading && searchResults.length === 0 && !searchNeedsLocation && (
                <div className="absolute left-0 right-0 top-full z-30 mt-1 rounded-2xl bg-white/95 backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.12)] px-3 py-2.5 text-xs text-stone-400">
                  Searching nearby places…
                </div>
              )}
              {searchQuery.trim().length >= 2 && showSearchPopup && searchError && !searchLoading && (
                <div className="absolute left-0 right-0 top-full z-30 mt-1 rounded-2xl bg-white/95 backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.12)] px-3 py-2.5 text-xs text-amber-700">
                  {searchError}
                </div>
              )}
              {searchQuery.trim().length >= 2 && showSearchPopup && !searchLoading && !searchNeedsLocation && !searchError && searchResults.length === 0 && (
                <div className="absolute left-0 right-0 top-full z-30 mt-1 rounded-2xl bg-white/95 backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.12)] px-3 py-2.5 text-xs text-stone-500">
                  No nearby places found. Try a different search.
                </div>
              )}
              {searchQuery.trim().length >= 2 && searchResults.length > 0 && showSearchPopup && (
                <ul className="absolute left-0 right-0 top-full z-30 mt-1 max-h-52 overflow-auto rounded-2xl bg-white/95 backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
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
                          className="flex w-full gap-2 px-3 py-2.5 text-left hover:bg-stone-50/80 transition-colors"
                          onClick={() => {
                            void selectPlace(result);
                          }}
                        >
                          <span className="shrink-0 pt-0.5">
                            {result.category === "Address" || result.category === "Building" ? "📌" : "📍"}
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-stone-800 line-clamp-1">
                              {result.name}
                            </span>
                            {subtitle && (
                              <span className="block text-xs font-medium text-teal-700 line-clamp-1 mt-0.5">
                                {subtitle}
                              </span>
                            )}
                            {addressLine && (
                              <span className="block text-[10px] text-stone-500 line-clamp-1 mt-0.5">
                                {addressLine}
                              </span>
                            )}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              {/* Suggestions / Quick Picks Glassmorphism Card */}
              {showSuggestionsCard && (
                <div className="absolute left-0 top-full z-30 mt-2 w-80 sm:w-96 rounded-2xl bg-white/95 backdrop-blur-xl p-4 shadow-[0_8px_32px_rgba(0,0,0,0.12)] text-stone-800 animate-in fade-in slide-in-from-top-2 duration-200">
                  {/* Recent Searches — dynamic, localStorage-backed */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                        {recentSearches.length > 0 ? "Recent Searches" : "Suggestions"}
                      </h4>
                      {recentSearches.length > 0 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            clearRecentSearches(currentUserId);
                            setRecentSearches([]);
                          }}
                          className="text-[10px] font-semibold text-stone-400 hover:text-red-500 transition-colors cursor-pointer"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    <ul className="flex flex-col gap-0.5">
                      {(recentSearches.length > 0 ? recentSearches : DEFAULT_RECENT_SUGGESTIONS).map((item) => (
                        <li key={item.id}>
                          <button
                            type="button"
                            className="flex items-center gap-2.5 w-full px-2 py-1.5 hover:bg-white/40 rounded-lg text-left transition-colors cursor-pointer group"
                            onClick={() => {
                              if (item.type === "category_search" && item.query) {
                                void handleNearbySearch(item.query);
                              } else if (
                                (item.type === "place" ||
                                  item.type === "destination" ||
                                  item.type === "dropped_pin") &&
                                item.lat != null &&
                                item.lng != null
                              ) {
                                // Open place preview for known-coord items
                                const pseudo: PlacePreviewData = {
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
                                  source: item.source,
                                };
                                setSelectedPlace(pseudo);
                                setLiveStage("place_preview");
                                setShowSuggestionsCard(false);
                              } else if (item.query) {
                                void searchPlaceByName(item.query);
                              } else {
                                void searchPlaceByName(item.label);
                              }
                            }}
                          >
                            {/* Type icon */}
                            <span className="text-[13px] shrink-0 w-4 text-center">
                              {item.type === "category_search"
                                ? "🔍"
                                : item.type === "dropped_pin"
                                ? "📍"
                                : item.type === "destination"
                                ? "🏁"
                                : "📍"}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-medium text-stone-700 truncate">
                                {item.label}
                              </span>
                              {item.subtitle && (
                                <span className="block text-[10px] text-stone-400 truncate">
                                  {item.subtitle}
                                </span>
                              )}
                            </span>
                            <ChevronRight className="w-3.5 h-3.5 text-stone-300 group-hover:text-stone-500 shrink-0 transition-colors" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Divider */}
                  <div className="my-3 border-t border-white/20" />

                  {/* Saved Places */}
                  <div>
                    <h4 className="mb-2 text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                      Saved Places
                    </h4>
                    <ul className="flex flex-col gap-1 text-sm">
                      {savedPlaces.map((place) => (
                        <li key={place.name}>
                          <button
                            type="button"
                            className="flex justify-between items-center w-full px-2 py-1.5 hover:bg-white/40 rounded-lg text-left transition-colors cursor-pointer"
                            onClick={() => {
                              void searchPlaceByName(`${place.name} ${place.address}`);
                            }}
                          >
                            <span className="flex items-center gap-2 truncate">
                              <Star className="w-3.5 h-3.5 text-amber-500 shrink-0 fill-amber-500" />
                              <span className="font-semibold text-stone-700">{place.name}</span>
                            </span>
                            <ChevronRight className="w-4 h-4 text-stone-400 shrink-0" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Divider */}
                  <div className="my-3 border-t border-white/20" />

                  {/* Quick Suggestions */}
                  <div>
                    <h4 className="mb-2 text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                      Quick Suggestions
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { label: "⛽ Gas", query: "gas" },
                        { label: "☕ Coffee", query: "coffee" },
                        { label: "🍴 Food", query: "food" },
                        { label: "🚻 Restrooms", query: "restroom" },
                        { label: "🌲 Parks", query: "park" },
                        { label: "🏧 ATM", query: "atm" },
                        { label: "🏥 Hospital", query: "hospital" },
                        { label: "🚗 Parking", query: "parking" },
                      ].map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          className="px-2.5 py-1 rounded-full text-xs font-medium text-stone-700 bg-white/40 hover:bg-white/60 border border-white/20 transition-all cursor-pointer"
                          onClick={() => {
                            void handleNearbySearch(item.query);
                          }}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="my-3 border-t border-white/20" />

                  {/* Open Group Trip Button */}
                  <div>
                    <button
                      type="button"
                      className="w-full rounded-full bg-[#0F766E]/90 hover:bg-[#0D635C] py-2 text-center text-xs font-semibold text-white shadow-md transition-colors cursor-pointer"
                      onClick={() => router.push("/trips")}
                    >
                      Open Group Trip
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Travel Mode + Workflow Selectors (Floating Pills) */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {/* Travel Mode Selector */}
              <div className="flex gap-0.5 p-0.5 bg-white/95 backdrop-blur-md rounded-full shadow-[0_4px_18px_rgba(0,0,0,0.08)]">
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
                      onClick={() => setTravelMode(mode)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                        isActive
                          ? "bg-[#0F766E] text-white shadow-sm"
                          : "text-stone-500 hover:text-stone-800 hover:bg-stone-100/50"
                      }`}
                    >
                      <span className="mr-1">{icons[mode] || ""}</span>
                      {mode}
                    </button>
                  );
                })}
              </div>

              {/* Workflow Selector */}
              <div className="flex gap-0.5 p-0.5 bg-white/95 backdrop-blur-md rounded-full shadow-[0_4px_18px_rgba(0,0,0,0.08)]">
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
                      onClick={() => setWorkflowType(type)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                        isActive
                          ? "bg-[#0F766E] text-white shadow-sm"
                          : "text-stone-500 hover:text-stone-800 hover:bg-stone-100/50"
                      }`}
                    >
                      <span className="mr-1">{icons[type] || ""}</span>
                      {type}
                    </button>
                  );
                })}
              </div>

              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shadow-[0_4px_18px_rgba(0,0,0,0.08)] ${statusPillClass()}`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                {statusPillLabel()}
              </div>
            </div>
          </div>

          {/* Nearby Suggestions Results Panel */}
          {nearbyCategory && !selectedPlace && (
            <div className="w-80 sm:w-96 rounded-2xl bg-white/95 backdrop-blur-xl p-4 shadow-[0_8px_32px_rgba(0,0,0,0.12)] text-stone-800 flex flex-col max-h-[calc(100vh-140px)] animate-in fade-in slide-in-from-top-2 duration-200">
              {/* Header */}
              <div className="flex items-center justify-between mb-3 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-lg">📍</span>
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
                    return (
                      <div
                        key={res.placeKey}
                        className="p-3 rounded-xl border transition-all cursor-pointer bg-white/40 border-stone-200/40 hover:bg-white/60 hover:border-stone-300/60"
                        onClick={() => handleResultClick(res)}
                      >
                        <div className="flex items-start gap-2.5">
                          {/* Number Badge */}
                          <div className="w-5 h-5 rounded-full bg-[#0F766E] text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                            {index + 1}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="font-semibold text-stone-800 text-xs truncate">
                              {res.name}
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
          onAskRovi={() => void handleAskRovi()}
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
          loadingDetails={mapClickResolving || loadingPlaceDetails}
          placeMedia={placeMedia}
          placeMediaLoading={placeMediaLoading}
          placeTags={placeTags}
          hasUserLocation={Boolean(userLocation)}
          locationContext={locationContext}
          showAskRovi={showAskRoviAi}
          roviLoading={roviExplanationLoading}
          roviExplanation={roviExplanation}
          roviError={roviExplanationError}
          onAskRovi={() => void handleAskRovi()}
          onSearchNearMe={handleSearchNearMe}
          onChangeDestination={clearSelectedPlace}
          onPlanTrip={handlePlanTrip}
          onContinueAnyway={handleContinueFromPreview}
          onClose={clearSelectedPlace}
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
          nearbyPlacesAtClick={nearbyPlacesAtClick}
          onSelectNearbyPlaceAtClick={handleSelectNearbyPlaceAtClick}
          liveStage={liveStage}
        />
      ) : null}

      {mapClickResolving && (
        <div className="absolute bottom-6 right-6 z-35 w-80 rounded-2xl bg-white/75 backdrop-blur-xl border border-white/30 p-4 shadow-xl text-stone-800 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="w-5 h-5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin shrink-0" />
          <span className="text-xs font-semibold text-stone-700">Checking this location...</span>
        </div>
      )}

      {/* Route Preview — local/regional destination */}
      {originPickMode ? (
        <div className="pointer-events-none absolute left-1/2 top-24 z-35 max-w-sm -translate-x-1/2 rounded-xl bg-stone-900/90 px-4 py-2 text-center text-sm text-white shadow-lg">
          Tap the map to set your starting point
        </div>
      ) : null}

      {showRoutePreview && destination && !isLongDistancePreview ? (
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

      {showRoutePreview && destination && !isLongDistancePreview ? (
        <LiveRouteOriginSetup
          open={showOriginSetup}
          onClose={() => setShowOriginSetup(false)}
          onUseCurrentLocation={handleUseCurrentLocationOrigin}
          onUseMapCenter={handleUseMapCenterOrigin}
          onPickOnMap={handleStartOriginPick}
          onSelectSearchOrigin={handleSearchOriginSelect}
          gpsAvailable={Boolean(userLocation)}
          gpsAccuracyMeters={gpsState.accuracyMeters}
          mapCenterAvailable={true}
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
          liveStage={liveStage}
          tripStatus={tripStatus}
          travelMode={travelMode}
          onTripStatusChange={setTripStatus}
          onBeginNavigation={handleBeginNavigation}
          onEndSoloLive={handleEndSoloLive}
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

      {/* Right Map Controls — fixed on map workspace, always visible */}
      <div
        className={`pointer-events-auto absolute z-40 flex flex-col items-center gap-1.5 transition-all duration-200 max-md:gap-1 md:gap-2 ${LIVE_MAP_CONTROLS_POSITION}`}
      >
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-lg hover:bg-stone-100 md:h-10 md:w-10"
          onClick={() => mapRef.current?.zoomIn()}
          title="Zoom in"
          aria-label="Zoom in"
        >
          <span className="text-xl font-light text-stone-600 md:text-2xl">+</span>
        </button>
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-lg hover:bg-stone-100 md:h-10 md:w-10"
          onClick={() => mapRef.current?.zoomOut()}
          title="Zoom out"
          aria-label="Zoom out"
        >
          <span className="text-xl font-light text-stone-600 md:text-2xl">−</span>
        </button>

        <div className="relative flex flex-col items-center gap-1">
          <button
            type="button"
            className={`relative flex h-10 w-10 items-center justify-center rounded-full shadow-lg transition-all duration-200 md:h-11 md:w-11 ${
              gpsStatus === "active"
                ? "bg-[#0D5C52] hover:bg-[#0a4a42] ring-2 ring-[#0F766E]/40"
                : gpsStatus === "approximate"
                ? "bg-[#0F766E] hover:bg-[#0D5C52] ring-2 ring-[#0F766E]/30"
                : gpsStatus === "denied"
                ? "bg-stone-700 hover:bg-stone-800"
                : gpsStatus === "timeout" || gpsStatus === "error" || gpsStatus === "outdated"
                ? "bg-amber-700 hover:bg-amber-800"
                : gpsStatus === "requesting"
                ? "bg-[#0F766E] hover:bg-[#0D5C52] animate-pulse"
                : "bg-[#134E48] hover:bg-[#0D5C52]"
            }`}
            onClick={handleLocateClick}
            title={
              gpsStatus === "denied"
                ? "Location off — click to retry"
                : gpsStatus === "timeout" || gpsStatus === "error"
                ? "Location unavailable — click for options"
                : gpsStatus === "requesting"
                ? "Finding location…"
                : "Locate me"
            }
            aria-pressed={liveGpsActive}
            aria-label="Locate me"
          >
            {gpsStatus === "requesting" ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              /* Google Maps-style GPS crosshair target icon */
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-5 w-5 md:h-6 md:w-6"
                aria-hidden="true"
              >
                {/* Outer ring */}
                <circle cx="12" cy="12" r="7" stroke="white" strokeWidth="1.8" fill="none" />
                {/* Inner filled dot */}
                <circle cx="12" cy="12" r="2.5" fill="white" />
                {/* Crosshair lines */}
                <line x1="12" y1="2" x2="12" y2="5.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
                <line x1="12" y1="18.5" x2="12" y2="22" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
                <line x1="2" y1="12" x2="5.5" y2="12" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
                <line x1="18.5" y1="12" x2="22" y2="12" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            )}
          </button>
          {gpsStatusLabel(gpsStatus) &&
          gpsStatus !== "active" &&
          gpsStatus !== "approximate" ? (
            <button
              type="button"
              onClick={handleGpsStatusBadgeClick}
              className={`cursor-pointer whitespace-nowrap rounded-full px-2 py-0.5 text-center text-[9px] font-semibold shadow-sm ${
                gpsStatus === "requesting"
                  ? "bg-blue-100 text-blue-700"
                  : gpsStatus === "stale"
                  ? "bg-stone-200 text-stone-600"
                  : gpsStatus === "outdated"
                  ? "bg-amber-100 text-amber-800"
                  : gpsStatus === "denied"
                  ? "bg-stone-200 text-stone-600"
                  : gpsStatus === "timeout" || gpsStatus === "error"
                  ? "bg-amber-100 text-amber-800"
                  : "bg-stone-100 text-stone-500"
              }`}
              title="GPS status"
            >
              {gpsStatusLabel(gpsStatus)}
            </button>
          ) : null}
          {!isFreshGpsStatus(gpsStatus) &&
          gpsStatus !== "requesting" &&
          (gpsStatus === "timeout" ||
            gpsStatus === "denied" ||
            gpsStatus === "error" ||
            gpsStatus === "idle" ||
            gpsStatus === "outdated" ||
            gpsStatus === "stale") ? (
            <div className="whitespace-nowrap rounded-full bg-stone-100 px-2 py-0.5 text-center text-[9px] font-medium text-stone-500 shadow-sm">
              Using this map area
            </div>
          ) : null}
          {showGpsHelper ? (
            <div className="absolute right-full top-1/2 z-50 mr-3 w-56 -translate-y-1/2 rounded-xl border border-stone-200 bg-white/95 p-3 text-left shadow-xl backdrop-blur-md">
              <p className="text-xs font-semibold text-stone-800">
                {gpsStatus === "denied" ? "Location off" : "Location unavailable"}
              </p>
              <p className="mt-1 text-[11px] leading-snug text-stone-600">
                {gpsState.errorMessage
                  ? gpsState.errorMessage
                  : gpsStatus === "denied"
                  ? "Enable location permission in your browser to show your position."
                  : "Rovvy couldn't get your exact location from this browser. You can try again or use the current map area."}
              </p>
              <div className="mt-3 flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={handleLocateClick}
                  className="rounded-lg bg-[#0F766E] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-teal-800"
                >
                  Try again
                </button>
                {gpsStatus === "denied" ? (
                  <a
                    href="https://support.google.com/chrome/answer/142064?hl=en"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-stone-200 px-3 py-1.5 text-center text-[11px] font-semibold text-stone-700 hover:bg-stone-50"
                  >
                    Browser location help
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={handleUseMapArea}
                    className="rounded-lg border border-stone-200 px-3 py-1.5 text-[11px] font-semibold text-stone-700 hover:bg-stone-50"
                  >
                    Use map area
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowGpsHelper(false)}
                className="absolute right-1.5 top-1.5 px-1 text-xs text-stone-400 hover:text-stone-600"
                aria-label="Close"
              >
                ×
              </button>
            </div>
          ) : null}
        </div>

        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-lg hover:bg-stone-100 md:h-10 md:w-10"
          onClick={() => mapRef.current?.resetNorth()}
          title="Reset map orientation"
          aria-label="Reset map orientation"
        >
          <Compass
            className={`h-5 w-5 text-stone-500 transition-transform duration-300 ${mapBearing !== 0 ? "text-teal-700" : ""}`}
            style={{ transform: `rotate(${-mapBearing}deg)` }}
          />
        </button>
        <LiveMapLayerControl activeLayer={activeLayer} onLayerChange={setActiveLayer} />
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-lg hover:bg-stone-100 md:h-10 md:w-10"
          onClick={() => {
            if (!document.fullscreenElement) {
              void document.documentElement.requestFullscreen();
            } else {
              void document.exitFullscreen();
            }
          }}
          title="Toggle fullscreen"
          aria-label="Toggle fullscreen"
        >
          <Maximize2 className="h-5 w-5 text-stone-500" />
        </button>
        <button
          type="button"
          className="hidden h-9 w-9 items-center justify-center rounded-full bg-white shadow-lg hover:bg-stone-100 sm:flex md:h-10 md:w-10"
          onClick={() => setSoundEnabled((prev) => !prev)}
          title="Sound"
          aria-label="Toggle sound"
        >
          {soundEnabled ? (
            <Volume2 className="h-5 w-5 text-stone-500" />
          ) : (
            <VolumeX className="h-5 w-5 text-stone-300" />
          )}
        </button>
        <button
          type="button"
          className="hidden h-9 w-9 items-center justify-center rounded-full bg-white shadow-lg hover:bg-stone-100 sm:flex md:h-10 md:w-10"
          onClick={() => setAlertsEnabled((prev) => !prev)}
          title="Alerts"
          aria-label="Toggle alerts"
        >
          <Bell
            className={`h-5 w-5 ${alertsEnabled ? "text-amber-500" : "text-stone-300"}`}
          />
        </button>
      </div>
    </div>
  );
}
