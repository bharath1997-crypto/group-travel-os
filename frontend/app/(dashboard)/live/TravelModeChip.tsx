"use client";

import { MouseEvent } from "react";
import { Car, Bike, Compass, User, Users, Armchair } from "lucide-react";

export type TravelModeStatus = "idle" | "route_ready" | "live_active";

interface TravelModeChipProps {
  travelMode: "Drive" | "Bike" | "Trek" | "Walk";
  workflowType: "Solo" | "Group Travel" | "Seat Share";
  status: TravelModeStatus;
  onClickEdit: (e: MouseEvent) => void;
  isOpen: boolean;
}

export default function TravelModeChip({
  travelMode,
  workflowType,
  status,
  onClickEdit,
  isOpen,
}: TravelModeChipProps) {
  // Travel mode icon selection
  const renderModeIcon = () => {
    const sizeClass = status === "live_active" ? "w-4 h-4 text-emerald-600" : "w-4 h-4 text-stone-600";
    switch (travelMode) {
      case "Bike":
        return <Bike className={sizeClass} />;
      case "Trek":
        return <Compass className={sizeClass} />;
      case "Walk":
        return <User className={sizeClass} />;
      case "Drive":
      default:
        return <Car className={sizeClass} />;
    }
  };

  // Workflow icon selection
  const renderWorkflowIcon = () => {
    const sizeClass = status === "live_active"
      ? "w-3.5 h-3.5 text-emerald-600 hover:text-emerald-800 transition-colors"
      : "w-3.5 h-3.5 text-stone-500 hover:text-stone-700 transition-colors";
    switch (workflowType) {
      case "Group Travel":
        return <Users className={sizeClass} />;
      case "Seat Share":
        return <Armchair className={sizeClass} />;
      case "Solo":
      default:
        return <User className={sizeClass} />;
    }
  };

  // Status dot color mapping: Red for idle/stopped, Green for active/started
  const dotColorClass =
    status === "live_active"
      ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse"
      : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]";

  return (
    <div className="relative shrink-0 select-none">
      {/* Container: split pill shape (capsule style circular control) */}
      <div
        className={`flex h-8 items-center rounded-full border px-2 py-0.5 shadow-sm transition-all duration-200 ${
          status === "live_active"
            ? "border-emerald-500/30 bg-emerald-50/50"
            : isOpen
              ? "border-primary bg-primary-soft/30 ring-1 ring-[#0F766E]/20"
              : "border-stone-200 hover:border-primary/40 hover:bg-stone-50"
        }`}
      >
        {/* Left half: Mode Icon */}
        <div className="flex w-6 items-center justify-center" title={`Travel mode: ${travelMode}`}>
          {renderModeIcon()}
        </div>

        {/* Vertical Divider */}
        <div className="mx-0.5 h-3.5 w-[1px] bg-stone-200" />

        {/* Right half: Edit Button displaying workflow symbol */}
        <button
          type="button"
          onClick={onClickEdit}
          className="flex w-6 items-center justify-center rounded-full py-1 hover:bg-stone-100 transition-colors"
          title="Change travel mode or workflow"
          aria-label="Edit travel mode or workflow"
        >
          {renderWorkflowIcon()}
        </button>
      </div>

      {/* Small status dot sits on the circle edge */}
      <span
        className={`absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white ${dotColorClass} transition-all duration-300`}
        title={`Status: ${status}`}
      />
    </div>
  );
}

