"use client";

type GroupPulseProps = {
  totalMembers: number;
  totalVehicles: number;
  movingCount: number;
  stoppedCount: number;
  staleCount?: number;
  offlineCount: number;
  hasOnlineMember?: boolean;
  visible?: boolean;
};

export function GroupPulse({
  totalMembers = 0,
  totalVehicles = 0,
  movingCount = 0,
  stoppedCount = 0,
  staleCount = 0,
  offlineCount = 0,
  hasOnlineMember = false,
  visible = true,
}: GroupPulseProps) {
  if (!visible) return null;

  return (
    <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-stone-200 bg-white px-3 py-1.5 shadow-md animate-in fade-in slide-in-from-top-1 duration-200">
      <div className="flex items-center gap-1.5 text-xs font-bold text-stone-800">
        {hasOnlineMember ? (
          <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse shrink-0" />
        ) : (
          <span className="h-2 w-2 rounded-full bg-stone-300 shrink-0" />
        )}
        <span>
          {totalMembers} Member{totalMembers !== 1 ? "s" : ""} • {totalVehicles} Car{totalVehicles !== 1 ? "s" : ""} • Live
        </span>
      </div>
      
      <div className="h-4 w-px bg-stone-200" />
      
      <div className="flex items-center gap-1.5">
        <span className="flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[9px] font-bold text-green-700 border border-green-200">
          <span>🟢</span>
          Moving ({movingCount})
        </span>
        <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-bold text-amber-700 border border-amber-200">
          <span>🟡</span>
          Stopped ({stoppedCount})
        </span>
        {staleCount > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-[9px] font-bold text-orange-700 border border-orange-200">
            <span>🟠</span>
            Stale ({staleCount})
          </span>
        )}
        <span className="flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[9px] font-bold text-rose-700 border border-rose-200">
          <span>🔴</span>
          Offline ({offlineCount})
        </span>
      </div>
    </div>
  );
}
