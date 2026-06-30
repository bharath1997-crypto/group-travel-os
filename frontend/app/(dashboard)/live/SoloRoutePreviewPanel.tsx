"use client";

import type { PlacePreviewData } from "./PlacePreviewCard";
import {
  canStartSoloLive,
  estimateDriveEta,
  formatDistanceMiles,
  isFarFromUser,
  isLongDistanceFromUser,
} from "./live-types";

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
}: Props) {
  const farWarning = isFarFromUser(destination.distanceM);
  const longDistance = isLongDistanceFromUser(destination.distanceM) || planningMode;
  const showStartLive = canStartSoloLive(destination.distanceM) && !planningMode;

  return (
    <div
      className="absolute right-4 top-[72px] z-30 flex w-[336px] max-w-[calc(100%-2rem)] max-h-[calc(100%-6.5rem)] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_8px_30px_rgba(0,0,0,0.12)]"
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

        <div className="mt-4 space-y-2 border-t border-stone-100 pt-4 text-sm text-stone-700">
          <p>
            <span className="font-medium text-stone-500">Travel mode:</span> {travelMode}
          </p>
          <p>
            <span className="font-medium text-stone-500">ETA:</span>{" "}
            {longDistance ? "Plan trip first" : estimateDriveEta(destination.distanceM)}
          </p>
          <p>
            <span className="font-medium text-stone-500">Distance:</span>{" "}
            {formatDistanceMiles(destination.distanceM)}
          </p>
          <p className="leading-snug">
            <span className="font-medium text-stone-500">Address:</span>
            <br />
            {destination.address}
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
            className="w-full rounded-full py-3 text-sm font-semibold text-white hover:opacity-90"
            style={{ backgroundColor: TEAL }}
          >
            Start Solo Live
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
      </div>
    </div>
  );
}
