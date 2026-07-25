import type { LiveMapLayer } from "@/lib/map-providers";
import { formatMapCoordinates } from "./live-map-pick-context";

export type LiveMapAttributionFocus = {
  lat: number;
  lng: number;
  /** Tap-selected point stays pinned until cleared. */
  pinned?: boolean;
};

export type LiveMapAttributionMode = "idle" | "panning" | "pinned";

/** Short map-data credits for the Live attribution strip (OSM license requires visible credit). */
export function getLiveMapDataCredits(layer: LiveMapLayer): string {
  switch (layer) {
    case "satellite":
    case "hybrid":
      return "© OpenStreetMap · © Esri";
    case "terrain":
      return "© Esri";
    case "dark":
      return "© CARTO · © OpenStreetMap";
    case "clean":
      return "© OpenStreetMap · © OpenFreeMap";
    case "street":
    default:
      return "© OpenStreetMap · © CARTO";
  }
}

/** Solar-time estimate from longitude (no timezone DB — good for map strip). */
export function estimateLocalTimeAtLng(lng: number, date: Date = new Date()): string {
  const offsetHours = lng / 15;
  const utcMs = date.getTime();
  const localMs = utcMs + offsetHours * 3600000;
  const local = new Date(localMs);
  const hours = local.getUTCHours();
  const minutes = local.getUTCMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  const h12 = hours % 12 || 12;
  return `${h12}:${minutes.toString().padStart(2, "0")} ${ampm} local`;
}

export function formatAttributionRefreshTime(date: Date = new Date()): string {
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function resolveAttributionMode(
  focus: LiveMapAttributionFocus | null,
  isPanning: boolean,
): LiveMapAttributionMode {
  if (focus?.pinned) return "pinned";
  if (isPanning) return "panning";
  return "idle";
}

/** Minimum zoom before showing ground scale in feet (street-level, Google Maps–style). */
export const LIVE_MAP_SCALE_MIN_ZOOM = 13;

/** Reference bar width (px) used to compute the scale label. */
export const LIVE_MAP_SCALE_BAR_PX = 80;

/** Meters per pixel at latitude for Web Mercator (MapLibre default). */
export function metersPerPixelAtLat(zoom: number, lat: number): number {
  const clampedLat = Math.max(-85, Math.min(85, lat));
  return (156543.03392 * Math.cos((clampedLat * Math.PI) / 180)) / 2 ** zoom;
}

/** Pick a readable scale distance in feet (20 ft … 50 mi). */
export function roundNiceScaleFeet(feet: number): number {
  const steps = [
    20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000,
    264000,
  ];
  for (const step of steps) {
    if (feet <= step * 1.15) return step;
  }
  return Math.round(feet / 1000) * 1000;
}

/** Ground distance label for the attribution chip — null when zoomed out too far. */
export function formatMapGroundScaleFeet(zoom: number, lat: number): string | null {
  if (zoom < LIVE_MAP_SCALE_MIN_ZOOM) return null;
  const feet = metersPerPixelAtLat(zoom, lat) * LIVE_MAP_SCALE_BAR_PX * 3.28084;
  if (!Number.isFinite(feet) || feet <= 0) return null;
  const rounded = roundNiceScaleFeet(feet);
  if (rounded >= 5280) {
    const miles = rounded / 5280;
    return miles >= 10 ? `${Math.round(miles)} mi` : `${miles.toFixed(1)} mi`;
  }
  return `${rounded.toLocaleString()} ft`;
}

export function buildLiveMapAttributionLine(input: {
  layer: LiveMapLayer;
  focus: LiveMapAttributionFocus | null;
  isPanning: boolean;
  refreshedAt: Date;
  zoom?: number;
}): string {
  const { layer, focus, zoom } = input;
  const credits = getLiveMapDataCredits(layer);
  const scale =
    focus && typeof zoom === "number"
      ? formatMapGroundScaleFeet(zoom, focus.lat)
      : null;

  if (focus) {
    const coords = formatMapCoordinates(focus.lat, focus.lng);
    if (scale) return `${coords} · ${scale} · ${credits}`;
    return `${coords} · ${credits}`;
  }

  if (scale) {
    return `${scale} · ${credits}`;
  }

  return credits;
}
