import type { RouteLine, RouteManeuver } from "./live-types";

export function isValidRouteCoordinate(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

export function isValidRouteLine(route: RouteLine | null | undefined): route is RouteLine {
  return !!route && Array.isArray(route.geometry) && route.geometry.length >= 2;
}

function parseOsrmInstruction(step: any): string {
  const m = step.maneuver;
  const name = step.name || "the route";
  if (!m) return "Follow highlighted route";
  
  if (m.type === "depart") return `Head ${m.modifier || 'straight'} on ${name}`;
  if (m.type === "arrive") return `Arrive at destination`;
  if (m.type === "turn") return `Turn ${m.modifier || ''} onto ${name}`.replace("  ", " ");
  if (m.type === "roundabout") return `Take the roundabout onto ${name}`;
  if (m.type === "merge") return `Merge onto ${name}`;
  if (m.type === "on ramp") return `Take the ramp onto ${name}`;
  if (m.type === "off ramp") return `Take the exit onto ${name}`;
  if (m.modifier) return `Keep ${m.modifier} toward ${name}`;
  
  return `Continue onto ${name}`;
}

export interface FetchRouteResult {
  route: RouteLine | null;
  error?: string;
  snapped?: boolean;
}

async function snapToNearestRoad(
  coord: { lat: number; lng: number },
  profile: string
): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `https://router.project-osrm.org/nearest/v1/${profile}/${coord.lng},${coord.lat}?number=1`;
    console.info(`[Rovvy Route Debug] Snap request URL: ${url}`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.code === "Ok" && data.waypoints && data.waypoints.length > 0) {
      const loc = data.waypoints[0].location; // [lng, lat]
      console.info(`[Rovvy Route Debug] Snapped coord success: [${coord.lng}, ${coord.lat}] -> [${loc[0]}, ${loc[1]}]`);
      return { lat: loc[1], lng: loc[0] };
    }
  } catch (err) {
    console.warn("[Rovvy Route] Snap to nearest road failed", err);
  }
  return null;
}

export async function fetchLiveRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  travelMode: string = "Drive",
  active: boolean = false
): Promise<FetchRouteResult> {
  if (
    !isValidRouteCoordinate(origin.lat, origin.lng) ||
    !isValidRouteCoordinate(destination.lat, destination.lng)
  ) {
    return { route: null, error: "Invalid coordinates." };
  }

  let profile = "driving";
  if (travelMode === "Bike") {
    profile = "cycling";
  } else if (travelMode === "Walk" || travelMode === "Trek") {
    profile = "foot";
  }

  console.info(`[Rovvy Route Debug] Starting route fetch:`, {
    origin,
    destination,
    travelMode,
    profile,
    active
  });

  try {
    const url = `https://router.project-osrm.org/route/v1/${profile}/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson&steps=true`;
    console.info(`[Rovvy Route Debug] Request URL: ${url}`);
    // Add AbortSignal for safety
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      console.warn(`[Rovvy Route Debug] OSRM request failed with status: ${res.status}`);
      if (res.status === 404 || res.status === 400) {
        return {
          route: null,
          error: "Routing is not available for this travel mode yet."
        };
      }
      return {
        route: null,
        error: "Directions service unavailable."
      };
    }

    let data = await res.json();
    console.info(`[Rovvy Route Debug] OSRM Response:`, data);

    let snapped = false;
    let nextOrigin = origin;
    let nextDest = destination;

    if (data.code !== "Ok" && profile === "driving") {
      console.info("[Rovvy Route] Route not found. Attempting to snap coordinates to nearest road...");
      const snappedOrigin = await snapToNearestRoad(origin, profile);
      const snappedDest = await snapToNearestRoad(destination, profile);

      if (snappedOrigin || snappedDest) {
        nextOrigin = snappedOrigin || origin;
        nextDest = snappedDest || destination;
        snapped = true;
        console.info("[Rovvy Route] Retrying with snapped coords:", { nextOrigin, nextDest });

        const retryUrl = `https://router.project-osrm.org/route/v1/${profile}/${nextOrigin.lng},${nextOrigin.lat};${nextDest.lng},${nextDest.lat}?overview=full&geometries=geojson&steps=true`;
        console.info(`[Rovvy Route Debug] Retry URL: ${retryUrl}`);
        const retryController = new AbortController();
        const retryTimeoutId = setTimeout(() => retryController.abort(), 10000);
        
        const retryRes = await fetch(retryUrl, { signal: retryController.signal });
        clearTimeout(retryTimeoutId);

        if (!retryRes.ok) {
          console.warn(`[Rovvy Route Debug] Snapped retry failed with status: ${retryRes.status}`);
          if (retryRes.status === 404 || retryRes.status === 400) {
            return {
              route: null,
              error: "Routing is not available for this travel mode yet."
            };
          }
          return {
            route: null,
            error: "Directions service unavailable."
          };
        }

        data = await retryRes.json();
        console.info(`[Rovvy Route Debug] Snapped OSRM Response:`, data);
      }
    }
    
    if (data.code !== "Ok" || !data.routes || data.routes.length === 0) {
      return { route: null };
    }

    const route = data.routes[0];
    const geometry = route.geometry.coordinates; // Array of [lng, lat]
    
    // Validate we actually have a real line
    if (!geometry || geometry.length < 2) {
      return { route: null };
    }

    console.info(`[Rovvy Route Debug] Parsed geometry coordinate count: ${geometry.length}`);

    const distanceMeters = route.distance || 0;
    const durationSeconds = route.duration || 0;
    
    const maneuvers: RouteManeuver[] = [];
    if (route.legs && route.legs.length > 0 && route.legs[0].steps) {
      for (const step of route.legs[0].steps) {
        if (step.maneuver && step.maneuver.location) {
          maneuvers.push({
            instruction: parseOsrmInstruction(step),
            location: step.maneuver.location as [number, number],
          });
        }
      }
    }

    return {
      route: {
        from: nextOrigin,
        to: nextDest,
        geometry,
        distanceMeters,
        durationSeconds,
        maneuvers,
        active
      },
      snapped
    };
  } catch (err) {
    console.warn("[Rovvy Route] OSRM fetch failed", err);
    return { route: null, error: "Directions service unavailable." };
  }
}
