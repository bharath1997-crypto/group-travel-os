"use client";

import { useEffect, useState } from "react";
import {
  Bell,
  Layers,
  Maximize2,
  Volume2,
  VolumeX,
} from "lucide-react";

/** Shared Google Maps–style compact control button. */
export const LIVE_MAP_CTRL_BTN =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white text-stone-600 shadow-[0_1px_4px_rgba(0,0,0,0.22)] transition-colors hover:bg-stone-50 hover:text-stone-800 active:bg-stone-100";

export const LIVE_MAP_CTRL_BTN_ACTIVE =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#E6F7F4] text-[#007F73] shadow-[0_1px_4px_rgba(0,0,0,0.18)] transition-colors";

export const LIVE_MAP_CTRL_ICON = "h-4 w-4";

/** Cardinal compass rose — N/S labels rotate with map bearing so south is always correct. */
function LiveMapCompassRose({ bearing }: { bearing: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden
      className="transition-transform duration-150 ease-out"
      style={{ transform: `rotate(${-bearing}deg)` }}
    >
      <circle cx="12" cy="12" r="9.25" fill="none" stroke="#D6D3D1" strokeWidth="1.25" />
      {/* North needle */}
      <path d="M12 3.5 L14.2 12 L12 10.2 L9.8 12 Z" fill="#DC2626" />
      {/* South needle */}
      <path d="M12 20.5 L9.8 12 L12 13.8 L14.2 12 Z" fill="#78716C" />
      <text
        x="12"
        y="8.2"
        textAnchor="middle"
        fontSize="5.5"
        fontWeight="700"
        fill="#DC2626"
        fontFamily="Inter, system-ui, sans-serif"
      >
        N
      </text>
      <text
        x="12"
        y="19.8"
        textAnchor="middle"
        fontSize="5"
        fontWeight="600"
        fill="#57534E"
        fontFamily="Inter, system-ui, sans-serif"
      >
        S
      </text>
    </svg>
  );
}

type Props = {
  mapBearing: number;
  soundEnabled: boolean;
  alertsEnabled: boolean;
  layersActive: boolean;
  onOpenLayers: () => void;
  onResetNorth: () => void;
  onToggleSound: () => void;
  onToggleAlerts: () => void;
  onToggleFullscreen: () => void;
};

export default function LiveMapToolsControl({
  mapBearing,
  soundEnabled,
  alertsEnabled,
  layersActive,
  onOpenLayers,
  onResetNorth,
  onToggleSound,
  onToggleAlerts,
  onToggleFullscreen,
}: Props) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  return (
    <div className="flex items-center gap-1 select-none" role="group" aria-label="Map tools">
      <button
        type="button"
        onClick={onOpenLayers}
        data-live-layers-trigger
        className={layersActive ? LIVE_MAP_CTRL_BTN_ACTIVE : LIVE_MAP_CTRL_BTN}
        title="Map layers"
        aria-label="Map layers"
        aria-expanded={layersActive}
        aria-haspopup="dialog"
      >
        <Layers className={LIVE_MAP_CTRL_ICON} />
      </button>

      <button
        type="button"
        onClick={onToggleFullscreen}
        className={isFullscreen ? LIVE_MAP_CTRL_BTN_ACTIVE : LIVE_MAP_CTRL_BTN}
        title="Fullscreen"
        aria-label="Toggle Fullscreen"
      >
        <Maximize2 className={LIVE_MAP_CTRL_ICON} />
      </button>

      <button
        type="button"
        onClick={onToggleSound}
        className={soundEnabled ? LIVE_MAP_CTRL_BTN_ACTIVE : LIVE_MAP_CTRL_BTN}
        title={`Sound: ${soundEnabled ? "on" : "off"}`}
        aria-label="Toggle Sound"
      >
        {soundEnabled ? (
          <Volume2 className={LIVE_MAP_CTRL_ICON} />
        ) : (
          <VolumeX className={`${LIVE_MAP_CTRL_ICON} text-stone-400`} />
        )}
      </button>

      <button
        type="button"
        onClick={onToggleAlerts}
        className={alertsEnabled ? LIVE_MAP_CTRL_BTN_ACTIVE : LIVE_MAP_CTRL_BTN}
        title={`Notifications: ${alertsEnabled ? "on" : "off"}`}
        aria-label="Toggle Notifications"
      >
        <Bell className={LIVE_MAP_CTRL_ICON} />
      </button>

      <button
        type="button"
        onClick={onResetNorth}
        className={mapBearing !== 0 ? LIVE_MAP_CTRL_BTN_ACTIVE : LIVE_MAP_CTRL_BTN}
        title={mapBearing !== 0 ? "Reset map to north" : "Map facing north"}
        aria-label="Compass — reset to north"
      >
        <LiveMapCompassRose bearing={mapBearing} />
      </button>
    </div>
  );
}
