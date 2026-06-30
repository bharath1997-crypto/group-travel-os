"use client";

import { useState } from "react";
import { EXTERNAL_MAP_HANDOFF } from "@/lib/map-providers";
import type { PlacePreviewData } from "./PlacePreviewCard";
import type { LiveStage, TripStatus } from "./live-types";
import { estimateDriveEta, formatDistanceMiles } from "./live-types";

const TEAL = "#0F766E";

const TRIP_STATUSES: { key: TripStatus; label: string }[] = [
  { key: "on_the_way", label: "On the way" },
  { key: "stopping", label: "Stopping" },
  { key: "reached", label: "Reached" },
  { key: "running_late", label: "Running late" },
];

type Props = {
  destination: PlacePreviewData;
  liveStage: LiveStage;
  tripStatus: TripStatus;
  travelMode: string;
  onTripStatusChange: (status: TripStatus) => void;
  onBeginNavigation: () => void;
  onEndSoloLive: () => void;
  onSaveParking: () => void;
  onShareTrip: () => void;
  onAddStop: () => void;
};

export default function SoloLiveActivePanel({
  destination,
  liveStage,
  tripStatus,
  travelMode,
  onTripStatusChange,
  onBeginNavigation,
  onEndSoloLive,
  onSaveParking,
  onShareTrip,
  onAddStop,
}: Props) {
  const [moreOpen, setMoreOpen] = useState(false);
  const navigating = liveStage === "solo_drive_navigation";
  const mapsUrl = EXTERNAL_MAP_HANDOFF.googleDirections(destination.lat, destination.lng);

  return (
    <div
      className="absolute right-4 top-[72px] z-30 flex w-[336px] max-w-[calc(100%-2rem)] max-h-[calc(100%-6.5rem)] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_8px_30px_rgba(0,0,0,0.12)]"
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

        <div className="mt-4 space-y-1 border-t border-stone-100 pt-4 text-sm text-stone-700">
          <p>
            <span className="font-medium text-stone-500">ETA:</span>{" "}
            {estimateDriveEta(destination.distanceM)}
          </p>
          <p>
            <span className="font-medium text-stone-500">Distance:</span>{" "}
            {formatDistanceMiles(destination.distanceM)}
          </p>
          <p>
            <span className="font-medium text-stone-500">Status:</span>{" "}
            {navigating ? "Navigating" : "On the way"}
          </p>
        </div>

        <div className="mt-4 border-t border-stone-100 pt-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
            Trip status
          </p>
          <div className="grid grid-cols-2 gap-2">
            {TRIP_STATUSES.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => onTripStatusChange(key)}
                className={`rounded-xl border px-2 py-2 text-xs font-semibold ${
                  tripStatus === key
                    ? "border-[#0F766E] bg-teal-50 text-[#0F766E]"
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

        <div className="mt-4 grid grid-cols-2 gap-2">
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
            className="rounded-xl border border-stone-200 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
          >
            Add Stop
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              className="w-full rounded-xl border border-stone-200 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
            >
              More
            </button>
            {moreOpen ? (
              <div className="absolute right-0 top-full z-10 mt-1 w-44 rounded-xl border border-stone-200 bg-white py-1 shadow-lg">
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50"
                  onClick={() => setMoreOpen(false)}
                >
                  Open in Maps →
                </a>
              </div>
            ) : null}
          </div>
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
