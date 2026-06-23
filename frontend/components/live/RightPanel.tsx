"use client";

import {
  AlertTriangle,
  Bookmark,
  Camera,
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  Loader2,
  MapPin,
  Mic,
  Sun,
  Users,
  X,
} from "lucide-react";
import { AnchoredLivePopover } from "@/components/live/AnchoredLivePopover";
import { minutesAgo, type NearbyTraveler } from "@/lib/live/types";

export type WeatherDetail = {
  temperature_2m: number;
  relative_humidity_2m: number;
  apparent_temperature: number;
  precipitation: number;
  weathercode: number;
  windspeed_10m: number;
};

type PinOut = {
  id: string;
  latitude: number;
  longitude: number;
  name: string;
  note: string | null;
};

export type LiveAlertItem = {
  id: string;
  title: string;
  time: string;
  icon: React.ReactNode;
};

const WEATHER_CONFIG: Record<string, { label: string; icon: React.ReactNode }> = {
  clear: { label: "Clear", icon: <Sun size={13} className="text-amber-400" /> },
  cloudy: { label: "Partly cloudy", icon: <Cloud size={13} className="text-sky-300" /> },
  fog: { label: "Foggy", icon: <CloudFog size={13} className="text-slate-400" /> },
  rain: { label: "Rain", icon: <CloudRain size={13} className="text-blue-400" /> },
  snow: { label: "Snow", icon: <CloudSnow size={13} className="text-blue-200" /> },
  storm: { label: "Storm", icon: <CloudLightning size={13} className="text-red-400" /> },
  drizzle: { label: "Showers", icon: <CloudDrizzle size={13} className="text-sky-300" /> },
};

function getWeatherConfig(code: number) {
  if (code === 0) return WEATHER_CONFIG.clear;
  if (code <= 3) return WEATHER_CONFIG.cloudy;
  if (code <= 48) return WEATHER_CONFIG.fog;
  if (code <= 67) return WEATHER_CONFIG.rain;
  if (code <= 77) return WEATHER_CONFIG.snow;
  if (code <= 82) return WEATHER_CONFIG.drizzle;
  if (code <= 99) return WEATHER_CONFIG.storm;
  return null;
}

interface RightPanelProps {
  activePanel: string | null;
  anchorEl: HTMLElement | null;
  onClosePanel: () => void;
  weatherDetail: WeatherDetail | null;
  weatherLoading: boolean;
  onRefreshWeather: () => void;
  alerts: LiveAlertItem[];
  onClearAlerts: () => void;
  isListening: boolean;
  toggleVoiceListening: () => void;
  connectivityCount: number;
  nearbyTravelers: NearbyTraveler[];
  onTravelerTap: (traveler: NearbyTraveler) => void;
  savedPins: PinOut[];
  pinsLoading: boolean;
  onNavigateToPin: (pin: PinOut) => void;
  onSaveCurrentLocation: () => void;
}

const PANEL_IDS = new Set(["weather", "notifications", "wayra", "connectivity", "pins"]);

export function RightPanel({
  activePanel,
  anchorEl,
  onClosePanel,
  weatherDetail,
  weatherLoading,
  onRefreshWeather,
  alerts,
  onClearAlerts,
  isListening,
  toggleVoiceListening,
  connectivityCount,
  nearbyTravelers,
  onTravelerTap,
  savedPins,
  pinsLoading,
  onNavigateToPin,
  onSaveCurrentLocation,
}: RightPanelProps) {
  const isOpen = Boolean(activePanel && PANEL_IDS.has(activePanel));

  const panelTitle =
    activePanel === "weather"
      ? "Weather"
      : activePanel === "notifications"
        ? "Alerts"
        : activePanel === "wayra"
          ? "Wayra"
          : activePanel === "connectivity"
            ? "Travelers"
            : activePanel === "pins"
              ? "Saved pins"
              : "";

  const weatherConfig = weatherDetail
    ? getWeatherConfig(weatherDetail.weathercode)
    : null;

  return (
    <AnchoredLivePopover isOpen={isOpen} anchorEl={isOpen ? anchorEl : null}>
      <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
        <span className="text-[13px] font-medium text-white">{panelTitle}</span>
        <button
          type="button"
          onClick={onClosePanel}
          className="text-white/40 transition-colors hover:text-white/70"
          aria-label="Close panel"
        >
          <X size={15} />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {activePanel === "weather" ? (
          <div className="overflow-y-auto p-4">
            {weatherLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 size={24} className="animate-spin text-emerald-400" />
              </div>
            ) : weatherDetail ? (
              <>
                <p className="text-5xl font-semibold leading-none text-white">
                  {Math.round(weatherDetail.temperature_2m)}°F
                </p>
                {weatherConfig ? (
                  <div className="mt-2 flex items-center gap-2">
                    {weatherConfig.icon}
                    <span className="text-sm text-white/60">{weatherConfig.label}</span>
                  </div>
                ) : null}
                <div className="mt-5 grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-[10px] text-white/40">Feels like</p>
                    <p className="mt-1 text-sm font-medium text-white">
                      {Math.round(weatherDetail.apparent_temperature)}°
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-white/40">Humidity</p>
                    <p className="mt-1 text-sm font-medium text-white">
                      {weatherDetail.relative_humidity_2m}%
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-white/40">Wind</p>
                    <p className="mt-1 text-sm font-medium text-white">
                      {Math.round(weatherDetail.windspeed_10m)} mph
                    </p>
                  </div>
                </div>
                <p className="mt-4 text-sm text-white/60">
                  Precipitation: {weatherDetail.precipitation}mm
                </p>
                <div className="my-4 h-px bg-white/8" />
                <p className="text-sm text-white/40">Next 2 hours</p>
                <p className="mt-1 text-xs text-white/25">Forecast coming soon</p>
              </>
            ) : (
              <p className="text-sm text-white/40">Weather unavailable</p>
            )}
            <button
              type="button"
              onClick={onRefreshWeather}
              className="mt-4 w-full rounded-lg bg-white/8 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/12"
            >
              Refresh
            </button>
          </div>
        ) : null}

        {activePanel === "notifications" ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            {alerts.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-white/40">
                No alerts on your route
              </p>
            ) : (
              <ul className="m-0 list-none p-0">
                {alerts.map((alert) => (
                  <li
                    key={alert.id}
                    className="flex items-start gap-2.5 border-b border-white/6 px-4 py-3"
                  >
                    {alert.icon}
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-white/90">{alert.title}</p>
                      <p className="mt-0.5 text-[11px] text-white/35">{alert.time}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {alerts.length > 0 ? (
              <div className="border-t border-white/6 p-3">
                <button
                  type="button"
                  onClick={onClearAlerts}
                  className="w-full rounded-lg border border-white/10 py-2 text-sm text-white/60 transition-colors hover:bg-white/5"
                >
                  Clear all
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {activePanel === "wayra" ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
            <div
              className={[
                "flex h-[72px] w-[72px] items-center justify-center rounded-full transition-all",
                isListening
                  ? "border-[3px] border-[#0F766E]/60 bg-[#0F766E]"
                  : "border-2 border-white/10 bg-white/8",
              ].join(" ")}
            >
              <Mic size={28} className={isListening ? "text-white" : "text-white/50"} />
            </div>
            <span className="text-center text-sm text-white/60">
              {isListening ? "Listening..." : "Tap to speak with Wayra"}
            </span>
            <button
              type="button"
              onClick={toggleVoiceListening}
              className={[
                "rounded-full px-7 py-2.5 text-sm font-medium text-white transition-colors",
                isListening ? "bg-red-500 hover:bg-red-600" : "bg-[#0F766E] hover:bg-[#0d655c]",
              ].join(" ")}
            >
              {isListening ? "Stop" : "Speak"}
            </button>
            <span className="text-center text-[11px] text-white/35">
              Wayra replies aloud · no text shown
            </span>
          </div>
        ) : null}

        {activePanel === "connectivity" ? (
          <div className="overflow-y-auto p-4">
            <p className="text-4xl font-semibold leading-none text-white">{connectivityCount}</p>
            <p className="mt-1 text-sm text-white/50">Rovvy users nearby on your route</p>
            {nearbyTravelers.length === 0 ? (
              <p className="mt-6 text-sm text-white/35">No travelers nearby right now</p>
            ) : (
              <ul className="m-0 mt-5 list-none p-0">
                {nearbyTravelers.map((traveler) => (
                  <li key={traveler.traveler_id}>
                    <button
                      type="button"
                      onClick={() => onTravelerTap(traveler)}
                      className="flex w-full items-center gap-2.5 border-b border-white/6 py-2.5 text-left transition-colors hover:bg-white/5"
                    >
                      <span className="h-2 w-2 shrink-0 rounded-full bg-white/40" />
                      <span className="flex-1 text-[13px] font-medium text-white/90">
                        {traveler.label}
                      </span>
                      <Users size={14} className="text-white/30" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        {activePanel === "pins" ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
            <p className="mb-3 text-[13px] font-medium text-white/90">Saved locations</p>
            {pinsLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 size={20} className="animate-spin text-emerald-400" />
              </div>
            ) : savedPins.length === 0 ? (
              <p className="text-sm text-white/35">No saved pins yet</p>
            ) : (
              <ul className="m-0 flex-1 list-none p-0">
                {savedPins.map((pin) => (
                  <li
                    key={pin.id}
                    className="flex items-start gap-2.5 border-b border-white/6 py-2.5"
                  >
                    <Bookmark size={16} className="mt-0.5 shrink-0 text-emerald-400" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-white/90">{pin.name}</p>
                      {pin.note ? (
                        <p className="mt-0.5 truncate text-[11px] text-white/35">{pin.note}</p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => onNavigateToPin(pin)}
                      className="shrink-0 rounded-md bg-[#0F766E] px-2 py-1 text-[11px] font-medium text-white hover:bg-[#0d655c]"
                    >
                      Navigate
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={onSaveCurrentLocation}
              className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg bg-white/8 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/12"
            >
              <MapPin size={14} />
              Save current location
            </button>
          </div>
        ) : null}
      </div>
    </AnchoredLivePopover>
  );
}

export function buildAlertItems(
  routeAlert: { alert_id: string; message: string } | null,
  cameraAlert: { camera_id: string; message: string } | null,
  wayraAlert: { message: string } | null,
  hazardBanner: {
    report: { id: string; created_at: string; report_type: string };
    distanceM: number;
  } | null,
  reportConfig: Record<string, { label: string }>,
): LiveAlertItem[] {
  const items: LiveAlertItem[] = [];
  if (routeAlert) {
    items.push({
      id: routeAlert.alert_id,
      title: routeAlert.message,
      time: "Active now",
      icon: <AlertTriangle size={16} className="text-amber-400" />,
    });
  }
  if (cameraAlert) {
    items.push({
      id: cameraAlert.camera_id,
      title: cameraAlert.message,
      time: "Active now",
      icon: <Camera size={16} className="text-red-400" />,
    });
  }
  if (wayraAlert) {
    items.push({
      id: "wayra-alert",
      title: wayraAlert.message,
      time: "Active now",
      icon: <AlertTriangle size={16} className="text-emerald-400" />,
    });
  }
  if (hazardBanner) {
    const config = reportConfig[hazardBanner.report.report_type];
    items.push({
      id: hazardBanner.report.id,
      title: `${config?.label ?? "Hazard"} · ${Math.round(hazardBanner.distanceM)}m away`,
      time: `${minutesAgo(hazardBanner.report.created_at) === 0 ? "just now" : `${minutesAgo(hazardBanner.report.created_at)} min ago`}`,
      icon: <AlertTriangle size={16} className="text-orange-400" />,
    });
  }
  return items;
}
