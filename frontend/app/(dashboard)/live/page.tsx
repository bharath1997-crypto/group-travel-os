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
  normalizePlaceCategory,
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
import { buildPlaceKey, extractCityCountry } from "./live-place-key";
import {
  resolvePlaceMedia,
  type PlaceMediaItem,
  type PlaceMediaResolution,
} from "./live-place-media";
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
  const [mapClickError, setMapClickError] = useState<string | null>(null);
  const [nearbyPlacesAtClick, setNearbyPlacesAtClick] = useState<PlacePreviewData[] | null>(null);

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
    if (clickedLocation) return clickedLocation;
    if (userLocation) return userLocation;
    const mapCenter = mapRef.current?.getMapCenter();
    if (mapCenter) return mapCenter;
    return searchBias;
  }, [clickedLocation, userLocation, searchBias]);

  const resolveAnchorCoordinate = useCallback((): { lat: number; lng: number } | null => {
    if (clickedLocation) return clickedLocation;
    if (userLocation) return userLocation;
    const mapCenter = mapRef.current?.getMapCenter();
    if (mapCenter) return mapCenter;
    if (destination && isLiveActive && liveStage === "solo_drive_navigation") {
      return { lat: destination.lat, lng: destination.lng };
    }
    return null;
  }, [clickedLocation, userLocation, destination, isLiveActive, liveStage]);

  const handleNearbySearch = useCallback(async (query: string) => {
    setSelectedPlace(null);
    setDestination(null);
    setLiveStage("static_landing");
    setToast(null);
    setGpsError(null);
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

    const center = resolveAnchorCoordinate();
    if (!center) {
      setNearbyError("Location unavailable. Turn on GPS or move the map first.");
      setNearbyLoading(false);
      return;
    }

    try {
      const results = await searchNearbyPlaces(query, center);
      setNearbyResults(results);
    } catch (err) {
      setNearbyError("Nearby search is unavailable right now.");
    } finally {
      setNearbyLoading(false);
    }
  }, [resolveAnchorCoordinate]);

  const handleCloseNearbyResults = useCallback(() => {
    setNearbyResults(null);
    setNearbyCategory(null);
    setNearbyError(null);
    setExpandedResultIndex(null);
    setViewingDetailsFromNearby(false);
  }, []);

  const handleResultClick = useCallback((result: PlacePreviewData) => {
    setSelectedPlace(result);
    setViewingDetailsFromNearby(true);
    setLiveStage("place_preview");
  }, []);

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
  }, []);

  const handleSavePlaceFromNearby = useCallback(() => {
    showToast("Place saved.");
    setExpandedResultIndex(null);
  }, []);

  const handleSelectNearbyPlaceAtClick = useCallback((poi: PlacePreviewData) => {
    setSelectedPlace(poi);
    setNearbyPlacesAtClick(null);
  }, []);

  const handleMapClick = useCallback(async (lat: number, lng: number, features: any[]) => {
    setSelectedPlace(null);
    setDestination(null);
    setLiveStage("static_landing");
    setViewingDetailsFromNearby(false);
    setShowSearchPopup(false);
    setShowSuggestionsCard(false);
    setNearbyResults(null);
    setNearbyCategory(null);
    setNearbyError(null);
    setExpandedResultIndex(null);
    resetRoviExplanation();

    setClickedLocation({ lat, lng });
    setMapClickResolving(true);
    setMapClickError(null);
    setNearbyPlacesAtClick(null);

    // 1. Score features and find the best one
    const scored = features
      .map((f) => ({ feature: f, score: scoreFeature(f) }))
      .sort((a, b) => b.score - a.score);

    const bestFeatureObj = scored[0];
    
    if (bestFeatureObj && bestFeatureObj.score >= 90) {
      // Step 3: POI found directly from vector tiles
      const f = bestFeatureObj.feature;
      const p = f.properties || {};
      const fLat = f.geometry && f.geometry.type === "Point" ? f.geometry.coordinates[1] : lat;
      const fLng = f.geometry && f.geometry.type === "Point" ? f.geometry.coordinates[0] : lng;
      const dist = userLocation ? haversineM(userLocation.lat, userLocation.lng, fLat, fLng) : null;

      const addrDict = {
        house_number: p["addr:housenumber"] || p.house_number || "",
        road: p["addr:street"] || p.street || p.road || "",
        city: p["addr:city"] || p.city || p.town || p.village || "",
        state: p["addr:state"] || p.state || "",
        postcode: p["addr:postcode"] || p.postcode || "",
      };
      const formattedAddr = formatStreetAddress(addrDict) || p.address || p["addr:full"] || `Coordinates: ${fLat.toFixed(4)}, ${fLng.toFixed(4)}`;

      const newPlace: PlacePreviewData = {
        name: p.name || p.display_name || p.title || "Selected Location",
        categoryLabel: normalizePlaceCategory(p) || (p.name || p.display_name || p.title ? "Place" : "Address"),
        address: formattedAddr,
        phone: p.phone || p["contact:phone"] || null,
        lat: fLat,
        lng: fLng,
        distanceM: dist,
        openingHours: p.opening_hours || null,
        openStatus: p.opening_hours ? parseOpenStatus(p.opening_hours) : null,
        placeKey: p.placeKey || `map-feature:${p.osm_id || p.id || `${fLat.toFixed(5)},${fLng.toFixed(5)}`}`,
        osmType: p.osm_type || null,
        osmId: p.osm_id ? parseInt(p.osm_id, 10) : null,
        source: "map_feature",
        tags: p
      };

      setSelectedPlace(newPlace);
      setLiveStage("place_preview");
      setMapClickResolving(false);
      return;
    }

    // Step 5: Fallback to API queries (reverse lookup and nearby POIs)
    try {
      const [reverseResult, nearbyPois] = await Promise.all([
        liveGeocodingReverse(lat, lng).catch((err) => {
          console.error("Reverse geocoding lookup failed", err);
          return null;
        }),
        apiFetch<{ results: BackendNearbyPlace[] }>(
          `/places/nearby?category=all&lat=${lat}&lng=${lng}&radius_meters=75&limit=5`
        ).then(res => {
          if (!res || !res.results) return [];
          return res.results.map((item) => ({
            name: item.name,
            categoryLabel: item.category || normalizePlaceCategory((item as any).tags) || "Place",
            address: item.address,
            phone: null,
            lat: item.lat,
            lng: item.lng,
            distanceM: userLocation ? haversineM(userLocation.lat, userLocation.lng, item.lat, item.lng) : item.distanceMiles * 1609.34,
            openingHours: null,
            openStatus: null,
            placeKey: item.placeKey || item.id,
            osmType: item.osmType || null,
            osmId: item.osmId ? parseInt(item.osmId, 10) : null,
            source: "osm" as const,
            tags: (item as any).tags
          }));
        }).catch((err) => {
          console.error("Nearby search failed at click point", err);
          return [];
        })
      ]);

      const dist = userLocation ? haversineM(userLocation.lat, userLocation.lng, lat, lng) : null;

      const poisWithClickDistance = nearbyPois.map((poi) => {
        const clickDist = haversineM(lat, lng, poi.lat, poi.lng);
        return { ...poi, clickDistanceM: clickDist };
      });
      poisWithClickDistance.sort((a, b) => a.clickDistanceM - b.clickDistanceM);

      // Rule: 0–25 meters: can auto-select clearly named POI
      const veryClosePoi = poisWithClickDistance.find(
        (poi) => poi.clickDistanceM <= 25 && poi.name && poi.name !== "Unnamed Place"
      );

      if (veryClosePoi) {
        const { clickDistanceM, ...poiClean } = veryClosePoi;
        setSelectedPlace(poiClean);
        setLiveStage("place_preview");
        setMapClickResolving(false);
        return;
      }

      // Rule: 25–75 meters: show “Nearby places here” list
      const nearbyIn75m = poisWithClickDistance
        .filter((poi) => poi.clickDistanceM > 25 && poi.clickDistanceM <= 75)
        .map(({ clickDistanceM, ...poiClean }) => poiClean);

      if (nearbyIn75m.length > 0) {
        setNearbyPlacesAtClick(nearbyIn75m);
      }

      // If no POI was auto-selected (within 25m):
      if (bestFeatureObj && bestFeatureObj.score >= 50) {
        // Step 4: Use building/address feature found in queryRenderedFeatures
        const f = bestFeatureObj.feature;
        const p = f.properties || {};
        const fLat = f.geometry && f.geometry.type === "Point" ? f.geometry.coordinates[1] : lat;
        const fLng = f.geometry && f.geometry.type === "Point" ? f.geometry.coordinates[0] : lng;
        const fDist = userLocation ? haversineM(userLocation.lat, userLocation.lng, fLat, fLng) : null;

        const addrDict = {
          house_number: p["addr:housenumber"] || p.house_number || "",
          road: p["addr:street"] || p.street || p.road || "",
          city: p["addr:city"] || p.city || p.town || p.village || "",
          state: p["addr:state"] || p.state || "",
          postcode: p["addr:postcode"] || p.postcode || "",
        };
        const formattedAddr = formatStreetAddress(addrDict) || p.address || p["addr:full"] || `Coordinates: ${fLat.toFixed(4)}, ${fLng.toFixed(4)}`;

        const buildingPlace: PlacePreviewData = {
          name: p.name || p.display_name || p.title || "Address/Building",
          categoryLabel: normalizePlaceCategory(p) || "Address",
          address: formattedAddr,
          phone: p.phone || p["contact:phone"] || null,
          lat: fLat,
          lng: fLng,
          distanceM: fDist,
          openingHours: p.opening_hours || null,
          openStatus: p.opening_hours ? parseOpenStatus(p.opening_hours) : null,
          placeKey: p.placeKey || `map-feature:${p.osm_id || p.id || `${fLat.toFixed(5)},${fLng.toFixed(5)}`}`,
          osmType: p.osm_type || null,
          osmId: p.osm_id ? parseInt(p.osm_id, 10) : null,
          source: "map_feature",
          tags: p
        };
        setSelectedPlace(buildingPlace);
        setLiveStage("place_preview");
      } else if (reverseResult && (reverseResult.name || reverseResult.address)) {
        // Step 5: Fall back to reverse geocode
        const addressPlace: PlacePreviewData = {
          name: reverseResult.name || "Location Address",
          categoryLabel:
            normalizePlaceCategory(reverseResult) ||
            (reverseResult.extratags ? normalizePlaceCategory(reverseResult.extratags) : null) ||
            (reverseResult.name ? "Place" : "Address"),
          address: typeof reverseResult.address === "string" ? reverseResult.address : (reverseResult.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`),
          phone: null,
          lat: lat,
          lng: lng,
          distanceM: dist,
          openingHours: null,
          openStatus: null,
          placeKey: reverseResult.placeKey || `address:${lat.toFixed(5)},${lng.toFixed(5)}`,
          source: "nominatim",
          city: reverseResult.city || null,
          country: reverseResult.country || null,
          tags: reverseResult.extratags
        };
        setSelectedPlace(addressPlace);
        setLiveStage("place_preview");
      } else {
        // Step 6: Fall back to Dropped Pin
        const roundedLat = lat.toFixed(4);
        const roundedLng = lng.toFixed(4);
        const droppedPinPlace: PlacePreviewData = {
          name: "Dropped pin",
          categoryLabel: "Selected location",
          address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
          phone: null,
          lat,
          lng,
          distanceM: dist,
          openingHours: null,
          openStatus: null,
          placeKey: `dropped-pin:${roundedLat}:${roundedLng}`,
          source: "dropped_pin"
        };
        setSelectedPlace(droppedPinPlace);
        setLiveStage("place_preview");
      }
    } catch (err) {
      console.error("Map click resolution error", err);
      setMapClickError("Could not resolve location info.");
    } finally {
      setMapClickResolving(false);
    }
  }, [userLocation]);

  const selectPlace = useCallback(async (result: LiveGeocodingSearchResult) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    const bias = resolveSearchBias();
    const userLoc = userLocation ?? mapRef.current?.getUserLocation() ?? bias;
    const distanceM = userLoc ? haversineM(userLoc.lat, userLoc.lng, lat, lng) : null;
    const { city, country } = extractCityCountry(result.address);
    const placeKey = buildPlaceKey({
      name: result.name || result.display_name.split(",")[0],
      lat,
      lng,
      city,
      country,
      osmType: result.osm_type,
      osmId: result.osm_id,
    });

    const initial: PlacePreviewData = {
      name: result.name || result.display_name.split(",")[0],
      categoryLabel: normalizePlaceCategory(result) || (result.name ? "Place" : "Address"),
      address: result.display_name,
      phone: null,
      lat,
      lng,
      distanceM,
      openingHours: null,
      openStatus: null,
      placeKey,
      osmType: result.osm_type ?? null,
      osmId: result.osm_id ?? null,
      city: city ?? null,
      country: country ?? null,
    };

    setSelectedPlace(initial);
    setDestination(null);
    setIsLiveActive(false);
    setLiveStage("place_preview");
    setRoviExplanation(null);
    setRoviExplanationError(null);
    setRoviExplanationLoading(false);
    setPlaceMedia([]);
    setPlaceTags([]);
    setPlaceMediaLoading(true);
    setSearchQuery(result.name || result.display_name.split(",")[0]);
    setSearchResults([]);
    setShowSearchPopup(false);
    setShowSuggestionsCard(false);
    setLoadingPlaceDetails(true);

    void resolvePlaceMedia(initial).then((resolution: PlaceMediaResolution) => {
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
  }, [resolveSearchBias, userLocation]);

  const searchPlaceByName = useCallback(
    async (name: string) => {
      const q = name.trim().toLowerCase();
      const keywords = [
        "gas", "gas station", "coffee", "cafe", "restaurant",
        "food", "restroom", "toilet", "hospital", "atm", "parking", "park"
      ];
      if (keywords.includes(q)) {
        void handleNearbySearch(name);
        return;
      }

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
    [resolveSearchBias, selectPlace, handleNearbySearch],
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
    if (selectedPlace) {
      window.dispatchEvent(new CustomEvent("minimize-rovvy-lounge"));
    }
  }, [selectedPlace]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const q = searchQuery.trim().toLowerCase();
    const keywords = [
      "gas", "gas station", "coffee", "cafe", "restaurant",
      "food", "restroom", "toilet", "hospital", "atm", "parking", "park"
    ];
    if (keywords.includes(q)) {
      setSearchResults([]);
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = setTimeout(() => {
        void handleNearbySearch(searchQuery);
      }, 500);
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
  }, [searchQuery, resolveSearchBias, handleNearbySearch, showSearchPopup, showSuggestionsCard]);

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
    setSelectedPlace(null);
    setClickedLocation(null);
    setNearbyPlacesAtClick(null);
    setPlaceMedia([]);
    setPlaceTags([]);
    setPlaceMediaLoading(false);
    resetRoviExplanation();
    setViewingDetailsFromNearby(false);

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
        nearbyResults={nearbyResults}
        onNearbyMarkerClick={handleResultClick}
        onMapClick={handleMapClick}
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

          {/* Nearby Suggestions Results Panel */}
          {nearbyCategory && !selectedPlace && (
            <div className="w-80 sm:w-96 rounded-2xl bg-white/75 backdrop-blur-xl border border-white/30 p-4 shadow-xl text-stone-800 flex flex-col max-h-[calc(100vh-140px)] animate-in fade-in slide-in-from-top-2 duration-200">
              {/* Header */}
              <div className="flex items-center justify-between mb-3 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-lg">📍</span>
                  <div>
                    <h3 className="font-bold text-stone-800 text-sm">
                      {getNearbyCategoryTitle(nearbyCategory)}
                    </h3>
                    <p className="text-[10px] text-stone-500 font-medium">Sorted by distance</p>
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
          rightPanelOpen
            ? "xl:right-[434px] lg:right-[404px] md:landscape:right-[364px] right-4"
            : "right-4"
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
