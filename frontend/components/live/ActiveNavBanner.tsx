"use client";

import { Navigation, ArrowUpRight, ArrowUpLeft, ArrowLeft, ArrowRight, CornerUpRight, CornerUpLeft } from "lucide-react";

type ActiveNavBannerProps = {
  distanceText: string; // e.g. "0.8 mi" or "350 ft"
  maneuverType: string; // e.g. "Turn right" or "Take exit 12"
  roadName: string; // e.g. "US-24 W" or "Interstate 70"
  lanes?: number; // e.g. 4
};

export function ActiveNavBanner({
  distanceText = "0.8 mi",
  maneuverType = "Turn right",
  roadName = "US-24 W",
  lanes = 4,
}: ActiveNavBannerProps) {
  // Arrow component mapping based on maneuver text
  const getManeuverIcon = (desc: string) => {
    const d = desc.toLowerCase();
    if (d.includes("right")) return <ArrowUpRight className="h-7 w-7 text-green-400" />;
    if (d.includes("left")) return <ArrowUpLeft className="h-7 w-7 text-green-400" />;
    if (d.includes("exit") || d.includes("merge")) return <CornerUpRight className="h-7 w-7 text-green-400" />;
    return <Navigation className="h-7 w-7 text-green-400 rotate-45" />;
  };

  return (
    <div className="absolute left-3 top-3 z-[115] w-[260px] md:w-[300px] overflow-hidden rounded-2xl bg-[#0F172A] text-white shadow-2xl border border-slate-800 pointer-events-auto animate-in slide-in-from-top-4 duration-200">
      <div className="flex items-center gap-3.5 px-4 py-3.5">
        <span className="rounded-full bg-slate-850 p-2 shrink-0 border border-slate-800">
          {getManeuverIcon(maneuverType)}
        </span>
        <div className="min-w-0">
          <p className="text-xl font-bold tracking-tight text-white">{distanceText}</p>
          <p className="text-xs font-semibold text-slate-300 mt-0.5">{maneuverType}</p>
          <p className="text-[10px] font-bold text-slate-400 truncate mt-0.5 uppercase tracking-wide">
            {roadName || "Road"}
          </p>
        </div>
      </div>
      
      {/* Lane arrows strip */}
      {lanes > 0 && (
        <div className="flex items-center justify-center gap-4 bg-slate-950/60 py-2 border-t border-slate-900 px-4">
          {Array.from({ length: lanes }).map((_, idx) => (
            <span
              key={idx}
              className={`text-sm font-extrabold ${
                idx === lanes - 1 ? "text-green-400 animate-pulse" : "text-slate-500"
              }`}
              title={idx === lanes - 1 ? "Turn Lane" : "Straight Lane"}
            >
              ↑
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
