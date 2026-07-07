"use client";

import type { PlacePreviewData } from "./PlacePreviewCard";
import type { RouteLine, RouteOrigin, RoutePreviewStatus } from "./live-types";
import {
  canStartSoloLive,
  formatDistanceMiles,
  formatRouteDuration,
  formatRouteOriginLabel,
  isFarFromUser,
  isLongDistanceFromUser,
} from "./live-types";
import { isLowGpsAccuracy } from "./live-route-origin";
import { LIVE_PANEL_MAX_WIDTH, LIVE_PANEL_RIGHT_INSET } from "./live-layout";

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
  const farWarning = isFarFromUser(destination.distanceM);
  const longDistance = isLongDistanceFromUser(destination.distanceM) || planningMode;
  const showStartLive = canStartSoloLive(destination.distanceM) && !planningMode;
  const routeReady =
    routePreviewStatus === "ready" &&
    !!routeLine &&
    Array.isArray(routeLine.geometry) &&
    routeLine.geometry.length > 0;
  const lowGpsWarning =
    routeOrigin?.source === "gps" && isLowGpsAccuracy(routeOrigin.accuracyMeters ?? null);

  const routeStatusLabel =
    routePreviewStatus === "loading"
      ? "Checking route..."
      : routeReady
        ? "Route ready"
        : routePreviewStatus === "failed"
          ? "Route preview unavailable"
          : "Waiting for route";

  const etaLabel = routeReady
    ? formatRouteDuration(routeLine.durationSeconds)
    : routePreviewStatus === "loading"
      ? "Checking route..."
      : routePreviewStatus === "failed"
        ? "Unavailable"
        : "Calculating route…";

  const distanceLabel = routeReady
    ? formatDistanceMiles(routeLine.distanceMeters)
    : routePreviewStatus === "loading"
      ? "Checking…"
      : formatDistanceMiles(destination.distanceM);

  const showFromToEditor =
    !longDistance &&
    (routePreviewStatus === "failed" || routePreviewStatus === "loading" || routePreviewStatus === "ready");

  return (
    <div
      className={`absolute ${LIVE_PANEL_RIGHT_INSET} top-[72px] z-30 flex w-[336px] ${LIVE_PANEL_MAX_WIDTH} max-h-[calc(100%-6.5rem)] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_8px_30px_rgba(0,0,0,0.12)]`}
      role="dialog"
      aria-label={planningMode ? "Long-distance route preview" : "Solo route preview"}
    >
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-stone-600"
          aria-label="Close route preview"
        >
          ✕
        </button>

        <p className="text-xs font-semibold uppercase tracking-wide text-[#0F766E]">
          {planningMode ? "Long-distance preview" : "Destination selected"}
        </p>
        <h3 className="mt-1 pr-8 text-[22px] font-bold leading-tight text-stone-900">
          {destination.name}
        </h3>

        {longDistance ? (
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-snug text-amber-900">
            This is a long-distance route. Plan this as a future trip before starting Solo
            Live.
          </p>
        ) : farWarning ? (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            This place is far from your current area. Check before continuing.
          </p>
        ) : null}

        {!longDistance ? (
          <div className="mt-3 rounded-lg border border-stone-100 bg-stone-50 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">
              Route preview
            </p>
            <p
              className={`mt-1 text-sm font-semibold ${
                routePreviewStatus === "ready"
                  ? "text-emerald-700"
                  : routePreviewStatus === "failed"
                    ? "text-amber-800"
                    : "text-stone-700"
              }`}
            >
              {routeStatusLabel}
            </p>
            {routePreviewStatus === "failed" ? (
              <p className="mt-1 text-xs leading-snug text-amber-900">
                {routePreviewError || "Route preview unavailable."}
              </p>
            ) : null}
          </div>
        ) : null}

        {showFromToEditor ? (
          <div className="mt-4 space-y-3 border-t border-stone-100 pt-4">
            <div className="rounded-xl border border-stone-100 bg-white px-3 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">From</p>
                  <p className="mt-0.5 text-sm font-semibold text-stone-900">
                    {formatRouteOriginLabel(routeOrigin)}
                  </p>
                  {routeOrigin?.address ? (
                    <p className="mt-0.5 text-xs leading-snug text-stone-500 line-clamp-2">
                      {routeOrigin.address}
                    </p>
                  ) : null}
                  {lowGpsWarning ? (
                    <p className="mt-1 text-xs text-amber-800">
                      Low GPS accuracy. Make sure you are outdoors for best signal.
                      {routeOrigin?.accuracyMeters != null
                        ? ` (±${Math.round(routeOrigin.accuracyMeters)} m)`
                        : ""}

                    </p>
                  ) : null}
                </div>
                {onEditOrigin ? (
                  <button
                    type="button"
                    onClick={onEditOrigin}
                    className="shrink-0 rounded-full border border-stone-200 px-2.5 py-1 text-[11px] font-semibold text-stone-700 hover:bg-stone-50"
                  >
                    Change
                  </button>
                ) : null}
              </div>
            </div>

            <div className="rounded-xl border border-stone-100 bg-white px-3 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">To</p>
                  <p className="mt-0.5 text-sm font-semibold text-stone-900">{destination.name}</p>
                  <p className="mt-0.5 text-xs leading-snug text-stone-500 line-clamp-2">
                    {destination.address}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-4 space-y-2 border-t border-stone-100 pt-4 text-sm text-stone-700">
          <p>
            <span className="font-medium text-stone-500">Travel mode:</span> {travelMode}
          </p>
          <p>
            <span className="font-medium text-stone-500">ETA:</span>{" "}
            {longDistance ? "Plan trip first" : etaLabel}
          </p>
          <p>
            <span className="font-medium text-stone-500">Distance:</span>{" "}
            {longDistance ? formatDistanceMiles(destination.distanceM) : distanceLabel}
          </p>
        </div>

        {!longDistance ? (
          <div className="mt-4 border-t border-stone-100 pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              Planned stops
            </p>
            {plannedStops.length === 0 ? (
              <p className="mt-1 text-sm text-stone-400">No stops added yet</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm text-stone-700">
                {plannedStops.map((stop) => (
                  <li key={`${stop.lat}-${stop.lng}`}>{stop.name}</li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>

      <div className="shrink-0 space-y-2 border-t border-stone-100 p-4">
        {showStartLive ? (
          <button
            type="button"
            onClick={onStartSoloLive}
            disabled={!routeReady || routeLoading}
            className="w-full rounded-full py-3 text-sm font-semibold text-white hover:opacity-90 disabled:bg-stone-300 disabled:opacity-50"
            style={{ backgroundColor: routeReady && !routeLoading ? TEAL : undefined }}
          >
            {routeLoading || routePreviewStatus === "loading"
              ? "Loading route..."
              : "Start Solo Live"}
          </button>
        ) : (
          <button
            type="button"
            onClick={onPlanTrip}
            className="w-full rounded-full py-3 text-sm font-semibold text-white hover:opacity-90"
            style={{ backgroundColor: TEAL }}
          >
            Plan this as a future trip
          </button>
        )}
        <button
          type="button"
          onClick={onChangeDestination}
          className="w-full rounded-full border-2 py-3 text-sm font-semibold hover:bg-teal-50"
          style={{ borderColor: TEAL, color: TEAL }}
        >
          Change Destination
        </button>
        {routePreviewStatus === "failed" && onRetryRoute ? (
          <button
            type="button"
            onClick={onRetryRoute}
            className="w-full rounded-full border border-stone-200 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-50"
          >
            Retry route preview
          </button>
        ) : null}
      </div>
    </div>
  );
}
