"use client";

import { useState } from "react";
import { Car, Bike, Compass, User, PencilLine, Clock, Navigation } from "lucide-react";
import { formatRouteDuration } from "./live-types";

interface LiveMiniHudProps {
  travelMode: "Drive" | "Bike" | "Trek" | "Walk";
  workflowType: "Solo" | "Group Travel" | "Seat Share";
  speedMps: number | null;
  durationSeconds: number | null;
  onEdit: () => void;
}

export default function LiveMiniHud({
  travelMode,
  workflowType,
  speedMps,
  durationSeconds,
  onEdit,
}: LiveMiniHudProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Convert speed: m/s to mph
  const speedMph = speedMps !== null ? Math.round(speedMps * 2.23694) : null;

  // Movement indicator logic
  let movementState: "idle" | "slow" | "moving" = "idle";
  if (speedMps !== null && speedMps > 0) {
    if (speedMps < 2.5) {
      // under ~5.5 mph (walking speed or slow crawl)
      movementState = "slow";
    } else {
      movementState = "moving";
    }
  }

  const movementColors = {
    idle: { dot: "bg-stone-400", bg: "bg-stone-100", text: "text-stone-600", label: "Idle / Stopped" },
    slow: { dot: "bg-amber-500 animate-pulse", bg: "bg-amber-50", text: "text-amber-700", label: "Slow Movement" },
    moving: { dot: "bg-[#007F73]", bg: "bg-[#E6F7F4]", text: "text-[#007F73]", label: "Active Movement" },
  };

  const currentMovement = movementColors[movementState];

  const renderModeIcon = (size = "w-4 h-4") => {
    switch (travelMode) {
      case "Bike":
        return <Bike className={`${size} text-[#007F73]`} />;
      case "Trek":
        return <Compass className={`${size} text-[#007F73]`} />;
      case "Walk":
        return <User className={`${size} text-[#007F73]`} />;
      case "Drive":
      default:
        return <Car className={`${size} text-[#007F73]`} />;
    }
  };

  if (!isExpanded) {
    return (
      <div
        onClick={() => setIsExpanded(true)}
        className="flex items-center gap-3 px-3 py-2 rounded-full bg-white/95 backdrop-blur-md border border-[rgba(15,23,42,0.10)] shadow-[0_8px_24px_rgba(15,23,42,0.10)] hover:bg-stone-50 cursor-pointer select-none transition-all duration-200 animate-in fade-in zoom-in-95 duration-300"
        title="Click to view trip details"
      >
        {/* Pulsing Green Live Dot */}
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
        </span>

        {/* Icon group: travel mode / person / edit */}
        <div className="flex items-center gap-1.5">
          {renderModeIcon("w-3.5 h-3.5")}
          <span className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider">
            {workflowType === "Solo" ? "Solo" : workflowType === "Group Travel" ? "Group" : "Share"}
          </span>
          <div className="w-[1px] h-3 bg-stone-200" />
          <PencilLine className="w-3 h-3 text-stone-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-64 rounded-2xl bg-white/95 backdrop-blur-xl border border-[rgba(15,23,42,0.10)] p-4 shadow-[0_8px_24px_rgba(15,23,42,0.10)] text-stone-800 flex flex-col gap-3.5 animate-in fade-in slide-in-from-top-2 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-xs font-bold text-stone-700 uppercase tracking-wider">Live Trip HUD</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="p-1.5 rounded-full hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors"
            title="Edit setup"
          >
            <PencilLine className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setIsExpanded(false)}
            className="text-[10px] font-bold text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-full w-6 h-6 flex items-center justify-center transition-colors"
            title="Collapse"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Grid: Speed & Travel Time */}
      <div className="grid grid-cols-2 gap-2">
        {/* Speed Card */}
        <div className="flex flex-col p-2.5 rounded-xl bg-stone-50 border border-stone-100">
          <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">Speed</span>
          <span className="text-lg font-extrabold text-stone-800 mt-1">
            {speedMph !== null ? `${speedMph} mph` : "-- mph"}
          </span>
        </div>

        {/* Travel Time Card */}
        <div className="flex flex-col p-2.5 rounded-xl bg-stone-50 border border-stone-100">
          <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">Rem. Time</span>
          <div className="flex items-center gap-1 mt-1 text-stone-800 font-bold text-sm">
            <Clock className="w-3.5 h-3.5 text-[#007F73]" />
            <span>
              {durationSeconds !== null
                ? formatRouteDuration(durationSeconds)
                : "N/A"}
            </span>
          </div>
        </div>
      </div>

      {/* Movement Indicator Status */}
      <div className={`flex items-center justify-between px-3 py-2 rounded-xl ${currentMovement.bg} border border-transparent transition-all duration-300`}>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${currentMovement.dot}`} />
          <span className={`text-xs font-bold ${currentMovement.text}`}>{currentMovement.label}</span>
        </div>
        <Navigation className={`w-3.5 h-3.5 ${currentMovement.text}`} />
      </div>
    </div>
  );
}
