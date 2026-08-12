"use client";

import { useEffect, useState } from "react";
import { Layers, Maximize2 } from "lucide-react";

/** Shared Google Maps–style compact control button. */
export const LIVE_MAP_CTRL_BTN =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white text-stone-600 shadow-[0_1px_4px_rgba(0,0,0,0.22)] transition-colors hover:bg-stone-50 hover:text-stone-800 active:bg-stone-100";

export const LIVE_MAP_CTRL_BTN_ACTIVE =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary shadow-[0_1px_4px_rgba(0,0,0,0.18)] transition-colors";

export const LIVE_MAP_CTRL_ICON = "h-4 w-4";

type Props = {
  layersPanelOpen: boolean;
  onOpenLayers: () => void;
  onToggleFullscreen: () => void;
};

export default function LiveMapToolsControl({
  layersPanelOpen,
  onOpenLayers,
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
        className={layersPanelOpen ? LIVE_MAP_CTRL_BTN_ACTIVE : LIVE_MAP_CTRL_BTN}
        title="Map layers"
        aria-label="Map layers"
        aria-expanded={layersPanelOpen}
        aria-haspopup="dialog"
      >
        <Layers className={LIVE_MAP_CTRL_ICON} />
      </button>

      <button
        type="button"
        onClick={onToggleFullscreen}
        className={isFullscreen ? LIVE_MAP_CTRL_BTN_ACTIVE : LIVE_MAP_CTRL_BTN}
        title="Fullscreen"
        aria-label="Toggle fullscreen"
      >
        <Maximize2 className={LIVE_MAP_CTRL_ICON} />
      </button>
    </div>
  );
}
