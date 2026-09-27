"use client";

import { useEffect, useRef, useState } from "react";
import { Maximize2, Minimize2, Minus, Plus } from "lucide-react";

import { LIVE_MAP_MIN_ZOOM } from "@/lib/map-providers";
import type { LiveMapLayer } from "@/lib/map-providers";
import {
  LIVE_MAP_ATTRIBUTION_STRIP_IMMERSIVE_POSITION,
  LIVE_MAP_ATTRIBUTION_STRIP_POSITION,
  LIVE_STRIP_HEIGHT_PX,
  LIVE_STRIP_ZOOM_HIT_PX,
  LIVE_STRIP_ZOOM_ICON_PX,
} from "./live-layout";
import {
  buildLiveMapAttributionLine,
  getLiveMapDataCredits,
  type LiveMapAttributionFocus,
} from "./live-map-attribution";
import {
  clampLiveMapZoomValue,
  liveMapZoomInButtonLevel,
  liveMapZoomOutButtonLevel,
} from "./live-map-zoom-limits";
import LiveStripZoomScale from "./LiveStripZoomScale";

type Props = {
  activeLayer: LiveMapLayer;
  focus: LiveMapAttributionFocus | null;
  isPanning: boolean;
  refreshedAt: Date;
  zoom: number;
  maxZoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomChange: (zoom: number) => void;
  immersive?: boolean;
  isImmersiveFullscreen?: boolean;
  onToggleImmersiveFullscreen?: () => void;
};

function stripZoomBtnClass(
  base: string,
  opts: {
    active: boolean;
    pulse: boolean;
    warn?: "amber" | "emerald" | "red";
  },
): string {
  const { active, pulse, warn } = opts;
  let cls = base;
  if (warn === "red") cls += " text-red-300";
  else if (warn === "amber") cls += " text-amber-200";
  else if (warn === "emerald") cls += " text-emerald-300";
  else if (active) cls += " text-white/90";
  else cls += " text-white/65";
  if (pulse) cls += " scale-125 brightness-110";
  return cls;
}

/** Minimal coordinate chip — zoom ± and fullscreen on the left. */
export default function LiveMapAttributionStrip({
  activeLayer,
  focus,
  isPanning,
  refreshedAt,
  zoom,
  maxZoom,
  onZoomIn,
  onZoomOut,
  onZoomChange,
  immersive = false,
  isImmersiveFullscreen = false,
  onToggleImmersiveFullscreen,
}: Props) {
  const line = buildLiveMapAttributionLine({
    layer: activeLayer,
    focus,
    isPanning,
    refreshedAt,
    zoom,
  });
  const credits = getLiveMapDataCredits(activeLayer);

  const clampedZoom = clampLiveMapZoomValue(zoom, LIVE_MAP_MIN_ZOOM, maxZoom);
  const zoomInLevel = liveMapZoomInButtonLevel(clampedZoom, maxZoom);
  const zoomOutLevel = liveMapZoomOutButtonLevel(clampedZoom);
  const atMaxZoom = zoomInLevel === "max";
  const atMinZoom = zoomOutLevel === "min";
  const nearMinZoom =
    !atMinZoom && clampedZoom <= LIVE_MAP_MIN_ZOOM + 1.25;

  const prevZoomRef = useRef(clampedZoom);
  const [zoomPulse, setZoomPulse] = useState<"in" | "out" | null>(null);

  useEffect(() => {
    const prev = prevZoomRef.current;
    if (clampedZoom > prev + 0.02) setZoomPulse("in");
    else if (clampedZoom < prev - 0.02) setZoomPulse("out");
    prevZoomRef.current = clampedZoom;
  }, [clampedZoom]);

  useEffect(() => {
    if (!zoomPulse) return;
    const t = window.setTimeout(() => setZoomPulse(null), 480);
    return () => window.clearTimeout(t);
  }, [zoomPulse]);

  const stripBtn =
    "relative flex shrink-0 items-center justify-center transition-all duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-30";
  const hitPx = LIVE_STRIP_ZOOM_HIT_PX;

  return (
    <div
      className={`pointer-events-none select-none ${
        immersive
          ? LIVE_MAP_ATTRIBUTION_STRIP_IMMERSIVE_POSITION
          : LIVE_MAP_ATTRIBUTION_STRIP_POSITION
      }`}
      aria-live="polite"
      aria-label="Map location and scale"
    >
      <div
        className="pointer-events-auto flex w-full items-stretch overflow-hidden rounded-none bg-[rgba(32,33,36,0.88)]"
        style={{ height: LIVE_STRIP_HEIGHT_PX }}
      >
        <div className="flex shrink-0 items-stretch border-r border-white/10">
          <button
            type="button"
            onClick={onZoomOut}
            disabled={atMinZoom}
            className={stripZoomBtnClass(stripBtn, {
              active: !atMinZoom,
              pulse: zoomPulse === "out",
              warn: atMinZoom ? "emerald" : nearMinZoom ? "amber" : undefined,
            })}
            style={{ width: hitPx, height: hitPx }}
            title={atMinZoom ? "Minimum zoom" : "Zoom out"}
            aria-label={atMinZoom ? "Minimum zoom" : "Zoom out"}
          >
            <Minus size={LIVE_STRIP_ZOOM_ICON_PX} strokeWidth={2.75} aria-hidden />
          </button>
          <button
            type="button"
            onClick={onZoomIn}
            disabled={atMaxZoom}
            className={stripZoomBtnClass(stripBtn, {
              active: !atMaxZoom,
              pulse: zoomPulse === "in",
              warn:
                atMaxZoom ? "red" : zoomInLevel === "approaching" ? "amber" : undefined,
            })}
            style={{ width: hitPx, height: hitPx }}
            title={atMaxZoom ? "Maximum zoom" : "Zoom in"}
            aria-label={atMaxZoom ? "Maximum zoom" : "Zoom in"}
          >
            <Plus size={LIVE_STRIP_ZOOM_ICON_PX} strokeWidth={2.75} aria-hidden />
          </button>
          {onToggleImmersiveFullscreen ? (
            <button
              type="button"
              onClick={onToggleImmersiveFullscreen}
              className={stripZoomBtnClass(stripBtn, {
                active: isImmersiveFullscreen,
                pulse: false,
              })}
              style={{ width: hitPx, height: hitPx }}
              title={isImmersiveFullscreen ? "Exit map fullscreen" : "Map fullscreen"}
              aria-label={
                isImmersiveFullscreen ? "Exit map fullscreen" : "Map fullscreen"
              }
            >
              {isImmersiveFullscreen ? (
                <Minimize2 size={LIVE_STRIP_ZOOM_ICON_PX} strokeWidth={2.75} aria-hidden />
              ) : (
                <Maximize2 size={LIVE_STRIP_ZOOM_ICON_PX} strokeWidth={2.75} aria-hidden />
              )}
            </button>
          ) : null}
        </div>
        <LiveStripZoomScale
          zoom={clampedZoom}
          maxZoom={maxZoom}
          lat={focus?.lat ?? null}
          onZoomChange={onZoomChange}
        />
        <p
          className="flex min-w-0 max-w-[42%] shrink-0 items-center truncate px-1.5 text-[11px] font-medium leading-none tracking-tight text-white/88 sm:max-w-[38%] md:max-w-[34%] lg:max-w-none lg:flex-1"
          title={credits}
        >
          {line}
        </p>
      </div>
    </div>
  );
}
