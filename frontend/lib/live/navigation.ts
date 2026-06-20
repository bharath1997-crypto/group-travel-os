export type RouteStep = {
  instruction: string;
  distance: number;
  duration: number;
  maneuver_type: string;
  name?: string | null;
  lat: number;
  lng: number;
};

export type RouteData = {
  geometry: GeoJSON.LineString;
  steps: RouteStep[];
  total_distance_m: number;
  total_duration_s: number;
};

export type Destination = {
  lat: number;
  lng: number;
  name: string;
};

const MANEUVER_MAP: Record<string, string> = {
  "turn-left": "Turn left",
  "turn-right": "Turn right",
  "turn-slight-left": "Keep left",
  "turn-slight-right": "Keep right",
  "turn-sharp-left": "Sharp left",
  "turn-sharp-right": "Sharp right",
  straight: "Continue straight",
  roundabout: "Enter roundabout",
  arrive: "Arrive at destination",
  depart: "Head",
  merge: "Merge",
  "on ramp": "Take the ramp",
  "off ramp": "Take the exit",
  fork: "Keep",
  "end of road": "Turn",
  notification: "Continue",
  rotary: "Enter traffic circle",
};

export function formatInstruction(step: RouteStep): string {
  const type = step.maneuver_type || "straight";
  const base = MANEUVER_MAP[type] || "Continue";
  return step.instruction || `${base} on ${step.name || "the road"}`;
}

export function formatNavDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1609.34).toFixed(1)} mi`;
}

export function formatETA(durationSeconds: number): string {
  const arrival = new Date(Date.now() + durationSeconds * 1000);
  return arrival.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const radiusM = 6371000;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const dPhi = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLng / 2) ** 2;
  return radiusM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}

function pointToSegmentDistance(
  lat: number,
  lng: number,
  a: [number, number],
  b: [number, number],
): number {
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const dx = lng2 - lng1;
  const dy = lat2 - lat1;
  if (dx === 0 && dy === 0) {
    return haversineMeters(lat, lng, lat1, lng1);
  }
  const t = Math.max(
    0,
    Math.min(
      1,
      ((lng - lng1) * dx + (lat - lat1) * dy) / (dx * dx + dy * dy),
    ),
  );
  const projLat = lat1 + t * dy;
  const projLng = lng1 + t * dx;
  return haversineMeters(lat, lng, projLat, projLng);
}

export function distanceToRouteLine(
  userLat: number,
  userLng: number,
  geometry: GeoJSON.LineString,
): number {
  const coords = geometry.coordinates;
  if (coords.length < 2) return Infinity;
  let minDist = Infinity;
  for (let i = 0; i < coords.length - 1; i += 1) {
    const a = coords[i] as [number, number];
    const b = coords[i + 1] as [number, number];
    const d = pointToSegmentDistance(userLat, userLng, a, b);
    if (d < minDist) minDist = d;
  }
  return minDist;
}

export function distanceAlongRouteToPoint(
  userLat: number,
  userLng: number,
  targetLat: number,
  targetLng: number,
  geometry: GeoJSON.LineString,
): number {
  return haversineMeters(userLat, userLng, targetLat, targetLng);
}

export function findHazardOnRoute(
  reports: Array<{ lat: number; lng: number; report_type: string }>,
  geometry: GeoJSON.LineString,
  maxDistanceM = 200,
): { report: (typeof reports)[number]; distanceM: number } | null {
  let closest: { report: (typeof reports)[number]; distanceM: number } | null =
    null;
  for (const report of reports) {
    const distanceM = distanceToRouteLine(report.lat, report.lng, geometry);
    if (distanceM > maxDistanceM) continue;
    if (!closest || distanceM < closest.distanceM) {
      closest = { report, distanceM };
    }
  }
  return closest;
}

export function routeBounds(
  geometry: GeoJSON.LineString,
): [[number, number], [number, number]] | null {
  if (!geometry.coordinates.length) return null;
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const coord of geometry.coordinates) {
    const [lng, lat] = coord as [number, number];
    minLng = Math.min(minLng, lng);
    minLat = Math.min(minLat, lat);
    maxLng = Math.max(maxLng, lng);
    maxLat = Math.max(maxLat, lat);
  }
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}
