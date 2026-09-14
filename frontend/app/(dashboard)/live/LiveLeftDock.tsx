"use client";

import type { ReactNode } from "react";
import type { LiveDockStage } from "./live-dock-stages";
import { LIVE_DOCK_PANEL_WIDTH } from "./live-dock-stages";
import { LIVE_PANEL_MOTION } from "./live-design-tokens";

type LiveLeftDockProps = {
  children: ReactNode;
  stage: LiveDockStage;
  open: boolean;
  dimmed?: boolean;
};

/** Cream panel that slides out beside the icon rail (v3 prototype pattern). */
export default function LiveLeftDock({
  children,
  stage,
  open,
  dimmed = false,
}: LiveLeftDockProps) {
  const panelWidth = LIVE_DOCK_PANEL_WIDTH[stage] ?? "324px";

  return (
    <div
      id="live-left-dock"
      style={{ width: panelWidth, maxWidth: "calc(100vw - 74px)" }}
      className={`pointer-events-auto absolute bottom-11 left-[60px] top-[calc(4.5rem+env(safe-area-inset-top,0px))] z-[46] flex min-h-0 flex-col ${LIVE_PANEL_MOTION} md:top-[calc(4.5rem+env(safe-area-inset-top,0px))] ${
        open && !dimmed
          ? "translate-x-0 opacity-100"
          : "pointer-events-none -translate-x-3 opacity-0"
      }`}
      aria-hidden={!open || dimmed}
    >
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-1">{children}</div>
    </div>
  );
}
