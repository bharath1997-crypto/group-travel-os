/** Network: per-day dated-event counts for the Explore "Select the date" calendar. */

import { apiFetch } from "@/lib/api";
import { EXPLORE_FETCH_TIMEOUT_MS } from "@/lib/explore-events";

type CalendarCountsResponse = {
  city: string;
  date_from: string;
  date_to: string;
  days: Array<{ date: string; count: number }>;
  total: number;
  /** False when the city has no Scaper index — caller falls back to counting its loaded pool. */
  supported?: boolean;
};

export type ExploreCalendarDayCounts = {
  supported: boolean;
  /** YYYY-MM-DD → dated events that day (SQL GROUP BY, not page-capped). */
  countsByIso: Record<string, number>;
  total: number;
};

export function calendarCountsCacheKey(city: string, dateFrom: string, dateTo: string): string {
  return `${city.toLowerCase()}|${dateFrom}|${dateTo}`;
}

export function mapCalendarCountsResponse(payload: CalendarCountsResponse): ExploreCalendarDayCounts {
  const countsByIso: Record<string, number> = {};
  for (const day of payload.days ?? []) {
    if (typeof day?.date === "string" && Number.isFinite(day.count) && day.count > 0) {
      countsByIso[day.date.slice(0, 10)] = day.count;
    }
  }
  return {
    supported: payload.supported !== false,
    countsByIso,
    total: Number.isFinite(payload.total) ? payload.total : Object.values(countsByIso).reduce((a, b) => a + b, 0),
  };
}

export async function fetchExploreCalendarDayCounts(input: {
  city: string;
  dateFrom: string;
  dateTo: string;
}): Promise<ExploreCalendarDayCounts> {
  const params = new URLSearchParams({
    city: input.city.split(",")[0].trim(),
    date_from: input.dateFrom,
    date_to: input.dateTo,
  });
  const payload = await apiFetch<CalendarCountsResponse>(
    `/explore/events/calendar?${params.toString()}`,
    {},
    EXPLORE_FETCH_TIMEOUT_MS,
  );
  return mapCalendarCountsResponse(payload);
}
