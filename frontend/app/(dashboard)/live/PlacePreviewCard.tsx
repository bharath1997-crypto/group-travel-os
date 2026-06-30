"use client";

import {
  Bookmark,
  CheckCircle2,
  FilePlus,
  MapPin,
  Users,
  X,
} from "lucide-react";
import { EXTERNAL_MAP_HANDOFF } from "@/lib/map-providers";
import type { LiveLocationContext } from "./live-location-context";
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
};

type Props = {
  place: PlacePreviewData;
  loadingDetails: boolean;
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
}: Props) {
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

  const secondaryActions = [
    { label: "Save Place", icon: Bookmark, onClick: onSavePlace },
    { label: "Add Stop", icon: MapPin, onClick: onAddStop },
    { label: "Add to Trip", icon: FilePlus, onClick: onAddToTrip },
    { label: "Create Meet Point", icon: Users, onClick: onCreateMeetPoint },
  ];

  return (
    <div
      className="absolute inset-x-0 bottom-0 z-30 flex max-h-[72vh] flex-col overflow-hidden rounded-t-2xl border border-stone-200/80 bg-white/95 shadow-[0_-8px_40px_rgba(0,0,0,0.12)] backdrop-blur-md max-lg:fixed lg:inset-x-auto lg:bottom-auto lg:right-4 lg:top-[72px] lg:w-[min(420px,calc(100%-5.5rem))] lg:max-h-[calc(100%-6.5rem)] lg:rounded-2xl lg:shadow-[0_8px_30px_rgba(0,0,0,0.12)]"
      role="dialog"
      aria-label="Place preview"
    >
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 pr-2">
            <h3 className="text-[22px] font-bold leading-tight text-stone-900">
              {place.name}
            </h3>
            <p className="mt-1 text-sm text-stone-500">
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

        {/* Trust row */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white"
            style={{ backgroundColor: TEAL }}
          >
            <CheckCircle2 className="h-3 w-3" />
            Best match
          </span>
          <span className="text-[11px] leading-snug text-stone-500">{sourceLabel}</span>
        </div>

        {/* Distance & hours */}
        <div className="mt-4 space-y-1 border-t border-stone-100 pt-4">
          <p className="text-sm font-medium text-stone-700">{distanceLabel}</p>
          <p className="text-xs text-stone-500">{hoursLabel}</p>
        </div>

        {/* Address */}
        {place.address ? (
          <div className="mt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">
              Address
            </p>
            <p className="mt-1 text-sm leading-snug text-stone-700">{place.address}</p>
          </div>
        ) : null}

        {locationContext && locationContext.classification !== "local_place" ? (
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
        ) : null}

        {/* Secondary actions */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          {secondaryActions.map(({ label, icon: Icon, onClick }) => (
            <button
              key={label}
              type="button"
              onClick={onClick}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-stone-200 bg-white/80 px-2 py-2 text-xs font-semibold text-stone-700 transition-colors hover:bg-stone-50"
            >
              <Icon className="h-3.5 w-3.5 shrink-0 text-stone-500" />
              <span className="truncate">{label}</span>
            </button>
          ))}
        </div>

        {/* External directions */}
        <div className="mt-4">
          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-stone-500 hover:text-[#0F766E] hover:underline"
          >
            Get Directions →
          </a>
        </div>
      </div>

      {/* Primary actions — pinned at bottom */}
      <div className="shrink-0 border-t border-stone-100 bg-white/95 p-4 backdrop-blur-md">
        <button
          type="button"
          onClick={onMakeDestination}
          className="w-full rounded-xl py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: TEAL }}
        >
          Make Destination
        </button>
        <button
          type="button"
          onClick={onStartLive}
          className="mt-2 w-full py-1.5 text-xs font-medium text-stone-500 hover:text-[#0F766E]"
        >
          Preview route →
        </button>
      </div>
    </div>
  );
}
