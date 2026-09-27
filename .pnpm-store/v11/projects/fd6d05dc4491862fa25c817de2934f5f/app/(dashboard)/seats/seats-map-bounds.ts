import type maplibregl from "maplibre-gl";

export function fitMapToLngLats(
  map: maplibregl.Map,
  points: Array<{ lng: number; lat: number }>,
  padding = 56,
  maxZoom = 13,
): void {
  if (points.length === 0) return;
  if (points.length === 1) {
    map.setCenter([points[0].lng, points[0].lat]);
    map.setZoom(Math.max(map.getZoom(), 14));
    return;
  }
  let minLng = points[0].lng;
  let maxLng = points[0].lng;
  let minLat = points[0].lat;
  let maxLat = points[0].lat;
  for (const p of points) {
    minLng = Math.min(minLng, p.lng);
    maxLng = Math.max(maxLng, p.lng);
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
  }
  map.fitBounds(
    [
      [minLng, minLat],
      [maxLng, maxLat],
    ],
    { padding, duration: 0, maxZoom },
  );
}
