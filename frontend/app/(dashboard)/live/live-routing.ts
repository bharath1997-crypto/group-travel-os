import type { RouteLine, RouteManeuver } from "./live-types";

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

export async function fetchLiveRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  active: boolean = false
): Promise<RouteLine | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson&steps=true`;
    // Add AbortSignal for safety
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!res.ok) return null;
    const data = await res.json();
    
    if (data.code !== "Ok" || !data.routes || data.routes.length === 0) return null;

    const route = data.routes[0];
    const geometry = route.geometry.coordinates; // Array of [lng, lat]
    
    // Validate we actually have a real line
    if (!geometry || geometry.length < 2) return null;

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
      from: origin,
      to: destination,
      geometry,
      distanceMeters,
      durationSeconds,
      maneuvers,
      active
    };
  } catch (err) {
    console.warn("[Rovvy Route] OSRM fetch failed", err);
    return null;
  }
}
