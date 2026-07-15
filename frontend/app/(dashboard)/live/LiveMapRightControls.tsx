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
};

/** Top-right map dock: compass + reactive zoom (Google Maps–style T-zone). */
export default function LiveMapRightControls({
  bearing,
  zoom,
  maxZoom,
  activeLayer,
  onResetNorth,
  onZoomIn,
  onZoomOut,
  onZoomChange,
}: Props) {
  return (
    <div
      className={`pointer-events-none fixed z-[40] flex flex-col items-end gap-1.5 ${LIVE_MAP_COMPASS_POSITION}`}
    >
      <div className="pointer-events-auto">
        <LiveMapCompass
          bearing={bearing}
          activeLayer={activeLayer}
          onResetNorth={onResetNorth}
          embedded
        />
      </div>
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
    </div>
  );
}
