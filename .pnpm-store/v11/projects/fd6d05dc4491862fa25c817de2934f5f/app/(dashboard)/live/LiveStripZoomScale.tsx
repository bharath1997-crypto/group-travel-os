"use client";

import { useCallback, useRef } from "react";

import { LIVE_MAP_MIN_ZOOM } from "@/lib/map-providers";
import { formatMapGroundScaleFeet } from "./live-map-attribution";
import { clampLiveMapZoomValue } from "./live-map-zoom-limits";
import {
  LIVE_STRIP_ZOOM_TICK_HEIGHTS,
  liveStripZoomFromTrackX,
  liveStripZoomPercent,
} from "./live-strip-zoom-scale";

/** Baseline inset from the strip bottom edge (px). */
const TRACK_BOTTOM_PX = 6;

type Props = {
  zoom: number;
  maxZoom: number;
  lat?: number | null;
  minZoom?: number;
  onZoomChange: (zoom: number) => void;
};

/** Horizontal ruler-style zoom scale for the bottom attribution strip. */
export default function LiveStripZoomScale({
  zoom,
  maxZoom,
  lat,
  minZoom = LIVE_MAP_MIN_ZOOM,
  onZoomChange,
}: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const clampedZoom = clampLiveMapZoomValue(zoom, minZoom, maxZoom);
  const progress = liveStripZoomPercent(clampedZoom, minZoom, maxZoom);
  const groundScale =
    typeof lat === "number" ? formatMapGroundScaleFeet(clampedZoom, lat) : null;
  const valueLabel = groundScale ?? `Z ${clampedZoom.toFixed(1)}`;

  const applyPointer = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const next = liveStripZoomFromTrackX(
        clientX,
        rect.left,
        rect.width,
        minZoom,
        maxZoom,
      );
      onZoomChange(next);
    },
    [maxZoom, minZoom, onZoomChange],
  );

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    applyPointer(event.clientX);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    applyPointer(event.clientX);
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const tickCount = LIVE_STRIP_ZOOM_TICK_HEIGHTS.length;
  const thumbLeft = `${progress * 100}%`;
  const tickBottom = TRACK_BOTTOM_PX + 7;

  return (
    <div
      ref={trackRef}
      className="relative mx-1.5 flex h-full min-w-[6.5rem] flex-1 cursor-ew-resize touch-none select-none items-stretch py-0.5"
      role="slider"
      aria-label="Map zoom level"
      aria-valuemin={minZoom}
      aria-valuemax={maxZoom}
      aria-valuenow={Number(clampedZoom.toFixed(2))}
      aria-valuetext={groundScale ? `Scale ${groundScale}` : `Zoom ${clampedZoom.toFixed(1)}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className="relative h-full w-full" aria-hidden>
        <span className="absolute left-0 top-0 text-[7px] font-medium tabular-nums leading-none text-white/45">
          {minZoom}
        </span>
        <span className="absolute right-0 top-0 text-[7px] font-medium tabular-nums leading-none text-white/45">
          {maxZoom}
        </span>

        <span
          className="absolute top-0 z-[1] max-w-[5.5rem] -translate-x-1/2 truncate text-[8px] font-semibold tabular-nums leading-none text-white/95"
          style={{ left: thumbLeft }}
        >
          {valueLabel}
        </span>

        {LIVE_STRIP_ZOOM_TICK_HEIGHTS.map((height, index) => {
          const left = `${(index / (tickCount - 1)) * 100}%`;
          const slant =
            index % 3 === 0 ? "-rotate-[8deg]" : index % 3 === 1 ? "rotate-[6deg]" : "";
          return (
            <span
              key={index}
              className={`absolute w-px origin-bottom bg-white/55 ${slant}`}
              style={{ left, bottom: tickBottom, height }}
            />
          );
        })}

        <div
          className="absolute inset-x-0 h-px bg-white/35"
          style={{ bottom: TRACK_BOTTOM_PX + 1 }}
        />

        <div
          className="absolute h-[2px] bg-white/90"
          style={{ left: 0, width: thumbLeft, bottom: TRACK_BOTTOM_PX }}
        />

        <div
          className="absolute h-px bg-white/45"
          style={{ left: thumbLeft, right: 0, bottom: TRACK_BOTTOM_PX + 1 }}
        />

        <div
          className="absolute w-px -translate-x-1/2 bg-white/95"
          style={{ left: thumbLeft, top: 8, bottom: TRACK_BOTTOM_PX - 1 }}
        >
          <span className="absolute -left-[1.5px] top-0 h-[2px] w-[2px] bg-white" />
          <span
            className="absolute -left-[1.5px] h-[2px] w-[2px] bg-white"
            style={{ bottom: 0 }}
          />
        </div>
      </div>
    </div>
  );
}
