"use client";

import type { CSSProperties } from "react";
import type { PlacePreviewData } from "./PlacePreviewCard";
import type { RouteLine, RouteOrigin, RoutePreviewStatus } from "./live-types";
import {
  formatRouteDuration,
  formatRouteOriginLabel,
  isFarFromUser,
} from "./live-types";
import { isLowGpsAccuracy } from "./live-route-origin";
import {
  LIVE_PANEL_MAX_WIDTH,
  LIVE_RESPONSIVE_PANEL_LAYOUT,
  LIVE_SHEET_BOTTOM_DEFAULT,
} from "./live-layout";
import LiveAiSuggestionsBlock from "./LiveAiSuggestionsBlock";
import { LiveDataTrustBadge, LiveDataTrustFooter } from "./LiveDataTrustBadge";
import { buildRoutePreviewAiSuggestions } from "./live-ai-suggestions";
import { formatPlaceSubtitle } from "./live-place-display";

const TEAL = "#0F766E";

type Props = {
  destination: PlacePreviewData;
  travelMode: string;
  plannedStops: PlacePreviewData[];
  planningMode?: boolean;
  onStartSoloLive: () => void;
  onChangeDestination: () => void;
  onClose: () => void;
  onPlanTrip?: () => void;
  onRetryRoute?: () => void;
  onEditOrigin?: () => void;
  routeOrigin?: RouteOrigin | null;
  routeLine: RouteLine | null;
  routeLoading: boolean;
  routePreviewStatus: RoutePreviewStatus;
  routePreviewError?: string | null;
};

export default function SoloRoutePreviewPanel({
  destination,
  travelMode,
  plannedStops,
  planningMode = false,
  onStartSoloLive,
  onChangeDestination,
  onClose,
  onPlanTrip,
  onRetryRoute,
  onEditOrigin,
  routeOrigin,
  routeLine,
  routeLoading,
  routePreviewStatus,
  routePreviewError,
}: Props) {
  const farFromUser = isFarFromUser(destination.distanceM);
  const showPlanTripOption = planningMode;
  const routeReady =
    routePreviewStatus === "ready" &&
    !!routeLine &&
    Array.isArray(routeLine.geometry) &&
    routeLine.geometry.length > 0;

  const routeDurationLabel =
    routeReady && routeLine?.durationSeconds != null
      ? formatRouteDuration(routeLine.durationSeconds)
      : routeLoading || routePreviewStatus === "loading"
        ? "Calculating…"
        : "";

  const lowGpsWarning =
    routeOrigin?.source === "gps" && isLowGpsAccuracy(routeOrigin.accuracyMeters ?? null);

  const aiSuggestions = buildRoutePreviewAiSuggestions({
    destinationName: destination.name,
    farFromUser,
    lastMileNotice:
      routeLine?.lastMileMode === "walk" ? routeLine?.lastMileNotice : null,
    borderNotice: routeLine?.borderNotice,
    lowGps: lowGpsWarning,
    routeError:
      routePreviewStatus === "failed"
        ? routePreviewError || "Route unavailable."
        : null,
  });

  return (
    <div
      className={`${LIVE_RESPONSIVE_PANEL_LAYOUT} w-full ${LIVE_PANEL_MAX_WIDTH} md:[--live-sheet-bottom:26px]`}
      style={{ ["--live-sheet-bottom" as string]: LIVE_SHEET_BOTTOM_DEFAULT } as CSSProperties}
      role="dialog"
      aria-label={planningMode ? "Long-distance route preview" : "Solo route preview"}
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-stone-600"
          aria-label="Close route preview"
        >
          ✕
        </button>

        <h3 className="pr-8 text-base font-bold leading-snug text-stone-900">
          {destination.name}
        </h3>
        <p className="mt-0.5 text-xs text-stone-500">{formatPlaceSubtitle(destination)}</p>
        {routeDurationLabel ? (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">
              {routeDurationLabel}
            </span>
            <span className="text-xs text-stone-500">{travelMode}</span>
          </div>
        ) : null}

        {aiSuggestions.length > 0 ? (
          <div className="mt-2 space-y-2">
            <LiveDataTrustBadge variant="ai" />
            <LiveAiSuggestionsBlock
              suggestions={aiSuggestions}
              destinationName={destination.name}
            />
          </div>
        ) : null}

        <div className="mt-3 space-y-2 border-t border-stone-100 pt-3 text-xs text-stone-600">
          <p>
            <span className="text-stone-500">From:</span>{" "}
            {formatRouteOriginLabel(routeOrigin)}
          </p>
          {onEditOrigin ? (
            <button
              type="button"
              onClick={onEditOrigin}
              className="font-semibold text-primary hover:underline"
            >
              Change start
            </button>
          ) : null}
        </div>

        {plannedStops.length > 0 ? (
          <ul className="mt-2 space-y-0.5 text-xs text-stone-700">
            {plannedStops.map((stop) => (
              <li key={`${stop.lat}-${stop.lng}`}>{stop.name}</li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="shrink-0 space-y-1.5 border-t border-stone-100 px-3 py-2">
        <LiveDataTrustFooter showWayraNote className="border-0 pb-1 pt-0" />
        <button
          type="button"
          onClick={onStartSoloLive}
          disabled={!routeReady || routeLoading}
          className="w-full rounded-lg py-2 text-sm font-semibold text-white hover:opacity-90 disabled:bg-stone-300 disabled:opacity-50"
          style={{ backgroundColor: routeReady && !routeLoading ? TEAL : undefined }}
        >
          {routeLoading || routePreviewStatus === "loading" ? "Loading…" : "Start Solo Live"}
        </button>
        {showPlanTripOption && onPlanTrip ? (
          <button
            type="button"
            onClick={onPlanTrip}
            className="w-full rounded-lg border py-2 text-xs font-semibold hover:bg-teal-50"
            style={{ borderColor: TEAL, color: TEAL }}
          >
            Plan trip
          </button>
        ) : null}
        <button
          type="button"
          onClick={onChangeDestination}
          className="w-full rounded-lg border border-stone-200 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
        >
          Change destination
        </button>
        {routePreviewStatus === "failed" && onRetryRoute ? (
          <button
            type="button"
            onClick={onRetryRoute}
            className="w-full rounded-lg border border-stone-200 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
          >
            Retry
          </button>
        ) : null}
      </div>
    </div>
  );
}
