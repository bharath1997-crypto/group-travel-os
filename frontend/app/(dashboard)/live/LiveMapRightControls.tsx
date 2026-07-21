"use client";

import type { LiveMapLayer } from "@/lib/map-providers";
import LiveMapCompass from "./LiveMapCompass";
import LiveMapZoomControl from "./LiveMapZoomControl";
import { LIVE_MAP_COMPASS_POSITION } from "./live-layout";

type Props = {
  bearing: number;
  zoom: number;
  maxZoom: number;
  activeLayer: LiveMapLayer;
  onResetNorth: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomChange: (zoom: number) => void;
  gpsStatus: string;
  gpsErrorMessage: string | null;
  onLocate: () => void;
  showGpsHelper: boolean;
  onCloseGpsHelper: () => void;
  onUseMapArea: () => void;
};

/** Top-right map controls stack: compass + reactive zoom + separate Locate Me control. */
export default function LiveMapRightControls({
  bearing,
  zoom,
  maxZoom,
  activeLayer,
  onResetNorth,
  onZoomIn,
  onZoomOut,
  onZoomChange,
  gpsStatus,
  gpsErrorMessage,
  onLocate,
  showGpsHelper,
  onCloseGpsHelper,
  onUseMapArea,
}: Props) {
  const isDark = activeLayer === "dark";

  return (
    <div
      className={`pointer-events-none fixed z-[40] flex flex-col items-end gap-1.5 ${LIVE_MAP_COMPASS_POSITION}`}
    >
      {/* Compass */}
      <div className="pointer-events-auto">
        <LiveMapCompass
          bearing={bearing}
          activeLayer={activeLayer}
          onResetNorth={onResetNorth}
          embedded
        />
      </div>

      {/* Zoom Control */}
      <div className="pointer-events-auto">
        <LiveMapZoomControl
          zoom={zoom}
          maxZoom={maxZoom}
          activeLayer={activeLayer}
          onZoomIn={onZoomIn}
          onZoomOut={onZoomOut}
          onZoomChange={onZoomChange}
          embedded
        />
      </div>

      {/* Locate Me / GPS Button (separate from dock, aligned with zoom stack) */}
      <div className="pointer-events-auto relative flex flex-col items-end">
        {/* GPS Helper Tooltip — opens to the left of the button */}
        {showGpsHelper && (
          <div className="absolute right-full bottom-0 mr-3 z-50 w-56 rounded-xl border border-stone-200 bg-white/95 p-3 text-left shadow-xl backdrop-blur-md">
            <p className="text-xs font-semibold text-stone-800">
              {gpsStatus === "denied" ? "Location off" : "Location unavailable"}
            </p>
            <p className="mt-1 text-[11px] leading-snug text-stone-600">
              {gpsErrorMessage
                ? gpsErrorMessage
                : gpsStatus === "denied"
                ? "Enable location permission in your browser to show your position."
                : "Rovvy couldn't get your exact location from this browser. You can try again or use the current map area."}
            </p>
            <div className="mt-3 flex flex-col gap-1.5">
              <button
                type="button"
                onClick={onLocate}
                className="rounded-lg bg-[#007F73] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#00665c] cursor-pointer"
              >
                Try again
              </button>
              {gpsStatus === "denied" ? (
                <a
                  href="https://support.google.com/chrome/answer/142064?hl=en"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-stone-200 px-3 py-1.5 text-center text-[11px] font-semibold text-stone-700 hover:bg-stone-50"
                >
                  Browser location help
                </a>
              ) : (
                <button
                  type="button"
                  onClick={onUseMapArea}
                  className="rounded-lg border border-stone-200 px-3 py-1.5 text-[11px] font-semibold text-stone-700 hover:bg-stone-50 cursor-pointer"
                >
                  Use map area
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={onCloseGpsHelper}
              className="absolute right-1.5 top-1.5 px-1 text-xs text-stone-400 hover:text-stone-600 cursor-pointer"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        )}

        <button
          type="button"
          className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg shadow-sm border backdrop-blur-md transition-all duration-200 cursor-pointer ${
            isDark
              ? "bg-slate-900/90 text-white border-white/10 hover:bg-slate-800/90"
              : "bg-white/95 text-stone-700 border-stone-200/60 hover:bg-white"
          } ${
            gpsStatus === "active" || gpsStatus === "approximate"
              ? "ring-1 ring-[#007F73]/50 text-[#007F73]"
              : gpsStatus === "stale"
              ? "ring-2 ring-amber-500/70 text-amber-600 animate-pulse"
              : ""
          }`}
          onClick={onLocate}
          title={
            gpsStatus === "denied"
              ? "Location permission denied"
              : gpsStatus === "requesting"
              ? "Finding location…"
              : gpsStatus === "stale"
              ? "GPS signal stale, re-acquiring…"
              : "Locate me"
          }
          aria-label="Locate me"
        >
          {gpsStatus === "requesting" || gpsStatus === "stale" ? (
            <div className={`h-4 w-4 animate-spin rounded-full border-2 border-t-transparent ${
              gpsStatus === "stale" ? "border-amber-500" : "border-[#007F73]"
            }`} />
          ) : (
            <svg 
              viewBox="0 0 24 24" 
              fill="none" 
              className="h-4 w-4" 
              stroke="currentColor" 
              strokeWidth="2.5" 
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
      </div>
    </div>
  );
}
