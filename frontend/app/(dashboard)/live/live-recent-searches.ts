/**
 * live-recent-searches.ts
 * Rovvy — Live Tab Recent Searches
 *
 * localStorage-backed, per-user recent search cache.
 * Key: rovvy.live.recentSearches.v1              (anonymous)
 * Key: rovvy.live.recentSearches.v1:{userId}     (authenticated)
 *
 * Safety: all localStorage access is wrapped in typeof window !== "undefined" guards.
 * No SSR access, no Chrome history, no browser cache, no cookies, no paid APIs.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type RecentSearchType =
  | "place"
  | "category_search"
  | "destination"
  | "dropped_pin";

export interface RecentSearchItem {
  id: string;
  label: string;
  subtitle?: string;
  type: RecentSearchType;
  /** The original query text (for category_search or text searches) */
  query?: string;
  /** Stable place identity key */
  placeKey?: string;
  lat?: number;
  lng?: number;
  address?: string;
  category?: string;
  /** Formatted distance label e.g. "0.3 mi away" */
  distanceLabel?: string;
  source?: string;
  lastUsedAt: string; // ISO 8601
  useCount: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const BASE_KEY = "rovvy.live.recentSearches.v1";
const MAX_ITEMS = 20; // max stored; only 5 shown in UI
const DISPLAY_LIMIT = 5;

// ─── Key resolution ──────────────────────────────────────────────────────────

/** Resolve the per-user (or anonymous) localStorage key. */
function resolveStorageKey(userId?: string | null): string {
  if (userId) return `${BASE_KEY}:${userId}`;
  return BASE_KEY;
}

// ─── Storage helpers ─────────────────────────────────────────────────────────

function readAll(userId?: string | null): RecentSearchItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(resolveStorageKey(userId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as RecentSearchItem[];
  } catch {
    return [];
  }
}

function writeAll(items: RecentSearchItem[], userId?: string | null): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(resolveStorageKey(userId), JSON.stringify(items));
  } catch {
    // localStorage quota exceeded or private mode — silently ignore
  }
}

// ─── Dedup key ───────────────────────────────────────────────────────────────

/**
 * Build a deduplication fingerprint for a search item.
 * Priority: placeKey > rounded lat/lng + label > normalized query text.
 */
function dedupKey(item: Omit<RecentSearchItem, "id" | "lastUsedAt" | "useCount">): string {
  if (item.placeKey) return `pk:${item.placeKey}`;
  if (item.lat != null && item.lng != null) {
    const roundedLat = Math.round(item.lat * 1000) / 1000;
    const roundedLng = Math.round(item.lng * 1000) / 1000;
    const normLabel = item.label.trim().toLowerCase();
    return `latlon:${roundedLat},${roundedLng}:${normLabel}`;
  }
  if (item.query) {
    return `q:${item.query.trim().toLowerCase()}`;
  }
  return `label:${item.label.trim().toLowerCase()}`;
}

// ─── ID generation ────────────────────────────────────────────────────────────

function generateId(): string {
  return `rs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Add or update a recent search entry.
 * - If the same item already exists (by dedupKey), update lastUsedAt, increment useCount, move to top.
 * - Otherwise prepend the new item.
 * - Prune to MAX_ITEMS.
 */
export function recordRecentSearch(
  item: Omit<RecentSearchItem, "id" | "lastUsedAt" | "useCount">,
  userId?: string | null,
): void {
  if (typeof window === "undefined") return;

  const items = readAll(userId);
  const fingerprint = dedupKey(item);

  const existingIndex = items.findIndex((existing) => dedupKey(existing) === fingerprint);

  if (existingIndex !== -1) {
    // Update existing — move to top, increment count
    const existing = items[existingIndex];
    items.splice(existingIndex, 1);
    const updated: RecentSearchItem = {
      ...existing,
      // Merge any new fields (e.g. distanceLabel can change)
      ...item,
      id: existing.id,
      lastUsedAt: new Date().toISOString(),
      useCount: existing.useCount + 1,
    };
    items.unshift(updated);
  } else {
    // New entry
    const newItem: RecentSearchItem = {
      ...item,
      id: generateId(),
      lastUsedAt: new Date().toISOString(),
      useCount: 1,
    };
    items.unshift(newItem);
  }

  // Prune
  const pruned = items.slice(0, MAX_ITEMS);
  writeAll(pruned, userId);
}

/**
 * Get the latest N recent searches for display.
 * Sorted by lastUsedAt descending (already stored in insertion order = newest first).
 */
export function getRecentSearches(
  limit = DISPLAY_LIMIT,
  userId?: string | null,
): RecentSearchItem[] {
  const items = readAll(userId);
  // Sort by lastUsedAt descending (defensive — already insertion-ordered)
  items.sort(
    (a, b) => new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime(),
  );
  return items.slice(0, limit);
}

/**
 * Clear all recent searches for the current user/session.
 */
export function clearRecentSearches(userId?: string | null): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(resolveStorageKey(userId));
  } catch {
    // ignore
  }
}

// ─── Convenience builders ─────────────────────────────────────────────────────

/**
 * Build a RecentSearchItem from a PlacePreviewData-like object.
 * Use this when the user opens a place, clicks a nearby result, or uses Make Destination.
 */
export function buildPlaceRecentSearch(place: {
  name: string;
  categoryLabel?: string;
  address?: string;
  lat: number;
  lng: number;
  placeKey?: string;
  distanceM?: number | null;
  source?: string;
}): Omit<RecentSearchItem, "id" | "lastUsedAt" | "useCount"> {
  const distanceLabel = formatDistanceLabelForRecent(place.distanceM ?? null);
  return {
    label: place.name,
    subtitle: place.categoryLabel
      ? distanceLabel
        ? `${place.categoryLabel} · ${distanceLabel}`
        : place.categoryLabel
      : distanceLabel ?? undefined,
    type: place.source === "dropped_pin" ? "dropped_pin" : "place",
    placeKey: place.placeKey,
    lat: place.lat,
    lng: place.lng,
    address: place.address,
    category: place.categoryLabel,
    distanceLabel: distanceLabel ?? undefined,
    source: place.source,
  };
}

/**
 * Build a RecentSearchItem for a category/nearby search (Gas, Coffee, etc.).
 */
export function buildCategoryRecentSearch(
  query: string,
  displayLabel?: string,
): Omit<RecentSearchItem, "id" | "lastUsedAt" | "useCount"> {
  return {
    label: displayLabel ?? toTitleCase(query) + " nearby",
    subtitle: "Nearby search",
    type: "category_search",
    query: query.trim().toLowerCase(),
    category: query.trim().toLowerCase(),
  };
}

/**
 * Build a RecentSearchItem for a dropped pin.
 */
export function buildDroppedPinRecentSearch(
  lat: number,
  lng: number,
  address?: string,
): Omit<RecentSearchItem, "id" | "lastUsedAt" | "useCount"> {
  return {
    label: "Dropped pin",
    subtitle: address ?? "Selected location",
    type: "dropped_pin",
    lat,
    lng,
    address,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDistanceLabelForRecent(distanceM: number | null): string | null {
  if (distanceM == null) return null;
  const miles = distanceM / 1609.34;
  if (miles < 0.1) return `${Math.round(distanceM)} m away`;
  return `${miles.toFixed(1)} mi away`;
}

function toTitleCase(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/** Default suggestions shown when no recent searches exist */
export const DEFAULT_RECENT_SUGGESTIONS: RecentSearchItem[] = [
  {
    id: "default_waterfalls",
    label: "Waterfalls nearby",
    subtitle: "Nearby search",
    type: "category_search",
    query: "waterfalls",
    category: "waterfalls",
    lastUsedAt: "",
    useCount: 0,
  },
  {
    id: "default_coffee",
    label: "Coffee nearby",
    subtitle: "Nearby search",
    type: "category_search",
    query: "coffee",
    category: "coffee",
    lastUsedAt: "",
    useCount: 0,
  },
  {
    id: "default_gas",
    label: "Gas nearby",
    subtitle: "Nearby search",
    type: "category_search",
    query: "gas",
    category: "gas",
    lastUsedAt: "",
    useCount: 0,
  },
  {
    id: "default_food",
    label: "Food nearby",
    subtitle: "Nearby search",
    type: "category_search",
    query: "food",
    category: "food",
    lastUsedAt: "",
    useCount: 0,
  },
  {
    id: "default_restroom",
    label: "Restrooms nearby",
    subtitle: "Nearby search",
    type: "category_search",
    query: "restroom",
    category: "restroom",
    lastUsedAt: "",
    useCount: 0,
  },
  {
    id: "default_parking",
    label: "Parking nearby",
    subtitle: "Nearby search",
    type: "category_search",
    query: "parking",
    category: "parking",
    lastUsedAt: "",
    useCount: 0,
  },
];
