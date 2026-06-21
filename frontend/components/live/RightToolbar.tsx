"use client";

import {
  BatteryFull,
  BatteryLow,
  BatteryMedium,
  Bell,
  Bookmark,
  CloudSun,
  Layers,
  Mic,
  Users,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { LiveWeather } from "@/lib/live/types";

export type ExtendedWeather = LiveWeather & {
  temperature_2m?: number;
};

interface RightToolbarProps {
  weather: ExtendedWeather | null;
  batteryLevel: number | null;
  connectivityCount: number;
  unreadAlerts: number;
  isListening: boolean;
  onWeatherTap: () => void;
  onNotificationsTap: () => void;
  onWayraTap: () => void;
  onConnectivityTap: () => void;
  onSavedPinsTap: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onStyleTap: () => void;
  activePanel: string | null;
}

interface ToolbarButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  badge?: string | number | null;
}

function getBatteryIcon(level: number | null) {
  if (level === null) return <BatteryMedium size={18} className="text-white" />;
  if (level <= 20) return <BatteryLow size={18} className="text-red-400" />;
  if (level <= 50) return <BatteryMedium size={18} className="text-amber-400" />;
  return <BatteryFull size={18} className="text-green-400" />;
}

function ToolbarButton({ icon, label, onClick, active, badge }: ToolbarButtonProps) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className={[
          "relative flex h-[46px] w-[46px] items-center justify-center rounded-full transition-all duration-150",
          active
            ? "border-2 border-white/30 bg-[#0F766E] ring-2 ring-[#5EEAD4]/70 ring-offset-1 ring-offset-transparent"
            : "border border-white/15 bg-slate-900/70 hover:bg-slate-800/90",
        ].join(" ")}
      >
        {icon}
        {badge != null && badge !== 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full border-[1.5px] border-slate-900/85 bg-red-500 text-[9px] font-medium text-white">
            {badge}
          </span>
        ) : null}
      </button>
      <span className="text-[9px] font-medium text-white/70">{label}</span>
    </div>
  );
}

interface MapControlBtnProps {
  icon: React.ReactNode;
  onClick: () => void;
  label: string;
}

function MapControlBtn({ icon, onClick, label }: MapControlBtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-white/15 bg-slate-900/70 transition-all duration-150 hover:bg-slate-800/90"
    >
      {icon}
    </button>
  );
}

export function RightToolbar({
  weather,
  batteryLevel,
  connectivityCount,
  unreadAlerts,
  isListening,
  onWeatherTap,
  onNotificationsTap,
  onWayraTap,
  onConnectivityTap,
  onSavedPinsTap,
  onZoomIn,
  onZoomOut,
  onStyleTap,
  activePanel,
}: RightToolbarProps) {
  const toolbarButtons = [
    {
      id: "weather",
      icon: <CloudSun size={18} className="text-amber-400" />,
      label: weather?.temperature_2m != null ? `${Math.round(weather.temperature_2m)}°` : "Weather",
      badge: null as string | number | null,
      onClick: onWeatherTap,
    },
    {
      id: "notifications",
      icon: <Bell size={18} className="text-white" />,
      label: "Alerts",
      badge: unreadAlerts > 0 ? unreadAlerts : null,
      onClick: onNotificationsTap,
    },
    {
      id: "wayra",
      icon: <Mic size={18} className={isListening ? "text-emerald-400" : "text-white"} />,
      label: isListening ? "Listening" : "Wayra",
      badge: null,
      onClick: onWayraTap,
    },
    {
      id: "connectivity",
      icon: <Users size={18} className="text-white" />,
      label: String(connectivityCount),
      badge: null,
      onClick: onConnectivityTap,
    },
    {
      id: "battery",
      icon: getBatteryIcon(batteryLevel),
      label: batteryLevel !== null ? `${batteryLevel}%` : "Battery",
      badge: batteryLevel !== null && batteryLevel <= 20 ? "!" : null,
      onClick: () => {},
    },
    {
      id: "pins",
      icon: <Bookmark size={18} className="text-white" />,
      label: "Pins",
      badge: null,
      onClick: onSavedPinsTap,
    },
  ];

  return (
    <div className="absolute right-3 top-1/2 z-[22] flex -translate-y-1/2 flex-col gap-2.5 rounded-2xl border border-white/20 bg-slate-900/45 p-2 shadow-xl backdrop-blur-md">
      {toolbarButtons.map((btn) => (
        <ToolbarButton
          key={btn.id}
          icon={btn.icon}
          label={btn.label}
          onClick={btn.onClick}
          active={activePanel === btn.id}
          badge={btn.badge}
        />
      ))}

      <div className="mt-1 flex flex-col gap-1.5 border-t border-white/10 pt-2">
        <MapControlBtn icon={<ZoomIn size={15} className="text-white" />} onClick={onZoomIn} label="Zoom in" />
        <MapControlBtn icon={<ZoomOut size={15} className="text-white" />} onClick={onZoomOut} label="Zoom out" />
        <MapControlBtn icon={<Layers size={15} className="text-white" />} onClick={onStyleTap} label="Map style" />
      </div>
    </div>
  );
}
