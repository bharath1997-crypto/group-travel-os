export type GpsStatus =
  | "idle"
  | "requesting"
  | "active"
  | "approximate"
  | "timeout"
  | "denied"
  | "error"
  | "stale"
  | "outdated";

export type GpsState = {
  status: GpsStatus;
  lat: number | null;
  lng: number | null;
  accuracyMeters: number | null;
  heading: number | null;
  speed: number | null;
  timestamp: number | null;
  source: "browser_geolocation" | "manual" | "mock" | null;
  errorMessage?: string;
};

export const GPS_ACCEPTABLE_ACCURACY_M = 150;
/** Below this accuracy, show blue dot only. Above it, show uncertainty circle as well (dot always visible). */
export const GPS_ACCURACY_CIRCLE_MIN_M = 20;
/** Cap map circle size so desktop Wi-Fi GPS does not cover whole neighborhoods. */
export const GPS_ACCURACY_CIRCLE_MAX_DISPLAY_M = 120;

export function shouldShowGpsDot(accuracyMeters: number | null | undefined): boolean {
  return true;
}

export function displayAccuracyRadiusMeters(
  accuracyMeters: number | null | undefined,
): number | null {
  if (accuracyMeters == null || accuracyMeters <= GPS_ACCURACY_CIRCLE_MIN_M) return null;
  return Math.min(accuracyMeters, GPS_ACCURACY_CIRCLE_MAX_DISPLAY_M);
}

export function isFreshGpsStatus(status: GpsStatus): boolean {
  return status === "active" || status === "approximate";
}

export function gpsStatusFromGeolocationError(code: number): GpsStatus {
  if (code === 1) return "denied";
  if (code === 3) return "timeout";
  return "error";
}

export function gpsStatusLabel(status: GpsStatus): string | null {
  switch (status) {
    case "requesting":
      return "Finding location…";
    case "active":
      return "GPS active";
    case "approximate":
      return "Approx location";
    case "timeout":
      return "Location unavailable";
    case "denied":
      return "Location off";
    case "error":
      return "GPS unavailable";
    case "stale":
      return "Updating location…";
    case "outdated":
      return "Location outdated";
    default:
      return null;
  }
}

export function gpsStatusNeedsHelper(status: GpsStatus): boolean {
  return status === "timeout" || status === "denied" || status === "error";
}

export function logRovvyGps(event: string, data?: Record<string, unknown>): void {
  if (process.env.NODE_ENV !== "development") return;
  console.log("[Rovvy GPS]", event, data ?? "");
}

export function logRovvyMapClickResolver(message: string): void {
  if (process.env.NODE_ENV !== "development") return;
  console.log("[Rovvy Map Click Resolver]", message);
}

/** Dev-only Live diagnostics — never enabled in production builds. */
export function isRovvyLiveDebugEnabled(): boolean {
  return process.env.NODE_ENV === "development";
}

function writeLiveDebug(
  level: "log" | "warn" | "error",
  message: string,
  data?: unknown,
): void {
  if (!isRovvyLiveDebugEnabled()) return;
  if (data !== undefined) {
    console[level](message, data);
  } else {
    console[level](message);
  }
}

export function logRovvyLiveDebug(message: string, data?: unknown): void {
  writeLiveDebug("log", message, data);
}

export function logRovvyLiveWarn(message: string, data?: unknown): void {
  writeLiveDebug("warn", message, data);
}

export function logRovvyLiveError(message: string, data?: unknown): void {
  writeLiveDebug("error", message, data);
}
