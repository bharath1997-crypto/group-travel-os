"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  clampPanelSize,
  loadLivePreviewPanelSize,
  saveLivePreviewPanelSize,
  type LivePreviewPanelSize,
} from "./live-panel-size";

type ResizeEdge = "width" | "height";

export function useLivePreviewPanelResize(enabled: boolean) {
  const [size, setSize] = useState<LivePreviewPanelSize>(() => loadLivePreviewPanelSize());
  const interactionRef = useRef<{
    edge: ResizeEdge;
    startX: number;
    startY: number;
    origin: LivePreviewPanelSize;
  } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    setSize(loadLivePreviewPanelSize());
  }, [enabled]);

  const onResizePointerDown = useCallback(
    (edge: ResizeEdge) => (event: React.PointerEvent<HTMLDivElement>) => {
      if (!enabled) return;
      event.preventDefault();
      event.stopPropagation();
      interactionRef.current = {
        edge,
        startX: event.clientX,
        startY: event.clientY,
        origin: size,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [enabled, size],
  );

  useEffect(() => {
    if (!enabled) return;

    const onMove = (event: PointerEvent) => {
      const interaction = interactionRef.current;
      if (!interaction || typeof window === "undefined") return;

      if (interaction.edge === "width") {
        const deltaX = interaction.startX - event.clientX;
        const deltaVw = (deltaX / window.innerWidth) * 100;
        const next = clampPanelSize({
          ...interaction.origin,
          widthVw: interaction.origin.widthVw + deltaVw,
        });
        setSize(next);
        return;
      }

      const deltaY = interaction.startY - event.clientY;
      const deltaVh = (deltaY / window.innerHeight) * 100;
      const next = clampPanelSize({
        ...interaction.origin,
        maxHeightVh: interaction.origin.maxHeightVh + deltaVh,
      });
      setSize(next);
    };

    const onUp = () => {
      if (!interactionRef.current) return;
      interactionRef.current = null;
      setSize((current) => {
        saveLivePreviewPanelSize(current);
        return current;
      });
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [enabled]);

  return { size, onResizePointerDown };
}
