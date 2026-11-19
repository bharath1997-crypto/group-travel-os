"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_EXPLORE_WITHIN, type ExploreWithin } from "./explore-distance-filter";
import { loadHeroMemory } from "./explore-hero-memory";
import { isUnnamedPlaceLabel, loadPickedPlace, savePickedPlace } from "./explore-picked-place";
import { calendarStripDateRange, dateRangeForWhen, weekAfterTonight } from "./explore-hub-dates";
import { fetchExploreHub, type ExploreHubPayload } from "./explore-hub-data";
import { shouldApplyExploreHubResponse } from "./explore-hub-fetch-state";
import { EXPLORE_HUB_FULL_RETRY_DELAY_MS, sleepExploreHubRetry } from "./explore-hub-source-fetch";
import { resolveExploreInventoryCity } from "./explore-scaper-metro";
import {
  fetchInputFromScope,
  type ExploreHubFetchInput,
  type ExploreLocationScope,
} from "./explore-location-scope";

const LS_CITY = "rovvy_explore_city";
/** Cold-start only when the browser has never stored a place and hero memory is empty. */
const COLD_START_CITY = "Chicago";

/** Persist the inventory city used for `/explore/events?city=`. */
export function persistExploreHubCity(metro: string): string {
  const label = metro.split(",")[0].trim() || COLD_START_CITY;
  if (typeof window !== "undefined") {
    localStorage.setItem(LS_CITY, label);
  }
  return label;
}

/**
 * Restore inventory city. Neighbourhoods near a hub (Hermosa) snap via hero coords;
 * Tokyo / Mumbai / Indianapolis stay themselves — never rewritten to Chicago.
 */
export function readSavedCity(): string {
  if (typeof window === "undefined") return COLD_START_CITY;
  const saved = localStorage.getItem(LS_CITY)?.trim() || "";
  const memory = loadHeroMemory();
  const heroCity = memory?.hero?.city?.split(",")[0]?.trim() || "";
  const coords = memory?.coords;

  const resolved = resolveExploreInventoryCity({
    // Prefer an explicit hub/city from hero when the saved label is a neighbourhood.
    requestedCity: saved || heroCity,
    lat: coords?.lat,
    lon: coords?.lon,
  });

  // Hermosa + nearby GPS → Chicago. A Wisconsin GPS fix must not keep a saved Chicago hub.
  if (resolved) return persistExploreHubCity(resolved);
  if (coords) return "";
  if (heroCity) return persistExploreHubCity(heroCity);
  if (saved) return persistExploreHubCity(saved);
  return "";
}

export type ExploreCalendarFetchRange = { dateFrom: string; dateTo: string };

/**
 * Hub inventory dates: exact calendar day when picked; otherwise the When chip range itself.
 * Does not widen single-day chips to the 14-day strip (calendar counts use a separate API).
 */
export function buildExploreHubFetchInput(
  city: string,
  locationScope: ExploreLocationScope | null,
  when: string,
  calendarRange?: ExploreCalendarFetchRange,
  within: ExploreWithin = DEFAULT_EXPLORE_WITHIN,
): ExploreHubFetchInput {
  const base = locationScope
    ? fetchInputFromScope(locationScope)
    : { city: city.split(",")[0].trim() || COLD_START_CITY };
  if (calendarRange?.dateFrom && calendarRange?.dateTo) {
    return { ...base, dateFrom: calendarRange.dateFrom, dateTo: calendarRange.dateTo, within };
  }
  const whenRange = dateRangeForWhen(when, new Date(), locationScope?.timeZone);
  if (whenRange.dateFrom && whenRange.dateTo) {
    const widened =
      locationScope?.lat != null &&
      locationScope?.lon != null &&
      when.trim().toLowerCase() === "tonight"
        ? weekAfterTonight(new Date(), locationScope.timeZone)
        : null;
    return {
      ...base,
      dateFrom: whenRange.dateFrom,
      dateTo: widened?.dateTo ?? whenRange.dateTo,
      within,
    };
  }
  const strip = calendarStripDateRange();
  return { ...base, dateFrom: strip.dateFrom, dateTo: strip.dateTo, within };
}

export function useExploreHub(
  when: string = "Tonight",
  calendarRange?: ExploreCalendarFetchRange,
  within: ExploreWithin = DEFAULT_EXPLORE_WITHIN,
) {
  const calendarFrom = calendarRange?.dateFrom;
  const calendarTo = calendarRange?.dateTo;
  const boot = useState(() => {
    const picked = loadPickedPlace();
    if (picked) return { city: picked.fetchCity || picked.city || "", scope: picked };
    return { city: readSavedCity(), scope: null as ExploreLocationScope | null };
  })[0];
  const [city, setCityState] = useState(boot.city);
  const [locationScope, setLocationScope] = useState<ExploreLocationScope | null>(boot.scope);
  const [loading, setLoading] = useState(true);
  const [unexpectedError, setUnexpectedError] = useState<string | null>(null);
  const [data, setData] = useState<ExploreHubPayload | null>(null);
  const requestSeq = useRef(0);

  const setCity = useCallback((next: string) => {
    const label = persistExploreHubCity(next.split(",")[0].trim() || next);
    setCityState(label);
    // Do not clear locationScope here. Hero/GPS call onCityChange after onLocationScope;
    // clearing would drop lat/lon and leave the hub stuck on a previous metro.
  }, []);

  const applyLocationScope = useCallback((scope: ExploreLocationScope) => {
    setLocationScope(scope);
    savePickedPlace(scope);
    const named = [scope.fetchCity, scope.city].find((value) => value && !isUnnamedPlaceLabel(value));
    const inventoryCity = resolveExploreInventoryCity({
      requestedCity: named,
      lat: scope.lat,
      lon: scope.lon,
    });
    const hubCity = inventoryCity || named || "";
    if (hubCity) {
      setCityState(persistExploreHubCity(hubCity));
    }
  }, []);

  const clearLocationScope = useCallback(() => {
    setLocationScope(null);
  }, []);

  const reload = useCallback(async (input: ExploreHubFetchInput) => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setUnexpectedError(null);
    try {
      // Places usually arrive well before events; show them while events finish.
      let payload = await fetchExploreHub(input, (early) => {
        if (!shouldApplyExploreHubResponse(seq, requestSeq.current)) return;
        setData(early);
        setLoading(false);
      });
      if (
        payload.hubLoadState === "failed" &&
        shouldApplyExploreHubResponse(seq, requestSeq.current)
      ) {
        await sleepExploreHubRetry(EXPLORE_HUB_FULL_RETRY_DELAY_MS);
        if (shouldApplyExploreHubResponse(seq, requestSeq.current)) {
          payload = await fetchExploreHub(input);
        }
      }
      if (!shouldApplyExploreHubResponse(seq, requestSeq.current)) return;
      setData(payload);
    } catch (err) {
      if (!shouldApplyExploreHubResponse(seq, requestSeq.current)) return;
      console.error("Explore hub load failed:", err);
      setData(null);
      setUnexpectedError("Explore listings couldn’t load. Try again.");
    } finally {
      if (shouldApplyExploreHubResponse(seq, requestSeq.current)) setLoading(false);
    }
  }, []);

  const calendarInput = useMemo(
    () => (calendarFrom && calendarTo ? { dateFrom: calendarFrom, dateTo: calendarTo } : undefined),
    [calendarFrom, calendarTo],
  );

  const fetchInput = useMemo(
    () => buildExploreHubFetchInput(city, locationScope, when, calendarInput, within),
    [city, locationScope, when, calendarInput, within],
  );
  const fetchKey = JSON.stringify(fetchInput);

  const retry = useCallback(() => {
    if (!city && !locationScope) return;
    void reload(fetchInput);
  }, [city, locationScope, fetchInput, reload]);

  useEffect(() => {
    // Wait for the GPS scope instead of querying a leftover hub with no point attached.
    if (!city && !locationScope) return;
    void reload(fetchInput);
    // fetchKey is the query. A new scope object with the same query must not fetch again.
  }, [fetchKey, reload]);

  const [eventsPage, setEventsPage] = useState(1);
  const [eventsExhausted, setEventsExhausted] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    setEventsPage(1);
    setEventsExhausted(false);
  }, [city, locationScope, when, calendarInput, within]);

  const loadMoreEvents = useCallback(async () => {
    if (loadingMore || eventsExhausted) return;
    if (!city && !locationScope) return;
    setLoadingMore(true);
    const next = eventsPage + 1;
    try {
      const input = buildExploreHubFetchInput(city, locationScope, when, calendarInput, within);
      const payload = await fetchExploreHub({ ...input, eventsPage: next });
      const incoming = payload.slots.filter((slot) => slot.exploreListingKind === "event");
      let added = 0;
      setData((current) => {
        if (!current) return payload;
        const seen = new Set(current.slots.map((slot) => slot.id));
        const fresh = incoming.filter((slot) => !seen.has(slot.id));
        added = fresh.length;
        return fresh.length ? { ...current, slots: [...current.slots, ...fresh] } : current;
      });
      setEventsPage(next);
      if (added === 0) setEventsExhausted(true);
    } catch (err) {
      console.error("Explore hub next page failed:", err);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, eventsExhausted, eventsPage, city, locationScope, when, calendarInput, within]);

  return {
    city,
    setCity,
    locationScope,
    applyLocationScope,
    clearLocationScope,
    loading,
    unexpectedError,
    data,
    eventsPending: Boolean(data?.eventsPending),
    retry,
    loadMoreEvents,
    loadingMore,
    eventsExhausted,
  };
}
