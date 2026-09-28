"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { dateRangeForWhen, mergeWithCalendarFetchRange } from "./explore-hub-dates";
import { fetchExploreHub, type ExploreHubPayload } from "./explore-hub-data";
import { shouldApplyExploreHubResponse } from "./explore-hub-fetch-state";
import {
  fetchInputFromScope,
  type ExploreHubFetchInput,
  type ExploreLocationScope,
} from "./explore-location-scope";

const LS_CITY = "rovvy_explore_city";

function readSavedCity(): string {
  if (typeof window === "undefined") return "Chicago";
  return localStorage.getItem(LS_CITY)?.trim() || "Chicago";
}

export function buildExploreHubFetchInput(
  city: string,
  locationScope: ExploreLocationScope | null,
  when: string,
): ExploreHubFetchInput {
  const dates = mergeWithCalendarFetchRange(dateRangeForWhen(when));
  const base = locationScope ? fetchInputFromScope(locationScope) : { city: city.split(",")[0].trim() || "Chicago" };
  return { ...base, dateFrom: dates.dateFrom, dateTo: dates.dateTo };
}

export function useExploreHub(when: string = "Tonight") {
  const [city, setCityState] = useState(readSavedCity);
  const [locationScope, setLocationScope] = useState<ExploreLocationScope | null>(null);
  const [loading, setLoading] = useState(true);
  const [unexpectedError, setUnexpectedError] = useState<string | null>(null);
  const [data, setData] = useState<ExploreHubPayload | null>(null);
  const requestSeq = useRef(0);

  const setCity = useCallback((next: string) => {
    const label = next.split(",")[0].trim() || next;
    setCityState(label);
    setLocationScope(null);
    if (typeof window !== "undefined") {
      localStorage.setItem(LS_CITY, label);
    }
  }, []);

  const applyLocationScope = useCallback((scope: ExploreLocationScope) => {
    setLocationScope(scope);
    const hubCity = (scope.fetchCity || scope.city || scope.state || scope.country || "Chicago").split(",")[0].trim();
    setCityState(hubCity);
    if (typeof window !== "undefined" && scope.city) {
      localStorage.setItem(LS_CITY, scope.city.split(",")[0].trim());
    }
  }, []);

  const clearLocationScope = useCallback(() => {
    setLocationScope(null);
  }, []);

  const reload = useCallback(async (input: ExploreHubFetchInput) => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setUnexpectedError(null);
    setData(null);
    try {
      const payload = await fetchExploreHub(input);
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

  const retry = useCallback(() => {
    void reload(buildExploreHubFetchInput(city, locationScope, when));
  }, [city, locationScope, when, reload]);

  useEffect(() => {
    void reload(buildExploreHubFetchInput(city, locationScope, when));
  }, [city, locationScope, when, reload]);

  return {
    city,
    setCity,
    locationScope,
    applyLocationScope,
    clearLocationScope,
    loading,
    unexpectedError,
    data,
    reload,
    retry,
  };
}
