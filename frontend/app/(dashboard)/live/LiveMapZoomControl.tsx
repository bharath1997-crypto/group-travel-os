"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";

import { LIVE_MAP_MIN_ZOOM } from "@/lib/map-providers";
import {
  clampLiveMapZoomValue,
  liveMapZoomInButtonLevel,
  liveMapZoomOutButtonLevel,
} from "./live-map-zoom-limits";
import type { LiveMapLayer } from "@/lib/map-providers";
import { LIVE_MAP_ZOOM_CONTROL_POSITION } from "./live-layout";
import {
  isLiveMapDarkLayer,
  LIVE_MAP_ZOOM_SCALE_VISIBLE_MS,
  liveMapRightShell,
  liveMapZoomInBtn,
  liveMapZoomOutBtn,
} from "./live-map-right-controls";

type Props = {
  zoom: number;
  maxZoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomChange: (zoom: number) => void;
  activeLayer: LiveMapLayer;
  /** When true, parent handles positioning (T-zone stack). */
  embedded?: boolean;
};

function ZoomScaleTicks({ isDark }: { isDark: boolean }) {
  const line = isDark ? "rgba(255,255,255,0.55)" : "rgba(15,23,42,0.35)";
  const widths = [10, 14, 18, 14, 10];

  return (
    <div className="flex flex-col items-center gap-[3px] py-0.5" aria-hidden>
      {widths.map((w, i) => (
        <span
          key={i}
          className="block h-px rounded-full"
          style={{ width: w, backgroundColor: line }}
        />
      ))}
    </div>
  );
}

export default function LiveMapZoomControl({
  zoom,
  maxZoom,
  onZoomIn,
  onZoomOut,
  onZoomChange,
  activeLayer,
  embedded = false,
}: Props) {
  const isDark = isLiveMapDarkLayer(activeLayer);
  const [scaleVisible, setScaleVisible] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevZoomRef = useRef(zoom);

  const revealScale = useCallback(() => {
    setScaleVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setScaleVisible(false);
    }, LIVE_MAP_ZOOM_SCALE_VISIBLE_MS);
  }, []);

  useEffect(() => {
    if (prevZoomRef.current !== zoom) {
      prevZoomRef.current = zoom;
      revealScale();
    }
  }, [zoom, revealScale]);

  useEffect(
    () => () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    },
    [],
  );

  const clampedZoom = clampLiveMapZoomValue(zoom, LIVE_MAP_MIN_ZOOM, maxZoom);
  const zoomInLevel = liveMapZoomInButtonLevel(clampedZoom, maxZoom);
  const zoomOutLevel = liveMapZoomOutButtonLevel(clampedZoom);
  const atMaxZoom = zoomInLevel === "max";
  const atMinZoom = zoomOutLevel === "min";

  const handleZoomIn = () => {
    revealScale();
    if (!atMaxZoom) onZoomIn();
  };

  const handleZoomOut = () => {
    revealScale();
    if (!atMinZoom) onZoomOut();
  };

  const panel = (
    <div
      className={`flex w-8 flex-col items-stretch overflow-hidden rounded-lg transition-all duration-200 ${liveMapRightShell(isDark)}`}
      role="group"
      aria-label="Map zoom"
    >
      <button
        type="button"
        onClick={handleZoomIn}
        className={liveMapZoomInBtn(isDark, zoomInLevel)}
        title={
          atMaxZoom
            ? "Maximum zoom for this map layer"
            : zoomInLevel === "approaching"
              ? "Near maximum zoom"
              : "Zoom in"
        }
        aria-label={atMaxZoom ? "Maximum zoom reached" : "Zoom in"}
        aria-disabled={atMaxZoom}
      >
        <Plus className="h-4 w-4 stroke-[2.5]" aria-hidden />
      </button>

      <div
        className={`grid transition-all duration-300 ease-out ${
          scaleVisible
            ? "grid-rows-[1fr] opacity-100"
            : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div
            className={`flex flex-col items-center gap-1 border-y px-1 py-1.5 ${
              isDark ? "border-white/12" : "border-stone-200/55"
            }`}
          >
            <span
              className={`text-[10px] font-semibold tabular-nums leading-none ${
                atMaxZoom
                  ? "text-red-500"
                  : zoomInLevel === "approaching"
                    ? "text-amber-600"
                    : isDark
                      ? "text-white/95"
                      : "text-stone-800"
              }`}
            >
              {clampedZoom.toFixed(1)}
            </span>
            <ZoomScaleTicks isDark={isDark} />
            <input
              type="range"
              min={LIVE_MAP_MIN_ZOOM}
              max={maxZoom}
              step={0.5}
              value={clampedZoom}
              onPointerDown={revealScale}
              onChange={(event) => {
                revealScale();
                const next = clampLiveMapZoomValue(
                  Number(event.target.value),
                  LIVE_MAP_MIN_ZOOM,
                  maxZoom,
                );
                onZoomChange(next);
              }}
              className="sr-only"
              aria-label="Zoom level"
              tabIndex={scaleVisible ? 0 : -1}
            />
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={handleZoomOut}
        className={liveMapZoomOutBtn(isDark, zoomOutLevel)}
        title={atMinZoom ? "Minimum zoom reached" : "Zoom out"}
        aria-label={atMinZoom ? "Minimum zoom reached" : "Zoom out"}
        aria-disabled={atMinZoom}
      >
        <Minus className="h-4 w-4 stroke-[2.5]" aria-hidden />
      </button>
    </div>
  );

  if (embedded) return panel;

  return (
    <div className={`pointer-events-auto fixed z-[40] ${LIVE_MAP_ZOOM_CONTROL_POSITION}`}>
      {panel}
    </div>
  );
}
