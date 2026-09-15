"use client";

import type { PlacePreviewData } from "./PlacePreviewCard";
import type { LiveStage, TripStatus, RouteLine } from "./live-types";
import { estimateDriveEta, formatDistanceMiles, isActiveNavigationStage } from "./live-types";
import { LIVE_PANEL_MAX_WIDTH, LIVE_PANEL_RIGHT_INSET } from "./live-layout";

const TRIP_STATUSES: { key: TripStatus; label: string }[] = [
  { key: "on_the_way", label: "On the way" },
  { key: "stopping", label: "Stopping" },
  { key: "reached", label: "Reached" },
  { key: "running_late", label: "Running late" },
];

type Props = {
  destination: PlacePreviewData;
  plannedStops: PlacePreviewData[];
  addStopMode?: boolean;
  gpsManualMode?: boolean;
  liveStage: LiveStage;
  tripStatus: TripStatus;
  travelMode: string;
  onTripStatusChange: (status: TripStatus) => void;
  onBeginNavigation: () => void;
  onEndSoloLive: () => void;
  onSetStartingPoint: () => void;
  onSaveParking: () => void;
  onShareTrip: () => void;
  onAddStop: () => void;
  routeLine: RouteLine | null;
};

function RouteDash() {
  return (
    <div
      className="my-1 ml-3 border-l-2 border-dashed border-stone-300"
      style={{ height: 14 }}
      aria-hidden
    />
  );
}

export default function SoloLiveActivePanel({
  destination,
  plannedStops,
  addStopMode = false,
  gpsManualMode = false,
  liveStage,
  tripStatus,
  travelMode,
  onTripStatusChange,
  onBeginNavigation,
  onEndSoloLive,
  onSetStartingPoint,
  onSaveParking,
  onShareTrip,
  onAddStop,
  routeLine,
}: Props) {
  const navigating = isActiveNavigationStage(liveStage);
  const activeStatus = TRIP_STATUSES.find((s) => s.key === tripStatus);

  return (
    <div
      className={`absolute ${LIVE_PANEL_RIGHT_INSET} top-[72px] z-30 flex w-[336px] ${LIVE_PANEL_MAX_WIDTH} max-h-[calc(100%-6.5rem)] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_8px_30px_rgba(0,0,0,0.12)]`}
      role="dialog"
      aria-label="Solo live active"
    >
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
          Solo Live On · {travelMode}
        </p>
        <h3 className="mt-1 text-[22px] font-bold leading-tight text-stone-900">Solo Live</h3>
        <p className="mt-1 text-sm text-stone-600">
          Driving to {destination.name}
        </p>

        {addStopMode ? (
          <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-900">
            Add-stop mode — search or tap the map to pick your next stop.
          </p>
        ) : null}

        {gpsManualMode ? (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
            <p className="text-xs font-semibold text-amber-950">No GPS in this browser</p>
            <p className="mt-1 text-[11px] leading-snug text-amber-900">
              Double-tap the map or use the locate button to pick your starting point manually.
            </p>
            <button
              type="button"
              onClick={onSetStartingPoint}
              className="mt-2 w-full rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white hover:opacity-90"
            >
              Set starting point
            </button>
          </div>
        ) : null}

        <div className="mt-4 space-y-1 border-t border-stone-100 pt-4 text-sm text-stone-700">
          <p>
            <span className="font-medium text-stone-500">ETA:</span>{" "}
            {routeLine ? estimateDriveEta(routeLine.distanceMeters) : estimateDriveEta(destination.distanceM)}
          </p>
          <p>
            <span className="font-medium text-stone-500">Distance:</span>{" "}
            {routeLine ? formatDistanceMiles(routeLine.distanceMeters) : formatDistanceMiles(destination.distanceM)}
          </p>
          <p>
            <span className="font-medium text-stone-500">Process:</span>{" "}
            <span className="font-semibold text-emerald-700">
              {activeStatus?.label ?? (navigating ? "Navigating" : "On the way")}
            </span>
          </p>
        </div>

        {/* Route setup — destination + stops with dashed connectors */}
        <div className="mt-4 border-t border-stone-100 pt-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
            Route setup
          </p>
          <div className="rounded-xl border border-stone-100 bg-stone-50/80 px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">Destination</p>
            <p className="text-sm font-semibold text-stone-900">{destination.name}</p>
          </div>
          {plannedStops.map((stop, index) => (
            <div key={stop.placeKey ?? `${stop.lat}-${stop.lng}`}>
              <RouteDash />
              <div className="rounded-xl border border-stone-100 bg-white px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">
                  Stop {index + 1}
                </p>
                <p className="text-sm font-semibold text-stone-900">{stop.name}</p>
              </div>
            </div>
          ))}
          {plannedStops.length === 0 ? (
            <p className="mt-2 text-xs text-stone-400">No stops yet — tap Add Stop to build your route.</p>
          ) : null}
        </div>

        <div className="mt-4 border-t border-stone-100 pt-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
            Process
          </p>
          <div className="grid grid-cols-2 gap-2">
            {TRIP_STATUSES.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => onTripStatusChange(key)}
                className={`rounded-xl border px-2 py-2 text-xs font-semibold transition-colors ${
                  tripStatus === key
                    ? "border-emerald-600 bg-emerald-50 text-emerald-800 shadow-sm"
                    : "border-stone-200 text-stone-700 hover:bg-stone-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {!navigating ? (
          <button
            type="button"
            onClick={onBeginNavigation}
            className="mt-4 w-full rounded-xl border border-stone-200 py-2.5 text-sm font-semibold text-stone-800 hover:bg-stone-50"
          >
            Begin Navigation
          </button>
        ) : null}

        <div className="mt-4 grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={onSaveParking}
            className="rounded-xl border border-stone-200 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
          >
            Save Parking
          </button>
          <button
            type="button"
            onClick={onShareTrip}
            className="rounded-xl border border-stone-200 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
          >
            Share Trip
          </button>
          <button
            type="button"
            onClick={onAddStop}
            className={`rounded-xl border py-2 text-xs font-semibold transition-colors ${
              addStopMode
                ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                : "border-stone-200 text-stone-700 hover:bg-stone-50"
            }`}
          >
            Add Stop
          </button>
        </div>
      </div>

      <div className="shrink-0 border-t border-stone-100 p-4">
        <button
          type="button"
          onClick={onEndSoloLive}
          className="w-full rounded-full py-3 text-sm font-semibold text-white hover:opacity-90"
          style={{ backgroundColor: "#b91c1c" }}
        >
          End Solo Live
        </button>
      </div>
    </div>
  );
}
