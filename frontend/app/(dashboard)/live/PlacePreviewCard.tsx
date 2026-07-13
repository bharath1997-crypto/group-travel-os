"use client";

import { useState, useEffect } from "react";
import {
  Bookmark,
  MapPin,
  Search,
  Users,
  X,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { LiveLocationContext } from "./live-location-context";
import type { PlaceMediaItem } from "./live-place-media";
import PlacePreviewMedia from "./PlacePreviewMedia";
import RoviPlaceExplanationBlock from "./RoviPlaceExplanationBlock";
import type { RoviPlaceExplanation } from "./live-rovi";
import { LIVE_PANEL_MAX_WIDTH, LIVE_PANEL_RIGHT_INSET, LIVE_RESPONSIVE_PANEL_LAYOUT } from "./live-layout";
import { normalizePlaceCategory } from "./live-geocoding";
import { logRovvyLiveWarn } from "./live-gps";
import {
  formatDistanceMiles,
  formatRouteDurationBracketed,
  type RoutePreviewStatus,
} from "./live-types";

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
  country?: string | null;
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
  travelMode?: string;
  nearbyPlacesAtClick?: PlacePreviewData[] | null;
  onSelectNearbyPlaceAtClick?: (place: PlacePreviewData) => void;
  liveStage?: string;
  /** When true, lift the sheet above the route summary bar on small screens. */
  stackAboveRouteSummary?: boolean;
  /** When opened from a category nearby search (e.g. waterfalls). */
  previewContext?: { icon: string; searchLabel: string } | null;
};

function isOsmGeometryLabel(label: string): boolean {
  return /^(node|way|relation)$/i.test(label.trim());
}

function resolveCategoryLabel(place: PlacePreviewData): string {
  const fromTags = normalizePlaceCategory(place.tags);
  if (fromTags) return fromTags;
  if (place.categoryLabel && !isOsmGeometryLabel(place.categoryLabel)) {
    return place.categoryLabel;
  }
  return "Place";
}

function formatHoursLabel(place: PlacePreviewData): string {
  if (place.openStatus) return place.openStatus;
  if (place.openingHours) return place.openingHours;
  return "Hours not provided by source.";
}

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
  const [wikiSummary, setWikiSummary] = useState<{ available: boolean; summary?: string; url?: string; title?: string; attribution?: string } | null>(null);
  const [wikiLoading, setWikiLoading] = useState(false);

  useEffect(() => {
    // Reset wiki summary when place changes
    setWikiSummary(null);

    const isEligibleCategory = [
      "Landmark", "Attraction", "Museum", "Park", "Historic site",
      "Airport", "University", "Church / Place of worship", "Stadium", "Monument"
    ].includes(place.categoryLabel);

    const wikidataId = place.tags?.wikidata;
    const wikipediaTitle = place.tags?.wikipedia;

    if (!isEligibleCategory && !wikidataId && !wikipediaTitle) {
      return;
    }
    
    if (place.name === "Dropped pin" || place.categoryLabel === "Address" || !place.name) {
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

        const res = await apiFetch<any>(`/api/v1/places/wiki-summary?${query.toString()}`);
        setWikiSummary(res);
      } catch (err) {
        logRovvyLiveWarn("Wiki fetch failed", err);
        setWikiSummary({ available: false });
      } finally {
        setWikiLoading(false);
      }
    };

    fetchWiki();
  }, [place.name, place.categoryLabel, place.lat, place.lng, place.tags]);

  const isMobile = useMediaQuery("(max-width: 599px)");

  const isDrivingMode =
    liveStage === "solo_drive_navigation" || liveStage === "solo_drive_command";

  const hoursLabel = formatHoursLabel(place);
  const sourceLabel =
    dataSource === "osm"
      ? "Place data from OpenStreetMap / Rovvy Places"
      : "Place data source limited";

  const displayCategory = place.name === "Dropped pin"
    ? "Selected location"
    : resolveCategoryLabel(place);

  const subheaderText = displayCategory;

  const routeReady = routePreviewStatus === "ready" && routeDurationSeconds != null;
  const timeBracket = routeReady
    ? formatRouteDurationBracketed(routeDurationSeconds)
    : "";

  const isDroppedPinOrAddress =
    place.source === "dropped_pin" ||
    (place.source === "nominatim" && place.categoryLabel === "Address");

  const contextNotice =
    routeLastMileNotice ??
    (locationContext && locationContext.classification !== "local_place"
      ? locationContext.template?.recommendation
      : null);

  const summaryStackClass = stackAboveRouteSummary
    ? "max-lg:!bottom-[calc(5.75rem+env(safe-area-inset-bottom,0px))] max-lg:max-h-[min(55vh,calc(100dvh-8rem))]"
    : "";

  // Height overrides and layout class resolution
  let layoutClass = "";

  if (isDrivingMode) {
    if (isMobile) {
      layoutClass =
        "fixed inset-x-0 bottom-0 z-30 max-h-[min(40vh,14rem)] rounded-t-xl border border-stone-200 bg-white shadow-2xl flex flex-col justify-between p-3";
    } else {
      layoutClass =
        `absolute bottom-4 ${LIVE_PANEL_RIGHT_INSET} z-30 ${LIVE_PANEL_MAX_WIDTH} max-h-[min(40vh,14rem)] rounded-xl border border-stone-200 bg-white shadow-2xl flex flex-col justify-between p-3`;
    }
  } else {
    layoutClass = `${LIVE_RESPONSIVE_PANEL_LAYOUT} w-full ${LIVE_PANEL_MAX_WIDTH} ${summaryStackClass}`;
  }

  // Driving / CarPlay UI block
  if (isDrivingMode) {
    return (
      <div
        className={layoutClass}
        role="dialog"
        aria-label="Driving destination select"
      >
        <div className="flex-1 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 pr-2">
              <h3 className="text-base font-bold text-stone-900 truncate">
                {place.name}
              </h3>
              <p className="text-xs text-stone-500 font-medium truncate">
                {subheaderText}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-stone-600"
              aria-label="Close preview"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex gap-2 mt-4 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-xs font-semibold text-stone-700 hover:bg-stone-50"
            >
              Close
            </button>
            {!isDroppedPinOrAddress && (
              <button
                type="button"
                onClick={onAddStop}
                className="flex-1 rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-xs font-semibold text-stone-700 hover:bg-stone-50"
              >
                Add Stop
              </button>
            )}
            <button
              type="button"
              onClick={onMakeDestination}
              className="flex-[2] rounded-xl py-2.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 flex items-center justify-center"
              style={{ backgroundColor: TEAL }}
            >
              {isDroppedPinOrAddress ? "Use this location" : "Make Destination"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const hasNoPhotos = !placeMediaLoading && (!placeMedia || placeMedia.length === 0);
  const mediaMaxHeightClass = "max-h-[8rem]";

  return (
    <div className={layoutClass} role="dialog" aria-label="Place details">
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-3 pb-2">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            {previewContext ? (
              <span className="mb-0.5 inline-flex items-center gap-1 rounded-full bg-[#E6F7F4] px-2 py-0.5 text-xs font-semibold text-[#0F766E]">
                <span aria-hidden>{previewContext.icon}</span>
                {previewContext.searchLabel}
              </span>
            ) : null}
            <h3 className="text-base font-bold leading-snug text-stone-900">
              {place.name}
              {routeReady && timeBracket ? (
                <span className="font-semibold text-[#0F766E]"> {timeBracket}</span>
              ) : null}
            </h3>
            <p className="mt-0.5 truncate text-xs text-stone-500">{subheaderText}</p>
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

        {contextNotice ? (
          <p className="mt-2 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs leading-snug text-amber-900">
            {contextNotice}
          </p>
        ) : null}

        <div className="mt-3 space-y-3 border-t border-stone-100 pt-3">
            {place.address ? (
              <p className="text-xs leading-snug text-stone-600 line-clamp-2">{place.address}</p>
            ) : null}

            {!isDroppedPinOrAddress && !hasNoPhotos ? (
              <div className={`overflow-hidden rounded-lg ${mediaMaxHeightClass}`}>
                <PlacePreviewMedia
                  media={placeMedia}
                  categoryLabel={place.categoryLabel}
                  loading={placeMediaLoading}
                />
              </div>
            ) : null}

            {!isDroppedPinOrAddress ? (
              <p className="text-xs text-stone-500">{hoursLabel}</p>
            ) : null}

            {wikiSummary?.available && wikiSummary.summary ? (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">About</p>
                <p className="mt-1 text-xs leading-relaxed text-stone-600 line-clamp-4">{wikiSummary.summary}</p>
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

            <div className="flex flex-wrap gap-2">
              {!isDroppedPinOrAddress ? (
                <QuickAction icon={MapPin} label="Add stop" onClick={onAddStop} />
              ) : null}
              <QuickAction icon={Bookmark} label="Save" onClick={onSavePlace} />
              <QuickAction icon={Users} label="Meet" onClick={onCreateMeetPoint} />
              {onSearchNearMe ? (
                <QuickAction icon={Search} label="Search nearby" onClick={onSearchNearMe} />
              ) : null}
            </div>

            <p className="text-[10px] text-stone-400">{sourceLabel}</p>
        </div>
      </div>

      <div className="shrink-0 border-t border-stone-100 px-3 py-2">
        <button
          type="button"
          onClick={onMakeDestination}
          className="w-full rounded-lg border border-stone-200 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
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
