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
import { apiFetch } from "@/lib/api";
import PlacePreviewCard, { type PlacePreviewData } from "./PlacePreviewCard";
import SoloRoutePreviewPanel from "./SoloRoutePreviewPanel";
import SoloLiveActivePanel from "./SoloLiveActivePanel";
import SoloLiveNavigationOverlay from "./SoloLiveNavigationOverlay";
import type { LiveStage, RouteLine, TripStatus, UserLocationUpdate } from "./live-types";
import { isFarFromUser } from "./live-types";
import type { LiveMapRef } from "./LiveMapComponent";

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

const GEO_CACHE_TTL_MS = 8 * 60 * 1000;
const GEO_CACHE_MAX = 200;

type CacheEntry<T> = { at: number; data: T };

const searchResultCache = new Map<string, CacheEntry<NominatimSearchResult[]>>();
const reverseResultCache = new Map<string, CacheEntry<NominatimReverseResult | null>>();

function readCache<T>(cache: Map<string, CacheEntry<T>>, key: string): T | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > GEO_CACHE_TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  return hit.data;
}

function writeCache<T>(cache: Map<string, CacheEntry<T>>, key: string, data: T) {
  cache.set(key, { at: Date.now(), data });
  if (cache.size <= GEO_CACHE_MAX) return;
  const oldestKey = [...cache.entries()].sort((a, b) => a[1].at - b[1].at)[0]?.[0];
  if (oldestKey) cache.delete(oldestKey);
}

type NominatimSearchResult = {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  type?: string;
  class?: string;
  name?: string;
};

type NominatimReverseResult = {
  display_name: string;
  name?: string;
  type?: string;
  class?: string;
  address?: Record<string, string>;
  extratags?: Record<string, string>;
};

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

async function geocodingSearch(query: string): Promise<NominatimSearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const cacheKey = q.toLowerCase();
  const cached = readCache(searchResultCache, cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5`,
      {
        headers: {
          "Accept": "application/json",
          "User-Agent": "Travello/1.0",
        },
      }
    );
    if (!res.ok) throw new Error("direct Nominatim failed");
    const data = (await res.json()) as NominatimSearchResult[];
    writeCache(searchResultCache, cacheKey, data);
    return data;
  } catch (err) {
    try {
      const rows = await apiFetch<NominatimSearchResult[]>(
        `/geocoding/search?q=${encodeURIComponent(q)}`,
      );
      const data = Array.isArray(rows) ? rows : [];
      writeCache(searchResultCache, cacheKey, data);
      return data;
    } catch {
      return [];
    }
  }
}

async function geocodingReverse(
  lat: number,
  lng: number,
): Promise<NominatimReverseResult | null> {
  const cacheKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;
  const cached = readCache(reverseResultCache, cacheKey);
  if (cached !== undefined) return cached;

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      {
        headers: {
          "Accept": "application/json",
          "User-Agent": "Travello/1.0",
        },
      }
    );
    if (!res.ok) throw new Error("direct Nominatim failed");
    const data = (await res.json()) as NominatimReverseResult;
    writeCache(reverseResultCache, cacheKey, data);
    return data;
  } catch {
    try {
      const data = await apiFetch<NominatimReverseResult>(
        `/geocoding/reverse?lat=${lat}&lng=${lng}`,
      );
      const result = data && Object.keys(data).length > 0 ? data : null;
      writeCache(reverseResultCache, cacheKey, result);
      return result;
    } catch {
      return null;
    }
  }
}

export default function LivePage() {
  const mapRef = useRef<LiveMapRef | null>(null);
  const router = useRouter();
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
  const [searchResults, setSearchResults] = useState<NominatimSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [liveGpsActive, setLiveGpsActive] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

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

  const selectPlace = useCallback(async (result: NominatimSearchResult) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    const userLoc = mapRef.current?.getUserLocation();
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
    setSearchQuery(result.display_name);
    setSearchResults([]);
    setShowSearchPopup(false);
    setLoadingPlaceDetails(true);

    try {
      const details = await geocodingReverse(lat, lng);
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
  }, []);

  const searchPlaceByName = useCallback(
    async (name: string) => {
      setSearchQuery(name);
      setShowSearchPopup(false);
      setSearchLoading(true);
      try {
        const results = await geocodingSearch(name);
        if (results.length > 0) {
          await selectPlace(results[0]);
        }
      } finally {
        setSearchLoading(false);
      }
    },
    [selectPlace],
  );

  useEffect(() => {
    if (!showSearchPopup) return;
    const handleDocumentClick = (e: MouseEvent) => {
      const container = document.getElementById("search-container");
      if (container && !container.contains(e.target as Node)) {
        setShowSearchPopup(false);
      }
    };
    document.addEventListener("click", handleDocumentClick);
    return () => {
      document.removeEventListener("click", handleDocumentClick);
    };
  }, [showSearchPopup]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const results = await geocodingSearch(searchQuery);
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
  }, [searchQuery]);

  useEffect(() => {
    return () => {
      if (searchBlurRef.current) clearTimeout(searchBlurRef.current);
    };
  }, []);

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
  }

  function handleStartFromPlacePreview() {
    handleMakeDestination();
  }

  function handleStartSoloLive() {
    if (!requireSolo() || !destination) return;
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
  const showPlacePreview = liveStage === "place_preview" && selectedPlace && !isLiveActive;
  const showRoutePreview = liveStage === "destination_set" && destination && !isLiveActive;
  const showSoloLivePanel =
    isLiveActive && liveStage === "solo_drive_command" && destination;
  const showNavigationOverlay =
    isLiveActive && isNavigating && destination;

  const mapPin = destination ?? selectedPlace;
  const routeLine: RouteLine | null = useMemo(() => {
    if (!destination || !userLocation) return null;
    if (liveStage !== "destination_set" && !isLiveActive) return null;
    return {
      from: userLocation,
      to: { lat: destination.lat, lng: destination.lng },
      active: isLiveActive,
    };
  }, [destination, userLocation, liveStage, isLiveActive]);

  const rightPanelOpen = Boolean(showPlacePreview || showRoutePreview || showSoloLivePanel);

  function statusPillLabel(): string {
    if (isLiveActive && liveStage === "solo_drive_navigation") return "Solo Live · Navigating";
    if (isLiveActive) return "Solo Live On";
    if (liveStage === "destination_set") return "Destination set";
    if (liveStage === "place_preview") return "Place selected";
    return "Live not started";
  }

  function statusPillClass(): string {
    if (isLiveActive) return "text-emerald-800 bg-emerald-100";
    if (liveStage === "destination_set") return "text-sky-800 bg-sky-100";
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

      {/* Left Controls — hidden during active navigation */}
      {!isNavigating ? (
      <div className="absolute top-4 left-4 p-3 z-10 bg-white rounded-xl shadow-lg">
        <div
          className={`flex items-center gap-1.5 px-2 py-1 mb-3 rounded-full text-xs font-semibold w-max ${statusPillClass()}`}
        >
          {statusPillLabel()}
        </div>

        {/* Search */}
        <div id="search-container" className="relative mb-3">
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-full bg-stone-100 w-72 lg:w-80 cursor-pointer"
            onClick={() => setShowSearchPopup((prev) => !prev)}
          >
            <Search className="w-4 h-4 shrink-0 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClick={(e) => {
                e.stopPropagation();
                setShowSearchPopup(true);
              }}
              placeholder="Search places, stops, meet points"
              className="w-full bg-transparent focus:outline-none text-sm text-stone-600 placeholder:text-stone-400"
            />
            {searchLoading ? (
              <span className="text-[10px] text-stone-400 shrink-0">…</span>
            ) : null}
          </div>

          {searchQuery.trim().length >= 2 && searchResults.length > 0 ? (
            <ul className="absolute left-0 right-0 top-full z-30 mt-1 max-h-52 overflow-auto rounded-xl border border-stone-200 bg-white shadow-lg">
              {searchResults.map((result) => (
                <li key={result.place_id}>
                  <button
                    type="button"
                    className="flex w-full gap-2 px-3 py-2.5 text-left text-sm text-stone-700 hover:bg-stone-50"
                    onClick={() => {
                      void selectPlace(result);
                    }}
                  >
                    <span className="shrink-0">📍</span>
                    <span className="line-clamp-2">{result.display_name}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : showSearchPopup ? (
            <div className="absolute left-full top-0 ml-4 z-30 w-72 lg:w-80 rounded-xl bg-white shadow-lg border border-stone-100 p-4">
              {/* Recent Searches */}
              <div>
                <h4 className="mb-2 text-[13px] font-bold text-stone-500 uppercase tracking-wider">
                  Recent Searches
                </h4>
                <ul className="flex flex-col gap-1 text-sm text-stone-700">
                  {recentSearches.map((search) => (
                    <li key={search}>
                      <button
                        type="button"
                        className="flex justify-between items-center w-full px-2 py-2 hover:bg-stone-50 rounded-lg text-left"
                        onClick={() => {
                          void searchPlaceByName(search);
                        }}
                      >
                        <span className="truncate">{search}</span>
                        <ChevronRight className="w-4 h-4 text-stone-400 shrink-0" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Divider */}
              <div className="my-3 border-t border-stone-100" />

              {/* Saved Places */}
              <div>
                <h4 className="mb-2 text-[13px] font-bold text-stone-500 uppercase tracking-wider">
                  Saved Places
                </h4>
                <ul className="flex flex-col gap-1 text-sm text-stone-700">
                  {savedPlaces.map((place) => (
                    <li key={place.name}>
                      <button
                        type="button"
                        className="flex justify-between items-center w-full px-2 py-2 hover:bg-stone-50 rounded-lg text-left"
                        onClick={() => {
                          void searchPlaceByName(`${place.name} ${place.address}`);
                        }}
                      >
                        <span className="flex items-center gap-2 truncate">
                          <Star className="w-4 h-4 text-amber-400 shrink-0 fill-amber-400" />
                          <span className="font-medium text-stone-800">{place.name}</span>
                        </span>
                        <ChevronRight className="w-4 h-4 text-stone-400 shrink-0" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Divider */}
              <div className="my-3 border-t border-stone-100" />

              {/* Open Group Trip Button */}
              <div>
                <button
                  type="button"
                  className="w-full rounded-xl bg-[#0F766E] hover:bg-[#0D635C] py-2.5 text-center text-sm font-semibold text-white transition-colors"
                  onClick={() => router.push("/trips")}
                >
                  Open Group Trip
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {/* Travel Mode + Workflow */}
        <div className="flex gap-3">
          <select
            value={travelMode}
            onChange={(e) => setTravelMode(e.target.value as (typeof TRAVEL_MODES)[number])}
            className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 outline-none bg-white"
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
            className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 outline-none bg-white"
          >
            {WORKFLOW_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
      </div>
      ) : null}

      {/* Place Preview Panel */}
      {showPlacePreview && selectedPlace ? (
        <PlacePreviewCard
          place={selectedPlace}
          loadingDetails={loadingPlaceDetails}
          workflowType={workflowType}
          farLocationWarning={isFarFromUser(selectedPlace.distanceM)}
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
          onStartSoloLive={handleStartSoloLive}
          onChangeDestination={handleChangeDestination}
          onClose={handleChangeDestination}
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
          rightPanelOpen ? "right-[360px] max-lg:right-4" : "right-4"
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
