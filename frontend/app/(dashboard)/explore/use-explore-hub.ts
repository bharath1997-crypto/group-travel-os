"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchExploreHub, type ExploreHubPayload } from "./explore-hub-data";

const LS_CITY = "rovvy_explore_city";

function readSavedCity(): string {
  if (typeof window === "undefined") return "Chicago";
  return localStorage.getItem(LS_CITY)?.trim() || "Chicago";
}

export function useExploreHub() {
  const [city, setCityState] = useState(readSavedCity);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ExploreHubPayload | null>(null);

  const setCity = useCallback((next: string) => {
    const label = next.split(",")[0].trim() || next;
    setCityState(label);
    if (typeof window !== "undefined") {
      localStorage.setItem(LS_CITY, label);
    }
  }, []);

  const reload = useCallback(async (targetCity: string) => {
    const activeCity = targetCity.split(",")[0].trim() || "Chicago";
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchExploreHub(activeCity);
      setData(payload);
      if (payload.totalLive === 0) {
        setError(`No live listings in the database for ${payload.displayCity} yet.`);
      }
    } catch (err) {
      console.error("Explore hub load failed:", err);
      setData(null);
      setError(`Could not load ${activeCity} from the database. Try again in a moment.`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload(city);
  }, [city, reload]);

  return { city, setCity, loading, error, data, reload };
}
