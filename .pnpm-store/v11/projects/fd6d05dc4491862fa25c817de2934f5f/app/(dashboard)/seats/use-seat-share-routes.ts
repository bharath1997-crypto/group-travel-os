"use client";

import { useEffect, useState } from "react";
import { fetchSeatShareDriveRoutes } from "./seats-route-api";
import { findRouteOption, type RouteOption } from "./seats-route";
import { areSeatShareEndpointsReady, type LocationPoint } from "./seats-location";

export function useSeatShareRoutes(from: LocationPoint, to: LocationPoint, enabled = true) {
  const [options, setOptions] = useState<RouteOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);

  const endpointsReady = areSeatShareEndpointsReady(from, to);
  const selectedRoute = findRouteOption(options, selectedRouteId);

  useEffect(() => {
    if (!enabled || !endpointsReady) {
      setOptions([]);
      setError(null);
      setLoading(false);
      setSelectedRouteId(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setOptions([]);
    setSelectedRouteId(null);

    void fetchSeatShareDriveRoutes(from, to)
      .then((res) => {
        if (cancelled) return;
        setOptions(res.options);
        setError(
          res.options.length === 0 ? res.error ?? "No drivable route found." : res.error ?? null,
        );
        if (res.options[0]) setSelectedRouteId(res.options[0].id);
      })
      .catch(() => {
        if (cancelled) return;
        setOptions([]);
        setError("Could not load route.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, endpointsReady, from.lat, from.lng, to.lat, to.lng]);

  return {
    options,
    loading,
    error,
    selectedRouteId,
    setSelectedRouteId,
    selectedRoute,
    endpointsReady,
  };
}
