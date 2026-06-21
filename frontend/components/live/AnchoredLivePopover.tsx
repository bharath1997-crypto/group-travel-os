"use client";

import { useEffect, useState, type ReactNode } from "react";

export const ANCHORED_PANEL_WIDTH = 300;
export const ANCHORED_PANEL_MAX_HEIGHT = 420;

export function useAnchoredPosition(isOpen: boolean, anchorEl: HTMLElement | null) {
  const [top, setTop] = useState(0);

  useEffect(() => {
    if (!isOpen || !anchorEl) return;

    const update = () => {
      const rect = anchorEl.getBoundingClientRect();
      const buttonMidY = rect.top + rect.height / 2;
      const direction = buttonMidY < window.innerHeight * 0.6 ? "down" : "up";
      const nextTop =
        direction === "down"
          ? rect.top
          : Math.max(8, rect.top - ANCHORED_PANEL_MAX_HEIGHT + 44);
      setTop(nextTop);
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [isOpen, anchorEl]);

  return top;
}

interface AnchoredLivePopoverProps {
  isOpen: boolean;
  anchorEl: HTMLElement | null;
  children: ReactNode;
  className?: string;
  fixedHeight?: number;
}

export function AnchoredLivePopover({
  isOpen,
  anchorEl,
  children,
  className = "",
  fixedHeight,
}: AnchoredLivePopoverProps) {
  const top = useAnchoredPosition(isOpen, anchorEl);

  if (!isOpen) return null;

  return (
    <div
      className={[
        "fixed z-[30] flex flex-col overflow-hidden rounded-2xl border border-white/10",
        "bg-slate-950/92 shadow-[0_20px_60px_rgba(0,0,0,0.6)] backdrop-blur-2xl",
        "transition-all duration-200",
        isOpen ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0",
        className,
      ].join(" ")}
      style={{
        right: 72,
        width: ANCHORED_PANEL_WIDTH,
        maxHeight: ANCHORED_PANEL_MAX_HEIGHT,
        height: fixedHeight,
        top,
      }}
    >
      {children}
    </div>
  );
}
