"use client";

import { useState } from "react";
import {
  Car,
  Coffee,
  Map,
  Navigation,
  ParkingCircle,
  Plus,
  Share2,
  Info,
} from "lucide-react";
import { EXTERNAL_MAP_HANDOFF } from "@/lib/map-providers";
import type { PlacePreviewData } from "./PlacePreviewCard";
import type { TripStatus, RouteLine } from "./live-types";
import {
  estimateDriveEta,
  etaMinutesFromDistance,
  formatArrivalTime,
  formatDistanceMiles,
  speedMpsToMph,
} from "./live-types";

const TEAL = "#0F766E";

const TRIP_STATUSES: { key: TripStatus; label: string }[] = [
  { key: "on_the_way", label: "On the way" },
  { key: "stopping", label: "Stopping" },
  { key: "reached", label: "Reached" },
  { key: "running_late", label: "Running late" },
];

type Props = {
  destination: PlacePreviewData;
  travelMode: string;
  speedMps: number | null;
  tripStatus: TripStatus;
  onTripStatusChange: (status: TripStatus) => void;
  onEndSoloLive: () => void;
  onSaveParking: () => void;
  onShareTrip: () => void;
  onAddStop: () => void;
  routeLine: RouteLine | null;
  onOverviewClick: () => void;
};

export default function SoloLiveNavigationOverlay({
  destination,
  travelMode,
  speedMps,
  tripStatus,
  onTripStatusChange,
  onEndSoloLive,
  onSaveParking,
  onShareTrip,
  onAddStop,
  routeLine,
  onOverviewClick,
}: Props) {
  const [statusOpen, setStatusOpen] = useState(false);
  const speedMph = speedMpsToMph(speedMps);
  const etaMin = etaMinutesFromDistance(destination.distanceM);
  const etaLabel = estimateDriveEta(destination.distanceM);
  const arrival = formatArrivalTime(etaMin);
  const nextManeuver = (routeLine?.maneuvers && routeLine.maneuvers.length > 0)
    ? routeLine.maneuvers[0].instruction
    : (routeLine ? "Follow highlighted route" : `Continue toward ${destination.name}`);
  const maneuverMi = destination.distanceM
    ? Math.max(0.1, (destination.distanceM / 1609.34) * 0.35).toFixed(1)
    : "0.8";

  const mapsUrl = EXTERNAL_MAP_HANDOFF.googleDirections(destination.lat, destination.lng);
  const wazeUrl = EXTERNAL_MAP_HANDOFF.wazeNavigate(destination.lat, destination.lng);

  return (
    <>
      {/* Top-left live badges */}
      <div className="absolute left-4 top-4 z-20 flex flex-col gap-2">
        <div
          className="rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white shadow-md"
          style={{ backgroundColor: TEAL }}
        >
          • Solo Live On
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide shadow-md text-[#0F766E]">
          <Car className="h-3.5 w-3.5" />
          {travelMode}
        </div>
      </div>

      {/* Turn-by-turn card */}
      <div className="absolute left-1/2 top-4 z-20 w-[min(440px,calc(100%-2rem))] -translate-x-1/2 rounded-2xl bg-white p-4 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
        <div className="flex items-start gap-3">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl font-bold text-white"
            style={{ backgroundColor: TEAL }}
          >
            ↱
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold leading-snug text-stone-900">
              {nextManeuver}
            </p>
            <p className="mt-0.5 text-sm font-semibold text-stone-500">{maneuverMi} MI</p>
          </div>
        </div>
        <div className="mt-3 flex gap-1">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`flex h-8 flex-1 items-center justify-center rounded-md text-sm ${
                i >= 2 ? "bg-teal-50 font-bold text-[#0F766E]" : "bg-stone-100 text-stone-400"
              }`}
            >
              {i >= 2 ? "↱" : "↑"}
            </div>
          ))}
        </div>
      </div>

      {/* Speed */}
      <div className="absolute bottom-[148px] left-4 z-20 rounded-2xl bg-white px-4 py-3 shadow-lg">
        <p className="text-3xl font-bold leading-none text-stone-900">{speedMph || "—"}</p>
        <p className="mt-1 text-[10px] font-bold tracking-wide text-stone-500">MPH</p>
        <div className="mt-2 flex gap-0.5">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={`h-1.5 w-4 rounded-full ${speedMph > i * 8 ? "bg-[#0F766E]" : "bg-stone-200"}`}
            />
          ))}
        </div>
      </div>

      {/* Bottom controls */}
      <div className="absolute inset-x-0 bottom-0 z-20 px-3 pb-3">
        <div className="mx-auto mb-2 flex max-w-4xl flex-wrap justify-center gap-2">
          {[
            { label: "Save Parking", icon: ParkingCircle, onClick: onSaveParking },
            { label: "Share Trip", icon: Share2, onClick: onShareTrip },
            { label: "Add Stop", icon: Plus, onClick: onAddStop },
            {
              label: "Overview",
              icon: Map,
              onClick: onOverviewClick,
            },
            {
              label: "Waze",
              icon: Navigation,
              href: wazeUrl,
            },
            {
              label: "Maps",
              icon: Map,
              href: mapsUrl,
            },
            {
              label: "Status",
              icon: Info,
              onClick: () => setStatusOpen((v) => !v),
            },
          ].map(({ label, icon: Icon, onClick, href }) =>
            href ? (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-stone-700 shadow-sm hover:bg-stone-50"
              >
                <Icon className="h-3.5 w-3.5" style={{ color: TEAL }} />
                {label}
              </a>
            ) : (
              <button
                key={label}
                type="button"
                onClick={onClick}
                className="flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-stone-700 shadow-sm hover:bg-stone-50"
              >
                <Icon className="h-3.5 w-3.5" style={{ color: TEAL }} />
                {label}
              </button>
            ),
          )}
        </div>

        {statusOpen ? (
          <div className="mx-auto mb-2 max-w-md rounded-xl border border-stone-200 bg-white p-3 shadow-lg">
            <p className="mb-2 text-xs font-semibold uppercase text-stone-500">Trip status</p>
            <div className="grid grid-cols-2 gap-2">
              {TRIP_STATUSES.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    onTripStatusChange(key);
                    setStatusOpen(false);
                  }}
                  className={`rounded-lg border px-2 py-2 text-xs font-semibold ${
                    tripStatus === key
                      ? "border-[#0F766E] bg-teal-50 text-[#0F766E]"
                      : "border-stone-200 text-stone-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mx-auto flex max-w-4xl items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
          <div className="grid shrink-0 grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-lg font-bold text-stone-900">{etaLabel}</p>
              <p className="text-[10px] font-semibold uppercase text-stone-500">ETA</p>
            </div>
            <div>
              <p className="text-lg font-bold text-stone-900">
                {formatDistanceMiles(destination.distanceM)}
              </p>
              <p className="text-[10px] font-semibold uppercase text-stone-500">Distance</p>
            </div>
            <div>
              <p className="text-lg font-bold text-stone-900">{arrival}</p>
              <p className="text-[10px] font-semibold uppercase text-stone-500">Arrival</p>
            </div>
          </div>
          <div className="hidden min-w-0 flex-1 items-center gap-2 sm:flex">
            <Coffee className="h-5 w-5 shrink-0" style={{ color: TEAL }} />
            <p className="truncate text-sm font-semibold text-stone-800">{destination.name}</p>
          </div>
          <button
            type="button"
            onClick={onEndSoloLive}
            className="shrink-0 rounded-xl bg-red-600 px-5 py-3 text-sm font-bold uppercase tracking-wide text-white hover:bg-red-700"
          >
            End
          </button>
        </div>
      </div>
    </>
  );
}
