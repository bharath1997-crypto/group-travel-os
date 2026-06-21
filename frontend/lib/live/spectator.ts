export type SpectatorInviteResponse = {
  invite_token: string;
  share_url: string;
  expires_at: string;
};

export type SpectatorHostData = {
  session_id: string;
  host_name: string;
  host_avatar: string | null;
  trip_id: string | null;
  started_at: string;
  firebase_path: string;
};

export type SpectatorHostLocation = {
  lat: number;
  lng: number;
  bearing?: number;
  speed_mph?: number;
  road_name?: string | null;
  last_seen?: string;
};

export type SpectatorActiveCount = {
  count: number;
};

export function formatStartedAgo(startedAt: string): string {
  const started = new Date(startedAt).getTime();
  if (Number.isNaN(started)) return "just now";
  const minutes = Math.max(0, Math.floor((Date.now() - started) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem > 0 ? `${hours}h ${rem}m ago` : `${hours}h ago`;
}

export function formatLastUpdated(lastSeen: string | null | undefined): string {
  if (!lastSeen) return "just now";
  const ts = new Date(lastSeen).getTime();
  if (Number.isNaN(ts)) return "just now";
  const seconds = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds} sec ago`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes} min ago`;
}

export function createHostMarkerElement(): {
  element: HTMLDivElement;
  setBearing: (bearing: number | null) => void;
  setEnded: (ended: boolean) => void;
} {
  const root = document.createElement("div");
  root.className = "live-user-marker";

  const cone = document.createElement("div");
  cone.className = "live-user-cone is-hidden";

  const pulse = document.createElement("div");
  pulse.className = "live-user-pulse";

  const dot = document.createElement("div");
  dot.className = "live-user-dot";

  root.appendChild(cone);
  root.appendChild(pulse);
  root.appendChild(dot);

  const setBearing = (bearing: number | null) => {
    if (bearing == null || Number.isNaN(bearing)) {
      cone.classList.add("is-hidden");
      return;
    }
    cone.classList.remove("is-hidden");
    cone.style.transform = `translateX(-50%) rotate(${bearing}deg)`;
  };

  const setEnded = (ended: boolean) => {
    root.style.opacity = ended ? "0.45" : "1";
    pulse.style.display = ended ? "none" : "";
  };

  return { element: root, setBearing, setEnded };
}

export function getSunTimes(lat: number, lng: number): { sunrise: number; sunset: number } {
  const now = new Date();
  const dayOfYear = Math.floor(
    (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000,
  );
  const solarDeclination =
    -23.45 * Math.cos((360 / 365) * (dayOfYear + 10) * (Math.PI / 180));
  const hourAngle =
    (Math.acos(
      -Math.tan((lat * Math.PI) / 180) * Math.tan((solarDeclination * Math.PI) / 180),
    ) *
      180) /
    Math.PI;
  const sunriseHour = 12 - hourAngle / 15 - lng / 15;
  const sunsetHour = 12 + hourAngle / 15 - lng / 15;
  return { sunrise: sunriseHour, sunset: sunsetHour };
}

export function isNightMode(lat: number, lng: number): boolean {
  const now = new Date();
  const hour = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
  const { sunrise, sunset } = getSunTimes(lat, lng);
  return hour < sunrise || hour > sunset;
}
