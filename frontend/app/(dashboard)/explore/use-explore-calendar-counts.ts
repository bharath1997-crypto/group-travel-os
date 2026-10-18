"use client";

import { useEffect, useRef, useState } from "react";

import {
  calendarCountsCacheKey,
  fetchExploreCalendarDayCounts,
  type ExploreCalendarDayCounts,
} from "./explore-hub-calendar-counts";

export type ExploreCalendarCountsState = {
  /** null until the first response for the active month arrives (or when disabled). */
  counts: ExploreCalendarDayCounts | null;
  loading: boolean;
  /** Request failed — caller falls back to counting its loaded pool. */
  failed: boolean;
};

/**
 * Loads per-day event counts for the open calendar month from `/explore/events/calendar`.
 * Results are cached per city + window for the component lifetime so flipping months back
 * and forth does not refetch.
 */
export function useExploreCalendarCounts(input: {
  city: string | null;
  range: { dateFrom: string; dateTo: string } | null;
  enabled: boolean;
}): ExploreCalendarCountsState {
  const { city, range, enabled } = input;
  const dateFrom = range?.dateFrom ?? null;
  const dateTo = range?.dateTo ?? null;
  const cache = useRef(new Map<string, ExploreCalendarDayCounts>());
  const [state, setState] = useState<ExploreCalendarCountsState>({ counts: null, loading: false, failed: false });

  useEffect(() => {
    if (!enabled || !city || !dateFrom || !dateTo) {
      setState({ counts: null, loading: false, failed: false });
      return;
    }
    const key = calendarCountsCacheKey(city, dateFrom, dateTo);
    const cached = cache.current.get(key);
    if (cached) {
      setState({ counts: cached, loading: false, failed: false });
      return;
    }
    let cancelled = false;
    setState({ counts: null, loading: true, failed: false });
    fetchExploreCalendarDayCounts({ city, dateFrom, dateTo })
      .then((counts) => {
        cache.current.set(key, counts);
        if (!cancelled) setState({ counts, loading: false, failed: false });
      })
      .catch((err) => {
        console.error("Explore calendar counts failed:", err);
        if (!cancelled) setState({ counts: null, loading: false, failed: true });
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, city, dateFrom, dateTo]);

  return state;
}
