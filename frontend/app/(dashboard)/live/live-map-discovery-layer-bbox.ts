import type { Map as MaplibreMap } from "maplibre-gl";

/** Bbox helpers for Live discovery layer fetches. */

export type MapBbox = {
  south: number;
  west: number;
  north: number;
  east: number;
};

export function bboxFromMap(map: MaplibreMap, paddingRatio = 0.05): MapBbox {
  const bounds = map.getBounds();
  const south = bounds.getSouth();
  const west = bounds.getWest();
  const north = bounds.getNorth();
  const east = bounds.getEast();
  const latPad = (north - south) * paddingRatio;
  const lngPad = (east - west) * paddingRatio;
  return {
    south: south - latPad,
    west: west - lngPad,
    north: north + latPad,
    east: east + lngPad,
  };
}

export function bboxContains(outer: MapBbox, inner: MapBbox, padRatio = 0.2): boolean {
  const latPad = (outer.north - outer.south) * padRatio;
  const lngPad = (outer.east - outer.west) * padRatio;
  const padded = {
    south: outer.south - latPad,
    west: outer.west - lngPad,
    north: outer.north + latPad,
    east: outer.east + lngPad,
  };
  return (
    inner.south >= padded.south &&
    inner.west >= padded.west &&
    inner.north <= padded.north &&
    inner.east <= padded.east
  );
}
