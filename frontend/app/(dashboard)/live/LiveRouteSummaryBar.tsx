"use client";

import { Car, Info, X } from "lucide-react";
import { LIVE_ROUTE_SUMMARY_BOTTOM } from "./live-layout";
import { formatRouteDurationBracketed, type RoutePreviewStatus } from "./live-types";

const TEAL = "#0F766E";

type Props = {
  destinationName: string;
  durationSeconds?: number | null;
  routePreviewStatus?: RoutePreviewStatus;
  routeLoading?: boolean;
  identifying?: boolean;
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
  onOpenDetails,
  onGo,
  onClose,
}: Props) {
  const routeReady = routePreviewStatus === "ready" && durationSeconds != null;
  const routePending = identifying || routeLoading || routePreviewStatus === "loading";
  const timeBracket = routeReady ? formatRouteDurationBracketed(durationSeconds) : "";

  return (
    <div
      className={`pointer-events-auto fixed left-1/2 z-[135] w-[min(22rem,calc(100%-1.5rem))] -translate-x-1/2 ${LIVE_ROUTE_SUMMARY_BOTTOM} flex items-center gap-1.5 rounded-xl border border-stone-200/90 bg-white/95 px-2 py-2 shadow-md backdrop-blur-md`}
      role="region"
      aria-label="Route preview summary"
    >
      <div className="min-w-0 flex-1 px-1">
        <p className="truncate text-sm font-semibold leading-snug text-stone-900">
          {destinationName}
          {routeReady && timeBracket ? (
            <span className="font-semibold text-[#0F766E]"> {timeBracket}</span>
          ) : null}
        </p>
        {routePending ? (
          <p className="text-xs text-stone-500">{identifying ? "Identifying…" : "Calculating route…"}</p>
        ) : routePreviewStatus === "failed" ? (
          <p className="text-xs text-amber-700">Route unavailable</p>
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
