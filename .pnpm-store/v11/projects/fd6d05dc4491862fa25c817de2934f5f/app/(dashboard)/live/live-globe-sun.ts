import type { LightSpecification } from "maplibre-gl";

/** Subsolar point — latitude/longitude where the sun is directly overhead (UTC). */
export type SubsolarPoint = {
  lat: number;
  lng: number;
};

const RAD = Math.PI / 180;

/** Solar declination (radians) — Spencer (1971) approximation. */
export function solarDeclinationRadians(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const day = (date.getTime() - start) / 86400000;
  const frac = (2 * Math.PI * day) / 365;

  return (
    0.006918 -
    0.399912 * Math.cos(frac) +
    0.070257 * Math.sin(frac) -
    0.006758 * Math.cos(2 * frac) +
    0.000907 * Math.sin(2 * frac) -
    0.002697 * Math.cos(3 * frac) +
    0.00148 * Math.sin(3 * frac)
  );
}

/** Geographic point receiving the sun at zenith for the given instant. */
export function getSubsolarPoint(date: Date = new Date()): SubsolarPoint {
  const declRad = solarDeclinationRadians(date);
  const utcHours =
    date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const lng = (12 - utcHours) * 15;

  return {
    lat: declRad / RAD,
    lng: normalizeLng(lng),
  };
}

export function normalizeLng(lng: number): number {
  let value = lng;
  while (value <= -180) value += 360;
  while (value > 180) value -= 360;
  return value;
}

/**
 * Convert subsolar coordinates to MapLibre `light.position` spherical coords.
 * Uses the same spherical convention as MapLibre's light property.
 */
export function subsolarToLightPosition(
  latDeg: number,
  lngDeg: number,
): [number, number, number] {
  const lat = latDeg * RAD;
  const lng = lngDeg * RAD;
  const polarRad = Math.acos(Math.max(-1, Math.min(1, Math.cos(lat) * Math.cos(lng))));
  const polar = polarRad / RAD;
  const sinPolar = Math.sin(polarRad);
  const azimuth =
    sinPolar < 1e-6 ? 0 : (Math.acos(Math.max(-1, Math.min(1, Math.sin(lat) / sinPolar))) * 180) / RAD;

  return [1.5, azimuth, polar];
}

export function buildGlobeSunLight(date: Date = new Date()): LightSpecification {
  const subsolar = getSubsolarPoint(date);
  const position = subsolarToLightPosition(subsolar.lat, subsolar.lng);

  return {
    anchor: "map",
    color: "#ffffff",
    intensity: 0.35,
    position,
    "position-transition": { duration: 0 },
  };
}

/** Screen position (percent) for an optional decorative sun behind the globe. */
export function subsolarToScreenHint(
  subsolar: SubsolarPoint,
  centerLng: number,
): { topPct: number; leftPct: number; visible: boolean } {
  const deltaLng = normalizeLng(subsolar.lng - centerLng);
  const absDelta = Math.abs(deltaLng);

  if (absDelta > 100) {
    return { topPct: 50, leftPct: 50, visible: false };
  }

  const leftPct = 50 + (deltaLng / 180) * 42;
  const topPct = 50 - (subsolar.lat / 90) * 38;

  return {
    topPct: Math.max(8, Math.min(92, topPct)),
    leftPct: Math.max(8, Math.min(92, leftPct)),
    visible: true,
  };
}
