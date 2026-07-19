"use client";

import { useState, useEffect } from "react";
import {
  Bookmark,
  MapPin,
  Search,
  Users,
  X,
  Navigation,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { LiveLocationContext } from "./live-location-context";
import type { PlaceMediaItem } from "./live-place-media";
import PlacePreviewMedia from "./PlacePreviewMedia";
import RoviPlaceExplanationBlock from "./RoviPlaceExplanationBlock";
import type { RoviPlaceExplanation } from "./live-rovi";
import { LIVE_PANEL_MAX_WIDTH, LIVE_PANEL_RIGHT_INSET, LIVE_RESPONSIVE_PANEL_LAYOUT } from "./live-layout";
import { logRovvyLiveWarn } from "./live-gps";
import {
  formatDistanceMiles,
  formatRouteDuration,
  isFarFromUser,
  type RoutePreviewStatus,
} from "./live-types";
import LiveAiSuggestionsBlock from "./LiveAiSuggestionsBlock";
import { buildRoutePreviewAiSuggestions } from "./live-ai-suggestions";
import {
  formatOpeningHoursLabel,
  formatPlaceSubtitle,
  getPlaceLocationFields,
} from "./live-place-display";

const TEAL = "#0F766E";

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
  liveStage?: string;
  /** When true, lift the sheet above the route summary bar on small screens. */
  stackAboveRouteSummary?: boolean;
  /** When opened from a category nearby search (e.g. waterfalls). */
  previewContext?: { icon: string; searchLabel: string } | null;
};

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia(query);
    if (media.matches !== matches) {
      setMatches(media.matches);
    }
    const listener = () => setMatches(media.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [matches, query]);

  return matches;
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
  previewContext = null,
}: Props) {
  const [wikiSummary, setWikiSummary] = useState<{
    available: boolean;
    summary?: string;
    url?: string;
    title?: string;
    attribution?: string;
    matchedOn?: string;
  } | null>(null);
  const [wikiLoading, setWikiLoading] = useState(false);
  const [wikiExpanded, setWikiExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<"guide" | "about" | "info">("guide");

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
        "Landmark", "Attraction", "Museum", "Park", "Historic site",
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

  const isDrivingMode =
    liveStage === "solo_drive_navigation" || liveStage === "solo_drive_command";

  const hoursLabel = formatOpeningHoursLabel(place);
  const sourceLabel =
    dataSource === "osm"
      ? "Place data from OpenStreetMap / Rovvy Places"
      : "Place data source limited";

  const subheaderText =
    place.name === "Dropped pin" ? "Selected location" : formatPlaceSubtitle(place);
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
    destinationName: place.name,
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

  const summaryStackClass = stackAboveRouteSummary
    ? "max-lg:!bottom-[calc(5.75rem+env(safe-area-inset-bottom,0px))] max-lg:max-h-[min(55vh,calc(100dvh-8rem))]"
    : "";
  // Height overrides and layout class resolution
  let layoutClass = "";

  if (isDrivingMode) {
    if (isMobile) {
      layoutClass =
        "fixed inset-x-0 bottom-0 z-30 max-h-[min(45vh,16rem)] rounded-t-2xl border border-stone-200 bg-white shadow-2xl flex flex-col justify-between p-4 pb-6";
    } else {
      layoutClass =
        `absolute bottom-4 ${LIVE_PANEL_RIGHT_INSET} z-30 ${LIVE_PANEL_MAX_WIDTH} max-h-[min(45vh,16rem)] rounded-xl border border-stone-200 bg-white shadow-2xl flex flex-col justify-between p-4`;
    }
  } else {
    // Normal mode: mobile is full-width bottom sheet, desktop is absolute/fixed right panel
    layoutClass = `${LIVE_RESPONSIVE_PANEL_LAYOUT} w-full max-lg:max-w-none max-lg:inset-x-0 max-lg:bottom-0 ${LIVE_PANEL_MAX_WIDTH} ${summaryStackClass}`;
  }

  // Driving / CarPlay UI block
  if (isDrivingMode) {
    return (
      <div
        className={layoutClass}
        role="dialog"
        aria-label="Driving destination select"
      >
        <div className="flex-1 flex flex-col justify-between gap-3">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 pr-2">
              <h3 className="text-lg font-black text-stone-900 leading-tight truncate">
                {place.name}
              </h3>
              <p className="text-sm font-semibold text-stone-500 truncate mt-0.5">
                {subheaderText}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-500 hover:bg-stone-200 hover:text-stone-800 transition-colors"
              aria-label="Close preview"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="flex gap-3 mt-1 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-12 rounded-xl border border-stone-300 bg-white px-4 text-sm font-bold text-stone-700 hover:bg-stone-50 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              Cancel
            </button>
            {!isDroppedPinOrAddress && (
              <button
                type="button"
                onClick={onAddStop}
                className="flex-1 h-12 rounded-xl border border-stone-300 bg-white px-4 text-sm font-bold text-stone-700 hover:bg-stone-50 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <MapPin className="h-4 w-4 text-stone-500" />
                Add Stop
              </button>
            )}
            <button
              type="button"
              onClick={onMakeDestination}
              className="flex-[2] h-12 rounded-xl text-sm font-black text-white active:scale-95 transition-all flex items-center justify-center gap-2"
              style={{ backgroundColor: TEAL }}
            >
              <Navigation className="h-4 w-4" />
              {isDroppedPinOrAddress ? "Go" : "Start Route"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const hasNoPhotos = !placeMediaLoading && (!placeMedia || placeMedia.length === 0);
  const mediaMaxHeightClass = "max-h-[8rem]";

  return (
    <div className={`${layoutClass} flex flex-col`} role="dialog" aria-label="Place details">
      {/* Mobile drag handle for bottom sheet */}
      <div className="w-12 h-1 bg-stone-300 rounded-full mx-auto my-2.5 shrink-0 lg:hidden" aria-hidden />

      <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar px-3 pt-2 pb-2">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            {previewContext ? (
              <span className="mb-0.5 inline-flex items-center gap-1 rounded-full bg-[#E6F7F4] px-2 py-0.5 text-xs font-semibold text-[#0F766E]">
                <span aria-hidden>{previewContext.icon}</span>
                {previewContext.searchLabel}
              </span>
            ) : null}
            <h3 className="text-base font-bold leading-snug text-stone-900">{place.name}</h3>
            <p className="mt-0.5 text-xs text-stone-500">{subheaderText}</p>
            {routeReady ? (
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center rounded-full bg-[#E6F7F4] px-2 py-0.5 text-xs font-semibold text-[#0F766E]">
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
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-stone-600"
            aria-label="Close details"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-stone-100 mt-3 mb-2.5 text-xs font-semibold text-stone-500">
          <button
            type="button"
            onClick={() => setActiveTab("guide")}
            className={`flex-1 py-1.5 text-center border-b-2 transition-all ${
              activeTab === "guide"
                ? "border-[#0F766E] text-[#0F766E]"
                : "border-transparent hover:text-stone-800"
            }`}
          >
            Guide
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("about")}
            className={`flex-1 py-1.5 text-center border-b-2 transition-all ${
              activeTab === "about"
                ? "border-[#0F766E] text-[#0F766E]"
                : "border-transparent hover:text-stone-800"
            }`}
          >
            About
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("info")}
            className={`flex-1 py-1.5 text-center border-b-2 transition-all ${
              activeTab === "info"
                ? "border-[#0F766E] text-[#0F766E]"
                : "border-transparent hover:text-stone-800"
            }`}
          >
            Info
          </button>
        </div>

        {/* Tab Contents */}
        {activeTab === "guide" && (
          <div className="space-y-3">
            {aiSuggestions.length > 0 ? (
              <LiveAiSuggestionsBlock
                suggestions={aiSuggestions}
                destinationName={place.name}
                className="mt-1"
              />
            ) : null}

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

            {place.address ? (
              <p className="text-xs leading-snug text-stone-600 line-clamp-2">{place.address}</p>
            ) : null}

            {!isDroppedPinOrAddress && hoursLabel ? (
              <p className="text-xs text-stone-500">{hoursLabel}</p>
            ) : null}
            <div className="flex flex-wrap gap-2 items-center border-t border-stone-100 pt-3">
              {!isDroppedPinOrAddress && (
                <QuickAction icon={MapPin} label="Add stop" onClick={onAddStop} />
              )}
              <QuickAction icon={Bookmark} label="Save" onClick={onSavePlace} />
              <QuickAction icon={Users} label="Meet" onClick={onCreateMeetPoint} />
              {onSearchNearMe && (
                <QuickAction icon={Search} label="Search nearby" onClick={onSearchNearMe} />
              )}
            </div>
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

            {wikiLoading ? (
              <p className="text-xs text-stone-400">Loading area information…</p>
            ) : null}

            {wikiSummary?.available && wikiSummary.summary ? (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">
                  {wikiSummary.matchedOn === "city" || wikiSummary.matchedOn === "region"
                    ? `About ${wikiSummary.title || place.city || "this area"}`
                    : "About"}
                </p>
                <p
                  className={`mt-1 text-xs leading-relaxed text-stone-600 ${
                    wikiExpanded ? "" : "line-clamp-2"
                  }`}
                >
                  {wikiSummary.summary}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-3">
                  {!wikiExpanded ? (
                    <button
                      type="button"
                      onClick={() => setWikiExpanded(true)}
                      className="text-[11px] font-medium text-[#0F766E] hover:underline"
                    >
                      Read more
                    </button>
                  ) : null}
                  {wikiSummary.url ? (
                    <a
                      href={wikiSummary.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-medium text-[#0F766E] hover:underline"
                    >
                      Read on Wikipedia
                    </a>
                  ) : null}
                </div>
              </div>
            ) : null}

            {locationContext && locationContext.classification !== "local_place" ? (
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
                  <p className="mt-1 text-xs leading-snug text-stone-700">{place.mapPresenceNote}</p>
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
                <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">Nearby here</p>
                <ul className="mt-2 space-y-1">
                  {nearbyPlacesAtClick.slice(0, 3).map((poi) => (
                    <li key={poi.placeKey || poi.name}>
                      <button
                        type="button"
                        onClick={() => onSelectNearbyPlaceAtClick?.(poi)}
                        className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left hover:bg-stone-50"
                      >
                        <span className="truncate text-xs font-medium text-stone-800">{poi.name}</span>
                        <span className="ml-2 shrink-0 text-[10px] text-[#0F766E]">
                          {poi.distanceM != null ? formatDistanceMiles(poi.distanceM) : ""}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <p className="text-[10px] text-stone-400 pt-2 border-t border-stone-100">{sourceLabel}</p>
          </div>
        )}
      </div>

      <div className="sticky bottom-0 z-10 shrink-0 border-t border-stone-100 bg-white px-3 py-2 shadow-[0_-6px_16px_rgba(0,0,0,0.06)]">
        <button
          type="button"
          onClick={onMakeDestination}
          className="w-full rounded-lg py-2.5 text-sm font-semibold text-white hover:opacity-90"
          style={{ backgroundColor: TEAL }}
        >
          {isDroppedPinOrAddress ? "Use location" : "Set destination"}
        </button>
      </div>
    </div>
  );
}

function QuickAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof MapPin;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-full border border-stone-200 px-2.5 py-1 text-[11px] font-semibold text-stone-700 hover:bg-stone-50"
    >
      <Icon className="h-3 w-3 text-stone-500" />
      {label}
    </button>
  );
}
