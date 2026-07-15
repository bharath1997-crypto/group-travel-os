import { haversineM } from "@/lib/geo";

function bearingDegrees(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaLambda = ((lng2 - lng1) * Math.PI) / 180;
  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Bearing toward a point lookAheadM along the route polyline. */
export function bearingAlongRoute(
  geometry: [number, number][],
  lng: number,
  lat: number,
  lookAheadM = 80,
): number | null {
  if (geometry.length < 2) return null;

  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < geometry.length; i++) {
    const [gLng, gLat] = geometry[i];
    const d = haversineM(lat, lng, gLat, gLng);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }

  let accumulated = 0;
  for (let i = bestIdx; i < geometry.length - 1; i++) {
    const start = i === bestIdx ? ([lng, lat] as [number, number]) : geometry[i];
    const [aLng, aLat] = start;
    const [bLng, bLat] = geometry[i + 1];
    const segLen = haversineM(aLat, aLng, bLat, bLng);
    if (segLen <= 0) continue;
    if (accumulated + segLen >= lookAheadM) {
      const ratio = (lookAheadM - accumulated) / segLen;
      const tLng = aLng + (bLng - aLng) * ratio;
      const tLat = aLat + (bLat - aLat) * ratio;
      return bearingDegrees(aLat, aLng, tLat, tLng);
    }
    accumulated += segLen;
  }

  const prev = geometry[geometry.length - 2];
  const last = geometry[geometry.length - 1];
  return bearingDegrees(prev[1], prev[0], last[1], last[0]);
}

export function blendBearing(
  primary: number | null | undefined,
  secondary: number | null | undefined,
  secondaryWeight = 0.35,
): number | null {
  if (primary == null && secondary == null) return null;
  if (primary == null) return secondary ?? null;
  if (secondary == null) return primary;

  const weight = Math.min(1, Math.max(0, secondaryWeight));
  const a = (primary * Math.PI) / 180;
  const b = (secondary * Math.PI) / 180;
  const x = (1 - weight) * Math.cos(a) + weight * Math.cos(b);
  const y = (1 - weight) * Math.sin(a) + weight * Math.sin(b);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}
