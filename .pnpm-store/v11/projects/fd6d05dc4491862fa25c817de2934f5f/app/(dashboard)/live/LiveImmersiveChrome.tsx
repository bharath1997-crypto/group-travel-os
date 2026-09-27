"use client";

import { useEffect } from "react";
import type { LiveMapLayer } from "@/lib/map-providers";
import {
  clearLiveImmersiveChrome,
  isImmersiveDarkMapLayer,
  setLiveImmersiveChrome,
} from "./live-immersive-chrome";

type Props = {
  activeLayer: LiveMapLayer;
};

/** Keeps dashboard header in sync with Live map layer (immersive + dark variants). */
export default function LiveImmersiveChrome({ activeLayer }: Props) {
  useEffect(() => {
    setLiveImmersiveChrome({
      active: true,
      darkMap: isImmersiveDarkMapLayer(activeLayer),
    });
    return () => clearLiveImmersiveChrome();
  }, [activeLayer]);

  return null;
}
