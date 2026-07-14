"use client";

import type { LiveMapLayer } from "@/lib/map-providers";
import { LIVE_MAP_COMPASS_POSITION } from "./live-layout";
import { isLiveMapDarkLayer, liveMapRightBtn, liveMapRightShell } from "./live-map-right-controls";

type NorthArrowProps = {
  bearing: number;
  size: number;
  isDark: boolean;
};

/** Sharp teardrop north pointer — no outer ring (Google Maps–style). */
function NorthArrow({ bearing, size, isDark }: NorthArrowProps) {
  const north = isDark ? "#F87171" : "#DC2626";
  const south = isDark ? "rgba(148,163,184,0.95)" : "rgba(100,116,139,0.9)";

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden
      className="pointer-events-none transition-transform duration-200 ease-out"
      style={{ transform: `rotate(${-bearing}deg)` }}
    >
      <path d="M12 2.5 L15.2 12 L12 9.8 L8.8 12 Z" fill={north} />
      <path d="M12 21.5 L8.8 12 L12 14.2 L15.2 12 Z" fill={south} />
      <circle cx="12" cy="12" r="1.1" fill={isDark ? "rgba(226,232,240,0.9)" : "rgba(15,23,42,0.45)"} />
    </svg>
  );
}

type Props = {
  bearing: number;
  onResetNorth: () => void;
  activeLayer: LiveMapLayer;
  /** When true, parent handles positioning (T-zone stack). */
  embedded?: boolean;
};

export default function LiveMapCompass({ bearing, onResetNorth, activeLayer, embedded = false }: Props) {
  const isDark = isLiveMapDarkLayer(activeLayer);
  const normalizedBearing = ((bearing % 360) + 360) % 360;
  const offNorth = normalizedBearing > 0.5 && normalizedBearing < 359.5;

  const shell = (
    <button
      type="button"
      onClick={() => {
        if (offNorth) onResetNorth();
      }}
      className={`rounded-lg p-1.5 transition-all duration-200 ${liveMapRightShell(isDark)} ${
        offNorth ? "cursor-pointer" : "cursor-default"
      }`}
      title={offNorth ? "Reset map to north" : "Map facing north"}
      aria-label={offNorth ? "Reset map to north" : "Compass — facing north"}
    >
      <NorthArrow bearing={bearing} size={22} isDark={isDark} />
    </button>
  );

  if (embedded) return shell;

  return (
    <div className={`pointer-events-auto fixed z-[40] ${LIVE_MAP_COMPASS_POSITION}`}>
      {shell}
    </div>
  );
}
