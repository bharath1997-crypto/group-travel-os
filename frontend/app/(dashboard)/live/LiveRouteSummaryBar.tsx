"use client";

import { AlertTriangle, Car, Info, X } from "lucide-react";
import { LIVE_ROUTE_SUMMARY_BOTTOM } from "./live-layout";
import { compactRouteConditionLabel } from "./live-place-display";
import {
  formatRouteDuration,
  type RoutePreviewStatus,
} from "./live-types";

const TEAL = "#0F766E";

type Props = {
  destinationName: string;
  durationSeconds?: number | null;
  routePreviewStatus?: RoutePreviewStatus;
  routeLoading?: boolean;
  identifying?: boolean;
  travelMode?: string;
  routeLastMileNotice?: string | null;
  routeBorderNotice?: string | null;
  routeLastMileMode?: "walk" | null;
  onOpenDetails?: () => void;
  onGo?: () => void;
  onClose?: () => void;
};

export default function LiveRouteSummaryBar({
  destinationName,
  durationSeconds,
  routePreviewStatus = "idle",
  routeLoading = false,
  identifying = false,
  travelMode = "Drive",
  routeLastMileNotice = null,
  routeBorderNotice = null,
  routeLastMileMode = null,
  onOpenDetails,
  onGo,
  onClose,
}: Props) {
  const routeReady = routePreviewStatus === "ready" && durationSeconds != null;
  const routePending = identifying || routeLoading || routePreviewStatus === "loading";
  const durationLabel =
    routeReady && durationSeconds != null ? formatRouteDuration(durationSeconds) : "";
  const routeCondition = compactRouteConditionLabel({
    lastMileNotice: routeLastMileNotice,
    lastMileMode: routeLastMileMode,
    borderNotice: routeBorderNotice,
  });

  return (
    <div
      className={`pointer-events-auto fixed left-1/2 z-[135] w-[min(24rem,calc(100%-1.5rem))] -translate-x-1/2 ${LIVE_ROUTE_SUMMARY_BOTTOM} flex items-center gap-1.5 rounded-xl border border-stone-200/90 bg-white/95 px-2 py-2 shadow-md backdrop-blur-md`}
      role="region"
      aria-label="Route preview summary"
    >
      <div className="min-w-0 flex-1 px-1">
        <p className="truncate text-sm font-semibold leading-snug text-stone-900">
          {destinationName}
        </p>
        {routePending ? (
          <p className="text-xs text-stone-500">
            {identifying ? "Identifying…" : `Calculating ${travelMode.toLowerCase()} route…`}
          </p>
        ) : routePreviewStatus === "failed" ? (
          <p className="text-xs text-amber-700">Route unavailable for {travelMode.toLowerCase()}</p>
        ) : routeReady ? (
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-[#0F766E]">
              {durationLabel} · {travelMode}
            </p>
            {routeCondition ? (
              <p className="flex items-center gap-1 text-xs font-medium text-amber-800">
                <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden />
                {routeCondition}
              </p>
            ) : (
              <p className="text-xs text-stone-500">{travelMode} route ready</p>
            )}
          </div>
        ) : null}
      </div>

      {onOpenDetails ? (
        <button
          type="button"
          onClick={onOpenDetails}
          className="flex h-8 shrink-0 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-stone-700 hover:bg-stone-100"
          aria-label="Open place details"
        >
          <Info className="h-3.5 w-3.5" />
          Details
        </button>
      ) : null}

      {onGo ? (
        <button
          type="button"
          onClick={onGo}
          disabled={!routeReady}
          className="flex h-8 shrink-0 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-white disabled:opacity-45"
          style={{ backgroundColor: TEAL }}
          aria-label="Start directions"
        >
          <Car className="h-3.5 w-3.5" />
          Go
        </button>
      ) : null}

      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-600"
          aria-label="Close route preview"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
