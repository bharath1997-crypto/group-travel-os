"use client";

import { MouseEvent } from "react";
import { Car, Bike, Compass, User, Pencil } from "lucide-react";

export type TravelModeStatus = "idle" | "route_ready" | "live_active";

interface TravelModeChipProps {
  travelMode: "Drive" | "Bike" | "Trek" | "Walk";
  status: TravelModeStatus;
  onClickEdit: (e: MouseEvent) => void;
  isOpen: boolean;
}

export default function TravelModeChip({
  travelMode,
  status,
  onClickEdit,
  isOpen,
}: TravelModeChipProps) {
  // Travel mode icon selection
  const renderModeIcon = () => {
    const sizeClass = "w-4 h-4 text-stone-600";
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

  // Status dot color mapping
  const dotColorClass =
    status === "live_active"
      ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"
      : status === "route_ready"
        ? "bg-[#007F73] shadow-[0_0_8px_rgba(0,127,115,0.6)]"
        : "bg-stone-400";

  return (
    <div className="relative shrink-0 select-none">
      {/* Container: split pill shape (capsule style circular control) */}
      <div
        className={`flex h-8 items-center rounded-full border bg-white px-2 py-0.5 shadow-sm transition-all duration-200 ${
          isOpen
            ? "border-[#007F73] bg-[#E6F7F4]/30 ring-1 ring-[#007F73]/20"
            : "border-stone-200 hover:border-[#007F73]/40 hover:bg-stone-50"
        }`}
      >
        {/* Left half: Mode Icon */}
        <div className="flex w-6 items-center justify-center" title={`Travel mode: ${travelMode}`}>
          {renderModeIcon()}
        </div>

        {/* Vertical Divider */}
        <div className="mx-0.5 h-3.5 w-[1px] bg-stone-200" />

        {/* Right half: Edit Button */}
        <button
          type="button"
          onClick={onClickEdit}
          className="flex w-6 items-center justify-center rounded-full py-1 hover:bg-stone-100 transition-colors"
          title="Change travel mode or workflow"
          aria-label="Edit travel mode or workflow"
        >
          <Pencil className="w-3.5 h-3.5 text-stone-400 hover:text-stone-700" />
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
