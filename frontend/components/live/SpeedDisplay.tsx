"use client";

type SpeedDisplayProps = {
  currentSpeedMph: number;
  speedLimitMph?: number | null;
  etaTimeText?: string; // e.g. "12:45 PM"
  durationText?: string; // e.g. "2h 15m"
  distanceText?: string; // e.g. "118 mi"
  visible?: boolean;
};

export function SpeedDisplay({
  currentSpeedMph = 0,
  speedLimitMph = 55,
  etaTimeText = "2:15 PM",
  durationText = "2h 15m",
  distanceText = "118 mi",
  visible = true,
}: SpeedDisplayProps) {
  if (!visible) return null;

  // Determine if speeding
  const isSpeeding = speedLimitMph ? currentSpeedMph > speedLimitMph : false;

  return (
    <div className="absolute bottom-3 left-3 right-3 z-[115] pointer-events-none flex items-end justify-between">
      
      {/* Speed & Speed Limit */}
      <div className="flex items-center gap-2 pointer-events-auto">
        {/* Current Speed circle */}
        <div className={`flex h-16 w-16 flex-col items-center justify-center rounded-full bg-[#0F172A] text-white border-2 shadow-2xl transition ${
          isSpeeding ? "border-red-500 ring-4 ring-red-500/20" : "border-slate-800"
        }`}>
          <span className="text-xl font-black leading-none">{currentSpeedMph}</span>
          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">mph</span>
        </div>

        {/* Speed Limit sign */}
        {speedLimitMph && (
          <div className="flex h-14 w-11 flex-col items-center justify-center rounded-lg bg-white border-2 border-red-600 shadow-xl p-0.5">
            <span className="text-[7px] font-black text-stone-800 uppercase tracking-tight leading-none">Speed</span>
            <span className="text-[7px] font-black text-stone-800 uppercase tracking-tight leading-none">Limit</span>
            <span className="text-lg font-black text-stone-900 leading-none mt-1">{speedLimitMph}</span>
          </div>
        )}
      </div>

      {/* ETA Destination Bar (Center-aligned bottom widget) */}
      <div className="pointer-events-auto rounded-2xl bg-white border border-stone-200 px-5 py-3 shadow-2xl text-center flex flex-col justify-center min-w-[200px] max-w-xs mx-auto">
        <p className="text-[9px] font-extrabold uppercase tracking-widest text-stone-400">
          ETA to Destination
        </p>
        <p className="text-2xl font-black text-stone-900 mt-0.5 leading-none">{etaTimeText}</p>
        <p className="text-xs font-bold text-stone-500 mt-1.5 leading-none">
          {durationText} · {distanceText}
        </p>
      </div>

      {/* Right placeholder to balance flex container layout */}
      <div className="w-16 h-16 pointer-events-none" />

    </div>
  );
}
