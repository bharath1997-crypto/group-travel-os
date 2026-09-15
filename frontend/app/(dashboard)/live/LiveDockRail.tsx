"use client";

import {
  Bell,
  CarFront,
  CheckSquare,
  DollarSign,
  List,
  MapPin,
  Navigation,
  SlidersHorizontal,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { LiveDockStage } from "./live-dock-stages";
import { LIVE_DOCK_STAGE_ENABLED, LIVE_DOCK_STAGE_LABELS } from "./live-dock-stages";

type RailItem = {
  id: LiveDockStage;
  icon: LucideIcon;
  badge?: boolean;
};

const RAIL_ITEMS: RailItem[] = [
  { id: "setup", icon: SlidersHorizontal },
  { id: "nearby", icon: List },
  { id: "place", icon: MapPin },
  { id: "vote", icon: CheckSquare },
  { id: "converge", icon: Users },
  { id: "navigate", icon: Navigation },
  { id: "seat", icon: CarFront },
  { id: "inbox", icon: Bell, badge: true },
  { id: "settle", icon: DollarSign },
];

type LiveDockRailProps = {
  activeStage: LiveDockStage;
  panelOpen: boolean;
  onStageSelect: (stage: LiveDockStage) => void;
  onComingSoonStage?: (label: string) => void;
  placeAvailable?: boolean;
  nearbyAvailable?: boolean;
  convergeAvailable?: boolean;
  voteAvailable?: boolean;
  seatAvailable?: boolean;
  settleAvailable?: boolean;
  dimmed?: boolean;
};

export default function LiveDockRail({
  activeStage,
  panelOpen,
  onStageSelect,
  onComingSoonStage,
  placeAvailable = false,
  nearbyAvailable = false,
  convergeAvailable = false,
  voteAvailable = false,
  seatAvailable = false,
  settleAvailable = false,
  dimmed = false,
}: LiveDockRailProps) {
  function isStageInteractive(stage: LiveDockStage): boolean {
    if (stage === "converge") return convergeAvailable;
    if (stage === "vote") return voteAvailable;
    if (stage === "seat") return seatAvailable;
    if (stage === "settle") return settleAvailable;
    if (!LIVE_DOCK_STAGE_ENABLED[stage]) return false;
    if (stage === "place") return placeAvailable;
    if (stage === "nearby") return nearbyAvailable;
    return true;
  }

  function handleClick(stage: LiveDockStage) {
    if (stage === "converge") {
      if (!convergeAvailable) {
        onComingSoonStage?.("Set a destination and start Group Live first.");
        return;
      }
      onStageSelect(stage);
      return;
    }
    if (stage === "vote") {
      if (!voteAvailable) {
        onComingSoonStage?.("Set a destination and open a group vote first.");
        return;
      }
      onStageSelect(stage);
      return;
    }
    if (stage === "seat") {
      if (!seatAvailable) {
        onComingSoonStage?.("Switch to Seat Share and start live first.");
        return;
      }
      onStageSelect(stage);
      return;
    }
    if (stage === "settle") {
      if (!settleAvailable) {
        onComingSoonStage?.("Wrap up the night from Group Live first.");
        return;
      }
      onStageSelect(stage);
      return;
    }
    if (!LIVE_DOCK_STAGE_ENABLED[stage]) {
      onComingSoonStage?.(LIVE_DOCK_STAGE_LABELS[stage]);
      return;
    }
    if (stage === "place" && !placeAvailable) {
      onComingSoonStage?.("Select a place on the map first.");
      return;
    }
    if (stage === "nearby" && !nearbyAvailable) {
      onComingSoonStage?.("Search a category to see nearby results.");
      return;
    }
    onStageSelect(stage);
  }

  return (
    <div
      className={`pointer-events-auto absolute left-[max(0.75rem,14px)] top-[calc(4.5rem+env(safe-area-inset-top,0px))] z-[47] flex flex-col gap-0.5 rounded-2xl border border-[rgba(15,22,20,0.12)] bg-[#FBFAF7] p-1.5 shadow-[0_14px_36px_-16px_rgba(0,0,0,0.35)] backdrop-blur-md transition-all duration-300 md:top-[calc(4.5rem+env(safe-area-inset-top,0px))] ${
        dimmed ? "pointer-events-none translate-y-[-6px] opacity-0" : "translate-y-0 opacity-100"
      }`}
      aria-label="Live tools"
    >
      {RAIL_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = panelOpen && activeStage === item.id;
        const interactive = isStageInteractive(item.id);
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => handleClick(item.id)}
            aria-label={LIVE_DOCK_STAGE_LABELS[item.id]}
            title={LIVE_DOCK_STAGE_LABELS[item.id]}
            aria-pressed={isActive}
            className={`relative flex h-8 w-8 items-center justify-center rounded-[11px] transition-colors ${
              isActive
                ? "bg-primary-soft text-[#0F1614] ring-1 ring-primary/25"
                : interactive
                  ? "text-[#0F1614] hover:bg-[#F1EFE8]"
                  : "text-[#5F665F] hover:bg-[#F1EFE8] hover:text-[#0F1614]"
            }`}
          >
            <Icon className="h-4 w-4" strokeWidth={1.9} aria-hidden />
            {item.badge ? (
              <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full border border-[#FBFAF7] bg-[#D2453D]" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
