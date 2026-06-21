"use client";

import {
  BatteryFull,
  BatteryLow,
  BatteryMedium,
  Bell,
  Bookmark,
  CloudSun,
  Layers,
  MessageSquare,
  Mic,
  Users,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { MutableRefObject, ReactNode } from "react";

export type LiveRailButtonId =
  | "weather"
  | "notifications"
  | "wayra"
  | "lounge"
  | "connectivity"
  | "battery"
  | "pins";

export interface LiveControlButtonConfig {
  id: LiveRailButtonId;
  icon: ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  badge?: number | string | null;
  value?: string | null;
  disabled?: boolean;
}

interface LiveControlButtonProps {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  badge?: number | string | null;
  value?: string | null;
  disabled?: boolean;
  buttonRef?: (el: HTMLDivElement | null) => void;
}

export function getBatteryIcon(level: number | null) {
  if (level === null) return <BatteryMedium size={17} className="text-white/80" />;
  if (level <= 20) return <BatteryLow size={17} className="text-red-400" />;
  if (level <= 50) return <BatteryMedium size={17} className="text-amber-400" />;
  return <BatteryFull size={17} className="text-green-400" />;
}

const LiveControlButton = ({
  icon,
  label,
  onClick,
  active,
  badge,
  value,
  disabled,
  buttonRef,
}: LiveControlButtonProps) => (
  <div ref={buttonRef} className="group relative flex flex-col items-center">
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={[
        "relative flex h-11 w-11 items-center justify-center rounded-full border border-white/10 backdrop-blur-xl transition-all duration-150 ease-out",
        active
          ? "border-emerald-400/40 bg-emerald-500/25 shadow-[0_0_12px_rgba(16,185,129,0.25)]"
          : "bg-white/8 hover:bg-white/14 active:bg-white/20",
        disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer",
      ].join(" ")}
    >
      {icon}
      {badge != null && badge !== 0 ? (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full border border-slate-950/60 bg-red-500 px-1 text-[9px] font-medium text-white">
          {badge}
        </span>
      ) : null}
    </button>
    {value ? (
      <span className="mt-0.5 text-[9px] font-medium leading-none text-white/60">{value}</span>
    ) : null}
    <span
      className="
        pointer-events-none absolute right-12 top-1/2 hidden -translate-y-1/2
        whitespace-nowrap rounded-lg border border-white/10 bg-slate-900/90
        px-2 py-1 text-[11px] text-white opacity-0 backdrop-blur-sm
        transition-opacity duration-150 group-hover:opacity-100 md:block
      "
    >
      {label}
    </span>
  </div>
);

interface MapButtonConfig {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}

interface LiveControlRailProps {
  activePanel: string | null;
  weatherTemp: number | null;
  batteryLevel: number | null;
  connectivityCount: number;
  unreadAlerts: number;
  unreadLounge: number;
  isListening: boolean;
  onToolbarTap: (id: LiveRailButtonId) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onStyleTap: () => void;
  buttonRefs: MutableRefObject<Partial<Record<LiveRailButtonId, HTMLDivElement | null>>>;
}

export function LiveControlRail({
  activePanel,
  weatherTemp,
  batteryLevel,
  connectivityCount,
  unreadAlerts,
  unreadLounge,
  isListening,
  onToolbarTap,
  onZoomIn,
  onZoomOut,
  onStyleTap,
  buttonRefs,
}: LiveControlRailProps) {
  const setButtonRef = (id: LiveRailButtonId) => (el: HTMLDivElement | null) => {
    buttonRefs.current[id] = el;
  };

  const mainButtons: LiveControlButtonConfig[] = [
    {
      id: "weather",
      icon: <CloudSun size={17} className="text-amber-300" />,
      label: "Weather",
      onClick: () => onToolbarTap("weather"),
      active: activePanel === "weather",
      value: weatherTemp != null ? `${Math.round(weatherTemp)}°` : undefined,
    },
    {
      id: "notifications",
      icon: <Bell size={17} className="text-white/80" />,
      label: "Alerts",
      onClick: () => onToolbarTap("notifications"),
      active: activePanel === "notifications",
      badge: unreadAlerts > 0 ? unreadAlerts : null,
    },
    {
      id: "wayra",
      icon: <Mic size={17} className={isListening ? "text-emerald-400" : "text-white/80"} />,
      label: "Wayra",
      onClick: () => onToolbarTap("wayra"),
      active: activePanel === "wayra" || isListening,
    },
    {
      id: "lounge",
      icon: <MessageSquare size={17} className="text-white/80" />,
      label: "Lounge",
      onClick: () => onToolbarTap("lounge"),
      active: activePanel === "lounge",
      badge: unreadLounge > 0 ? unreadLounge : null,
    },
    {
      id: "connectivity",
      icon: <Users size={17} className="text-white/80" />,
      label: "Travelers",
      onClick: () => onToolbarTap("connectivity"),
      active: activePanel === "connectivity",
      value: String(connectivityCount),
    },
    {
      id: "battery",
      icon: getBatteryIcon(batteryLevel),
      label: "Battery",
      onClick: () => {},
      value: batteryLevel !== null ? `${batteryLevel}%` : undefined,
      badge: batteryLevel !== null && batteryLevel <= 20 ? "!" : null,
    },
    {
      id: "pins",
      icon: <Bookmark size={17} className="text-white/80" />,
      label: "Pins",
      onClick: () => onToolbarTap("pins"),
      active: activePanel === "pins",
    },
  ];

  const mapButtons: MapButtonConfig[] = [
    {
      icon: <ZoomIn size={14} className="text-white/70" />,
      label: "Zoom in",
      onClick: onZoomIn,
    },
    {
      icon: <ZoomOut size={14} className="text-white/70" />,
      label: "Zoom out",
      onClick: onZoomOut,
    },
    {
      icon: <Layers size={14} className="text-white/70" />,
      label: "Map style",
      onClick: onStyleTap,
    },
  ];

  return (
    <div className="absolute right-3 top-1/2 z-[22] flex -translate-y-1/2 flex-col items-center gap-2">
      <div
        className="
          flex flex-col items-center gap-2 rounded-2xl border border-white/10
          bg-slate-950/45 p-2 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-xl
        "
      >
        {mainButtons.map((btn) => (
          <LiveControlButton
            key={btn.id}
            icon={btn.icon}
            label={btn.label}
            onClick={btn.onClick}
            active={btn.active}
            badge={btn.badge}
            value={btn.value}
            disabled={btn.disabled}
            buttonRef={setButtonRef(btn.id)}
          />
        ))}
      </div>

      <div
        className="
          flex flex-col items-center gap-1.5 rounded-xl border border-white/8
          bg-slate-950/35 p-1.5 shadow-[0_4px_16px_rgba(0,0,0,0.3)] backdrop-blur-xl
        "
      >
        {mapButtons.map((btn) => (
          <button
            key={btn.label}
            type="button"
            onClick={btn.onClick}
            aria-label={btn.label}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/8 bg-white/6 transition-colors hover:bg-white/12"
          >
            {btn.icon}
          </button>
        ))}
      </div>
    </div>
  );
}
