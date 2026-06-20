export type ReportType =
  | "accident"
  | "traffic"
  | "closure"
  | "police"
  | "pothole"
  | "flood"
  | "construction"
  | "hazard"
  | "stopped_vehicle"
  | "weather";

export type RoadReport = {
  id: string;
  reporter_id: string;
  report_type: ReportType;
  lat: number;
  lng: number;
  city: string | null;
  description: string | null;
  confirmed_count: number;
  dismissed_count: number;
  is_active: boolean;
  expires_at: string;
  created_at: string;
};

export type TrafficDensityPoint = {
  lat: number;
  lng: number;
  count: number;
  level: "low" | "medium" | "high";
};

export type LiveWeather = {
  precipitation: number;
  weathercode: number;
  windspeed_10m: number;
};

export type RouteAlertItem = {
  alert_id: string;
  report_type: ReportType;
  tier: "advance" | "soon" | "immediate";
  distance_miles: number;
  minutes_away: number | null;
  message: string;
};

export type NearbyTraveler = {
  traveler_id: string;
  distance_miles: number;
  label: string;
  lat: number;
  lng: number;
  bearing: number | null;
};

export const REPORT_CONFIG: Record<
  ReportType,
  { emoji: string; color: string; label: string }
> = {
  accident: { emoji: "🚗", color: "#dc2626", label: "Accident" },
  traffic: { emoji: "🟠", color: "#d97706", label: "Traffic" },
  closure: { emoji: "⛔", color: "#7c3aed", label: "Road closure" },
  police: { emoji: "🚔", color: "#1d4ed8", label: "Police" },
  pothole: { emoji: "⚠️", color: "#92400e", label: "Pothole" },
  flood: { emoji: "💧", color: "#0369a1", label: "Flood" },
  construction: { emoji: "🚧", color: "#b45309", label: "Construction" },
  hazard: { emoji: "❗", color: "#dc2626", label: "Hazard" },
  stopped_vehicle: { emoji: "🚗", color: "#6b7280", label: "Stopped vehicle" },
  weather: { emoji: "🌧️", color: "#4b5563", label: "Weather" },
};

export const REPORT_TYPES: ReportType[] = [
  "accident",
  "traffic",
  "closure",
  "police",
  "pothole",
  "flood",
  "construction",
  "hazard",
  "stopped_vehicle",
  "weather",
];

export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const radiusM = 6371000;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const dPhi = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLng / 2) ** 2;
  return radiusM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}

export function minutesAgo(iso: string): number {
  const created = new Date(iso).getTime();
  const diffMs = Date.now() - created;
  return Math.max(0, Math.floor(diffMs / 60000));
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function createReportPinElement(
  reportType: ReportType,
  onClick: () => void,
  hasUnread = false,
): HTMLButtonElement {
  const config = REPORT_CONFIG[reportType];
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "live-report-pin";
  btn.setAttribute("aria-label", config.label);
  btn.style.backgroundColor = config.color;
  btn.textContent = config.emoji;
  if (hasUnread) {
    const badge = document.createElement("span");
    badge.className = "live-report-pin-badge";
    badge.setAttribute("aria-hidden", "true");
    btn.appendChild(badge);
  }
  btn.addEventListener("click", (event) => {
    event.stopPropagation();
    onClick();
  });
  return btn;
}
