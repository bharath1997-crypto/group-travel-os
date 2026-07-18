"use client";

import { useEffect, useState } from "react";
import {
  Layers,
  Maximize2,
  Minimize2,
  Compass,
  Volume2,
  VolumeX,
  Bell,
  BellOff,
} from "lucide-react";
import type { LiveMapLayer } from "@/lib/map-providers";

type Props = {
  activeLayer: LiveMapLayer;
  layersPanelOpen: boolean;
  onOpenLayers: () => void;
  bearing: number;
  onResetNorth: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  notificationsEnabled: boolean;
  onToggleNotifications: () => void;
};

export default function LiveMapDock({
  activeLayer,
  layersPanelOpen,
  onOpenLayers,
  bearing,
  onResetNorth,
  isFullscreen,
  onToggleFullscreen,
  soundEnabled,
  onToggleSound,
  notificationsEnabled,
  onToggleNotifications,
}: Props) {
  const isDark = activeLayer === "dark";
  const normalizedBearing = ((bearing % 360) + 360) % 360;
  const offNorth = normalizedBearing > 0.5 && normalizedBearing < 359.5;

  // Mascot interaction speech bubble state
  const [mascotBubble, setMascotBubble] = useState<string | null>(null);

  // Auto welcome bubble on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      setMascotBubble("Explore together! 🐒");
    }, 1500);
    const hideTimer = setTimeout(() => setMascotBubble(null), 5000);
    return () => {
      clearTimeout(timer);
      clearTimeout(hideTimer);
    };
  }, []);

  // Visual button styling: Each box is a separate glassmorphic cube/tile
  const btnClass = (isActive: boolean) => {
    const base =
      "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-md border backdrop-blur-md transition-all duration-200 focus:outline-none cursor-pointer";
    if (isActive) {
      return `${base} ${
        isDark
          ? "bg-teal-500/25 border-teal-400/40 text-teal-300 ring-1 ring-teal-400/30"
          : "bg-teal-50 border-[#0f766e]/30 text-[#0f766e] ring-1 ring-teal-100/80"
      }`;
    }
    return `${base} ${
      isDark
        ? "bg-slate-900/90 border-white/10 hover:bg-slate-800/90 text-slate-300"
        : "bg-white/90 border-stone-200/60 hover:bg-stone-50 text-stone-600"
    }`;
  };

  return (
    <div className="relative select-none pointer-events-none">
      {/* 3D Rovi Monkey Mascot Placeholder (temporary monkey emoji) */}
      <div
        className="absolute -top-[32px] right-6 z-50 pointer-events-auto cursor-pointer"
        onMouseEnter={() => setMascotBubble("Need a hand? 🐒")}
        onMouseLeave={() => setMascotBubble(null)}
        data-live-layers-trigger
        onClick={onOpenLayers}
      >
        <div className="relative flex flex-col items-center">
          {/* Speech Bubble */}
          {mascotBubble && (
            <div className="absolute bottom-full mb-1.5 whitespace-nowrap rounded-lg bg-slate-900 text-white px-2 py-1 text-[10px] font-medium shadow-md border border-white/10 animate-fade-in">
              {mascotBubble}
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
            </div>
          )}
          {/* 28px Mascot Circle */}
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-white shadow-md border border-white/10 backdrop-blur-sm transition-all duration-300 hover:scale-110 active:scale-95 text-base">
            🐒
          </div>
        </div>
      </div>

      {/* Option B: Five distinct tile boxes placed side-by-side */}
      <div className="flex items-center gap-1.5 pointer-events-auto" role="group" aria-label="Map Controls Dock">
        {/* Box 1: Layers Launcher */}
        <button
          type="button"
          data-live-layers-trigger
          onClick={onOpenLayers}
          className={btnClass(layersPanelOpen)}
          title="Map layers"
          aria-label="Map layers"
          aria-expanded={layersPanelOpen}
        >
          <Layers className="h-4.5 w-4.5" />
          {layersPanelOpen && (
            <span className="absolute bottom-1.5 h-1 w-1 rounded-full bg-[#0f766e]" />
          )}
        </button>

        {/* Box 2: Compass */}
        <button
          type="button"
          onClick={() => {
            if (offNorth) onResetNorth();
          }}
          className={btnClass(offNorth)}
          title={offNorth ? "Reset map to North" : "Facing North"}
          aria-label={offNorth ? "Reset map to North" : "Facing North"}
        >
          <Compass
            className="h-4.5 w-4.5 transition-transform duration-200 ease-out"
            style={{ transform: `rotate(${-normalizedBearing}deg)` }}
          />
          {offNorth && (
            <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-red-500" />
          )}
        </button>

        {/* Box 3: Fullscreen Toggle */}
        <button
          type="button"
          onClick={onToggleFullscreen}
          className={btnClass(isFullscreen)}
          title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          aria-label="Toggle Fullscreen"
        >
          {isFullscreen ? <Minimize2 className="h-4.5 w-4.5" /> : <Maximize2 className="h-4.5 w-4.5" />}
        </button>

        {/* Box 4: Sound Toggle */}
        <button
          type="button"
          onClick={onToggleSound}
          className={btnClass(soundEnabled)}
          title={soundEnabled ? "Mute audio guide" : "Unmute audio guide"}
          aria-label="Toggle Sound"
        >
          {soundEnabled ? (
            <Volume2 className="h-4.5 w-4.5 text-teal-600 dark:text-teal-400" />
          ) : (
            <VolumeX className="h-4.5 w-4.5 text-stone-400" />
          )}
        </button>

        {/* Box 5: Notifications Toggle */}
        <button
          type="button"
          onClick={onToggleNotifications}
          className={btnClass(notificationsEnabled)}
          title={notificationsEnabled ? "Mute notifications" : "Unmute notifications"}
          aria-label="Toggle Notifications"
        >
          {notificationsEnabled ? (
            <Bell className="h-4.5 w-4.5 text-teal-600 dark:text-teal-400" />
          ) : (
            <BellOff className="h-4.5 w-4.5 text-stone-400" />
          )}
        </button>
      </div>
    </div>
  );
}
