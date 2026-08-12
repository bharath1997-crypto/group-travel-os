/**
 * Recent flight airport selections — consent-aware preference storage.
 * Stores confirmed airport picks only (never raw GPS coordinates or typed queries).
 */

import {
  canUsePreferenceStorage,
  readPreferenceValue,
  removePreferenceValue,
  writePreferenceValue,
} from "@/lib/consent-storage";

export type RecentFlightAirport = {
  iata: string;
  label: string;
  city: string;
  region: string;
  country: string;
  selectedAt: string;
};

const BASE_KEY = "rovvy.flights.recentAirports.v1";
const MAX_ITEMS = 8;

function resolveKey(userId?: string | null): string {
  if (userId) return `${BASE_KEY}:${userId}`;
  return BASE_KEY;
}

function readAll(userId?: string | null): RecentFlightAirport[] {
  const raw = readPreferenceValue(resolveKey(userId));
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (row): row is RecentFlightAirport =>
        typeof row === "object" &&
        row !== null &&
        typeof (row as RecentFlightAirport).iata === "string" &&
        typeof (row as RecentFlightAirport).label === "string",
    );
  } catch {
    return [];
  }
}

function writeAll(items: RecentFlightAirport[], userId?: string | null): void {
  writePreferenceValue(resolveKey(userId), JSON.stringify(items.slice(0, MAX_ITEMS)));
}

export function recordRecentFlightAirport(
  airport: Omit<RecentFlightAirport, "selectedAt">,
  userId?: string | null,
): void {
  const code = airport.iata.trim().toUpperCase();
  if (code.length !== 3) return;

  const entry: RecentFlightAirport = {
    ...airport,
    iata: code,
    selectedAt: new Date().toISOString(),
  };

  const existing = readAll(userId).filter((row) => row.iata !== code);
  writeAll([entry, ...existing], userId);
}

export function getRecentFlightAirports(
  limit = MAX_ITEMS,
  userId?: string | null,
): RecentFlightAirport[] {
  return readAll(userId).slice(0, limit);
}

export function clearRecentFlightAirports(userId?: string | null): void {
  removePreferenceValue(resolveKey(userId));
}

export function recentAirportStorageMode(): "localStorage" | "sessionStorage" {
  return canUsePreferenceStorage() ? "localStorage" : "sessionStorage";
}

export function recentAirportFromSuggestion(item: {
  iata: string;
  label: string;
  city?: string;
  region?: string;
  country?: string;
}): Omit<RecentFlightAirport, "selectedAt"> {
  return {
    iata: item.iata,
    label: item.label,
    city: item.city || "",
    region: item.region || "",
    country: item.country || "",
  };
}
