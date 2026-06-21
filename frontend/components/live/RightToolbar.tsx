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
  if (level === null) return <BatteryMedium size={18} color="#fff" />;
  if (level <= 20) return <BatteryLow size={18} color="#ef4444" />;
  if (level <= 50) return <BatteryMedium size={18} color="#fbbf24" />;
  return <BatteryFull size={18} color="#4ade80" />;
}

const ToolbarButton = ({ icon, label, onClick, active, badge }: ToolbarButtonProps) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      style={{
        width: 46,
        height: 46,
        borderRadius: "50%",
        background: active ? "#0F766E" : "rgba(15,23,42,0.85)",
        border: active
          ? "2px solid rgba(255,255,255,0.3)"
          : "1.5px solid rgba(255,255,255,0.15)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        position: "relative",
        transition: "all 0.15s ease",
      }}
    >
      {icon}
      {badge != null && badge !== 0 ? (
        <div
          style={{
            position: "absolute",
            top: -3,
            right: -3,
            background: "#ef4444",
            borderRadius: "50%",
            width: 16,
            height: 16,
            fontSize: 9,
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 500,
            border: "1.5px solid rgba(15,23,42,0.85)",
          }}
        >
          {badge}
        </div>
      ) : null}
    </button>
    <span style={{ fontSize: 9, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>
      {label}
    </span>
  </div>
);

interface MapControlBtnProps {
  icon: React.ReactNode;
  onClick: () => void;
  label: string;
}

const MapControlBtn = ({ icon, onClick, label }: MapControlBtnProps) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    style={{
      width: 34,
      height: 34,
      borderRadius: "50%",
      background: "rgba(15,23,42,0.85)",
      border: "1.5px solid rgba(255,255,255,0.15)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
    }}
  >
    {icon}
  </button>
);

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
      icon: <CloudSun size={18} color="#fbbf24" />,
      label: weather?.temperature_2m != null ? `${Math.round(weather.temperature_2m)}°` : "Weather",
      badge: null as string | number | null,
      onClick: onWeatherTap,
    },
    {
      id: "notifications",
      icon: <Bell size={18} color="#fff" />,
      label: "Alerts",
      badge: unreadAlerts > 0 ? unreadAlerts : null,
      onClick: onNotificationsTap,
    },
    {
      id: "wayra",
      icon: <Mic size={18} color={isListening ? "#34d399" : "#fff"} />,
      label: isListening ? "Listening" : "Wayra",
      badge: null,
      onClick: onWayraTap,
    },
    {
      id: "connectivity",
      icon: <Users size={18} color="#fff" />,
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
      icon: <Bookmark size={18} color="#fff" />,
      label: "Pins",
      badge: null,
      onClick: onSavedPinsTap,
    },
  ];

  return (
    <div
      style={{
        position: "absolute",
        right: "12px",
        top: "50%",
        transform: "translateY(-50%)",
        zIndex: 22,
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}
    >
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

      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
        <MapControlBtn icon={<ZoomIn size={15} color="#fff" />} onClick={onZoomIn} label="Zoom in" />
        <MapControlBtn icon={<ZoomOut size={15} color="#fff" />} onClick={onZoomOut} label="Zoom out" />
        <MapControlBtn icon={<Layers size={15} color="#fff" />} onClick={onStyleTap} label="Map style" />
      </div>
    </div>
  );
}
