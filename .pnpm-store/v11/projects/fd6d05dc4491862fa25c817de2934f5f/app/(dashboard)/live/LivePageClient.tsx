"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import {
  ChevronRight,
  MapPin,
  Search,
  Star,
} from "lucide-react";
import { useDashboardUser } from "@/contexts/dashboard-user-context";
import TravelModeChip from "./TravelModeChip";
import LiveLeftDock from "./LiveLeftDock";
import LiveDockRail from "./LiveDockRail";
import type { LiveDockStage } from "./live-dock-stages";
import LiveSetupPanel, { type LiveWorkflowType } from "./LiveSetupPanel";
import LiveNearbyList from "./LiveNearbyList";
import {
  buildDefaultConvergeMembers,
  DEFAULT_GROUP_WAYRA_NOTICE,
} from "./live-group-converge-mock";
import { buildGroupConvergeRoutes } from "./live-group-routes-sync";
import type { GroupMemberSummary } from "./live-group-location-types";
import { buildConvergeStatusNotice } from "./live-group-converge";
import { fetchGroupMembers, startGroupConvergeSession } from "./live-group-network";
import { useLiveGroupConverge } from "./use-live-group-converge";
import { useLiveGroupArrival } from "./use-live-group-arrival";
import {
  applyAddPickupToSeatShare,
  applyJoinSeatShareVehicle,
  ownVehicleId,
} from "./live-convoy-actions";
import {
  buildDefaultSeatShare,
  buildSeatShareOpenedNotice,
  seatShareOpenSeats,
  type SeatShareState,
} from "./live-seat-share-mock";
import { useLiveSeatShare } from "./use-live-seat-share";
import {
  buildMockConvoyMapPins,
  convoyOffersToMapPins,
} from "./live-convoy-map-pins";
import {
  buildNightFinishedSummary,
  buildSettleOpenedNotice,
  splitActivitiesHref,
  type TripExpenseTotal,
} from "./live-night-finished";
import { fetchTripExpenseTotal } from "./live-trip-expenses-network";
import {
  addGroupVoteOption,
  applyGroupVote,
  buildDefaultGroupVote,
  buildVoteMapPins,
  buildVoteOpenedNotice,
  type GroupVoteState,
} from "./live-group-vote-mock";
import {
  buildCreateVoteOptions,
  liveVotePanelToGroupVote,
  liveVoteStatusLabel,
} from "./live-group-vote";
import { createLiveVotePoll } from "./live-group-vote-network";
import { useLiveGroupVote } from "./use-live-group-vote";
import { etaMinutesFromDuration } from "./live-types";
import { LiveDockEmptyStates } from "./LiveEmptyStateCard";
import LiveMiniHud from "./LiveMiniHud";
import InlineSignInModal from "./InlineSignInModal";
import {
  fetchNearbyLivePlaceReports,
} from "./live-place-reports";
import {
  livePlaceReportLabel,
  type LivePlaceReportSummary,
  type LivePlaceReportType,
} from "./live-place-report-types";
import { haversineM } from "@/lib/geo";
import { emitClearWayraContext, emitOpenWayra, WAYRA_CONTEXT_EVENT } from "@/lib/open-wayra";
import { emitWayraPlacePicked, WAYRA_MAP_FOCUS_EVENT, type WayraMapFocusDetail } from "@/lib/wayra/live-map-context";
import type { PlacePreviewData } from "./live-place-preview-data";
import LivePlacePanelHost from "./LivePlacePanelHost";
import {
  buildPlacePanelDistance,
  placePreviewToPlacePanelPreview,
  placePreviewToPlaceSeed,
} from "./live-place-spine-seed";
import { pickTopPlaceFeature } from "./live-map-poi-pick";
import LiveRouteSummaryBar from "./LiveRouteSummaryBar";
import LiveRouteOriginSetup from "./LiveRouteOriginSetup";
import LiveMapLocationSheet, {
  type MapLocationSheetPoint,
} from "./LiveMapLocationSheet";
import SoloLiveActivePanel from "./SoloLiveActivePanel";
import type {
  LiveStage,
  RouteAlternative,
  RouteLine,
  RouteOrigin,
  RoutePreviewStatus,
  SplitPhaseActivity,
  SplitPhaseEntry,
  TripStatus,
  UserLocationUpdate,
  VehiclePreference,
} from "./live-types";
import {
  isActiveNavigationStage,
  isFarFromUser,
  VEHICLE_PREFERENCE_OPTIONS,
} from "./live-types";
import { buildRoutePreviewAiSuggestions } from "./live-ai-suggestions";
import { type FriendLocation } from "./live-friend-layer-sync";
import { fetchLiveRoute, routeLineFromAlternative } from "./live-routing";
import {
  addLivePreviewLocation,
  startLivePreviewDirection,
} from "./live-preview-actions";
import {
  isLandConnectedDriveRoute,
  soloLiveBlockReason,
  shouldDrawDriveRouteOnMap,
} from "./live-route-validation";
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
  type LiveGeocodingReverseResult,
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
import { isGenericPlaceName, resolvePlaceDisplayName } from "@/lib/wayra/place-region";
import { enrichPlaceDisplayName, isMostlyLatinPlaceName } from "./live-place-name-i18n";
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
  fetchLiveDiscoveryLayer,
  type LiveDiscoveryLayerPoint,
} from "./live-map-discovery-layer-network";
import { bboxContains, type MapBbox } from "./live-map-discovery-layer-bbox";
import {
  LIVE_DISCOVERY_MIN_ZOOM,
  readDiscoveryLayerSessionEnabled,
  writeDiscoveryLayerSessionEnabled,
} from "./live-map-discovery-layer-session";
import LiveDiscoveryCategoryPanel from "./LiveDiscoveryCategoryPanel";
import {
  buildDiscoveryCatsParam,
  DISCOVERY_LAYER_DEFAULT_KEYS,
  DISCOVERY_LAYER_SELECTABLE_KEYS,
  readDiscoveryCategorySelection,
  writeDiscoveryCategorySelection,
  type DiscoveryLayerCategoryKey,
} from "./live-map-discovery-categories";
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
import {
  LiveMapCrossBorderNotice,
  LiveMapNoticeStack,
  LiveMapNoticeStatusPill,
  LiveMapNoticeToast,
} from "./LiveMapNoticeStack";
import {
  LIVE_SEARCH_DROPDOWN,
  LIVE_SEARCH_PILL,
  LIVE_SEARCH_PILL_DARK,
  LIVE_SECTION_LABEL,
  LIVE_HERO_SEARCH_TOP,
  LIVE_HERO_SEARCH_RIGHT,
} from "./live-design-tokens";
import { useWayraPanelOpen } from "@/lib/wayra/use-wayra-panel-open";
import LiveImmersiveChrome from "./LiveImmersiveChrome";
import { setLiveImmersiveChrome, clearLiveImmersiveChrome } from "./live-immersive-chrome";
import { isLiveMapDarkChrome } from "./live-map-chrome";
import LiveMapRightControls from "./LiveMapRightControls";
import LiveMapAttributionStrip from "./LiveMapAttributionStrip";
import type { LiveMapAttributionFocus } from "./live-map-attribution";
import { formatMapCoordinates } from "./live-map-pick-context";
import {
  applyAdminHierarchyToPlace,
  extractPlaceAdminHierarchy,
  inferOsmPlaceTypeLabel,
} from "./live-place-admin-hierarchy";
import { resolveCapitalCategoryLabel } from "./live-capital-level";
import { buildCoarseLandFallbackPlace } from "./live-coarse-land-fallback";
import {
  buildOpenWaterPlace,
  isGenericWaterLabel,
  isNamedOceanBasinLabel,
  isUnroutableOpenWaterPlace,
  isWaterMapFeature,
  isWaterReverseGeocode,
} from "./live-open-water-place";
import type { MapClickPayload } from "./LiveMapComponent";
import {
  coerceSelectableLiveMapLayer,
  DEFAULT_LIVE_MAP_LAYER,
  isLiveMapDarkLayerEnabled,
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
import {
  loadLiveSavedPlacesLayerPreference,
  saveLiveSavedPlacesLayerPreference,
} from "./live-saved-places-preference";
import {
  loadLiveReportsLayerPreference,
  saveLiveReportsLayerPreference,
} from "./live-place-reports-preference";
import {
  getLiveSavedPlace,
  isLivePlaceSaved,
  saveLivePlaceFromPreview,
  type LiveSavedPlace,
} from "./live-saved-places-store";
import { useLiveSavedPlaces } from "./use-live-saved-places";
import SavedPlacePanel from "./SavedPlacePanel";
import {
  getTapGeocodeCache,
  isUsableTapGeocodeCache,
  setTapGeocodeCache,
} from "./live-tap-geocode-cache";
import { mergeAutocompleteResults } from "./live-search-merge";
import { isLandmarkPlace } from "./live-poi-icons";
import { LivePoiRowIcon } from "./live-poi-row-icon";
import { getLiveMapMaxZoom, type LiveMapLayer } from "@/lib/map-providers";
import { mapLabelFeatureToPlacePreview } from "./live-map-labels";
import RoviRouteIntelligencePanel from "./RoviRouteIntelligencePanel";
import {
  fetchRouteIntelligence,
  placeToLocationSummary,
  userRegionToLocationSummary,
} from "./route-intelligence";
import {
  buildTravelHandoffUrl,
  travelHandoffKindForRouteOption,
  travelHandoffLabel,
} from "./live-travel-handoff";
import type { RouteIntelligenceResponse, RouteOption } from "./route-intelligence-types";

const LiveMapComponent = dynamic(() => import("./LiveMapComponent"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-stone-100 flex items-center justify-center text-stone-400 text-sm font-medium">
      Loading Map...
    </div>
  ),
});

const LiveGroupConvergePanel = dynamic(() => import("./LiveGroupConvergePanel"));
const LiveGroupVotePanel = dynamic(() => import("./LiveGroupVotePanel"));
const LiveSeatSharePanel = dynamic(() => import("./LiveSeatSharePanel"));
const LiveNightFinishedPanel = dynamic(() => import("./LiveNightFinishedPanel"));
const LiveReportModal = dynamic(() => import("./LiveReportModal"));
const FarAwayPlacePanel = dynamic(() => import("./FarAwayPlacePanel"));
const SoloLiveNavigationOverlay = dynamic(() => import("./SoloLiveNavigationOverlay"), {
  ssr: false,
});

const TRAVEL_MODES = ["Drive", "Bike", "Trek", "Walk"] as const;
const WORKFLOW_TYPES = ["Solo", "Group Travel", "Seat Share"] as const;

function shouldOpenRouteIntelligence(
  ctx: LiveLocationContext | null,
  vehiclePreference: VehiclePreference,
): boolean {
  if (!ctx) return false;
  if (!ctx.liveSafe) return true;
  if (vehiclePreference === "public" && ctx.classification === "far_destination") return true;
  return false;
}

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
    coordinatesLabel: formatMapCoordinates(lat, lng),
    source: "dropped_pin",
    tags: {},
  };
}

/** Label for the Live hero search pill — never show generic "Dropped pin" once we know the place. */
function liveSearchBarLabel(
  place: Pick<PlacePreviewData, "name" | "address" | "coordinatesLabel">,
): string | null {
  const name = place.name?.trim();
  if (name && !isGenericPlaceName(name) && !isNamedOceanBasinLabel(name)) return name;
  const address = place.address?.trim();
  if (address && !address.startsWith("Coordinates:")) {
    const firstLine = address.split(",")[0]?.trim();
    if (firstLine && !isNamedOceanBasinLabel(firstLine)) return firstLine;
  }
  if (place.coordinatesLabel?.trim()) return place.coordinatesLabel.trim();
  return null;
}

function isUnresolvedDroppedPin(
  place: Pick<PlacePreviewData, "name" | "source" | "address">,
): boolean {
  if (place.source === "dropped_pin") return true;
  return (
    isGenericPlaceName(place.name) &&
    Boolean(place.address?.trim().startsWith("Coordinates:"))
  );
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

function mergeReverseGeocodeTags(
  place: PlacePreviewData,
  details: LiveGeocodingReverseResult,
): Record<string, string> {
  const tags: Record<string, string> = {};
  if (place.tags) {
    for (const [key, value] of Object.entries(place.tags)) {
      if (value != null) tags[key] = String(value);
    }
  }
  const extra = details.extratags ?? {};
  for (const [key, value] of Object.entries(extra)) {
    if (value != null && value !== "") tags[key] = String(value);
  }
  const osmPlace = String(details.type || extra.place || "").toLowerCase();
  if (osmPlace) tags.place = osmPlace;
  const country = details.address?.country ?? details.country;
  if (country) tags["addr:country"] = country;
  return tags;
}

function resolvePlaceFromReverseGeocode(
  place: PlacePreviewData,
  details: LiveGeocodingReverseResult,
  pinLat: number,
  pinLng: number,
  userLoc: { lat: number; lng: number } | null = null,
): PlacePreviewData {
  if (isWaterReverseGeocode(details)) {
    return buildOpenWaterPlace(pinLat, pinLng, userLoc, place.source);
  }

  const hours = details.extratags?.opening_hours;
  const reverseGeo = extractCityCountry(details.address);
  const nextOsmType = details.osm_type ?? place.osmType;
  const nextOsmId = details.osm_id ?? place.osmId;
  const nextCity = reverseGeo.city ?? place.city;
  const nextCountry = reverseGeo.country ?? place.country;
  const nextKey = buildPlaceKey({
    name: details.name || place.name,
    lat: pinLat,
    lng: pinLng,
    city: nextCity,
    country: nextCountry,
    osmType: nextOsmType,
    osmId: nextOsmId,
  });
  const admin = extractPlaceAdminHierarchy(details.address, details);
  const address = formatStreetAddress(details.address, details.display_name || place.address);
  let displayName = resolvePlaceDisplayName(details.name || place.name, {
    city: admin.localityName ?? nextCity,
    state: admin.stateOrProvince ?? details.address?.state ?? place.state,
    country: admin.country ?? nextCountry,
    address,
  });
  if (isNamedOceanBasinLabel(displayName) || (isGenericWaterLabel(displayName) && admin.country)) {
    displayName =
      admin.localityName ||
      admin.stateOrProvince ||
      admin.country ||
      displayName;
  }
  const mergedTags = mergeReverseGeocodeTags(place, details);
  const capitalLabel = resolveCapitalCategoryLabel(mergedTags);
  const categoryLabel =
    capitalLabel ||
    admin.localityType ||
    inferOsmPlaceTypeLabel(details) ||
    normalizePlaceCategory(details) ||
    (details.extratags ? normalizePlaceCategory(details.extratags) : null) ||
    (details.name || place.name ? "Place" : "Address") ||
    place.categoryLabel;

  return applyAdminHierarchyToPlace(
    {
      ...place,
      name: displayName,
      categoryLabel,
      tags: mergedTags,
      address,
      phone: extractPhone(details.extratags),
      openingHours: hours ?? null,
      openStatus: parseOpenStatus(hours),
      osmType: nextOsmType,
      osmId: nextOsmId,
      city: admin.localityName ?? nextCity,
      state: admin.stateOrProvince ?? place.state,
      country: admin.country ?? nextCountry,
      district: admin.district ?? place.district,
      localityType: admin.localityType ?? place.localityType,
      localityName: admin.localityName ?? place.localityName,
      postcode: admin.postcode ?? place.postcode,
      placeKey: nextKey,
      coordinatesLabel: formatMapCoordinates(pinLat, pinLng),
      source: place.source === "dropped_pin" ? "nominatim" : place.source,
    },
    admin,
  );
}

import { apiFetch } from "@/lib/safe-fetch";
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

type LiveTripContext = {
  id: string;
  group_id: string;
  title: string;
  start_date: string | null;
  end_date: string | null;
};

type TripLocation = {
  id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  place_id: string | null;
  category: string | null;
  notes: string | null;
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

/** Fly the map to a preview target — street zoom locally, regional zoom when far away. */
function focusMapOnPreviewPlace(
  map: LiveMapRef | null,
  place: Pick<PlacePreviewData, "lat" | "lng" | "distanceM">,
) {
  if (!map || !Number.isFinite(place.lat) || !Number.isFinite(place.lng)) return;
  const zoom = isFarFromUser(place.distanceM ?? null) ? 11 : 14;
  map.flyToPlace(place.lat, place.lng, zoom);
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

export default function LivePageClient() {
  const { user } = useDashboardUser();
  const [showSignInModal, setShowSignInModal] = useState(false);

  useEffect(() => {
    void import("./live-map-style-prefetch").then((mod) => mod.prefetchLiveOpenFreeMapStyles());
  }, []);

  useEffect(() => {
    if (isLiveMapDarkLayerEnabled()) return;
    setActiveLayer((current) => {
      const safe = coerceSelectableLiveMapLayer(current);
      if (safe === current) return current;
      saveLiveMapLayerPreference(safe);
      return safe;
    });
  }, []);

  const mapRef = useRef<LiveMapRef | null>(null);
  const initialLocateDoneRef = useRef(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const tripId = searchParams.get("trip_id")?.trim() || null;
  const workflowParam = searchParams.get("workflow");
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
  const [savedPlacesLayerEnabled, setSavedPlacesLayerEnabled] = useState(() =>
    loadLiveSavedPlacesLayerPreference(),
  );
  const [reportsLayerEnabled, setReportsLayerEnabled] = useState(() =>
    loadLiveReportsLayerPreference(),
  );
  const [discoveryLayerEnabled, setDiscoveryLayerEnabled] = useState(() =>
    readDiscoveryLayerSessionEnabled(),
  );
  const [discoveryLayerPoints, setDiscoveryLayerPoints] = useState<LiveDiscoveryLayerPoint[]>([]);
  const [discoveryLayerNotice, setDiscoveryLayerNotice] = useState<string | null>(null);
  const [discoveryCategoryKeys, setDiscoveryCategoryKeys] = useState<DiscoveryLayerCategoryKey[]>(
    () => readDiscoveryCategorySelection(),
  );
  const discoveryLastBboxRef = useRef<MapBbox | null>(null);
  const discoveryFetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const discoveryFetchInFlightRef = useRef(false);
  const [placeReports, setPlaceReports] = useState<LivePlaceReportSummary[]>([]);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const mySavedPlaces = useLiveSavedPlaces();
  const [liveTrip, setLiveTrip] = useState<LiveTripContext | null>(null);
  const [groupMembers, setGroupMembers] = useState<GroupMemberSummary[]>([]);
  const [tripLocations, setTripLocations] = useState<TripLocation[]>([]);
  const [activeSavedPlaceId, setActiveSavedPlaceId] = useState<string | null>(null);

  useEffect(() => {
    if (!tripId) {
      setLiveTrip(null);
      setTripLocations([]);
      return;
    }

    const controller = new AbortController();
    Promise.all([
      apiFetch<LiveTripContext>(`/trips/${tripId}`, { signal: controller.signal }),
      apiFetch<TripLocation[]>(`/trips/${tripId}/locations`, { signal: controller.signal }),
    ])
      .then(([trip, locations]) => {
        setLiveTrip(trip);
        setTripLocations(Array.isArray(locations) ? locations : []);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setLiveTrip(null);
          setTripLocations([]);
        }
      });

    return () => controller.abort();
  }, [tripId]);

  useEffect(() => {
    if (!liveTrip?.group_id) {
      setGroupMembers([]);
      return;
    }

    let cancelled = false;
    void fetchGroupMembers(liveTrip.group_id).then((members) => {
      if (!cancelled) setGroupMembers(members);
    });

    return () => {
      cancelled = true;
    };
  }, [liveTrip?.group_id]);

  const tripSavedPlaces = useMemo<LiveSavedPlace[]>(
    () =>
      tripLocations.map((place) => ({
        id: `trip:${place.id}`,
        name: place.name,
        categoryLabel: place.category || "Trip place",
        address: place.address || "",
        lat: place.latitude,
        lng: place.longitude,
        notes: place.notes || "",
        attachments: [],
        savedAt: "",
        updatedAt: "",
        placeKey: place.place_id || `trip-location:${place.id}`,
      })),
    [tripLocations],
  );
  const visibleSavedPlaces = useMemo(
    () => [...tripSavedPlaces, ...mySavedPlaces],
    [tripSavedPlaces, mySavedPlaces],
  );

  const handleLayerChange = useCallback(
    (layer: LiveMapLayer) => {
      const safe = coerceSelectableLiveMapLayer(layer);
      setActiveLayer(safe);
      setMapMaxZoom(getLiveMapMaxZoom(safe, { travelLayerEnabled }));
      saveLiveMapLayerPreference(safe);
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

  const handleSavedPlacesLayerChange = useCallback((enabled: boolean) => {
    setSavedPlacesLayerEnabled(enabled);
    saveLiveSavedPlacesLayerPreference(enabled);
  }, []);

  const handleReportsLayerChange = useCallback((enabled: boolean) => {
    setReportsLayerEnabled(enabled);
    saveLiveReportsLayerPreference(enabled);
  }, []);

  const handleSavePlaceLocally = useCallback((place: PlacePreviewData) => {
    const saved = saveLivePlaceFromPreview(place);
    setActiveSavedPlaceId(saved.id);
  }, []);

  const [layersPanelOpen, setLayersPanelOpen] = useState(false);
  const [dockStage, setDockStage] = useState<LiveDockStage>("setup");
  const [dockPanelOpen, setDockPanelOpen] = useState(false);
  const [isGroupConverging, setIsGroupConverging] = useState(false);
  const [groupConvergeAlertDismissed, setGroupConvergeAlertDismissed] = useState(false);
  const [isGroupVoteOpen, setIsGroupVoteOpen] = useState(false);
  const [groupVoteAlertDismissed, setGroupVoteAlertDismissed] = useState(false);
  const [pendingVoteOptionAdd, setPendingVoteOptionAdd] = useState(false);
  const [isSeatShareActive, setIsSeatShareActive] = useState(false);
  const [seatShareAlertDismissed, setSeatShareAlertDismissed] = useState(false);
  const [settleAlertDismissed, setSettleAlertDismissed] = useState(false);
  const [mockSeatShare, setMockSeatShare] = useState<SeatShareState>(() =>
    buildDefaultSeatShare("your destination"),
  );
  const [mockJoinedVehicleId, setMockJoinedVehicleId] = useState<string | null>(null);
  const [pickupCaptureActive, setPickupCaptureActive] = useState(false);
  const [isNightFinished, setIsNightFinished] = useState(false);
  const [tripExpenseTotal, setTripExpenseTotal] = useState<TripExpenseTotal | null>(null);
  const [mockGroupVote, setMockGroupVote] = useState<GroupVoteState>(() => buildDefaultGroupVote());
  const [voteBootstrap, setVoteBootstrap] = useState<GroupVoteState | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [liveImmersive, setLiveImmersive] = useState(false);
  const wayraChatOpen = useWayraPanelOpen();
  const [placeCardExpanded, setPlaceCardExpanded] = useState(false);

  useEffect(() => {
    if (!wayraChatOpen) setPlaceCardExpanded(false);
  }, [wayraChatOpen]);

  const toggleLiveImmersive = useCallback(() => {
    setLiveImmersive((prev) => !prev);
  }, []);

  useEffect(() => {
    return () => {
      clearLiveImmersiveChrome();
    };
  }, []);

  useEffect(() => {
    if (!liveImmersive) return;
    setLiveImmersiveChrome({
      active: true,
      darkMap: isLiveMapDarkChrome(activeLayer),
    });
  }, [activeLayer, liveImmersive]);

  const [liveStage, setLiveStage] = useState<LiveStage>("static_landing");
  const [workflowType, setWorkflowType] =
    useState<(typeof WORKFLOW_TYPES)[number]>("Solo");

  useEffect(() => {
    if (workflowParam === "seatShare") {
      setWorkflowType("Seat Share");
    }
  }, [workflowParam]);

  const [travelMode, setTravelMode] =
    useState<(typeof TRAVEL_MODES)[number]>("Drive");
  const [vehiclePreference, setVehiclePreference] = useState<VehiclePreference>("private");
  const [isMapInteracting, setIsMapInteracting] = useState(false);
  const [attributionFocus, setAttributionFocus] = useState<LiveMapAttributionFocus | null>(null);
  const [attributionRefreshedAt, setAttributionRefreshedAt] = useState(() => new Date());

  const [selectedPlace, setSelectedPlace] = useState<PlacePreviewData | null>(null);
  const [destination, setDestination] = useState<PlacePreviewData | null>(null);
  const [activeRoute, setActiveRoute] = useState<RouteLine | null>(null);
  const [routeAlternatives, setRouteAlternatives] = useState<RouteAlternative[]>([]);
  const [selectedRouteAlternativeId, setSelectedRouteAlternativeId] = useState<string | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routePreviewStatus, setRoutePreviewStatus] = useState<RoutePreviewStatus>("idle");
  const [routePreviewError, setRoutePreviewError] = useState<string | null>(null);
  const [routeOrigin, setRouteOrigin] = useState<RouteOrigin | null>(null);
  const [originPickMode, setOriginPickMode] = useState(false);
  const [showOriginSetup, setShowOriginSetup] = useState(false);
  const [showPlaceDetailsPanel, setShowPlaceDetailsPanel] = useState(false);
  useEffect(() => {
    if (showPlaceDetailsPanel && selectedPlace) {
      setLayersPanelOpen(false);
    }
  }, [showPlaceDetailsPanel, selectedPlace]);
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [liveSessionId, setLiveSessionId] = useState<string | null>(null);
  const [splitPhaseActivity, setSplitPhaseActivity] = useState<SplitPhaseActivity | null>(null);
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
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sync = () => setIsOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

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

  const useRealGroupVote =
    workflowType === "Group Travel" &&
    isGroupVoteOpen &&
    Boolean(tripId) &&
    Boolean(user?.id);

  const liveGroupVote = useLiveGroupVote({
    enabled: useRealGroupVote,
    tripId,
  });

  const groupVote =
    useRealGroupVote && (liveGroupVote.vote ?? voteBootstrap)
      ? (liveGroupVote.vote ?? voteBootstrap)!
      : mockGroupVote;

  const useRealGroupConverge =
    workflowType === "Group Travel" &&
    isGroupConverging &&
    Boolean(tripId) &&
    Boolean(user?.id);

  const liveGroupConverge = useLiveGroupConverge({
    enabled: useRealGroupConverge,
    tripId,
    currentUserId: user?.id ? String(user.id) : null,
    currentUserName: user?.full_name ?? "You",
    roster: groupMembers,
    destination: destination
      ? { lat: destination.lat, lng: destination.lng }
      : null,
    travelMode,
    gps: {
      lat: gpsState.lat,
      lng: gpsState.lng,
      speed: gpsState.speed,
      heading: gpsState.heading,
      timestamp: gpsState.timestamp,
      status: gpsState.status,
    },
    yourRouteDurationSeconds: activeRoute?.durationSeconds ?? null,
  });

  const showGroupMockFriends =
    workflowType === "Group Travel" &&
    (isGroupConverging || isGroupVoteOpen || DEV_SHOW_MOCK_FRIENDS) &&
    !(useRealGroupConverge && liveGroupConverge.connected);

  const mockFriendsLocations = useMemo<FriendLocation[]>(() => {
    if (!showGroupMockFriends) return [];

    const baseLat = userLocation?.lat ?? routeOrigin?.latitude ?? 41.922;
    const baseLng = userLocation?.lng ?? routeOrigin?.longitude ?? -87.726;

    return [
      {
        userId: "friend-ana",
        name: "Ana",
        lat: baseLat + 0.006,
        lng: baseLng - 0.005,
        lastSeenAt: new Date().toISOString(),
        status: "active",
        speedMps: 12.5,
        heading: 45,
      },
      {
        userId: "friend-tomas",
        name: "Tomas",
        lat: baseLat - 0.004,
        lng: baseLng + 0.006,
        lastSeenAt: new Date().toISOString(),
        status: "active",
        speedMps: 5.2,
        heading: 180,
      },
      {
        userId: "friend-sam",
        name: "Sam",
        lat: baseLat + 0.003,
        lng: baseLng + 0.012,
        lastSeenAt: new Date().toISOString(),
        status: "active",
        speedMps: 1.4,
        heading: 90,
      },
    ];
  }, [showGroupMockFriends, userLocation, routeOrigin]);

  const mockConvergeMembers = useMemo(() => {
    const yourEta = etaMinutesFromDuration(activeRoute?.durationSeconds) ?? 6;
    return buildDefaultConvergeMembers(yourEta);
  }, [activeRoute?.durationSeconds]);

  const friendsLocations =
    useRealGroupConverge && liveGroupConverge.connected
      ? liveGroupConverge.friends
      : mockFriendsLocations;

  const convergeMembers =
    useRealGroupConverge && liveGroupConverge.connected
      ? liveGroupConverge.members
      : mockConvergeMembers;

  const groupWayraNotice = useRealGroupConverge
    ? liveGroupConverge.wayraNotice
    : DEFAULT_GROUP_WAYRA_NOTICE;

  const convergeStatusNotice = useMemo(() => {
    if (!isGroupConverging) return null;
    if (useRealGroupConverge && liveGroupConverge.connected) {
      return buildConvergeStatusNotice({
        members: convergeMembers,
        wayraAlert: liveGroupConverge.wayraNotice?.headline ?? null,
        mockFallback: "Live ETAs connected for your trip",
      });
    }
    return "Tomas hit traffic on the 90";
  }, [
    convergeMembers,
    isGroupConverging,
    liveGroupConverge.connected,
    liveGroupConverge.wayraNotice?.headline,
    useRealGroupConverge,
  ]);

  const memberLocations =
    useRealGroupConverge && liveGroupConverge.connected
      ? liveGroupConverge.memberLocations
      : [];

  const liveGroupArrival = useLiveGroupArrival({
    enabled: workflowType === "Group Travel" && isGroupConverging && Boolean(destination),
    tripId,
    currentUserId: user?.id ? String(user.id) : null,
    destination: destination
      ? { lat: destination.lat, lng: destination.lng }
      : null,
    memberCount: Math.max(groupMembers.length, groupVote.memberCount, 6),
    memberLocations,
    convergeMembers,
    travelMode,
    selfLat: gpsState.lat,
    selfLng: gpsState.lng,
  });

  const voteAnchor = useMemo(() => {
    if (destination) return { lat: destination.lat, lng: destination.lng };
    if (selectedPlace) return { lat: selectedPlace.lat, lng: selectedPlace.lng };
    if (userLocation) return userLocation;
    return { lat: 41.922, lng: -87.726 };
  }, [destination, selectedPlace, userLocation]);

  const voteMapPins = useMemo(
    () => buildVoteMapPins(groupVote, voteAnchor),
    [groupVote, voteAnchor],
  );

  const speedMps = gpsState.speed;
  const gpsStatus = gpsState.status;
  const gpsStatusRef = useRef(gpsStatus);
  gpsStatusRef.current = gpsStatus;
  const liveGpsActive = gpsStatus === "active" || gpsStatus === "approximate" || gpsStatus === "requesting" || gpsStatus === "stale";

  const requestInitialLocate = useCallback(() => {
    if (initialLocateDoneRef.current) return;
    if (!mapRef.current) return;
    if (gpsStatusRef.current === "denied") return;
    initialLocateDoneRef.current = true;
    mapRef.current.locateUser(true);
  }, []);

  const handleMapReady = useCallback(() => {
    requestInitialLocate();
  }, [requestInitialLocate]);

  const [toast, setToast] = useState<string | null>(null);
  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 3200);
  }, []);
  const [loadingPlaceDetails, setLoadingPlaceDetails] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchPopup, setShowSearchPopup] = useState(false);
  const [showSuggestionsCard, setShowSuggestionsCard] = useState(false);
  const [searchResults, setSearchResults] = useState<AutocompleteResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchBias, setSearchBias] = useState<SearchBias | null>(null);
  const searchRequestGenerationRef = useRef(0);
  const activeSearchAbortRef = useRef<AbortController | null>(null);
  /** When true, the next searchQuery change came from place selection — skip autocomplete. */
  const skipSearchAutocompleteRef = useRef(false);
  const syncSearchBarFromPlace = useCallback(
    (place: Pick<PlacePreviewData, "name" | "address" | "coordinatesLabel">) => {
      skipSearchAutocompleteRef.current = true;
      const label = liveSearchBarLabel(place);
      if (label) {
        setSearchQuery(label);
        return;
      }
      if (place.name === "Dropped pin") {
        setSearchQuery("Finding location…");
      }
    },
    [],
  );
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
  const primaryRouteRef = useRef<RouteLine | null>(null);
  const routeAlternativesRef = useRef<RouteAlternative[]>([]);
  routeAlternativesRef.current = routeAlternatives;
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
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
    if (destination && isLiveActive && isActiveNavigationStage(liveStage)) {
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
    if (destination && isLiveActive && isActiveNavigationStage(liveStage)) {
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
      setRouteAlternatives([]);
      setSelectedRouteAlternativeId(null);
      primaryRouteRef.current = null;

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

        if (
          travelMode === "Drive" &&
          !isLandConnectedDriveRoute(
            route.geometry,
            origin.latitude,
            origin.longitude,
            dest.lat,
            dest.lng,
          )
        ) {
          setRoutePreviewStatus("failed");
          setRoutePreviewError(
            "No driveable land route to this location. It may be across open water or another continent — plan it as a future trip.",
          );
          setActiveRoute(null);
          return;
        }

        setActiveRoute(route);
        primaryRouteRef.current = route;
        if (result.alternatives && result.alternatives.length > 1) {
          setRouteAlternatives(result.alternatives);
          setSelectedRouteAlternativeId(result.alternatives[0]?.id ?? null);
        } else {
          setRouteAlternatives([]);
          setSelectedRouteAlternativeId(null);
        }
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
          if (isFarFromUser(dest.distanceM ?? null)) {
            focusMapOnPreviewPlace(mapRef.current, dest);
          } else {
            const lngs = route.geometry.map((c) => c[0]);
            const lats = route.geometry.map((c) => c[1]);
            mapRef.current?.fitBounds([
              [Math.min(...lngs), Math.min(...lats)],
              [Math.max(...lngs), Math.max(...lats)],
            ]);
          }
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

  const loadRouteIntelligence = useCallback(
    async (place: PlacePreviewData) => {
      const origin = userRegionToLocationSummary(userRegion, userLocation);
      if (!origin) {
        setRouteIntelligenceError("Set your location first to plan this trip.");
        setRouteIntelligenceLoading(false);
        return;
      }
      setRouteIntelligenceLoading(true);
      setRouteIntelligenceError(null);
      setRouteIntelligenceResponse(null);
      try {
        const response = await fetchRouteIntelligence(
          origin,
          placeToLocationSummary(place),
          vehiclePreference === "public" ? "public" : undefined,
        );
        setRouteIntelligenceResponse(response);
      } catch {
        setRouteIntelligenceError("Route planning unavailable right now.");
      } finally {
        setRouteIntelligenceLoading(false);
      }
    },
    [userRegion, userLocation, vehiclePreference],
  );

  const handleOpenTravelTab = useCallback(
    (kind: "plan" | "flights" | "routes" | "buses" = "plan") => {
      const target = destination ?? selectedPlace;
      const origin = userRegionToLocationSummary(userRegion, userLocation);
      if (!target) {
        router.push(`/${kind}`);
        return;
      }
      router.push(buildTravelHandoffUrl(kind, target, origin));
    },
    [destination, selectedPlace, userRegion, userLocation, router],
  );

  const handleSelectRouteIntelligenceOption = useCallback(
    (option: RouteOption) => {
      const target = destination ?? selectedPlace;
      if (!target) return;
      const origin = userRegionToLocationSummary(userRegion, userLocation);
      const kind = travelHandoffKindForRouteOption(option);
      showToast(travelHandoffLabel(kind));
      router.push(buildTravelHandoffUrl(kind, target, origin));
    },
    [destination, selectedPlace, userRegion, userLocation, router],
  );

  const handleSelectRouteAlternative = useCallback(
    (altId: string) => {
      const primary = primaryRouteRef.current;
      const alternatives = routeAlternativesRef.current;
      if (!primary || alternatives.length === 0) return;

      setSelectedRouteAlternativeId(altId);
      const alt = alternatives.find((item) => item.id === altId);
      if (!alt) return;

      const usePrimary = altId === alternatives[0]?.id;
      const nextRoute = routeLineFromAlternative(primary, alt, usePrimary);
      setActiveRoute(nextRoute);

      if (nextRoute.geometry.length >= 2) {
        const lngs = nextRoute.geometry.map((c) => c[0]);
        const lats = nextRoute.geometry.map((c) => c[1]);
        mapRef.current?.fitBounds([
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ]);
      }
    },
    [],
  );

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
    setDockStage("setup");
    setDockPanelOpen(true);
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
    setViewingDetailsFromNearby(false);
    setShowPlaceDetailsPanel(false);
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

    if (isUnroutableOpenWaterPlace(withCategory)) {
      setLiveStage("static_landing");
      setActiveRoute(null);
      setRoutePreviewStatus("idle");
      setRoutePreviewError(null);
      return;
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
    placeInput: PlacePreviewData,
    options?: {
      origin?: "search" | "map_click";
      clickLat?: number;
      clickLng?: number;
      /** Open PlacePanel without committing destination (dropped pin / map pick preview). */
      showPlacePanel?: boolean;
      openDetailsPanel?: boolean;
    },
  ) => {
    let place = placeInput;
    if (!Number.isFinite(place.lat) || !Number.isFinite(place.lng)) {
      showToast("Invalid place location.");
      return;
    }

    if (addStopMode && isLiveActive && destination) {
      addPlaceAsRouteStop(place);
      return;
    }

    if (pendingVoteOptionAdd && isGroupVoteOpen) {
      setPendingVoteOptionAdd(false);
      const optionId = `place-${place.lat.toFixed(5)}-${place.lng.toFixed(5)}`;
      setMockGroupVote((prev) =>
        addGroupVoteOption(prev, {
          id: optionId,
          name: place.name ?? "New option",
          meta: place.address ?? "Added from map",
          lat: place.lat,
          lng: place.lng,
        }),
      );
      setDockStage("vote");
      setDockPanelOpen(true);
      setShowSearchPopup(false);
      setShowSuggestionsCard(false);
      showToast(`${place.name ?? "Place"} added to the vote.`);
      return;
    }

    setActiveSavedPlaceId(null);

    logRovvyLiveDebug("[Rovvy Live Search] selectDestination", {
      place,
      targetLocation: { lat: place.lat, lng: place.lng },
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
    setShowPlaceDetailsPanel(
      options?.showPlacePanel ?? Boolean(options?.openDetailsPanel),
    );
    setCoordinateOverlay(null);
    if (!options?.showPlacePanel) {
      setMapClickPin(null);
    }
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
      const tapLat = options.clickLat ?? place.lat;
      const tapLng = options.clickLng ?? place.lng;
      setClickedLocation({ lat: tapLat, lng: tapLng });
      place = { ...place, lat: tapLat, lng: tapLng };
    }

    const pinLat = place.lat;
    const pinLng = place.lng;

    setSelectedPlace(place);
    setLiveStage("place_preview");
    syncSearchBarFromPlace(place);
    setLoadingPlaceDetails(true);

    recordRecentSearch(
      place.source === "dropped_pin"
        ? buildDroppedPinRecentSearch(pinLat, pinLng, place.address)
        : buildPlaceRecentSearch(place),
      currentUserId,
    );
    refreshRecentSearches();

    void resolvePlaceMedia(place).then((resolution: PlaceMediaResolution) => {
      setSelectedPlace((prev) => {
        if (!prev || prev.lat !== pinLat || prev.lng !== pinLng) return prev;
        return { ...prev, placeKey: resolution.placeKey };
      });
      setPlaceMedia(resolution.media);
      setPlaceTags(resolution.tags);
      setPlaceMediaLoading(false);
    });

    let previewPlace = place;

    try {
      let resolvedPlace = place;
      const cachedTapRaw =
        options?.origin === "map_click" ? getTapGeocodeCache(pinLat, pinLng) : null;
      const cachedTap =
        cachedTapRaw && isUsableTapGeocodeCache(cachedTapRaw) ? cachedTapRaw : null;
      if (cachedTap) {
        resolvedPlace = {
          ...place,
          name: cachedTap.name,
          categoryLabel: cachedTap.categoryLabel,
          address: cachedTap.address,
          city: cachedTap.city ?? place.city,
          state: cachedTap.state ?? place.state,
          country: cachedTap.country ?? place.country,
          placeKey: cachedTap.placeKey ?? place.placeKey,
          osmType: cachedTap.osmType ?? place.osmType,
          osmId: cachedTap.osmId ?? place.osmId,
          source: place.source === "dropped_pin" ? "nominatim" : place.source,
        };
        setSelectedPlace(resolvedPlace);
        syncSearchBarFromPlace(resolvedPlace);
      }
      const needsReverseGeocode =
        place.source !== "map_pick" &&
        (place.source === "dropped_pin" ||
          !cachedTap ||
          isUnresolvedDroppedPin(resolvedPlace) ||
          isNamedOceanBasinLabel(cachedTap?.name ?? resolvedPlace.name));
      if (needsReverseGeocode) {
        const details = await liveGeocodingReverse(pinLat, pinLng);
        if (details) {
          resolvedPlace = resolvePlaceFromReverseGeocode(
            resolvedPlace,
            details,
            pinLat,
            pinLng,
            userLocation,
          );
          setSelectedPlace(resolvedPlace);
          syncSearchBarFromPlace(resolvedPlace);
        } else if (isUnresolvedDroppedPin(resolvedPlace)) {
          const coarseFallback = buildCoarseLandFallbackPlace(
            pinLat,
            pinLng,
            userLocation,
            resolvedPlace.source === "dropped_pin" ? "dropped_pin" : resolvedPlace.source,
          );
          if (coarseFallback) {
            resolvedPlace = coarseFallback;
          } else {
            resolvedPlace = {
              ...resolvedPlace,
              mapPresenceNote:
                "Geocoder unavailable — showing coordinates only. Check backend on port 8000.",
            };
          }
          setSelectedPlace(resolvedPlace);
          syncSearchBarFromPlace(resolvedPlace);
        }
      }
      resolvedPlace = await enrichPlaceDisplayName(resolvedPlace);
      setSelectedPlace(resolvedPlace);
      syncSearchBarFromPlace(resolvedPlace);
      if (options?.origin === "map_click") {
        if (
          !isGenericPlaceName(resolvedPlace.name) &&
          !isNamedOceanBasinLabel(resolvedPlace.name)
        ) {
          setTapGeocodeCache(pinLat, pinLng, {
            name: resolvedPlace.name,
            categoryLabel: resolvedPlace.categoryLabel,
            address: resolvedPlace.address,
            city: resolvedPlace.city ?? null,
            state: resolvedPlace.state ?? null,
            country: resolvedPlace.country ?? null,
            placeKey: resolvedPlace.placeKey ?? null,
            osmType: resolvedPlace.osmType ?? null,
            osmId: resolvedPlace.osmId ?? null,
          });
        }
        recordRecentSearch(
          isUnresolvedDroppedPin(resolvedPlace)
            ? buildDroppedPinRecentSearch(pinLat, pinLng, resolvedPlace.address)
            : buildPlaceRecentSearch(resolvedPlace),
          currentUserId,
        );
        refreshRecentSearches();
      }
      previewPlace = resolvedPlace;
    } finally {
      setLoadingPlaceDetails(false);
    }

    if (options?.openDetailsPanel) {
      setDestination(previewPlace);
      setLiveStage("destination_set");
      mapRef.current?.clearClickedPin();
      recordRecentSearch(
        previewPlace.source === "dropped_pin"
          ? buildDroppedPinRecentSearch(previewPlace.lat, previewPlace.lng, previewPlace.address)
          : { ...buildPlaceRecentSearch(previewPlace), type: "destination" },
        currentUserId,
      );
      refreshRecentSearches();
    }

    focusMapOnPreviewPlace(mapRef.current, previewPlace);

    if (isUnroutableOpenWaterPlace(previewPlace)) {
      setLiveStage("static_landing");
      setActiveRoute(null);
      setRoutePreviewStatus("idle");
      setRoutePreviewError(null);
      setRouteLoading(false);
      lastFetchedRouteRef.current = null;
      return;
    }

    kickRoutePreview(previewPlace, { fitMap: true });
  }, [
    addPlaceAsRouteStop,
    addStopMode,
    currentUserId,
    destination,
    isGroupVoteOpen,
    isLiveActive,
    kickRoutePreview,
    pendingVoteOptionAdd,
    refreshRecentSearches,
    showToast,
    syncSearchBarFromPlace,
    userLocation,
  ]);

  const refreshDiscoveryLayer = useCallback(
    async (options?: { quiet?: boolean }) => {
      if (!discoveryLayerEnabled || mapZoom < LIVE_DISCOVERY_MIN_ZOOM) return;
      const map = mapRef.current;
      if (!map) return;
      const bbox = map.getVisibleBbox();
      if (discoveryLastBboxRef.current && bboxContains(discoveryLastBboxRef.current, bbox)) {
        return;
      }
      if (discoveryFetchInFlightRef.current) return;
      discoveryFetchInFlightRef.current = true;
      try {
        const res = await fetchLiveDiscoveryLayer(
          bbox,
          buildDiscoveryCatsParam(discoveryCategoryKeys),
          mapZoom,
        );
        if (res.error) {
          setDiscoveryLayerNotice(res.error);
          if (!options?.quiet) showToast(res.error);
          return;
        }
        setDiscoveryLayerNotice(null);
        const pts = res.points ?? [];
        setDiscoveryLayerPoints(pts);
        discoveryLastBboxRef.current = bbox;
        if (!options?.quiet) {
          if (pts.length > 0) {
            showToast(
              `${pts.length} places in this map area — pan the map to load another region; tap a number bubble to zoom in`,
            );
          } else {
            showToast("No parks or landmarks in this area — try panning or zooming in");
          }
        }
      } catch {
        setDiscoveryLayerNotice("layer unavailable · try again");
      } finally {
        discoveryFetchInFlightRef.current = false;
      }
    },
    [discoveryLayerEnabled, mapZoom, showToast, discoveryCategoryKeys],
  );

  const discoveryLowZoomNotice = `Hidden below z${LIVE_DISCOVERY_MIN_ZOOM} — not global; loads ~25–60 km around what you see`;
  const refreshDiscoveryLayerRef = useRef(refreshDiscoveryLayer);
  refreshDiscoveryLayerRef.current = refreshDiscoveryLayer;

  useEffect(() => {
    if (!discoveryLayerEnabled) return;
    if (mapZoom < LIVE_DISCOVERY_MIN_ZOOM) {
      setDiscoveryLayerPoints((prev) => (prev.length === 0 ? prev : []));
      discoveryLastBboxRef.current = null;
      setDiscoveryLayerNotice((prev) =>
        prev === discoveryLowZoomNotice ? prev : discoveryLowZoomNotice,
      );
      return;
    }
    setDiscoveryLayerNotice((prev) => (prev === discoveryLowZoomNotice ? null : prev));
    discoveryLastBboxRef.current = null;
    const id = window.setTimeout(() => {
      void refreshDiscoveryLayerRef.current({ quiet: true });
    }, 600);
    return () => window.clearTimeout(id);
  }, [discoveryLayerEnabled, mapZoom, discoveryLowZoomNotice]);

  useEffect(() => {
    if (!discoveryLayerEnabled || mapZoom < LIVE_DISCOVERY_MIN_ZOOM) return;
    discoveryLastBboxRef.current = null;
    const id = window.setTimeout(() => {
      void refreshDiscoveryLayerRef.current({ quiet: true });
    }, 400);
    return () => window.clearTimeout(id);
  }, [discoveryCategoryKeys, discoveryLayerEnabled, mapZoom]);

  const handleDiscoveryCategoryToggle = useCallback((key: DiscoveryLayerCategoryKey) => {
    setDiscoveryCategoryKeys((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      const normalized =
        next.length > 0 ? next : ([...DISCOVERY_LAYER_DEFAULT_KEYS] as DiscoveryLayerCategoryKey[]);
      writeDiscoveryCategorySelection(normalized);
      return normalized;
    });
    discoveryLastBboxRef.current = null;
  }, []);

  const handleDiscoveryCategoriesSelectAll = useCallback(() => {
    const all = [...DISCOVERY_LAYER_SELECTABLE_KEYS] as DiscoveryLayerCategoryKey[];
    setDiscoveryCategoryKeys(all);
    writeDiscoveryCategorySelection(all);
    discoveryLastBboxRef.current = null;
  }, []);

  const handleDiscoveryCategoriesClear = useCallback(() => {
    const defaults = [...DISCOVERY_LAYER_DEFAULT_KEYS] as DiscoveryLayerCategoryKey[];
    setDiscoveryCategoryKeys(defaults);
    writeDiscoveryCategorySelection(defaults);
    discoveryLastBboxRef.current = null;
  }, []);

  const handleDiscoveryClusterClick = useCallback(
    (hint: { count: number }) => {
      showToast(
        `${hint.count} places in this spot — too close at this zoom. Zooming in to show them separately.`,
      );
    },
    [showToast],
  );

  const handleDiscoveryLayerChange = useCallback(
    (enabled: boolean) => {
      setDiscoveryLayerEnabled(enabled);
      writeDiscoveryLayerSessionEnabled(enabled);
      if (!enabled) {
        setDiscoveryLayerPoints([]);
        discoveryLastBboxRef.current = null;
        setDiscoveryLayerNotice(null);
        return;
      }
      if (mapZoom >= LIVE_DISCOVERY_MIN_ZOOM) {
        showToast("Loading parks & capitals for this map area…");
        void refreshDiscoveryLayer();
      } else {
        showToast(`Zoom in to z${LIVE_DISCOVERY_MIN_ZOOM}+ to load the discovery layer.`);
      }
    },
    [mapZoom, refreshDiscoveryLayer, showToast],
  );

  const handleMapMoveEndDiscovery = useCallback(() => {
    if (!discoveryLayerEnabled || mapZoom < LIVE_DISCOVERY_MIN_ZOOM) return;
    if (discoveryFetchTimerRef.current) {
      clearTimeout(discoveryFetchTimerRef.current);
    }
    discoveryFetchTimerRef.current = setTimeout(() => {
      void refreshDiscoveryLayer({ quiet: true });
    }, 500);
  }, [discoveryLayerEnabled, mapZoom, refreshDiscoveryLayer]);

  const handleDiscoveryPinClick = useCallback(
    (point: LiveDiscoveryLayerPoint) => {
      const gersId = point.gersId?.trim();
      const tags: Record<string, unknown> = {
        ...(point.tags ?? {}),
        ...(gersId ? { gers_id: gersId } : {}),
      };
      const preview: PlacePreviewData = {
        name: point.name,
        categoryLabel: point.category,
        address: point.address ?? `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`,
        phone: null,
        lat: point.lat,
        lng: point.lng,
        distanceM: userLocation
          ? haversineM(userLocation.lat, userLocation.lng, point.lat, point.lng)
          : null,
        openingHours: null,
        openStatus: null,
        placeKey: point.placeKey ?? point.id,
        osmType: point.osmType ?? null,
        osmId: point.osmId != null ? Number(point.osmId) : null,
        source: "discovery_layer",
        tags,
      };
      void selectDestination(preview, {
        origin: "map_click",
        showPlacePanel: true,
      });
    },
    [selectDestination, userLocation],
  );

  useEffect(() => {
    const onWayraMapFocus = (event: Event) => {
      const detail = (event as CustomEvent<WayraMapFocusDetail | undefined>).detail;
      if (!detail || !Number.isFinite(detail.lat) || !Number.isFinite(detail.lng)) {
        return;
      }

      mapRef.current?.flyToPlace(detail.lat, detail.lng, detail.zoom ?? 16);
      setAttributionFocus({ lat: detail.lat, lng: detail.lng, pinned: true });
      setAttributionRefreshedAt(new Date());

      if (detail.showPreview === false) return;

      const place: PlacePreviewData = {
        name: detail.name?.trim() || "Place",
        categoryLabel: "Place",
        address: "",
        phone: null,
        lat: detail.lat,
        lng: detail.lng,
        distanceM: userLocation
          ? haversineM(userLocation.lat, userLocation.lng, detail.lat, detail.lng)
          : null,
        openingHours: null,
        openStatus: null,
        source: "wayra",
        tags: {},
      };
      void selectDestination(place, { origin: "search", openDetailsPanel: false });
    };

    window.addEventListener(WAYRA_MAP_FOCUS_EVENT, onWayraMapFocus);
    return () => window.removeEventListener(WAYRA_MAP_FOCUS_EVENT, onWayraMapFocus);
  }, [selectDestination, userLocation]);

  const selectDestinationFromPlace = selectDestination;

  const savedPlaceToPreview = useCallback(
    (saved: LiveSavedPlace): PlacePreviewData => ({
      name: saved.name,
      categoryLabel: saved.categoryLabel,
      address: saved.address,
      phone: null,
      lat: saved.lat,
      lng: saved.lng,
      distanceM: userLocation
        ? haversineM(userLocation.lat, userLocation.lng, saved.lat, saved.lng)
        : null,
      openingHours: null,
      openStatus: null,
      placeKey: saved.placeKey,
      source: "saved_local",
    }),
    [userLocation],
  );

  const handleSavedPlaceSelect = useCallback(
    (placeId: string) => {
      const saved = placeId.startsWith("trip:")
        ? tripSavedPlaces.find((place) => place.id === placeId) ?? null
        : getLiveSavedPlace(placeId);
      if (!saved) return;
      setActiveSavedPlaceId(placeId.startsWith("trip:") ? null : placeId);
      void selectDestination(savedPlaceToPreview(saved), {
        origin: "map_click",
        clickLat: saved.lat,
        clickLng: saved.lng,
        openDetailsPanel: false,
      });
    },
    [savedPlaceToPreview, selectDestination, tripSavedPlaces],
  );

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
    (payload: MapClickPayload): PlacePreviewData | null => {
      const topFeature = pickTopPlaceFeature(payload.features);
      if (!topFeature) return null;

      const props = (topFeature.properties || {}) as Record<string, unknown>;
      const preview = mapLabelFeatureToPlacePreview(
        topFeature,
        payload.lat,
        payload.lng,
        userLocation,
      );
      if (
        isNamedOceanBasinLabel(preview.name) ||
        isWaterMapFeature(props) ||
        isGenericWaterLabel(preview.name)
      ) {
        return null;
      }
      return preview;
    },
    [userLocation],
  );

  const openDroppedPinPreview = useCallback(
    (lat: number, lng: number) => {
      if (mapZoom <= 2.5) {
        showToast("Zoom in to pick a place on land.");
        return;
      }
      closeMapLocationSheet();
      setAttributionFocus({ lat, lng, pinned: true });
      setAttributionRefreshedAt(new Date());
      setMapClickPin({ lat, lng });
      let tapPlace = buildDroppedPinPlace(lat, lng, userLocation);
      syncSearchBarFromPlace(tapPlace);
      const cached = getTapGeocodeCache(lat, lng);
      if (cached && isUsableTapGeocodeCache(cached)) {
        tapPlace = {
          ...tapPlace,
          name: cached.name,
          categoryLabel: cached.categoryLabel,
          address: cached.address,
          city: cached.city ?? tapPlace.city,
          state: cached.state ?? tapPlace.state,
          country: cached.country ?? tapPlace.country,
          placeKey: cached.placeKey ?? tapPlace.placeKey,
          osmType: cached.osmType ?? tapPlace.osmType,
          osmId: cached.osmId ?? tapPlace.osmId,
          source: "nominatim",
        };
      }

      emitWayraPlacePicked({
        lat,
        lng,
        name: tapPlace.name ?? null,
      });
      void selectDestination(tapPlace, {
        origin: "map_click",
        clickLat: lat,
        clickLng: lng,
        showPlacePanel: false,
      });
    },
    [closeMapLocationSheet, mapZoom, selectDestination, showToast, syncSearchBarFromPlace, userLocation],
  );

  const openMapTapPreview = useCallback(
    (payload: MapClickPayload) => {
      if (mapZoom <= 2.5) {
        showToast("Zoom in to pick a place on land.");
        return;
      }
      const resolved = resolveMapClickPlace(payload);
      if (!resolved) {
        openDroppedPinPreview(payload.lat, payload.lng);
        return;
      }

      closeMapLocationSheet();
      setAttributionFocus({ lat: payload.lat, lng: payload.lng, pinned: true });
      setAttributionRefreshedAt(new Date());

      const tapLat = payload.lat;
      const tapLng = payload.lng;
      setMapClickPin({ lat: tapLat, lng: tapLng });
      skipSearchAutocompleteRef.current = true;
      setSearchQuery(formatMapCoordinates(tapLat, tapLng));
      let tapPlace: PlacePreviewData = { ...resolved, lat: tapLat, lng: tapLng };

      const cached = getTapGeocodeCache(tapLat, tapLng);
      if (cached && isUsableTapGeocodeCache(cached)) {
        tapPlace = {
          ...tapPlace,
          name: cached.name,
          categoryLabel: cached.categoryLabel,
          address: cached.address,
          city: cached.city ?? tapPlace.city,
          state: cached.state ?? tapPlace.state,
          country: cached.country ?? tapPlace.country,
          placeKey: cached.placeKey ?? tapPlace.placeKey,
          osmType: cached.osmType ?? tapPlace.osmType,
          osmId: cached.osmId ?? tapPlace.osmId,
          source: tapPlace.source === "dropped_pin" ? "nominatim" : tapPlace.source,
        };
      }

      emitWayraPlacePicked({
        lat: tapLat,
        lng: tapLng,
        name: tapPlace.name ?? null,
      });
      void selectDestination(tapPlace, {
        origin: "map_click",
        clickLat: tapLat,
        clickLng: tapLng,
        showPlacePanel: false,
      });
    },
    [closeMapLocationSheet, mapZoom, resolveMapClickPlace, selectDestination, openDroppedPinPreview, showToast],
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
    const target = selectedPlace;
    if (!target || target.nameTranslated || isMostlyLatinPlaceName(target.name)) return;

    let cancelled = false;
    void enrichPlaceDisplayName(target)
      .then((enriched) => {
        if (cancelled || !enriched.nameTranslated) return;
        setSelectedPlace((prev) =>
          prev && prev.lat === enriched.lat && prev.lng === enriched.lng ? enriched : prev,
        );
        setDestination((prev) =>
          prev && prev.lat === enriched.lat && prev.lng === enriched.lng ? enriched : prev,
        );
        const label = liveSearchBarLabel(enriched);
        if (label) {
          skipSearchAutocompleteRef.current = true;
          setSearchQuery(label);
        }
      })
      .catch(() => {
        /* keep original place label */
      });

    return () => {
      cancelled = true;
    };
  }, [
    selectedPlace?.lat,
    selectedPlace?.lng,
    selectedPlace?.name,
    selectedPlace?.nameTranslated,
    selectedPlace?.country,
    selectedPlace?.osmType,
    selectedPlace?.osmId,
  ]);

  useEffect(() => {
    if (skipSearchAutocompleteRef.current) {
      skipSearchAutocompleteRef.current = false;
      return;
    }

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
      activeSearchAbortRef.current?.abort();
      const requestGeneration = ++searchRequestGenerationRef.current;
      let searchAbort: AbortController;
      try {
        searchAbort = new AbortController();
      } catch {
        setSearchLoading(false);
        return;
      }
      activeSearchAbortRef.current = searchAbort;

      try {
        const abortSignal = searchAbort?.signal;
        if (!abortSignal) {
          setSearchLoading(false);
          return;
        }
        const results = await liveAutocompleteSearch(
          searchQuery,
          anchor,
          abortSignal,
        );
        if (requestGeneration !== searchRequestGenerationRef.current) return;
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
      activeSearchAbortRef.current?.abort();
      activeSearchAbortRef.current = null;
      searchRequestGenerationRef.current += 1;
    };
  }, [searchQuery, resolveSearchAnchor]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const viewMode = mapRef.current?.getViewMode();
      if (!viewMode) return;
      setMapViewMode((prev) => (prev === viewMode ? prev : viewMode));
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
    setAttributionFocus((prev) => {
      if (prev?.pinned) return prev;
      if (
        prev &&
        Math.abs(prev.lat - center.lat) < 1e-5 &&
        Math.abs(prev.lng - center.lng) < 1e-5
      ) {
        return prev;
      }
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
        requestInitialLocate();
      }
      result.onchange = () => {
        logRovvyGps("permission state changed", { state: result.state });
        if (result.state === "denied") {
          setGpsState((prev) => ({ ...prev, status: "denied" }));
        } else if (result.state === "granted") {
          requestInitialLocate();
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
    emitClearWayraContext();
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

  function splitPhaseEntryForWorkflow(): SplitPhaseEntry {
    if (workflowType === "Seat Share") return "launch";
    if (workflowType === "Group Travel") return "private";
    return "solo";
  }

  function requireSoloNavigation(): boolean {
    if (workflowType === "Solo") return true;
    showToast(`${workflowType} navigation starts in a later phase — set destination and preview route for now.`);
    return false;
  }

  function handleMakeDestination() {
    if (!selectedPlace) return;
    setDestination(selectedPlace);
    setIsLiveActive(false);
    mapRef.current?.clearClickedPin();
    recordRecentSearch(
      { ...buildPlaceRecentSearch(selectedPlace), type: "destination" },
      currentUserId,
    );
    refreshRecentSearches();

    const ctx = buildLocationContext({
      userLocation: userRegion ?? userLocation,
      selectedPlace: placeToContextInput(selectedPlace),
      workflowType,
      travelMode,
      liveStage: "destination_set",
    });

    if (shouldOpenRouteIntelligence(ctx, vehiclePreference)) {
      setLiveStage("long_distance_preview");
      void loadRouteIntelligence(selectedPlace);
      return;
    }

    setLiveStage("destination_set");
    kickRoutePreview(selectedPlace, { fitMap: true, refreshGps: true });

    if (vehiclePreference === "public") {
      showToast("No private vehicle? Use Travel tab for trains and buses, or ask Wayra.");
    }
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
    if (!requireSoloNavigation() || !selectedPlace) return;
    if (routePreviewStatus !== "ready" || !activeRoute) {
      showToast(routePreviewError || "Route unavailable right now.");
      return;
    }
    const origin = resolveRoutePreviewOrigin();
    const blockReason = soloLiveBlockReason({
      travelMode,
      distanceM:
        selectedPlace.distanceM ??
        (origin
          ? haversineM(origin.latitude, origin.longitude, selectedPlace.lat, selectedPlace.lng)
          : null),
      originLat: origin?.latitude,
      originLng: origin?.longitude,
      destLat: selectedPlace.lat,
      destLng: selectedPlace.lng,
      route: activeRoute,
      locationContext,
    });
    if (blockReason) {
      showToast(blockReason);
      handleAskWayraFromPreview();
      return;
    }
    const dest = selectedPlace;
    setDestination(dest);
    dismissPlacePreviewForLive();
    setIsLiveActive(true);
    setLiveStage("split_phase_active");
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

  const handleAddPreviewLocation = useCallback(async () => {
    if (!selectedPlace) return;
    handleSavePlaceLocally(selectedPlace);
    try {
      const result = await addLivePreviewLocation(selectedPlace);
      if (result.syncedToAccount) {
        showToast(
          result.created ? "Location saved to your account." : "Location updated on your account.",
        );
      } else {
        showToast("Location saved on this device.");
      }
    } catch {
      showToast("Location saved locally. Account sync failed.");
    }
  }, [selectedPlace, handleSavePlaceLocally]);

  const handleStartPreviewDirection = useCallback(async () => {
    if (!requireSoloNavigation() || !selectedPlace) return;

    if (routeLoading || routePreviewStatus === "loading") {
      showToast("Calculating route…");
      return;
    }

    if (routePreviewStatus !== "ready" || !activeRoute) {
      const name =
        selectedPlace.name?.trim() ||
        selectedPlace.categoryLabel?.trim() ||
        formatMapCoordinates(selectedPlace.lat, selectedPlace.lng);
      const issue =
        routePreviewError?.trim() ||
        "I could not get a drive route to this exact point.";
      emitWayraPlacePicked({
        lat: selectedPlace.lat,
        lng: selectedPlace.lng,
        name: selectedPlace.name ?? null,
        autoOpen: true,
      });
      emitOpenWayra({
        prompt: `I picked ${name} on Rovvy Live (${selectedPlace.lat.toFixed(4)}, ${selectedPlace.lng.toFixed(4)}). ${issue} What alternatives should I try — nearby road access, walking route, or planning this as a future trip?`,
        autoSend: true,
      });
      return;
    }

    const origin = resolveRoutePreviewOrigin();
    const blockReason = soloLiveBlockReason({
      travelMode,
      distanceM:
        selectedPlace.distanceM ??
        (origin
          ? haversineM(origin.latitude, origin.longitude, selectedPlace.lat, selectedPlace.lng)
          : null),
      originLat: origin?.latitude,
      originLng: origin?.longitude,
      destLat: selectedPlace.lat,
      destLng: selectedPlace.lng,
      route: activeRoute,
      locationContext,
    });
    if (blockReason) {
      showToast(blockReason);
      emitWayraPlacePicked({
        lat: selectedPlace.lat,
        lng: selectedPlace.lng,
        name: selectedPlace.name ?? null,
        autoOpen: true,
      });
      emitOpenWayra({
        prompt: `I want directions to ${selectedPlace.name} on Rovvy Live but: ${blockReason} What should I do instead?`,
        autoSend: true,
      });
      return;
    }

    if (!origin) {
      showToast("Set your starting point first.");
      return;
    }
    const result = await startLivePreviewDirection({
      origin,
      destination: selectedPlace,
      travelMode,
    });
    if (!result.ok) {
      emitWayraPlacePicked({
        lat: selectedPlace.lat,
        lng: selectedPlace.lng,
        name: selectedPlace.name ?? null,
        autoOpen: true,
      });
      emitOpenWayra({
        prompt: `I tried to start directions to ${selectedPlace.name} on Rovvy Live but got: "${result.message || "Route unavailable"}." What should I do instead?`,
        autoSend: true,
      });
      return;
    }
    handleGetDirections();
  }, [
    selectedPlace,
    routePreviewStatus,
    routeLoading,
    activeRoute,
    routePreviewError,
    resolveRoutePreviewOrigin,
    travelMode,
  ]);

  function handleContinueFromPreview() {
    if (!requireSoloNavigation() || !selectedPlace) return;
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
    handleOpenTravelTab("plan");
  }

  async function handleStartLive() {
    if (!destination) return;
    if (routePreviewStatus !== "ready" || !activeRoute) {
      showToast(routePreviewError || "Route unavailable right now.");
      return;
    }

    if (workflowType === "Group Travel") {
      if (!user?.id) {
        setShowSignInModal(true);
        return;
      }

      if (tripId) {
        const result = await startGroupConvergeSession({
          tripId,
          destinationLat: destination.lat,
          destinationLng: destination.lng,
          travelMode,
        });
        if (!result.ok) {
          showToast(result.message ?? "Could not start Group Live.");
          return;
        }
        setIsGroupConverging(true);
        setDockStage("converge");
        setDockPanelOpen(true);
        setFriendTrackingEnabled(true);
        showToast("Group Live started — sharing live ETAs.");
        return;
      }

      setIsGroupConverging(true);
      setDockStage("converge");
      setDockPanelOpen(true);
      setFriendTrackingEnabled(true);
      showToast("Open Live from a trip to share live ETAs with your group.");
      return;
    }
    if (workflowType === "Seat Share") {
      if (!user?.id) {
        setShowSignInModal(true);
        return;
      }
      setIsSeatShareActive(true);
      setDockStage("seat");
      setDockPanelOpen(true);
      showToast(
        tripId
          ? "Seat Share live — broadcasting your open seats to the trip."
          : "Open Live from a trip to broadcast seats to your group.",
      );
      return;
    }

    const origin = resolveRoutePreviewOrigin();
    const blockReason = soloLiveBlockReason({
      travelMode,
      distanceM:
        destination.distanceM ??
        (origin
          ? haversineM(origin.latitude, origin.longitude, destination.lat, destination.lng)
          : null),
      originLat: origin?.latitude,
      originLng: origin?.longitude,
      destLat: destination.lat,
      destLng: destination.lng,
      route: activeRoute,
      locationContext,
    });
    if (blockReason) {
      showToast(blockReason);
      handleAskWayraFromPreview();
      return;
    }

    if (origin) {
      const result = await startLivePreviewDirection({
        origin,
        destination,
        travelMode,
      });
      if (!result.ok) {
        showToast(result.message || "Could not start live session.");
        return;
      }
      setLiveSessionId(result.sessionId ?? null);
      setSplitPhaseActivity({
        sessionId: result.sessionId ?? null,
        entry: splitPhaseEntryForWorkflow(),
        workflowType,
        memberCount: 1,
        activeLegModality: travelMode,
        isActive: true,
      });
    }

    dismissPlacePreviewForLive();
    setIsLiveActive(true);
    setLiveStage("split_phase_active");
    setTripStatus("on_the_way");
    activateRouteForNavigation();
    startWazeNavigation();
  }

  /** @deprecated alias — use handleStartLive */
  function handleStartSoloLive() {
    void handleStartLive();
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
    if (!requireSoloNavigation() || !destination) return;
    if (routePreviewStatus !== "ready" || !activeRoute) {
      showToast(routePreviewError || "Route unavailable right now.");
      return;
    }
    const origin = resolveRoutePreviewOrigin();
    const blockReason = soloLiveBlockReason({
      travelMode,
      distanceM:
        destination.distanceM ??
        (origin
          ? haversineM(origin.latitude, origin.longitude, destination.lat, destination.lng)
          : null),
      originLat: origin?.latitude,
      originLng: origin?.longitude,
      destLat: destination.lat,
      destLng: destination.lng,
      route: activeRoute,
      locationContext,
    });
    if (blockReason) {
      showToast(blockReason);
      handleAskWayraFromPreview();
      return;
    }
    dismissPlacePreviewForLive();
    setIsLiveActive(true);
    setLiveStage("split_phase_active");
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
    setLiveSessionId(null);
    setSplitPhaseActivity(null);

    setLiveStage("destination_set");
    showToast("Solo Live ended.");
  }

  function handleAddStopFromPreview() {
    if (!requireSoloNavigation() || !selectedPlace) return;
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
    handleSavePlaceLocally(place);
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

  const isNavigating = isActiveNavigationStage(liveStage);
  const isLongDistancePreview = liveStage === "long_distance_preview";
  const roviTargetPlace = selectedPlace ?? destination;
  const selectedPlaceSaved = useMemo(() => {
    if (!selectedPlace) return false;
    return isLivePlaceSaved(selectedPlace.lat, selectedPlace.lng, selectedPlace.placeKey);
  }, [selectedPlace, mySavedPlaces]);
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
  const routeSummaryPlace = selectedPlace ?? destination;
  const showRouteSummaryBar =
    !isLiveActive &&
    (liveStage === "place_preview" || liveStage === "destination_set") &&
    Boolean(routeSummaryPlace) &&
    !isUnroutableOpenWaterPlace(routeSummaryPlace) &&
    !showFarAwayPanel &&
    !showPlaceDetailsPanel;
  const showPlacePreview =
    !isLiveActive &&
    Boolean(selectedPlace) &&
    showPlaceDetailsPanel &&
    !showFarAwayPanel;

  const placePanelSeed = useMemo(
    () => (selectedPlace ? placePreviewToPlaceSeed(selectedPlace) : null),
    [selectedPlace],
  );

  const placePanelPreview = useMemo(
    () => (selectedPlace ? placePreviewToPlacePanelPreview(selectedPlace) : null),
    [selectedPlace],
  );

  const placePanelDistance = useMemo(
    () =>
      buildPlacePanelDistance(
        selectedPlace?.distanceM,
        activeRoute?.durationSeconds ?? null,
        false,
      ),
    [selectedPlace?.distanceM, activeRoute?.durationSeconds],
  );

  const placePanelAiSuggestions = useMemo(() => {
    if (!selectedPlace) return [];
    const routeReady = routePreviewStatus === "ready" && activeRoute;
    const contextNotice =
      locationContext && locationContext.classification !== "local_place"
        ? locationContext.template?.recommendation ?? null
        : null;
    return buildRoutePreviewAiSuggestions({
      destinationName: selectedPlace.name ?? selectedPlace.categoryLabel ?? "this place",
      farFromUser: isFarFromUser(selectedPlace.distanceM ?? null),
      contextNotice,
      lastMileNotice:
        routeReady && activeRoute.lastMileMode === "walk"
          ? activeRoute.lastMileNotice ?? null
          : null,
      borderNotice: routeReady ? activeRoute.borderNotice ?? null : null,
      routeError:
        routePreviewStatus === "failed" && routePreviewError ? routePreviewError : null,
    });
  }, [
    selectedPlace,
    locationContext,
    routePreviewStatus,
    activeRoute,
    routePreviewError,
  ]);

  const showLeftDock =
    (!isLiveActive || isGroupConverging || isSeatShareActive || isNightFinished) &&
    !isNavigating &&
    !showPlacePreview &&
    !isLongDistancePreview;

  const convergeAvailable =
    workflowType === "Group Travel" && Boolean(destination) && isGroupConverging;

  const showGroupConvergeRoutes =
    isGroupConverging && Boolean(destination) && friendTrackingEnabled;

  const groupConvergeRoutes = useMemo(() => {
    if (!showGroupConvergeRoutes || !destination) return [];
    return buildGroupConvergeRoutes(
      friendsLocations,
      { lat: destination.lat, lng: destination.lng },
      userLocation,
    );
  }, [showGroupConvergeRoutes, destination, friendsLocations, userLocation]);

  const voteAvailable =
    workflowType === "Group Travel" && Boolean(destination) && (isGroupConverging || isGroupVoteOpen);

  const showVotePins = voteAvailable && dockStage === "vote";

  const seatAvailable =
    workflowType === "Seat Share" && Boolean(destination) && isSeatShareActive;

  const settleAvailable =
    isNightFinished &&
    Boolean(destination) &&
    (workflowType === "Group Travel" || workflowType === "Seat Share");

  const useRealSeatShare =
    workflowType === "Seat Share" &&
    isSeatShareActive &&
    Boolean(tripId) &&
    Boolean(user?.id);

  const liveSeatShare = useLiveSeatShare({
    enabled: useRealSeatShare,
    tripId,
    currentUserId: user?.id ? String(user.id) : null,
    currentUserName: user?.full_name ?? "You",
    destinationName: destination?.name ?? "your destination",
    routeDistanceMeters: activeRoute?.distanceMeters ?? null,
    routeDurationSeconds: activeRoute?.durationSeconds ?? null,
    lat: gpsState.lat,
    lng: gpsState.lng,
  });

  useEffect(() => {
    setMockSeatShare(buildDefaultSeatShare(destination?.name ?? "your destination"));
    setMockJoinedVehicleId(null);
    setPickupCaptureActive(false);
  }, [destination?.name]);

  const seatShareState =
    useRealSeatShare && liveSeatShare.connected ? liveSeatShare.share : mockSeatShare;

  const joinedVehicleId =
    useRealSeatShare && liveSeatShare.connected
      ? liveSeatShare.joinedVehicleId
      : mockJoinedVehicleId;

  const seatShareStatusNotice = useMemo(() => {
    if (!isSeatShareActive || !destination) return null;
    return buildSeatShareOpenedNotice(
      seatShareOpenSeats(seatShareState),
      seatShareState.destinationName,
    );
  }, [destination, isSeatShareActive, seatShareState]);

  const showConvoyPins = seatAvailable && dockStage === "seat";

  const convoyMapPins = useMemo(() => {
    if (!isSeatShareActive || !destination) return [];

    if (useRealSeatShare && liveSeatShare.connected && liveSeatShare.offers.length > 0) {
      const pins = convoyOffersToMapPins(
        liveSeatShare.offers,
        user?.id ? String(user.id) : null,
      );
      if (pins.length > 0) return pins;
    }

    const anchorLat = userLocation?.lat ?? destination.lat;
    const anchorLng = userLocation?.lng ?? destination.lng;
    return buildMockConvoyMapPins({
      vehicles: seatShareState.vehicles,
      anchorLat,
      anchorLng,
    });
  }, [
    destination,
    isSeatShareActive,
    liveSeatShare.connected,
    liveSeatShare.offers,
    seatShareState.vehicles,
    useRealSeatShare,
    user?.id,
    userLocation,
  ]);

  const nightFinishedSummary = useMemo(() => {
    if (!destination) return null;
    return buildNightFinishedSummary({
      destinationName: destination.name ?? "the meetup",
      members: convergeMembers,
      memberCount: Math.max(groupMembers.length, groupVote.memberCount, 6),
      expenseTotal: tripExpenseTotal,
      arrivedCount: liveGroupArrival.arrivedCount,
      arrivalSubline: liveGroupArrival.subline,
    });
  }, [
    destination,
    convergeMembers,
    groupMembers.length,
    groupVote.memberCount,
    tripExpenseTotal,
    liveGroupArrival.arrivedCount,
    liveGroupArrival.subline,
  ]);

  const settleStatusNotice = useMemo(() => {
    if (!isNightFinished || !nightFinishedSummary) return null;
    return buildSettleOpenedNotice(nightFinishedSummary);
  }, [isNightFinished, nightFinishedSummary]);

  const focusLiveSearch = useCallback(() => {
    searchInputRef.current?.focus();
    setShowSearchPopup(true);
    setShowSuggestionsCard(false);
  }, []);

  const scrollToLiveDock = useCallback(() => {
    setDockStage("setup");
    setDockPanelOpen(true);
    document.getElementById("live-left-dock")?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, []);

  const handleDockStageSelect = useCallback(
    (stage: LiveDockStage) => {
      if (stage === dockStage && dockPanelOpen) {
        setDockPanelOpen(false);
        return;
      }
      if (stage === "place" && selectedPlace) {
        setShowPlaceDetailsPanel(true);
        setDockPanelOpen(false);
        return;
      }
      setDockStage(stage);
      setDockPanelOpen(true);
    },
    [dockPanelOpen, dockStage, selectedPlace],
  );

  useEffect(() => {
    if (nearbyCategory) {
      setDockStage("nearby");
      setDockPanelOpen(true);
    }
  }, [nearbyCategory]);

  useEffect(() => {
    if (!isGroupVoteOpen) {
      setVoteBootstrap(null);
      setPendingVoteOptionAdd(false);
      return;
    }
    setGroupVoteAlertDismissed(false);
  }, [isGroupVoteOpen]);

  useEffect(() => {
    if (workflowType !== "Group Travel") {
      setIsGroupConverging(false);
      setIsGroupVoteOpen(false);
      setIsNightFinished(false);
    }
    if (workflowType !== "Seat Share") {
      setIsSeatShareActive(false);
      setPickupCaptureActive(false);
    }
  }, [workflowType]);

  useEffect(() => {
    if (!isSeatShareActive) {
      setPickupCaptureActive(false);
      return;
    }
    setSeatShareAlertDismissed(false);
  }, [isSeatShareActive]);

  useEffect(() => {
    if (!isNightFinished) return;
    setSettleAlertDismissed(false);
  }, [isNightFinished]);

  const arrivalSuggestToastRef = useRef(false);
  const convergeErrorToastRef = useRef(false);
  const seatShareErrorToastRef = useRef(false);

  useEffect(() => {
    if (!isGroupConverging) {
      arrivalSuggestToastRef.current = false;
      convergeErrorToastRef.current = false;
      return;
    }
    setGroupConvergeAlertDismissed(false);
  }, [isGroupConverging]);

  useEffect(() => {
    if (!useRealGroupConverge || !liveGroupConverge.error) {
      convergeErrorToastRef.current = false;
      return;
    }
    if (convergeErrorToastRef.current) return;
    convergeErrorToastRef.current = true;
    showToast(liveGroupConverge.error);
  }, [liveGroupConverge.error, showToast, useRealGroupConverge]);

  useEffect(() => {
    if (!useRealSeatShare || !liveSeatShare.error) {
      seatShareErrorToastRef.current = false;
      return;
    }
    if (seatShareErrorToastRef.current) return;
    seatShareErrorToastRef.current = true;
    showToast(liveSeatShare.error);
  }, [liveSeatShare.error, showToast, useRealSeatShare]);

  useEffect(() => {
    if (!liveGroupArrival.suggestNightFinished || isNightFinished) return;
    if (arrivalSuggestToastRef.current) return;
    arrivalSuggestToastRef.current = true;
    showToast("Most of the group is here — wrap the night when you're ready.");
  }, [liveGroupArrival.suggestNightFinished, isNightFinished]);

  useEffect(() => {
    if (!isNightFinished || !tripId) {
      setTripExpenseTotal(null);
      return;
    }

    let cancelled = false;
    void fetchTripExpenseTotal(tripId).then((total) => {
      if (!cancelled) setTripExpenseTotal(total);
    });

    return () => {
      cancelled = true;
    };
  }, [isNightFinished, tripId]);

  const handlePutToVote = useCallback(async () => {
    if (workflowType !== "Group Travel") {
      showToast("Switch to Group Travel to put places to a group vote.");
      return;
    }
    if (!destination) {
      showToast("Set a destination first, then put options to a group vote.");
      return;
    }
    if (!user?.id) {
      setShowSignInModal(true);
      return;
    }

    setIsGroupVoteOpen(true);
    setFriendTrackingEnabled(true);
    setDockStage("vote");
    setDockPanelOpen(true);
    setShowPlaceDetailsPanel(false);

    if (tripId) {
      const result = await createLiveVotePoll(tripId, {
        options: buildCreateVoteOptions({ selectedPlace, destination }),
      });
      if (!result.panel) {
        showToast(result.error ?? "Could not open group vote.");
        return;
      }
      const nextVote = liveVotePanelToGroupVote(result.panel);
      setVoteBootstrap(nextVote);
      showToast(buildVoteOpenedNotice(nextVote.closesAtLabel));
      return;
    }

    if (selectedPlace) {
      const optionId = `place-${selectedPlace.lat.toFixed(5)}-${selectedPlace.lng.toFixed(5)}`;
      setMockGroupVote((prev) =>
        addGroupVoteOption(prev, {
          id: optionId,
          name: selectedPlace.name ?? "New option",
          meta: selectedPlace.address ?? "Added from map",
          lat: selectedPlace.lat,
          lng: selectedPlace.lng,
        }),
      );
    }

    showToast(
      selectedPlace
        ? buildVoteOpenedNotice(groupVote.closesAtLabel)
        : "Open Live from a trip to sync votes with your group.",
    );
  }, [destination, groupVote.closesAtLabel, selectedPlace, showToast, tripId, user?.id, workflowType]);

  const handleGroupVoteSelect = useCallback(
    async (optionId: string) => {
      if (useRealGroupVote) {
        const result = await liveGroupVote.selectOption(optionId);
        if (result.message) showToast(result.message);
        return;
      }
      setMockGroupVote((prev) => applyGroupVote(prev, optionId));
    },
    [liveGroupVote, showToast, useRealGroupVote],
  );

  const completePickupCapture = useCallback(
    async (label: string) => {
      const vehicleId = ownVehicleId(seatShareState, user?.id ? String(user.id) : null);
      if (!vehicleId) {
        showToast("Broadcast your ride first, then add pickup stops.");
        return;
      }

      if (useRealSeatShare && liveSeatShare.connected) {
        if (!user?.id) {
          setShowSignInModal(true);
          return;
        }
        const result = await liveSeatShare.addPickup(label);
        showToast(
          result.ok ? `Pickup added · ${label}` : (result.error ?? "Could not add pickup."),
        );
        return;
      }

      const result = applyAddPickupToSeatShare(seatShareState, vehicleId, {
        id: `pickup-${Date.now()}`,
        label,
        etaMinutes: 10,
      });
      if (!result.ok) {
        showToast(result.error ?? "Could not add pickup.");
        return;
      }
      if (!result.state) {
        showToast("Could not add pickup.");
        return;
      }
      setMockSeatShare(result.state);
      showToast(`Pickup added · ${label}`);
    },
    [liveSeatShare, seatShareState, useRealSeatShare, user?.id],
  );

  useEffect(() => {
    if (!pickupCaptureActive || !selectedPlace?.name || !isSeatShareActive) return;
    const label = selectedPlace.name;
    setPickupCaptureActive(false);
    void completePickupCapture(label);
  }, [completePickupCapture, isSeatShareActive, pickupCaptureActive, selectedPlace?.name]);

  const handleJoinVehicle = useCallback(
    async (vehicleId: string) => {
      const pickupLabel = selectedPlace?.name ?? destination?.name ?? "Your pickup point";
      const rider = {
        userId: user?.id ? String(user.id) : `guest-${vehicleId}`,
        name: user?.full_name ?? "You",
        pickupLabel,
        etaMinutes: 12,
      };

      if (useRealSeatShare && liveSeatShare.connected) {
        if (!user?.id) {
          setShowSignInModal(true);
          return;
        }
        const result = await liveSeatShare.joinVehicle(vehicleId, pickupLabel);
        showToast(
          result.ok ? "Seat request sent to the driver." : (result.error ?? "Could not join ride."),
        );
        return;
      }

      const result = applyJoinSeatShareVehicle(mockSeatShare, vehicleId, rider);
      if (!result.ok) {
        showToast(result.error ?? "Could not join ride.");
        return;
      }
      if (!result.state) {
        showToast("Could not join ride.");
        return;
      }
      setMockSeatShare(result.state);
      setMockJoinedVehicleId(vehicleId);
      showToast("Seat request sent to the driver.");
    },
    [
      destination?.name,
      liveSeatShare,
      mockSeatShare,
      selectedPlace?.name,
      useRealSeatShare,
      user?.full_name,
      user?.id,
    ],
  );

  const handleStartPickupCapture = useCallback(() => {
    setPickupCaptureActive(true);
    focusLiveSearch();
    showToast("Pick a place on the map or search to add a pickup stop.");
  }, [focusLiveSearch]);

  const handleConvoyPinClick = useCallback(
    (pinId: string) => {
      setDockStage("seat");
      setDockPanelOpen(true);
      const vehicle = seatShareState.vehicles.find((entry) => entry.id === pinId);
      if (vehicle) {
        showToast(`${vehicle.driverName} · ${vehicle.seatsOpen} seat${vehicle.seatsOpen === 1 ? "" : "s"} open`);
        return;
      }
      showToast("Seat share vehicle on map.");
    },
    [seatShareState.vehicles],
  );

  const handleGroupVoteQuickAction = useCallback(
    (action: "any_works" | "cant_tonight" | "add_option") => {
      if (action === "any_works") {
        showToast("Group sees you’re flexible on tonight’s pick.");
        return;
      }
      if (action === "cant_tonight") {
        showToast("Can’t tonight noted for the group.");
        return;
      }
      setPendingVoteOptionAdd(true);
      setShowSearchPopup(true);
      focusLiveSearch();
      showToast("Search a place to add as a vote option.");
    },
    [focusLiveSearch, showToast],
  );

  /** Preview-card Wayra: bound to the light place card only — clears when the card closes. */
  useEffect(() => {
    const buildUserLocationPayload = () => {
      if (!userLocation || !isFreshGpsStatus(gpsStatus)) return null;
      const browserTz =
        typeof Intl !== "undefined"
          ? Intl.DateTimeFormat().resolvedOptions().timeZone
          : null;
      return {
        lat: userLocation.lat,
        lng: userLocation.lng,
        city: userRegion?.city ?? null,
        state: userRegion?.state ?? null,
        country: userRegion?.country ?? null,
        timezone: browserTz,
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
        trip: liveTrip,
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
            trip: liveTrip,
            userLocation: gpsOnly,
            liveStage,
          },
        }),
      );
      return;
    }

    if (liveTrip) {
      window.dispatchEvent(
        new CustomEvent(WAYRA_CONTEXT_EVENT, {
          detail: {
            pathname: "/live",
            wayraScope: "trip",
            trip: liveTrip,
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
    liveTrip,
  ]);

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
      isActiveNavigationStage(liveStage) ||
      liveStage === "solo_drive_command";
    if (!showRoute) return null;

    const mapTarget = destination ?? selectedPlace;
    const origin = routeOrigin;
    if (
      mapTarget &&
      !shouldDrawDriveRouteOnMap({
        travelMode,
        route: activeRoute,
        originLat: origin?.latitude ?? activeRoute.from.lat,
        originLng: origin?.longitude ?? activeRoute.from.lng,
        destLat: mapTarget.lat,
        destLng: mapTarget.lng,
      })
    ) {
      return null;
    }

    return {
      ...activeRoute,
      active: isLiveActive,
    };
  }, [
    activeRoute,
    liveStage,
    isLiveActive,
    destination,
    selectedPlace,
    routeOrigin,
    travelMode,
  ]);

  const routeOriginPin = useMemo(() => {
    if (!routeOrigin || routeOrigin.source === "gps") return null;
    if (routePreviewStatus === "ready" && activeRoute) return null;
    return { lat: routeOrigin.latitude, lng: routeOrigin.longitude };
  }, [routeOrigin, routePreviewStatus, activeRoute]);

  const showAskRoviAi = shouldShowAskRoviAi(locationContext);

  function statusPillLabel(): string {
    if (isLiveActive && isActiveNavigationStage(liveStage)) return "Solo Live · Navigating";
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
    if (isUnroutableOpenWaterPlace(roviTargetPlace)) return null;
    return {
      fromCountry: userRegion?.country ?? null,
      toCountry: roviTargetPlace?.country ?? null,
    };
  }, [locationContext?.countryMismatch, userRegion?.country, roviTargetPlace?.country]);

  const reportTarget = useMemo(() => {
    const target = destination ?? selectedPlace;
    if (target) {
      return {
        lat: target.lat,
        lng: target.lng,
        name: target.name,
        placeKey: target.placeKey ?? null,
      };
    }
    const center = mapRef.current?.getMapCenter() ?? attributionFocus;
    if (!center) return null;
    return {
      lat: center.lat,
      lng: center.lng,
      name: "This area",
      placeKey: null,
    };
  }, [destination, selectedPlace, attributionFocus]);

  const handleOpenReport = useCallback(() => {
    if (!reportTarget) {
      setToast("Move the map to pick a spot first.");
      window.setTimeout(() => setToast(null), 2800);
      return;
    }
    setReportModalOpen(true);
  }, [reportTarget]);

  const handleReportSubmitted = useCallback(
    async (result: { reportType: LivePlaceReportType; confirmed: boolean }) => {
      const label = livePlaceReportLabel(result.reportType);
      setToast(
        result.confirmed ? `${label} confirmed for this spot.` : `Report sent: ${label}.`,
      );
      window.setTimeout(() => setToast(null), 3200);
      if (!reportsLayerEnabled) return;
      const center = mapRef.current?.getMapCenter() ?? attributionFocus;
      if (!center) return;
      const reports = await fetchNearbyLivePlaceReports(center.lat, center.lng);
      setPlaceReports(reports);
    },
    [reportsLayerEnabled, attributionFocus],
  );

  useEffect(() => {
    if (!reportsLayerEnabled) {
      setPlaceReports([]);
      return;
    }
    const center = mapRef.current?.getMapCenter() ?? attributionFocus;
    if (!center) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void fetchNearbyLivePlaceReports(center.lat, center.lng).then((reports) => {
        if (!cancelled) setPlaceReports(reports);
      });
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [reportsLayerEnabled, attributionFocus]);

  const autoFitRouteOnMap =
    !isNavigating &&
    (liveStage === "destination_set" ||
      liveStage === "long_distance_preview" ||
      (isLiveActive && liveStage === "solo_drive_command"));

  return (
    <div
      className="live-page-shell fixed inset-x-0 bottom-0 z-[1] overflow-hidden font-sans select-none transition-all duration-300 ease-in-out"
      style={{ top: "var(--rovvy-header-h, 0px)" }}
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
        votePins={voteMapPins}
        showVotePins={showVotePins}
        onVotePinClick={handleGroupVoteSelect}
        convoyPins={convoyMapPins}
        showConvoyPins={showConvoyPins}
        onConvoyPinClick={handleConvoyPinClick}
        groupConvergeRoutes={groupConvergeRoutes}
        showGroupConvergeRoutes={showGroupConvergeRoutes}
        savedPlaces={visibleSavedPlaces}
        savedPlacesLayerEnabled={savedPlacesLayerEnabled}
        placeReports={placeReports}
        reportsLayerEnabled={reportsLayerEnabled}
        onSavedPlaceSelect={handleSavedPlaceSelect}
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
        onMapReady={handleMapReady}
        onMapMoveEnd={handleMapMoveEndDiscovery}
        discoveryLayerEnabled={discoveryLayerEnabled}
        discoveryLayerPoints={discoveryLayerPoints}
        onDiscoveryPinClick={handleDiscoveryPinClick}
        onDiscoveryClusterClick={handleDiscoveryClusterClick}
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
        onFriendTrackingChange={
          showGroupMockFriends || useRealGroupConverge
            ? handleFriendTrackingChange
            : undefined
        }
        savedPlacesLayerEnabled={savedPlacesLayerEnabled}
        onSavedPlacesLayerChange={handleSavedPlacesLayerChange}
        reportsLayerEnabled={reportsLayerEnabled}
        onReportsLayerChange={handleReportsLayerChange}
        discoveryLayerEnabled={discoveryLayerEnabled}
        onDiscoveryLayerChange={handleDiscoveryLayerChange}
        discoveryLayerZoom={mapZoom}
        discoveryLayerNotice={discoveryLayerNotice}
        onOpenReport={handleOpenReport}
        mapViewMode={mapViewMode}
        onToggleViewMode={handleToggleViewMode}
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled((prev) => !prev)}
        notificationsEnabled={notificationsEnabled}
        onToggleNotifications={() => setNotificationsEnabled((prev) => !prev)}
      />

      <LiveMapNoticeStack>
        {toast ? <LiveMapNoticeToast>{toast}</LiveMapNoticeToast> : null}

        {!isNavigating &&
        liveStage !== "static_landing" &&
        !showSearchPopup &&
        (liveStage === "place_preview" ||
          liveStage === "destination_set" ||
          isLiveActive) ? (
          <LiveMapNoticeStatusPill
            label={statusPillLabel()}
            className={statusPillClass()}
            dotClassName={statusDotClass()}
            dimmed={isMapInteracting}
          />
        ) : null}

        {originPickMode ? (
          <LiveMapNoticeToast>Tap the map to set your starting point</LiveMapNoticeToast>
        ) : null}

        {crossBorderAlert ? (
          <LiveMapCrossBorderNotice
            alert={crossBorderAlert}
            routeHasCrossings={Boolean(activeRoute?.borderCrossings?.length)}
            hasRouteLine={Boolean(activeRoute)}
          />
        ) : null}

        {isGroupConverging && dockStage === "converge" && convergeStatusNotice && !groupConvergeAlertDismissed ? (
          <LiveMapNoticeToast onDismiss={() => setGroupConvergeAlertDismissed(true)}>
            {convergeStatusNotice}
          </LiveMapNoticeToast>
        ) : null}

        {isGroupVoteOpen && dockStage === "vote" && !groupVoteAlertDismissed ? (
          <LiveMapNoticeToast onDismiss={() => setGroupVoteAlertDismissed(true)}>
            {buildVoteOpenedNotice(groupVote.closesAtLabel)}
          </LiveMapNoticeToast>
        ) : null}

        {isSeatShareActive && dockStage === "seat" && seatShareStatusNotice && !seatShareAlertDismissed ? (
          <LiveMapNoticeToast onDismiss={() => setSeatShareAlertDismissed(true)}>
            {seatShareStatusNotice}
          </LiveMapNoticeToast>
        ) : null}

        {isNightFinished && dockStage === "settle" && settleStatusNotice && !settleAlertDismissed ? (
          <LiveMapNoticeToast onDismiss={() => setSettleAlertDismissed(true)}>
            {settleStatusNotice}
          </LiveMapNoticeToast>
        ) : null}
      </LiveMapNoticeStack>

      {/* Click-away backdrop overlay to reduce background interaction and close suggestions/setup panel */}
      {(showSuggestionsCard || showSearchPopup) && (
        <div
          className="fixed inset-0 z-20 cursor-default bg-stone-900/[0.02] backdrop-blur-[0.5px]"
          onClick={() => {
            setShowSuggestionsCard(false);
            setShowSearchPopup(false);
          }}
        />
      )}

      {showLeftDock ? (
        <>
          <LiveDockRail
            activeStage={dockStage}
            panelOpen={dockPanelOpen}
            onStageSelect={handleDockStageSelect}
            onComingSoonStage={(label) => showToast(`${label} — coming in Group Live phase.`)}
            placeAvailable={Boolean(selectedPlace)}
            nearbyAvailable={Boolean(nearbyCategory)}
            convergeAvailable={convergeAvailable}
            voteAvailable={voteAvailable}
            seatAvailable={seatAvailable}
            settleAvailable={settleAvailable}
            dimmed={isMapInteracting}
            darkChrome={isLiveMapDarkChrome(activeLayer)}
          />
          <LiveLeftDock
            stage={dockStage}
            open={dockPanelOpen}
            dimmed={isMapInteracting}
          >
            {dockStage === "categories" ? (
              <LiveDiscoveryCategoryPanel
                selectedKeys={discoveryCategoryKeys}
                mapZoom={mapZoom}
                layerEnabled={discoveryLayerEnabled}
                onToggleKey={handleDiscoveryCategoryToggle}
                onSelectAll={handleDiscoveryCategoriesSelectAll}
                onClearAll={handleDiscoveryCategoriesClear}
                onEnableLayer={() => handleDiscoveryLayerChange(true)}
              />
            ) : null}

            {dockStage === "setup" ? (
              <>
                <LiveSetupPanel
                  travelMode={travelMode}
                  onTravelModeChange={setTravelMode}
                  vehiclePreference={vehiclePreference}
                  onVehiclePreferenceChange={setVehiclePreference}
                  workflowType={workflowType}
                  onWorkflowTypeChange={setWorkflowType}
                  destination={destination}
                  onSetDestination={focusLiveSearch}
                  onAddLocation={handleAddPreviewLocation}
                  onStartDirection={handleStartPreviewDirection}
                  directionReady={routePreviewStatus === "ready" && Boolean(activeRoute)}
                  directionLoading={routeLoading || routePreviewStatus === "loading"}
                  user={user}
                  routePreviewStatus={routePreviewStatus}
                  routeLoading={routeLoading}
                  activeRoute={activeRoute}
                  groupMemberCount={Math.max(groupMembers.length, 1)}
                  onSignIn={() => setShowSignInModal(true)}
                  onStartLive={() => void handleStartLive()}
                  onToast={showToast}
                  onInviteGroup={() =>
                    showToast("Invite the group — coming in Group Live phase.")
                  }
                />

                {!nearbyCategory ? (
                  <LiveDockEmptyStates
                    isOnline={isOnline}
                    gpsStatus={gpsStatus}
                    routePreviewStatus={routePreviewStatus}
                    routePreviewError={routePreviewError}
                    workflowType={workflowType as LiveWorkflowType}
                    onRequestExactLocation={handleLocateClick}
                    onPickMeetPoint={() => {
                      focusLiveSearch();
                      showToast("Pick a meet point on the map or search.");
                    }}
                    onInviteGroup={() =>
                      showToast("Group invites — coming in Group Live phase.")
                    }
                  />
                ) : null}
              </>
            ) : null}

            {dockStage === "vote" && voteAvailable ? (
              <LiveGroupVotePanel
                vote={groupVote}
                statusHint={liveVoteStatusLabel(groupVote.myVoteId, useRealGroupVote)}
                onSelectOption={(optionId) => void handleGroupVoteSelect(optionId)}
                onQuickAction={handleGroupVoteQuickAction}
              />
            ) : null}

            {dockStage === "seat" && seatAvailable ? (
              <LiveSeatSharePanel
                share={seatShareState}
                joinedVehicleId={joinedVehicleId}
                onJoinVehicle={(vehicleId) => void handleJoinVehicle(vehicleId)}
                onAddPickup={handleStartPickupCapture}
                onBroadcastSeats={() => {
                  if (useRealSeatShare) {
                    void liveSeatShare.publishSelf();
                    showToast("Seat broadcast refreshed for your trip.");
                    return;
                  }
                  showToast("Seat broadcast sent to your trip group.");
                }}
              />
            ) : null}

            {dockStage === "settle" && settleAvailable && nightFinishedSummary ? (
              <LiveNightFinishedPanel
                summary={nightFinishedSummary}
                onOpenSplit={() => router.push(splitActivitiesHref(tripId))}
                onMarkEveryoneArrived={() => showToast("Group marked as arrived.")}
                onCheckMember={() => showToast("Nudge sent to late members.")}
                onReportPlace={() => setReportModalOpen(true)}
              />
            ) : null}

            {dockStage === "converge" && isGroupConverging && destination ? (
              <LiveGroupConvergePanel
                destinationName={destination.name}
                members={convergeMembers}
                arrivalBanner={
                  liveGroupArrival.arrivedCount >= 2
                    ? {
                        arrivedCount: liveGroupArrival.arrivedCount,
                        memberCount: liveGroupArrival.memberCount,
                        subline: liveGroupArrival.subline,
                        suggestSettle: liveGroupArrival.suggestNightFinished,
                      }
                    : null
                }
                wayraNotice={groupWayraNotice}
                onMemberAction={(memberId) => {
                  if (memberId === "sam") showToast("Nudge sent to Sam.");
                }}
                onStatusAction={(action) => {
                  if (action === "night_finished") {
                    setIsNightFinished(true);
                    setDockStage("settle");
                    setDockPanelOpen(true);
                    showToast("Night wrapped — settle up in Connect.");
                    return;
                  }
                  if (action === "navigate") {
                    showToast("Your turn-by-turn nav opens in the next Group Live step.");
                    return;
                  }
                  showToast(
                    action === "on_my_way" ? "Group sees you’re on your way." : "Running late noted for the group.",
                  );
                }}
                onWayraAction={(actionId) => {
                  showToast(
                    actionId === "order-drink"
                      ? "Wayra will suggest a drink order for Tomas."
                      : "Table hold moved to 7:40 in the group thread.",
                  );
                }}
              />
            ) : null}

            {dockStage === "nearby" && nearbyCategory && !selectedPlace ? (
              <LiveNearbyList
                categoryKey={resolveLiveSearchCategory(nearbyCategory)?.key ?? nearbyCategory}
                title={getNearbyCategoryTitle(nearbyCategory)}
                categoryLabel={nearbyCategory}
                results={nearbyResults}
                loading={nearbyLoading}
                error={nearbyError}
                searchAnchorHint={searchAnchorHint}
                onClose={handleCloseNearbyResults}
                onSelect={(res) => void handleResultClick(res)}
                onWidenSearch={() => showToast("Widen search — pan the map to explore further.")}
              />
            ) : null}
          </LiveLeftDock>
        </>
      ) : null}

      {/* v3 top-right hero search */}
      {!isNavigating ? (
        <div
          className={`absolute ${LIVE_HERO_SEARCH_TOP} ${LIVE_HERO_SEARCH_RIGHT} z-30 transition-all duration-300 ${
            isMapInteracting
              ? "pointer-events-none translate-y-[-10px] opacity-0"
              : "pointer-events-auto translate-y-0 opacity-100"
          }`}
        >
          <div className="relative w-full" id="search-container">
            <div
              className={
                isLiveMapDarkChrome(activeLayer)
                  ? LIVE_SEARCH_PILL_DARK
                  : LIVE_SEARCH_PILL
              }
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
                    scrollToLiveDock();
                  }}
                  variant={isLiveMapDarkChrome(activeLayer) ? "dark" : "light"}
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
                  placeholder="Search places or meet points"
                  className={`w-full bg-transparent font-sans text-[14.5px] focus:outline-none ${
                    isLiveMapDarkChrome(activeLayer)
                      ? "text-white placeholder:text-slate-400"
                      : "text-[#0F1614] placeholder:text-[#5F665F]"
                  }`}
                />
                {searchLoading ? (
                  <span className="mr-1 shrink-0 text-xs text-slate-400 animate-pulse">Searching…</span>
                ) : null}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSearchPopup((prev) => !prev);
                    setShowSuggestionsCard(false);
                    searchInputRef.current?.focus();
                  }}
                  className={`flex h-[34px] shrink-0 cursor-pointer items-center justify-center rounded-full px-4 text-xs font-semibold transition-all ${
                    showSearchPopup
                      ? "bg-[#DCEAE5] text-primary shadow-sm"
                      : "bg-[#DCEAE5] text-primary hover:brightness-[1.04]"
                  }`}
                >
                  Suggestions
                </button>
              </div>

              {/* Unified search dropdown — instant picks + API results */}
              {showSearchPopup ? (
                <div className={`absolute left-0 right-0 top-full z-40 mt-2 max-h-72 overflow-auto live-panel-enter ${LIVE_SEARCH_DROPDOWN}`}>
                  {detectedSearchCategory ? (
                    <div className="border-b border-stone-100/80 p-1.5">
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 rounded-xl bg-primary-soft/80 px-3 py-2.5 text-left transition-colors hover:bg-primary-soft/70"
                        onClick={() => void handleNearbySearch(detectedSearchCategory.key)}
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-lg shadow-sm">
                          {detectedSearchCategory.icon}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-primary">
                            {detectedSearchCategory.label}
                          </span>
                          <span className="block text-xs text-stone-500">
                            {isExactCategoryQuery(searchQuery)
                              ? `Show up to ${nearbyResultLimitForScreen()} on map · tap or Enter`
                              : "No exact place match — category search nearby"}
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
                      <p className={`px-2.5 py-1 ${LIVE_SECTION_LABEL}`}>
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
                      <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-stone-200 border-t-[#0E6E5C]" />
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

                        const poiPlace = {
                          categoryLabel: result.category,
                          name: result.name,
                        };
                        const landmark = isLandmarkPlace(poiPlace);

                        return (
                          <li key={result.id}>
                            <button
                              type="button"
                              className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-stone-50/80"
                              onClick={() => {
                                void selectPlace(result);
                              }}
                            >
                              <span
                                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F1EFE8] ${
                                  landmark ? "ring-1 ring-amber-300/70" : ""
                                }`}
                              >
                                <LivePoiRowIcon place={poiPlace} />
                              </span>
                              <span className="min-w-0">
                                <span className="block text-sm font-medium text-stone-800 line-clamp-1">
                                  {result.name}
                                </span>
                                {subtitle ? (
                                  <span className="mt-0.5 block text-xs font-medium text-primary line-clamp-1">
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
          onAskRovi={handleAskWayraFromPreview}
          onSearchNearMe={handleSearchNearMe}
          onChangeDestination={clearSelectedPlace}
          onPlanTrip={handlePlanTrip}
          onContinueAnyway={handleContinueAnyway}
          onClose={clearSelectedPlace}
        />
      ) : null}

      {showPlacePreview && selectedPlace && placePanelSeed ? (
        <LivePlacePanelHost
          seed={placePanelSeed}
          preview={placePanelPreview}
          open
          distance={placePanelDistance}
          groupSize={6}
          inPlan={selectedPlaceSaved}
          stackAboveRouteSummary={showRouteSummaryBar}
          immersive={liveImmersive}
          wayraChatOpen={wayraChatOpen}
          liveChrome={{
            preview: selectedPlace,
            mapZoom,
            locationContext,
            aiSuggestions: placePanelAiSuggestions,
            vehiclePreference,
            onVehiclePreferenceChange: setVehiclePreference,
            onPutToVote: () => showToast("Put to vote — coming in Group Live phase."),
            onInviteGroup: () => showToast("Invite the group — coming in Group Live phase."),
            onAddLocation: handleAddPreviewLocation,
            onStartDirection: handleStartPreviewDirection,
            directionReady: routePreviewStatus === "ready" && Boolean(activeRoute),
            directionLoading: routeLoading || routePreviewStatus === "loading",
            onOpenTravelTab: () => handleOpenTravelTab("plan"),
          }}
          onClose={handleClosePlaceDetails}
          onDirections={handleGetDirections}
          onTogglePlan={handleAddPreviewLocation}
          onAskGroup={handleAskWayraFromPreview}
          onHoldSeats={() => showToast("Hold seats — booking API coming soon.")}
          onReviewFirst={() => showToast("Review it first — coming soon.")}
          onAddHours={() => showToast("Add hours — operator claim coming soon.")}
          onAskTier1={handleAskWayraFromPreview}
          onSuggestEdit={() => showToast("Suggest an edit — coming soon.")}
        />
      ) : null}

      {activeSavedPlaceId ? (
        <SavedPlacePanel
          placeId={activeSavedPlaceId}
          onClose={() => setActiveSavedPlaceId(null)}
          wayraChatOpen={wayraChatOpen}
        />
      ) : null}

      {showRouteSummaryBar && routeSummaryPlace ? (
        <LiveRouteSummaryBar
          destinationName={routeSummaryPlace.name}
          durationSeconds={activeRoute?.durationSeconds ?? null}
          routePreviewStatus={routePreviewStatus}
          routeLoading={routeLoading}
          identifying={loadingPlaceDetails}
          travelMode={travelMode}
          routeLastMileNotice={activeRoute?.lastMileNotice ?? null}
          routeBorderNotice={activeRoute?.borderNotice ?? null}
          routeLastMileMode={activeRoute?.lastMileMode ?? null}
          onOpenDetails={() => setShowPlaceDetailsPanel(true)}
          onGo={liveStage === "destination_set" ? handleStartSoloLive : handleGetDirections}
          onClose={liveStage === "destination_set" ? handleChangeDestination : clearSelectedPlace}
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
          onSelectOption={handleSelectRouteIntelligenceOption}
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
            onEdit={scrollToLiveDock}
          />
        </div>
      )}

      {reportTarget ? (
        <LiveReportModal
          open={reportModalOpen}
          onClose={() => setReportModalOpen(false)}
          placeName={reportTarget.name}
          lat={reportTarget.lat}
          lng={reportTarget.lng}
          placeKey={reportTarget.placeKey}
          onAuthRequired={() => {
            setReportModalOpen(false);
            setShowSignInModal(true);
          }}
          onSubmitted={(result) => {
            void handleReportSubmitted(result);
          }}
        />
      ) : null}

      {/* Inline Sign-In Modal */}
      <InlineSignInModal
        isOpen={showSignInModal}
        onClose={() => setShowSignInModal(false)}
      />
    </div>
  );
}
