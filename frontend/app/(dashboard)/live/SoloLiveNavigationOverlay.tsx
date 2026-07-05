"use client";

import {
  Car,
  Coffee,
  ParkingCircle,
  Plus,
  Share2,
} from "lucide-react";
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
};

function getManeuverType(instruction: string): "left" | "right" | "straight" {
  const instrLower = instruction.toLowerCase();
  if (instrLower.includes("left")) return "left";
  if (instrLower.includes("right")) return "right";
  return "straight";
}

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
}: Props) {
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

  const mType = getManeuverType(nextManeuver);
  let maneuverIcon = "↑";
  let laneConfig: { arrow: string; active: boolean }[] = [];

  if (mType === "left") {
    maneuverIcon = "↰";
    laneConfig = [
      { arrow: "↰", active: true },
      { arrow: "↑", active: false },
      { arrow: "↑", active: false },
      { arrow: "↱", active: false },
    ];
  } else if (mType === "right") {
    maneuverIcon = "↱";
    laneConfig = [
      { arrow: "↰", active: false },
      { arrow: "↑", active: false },
      { arrow: "↑", active: false },
      { arrow: "↱", active: true },
    ];
  } else {
    maneuverIcon = "↑";
    laneConfig = [
      { arrow: "↰", active: false },
      { arrow: "↑", active: true },
      { arrow: "↑", active: true },
      { arrow: "↱", active: false },
    ];
  }

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
      <div className="absolute left-1/2 top-4 z-20 w-[min(440px,calc(100%-2rem))] -translate-x-1/2 rounded-2xl bg-white/95 backdrop-blur-md py-5 px-5 shadow-[0_12px_38px_rgba(0,0,0,0.1)] border border-stone-100/80">
        <div className="flex items-start gap-3.5">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl font-bold text-white shadow-sm"
            style={{ backgroundColor: TEAL }}
          >
            {maneuverIcon}
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="text-[19px] font-extrabold leading-snug tracking-tight text-stone-900">
              {nextManeuver}
            </p>
            <p className="mt-1 text-xs font-bold text-stone-400 uppercase tracking-wider">{maneuverMi} MI</p>
          </div>
        </div>
        <div className="mt-4 flex gap-1.5">
          {laneConfig.map((lane, i) => (
            <div
              key={i}
              className={`flex h-9 flex-1 items-center justify-center rounded-xl text-sm transition-colors ${
                lane.active ? "bg-teal-50 font-bold text-[#0F766E] border border-teal-600/10" : "bg-stone-50 text-stone-450 border border-stone-200/40"
              }`}
            >
              {lane.arrow}
            </div>
          ))}
        </div>
      </div>

      {/* Speed */}
      <div className="absolute bottom-[calc(200px+env(safe-area-inset-bottom,0px))] md:bottom-[154px] left-4 z-20 rounded-2xl bg-white px-4 py-3 shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-stone-100/60">
        <p className="text-3xl font-extrabold leading-none text-stone-900">{speedMph || "—"}</p>
        <p className="mt-1 text-[10px] font-bold tracking-wide text-stone-400 uppercase">MPH</p>
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
      <div className="absolute left-1/2 bottom-[calc(76px+env(safe-area-inset-bottom,0px))] md:bottom-6 z-20 w-[min(440px,calc(100%-2rem))] -translate-x-1/2 flex flex-col gap-2.5">
        <div className="flex justify-center gap-2">
          {[
            { label: "Save Parking", icon: ParkingCircle, onClick: onSaveParking },
            { label: "Share Trip", icon: Share2, onClick: onShareTrip },
            { label: "Add Stop", icon: Plus, onClick: onAddStop },
          ].map(({ label, icon: Icon, onClick }) => (
            <button
              key={label}
              type="button"
              onClick={onClick}
              className="flex items-center gap-1.5 rounded-full border border-stone-200 bg-white/95 backdrop-blur-md px-3.5 py-2 text-[10px] font-bold uppercase tracking-wide text-stone-700 shadow-md hover:bg-stone-50 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Icon className="h-3.5 w-3.5" style={{ color: TEAL }} />
              {label}
            </button>
          ))}
        </div>

        <div className="flex w-full items-center gap-3 rounded-2xl bg-white/95 backdrop-blur-md px-4 py-4 shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-stone-100/80">
          <div className="grid flex-1 grid-cols-3 gap-2 text-center pr-2 border-r border-stone-100">
            <div>
              <p className="text-[17px] font-black text-stone-900 leading-tight">{etaLabel}</p>
              <p className="text-[9px] font-bold uppercase tracking-wider text-stone-400 mt-0.5">ETA</p>
            </div>
            <div>
              <p className="text-[17px] font-black text-stone-900 leading-tight">
                {formatDistanceMiles(destination.distanceM)}
              </p>
              <p className="text-[9px] font-bold uppercase tracking-wider text-stone-400 mt-0.5">Distance</p>
            </div>
            <div>
              <p className="text-[17px] font-black text-stone-900 leading-tight">{arrival}</p>
              <p className="text-[9px] font-bold uppercase tracking-wider text-stone-400 mt-0.5">Arrival</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onEndSoloLive}
            className="shrink-0 rounded-xl bg-red-600 px-6 py-3.5 text-xs font-black uppercase tracking-wider text-white shadow-sm hover:bg-red-700 transition-colors active:scale-[0.97]"
          >
            End
          </button>
        </div>
      </div>
    </>
  );
}
