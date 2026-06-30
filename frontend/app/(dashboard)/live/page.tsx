"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  ChevronRight,
  MapPin,
  Search,
  Star,
  Volume2,
  VolumeX,
  Bell,
  Layers,
  Maximize2,
} from "lucide-react";
import { haversineM } from "@/lib/geo";
import PlacePreviewCard, { type PlacePreviewData } from "./PlacePreviewCard";
import FarAwayPlacePanel from "./FarAwayPlacePanel";
import SoloRoutePreviewPanel from "./SoloRoutePreviewPanel";
import SoloLiveActivePanel from "./SoloLiveActivePanel";
import SoloLiveNavigationOverlay from "./SoloLiveNavigationOverlay";
import type { LiveStage, RouteLine, TripStatus, UserLocationUpdate } from "./live-types";
import {
  canDrawLocalRoute,
  canStartSoloLive,
  isLongDistanceFromUser,
} from "./live-types";
import {
  formatSearchResultSubtitle,
  liveGeocodingReverse,
  liveGeocodingSearch,
  pickNearestSearchResult,
  type LiveGeocodingSearchResult,
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
import type { LiveMapRef, MapFollowMode } from "./LiveMapComponent";

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

function parseOpenStatus(openingHours: string | undefined): string | null {
  if (!openingHours) return null;
  if (openingHours.includes("24/7")) return "Open Now";
  return "Open Now";
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

export default function LivePage() {
  const mapRef = useRef<LiveMapRef | null>(null);
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchBlurRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [activeLayer, setActiveLayer] =
    useState<"street" | "satellite" | "dark">("street");
  const [liveStage, setLiveStage] = useState<LiveStage>("static_landing");
  const [workflowType, setWorkflowType] =
    useState<(typeof WORKFLOW_TYPES)[number]>("Solo");
  const [travelMode, setTravelMode] =
    useState<(typeof TRAVEL_MODES)[number]>("Drive");

  const [selectedPlace, setSelectedPlace] = useState<PlacePreviewData | null>(null);
  const [destination, setDestination] = useState<PlacePreviewData | null>(null);
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [tripStatus, setTripStatus] = useState<TripStatus>("on_the_way");
  const [plannedStops, setPlannedStops] = useState<PlacePreviewData[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [speedMps, setSpeedMps] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [loadingPlaceDetails, setLoadingPlaceDetails] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchPopup, setShowSearchPopup] = useState(false);
  const [showSuggestionsCard, setShowSuggestionsCard] = useState(false);
  const [searchResults, setSearchResults] = useState<LiveGeocodingSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchBias, setSearchBias] = useState<SearchBias | null>(null);

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [liveGpsActive, setLiveGpsActive] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
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

  const recentSearches = [
    "Starbucks Reserve Chicago",
    "Shedd Aquarium",
    "Navy Pier",
  ];

  const savedPlaces = [
    { name: "Home", address: "123 Main St" },
    { name: "Work", address: "456 Broadway" },
    { name: "Gym", address: "789 Fitness Ave" },
  ];

  const resolveSearchBias = useCallback((): SearchBias | null => {
    if (userLocation) return userLocation;
    const mapCenter = mapRef.current?.getMapCenter();
    if (mapCenter) return mapCenter;
    return searchBias;
  }, [userLocation, searchBias]);

  const selectPlace = useCallback(async (result: LiveGeocodingSearchResult) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    const bias = resolveSearchBias();
    const userLoc = userLocation ?? mapRef.current?.getUserLocation() ?? bias;
    const distanceM = userLoc ? haversineM(userLoc.lat, userLoc.lng, lat, lng) : null;

    const initial: PlacePreviewData = {
      name: result.name || result.display_name.split(",")[0],
      categoryLabel: formatCategoryLabel(result.type, result.class),
      address: result.display_name,
      phone: null,
      lat,
      lng,
      distanceM,
      openingHours: null,
      openStatus: null,
    };

    setSelectedPlace(initial);
    setDestination(null);
    setIsLiveActive(false);
    setLiveStage("place_preview");
    setRoviExplanation(null);
    setRoviExplanationError(null);
    setRoviExplanationLoading(false);
    setSearchQuery(result.name || result.display_name.split(",")[0]);
    setSearchResults([]);
    setShowSearchPopup(false);
    setShowSuggestionsCard(false);
    setLoadingPlaceDetails(true);

    try {
      const details = await liveGeocodingReverse(lat, lng);
      if (!details) return;

      const hours = details.extratags?.opening_hours;
      setSelectedPlace((prev) => {
        if (!prev || prev.lat !== lat || prev.lng !== lng) return prev;
        return {
          ...prev,
          name: details.name || prev.name,
          categoryLabel:
            formatCategoryLabel(details.type, details.class) || prev.categoryLabel,
          address: formatStreetAddress(details.address, details.display_name || prev.address),
          phone: extractPhone(details.extratags),
          openingHours: hours ?? null,
          openStatus: parseOpenStatus(hours),
        };
      });
    } finally {
      setLoadingPlaceDetails(false);
    }
  }, [resolveSearchBias, userLocation]);

  const searchPlaceByName = useCallback(
    async (name: string) => {
      setSearchQuery(name);
      setShowSearchPopup(false);
      setShowSuggestionsCard(false);
      setSearchLoading(true);
      try {
        const bias = resolveSearchBias();
        const results = await liveGeocodingSearch(name, bias);
        const best = pickNearestSearchResult(results, bias);
        if (best) {
          await selectPlace(best);
        } else {
          setToast("No nearby matches found. Try a more specific search.");
          window.setTimeout(() => setToast(null), 3200);
        }
      } finally {
        setSearchLoading(false);
      }
    },
    [resolveSearchBias, selectPlace],
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

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const bias = resolveSearchBias();
        const results = await liveGeocodingSearch(searchQuery, bias);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 400);

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery, resolveSearchBias]);

  useEffect(() => {
    const timer = window.setTimeout(() => mapRef.current?.locateUser(), 600);
    return () => window.clearTimeout(timer);
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

  function handleUserLocationChange(update: UserLocationUpdate) {
    const loc = { lat: update.lat, lng: update.lng };
    setUserLocation(loc);
    setSpeedMps(update.speedMps);
    setSelectedPlace((prev) => (prev ? updatePlaceDistance(prev, loc) : prev));
    setDestination((prev) => (prev ? updatePlaceDistance(prev, loc) : prev));
  }

  function clearSelectedPlace() {
    if (isLiveActive) return;
    setSelectedPlace(null);
    setDestination(null);
    setLiveStage("static_landing");
    setSearchQuery("");
    resetRoviExplanation();
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
  }

  function handleStartFromPlacePreview() {
    handleMakeDestination();
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
    setDestination(selectedPlace);
    setIsLiveActive(false);
    setLiveStage("long_distance_preview");
    resetRoviExplanation();
  }

  function handleSearchNearMe() {
    setSelectedPlace(null);
    setDestination(null);
    setLiveStage("static_landing");
    setSearchQuery("");
    setSearchResults([]);
    setShowSearchPopup(true);
    setShowSuggestionsCard(false);
    locateUser();
    window.setTimeout(() => searchInputRef.current?.focus(), 120);
  }

  function handlePlanTrip() {
    showToast("Plan this as a future trip.");
    router.push("/trips/plan");
  }

  function handleStartSoloLive() {
    if (!requireSolo() || !destination) return;
    if (!canStartSoloLive(destination.distanceM)) {
      showToast("This destination is too far for Solo Live. Plan a trip first.");
      return;
    }
    setIsLiveActive(true);
    setLiveStage("solo_drive_command");
    if (!liveGpsActive) mapRef.current?.locateUser();
  }

  function handleChangeDestination() {
    setDestination(null);
    setIsLiveActive(false);
    setLiveStage(selectedPlace ? "place_preview" : "static_landing");
  }

  function handleBeginNavigation() {
    if (!requireSolo() || !destination) return;
    if (!canStartSoloLive(destination.distanceM)) {
      showToast("This destination is too far for Solo Live navigation.");
      return;
    }
    setLiveStage("solo_drive_navigation");
    if (!liveGpsActive) mapRef.current?.locateUser();
  }

  function handleEndSoloLive() {
    setIsLiveActive(false);
    setTripStatus("on_the_way");
    setSpeedMps(null);
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

  function locateUser() {
    setGpsError(null);
    mapRef.current?.locateUser();
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
    liveStage === "place_preview" &&
    selectedPlace &&
    !isLiveActive &&
    locationContext != null &&
    (locationContext.classification === "very_far_destination" ||
      locationContext.classification === "country_mismatch");
  const showPlacePreview =
    liveStage === "place_preview" &&
    selectedPlace &&
    !isLiveActive &&
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
    if (!destination || !userLocation) return null;
    if (
      liveStage !== "destination_set" &&
      liveStage !== "long_distance_preview" &&
      !isLiveActive
    ) {
      return null;
    }
    if (!canDrawLocalRoute(destination.distanceM)) return null;
    return {
      from: userLocation,
      to: { lat: destination.lat, lng: destination.lng },
      active: isLiveActive,
    };
  }, [destination, userLocation, liveStage, isLiveActive]);

  const rightPanelOpen = Boolean(
    showPlacePreview || showFarAwayPanel || showRoutePreview || showSoloLivePanel,
  );
  const searchDropdownBias = resolveSearchBias();
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
        routeLine={routeLine}
        isLiveActive={isLiveActive}
        navigationMode={isNavigating}
        mapFollowMode={mapFollowMode}
        onUserLocationChange={handleUserLocationChange}
        onLiveGpsChange={setLiveGpsActive}
        onGpsError={setGpsError}
      />

      {toast ? (
        <div className="absolute left-1/2 top-20 z-40 max-w-sm -translate-x-1/2 rounded-xl bg-stone-900 px-4 py-2 text-center text-sm text-white shadow-lg">
          {toast}
        </div>
      ) : null}

      {gpsError ? (
        <div className="absolute left-1/2 top-32 z-40 max-w-sm -translate-x-1/2 rounded-xl bg-red-900 px-4 py-2 text-center text-sm text-white shadow-lg">
          {gpsError}
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
        <div className="absolute top-4 left-4 z-30 flex flex-col gap-2 max-w-[calc(100%-2rem)]">
          {/* Top Row: Search Bar & Selectors */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Bar Container */}
            <div className="relative" id="search-container">
              {/* Floating Search Bar */}
              <div
                className="flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-full bg-white/95 backdrop-blur-md shadow-lg border border-stone-200/50 w-72 sm:w-96"
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
              {searchQuery.trim().length >= 2 && searchResults.length > 0 && showSearchPopup && (
                <ul className="absolute left-0 right-0 top-full z-30 mt-1 max-h-52 overflow-auto rounded-2xl border border-stone-200/60 bg-white/95 backdrop-blur-md shadow-xl">
                  {searchResults.map((result) => {
                    const subtitle = formatSearchResultSubtitle(result, searchDropdownBias);
                    return (
                      <li key={result.place_id}>
                        <button
                          type="button"
                          className="flex w-full gap-2 px-3 py-2.5 text-left hover:bg-stone-50/80 transition-colors"
                          onClick={() => {
                            void selectPlace(result);
                          }}
                        >
                          <span className="shrink-0 pt-0.5">📍</span>
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-stone-800 line-clamp-1">
                              {result.name || result.display_name.split(",")[0]}
                            </span>
                            {subtitle ? (
                              <span className="block text-xs text-stone-500 line-clamp-1">
                                {subtitle}
                              </span>
                            ) : null}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              {/* Suggestions / Quick Picks Glassmorphism Card */}
              {showSuggestionsCard && (
                <div className="absolute left-0 top-full z-30 mt-2 w-80 sm:w-96 rounded-2xl bg-white/70 backdrop-blur-xl border border-white/30 p-4 shadow-xl text-stone-800 animate-in fade-in slide-in-from-top-2 duration-200">
                  {/* Recent Searches */}
                  <div>
                    <h4 className="mb-2 text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                      Recent Searches
                    </h4>
                    <ul className="flex flex-col gap-1 text-sm">
                      {recentSearches.map((search) => (
                        <li key={search}>
                          <button
                            type="button"
                            className="flex justify-between items-center w-full px-2 py-1.5 hover:bg-white/40 rounded-lg text-left transition-colors cursor-pointer"
                            onClick={() => {
                              void searchPlaceByName(search);
                            }}
                          >
                            <span className="truncate text-stone-700 font-medium">{search}</span>
                            <ChevronRight className="w-4 h-4 text-stone-400 shrink-0" />
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
                        { label: "⛽ Gas", query: "Gas Station" },
                        { label: "☕ Coffee", query: "Coffee Shop" },
                        { label: "🍴 Food", query: "Restaurant" },
                        { label: "🌲 Parks", query: "Park" },
                        { label: "🏧 ATM", query: "ATM" },
                        { label: "🏥 Hospital", query: "Hospital" },
                      ].map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          className="px-2.5 py-1 rounded-full text-xs font-medium text-stone-700 bg-white/40 hover:bg-white/60 border border-white/20 transition-all cursor-pointer"
                          onClick={() => {
                            void searchPlaceByName(item.query);
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
            <div className="flex gap-2 shrink-0">
              <select
                value={travelMode}
                onChange={(e) => setTravelMode(e.target.value as (typeof TRAVEL_MODES)[number])}
                className="rounded-full border border-stone-200/60 bg-white/90 backdrop-blur-sm px-3 py-1.5 text-xs font-semibold text-stone-700 outline-none shadow-md hover:bg-stone-50 cursor-pointer transition-colors"
              >
                {TRAVEL_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
              <select
                value={workflowType}
                onChange={(e) =>
                  setWorkflowType(e.target.value as (typeof WORKFLOW_TYPES)[number])
                }
                className="rounded-full border border-stone-200/60 bg-white/90 backdrop-blur-sm px-3 py-1.5 text-xs font-semibold text-stone-700 outline-none shadow-md hover:bg-stone-50 cursor-pointer transition-colors"
              >
                {WORKFLOW_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shadow-md ${statusPillClass()}`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                {statusPillLabel()}
              </div>
            </div>
          </div>
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
          loadingDetails={loadingPlaceDetails}
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
          onSavePlace={() => showToast("Place saved.")}
          onAddStop={handleAddStopFromPreview}
          onAddToTrip={() => showToast("Choose trip — coming soon.")}
          onCreateMeetPoint={() => showToast("Meet point created.")}
          onMakeDestination={handleMakeDestination}
          onStartLive={handleStartFromPlacePreview}
        />
      ) : null}

      {showRoutePreview && destination ? (
        <SoloRoutePreviewPanel
          destination={destination}
          travelMode={travelMode}
          plannedStops={plannedStops}
          planningMode={isLongDistancePreview}
          onStartSoloLive={handleStartSoloLive}
          onChangeDestination={handleChangeDestination}
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
        />
      ) : null}

      {/* Right Map Controls */}
      <div
        className={`absolute top-1/2 -translate-y-1/2 flex flex-col gap-2 z-10 transition-all ${
          rightPanelOpen ? "right-[448px] max-lg:right-4" : "right-4"
        }`}
      >
        <button
          type="button"
          className="w-10 h-10 flex items-center justify-center bg-white hover:bg-stone-100 rounded-full shadow-lg"
          onClick={() => mapRef.current?.zoomIn()}
        >
          <span className="text-2xl font-light text-stone-600">+</span>
        </button>
        <button
          type="button"
          className="w-10 h-10 flex items-center justify-center bg-white hover:bg-stone-100 rounded-full shadow-lg"
          onClick={() => mapRef.current?.zoomOut()}
        >
          <span className="text-2xl font-light text-stone-600">-</span>
        </button>
        <button
          type="button"
          className={`w-10 h-10 flex items-center justify-center rounded-full shadow-lg ${
            liveGpsActive
              ? "bg-blue-600 hover:bg-blue-700"
              : "bg-white hover:bg-stone-100"
          }`}
          onClick={locateUser}
          title="Live GPS"
          aria-pressed={liveGpsActive}
        >
          <MapPin
            className={`w-5 h-5 ${liveGpsActive ? "text-white" : "text-stone-500"}`}
          />
        </button>
        <button
          type="button"
          className="w-10 h-10 flex items-center justify-center bg-white hover:bg-stone-100 rounded-full shadow-lg"
          onClick={() => setSoundEnabled((prev) => !prev)}
          title="Sound"
        >
          {soundEnabled ? (
            <Volume2 className="w-5 h-5 text-stone-500" />
          ) : (
            <VolumeX className="w-5 h-5 text-stone-300" />
          )}
        </button>
        <button
          type="button"
          className="w-10 h-10 flex items-center justify-center bg-white hover:bg-stone-100 rounded-full shadow-lg"
          onClick={() => setAlertsEnabled((prev) => !prev)}
          title="Alerts"
        >
          <Bell
            className={`w-5 h-5 ${alertsEnabled ? "text-amber-500" : "text-stone-300"}`}
          />
        </button>
        <button
          type="button"
          className="w-10 h-10 flex items-center justify-center bg-white hover:bg-stone-100 rounded-full shadow-lg"
          onClick={() => {
            const layers = ["street", "satellite", "dark"] as const;
            setActiveLayer((current) => {
              const i = layers.indexOf(current);
              return layers[(i + 1) % layers.length];
            });
          }}
          title={`Layer: ${activeLayer}`}
        >
          <Layers className="w-5 h-5 text-stone-500" />
        </button>
        <button
          type="button"
          className="w-10 h-10 flex items-center justify-center bg-white hover:bg-stone-100 rounded-full shadow-lg"
          onClick={() => {
            if (!document.fullscreenElement) {
              document.documentElement.requestFullscreen();
            } else {
              document.exitFullscreen();
            }
          }}
          title="Toggle Fullscreen"
        >
          <Maximize2 className="w-5 h-5 text-stone-500" />
        </button>
      </div>
    </div>
  );
}
