"use client";

import { useState, useEffect, type CSSProperties } from "react";
import {
  Bookmark,
  MapPin,
  Search,
  Users,
  X,
  ChevronUp,
  ChevronDown,
  Navigation,
} from "lucide-react";
import { apiFetch } from "@/lib/safe-fetch";
import type { LiveLocationContext } from "./live-location-context";
import type { PlaceMediaItem } from "./live-place-media";
import PlacePreviewMedia from "./PlacePreviewMedia";
import RoviPlaceExplanationBlock from "./RoviPlaceExplanationBlock";
import type { RoviPlaceExplanation } from "./live-rovi";
import { LIVE_PANEL_RIGHT_INSET, LIVE_SHEET_BOTTOM_ABOVE_ROUTE, LIVE_SHEET_BOTTOM_DEFAULT, LIVE_SHEET_BOTTOM_DESKTOP, LIVE_SHEET_BOTTOM_IMMERSIVE, LIVE_PANEL_MAX_WIDTH } from "./live-layout";
import { buildLivePreviewPanelFrameStyle } from "./live-panel-size";
import { useLivePreviewPanelResize } from "./use-live-preview-panel-resize";
import {
  LIVE_GLASS_SHEET,
  LIVE_GLASS_SIDE_PANEL,
  LIVE_PANEL_MOTION,
  LIVE_PLACE_TITLE,
} from "./live-design-tokens";
import { logRovvyLiveWarn } from "./live-gps";
import {
  formatDistanceMiles,
  formatRouteDuration,
  isActiveNavigationStage,
  isFarFromUser,
  type LiveStage,
  type RouteAlternative,
  type RoutePreviewStatus,
  type VehiclePreference,
  VEHICLE_PREFERENCE_OPTIONS,
} from "./live-types";
import PlaceWikiAboutSection from "./PlaceWikiAboutSection";
import { LiveDataTrustBadge, LiveDataTrustFooter } from "./LiveDataTrustBadge";
import { LIVE_DATA_DISCLAIMER } from "./wiki-about-display";
import LiveAiSuggestionsBlock from "./LiveAiSuggestionsBlock";
import { buildRoutePreviewAiSuggestions } from "./live-ai-suggestions";
import {
  formatOpeningHoursLabel,
  formatPlaceSubtitle,
  getPlaceLocationFields,
} from "./live-place-display";
import { useLivePlaceDisplayName } from "./live-place-name-i18n";
import { isGenericPlaceName } from "@/lib/wayra/place-region";

const TEAL = "#0F766E";

function PlacePreviewTitle({
  name,
  nameSourceLanguage,
  className,
}: {
  name: string;
  nameSourceLanguage?: string | null;
  className?: string;
}) {
  return (
    <div className="flex min-w-0 max-w-full flex-wrap items-center gap-1.5">
      <h3 className={`min-w-0 max-w-full truncate ${className ?? ""}`}>{name}</h3>
      {nameSourceLanguage ? (
        <span
          className="inline-flex shrink-0 items-center rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-stone-500"
          title={`Latin spelling of ${nameSourceLanguage} name`}
        >
          {nameSourceLanguage}
        </span>
      ) : null}
    </div>
  );
}

function PlaceHoursNote({ hoursLabel }: { hoursLabel: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-stone-500">{hoursLabel}</p>
      <p className="mt-0.5 text-[10px] text-stone-400">Hours from map data — not live-verified</p>
    </div>
  );
}

function NearbyHereHeader() {
  return (
    <div className="mb-2 space-y-1">
      <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">Nearby here</p>
      <LiveDataTrustBadge variant="verified" />
    </div>
  );
}

export type PlacePreviewData = {
  name: string;
  categoryLabel: string;
  address: string;
  phone: string | null;
  lat: number;
  lng: number;
  distanceM: number | null;
  openingHours: string | null;
  openStatus: string | null;
  placeKey?: string;
  osmType?: string | null;
  osmId?: number | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postcode?: string | null;
  continent?: string | null;
  terrainHint?: string | null;
  mapPresenceNote?: string | null;
  coordinatesLabel?: string | null;
  source?: string;
  tags?: any;
  /** Original non-Latin label when name was transliterated for display. */
  nameOriginal?: string | null;
  /** Human-readable source language, e.g. "Russian". */
  nameSourceLanguage?: string | null;
  nameTranslated?: boolean;
};

type Props = {
  place: PlacePreviewData;
  loadingDetails: boolean;
  placeMedia?: PlaceMediaItem[];
  placeMediaLoading?: boolean;
  placeTags?: string[];
  hasUserLocation?: boolean;
  dataSource?: "osm" | "limited";
  locationContext?: LiveLocationContext | null;
  showAskRovi?: boolean;
  roviLoading?: boolean;
  roviExplanation?: RoviPlaceExplanation | null;
  roviError?: string | null;
  onAskRovi?: () => void;
  onSearchNearMe?: () => void;
  onChangeDestination?: () => void;
  onPlanTrip?: () => void;
  onContinueAnyway?: () => void;
  onClose: () => void;
  onSavePlace: () => void;
  onAddStop: () => void;
  onAddToTrip: () => void;
  onCreateMeetPoint: () => void;
  onMakeDestination: () => void;
  onGetDirections: () => void;
  onStartLive: () => void;
  routePreviewStatus?: RoutePreviewStatus;
  routeLoading?: boolean;
  routePreviewError?: string | null;
  routeDurationSeconds?: number | null;
  routeDistanceMeters?: number | null;
  routeLastMileNotice?: string | null;
  routeBorderNotice?: string | null;
  routeLastMileMode?: "walk" | null;
  travelMode?: string;
  nearbyPlacesAtClick?: PlacePreviewData[] | null;
  onSelectNearbyPlaceAtClick?: (place: PlacePreviewData) => void;
  liveStage?: LiveStage;
  /** When true, lift the sheet above the route summary bar on small screens. */
  stackAboveRouteSummary?: boolean;
  /** Live immersive map — tab bar hidden, sheet sits on lower attribution strip. */
  immersive?: boolean;
  /** When opened from a category nearby search (e.g. waterfalls). */
  previewContext?: { icon: string; searchLabel: string } | null;
  /** Wayra chat column is open — shift card left on desktop. */
  wayraChatOpen?: boolean;
  /** Compact header-only mode while chat is open. */
  compact?: boolean;
  onToggleCompact?: () => void;
  /** True when this stop is already on the user's local saved map. */
  placeSaved?: boolean;
  /** Add location + start direction actions from Live preview card. */
  onAddLocation?: () => void;
  onStartDirection?: () => void;
  directionReady?: boolean;
  directionLoading?: boolean;
  routeAlternatives?: RouteAlternative[];
  selectedRouteAlternativeId?: string | null;
  onSelectRouteAlternative?: (id: string) => void;
  vehiclePreference?: VehiclePreference;
  onVehiclePreferenceChange?: (value: VehiclePreference) => void;
  onOpenTravelTab?: () => void;
};

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia(query);
    const listener = () => setMatches(media.matches);
    listener();
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [query]);

  return matches;
}

function usePlatform(isDrivingMode: boolean): "ios" | "android" | "carplay" | "web" {
  const [platform, setPlatform] = useState<"ios" | "android" | "carplay" | "web">("web");

  useEffect(() => {
    if (isDrivingMode) {
      setPlatform("carplay");
      return;
    }
    if (typeof window === "undefined" || typeof navigator === "undefined") {
      setPlatform("web");
      return;
    }
    const ua = navigator.userAgent || "";
    if (/iPad|iPhone|iPod/.test(ua)) {
      setPlatform("ios");
    } else if (/Android/.test(ua)) {
      setPlatform("android");
    } else {
      setPlatform("web");
    }
  }, [isDrivingMode]);

  return platform;
}

function QuickActionIOS({
  icon: Icon,
  label,
  onClick,
  active = false,
}: {
  icon: typeof MapPin;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
        active
          ? "bg-teal-50 text-primary"
          : "bg-stone-100/60 text-stone-850 hover:bg-stone-200/60"
      }`}
    >
      <Icon className={`h-3.5 w-3.5 ${active ? "fill-current text-primary" : "text-primary"}`} />
      {label}
    </button>
  );
}

function QuickActionAndroid({
  icon: Icon,
  label,
  onClick,
  active = false,
}: {
  icon: typeof MapPin;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
        active
          ? "border-primary/35 bg-teal-50 text-primary"
          : "border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
      }`}
    >
      <Icon className={`h-3.5 w-3.5 ${active ? "fill-current" : "text-stone-500"}`} />
      {label}
    </button>
  );
}

export default function PlacePreviewCard({
  place,
  loadingDetails,
  hasUserLocation = false,
  dataSource = "osm",
  locationContext = null,
  showAskRovi = false,
  roviLoading = false,
  roviExplanation = null,
  roviError = null,
  onAskRovi,
  onSearchNearMe,
  onChangeDestination,
  onPlanTrip,
  onContinueAnyway,
  onClose,
  onSavePlace,
  onAddStop,
  onAddToTrip,
  onCreateMeetPoint,
  onMakeDestination,
  onGetDirections,
  onStartLive,
  routePreviewStatus = "idle",
  routeLoading = false,
  routePreviewError = null,
  routeDurationSeconds = null,
  routeDistanceMeters = null,
  routeLastMileNotice = null,
  routeBorderNotice = null,
  routeLastMileMode = null,
  travelMode = "Drive",
  nearbyPlacesAtClick = null,
  onSelectNearbyPlaceAtClick,
  placeMedia = [],
  placeMediaLoading = false,
  placeTags = [],
  liveStage = "static_landing",
  stackAboveRouteSummary = true,
  immersive = false,
  previewContext = null,
  wayraChatOpen = false,
  compact = false,
  onToggleCompact,
  placeSaved = false,
  onAddLocation,
  onStartDirection,
  directionReady = false,
  directionLoading = false,
  routeAlternatives = [],
  selectedRouteAlternativeId = null,
  onSelectRouteAlternative,
  vehiclePreference = "private",
  onVehiclePreferenceChange,
  onOpenTravelTab,
}: Props) {
  const [wikiSummary, setWikiSummary] = useState<{
    available: boolean;
    summary?: string;
    url?: string;
    title?: string;
    attribution?: string;
    matchedOn?: string;
    approximate?: boolean;
  } | null>(null);
  const [wikiLoading, setWikiLoading] = useState(false);
  const [wikiExpanded, setWikiExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<"guide" | "about" | "info">("guide");
  const displayPlace = useLivePlaceDisplayName(place);
  const previewTitleName =
    loadingDetails && isGenericPlaceName(displayPlace.name)
      ? "Finding this place…"
      : displayPlace.name;

  useEffect(() => {
    setActiveTab("guide");
    setWikiExpanded(false);
  }, [place.lat, place.lng, place.name]);

  useEffect(() => {
    setWikiSummary(null);
    setWikiExpanded(false);

    const wikidataId = place.tags?.wikidata;
    const wikipediaTitle = place.tags?.wikipedia;
    const isMapPick = place.source === "map_pick" || place.source === "map_click";

    if (
      !isMapPick &&
      !wikidataId &&
      !wikipediaTitle &&
      !place.city &&
      ![
        "Landmark", "Attraction", "Museum", "Park", "Historic site", "Hotel",
        "Airport", "Helipad", "Beach", "Port", "Marina", "Ferry terminal", "Cinema",
        "University", "Church / Place of worship", "Stadium", "Monument",
        "Village", "Town", "City", "Hamlet", "Location",
      ].includes(place.categoryLabel)
    ) {
      return;
    }

    if (place.name === "Dropped pin" || !place.name) {
      return;
    }

    const fetchWiki = async () => {
      setWikiLoading(true);
      try {
        const query = new URLSearchParams({
          name: place.name,
          category: place.categoryLabel,
          lat: place.lat.toString(),
          lng: place.lng.toString(),
        });
        if (wikidataId) query.append("wikidata_id", wikidataId);
        if (wikipediaTitle) query.append("wikipedia_title", wikipediaTitle);
        if (place.city) query.append("city", place.city);
        if (place.state) query.append("state", place.state);
        if (place.country) query.append("country", place.country);
        if (place.source) query.append("source", place.source);

        const res = await apiFetch<{
          available: boolean;
          summary?: string;
          url?: string;
          title?: string;
          attribution?: string;
          matchedOn?: string;
          approximate?: boolean;
        }>(`/places/wiki-summary?${query.toString()}`);
        setWikiSummary(res);
      } catch (err) {
        logRovvyLiveWarn("Wiki fetch failed", err);
        setWikiSummary({ available: false });
      } finally {
        setWikiLoading(false);
      }
    };

    fetchWiki();
  }, [
    place.name,
    place.categoryLabel,
    place.lat,
    place.lng,
    place.city,
    place.state,
    place.country,
    place.source,
    place.tags,
  ]);

  const isMobile = useMediaQuery("(max-width: 599px)");
  const isPhoneLayout = useMediaQuery("(max-width: 767px)");

  const isDrivingMode =
    isActiveNavigationStage(liveStage) || liveStage === "solo_drive_command";

  const platform = usePlatform(isDrivingMode);

  const hoursLabel = formatOpeningHoursLabel(place);
  const sourceLabel =
    dataSource === "osm"
      ? "Place data from OpenStreetMap / Rovvy Places"
      : "Place data source limited";

  const subheaderText =
    loadingDetails && isGenericPlaceName(displayPlace.name)
      ? "Looking up address…"
      : displayPlace.name === "Dropped pin"
        ? "Selected location"
        : formatPlaceSubtitle(displayPlace);
  const locationFields = getPlaceLocationFields(place);

  const routeReady = routePreviewStatus === "ready" && routeDurationSeconds != null;
  const routeDurationLabel =
    routeReady && routeDurationSeconds != null
      ? formatRouteDuration(routeDurationSeconds)
      : "";

  const isDroppedPinOrAddress =
    place.source === "dropped_pin" ||
    (place.source === "nominatim" && place.categoryLabel === "Address");

  const contextNotice =
    locationContext && locationContext.classification !== "local_place"
      ? locationContext.template?.recommendation
      : null;

  const aiSuggestions = buildRoutePreviewAiSuggestions({
    destinationName: displayPlace.name,
    farFromUser: isFarFromUser(place.distanceM),
    contextNotice,
    terrainHint: place.terrainHint,
    lastMileNotice:
      routeReady && routeLastMileMode === "walk" ? routeLastMileNotice : null,
    borderNotice: routeReady ? routeBorderNotice : null,
    routeError:
      routePreviewStatus === "failed" && routePreviewError
        ? routePreviewError
        : null,
  });

  const isDesktop = useMediaQuery("(min-width: 768px)");
  const canResizePanel = isDesktop && !compact && platform !== "carplay";
  const { size: panelSize, onResizePointerDown } = useLivePreviewPanelResize(canResizePanel);

  const sheetBottomVar = isDesktop
    ? LIVE_SHEET_BOTTOM_DESKTOP
    : stackAboveRouteSummary
      ? LIVE_SHEET_BOTTOM_ABOVE_ROUTE
      : immersive
        ? LIVE_SHEET_BOTTOM_IMMERSIVE
        : LIVE_SHEET_BOTTOM_DEFAULT;

  const useViewportFrame = platform !== "carplay";
  const panelChromeStyle: CSSProperties = useViewportFrame
    ? buildLivePreviewPanelFrameStyle({
        sheetBottom: sheetBottomVar,
        isPhoneLayout,
        wayraChatOpen: Boolean(wayraChatOpen),
        isDesktop,
        size: panelSize,
      })
    : {};

  const surfaceClass = isPhoneLayout
    ? `${LIVE_GLASS_SHEET} ${LIVE_PANEL_MOTION}`
    : `${LIVE_GLASS_SIDE_PANEL} ${LIVE_PANEL_MOTION}`;

  // CarPlay keeps legacy class-based layout
  let layoutClass = "";
  if (platform === "carplay") {
    if (isMobile) {
      layoutClass =
        "fixed inset-x-0 bottom-0 z-30 rounded-t-2xl border border-stone-200 bg-white shadow-2xl flex flex-col justify-between p-4 pb-6";
    } else {
      layoutClass =
        `fixed bottom-4 left-auto ${LIVE_PANEL_RIGHT_INSET} z-30 ${LIVE_PANEL_MAX_WIDTH} rounded-xl border border-stone-200 bg-white shadow-2xl flex flex-col justify-between p-4`;
    }
  }

  function PanelResizeHandles() {
    if (!canResizePanel) return null;
    return (
      <>
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize panel width"
          title="Drag to resize width"
          className="absolute left-0 top-3 bottom-3 z-20 w-1.5 cursor-ew-resize rounded-full bg-stone-200/80 hover:bg-primary/40"
          onPointerDown={onResizePointerDown("width")}
        />
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize panel height"
          title="Drag to resize height"
          className="absolute left-3 right-3 top-0 z-20 h-1.5 cursor-ns-resize rounded-full bg-stone-200/80 hover:bg-primary/40"
          onPointerDown={onResizePointerDown("height")}
        />
      </>
    );
  }

  function PhoneSheetHandle() {
    if (!isPhoneLayout) return null;
    return (
      <div
        className="mx-auto my-2 h-1 w-10 shrink-0 rounded-full bg-stone-300/90"
        aria-hidden
      />
    );
  }

  const hasNoPhotos = !placeMediaLoading && (!placeMedia || placeMedia.length === 0);
  const mediaMaxHeightClass = "max-h-[8rem]";

  function handlePreviewCardActivate() {
    onMakeDestination();
  }

  const previewPlaceActions = (
    <PreviewPlaceActionRow
      onAddLocation={onAddLocation ?? onSavePlace}
      onStartDirection={onStartDirection ?? onGetDirections}
      directionReady={directionReady}
      directionLoading={directionLoading}
      routeAlternatives={routeAlternatives}
      selectedRouteAlternativeId={selectedRouteAlternativeId}
      onSelectRouteAlternative={onSelectRouteAlternative}
      vehiclePreference={vehiclePreference}
      onVehiclePreferenceChange={onVehiclePreferenceChange}
      onOpenTravelTab={onOpenTravelTab}
      showPublicTransportHint={vehiclePreference === "public"}
    />
  );

  // --- 1. CarPlay / Tab Mode Layout ---
  if (platform === "carplay") {
    return (
      <div
        className={layoutClass}
        role="dialog"
        aria-label="Driving destination select"
      >
        <div className="flex-1 flex flex-col justify-between gap-3">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <PlacePreviewTitle
                name={previewTitleName}
                nameSourceLanguage={displayPlace.nameSourceLanguage}
                className="text-base font-bold text-stone-900 leading-tight truncate"
              />
              <p className="text-xs font-semibold text-stone-500 truncate mt-0.5">
                {subheaderText}
              </p>
              {routeReady ? (
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-semibold text-primary">
                    {routeDurationLabel}
                  </span>
                  {routeDistanceMeters != null ? (
                    <span className="text-[11px] text-stone-500">
                      {formatDistanceMiles(routeDistanceMeters)} · {travelMode}
                    </span>
                  ) : (
                    <span className="text-[11px] text-stone-500">{travelMode}</span>
                  )}
                </div>
              ) : null}
            </div>

            {/* Small Quick Action Boxes on the right */}
            <div className="flex items-center gap-1 shrink-0">
              {!isDroppedPinOrAddress && (
                <button
                  type="button"
                  onClick={onAddStop}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-600 hover:bg-stone-50 active:scale-90 transition-all"
                  title="Add Stop"
                >
                  <MapPin className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={onSavePlace}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-600 hover:bg-stone-50 active:scale-90 transition-all"
                title="Save Place"
              >
                <Bookmark className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onCreateMeetPoint}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-600 hover:bg-stone-50 active:scale-90 transition-all"
                title="Create Meet Point"
              >
                <Users className="h-4 w-4" />
              </button>
              {onSearchNearMe && (
                <button
                  type="button"
                  onClick={onSearchNearMe}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-600 hover:bg-stone-50 active:scale-90 transition-all"
                  title="Search Nearby"
                >
                  <Search className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-500 hover:bg-stone-200 hover:text-stone-800 transition-colors ml-1"
                aria-label="Close preview"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Bottom actions */}
          <div className="flex shrink-0 flex-col gap-2">
            {onAskRovi ? (
              <button
                type="button"
                onClick={onAskRovi}
                className="h-10 rounded-lg border border-primary/30 bg-teal-50/50 px-3 text-xs font-bold text-primary hover:bg-teal-50 active:scale-95 transition-all flex items-center justify-center gap-1.5"
              >
                Ask Wayra
              </button>
            ) : null}
            {previewPlaceActions}
          </div>
        </div>
      </div>
    );
  }

  // --- 2. iOS Layout ---
  if (platform === "ios") {
    return (
      <div
        className={`${surfaceClass} relative flex flex-col overflow-hidden font-sans`}
        style={panelChromeStyle}
        role="dialog"
        aria-label="Place details (iOS)"
      >
        <PanelResizeHandles />
        <PhoneSheetHandle />
        {/* iOS pill drag handle */}
        <div className="w-9 h-1 bg-stone-300/80 rounded-full mx-auto my-2.5 shrink-0" aria-hidden />

        <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar px-4 pt-1 pb-2">
          {/* Header */}
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              {previewContext ? (
                <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-bold text-primary">
                  <span aria-hidden>{previewContext.icon}</span>
                  {previewContext.searchLabel}
                </span>
              ) : null}
              <PlacePreviewTitle
                name={previewTitleName}
                nameSourceLanguage={displayPlace.nameSourceLanguage}
                className="text-lg font-bold tracking-tight text-stone-900 leading-tight"
              />
              <p className="mt-0.5 text-xs text-stone-500 font-medium">{subheaderText}</p>
              {routeReady ? (
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">
                    {routeDurationLabel}
                  </span>
                  {routeDistanceMeters != null ? (
                    <span className="text-xs text-stone-500 font-medium">
                      {formatDistanceMiles(routeDistanceMeters)} · {travelMode}
                    </span>
                  ) : (
                    <span className="text-xs text-stone-500 font-medium">{travelMode}</span>
                  )}
                </div>
              ) : null}
            </div>
            {/* iOS System close button */}
            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-stone-200/60 text-stone-600 hover:bg-stone-200"
              aria-label="Close details"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* iOS Segmented Control */}
          <div className="bg-stone-200/50 p-0.5 rounded-lg flex mt-3.5 mb-3 text-xs font-semibold text-stone-600">
            {(["guide", "about", "info"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-1 text-center rounded-md transition-all ${
                  activeTab === tab
                    ? "bg-white text-stone-955 shadow-sm"
                    : "text-stone-500 hover:text-stone-800"
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {/* Tab Contents */}
          {activeTab === "guide" && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-800">
                  AI estimate
                </span>
                <span className="text-[10px] text-stone-500">Route tips from map context</span>
              </div>
              <LiveAiSuggestionsBlock
                suggestions={aiSuggestions}
                destinationName={displayPlace.name}
                showEmptyState
                className="mt-1"
              />

              {(routeLoading || routePreviewStatus === "loading") && routePreviewStatus !== "idle" ? (
                <div className="rounded-xl border border-teal-100 bg-teal-50/70 px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-teal-800">
                    {travelMode} route preview
                  </p>
                  <p className="mt-1 text-xs text-stone-600">
                    Calculating your {travelMode.toLowerCase()} route…
                  </p>
                </div>
              ) : null}

              {!isDroppedPinOrAddress && hoursLabel ? (
                <PlaceHoursNote hoursLabel={hoursLabel} />
              ) : null}
            </div>
          )}

          {activeTab === "about" && (
            <div className="space-y-3">
              {!isDroppedPinOrAddress && !hasNoPhotos ? (
                <div className={`overflow-hidden rounded-xl ${mediaMaxHeightClass}`}>
                  <PlacePreviewMedia
                    media={placeMedia}
                    categoryLabel={place.categoryLabel}
                    loading={placeMediaLoading}
                  />
                </div>
              ) : null}

              <PlaceWikiAboutSection
                wikiLoading={wikiLoading}
                wikiSummary={wikiSummary}
                placeName={previewTitleName}
                city={place.city}
                wikiExpanded={wikiExpanded}
                onExpand={() => setWikiExpanded(true)}
              />

              {locationContext && locationContext.classification !== "local_place" ? (
                <div className="space-y-2">
                  <LiveDataTrustBadge variant="ai" />
                  <RoviPlaceExplanationBlock
                  compact
                  showAskButton={showAskRovi}
                  showSafetyActions={!locationContext.liveSafe}
                  template={null}
                  loading={roviLoading}
                  explanation={roviExplanation}
                  error={roviError}
                  onAskRovi={onAskRovi!}
                  onSearchNearMe={onSearchNearMe!}
                  onChangeDestination={onChangeDestination!}
                  onPlanTrip={onPlanTrip!}
                  onContinueAnyway={onContinueAnyway ?? onMakeDestination}
                  showContinueAnyway={Boolean(onContinueAnyway)}
                />
                </div>
              ) : null}
            </div>
          )}

          {activeTab === "info" && (
            <div className="space-y-3">
              {place.mapPresenceNote || locationFields.length > 0 || place.coordinatesLabel ? (
                <div className="rounded-xl border border-stone-100 bg-white/50 px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">
                    Location context
                  </p>
                  {place.mapPresenceNote ? (
                    <p className="mt-1 text-xs leading-snug text-stone-700">{place.mapPresenceNote}</p>
                  ) : null}
                  {place.coordinatesLabel ? (
                    <p className="mt-1 font-mono text-[10px] text-stone-600">{place.coordinatesLabel}</p>
                  ) : null}
                  <dl className="mt-2 space-y-1 text-xs text-stone-600">
                    {locationFields.map((field) => (
                      <div key={`${field.label}-${field.value}`} className="flex gap-2">
                        <dt className="w-16 shrink-0 text-stone-400 font-medium">{field.label}</dt>
                        <dd className="min-w-0 font-medium">{field.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ) : null}

              {nearbyPlacesAtClick && nearbyPlacesAtClick.length > 0 ? (
                <div>
                  <NearbyHereHeader />
                  <ul className="space-y-1">
                    {nearbyPlacesAtClick.slice(0, 3).map((poi) => (
                      <li key={poi.placeKey || poi.name}>
                        <button
                          type="button"
                          onClick={() => onSelectNearbyPlaceAtClick?.(poi)}
                          className="flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left hover:bg-white/60"
                        >
                          <span className="truncate text-xs font-semibold text-stone-850">{poi.name}</span>
                          <span className="ml-2 shrink-0 text-[10px] font-bold text-primary">
                            {poi.distanceM != null ? formatDistanceMiles(poi.distanceM) : ""}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="space-y-1 border-t border-stone-100/50 pt-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                    Verified source
                  </span>
                  <span className="text-[10px] text-stone-400">{sourceLabel}</span>
                </div>
                <p className="text-[10px] leading-snug text-stone-500">{LIVE_DATA_DISCLAIMER}</p>
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 z-10 shrink-0 border-t border-stone-100/50 bg-white/90 backdrop-blur-md px-4 py-3 shadow-[0_-6px_16px_rgba(0,0,0,0.04)]">
          {previewPlaceActions}
        </div>
      </div>
    );
  }

  // --- 3. Android Layout ---
  if (platform === "android") {
    return (
      <div
        className={`${surfaceClass} relative flex flex-col overflow-hidden font-sans`}
        style={panelChromeStyle}
        role="dialog"
        aria-label="Place details (Android)"
      >
        <PanelResizeHandles />
        <PhoneSheetHandle />
        {/* Material drag handle */}
        <div className="w-12 h-1 bg-stone-300 rounded-full mx-auto my-3 shrink-0" aria-hidden />

        <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar px-4 pt-1 pb-2">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              {previewContext ? (
                <span className="mb-1 inline-flex items-center gap-1 rounded-md bg-primary-soft px-2 py-0.5 text-[10px] font-bold text-primary">
                  <span aria-hidden>{previewContext.icon}</span>
                  {previewContext.searchLabel}
                </span>
              ) : null}
              <PlacePreviewTitle
                name={previewTitleName}
                nameSourceLanguage={displayPlace.nameSourceLanguage}
                className="text-lg font-bold text-stone-900 leading-tight"
              />
              <p className="mt-0.5 text-xs text-stone-500">{subheaderText}</p>
              {routeReady ? (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center rounded-md bg-primary-soft px-2.5 py-0.5 text-xs font-semibold text-primary">
                    {routeDurationLabel}
                  </span>
                  {routeDistanceMeters != null ? (
                    <span className="text-xs text-stone-600">
                      {formatDistanceMiles(routeDistanceMeters)} · {travelMode}
                    </span>
                  ) : (
                    <span className="text-xs text-stone-600">{travelMode}</span>
                  )}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100"
              aria-label="Close details"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Material You tabs */}
          <div className="flex border-b border-stone-200 mt-4 mb-3 text-sm font-semibold text-stone-600">
            {(["guide", "about", "info"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 text-center relative transition-all ${
                  activeTab === tab
                    ? "text-primary"
                    : "text-stone-500 hover:text-stone-800"
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                {activeTab === tab && (
                  <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-primary rounded-t-full" />
                )}
              </button>
            ))}
          </div>

          {/* Tab Contents */}
          {activeTab === "guide" && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-800">
                  AI estimate
                </span>
                <span className="text-[10px] text-stone-500">Route tips from map context</span>
              </div>
              <LiveAiSuggestionsBlock
                suggestions={aiSuggestions}
                destinationName={displayPlace.name}
                showEmptyState
                className="mt-1"
              />

              {(routeLoading || routePreviewStatus === "loading") && routePreviewStatus !== "idle" ? (
                <div className="rounded-lg border border-teal-100 bg-teal-50 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-teal-800">
                    {travelMode} route preview
                  </p>
                  <p className="mt-1 text-xs text-stone-600">
                    Calculating your {travelMode.toLowerCase()} route…
                  </p>
                </div>
              ) : null}

              {!isDroppedPinOrAddress && hoursLabel ? (
                <PlaceHoursNote hoursLabel={hoursLabel} />
              ) : null}
            </div>
          )}

          {activeTab === "about" && (
            <div className="space-y-3">
              {!isDroppedPinOrAddress && !hasNoPhotos ? (
                <div className={`overflow-hidden rounded-lg ${mediaMaxHeightClass}`}>
                  <PlacePreviewMedia
                    media={placeMedia}
                    categoryLabel={place.categoryLabel}
                    loading={placeMediaLoading}
                  />
                </div>
              ) : null}

              <PlaceWikiAboutSection
                wikiLoading={wikiLoading}
                wikiSummary={wikiSummary}
                placeName={previewTitleName}
                city={place.city}
                wikiExpanded={wikiExpanded}
                onExpand={() => setWikiExpanded(true)}
              />

              {locationContext && locationContext.classification !== "local_place" ? (
                <div className="space-y-2">
                  <LiveDataTrustBadge variant="ai" />
                  <RoviPlaceExplanationBlock
                  compact
                  showAskButton={showAskRovi}
                  showSafetyActions={!locationContext.liveSafe}
                  template={null}
                  loading={roviLoading}
                  explanation={roviExplanation}
                  error={roviError}
                  onAskRovi={onAskRovi!}
                  onSearchNearMe={onSearchNearMe!}
                  onChangeDestination={onChangeDestination!}
                  onPlanTrip={onPlanTrip!}
                  onContinueAnyway={onContinueAnyway ?? onMakeDestination}
                  showContinueAnyway={Boolean(onContinueAnyway)}
                />
                </div>
              ) : null}
            </div>
          )}

          {activeTab === "info" && (
            <div className="space-y-3">
              {place.mapPresenceNote || locationFields.length > 0 || place.coordinatesLabel ? (
                <div className="rounded-lg border border-stone-100 bg-stone-50 px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">
                    Location context
                  </p>
                  {place.mapPresenceNote ? (
                    <p className="mt-1 text-xs leading-snug text-stone-700">{place.mapPresenceNote}</p>
                  ) : null}
                  {place.coordinatesLabel ? (
                    <p className="mt-1 font-mono text-[10px] text-stone-600">{place.coordinatesLabel}</p>
                  ) : null}
                  <dl className="mt-2 space-y-1 text-xs text-stone-600">
                    {locationFields.map((field) => (
                      <div key={`${field.label}-${field.value}`} className="flex gap-2">
                        <dt className="w-16 shrink-0 text-stone-400">{field.label}</dt>
                        <dd className="min-w-0">{field.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ) : null}

              {nearbyPlacesAtClick && nearbyPlacesAtClick.length > 0 ? (
                <div>
                  <NearbyHereHeader />
                  <ul className="space-y-1">
                    {nearbyPlacesAtClick.slice(0, 3).map((poi) => (
                      <li key={poi.placeKey || poi.name}>
                        <button
                          type="button"
                          onClick={() => onSelectNearbyPlaceAtClick?.(poi)}
                          className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left hover:bg-stone-50"
                        >
                          <span className="truncate text-xs font-medium text-stone-850">{poi.name}</span>
                          <span className="ml-2 shrink-0 text-[10px] text-primary font-semibold">
                            {poi.distanceM != null ? formatDistanceMiles(poi.distanceM) : ""}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="space-y-1 border-t border-stone-100 pt-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                    Verified source
                  </span>
                  <span className="text-[10px] text-stone-400">{sourceLabel}</span>
                </div>
                <p className="text-[10px] leading-snug text-stone-500">{LIVE_DATA_DISCLAIMER}</p>
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 z-10 shrink-0 border-t border-stone-100 bg-white px-4 py-3 shadow-[0_-6px_16px_rgba(0,0,0,0.05)]">
          {previewPlaceActions}
        </div>
      </div>
    );
  }

  // --- 4. Web Mode Layout (Default) ---
  if (compact) {
    const thumbUrl = placeMedia?.[0]?.thumbnailUrl ?? placeMedia?.[0]?.storageUrl ?? null;
    return (
      <div
        className={`${surfaceClass} relative flex flex-col overflow-hidden`}
        style={panelChromeStyle}
        role="dialog"
        aria-label="Place details (compact)"
      >
        <PanelResizeHandles />
        <div className="flex items-start gap-2.5 px-3 py-2.5">
          {thumbUrl ? (
            <div
              className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-stone-200/60 bg-stone-100"
              aria-hidden
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={thumbUrl} alt="" className="h-full w-full object-cover" />
            </div>
          ) : null}
          <div className="min-w-0 flex-1">
            <PlacePreviewTitle
              name={previewTitleName}
              nameSourceLanguage={displayPlace.nameSourceLanguage}
              className={`truncate ${LIVE_PLACE_TITLE} text-base`}
            />
            <p className="truncate text-xs text-stone-500">{subheaderText}</p>
          </div>
          {onToggleCompact ? (
            <button
              type="button"
              onClick={onToggleCompact}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-stone-500 hover:bg-stone-100"
              aria-label="Expand place details"
              title="Expand place details"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-stone-600"
            aria-label="Close details"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="px-3 pb-0.5 text-[10px] leading-snug text-stone-500">
          Wayra chat is open — tap ↑ for tabs, photos, and route details.
        </p>
        <LiveDataTrustFooter showWayraNote className="border-0 px-3 pb-1 pt-0" />
        <div className="flex flex-col gap-2 border-t border-stone-100 px-3 py-2">
          {onAskRovi ? (
            <button
              type="button"
              onClick={onAskRovi}
              className="w-full rounded-xl border border-primary/30 bg-teal-50/50 py-2 text-xs font-semibold text-primary hover:bg-teal-50"
            >
              Ask Wayra
            </button>
          ) : null}
          {previewPlaceActions}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${surfaceClass} live-panel-enter relative flex flex-col overflow-hidden`}
      style={panelChromeStyle}
      role="dialog"
      aria-label="Place details"
    >
      <PanelResizeHandles />
      <PhoneSheetHandle />
      <div className="max-h-[min(var(--live-preview-max-height,55dvh),calc(100dvh-8rem))] overflow-y-auto no-scrollbar px-3 pt-2.5 pb-2">
        <div className="flex items-start gap-2">
          <button
            type="button"
            onClick={handlePreviewCardActivate}
            className="min-w-0 flex-1 rounded-lg text-left transition-colors hover:bg-stone-50/80"
            aria-label={isDroppedPinOrAddress ? "Use this location" : "Set as destination"}
          >
            {previewContext ? (
              <span className="mb-0.5 inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">
                <span aria-hidden>{previewContext.icon}</span>
                {previewContext.searchLabel}
              </span>
            ) : null}
            <PlacePreviewTitle
              name={previewTitleName}
              nameSourceLanguage={displayPlace.nameSourceLanguage}
              className="text-base font-bold leading-snug text-stone-900"
            />
            <p className="mt-0.5 text-xs text-stone-500">{subheaderText}</p>
            {routeReady ? (
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">
                  {routeDurationLabel}
                </span>
                {routeDistanceMeters != null ? (
                  <span className="text-xs text-stone-500">
                    {formatDistanceMiles(routeDistanceMeters)} · {travelMode}
                  </span>
                ) : (
                  <span className="text-xs text-stone-500">{travelMode}</span>
                )}
              </div>
            ) : null}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-stone-600"
            aria-label="Close details"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          {wayraChatOpen && onToggleCompact ? (
            <button
              type="button"
              onClick={onToggleCompact}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-stone-500 hover:bg-stone-100"
              aria-label="Collapse place details"
              title="Collapse for chat"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        {/* Tab Selection */}
        <div className="mt-3 mb-2.5 flex shrink-0 overflow-x-auto border-b border-stone-100 text-xs font-semibold text-stone-500 no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab("guide")}
            className={`min-w-[4.5rem] shrink-0 flex-1 py-1.5 text-center border-b-2 transition-all ${
              activeTab === "guide"
                ? "border-primary text-primary"
                : "border-transparent hover:text-stone-800"
            }`}
          >
            Guide
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("about")}
            className={`min-w-[4.5rem] shrink-0 flex-1 py-1.5 text-center border-b-2 transition-all ${
              activeTab === "about"
                ? "border-primary text-primary"
                : "border-transparent hover:text-stone-800"
            }`}
          >
            About
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("info")}
            className={`min-w-[4.5rem] shrink-0 flex-1 py-1.5 text-center border-b-2 transition-all ${
              activeTab === "info"
                ? "border-primary text-primary"
                : "border-transparent hover:text-stone-800"
            }`}
          >
            Info
          </button>
        </div>

        {/* Tab Contents */}
        {activeTab === "guide" && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-800">
                AI estimate
              </span>
              <span className="text-[10px] text-stone-500">Route tips from map context</span>
            </div>
            <LiveAiSuggestionsBlock
              suggestions={aiSuggestions}
              destinationName={displayPlace.name}
              showEmptyState
              className="mt-1"
            />

            {(routeLoading || routePreviewStatus === "loading") && routePreviewStatus !== "idle" ? (
              <div className="rounded-lg border border-teal-100 bg-teal-50/80 px-2.5 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-teal-800">
                  {travelMode} route preview
                </p>
                <p className="mt-1 text-xs text-stone-600">
                  Calculating your {travelMode.toLowerCase()} route…
                </p>
              </div>
            ) : null}

            {!isDroppedPinOrAddress && hoursLabel ? (
              <PlaceHoursNote hoursLabel={hoursLabel} />
            ) : null}
          </div>
        )}

        {activeTab === "about" && (
          <div className="space-y-3">
            {!isDroppedPinOrAddress && !hasNoPhotos ? (
              <div className={`overflow-hidden rounded-lg ${mediaMaxHeightClass}`}>
                <PlacePreviewMedia
                  media={placeMedia}
                  categoryLabel={place.categoryLabel}
                  loading={placeMediaLoading}
                />
              </div>
            ) : null}

            {wikiLoading || wikiSummary ? (
              <PlaceWikiAboutSection
                wikiLoading={wikiLoading}
                wikiSummary={wikiSummary}
                placeName={previewTitleName}
                city={place.city}
                wikiExpanded={wikiExpanded}
                onExpand={() => setWikiExpanded(true)}
              />
            ) : null}

            {locationContext && locationContext.classification !== "local_place" ? (
              <div className="space-y-2">
                <LiveDataTrustBadge variant="ai" />
                <RoviPlaceExplanationBlock
                  compact
                  showAskButton={showAskRovi}
                  showSafetyActions={!locationContext.liveSafe}
                  template={null}
                  loading={roviLoading}
                  explanation={roviExplanation}
                  error={roviError}
                  onAskRovi={onAskRovi!}
                  onSearchNearMe={onSearchNearMe!}
                  onChangeDestination={onChangeDestination!}
                  onPlanTrip={onPlanTrip!}
                  onContinueAnyway={onContinueAnyway ?? onMakeDestination}
                  showContinueAnyway={Boolean(onContinueAnyway)}
                />
              </div>
            ) : null}
          </div>
        )}

        {activeTab === "info" && (
          <div className="space-y-3">
            {place.mapPresenceNote || locationFields.length > 0 || place.coordinatesLabel ? (
              <div className="rounded-lg border border-stone-100 bg-stone-50 px-2.5 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">
                  Location context
                </p>
                {place.mapPresenceNote ? (
                  <p className="mt-1 text-xs leading-snug text-stone-750">{place.mapPresenceNote}</p>
                ) : null}
                {place.coordinatesLabel ? (
                  <p className="mt-1 font-mono text-[11px] text-stone-600">{place.coordinatesLabel}</p>
                ) : null}
                <dl className="mt-2 space-y-1 text-xs text-stone-600">
                  {locationFields.map((field) => (
                    <div key={`${field.label}-${field.value}`} className="flex gap-2">
                      <dt className="w-16 shrink-0 text-stone-400">{field.label}</dt>
                      <dd className="min-w-0">{field.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : null}

            {nearbyPlacesAtClick && nearbyPlacesAtClick.length > 0 ? (
              <div>
                <NearbyHereHeader />
                <ul className="space-y-1">
                  {nearbyPlacesAtClick.slice(0, 3).map((poi) => (
                    <li key={poi.placeKey || poi.name}>
                      <button
                        type="button"
                        onClick={() => onSelectNearbyPlaceAtClick?.(poi)}
                        className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left hover:bg-stone-50"
                      >
                        <span className="truncate text-xs font-medium text-stone-850">{poi.name}</span>
                        <span className="ml-2 shrink-0 text-[10px] text-primary">
                          {poi.distanceM != null ? formatDistanceMiles(poi.distanceM) : ""}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="space-y-1 border-t border-stone-100 pt-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                  Verified source
                </span>
                <span className="text-[10px] text-stone-400">{sourceLabel}</span>
              </div>
              <p className="text-[10px] leading-snug text-stone-500">{LIVE_DATA_DISCLAIMER}</p>
            </div>
          </div>
        )}
      </div>

      <div className="sticky bottom-0 z-10 shrink-0 border-t border-stone-100 bg-white px-3 py-2 shadow-[0_-6px_16px_rgba(0,0,0,0.06)]">
        {previewPlaceActions}
      </div>
    </div>
  );
}

function PreviewPlaceActionRow({
  onAddLocation,
  onStartDirection,
  directionReady = false,
  directionLoading = false,
  routeAlternatives = [],
  selectedRouteAlternativeId = null,
  onSelectRouteAlternative,
  vehiclePreference = "private",
  onVehiclePreferenceChange,
  onOpenTravelTab,
  showPublicTransportHint = false,
}: {
  onAddLocation: () => void;
  onStartDirection: () => void;
  directionReady?: boolean;
  directionLoading?: boolean;
  routeAlternatives?: RouteAlternative[];
  selectedRouteAlternativeId?: string | null;
  onSelectRouteAlternative?: (id: string) => void;
  vehiclePreference?: VehiclePreference;
  onVehiclePreferenceChange?: (value: VehiclePreference) => void;
  onOpenTravelTab?: () => void;
  showPublicTransportHint?: boolean;
}) {
  const startLabel = directionLoading ? "Calculating route…" : "Start a direction";
  const showRouteOptions =
    directionLoading || (directionReady && routeAlternatives.length > 1);

  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-lg border border-stone-200 bg-white px-2.5 py-2">
        <p className="text-[11px] font-semibold text-stone-700">How are you traveling?</p>
        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
          {VEHICLE_PREFERENCE_OPTIONS.map((option) => {
            const selected = vehiclePreference === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onVehiclePreferenceChange?.(option.id)}
                className={`rounded-md border px-2 py-2 text-left transition-all ${
                  selected
                    ? "border-primary bg-teal-50 shadow-sm"
                    : "border-stone-200 bg-stone-50 hover:border-stone-300"
                }`}
              >
                <span className="block text-[11px] font-semibold text-stone-900">{option.label}</span>
                <span className="mt-0.5 block text-[10px] leading-snug text-stone-600">
                  {option.description}
                </span>
              </button>
            );
          })}
        </div>
        {showPublicTransportHint ? (
          <div className="mt-2 rounded-md border border-amber-100 bg-amber-50 px-2 py-2">
            <p className="text-[10px] leading-snug text-amber-900">
              Public transport legs open in the Travel tab. Wayra can suggest trains, buses, and flights for this destination.
            </p>
            {onOpenTravelTab ? (
              <button
                type="button"
                onClick={onOpenTravelTab}
                className="mt-1.5 text-[10px] font-semibold text-primary hover:underline"
              >
                Open Travel tab with this destination →
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      {showRouteOptions ? (
        <div className="rounded-lg border border-stone-200 bg-stone-50/80 px-2.5 py-2">
          <p className="text-[11px] font-semibold text-stone-700">Show me the direction</p>
          {directionLoading ? (
            <p className="mt-1 text-[11px] text-stone-500">Finding routes with and without tolls…</p>
          ) : (
            <div className="mt-1.5 flex flex-col gap-1">
              {routeAlternatives.map((alt) => {
                const selected = alt.id === selectedRouteAlternativeId;
                return (
                  <button
                    key={alt.id}
                    type="button"
                    onClick={() => onSelectRouteAlternative?.(alt.id)}
                    className={`rounded-md border px-2.5 py-2 text-left transition-all ${
                      selected
                        ? "border-primary bg-teal-50 shadow-sm"
                        : "border-stone-200 bg-white hover:border-stone-300"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-stone-900">{alt.label}</span>
                      <span className="text-[11px] font-semibold text-primary">
                        {formatRouteDuration(alt.durationSeconds)}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-2 text-[10px] text-stone-600">
                      <span>{alt.tollLabel || "Route option"}</span>
                      <span>{formatDistanceMiles(alt.distanceMeters)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
      <div className="flex gap-2">
      <button
        type="button"
        onClick={onAddLocation}
        className="flex-1 rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-xs font-semibold text-stone-800 shadow-sm hover:bg-stone-50 active:scale-[0.98] transition-all"
      >
        Add location
      </button>
      <button
        type="button"
        onClick={onStartDirection}
        className={`flex-1 rounded-lg px-3 py-2.5 text-xs font-semibold shadow-sm active:scale-[0.98] transition-all ${
          directionReady
            ? "text-white hover:opacity-95"
            : "border-2 border-primary bg-primary-soft text-primary hover:bg-teal-50"
        }`}
        style={directionReady ? { backgroundColor: TEAL } : undefined}
        aria-label={
          directionReady
            ? "Start a direction"
            : "Start a direction — ask Wayra for route options"
        }
        title={
          directionReady
            ? "Start Solo Live navigation"
            : "Route not ready — tap to ask Wayra for alternatives"
        }
      >
        {startLabel}
      </button>
      </div>
    </div>
  );
}

function QuickAction({
  icon: Icon,
  label,
  onClick,
  active = false,
  disabled = false,
}: {
  icon: typeof MapPin;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-45 ${
        active
          ? "border-primary/35 bg-teal-50 text-primary"
          : "border-stone-200 text-stone-700 hover:bg-stone-50"
      }`}
    >
      <Icon className={`h-3 w-3 ${active ? "fill-current text-primary" : "text-stone-500"}`} />
      {label}
    </button>
  );
}
