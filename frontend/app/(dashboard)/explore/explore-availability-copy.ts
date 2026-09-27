import type { ExploreEvent } from "@/lib/explore-events";
import { formatDateTime } from "@/lib/explore-events";

const GENERIC_AVAILABILITY = new Set([
  "open",
  "open now",
  "open daily",
  "check provider",
  "check venue",
  "hours unknown",
]);

/** Card label when OSM supplied weekly hours (not open-now). */
export const HOURS_LISTED_LABEL = "Hours listed";

/** True when string is non-empty provider inventory/status (not a generic guess). */
export function isProviderAvailabilityText(raw: string | undefined | null): boolean {
  const t = (raw || "").trim();
  if (!t) return false;
  return !GENERIC_AVAILABILITY.has(t.toLowerCase());
}

/** Hub / table copy — never invent open-now or walk-in defaults. */
export function normalizeListingAvailability(
  raw: string | undefined | null,
  options?: { editorial?: boolean },
): string {
  if (options?.editorial) return "Check provider";
  const t = (raw || "").trim();
  if (!t) return "Check provider";
  const lower = t.toLowerCase();
  if (lower === "sold_out" || lower === "soldout") return "Sold out";
  if (GENERIC_AVAILABILITY.has(lower)) return "Check provider";
  return t;
}

export function placeCardAvailability(hasOpeningHours: boolean): string {
  if (hasOpeningHours) return HOURS_LISTED_LABEL;
  return normalizeListingAvailability(null);
}

export function drawerHoursSourceLabel(hoursSource: string | null | undefined): string {
  if (hoursSource === "openstreetmap") return "OpenStreetMap";
  return "Provider";
}

/** Badge on hub cards — only when provider supplied explicit status text. */
export function hubListingBadge(input: {
  editorial?: boolean;
  badge?: string | null;
  availability?: string | null;
}): string | undefined {
  if (input.editorial) return "Idea";
  const candidate = (input.badge || input.availability || "").trim();
  if (!candidate) return undefined;
  const normalized = normalizeListingAvailability(candidate, { editorial: false });
  if (normalized === "Check provider") return undefined;
  if (normalized === HOURS_LISTED_LABEL) return normalized;
  if (normalized === "Sold out") return normalized;
  if (!isProviderAvailabilityText(normalized)) return undefined;
  return normalized;
}

export function eventHasScheduledDate(item: Partial<ExploreEvent>): boolean {
  const day = (item.date || item.start_date || "").trim();
  return Boolean(day);
}

/** Category scroll cards — event datetime or honest unknown; previews labeled. */
export function categoryCardScheduleLine(
  item: Partial<ExploreEvent>,
  isPlaceholder: boolean,
): string {
  if (isPlaceholder) return "Preview · hours unknown";
  if (!eventHasScheduledDate(item)) return "Hours unknown";
  const normalized = {
    ...item,
    date: (item.date || item.start_date || "").split("T")[0],
    time: item.time || "",
  } as ExploreEvent;
  return formatDateTime(normalized);
}

/** Place rows without event dates — no implied open hours. */
export function placeHoursLabel(): string {
  return "Hours unknown";
}
