"use client";

import { useCallback, useState } from "react";

import { API_BASE } from "@/lib/api";
import { getToken } from "@/lib/auth";

export type PlaceResult = {
  id: string;
  name: string;
  category: string | null;
  subcategory: string | null;
  lat: number;
  lng: number;
  address: Record<string, string | null> | null;
  website: string | null;
  phone: string | null;
  opening_hours: string | null;
  photo_url: string | null;
  source: string;
  distance_m: number | null;
};

export type ExplorePlacesResponse = {
  places: PlaceResult[];
  cached: boolean;
  total: number;
};

function getExplorerV2Base(): string {
  const root = API_BASE.replace(/\/api\/v1\/?$/, "");
  return `${root}/api/v2/explorer`;
}

function redirectToLogin(): void {
  if (typeof window !== "undefined") {
    window.location.href = "/login";
  }
}

async function explorerV2Request<T>(
  path: string,
  params: Record<string, string | number>,
  categories?: string[] | null,
): Promise<T> {
  const token = getToken();
  if (!token) {
    redirectToLogin();
    throw new Error("Unauthorized");
  }

  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    search.set(key, String(value));
  }
  if (categories?.length) {
    for (const category of categories) {
      search.append("categories", category);
    }
  }

  const url = `${getExplorerV2Base()}${path}?${search.toString()}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (response.status === 401) {
    redirectToLogin();
    throw new Error("Unauthorized");
  }

  if (!response.ok) {
    let message = response.statusText || "Request failed";
    try {
      const body = await response.json();
      if (typeof body?.detail === "string") message = body.detail;
    } catch {
      /* use default */
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export function useExploreMap() {
  const [places, setPlaces] = useState<PlaceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cached, setCached] = useState(false);
  const [total, setTotal] = useState(0);

  const fetchNearby = useCallback(
    async (
      lat: number,
      lng: number,
      radius_m = 5000,
      categories?: string[] | null,
    ): Promise<PlaceResult[]> => {
      setLoading(true);
      setError(null);
      try {
        const data = await explorerV2Request<ExplorePlacesResponse>(
          "/nearby",
          { lat, lng, radius_m, limit: 200 },
          categories,
        );
        setPlaces(data.places);
        setCached(data.cached);
        setTotal(data.total);
        return data.places;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load nearby places";
        setError(message);
        setPlaces([]);
        setTotal(0);
        return [];
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const fetchViewport = useCallback(
    async (
      sw_lat: number,
      sw_lng: number,
      ne_lat: number,
      ne_lng: number,
      categories?: string[] | null,
    ): Promise<PlaceResult[]> => {
      setLoading(true);
      setError(null);
      try {
        const data = await explorerV2Request<ExplorePlacesResponse>(
          "/viewport",
          { sw_lat, sw_lng, ne_lat, ne_lng, limit: 500 },
          categories,
        );
        setPlaces(data.places);
        setCached(data.cached);
        setTotal(data.total);
        return data.places;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load map places";
        setError(message);
        setPlaces([]);
        setTotal(0);
        return [];
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return {
    places,
    loading,
    error,
    cached,
    total,
    fetchNearby,
    fetchViewport,
  };
}
