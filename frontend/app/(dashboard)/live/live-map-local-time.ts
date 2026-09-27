import { estimateLocalTimeAtLng } from "./live-map-attribution";

const OPEN_METEO_FORECAST = "https://api.open-meteo.com/v1/forecast";
const TIMEZONE_CACHE_TTL_MS = 30 * 60 * 1000;
const TIMEZONE_CACHE_MAX = 120;

type TimezoneCacheEntry = { at: number; timezone: string };

const timezoneCache = new Map<string, TimezoneCacheEntry>();

function cacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(2)},${lng.toFixed(2)}`;
}

function readTimezoneCache(lat: number, lng: number): string | null {
  const hit = timezoneCache.get(cacheKey(lat, lng));
  if (!hit) return null;
  if (Date.now() - hit.at > TIMEZONE_CACHE_TTL_MS) {
    timezoneCache.delete(cacheKey(lat, lng));
    return null;
  }
  return hit.timezone;
}

function writeTimezoneCache(lat: number, lng: number, timezone: string) {
  timezoneCache.set(cacheKey(lat, lng), { at: Date.now(), timezone });
  if (timezoneCache.size <= TIMEZONE_CACHE_MAX) return;
  const oldest = [...timezoneCache.entries()].sort((a, b) => a[1].at - b[1].at)[0]?.[0];
  if (oldest) timezoneCache.delete(oldest);
}

export function formatLocalTimeInZone(timezone: string, date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export function formatTimezoneLabel(timezone: string): string {
  return timezone.split("/").pop()?.replace(/_/g, " ") ?? timezone;
}

export async function fetchTimezoneAtLatLng(lat: number, lng: number): Promise<string | null> {
  const cached = readTimezoneCache(lat, lng);
  if (cached) return cached;

  const url = `${OPEN_METEO_FORECAST}?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lng)}&current_weather=true&timezone=auto`;
  const response = await fetch(url);
  if (!response.ok) return null;

  const data = (await response.json()) as { timezone?: string };
  const timezone = typeof data.timezone === "string" ? data.timezone.trim() : "";
  if (!timezone) return null;

  writeTimezoneCache(lat, lng, timezone);
  return timezone;
}

export type LocalTimeAtPoint = {
  timeLabel: string;
  timezone: string | null;
  timezoneLabel: string | null;
  approximate: boolean;
};

export async function resolveLocalTimeAtPoint(
  lat: number,
  lng: number,
  date: Date = new Date(),
): Promise<LocalTimeAtPoint> {
  try {
    const timezone = await fetchTimezoneAtLatLng(lat, lng);
    if (timezone) {
      const clock = formatLocalTimeInZone(timezone, date);
      return {
        timeLabel: `${clock} local`,
        timezone,
        timezoneLabel: formatTimezoneLabel(timezone),
        approximate: false,
      };
    }
  } catch {
    // Fall through to solar estimate.
  }

  return {
    timeLabel: estimateLocalTimeAtLng(lng, date),
    timezone: null,
    timezoneLabel: null,
    approximate: true,
  };
}

/** Test helper — reset module cache between vitest cases. */
export function clearLocalTimeCacheForTests(): void {
  timezoneCache.clear();
}
