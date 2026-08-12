"use client";

import { Compass } from "lucide-react";
import { MyLocationIcon } from "@/components/map/MapControlIcons";
import type { LiveMapLayer } from "@/lib/map-providers";
import LiveMapLayerControl from "./LiveMapLayerControl";
import { LIVE_MAP_CONTROLS_RAIL_POSITION } from "./live-layout";
import {
  isLiveMapDarkLayer,
  liveMapFloatBtnDark,
  liveMapFloatBtnLight,
} from "./live-map-right-controls";
import { isGpsLocateButtonActive, isGpsLocateLoading, type GpsStatus } from "./live-gps";
import type { LiveMapViewMode } from "./live-layout";

type Props = {
  bearing: number;
  activeLayer: LiveMapLayer;
  onResetNorth: () => void;
  gpsStatus: GpsStatus;
  gpsErrorMessage: string | null;
  onLocate: () => void;
  showGpsHelper: boolean;
  onCloseGpsHelper: () => void;
  onUseMapArea: () => void;
  layersPanelOpen: boolean;
  onLayersPanelOpenChange: (open: boolean) => void;
  onLayerChange: (layer: LiveMapLayer) => void;
  travelLayerEnabled?: boolean;
  onTravelLayerChange?: (enabled: boolean) => void;
  seaRoutesEnabled?: boolean;
  onSeaRoutesChange?: (enabled: boolean) => void;
  cruiseRoutesEnabled?: boolean;
  onCruiseRoutesChange?: (enabled: boolean) => void;
  footRoutesEnabled?: boolean;
  onFootRoutesChange?: (enabled: boolean) => void;
  friendTrackingEnabled?: boolean;
  onFriendTrackingChange?: (enabled: boolean) => void;
  savedPlacesLayerEnabled?: boolean;
  onSavedPlacesLayerChange?: (enabled: boolean) => void;
  mapViewMode?: LiveMapViewMode;
  onToggleViewMode?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  soundEnabled?: boolean;
  onToggleSound?: () => void;
  notificationsEnabled?: boolean;
  onToggleNotifications?: () => void;
};

/** Right-side map controls — layers, compass (north reset), GPS. */
export default function LiveMapRightControls({
  bearing,
  activeLayer,
  onResetNorth,
  gpsStatus,
  gpsErrorMessage,
  onLocate,
  showGpsHelper,
  onCloseGpsHelper,
  onUseMapArea,
  layersPanelOpen,
  onLayersPanelOpenChange,
  onLayerChange,
  travelLayerEnabled,
  onTravelLayerChange,
  seaRoutesEnabled,
  onSeaRoutesChange,
  cruiseRoutesEnabled,
  onCruiseRoutesChange,
  footRoutesEnabled,
  onFootRoutesChange,
  friendTrackingEnabled,
  onFriendTrackingChange,
  savedPlacesLayerEnabled,
  onSavedPlacesLayerChange,
  mapViewMode,
  onToggleViewMode,
  isFullscreen,
  onToggleFullscreen,
  soundEnabled,
  onToggleSound,
  notificationsEnabled,
  onToggleNotifications,
}: Props) {
  const isDark = isLiveMapDarkLayer(activeLayer);
  const normalizedBearing = ((bearing % 360) + 360) % 360;
  const offNorth = normalizedBearing > 0.5 && normalizedBearing < 359.5;

  return (
    <div
      className={`pointer-events-none flex flex-col items-end gap-1 ${LIVE_MAP_CONTROLS_RAIL_POSITION}`}
    >
      <div className="pointer-events-auto">
        <LiveMapLayerControl
          activeLayer={activeLayer}
          onLayerChange={onLayerChange}
          travelLayerEnabled={travelLayerEnabled}
          onTravelLayerChange={onTravelLayerChange}
          seaRoutesEnabled={seaRoutesEnabled}
          onSeaRoutesChange={onSeaRoutesChange}
          cruiseRoutesEnabled={cruiseRoutesEnabled}
          onCruiseRoutesChange={onCruiseRoutesChange}
          footRoutesEnabled={footRoutesEnabled}
          onFootRoutesChange={onFootRoutesChange}
          friendTrackingEnabled={friendTrackingEnabled}
          onFriendTrackingChange={onFriendTrackingChange}
          savedPlacesLayerEnabled={savedPlacesLayerEnabled}
          onSavedPlacesLayerChange={onSavedPlacesLayerChange}
          open={layersPanelOpen}
          onOpenChange={onLayersPanelOpenChange}
          showTrigger={false}
          panelAnchor="right-rail"
          mapViewMode={mapViewMode}
          onToggleViewMode={onToggleViewMode}
          isFullscreen={isFullscreen}
          onToggleFullscreen={onToggleFullscreen}
          soundEnabled={soundEnabled}
          onToggleSound={onToggleSound}
          notificationsEnabled={notificationsEnabled}
          onToggleNotifications={onToggleNotifications}
          bearing={bearing}
          onResetNorth={onResetNorth}
        />
      </div>

      <div className="pointer-events-auto">
        <button
          type="button"
          onClick={() => {
            if (offNorth) onResetNorth();
          }}
          className={`relative ${liveMapFloatBtnLight(offNorth, isDark)}`}
          title={offNorth ? "Reset map to North" : "Facing North"}
          aria-label={offNorth ? "Reset map to North" : "Facing North"}
        >
          <Compass
            className="h-[18px] w-[18px] transition-transform duration-200 ease-out"
            style={{ transform: `rotate(${-normalizedBearing}deg)` }}
          />
          {offNorth ? (
            <span className="absolute top-1 right-1 h-1 w-1 rounded-full bg-red-500" />
          ) : null}
        </button>
      </div>

      <div className="pointer-events-auto relative flex flex-col items-end">
        {showGpsHelper ? (
          <div className="absolute right-full bottom-0 mr-2 z-50 w-52 rounded-lg border border-stone-200 bg-white/95 p-2.5 text-left shadow-xl backdrop-blur-md">
            <p className="text-xs font-semibold text-stone-800">
              {gpsStatus === "denied" ? "Location off" : "Location unavailable"}
            </p>
            <p className="mt-1 text-[10px] leading-snug text-stone-600">
              {gpsErrorMessage
                ? gpsErrorMessage
                : gpsStatus === "denied"
                  ? "Enable location permission in your browser."
                  : "Try again or use the current map area."}
            </p>
            <div className="mt-2 flex flex-col gap-1">
              <button
                type="button"
                onClick={onLocate}
                className="rounded-md bg-primary px-2.5 py-1 text-[10px] font-semibold text-white"
              >
                Try again
              </button>
              {gpsStatus !== "denied" ? (
                <button
                  type="button"
                  onClick={onUseMapArea}
                  className="rounded-md border border-stone-200 px-2.5 py-1 text-[10px] font-semibold text-stone-700"
                >
                  Use map area
                </button>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onCloseGpsHelper}
              className="absolute right-1 top-1 px-1 text-xs text-stone-400"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        ) : null}

        <button
          type="button"
          className={`relative ${liveMapFloatBtnDark(isGpsLocateButtonActive(gpsStatus))}`}
          onClick={onLocate}
          title="Locate me"
          aria-label="Locate me"
        >
          {isGpsLocateLoading(gpsStatus) ? (
            <div className="h-[18px] w-[18px] animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <MyLocationIcon size={18} />
          )}
        </button>
      </div>
    </div>
  );
}
