"use client";

import { useEffect, useState } from "react";
import { Layers, Maximize2, Minimize2, Compass, Volume2, VolumeX } from "lucide-react";
import Image from "next/image";
import type { LiveMapLayer } from "@/lib/map-providers";

type Props = {
  activeLayer: LiveMapLayer;
  layersPanelOpen: boolean;
  onOpenLayers: () => void;
  bearing: number;
  onResetNorth: () => void;
  gpsStatus: string;
  liveGpsActive: boolean;
  onLocate: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
};

export default function LiveMapDock({
  activeLayer,
  layersPanelOpen,
  onOpenLayers,
  bearing,
  onResetNorth,
  gpsStatus,
  liveGpsActive,
  onLocate,
  isFullscreen,
  onToggleFullscreen,
  soundEnabled,
  onToggleSound,
}: Props) {
  const isDark = activeLayer === "dark";
  const normalizedBearing = ((bearing % 360) + 360) % 360;
  const offNorth = normalizedBearing > 0.5 && normalizedBearing < 359.5;

  // Mascot interaction speech bubble state
  const [mascotBubble, setMascotBubble] = useState<string | null>(null);

  // Let Rovi say something when states change
  useEffect(() => {
    if (gpsStatus === "active") {
      setMascotBubble("GPS Locked!");
    } else if (gpsStatus === "requesting") {
      setMascotBubble("Locating you...");
    } else if (gpsStatus === "error" || gpsStatus === "timeout") {
      setMascotBubble("GPS signal lost!");
    }
    const timer = setTimeout(() => setMascotBubble(null), 3000);
    return () => clearTimeout(timer);
  }, [gpsStatus]);

  const dockClass = isDark
    ? "bg-slate-900/85 border border-white/10 text-slate-100 shadow-[0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur-md rounded-2xl p-1 flex items-center gap-1 select-none"
    : "bg-white/85 border border-stone-200/60 text-stone-700 shadow-[0_12px_40px_rgba(15,23,42,0.12)] backdrop-blur-md rounded-2xl p-1 flex items-center gap-1 select-none";

  const btnClass = (isActive: boolean) => {
    const base = "relative flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-200 focus:outline-none";
    if (isActive) {
      return `${base} ${
        isDark
          ? "bg-teal-500/20 text-teal-300 ring-1 ring-teal-400/30"
          : "bg-teal-50 text-[#0f766e] ring-1 ring-teal-100/80"
      }`;
    }
    return `${base} ${
      isDark
        ? "hover:bg-white/5 active:bg-white/10 text-slate-300"
        : "hover:bg-stone-50 active:bg-stone-100 text-stone-600"
    }`;
  };

  // Determine GPS Button styling based on status
  const getGpsBtnClass = () => {
    const base = "relative flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-200 focus:outline-none";
    if (gpsStatus === "requesting") {
      return `${base} animate-pulse ${
        isDark ? "bg-teal-500/20 text-teal-300" : "bg-teal-50 text-[#0f766e]"
      }`;
    }
    if (gpsStatus === "active" || gpsStatus === "approximate") {
      return `${base} ${
        isDark ? "bg-teal-500/30 text-teal-300" : "bg-teal-500 text-white shadow-sm"
      }`;
    }
    if (gpsStatus === "denied") {
      return `${base} ${
        isDark ? "bg-slate-800 text-slate-500" : "bg-stone-100 text-stone-400"
      }`;
    }
    if (gpsStatus === "timeout" || gpsStatus === "error" || gpsStatus === "outdated") {
      return `${base} ${
        isDark ? "bg-amber-500/20 text-amber-300" : "bg-amber-50 text-amber-700"
      }`;
    }
    // Default / idle
    return `${base} ${
      isDark ? "hover:bg-white/5 text-slate-300" : "hover:bg-stone-50 text-stone-600"
    }`;
  };

  return (
    <div className="relative">
      {/* 3D Rovi Monkey Mascot Placeholder sitting on top */}
      <div 
        className="absolute -top-[34px] left-6 z-50 pointer-events-auto cursor-pointer"
        onMouseEnter={() => setMascotBubble("Hey! I'm Rovi 🐒")}
        onMouseLeave={() => setMascotBubble(null)}
        onClick={() => setMascotBubble("Let's explore together!")}
      >
        <div className="relative flex flex-col items-center">
          {/* Speech Bubble */}
          {mascotBubble && (
            <div className="absolute bottom-full mb-1.5 whitespace-nowrap rounded-lg bg-slate-900 text-white px-2 py-1 text-[10px] font-medium shadow-md border border-white/10 animate-fade-in">
              {mascotBubble}
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
            </div>
          )}
          {/* Monkey Mascot Capsule */}
          <div className="flex h-7 items-center gap-1 rounded-full bg-slate-900/90 text-white px-2 py-0.5 text-[10px] font-medium shadow-md border border-white/10 backdrop-blur-sm transition-all duration-300 hover:scale-105 active:scale-95">
            <span className="text-xs animate-bounce" style={{ animationDuration: "1.5s" }}>🐒</span>
            <span className="font-semibold tracking-wide uppercase text-[8px] text-teal-400">Rovi</span>
          </div>
        </div>
      </div>

      {/* The Horizontal 5-Box Dock Container */}
      <div className={dockClass} role="group" aria-label="Map Controls Dock">
        
        {/* Box 1: Layers */}
        <button
          type="button"
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

        {/* Box 3: GPS (Locate Me) */}
        <button
          type="button"
          onClick={onLocate}
          className={getGpsBtnClass()}
          title={
            gpsStatus === "requesting"
              ? "Finding location…"
              : gpsStatus === "denied"
              ? "Location permission denied"
              : "Locate me"
          }
          aria-label="Locate me"
        >
          {gpsStatus === "requesting" ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <svg 
              viewBox="0 0 24 24" 
              fill="none" 
              className="h-4.5 w-4.5" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="7" />
              <circle cx="12" cy="12" r="1.5" fill="currentColor" />
              <line x1="12" y1="2" x2="12" y2="4" />
              <line x1="12" y1="20" x2="12" y2="22" />
              <line x1="2" y1="12" x2="4" y2="12" />
              <line x1="20" y1="12" x2="22" y2="12" />
            </svg>
          )}
        </button>

        {/* Box 4: Fullscreen */}
        <button
          type="button"
          onClick={onToggleFullscreen}
          className={btnClass(isFullscreen)}
          title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          aria-label="Toggle Fullscreen"
        >
          {isFullscreen ? (
            <Minimize2 className="h-4.5 w-4.5" />
          ) : (
            <Maximize2 className="h-4.5 w-4.5" />
          )}
        </button>

        {/* Box 5: Sound / Audio Assistant */}
        <button
          type="button"
          onClick={onToggleSound}
          className={btnClass(!soundEnabled)}
          title={soundEnabled ? "Mute audio guide" : "Unmute audio guide"}
          aria-label="Toggle Sound"
        >
          {soundEnabled ? (
            <Volume2 className="h-4.5 w-4.5" />
          ) : (
            <VolumeX className="h-4.5 w-4.5 text-stone-400" />
          )}
        </button>
      </div>
    </div>
  );
}
