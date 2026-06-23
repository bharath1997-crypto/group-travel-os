"use client";

import { Activity } from "lucide-react";

type GroupPulseProps = {
  totalMembers: number;
  totalVehicles: number;
  movingCount: number;
  stoppedCount: number;
  offlineCount: number;
  visible?: boolean;
};

export function GroupPulse({
  totalMembers = 8,
  totalVehicles = 3,
  movingCount = 6,
  stoppedCount = 1,
  offlineCount = 1,
  visible = true,
}: GroupPulseProps) {
  if (!visible) return null;

  return (
    <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-stone-200 bg-white px-3 py-1.5 shadow-md animate-in fade-in slide-in-from-top-1 duration-200">
      <div className="flex items-center gap-1.5 text-xs font-bold text-stone-800">
        <Activity size={14} className="text-[#0F766E] animate-pulse" />
        <span>{totalMembers} Members • {totalVehicles} Cars</span>
      </div>
      
      <div className="h-4 w-px bg-stone-200" />
      
      <div className="flex items-center gap-1">
        <span className="flex items-center gap-0.5 rounded-full bg-green-50 px-2 py-0.5 text-[9px] font-bold text-green-700 border border-green-200">
          <span className="h-1 w-1 rounded-full bg-green-500" />
          {movingCount}
        </span>
        <span className="flex items-center gap-0.5 rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-bold text-amber-700 border border-amber-200">
          <span className="h-1 w-1 rounded-full bg-amber-500" />
          {stoppedCount}
        </span>
        <span className="flex items-center gap-0.5 rounded-full bg-rose-50 px-2 py-0.5 text-[9px] font-bold text-rose-700 border border-rose-200">
          <span className="h-1 w-1 rounded-full bg-rose-500" />
          {offlineCount}
        </span>
      </div>
    </div>
  );
}
