import { apiFetch, ApiFetchError } from "@/lib/api";
import { logRovvyLiveDebug } from "./live-gps";
import type { RouteLine, RouteManeuver } from "./live-types";

export function isValidRouteCoordinate(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

export function isValidRouteLine(route: RouteLine | null | undefined): route is RouteLine {
  return !!route && Array.isArray(route.geometry) && route.geometry.length >= 2;
}

export interface FetchRouteResult {
  route: RouteLine | null;
  error?: string;
}

interface BackendRouteResponse {
  status: "ready" | "failed";
  distanceMeters: number | null;
  durationSeconds: number | null;
  geometry: {
    type: "LineString";
    coordinates: [number, number][];
  } | null;
  maneuvers: {
    instruction: string;
    location: [number, number];
  }[] | null;
  provider: string;
  message: string | null;
  lastMileMode?: "walk" | null;
  lastMileDistanceMeters?: number | null;
  lastMileDurationSeconds?: number | null;
  lastMileNotice?: string | null;
}

export async function fetchLiveRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  travelMode: string = "Drive",
  active: boolean = false,
  originSource: string = "gps"
): Promise<FetchRouteResult> {
  if (
    !isValidRouteCoordinate(origin.lat, origin.lng) ||
    !isValidRouteCoordinate(destination.lat, destination.lng)
  ) {
    return { route: null, error: "Invalid coordinates." };
  }

  logRovvyLiveDebug("[Rovvy Route Debug] Fetching route from backend:", {
    origin,
    destination,
    travelMode,
    originSource,
    active,
  });

  try {
    const response = await apiFetch<BackendRouteResponse>(
      "/live/route-preview",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          origin: {
            latitude: origin.lat,
            longitude: origin.lng,
            source: originSource,
          },
          destination: {
            latitude: destination.lat,
            longitude: destination.lng,
            name: null,
          },
          travelMode,
        }),
      },
      120_000,
    );

    logRovvyLiveDebug("[Rovvy Route Debug] Backend routing response:", response);

    if (response.status === "failed" || !response.geometry || !response.geometry.coordinates) {
      return {
        route: null,
        error: response.message || "No route found for selected travel mode."
      };
    }

    const coordinates = response.geometry.coordinates;
    if (coordinates.length < 2) {
      return {
        route: null,
        error: "Route contains insufficient coordinates."
      };
    }

    const maneuvers: RouteManeuver[] = (response.maneuvers || []).map((m) => ({
      instruction: m.instruction,
      location: m.location
    }));

    return {
      route: {
        from: origin,
        to: destination,
        geometry: coordinates,
        distanceMeters: response.distanceMeters || 0,
        durationSeconds: response.durationSeconds || 0,
        maneuvers,
        active,
        lastMileMode: response.lastMileMode ?? null,
        lastMileDistanceMeters: response.lastMileDistanceMeters ?? null,
        lastMileDurationSeconds: response.lastMileDurationSeconds ?? null,
        lastMileNotice: response.lastMileNotice ?? null,
      }
    };
  } catch (err) {
    if (err instanceof ApiFetchError) {
      const msg = err.message.toLowerCase();
      if (msg.includes("not authenticated")) {
        console.warn("[Rovvy Route] Route preview requires sign-in on this server build");
        return {
          route: null,
          error: "Sign in to preview directions on this device.",
        };
      }
      if (
        msg.includes("network error") ||
        msg.includes("could not reach") ||
        msg.includes("timed out")
      ) {
        return {
          route: null,
          error:
            "Cannot reach the directions server. Start the backend with `python run.py` (port 8000), then refresh.",
        };
      }
    }
    console.error("[Rovvy Route] Failed to fetch route from backend", err);
    return {
      route: null,
      error: "Directions service unavailable.",
    };
  }
}
