"use client";

import { useState, useEffect } from "react";
import {
  Bookmark,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FilePlus,
  MapPin,
  Search,
  Users,
  X,
} from "lucide-react";
import { EXTERNAL_MAP_HANDOFF } from "@/lib/map-providers";
import type { LiveLocationContext } from "./live-location-context";
import type { PlaceMediaItem } from "./live-place-media";
import PlacePreviewMedia from "./PlacePreviewMedia";
import RoviPlaceExplanationBlock from "./RoviPlaceExplanationBlock";
import type { RoviPlaceExplanation } from "./live-rovi";

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
  onStartLive: () => void;
  nearbyPlacesAtClick?: PlacePreviewData[] | null;
  onSelectNearbyPlaceAtClick?: (place: PlacePreviewData) => void;
  liveStage?: string;
};

const TEAL = "#0F766E";

function formatDistanceLabel(
  m: number | null,
  hasUserLocation: boolean,
  loading: boolean,
): string {
  if (m != null) {
    const miles = m / 1609.34;
    if (miles < 0.1) return `${Math.round(m)} m away`;
    return `${miles.toFixed(1)} mi away`;
  }
  if (!hasUserLocation) return "Turn on location to calculate distance.";
  if (loading) return "Distance calculating…";
  return "Distance calculating…";
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

function TinyPhotoPlaceholder({ categoryLabel }: { categoryLabel: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-stone-50 border border-stone-200 px-3 py-2 text-stone-500">
      <Camera className="h-4 w-4 text-[#0F766E]" aria-hidden />
      <span className="text-xs font-semibold text-stone-600">
        No Rovvy photos yet for {categoryLabel || "this place"}
      </span>
    </div>
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
  onStartLive,
  nearbyPlacesAtClick = null,
  onSelectNearbyPlaceAtClick,
  placeMedia = [],
  placeMediaLoading = false,
  placeTags = [],
  liveStage = "static_landing",
}: Props) {
  const [isSheetExpanded, setIsSheetExpanded] = useState(false);

  useEffect(() => {
    setIsSheetExpanded(false);
  }, [place.placeKey, place.lat, place.lng]);

  const isDesktop = useMediaQuery("(min-width: 1280px)");
  const isLaptop = useMediaQuery("(min-width: 1024px) and (max-width: 1279px)");
  const isTabletLandscape = useMediaQuery(
    "(min-width: 768px) and (max-width: 1023px) and (orientation: landscape)"
  );
  const isTabletPortrait = useMediaQuery(
    "(min-width: 600px) and (max-width: 900px) and (orientation: portrait)"
  );
  const isMobile = useMediaQuery("(max-width: 599px)");

  const isDrivingMode =
    liveStage === "solo_drive_navigation" || liveStage === "solo_drive_command";

  const directionsUrl = EXTERNAL_MAP_HANDOFF.googleDirections(place.lat, place.lng);
  const distanceLabel = formatDistanceLabel(
    place.distanceM,
    hasUserLocation,
    loadingDetails,
  );
  const hoursLabel = formatHoursLabel(place);
  const sourceLabel =
    dataSource === "osm"
      ? "Place data from OpenStreetMap / Rovvy Places"
      : "Place data source limited";

  const isDroppedPinOrAddress =
    place.source === "dropped_pin" || place.source === "nominatim";

  const secondaryActions = isDroppedPinOrAddress
    ? [
        { label: "Make Destination", icon: MapPin, onClick: onMakeDestination },
        { label: "Search nearby", icon: Search, onClick: onSearchNearMe },
        { label: "Save", icon: Bookmark, onClick: onSavePlace },
        { label: "Create Meet Point", icon: Users, onClick: onCreateMeetPoint },
      ]
    : [
        { label: "Add Stop", icon: MapPin, onClick: onAddStop },
        { label: "Save Place", icon: Bookmark, onClick: onSavePlace },
        { label: "Create Meet Point", icon: Users, onClick: onCreateMeetPoint },
        { label: "Search nearby", icon: Search, onClick: onSearchNearMe },
      ];

  // Height overrides and layout class resolution
  let layoutClass = "";

  if (isDrivingMode) {
    if (isMobile) {
      layoutClass =
        "fixed inset-x-0 bottom-0 z-30 h-[160px] rounded-t-[24px] border border-stone-200 bg-white shadow-2xl flex flex-col justify-between p-4";
    } else {
      layoutClass =
        "absolute bottom-4 right-4 z-30 w-[360px] h-[230px] rounded-2xl border border-stone-200 bg-white shadow-2xl flex flex-col justify-between p-4";
    }
  } else if (isDesktop) {
    layoutClass =
      "absolute right-6 top-[88px] z-30 w-[410px] max-h-[75vh] rounded-[24px] border border-stone-200/80 bg-white shadow-2xl flex flex-col overflow-hidden";
  } else if (isLaptop) {
    layoutClass =
      "absolute right-4 top-[76px] z-30 w-[385px] max-h-[70vh] rounded-2xl border border-stone-200/80 bg-white shadow-xl flex flex-col overflow-hidden";
  } else if (isTabletLandscape) {
    layoutClass =
      "absolute right-4 top-[72px] z-30 w-[340px] max-h-[68vh] rounded-2xl border border-stone-200/80 bg-white shadow-lg flex flex-col overflow-hidden";
  } else if (isTabletPortrait) {
    const sheetHeight = isSheetExpanded ? "h-[75vh]" : "h-[40vh]";
    layoutClass = `fixed inset-x-0 bottom-0 z-30 w-full ${sheetHeight} rounded-t-[24px] border-t border-stone-200 bg-white shadow-[0_-8px_30px_rgba(0,0,0,0.08)] flex flex-col overflow-hidden transition-all duration-300 ease-out`;
  } else {
    // Default Mobile layout
    const sheetHeight = isSheetExpanded ? "h-[80vh]" : "h-[38vh]";
    layoutClass = `fixed inset-x-0 bottom-0 z-30 w-full ${sheetHeight} rounded-t-[24px] border-t border-stone-200 bg-white shadow-[0_-8px_30px_rgba(0,0,0,0.08)] flex flex-col overflow-hidden transition-all duration-300 ease-out`;
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
              <h3 className="text-lg font-bold text-stone-900 truncate">
                {place.name}
              </h3>
              <p className="text-xs text-stone-500 font-medium">
                {place.categoryLabel || "Selected location"} • {distanceLabel}
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

  // Media / Photo visibility and styling rules
  const showMedia = !isMobile || isSheetExpanded;
  const showSecondaryActions = !isMobile || isSheetExpanded;
  const showDetails = !isMobile || isSheetExpanded;

  const mediaMaxHeightClass = isDesktop ? "max-h-[180px]" : "max-h-[130px]";
  const hasNoPhotos = !placeMediaLoading && (!placeMedia || placeMedia.length === 0);

  return (
    <div className={layoutClass} role="dialog" aria-label="Place preview">
      {/* Drag handle for mobile & tablet portrait */}
      {(isMobile || isTabletPortrait) && (
        <button
          type="button"
          onClick={() => setIsSheetExpanded((prev) => !prev)}
          className="w-full py-2.5 flex justify-center focus:outline-none shrink-0 cursor-pointer"
          aria-label={isSheetExpanded ? "Collapse details" : "Expand details"}
        >
          <div className="w-12 h-1 rounded-full bg-stone-300 hover:bg-stone-400 transition-colors" />
        </button>
      )}

      {/* Internal scrollable content */}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-2">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div
            className="min-w-0 pr-2 cursor-pointer flex-1"
            onClick={() => {
              if (isMobile || isTabletPortrait) {
                setIsSheetExpanded((prev) => !prev);
              }
            }}
          >
            <h3 className="text-xl font-bold leading-snug text-stone-900">
              {place.name}
            </h3>
            <p className="mt-0.5 text-xs font-medium text-stone-500">
              {place.categoryLabel || "Place"}
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

        {/* Media Photo Row */}
        {showMedia && (
          <div className="mt-4">
            {isDroppedPinOrAddress || hasNoPhotos ? (
              <TinyPhotoPlaceholder categoryLabel={place.categoryLabel} />
            ) : (
              <div className={`overflow-hidden rounded-xl ${mediaMaxHeightClass}`}>
                <PlacePreviewMedia
                  media={placeMedia}
                  categoryLabel={place.categoryLabel}
                  loading={placeMediaLoading}
                />
              </div>
            )}
            {placeTags.length > 0 && !isDroppedPinOrAddress && !hasNoPhotos && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {placeTags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-600"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Trust row */}
        {showDetails && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
              style={{ backgroundColor: TEAL }}
            >
              <CheckCircle2 className="h-3 w-3" />
              Best match
            </span>
            <span className="text-[10px] leading-snug text-stone-500">{sourceLabel}</span>
          </div>
        )}

        {/* Distance & hours */}
        <div className="mt-3 space-y-0.5 border-t border-stone-100 pt-3">
          <p className="text-xs font-semibold text-stone-700">{distanceLabel}</p>
          {showDetails && hoursLabel && (
            <p className="text-[11px] text-stone-500">{hoursLabel}</p>
          )}
        </div>

        {/* Address */}
        {place.address && (
          <div className="mt-2.5">
            <p className="text-[9px] font-bold uppercase tracking-wider text-stone-400">
              Address
            </p>
            <p className="mt-0.5 text-xs leading-snug text-stone-700 line-clamp-2">
              {place.address}
            </p>
          </div>
        )}

        {/* Nearby places here list */}
        {showDetails && nearbyPlacesAtClick && nearbyPlacesAtClick.length > 0 && (
          <div className="mt-4 border-t border-stone-100 pt-3">
            <p className="text-[9px] font-bold uppercase tracking-wider text-stone-400">
              Nearby Places Here
            </p>
            <div className="mt-2 space-y-1.5">
              {nearbyPlacesAtClick.slice(0, 4).map((poi) => (
                <button
                  key={poi.placeKey || poi.name}
                  type="button"
                  onClick={() => onSelectNearbyPlaceAtClick?.(poi)}
                  className="flex w-full items-center justify-between rounded-xl bg-stone-50/80 p-2 text-left border border-stone-100 hover:bg-stone-100 transition-colors"
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <p className="text-[11px] font-semibold text-stone-850 truncate">
                      {poi.name}
                    </p>
                    <p className="text-[9px] text-stone-500 truncate">{poi.categoryLabel}</p>
                  </div>
                  <span className="text-[9px] font-semibold text-[#0F766E] shrink-0">
                    {poi.distanceM != null ? `${(poi.distanceM / 1609.34).toFixed(2)} mi` : ""}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Safety / Rovi alerts panel */}
        {showDetails && locationContext && locationContext.classification !== "local_place" && (
          <RoviPlaceExplanationBlock
            showAskButton={showAskRovi}
            showSafetyActions={!locationContext.liveSafe}
            template={locationContext.template}
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
        )}

        {/* Secondary actions grid */}
        {showSecondaryActions && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            {secondaryActions.map(({ label, icon: Icon, onClick }) => (
              <button
                key={label}
                type="button"
                onClick={onClick}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-stone-200 bg-white/80 px-2 py-2 text-[11px] font-semibold text-stone-700 transition-colors hover:bg-stone-50"
              >
                <Icon className="h-3.5 w-3.5 shrink-0 text-stone-500" />
                <span className="truncate">{label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Get Directions Link */}
        {showDetails && (
          <div className="mt-3">
            <a
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-stone-500 hover:text-[#0F766E] hover:underline"
            >
              Get Directions →
            </a>
          </div>
        )}
      </div>

      {/* Primary actions — sticky at bottom */}
      <div className="shrink-0 border-t border-stone-100 bg-white/95 p-4 backdrop-blur-md">
        <button
          type="button"
          onClick={onMakeDestination}
          className="w-full rounded-xl py-2.5 text-xs font-bold text-white transition-opacity hover:opacity-90 cursor-pointer"
          style={{ backgroundColor: TEAL }}
        >
          {isDroppedPinOrAddress ? "Use this location" : "Make Destination"}
        </button>
        {!isDrivingMode && (
          <button
            type="button"
            onClick={onStartLive}
            className="mt-2 w-full py-1 text-xs font-semibold text-stone-500 hover:text-[#0F766E] cursor-pointer"
          >
            Preview route →
          </button>
        )}
        {isMobile && !isSheetExpanded && (
          <button
            type="button"
            onClick={() => setIsSheetExpanded(true)}
            className="mt-2 text-xs font-bold text-[#0F766E] text-center w-full py-1 hover:underline cursor-pointer focus:outline-none"
          >
            Show more details
          </button>
        )}
      </div>
    </div>
  );
}
