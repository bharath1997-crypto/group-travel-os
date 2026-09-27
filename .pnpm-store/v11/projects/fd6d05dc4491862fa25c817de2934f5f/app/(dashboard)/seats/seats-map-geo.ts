import { haversineM } from "@/lib/geo";
import { metersToMiles, SEATSHARE_MAX_DISTANCE_MILES } from "./seats-route";

const EARTH_RADIUS_M = 6371000;

/** Straight-line miles between two points (SeatShare radius gate). */
export function straightLineMiles(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  return metersToMiles(haversineM(a.lat, a.lng, b.lat, b.lng));
}

export function isWithinSeatShareRadius(
  center: { lat: number; lng: number },
  point: { lat: number; lng: number },
  maxMiles = SEATSHARE_MAX_DISTANCE_MILES,
): boolean {
  return straightLineMiles(center, point) <= maxMiles;
}

function destinationPoint(
  lat: number,
  lng: number,
  bearingDeg: number,
  distanceM: number,
): [number, number] {
  const brng = (bearingDeg * Math.PI) / 180;
  const lat1 = (lat * Math.PI) / 180;
  const lon1 = (lng * Math.PI) / 180;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(distanceM / EARTH_RADIUS_M) +
      Math.cos(lat1) * Math.sin(distanceM / EARTH_RADIUS_M) * Math.cos(brng),
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(distanceM / EARTH_RADIUS_M) * Math.cos(lat1),
      Math.cos(distanceM / EARTH_RADIUS_M) - Math.sin(lat1) * Math.sin(lat2),
    );
  return [(lon2 * 180) / Math.PI, (lat2 * 180) / Math.PI];
}

/** GeoJSON ring for a geodesic circle (map overlay). */
export function geodesicCircleRing(
  center: { lat: number; lng: number },
  radiusMiles: number,
  steps = 72,
): [number, number][] {
  const distanceM = radiusMiles * 1609.344;
  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    ring.push(destinationPoint(center.lat, center.lng, (360 * i) / steps, distanceM));
  }
  return ring;
}

export function geodesicCircleBounds(
  center: { lat: number; lng: number },
  radiusMiles: number,
): [[number, number], [number, number]] {
  const ring = geodesicCircleRing(center, radiusMiles, 4);
  let minLng = center.lng;
  let maxLng = center.lng;
  let minLat = center.lat;
  let maxLat = center.lat;
  for (const [lng, lat] of ring) {
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}
