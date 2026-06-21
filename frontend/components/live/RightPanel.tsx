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
  clear: { label: "Clear", icon: <Sun size={13} color="#fbbf24" /> },
  cloudy: { label: "Partly cloudy", icon: <Cloud size={13} color="#93c5fd" /> },
  fog: { label: "Foggy", icon: <CloudFog size={13} color="#94a3b8" /> },
  rain: { label: "Rain", icon: <CloudRain size={13} color="#60a5fa" /> },
  snow: { label: "Snow", icon: <CloudSnow size={13} color="#bfdbfe" /> },
  storm: { label: "Storm", icon: <CloudLightning size={13} color="#f87171" /> },
  drizzle: { label: "Showers", icon: <CloudDrizzle size={13} color="#7dd3fc" /> },
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

function formatTimeAgo(iso: string): string {
  const mins = minutesAgo(iso);
  if (mins === 0) return "just now";
  return `${mins} min ago`;
}

interface RightPanelProps {
  activePanel: string | null;
  setActivePanel: (id: string | null) => void;
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
  userLat: number | null;
  userLng: number | null;
}

export function RightPanel({
  activePanel,
  setActivePanel,
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
  const panelTitle =
    activePanel === "weather"
      ? "Weather"
      : activePanel === "notifications"
        ? "Alerts"
        : activePanel === "wayra"
          ? "Wayra"
          : activePanel === "connectivity"
            ? "Nearby"
            : activePanel === "pins"
              ? "Saved pins"
              : "";

  const weatherConfig = weatherDetail
    ? getWeatherConfig(weatherDetail.weathercode)
    : null;

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        right: 68,
        bottom: 0,
        width: 300,
        background: "white",
        zIndex: 21,
        transform: activePanel ? "translateX(0)" : "translateX(calc(100% + 68px))",
        transition: "transform 0.25s cubic-bezier(0.32, 0.72, 0, 1)",
        borderLeft: "0.5px solid #e2e8f0",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        pointerEvents: activePanel ? "auto" : "none",
      }}
    >
      {activePanel ? (
        <>
          <div
            style={{
              padding: "14px 16px 10px",
              borderBottom: "0.5px solid #f1f5f9",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 500, color: "#0f172a" }}>
              {panelTitle}
            </span>
            <button
              type="button"
              onClick={() => setActivePanel(null)}
              style={{ background: "none", border: "none", cursor: "pointer" }}
              aria-label="Close panel"
            >
              <X size={16} color="#64748b" />
            </button>
          </div>

          <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {activePanel === "weather" ? (
              <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
                {weatherLoading ? (
                  <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
                    <Loader2 size={24} className="animate-spin" color="#0F766E" />
                  </div>
                ) : weatherDetail ? (
                  <>
                    <p
                      style={{
                        fontSize: 48,
                        fontWeight: 600,
                        color: "#0f172a",
                        lineHeight: 1,
                        margin: 0,
                      }}
                    >
                      {Math.round(weatherDetail.temperature_2m)}°F
                    </p>
                    {weatherConfig ? (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginTop: 8,
                        }}
                      >
                        {weatherConfig.icon}
                        <span style={{ fontSize: 14, color: "#64748b" }}>
                          {weatherConfig.label}
                        </span>
                      </div>
                    ) : null}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr 1fr",
                        gap: 12,
                        marginTop: 20,
                      }}
                    >
                      <div>
                        <p style={{ fontSize: 10, color: "#94a3b8", margin: 0 }}>Feels like</p>
                        <p style={{ fontSize: 14, fontWeight: 500, color: "#0f172a", margin: "4px 0 0" }}>
                          {Math.round(weatherDetail.apparent_temperature)}°
                        </p>
                      </div>
                      <div>
                        <p style={{ fontSize: 10, color: "#94a3b8", margin: 0 }}>Humidity</p>
                        <p style={{ fontSize: 14, fontWeight: 500, color: "#0f172a", margin: "4px 0 0" }}>
                          {weatherDetail.relative_humidity_2m}%
                        </p>
                      </div>
                      <div>
                        <p style={{ fontSize: 10, color: "#94a3b8", margin: 0 }}>Wind</p>
                        <p style={{ fontSize: 14, fontWeight: 500, color: "#0f172a", margin: "4px 0 0" }}>
                          {Math.round(weatherDetail.windspeed_10m)} mph
                        </p>
                      </div>
                    </div>
                    <p style={{ fontSize: 13, color: "#64748b", marginTop: 16 }}>
                      Precipitation: {weatherDetail.precipitation}mm
                    </p>
                    <div
                      style={{ height: 1, background: "#f1f5f9", margin: "16px 0" }}
                    />
                    <p style={{ fontSize: 13, color: "#94a3b8" }}>Next 2 hours</p>
                    <p style={{ fontSize: 12, color: "#cbd5e1", marginTop: 4 }}>
                      Forecast coming soon
                    </p>
                  </>
                ) : (
                  <p style={{ fontSize: 13, color: "#94a3b8" }}>Weather unavailable</p>
                )}
                <button
                  type="button"
                  onClick={onRefreshWeather}
                  style={{
                    marginTop: 24,
                    width: "100%",
                    background: "#f1f5f9",
                    border: "none",
                    borderRadius: 8,
                    padding: "10px",
                    fontSize: 13,
                    fontWeight: 500,
                    color: "#0f172a",
                    cursor: "pointer",
                  }}
                >
                  Refresh
                </button>
              </div>
            ) : null}

            {activePanel === "notifications" ? (
              <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
                {alerts.length === 0 ? (
                  <p
                    style={{
                      fontSize: 13,
                      color: "#94a3b8",
                      textAlign: "center",
                      padding: "32px 16px",
                    }}
                  >
                    No alerts on your route
                  </p>
                ) : (
                  <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                    {alerts.map((alert) => (
                      <li
                        key={alert.id}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 10,
                          padding: "10px 16px",
                          borderBottom: "0.5px solid #f1f5f9",
                        }}
                      >
                        {alert.icon}
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 13, fontWeight: 500, color: "#0f172a", margin: 0 }}>
                            {alert.title}
                          </p>
                          <p style={{ fontSize: 11, color: "#94a3b8", margin: "2px 0 0" }}>
                            {alert.time}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {alerts.length > 0 ? (
                  <div style={{ padding: "12px 16px" }}>
                    <button
                      type="button"
                      onClick={onClearAlerts}
                      style={{
                        width: "100%",
                        background: "none",
                        border: "0.5px solid #e2e8f0",
                        borderRadius: 8,
                        padding: "8px",
                        fontSize: 13,
                        color: "#64748b",
                        cursor: "pointer",
                      }}
                    >
                      Clear all
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}

            {activePanel === "wayra" ? (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 16,
                  padding: 24,
                }}
              >
                <div
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: "50%",
                    background: isListening ? "#0F766E" : "#f1f5f9",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: isListening ? "3px solid #5DCAA5" : "2px solid #e2e8f0",
                    transition: "all 0.2s",
                  }}
                >
                  <Mic size={28} color={isListening ? "#fff" : "#64748b"} />
                </div>
                <span style={{ fontSize: 14, color: "#64748b", textAlign: "center" }}>
                  {isListening ? "Listening..." : "Tap to speak with Wayra"}
                </span>
                <button
                  type="button"
                  onClick={toggleVoiceListening}
                  style={{
                    background: isListening ? "#ef4444" : "#0F766E",
                    color: "#fff",
                    border: "none",
                    borderRadius: 24,
                    padding: "10px 28px",
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  {isListening ? "Stop" : "Speak"}
                </button>
                <span style={{ fontSize: 11, color: "#94a3b8", textAlign: "center" }}>
                  Wayra replies aloud · no text shown
                </span>
              </div>
            ) : null}

            {activePanel === "connectivity" ? (
              <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
                <p
                  style={{
                    fontSize: 36,
                    fontWeight: 600,
                    color: "#0f172a",
                    margin: 0,
                    lineHeight: 1,
                  }}
                >
                  {connectivityCount}
                </p>
                <p style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
                  Rovvy users nearby on your route
                </p>
                {nearbyTravelers.length === 0 ? (
                  <p style={{ fontSize: 13, color: "#94a3b8", marginTop: 24 }}>
                    No travelers nearby right now
                  </p>
                ) : (
                  <ul style={{ listStyle: "none", margin: "20px 0 0", padding: 0 }}>
                    {nearbyTravelers.map((traveler, index) => (
                      <li key={traveler.traveler_id}>
                        <button
                          type="button"
                          onClick={() => onTravelerTap(traveler)}
                          style={{
                            width: "100%",
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "10px 0",
                            background: "none",
                            border: "none",
                            borderBottom: "0.5px solid #f1f5f9",
                            cursor: "pointer",
                            textAlign: "left",
                          }}
                        >
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              background: "#94a3b8",
                              flexShrink: 0,
                            }}
                          />
                          <div style={{ flex: 1 }}>
                            <p style={{ fontSize: 13, fontWeight: 500, color: "#0f172a", margin: 0 }}>
                            {traveler.label}
                          </p>
                          </div>
                          <Users size={14} color="#cbd5e1" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}

            {activePanel === "pins" ? (
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <p style={{ fontSize: 13, fontWeight: 500, color: "#0f172a", margin: "0 0 12px" }}>
                  Saved locations
                </p>
                {pinsLoading ? (
                  <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
                    <Loader2 size={20} className="animate-spin" color="#0F766E" />
                  </div>
                ) : savedPins.length === 0 ? (
                  <p style={{ fontSize: 13, color: "#94a3b8" }}>No saved pins yet</p>
                ) : (
                  <ul style={{ listStyle: "none", margin: 0, padding: 0, flex: 1 }}>
                    {savedPins.map((pin) => (
                      <li
                        key={pin.id}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 10,
                          padding: "10px 0",
                          borderBottom: "0.5px solid #f1f5f9",
                        }}
                      >
                        <Bookmark size={16} color="#0F766E" style={{ marginTop: 2, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 500, color: "#0f172a", margin: 0 }}>
                            {pin.name}
                          </p>
                          {pin.note ? (
                            <p
                              style={{
                                fontSize: 11,
                                color: "#94a3b8",
                                margin: "2px 0 0",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {pin.note}
                            </p>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => onNavigateToPin(pin)}
                          style={{
                            background: "#0F766E",
                            color: "#fff",
                            border: "none",
                            borderRadius: 6,
                            padding: "4px 8px",
                            fontSize: 11,
                            fontWeight: 500,
                            cursor: "pointer",
                            flexShrink: 0,
                          }}
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
                  style={{
                    marginTop: 16,
                    width: "100%",
                    background: "#f1f5f9",
                    border: "none",
                    borderRadius: 8,
                    padding: "10px",
                    fontSize: 13,
                    fontWeight: 500,
                    color: "#0f172a",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  <MapPin size={14} />
                  Save current location
                </button>
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
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
      icon: <AlertTriangle size={16} color="#f59e0b" />,
    });
  }
  if (cameraAlert) {
    items.push({
      id: cameraAlert.camera_id,
      title: cameraAlert.message,
      time: "Active now",
      icon: <Camera size={16} color="#ef4444" />,
    });
  }
  if (wayraAlert) {
    items.push({
      id: "wayra-alert",
      title: wayraAlert.message,
      time: "Active now",
      icon: <AlertTriangle size={16} color="#0F766E" />,
    });
  }
  if (hazardBanner) {
    const config = reportConfig[hazardBanner.report.report_type];
    items.push({
      id: hazardBanner.report.id,
      title: `${config?.label ?? "Hazard"} · ${Math.round(hazardBanner.distanceM)}m away`,
      time: formatTimeAgo(hazardBanner.report.created_at),
      icon: <AlertTriangle size={16} color="#f97316" />,
    });
  }
  return items;
}
