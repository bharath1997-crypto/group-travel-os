/**
 * Parse locations pasted from Google Maps, Apple Maps, or plain coordinates.
 * Used when user copies a pin / address instead of typing a category.
 */

export type PastedLocation = {
  kind: "coordinates" | "address";
  lat?: number;
  lng?: number;
  address?: string;
  label: string;
};

function parseCoordinatePair(a: number, b: number): { lat: number; lng: number } | null {
  const pair1 = Math.abs(a) <= 90 && Math.abs(b) <= 180 ? { lat: a, lng: b } : null;
  const pair2 = Math.abs(b) <= 90 && Math.abs(a) <= 180 ? { lat: b, lng: a } : null;
  if (pair1 && !pair2) return pair1;
  if (pair2 && !pair1) return pair2;
  if (pair1 && pair2) return Math.abs(a) <= Math.abs(b) ? pair1 : pair2;
  return null;
}

/** Detect Google Maps URLs, lat/lng pairs, and full pasted addresses. */
export function parsePastedLocation(input: string): PastedLocation | null {
  const raw = input.trim();
  if (!raw) return null;

  const googleAt = raw.match(/@(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/i);
  if (googleAt) {
    const lat = parseFloat(googleAt[1]);
    const lng = parseFloat(googleAt[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return {
        kind: "coordinates",
        lat,
        lng,
        label: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      };
    }
  }

  const googleQ = raw.match(/[?&]q=(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/i);
  if (googleQ) {
    const lat = parseFloat(googleQ[1]);
    const lng = parseFloat(googleQ[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return {
        kind: "coordinates",
        lat,
        lng,
        label: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      };
    }
  }

  const plainPair = raw.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
  if (plainPair) {
    const a = parseFloat(plainPair[1]);
    const b = parseFloat(plainPair[2]);
    const coords = parseCoordinatePair(a, b);
    if (coords) {
      return {
        kind: "coordinates",
        lat: coords.lat,
        lng: coords.lng,
        label: `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`,
      };
    }
  }

  if (raw.includes("google.com/maps") || raw.includes("goo.gl/maps") || raw.includes("maps.app.goo.gl")) {
    const placeMatch = raw.match(/\/place\/([^/@?]+)/i);
    if (placeMatch) {
      const name = decodeURIComponent(placeMatch[1].replace(/\+/g, " "));
      return { kind: "address", address: name, label: name };
    }
  }

  if (raw.length >= 8 && (raw.includes(",") || /\d/.test(raw))) {
    return { kind: "address", address: raw, label: raw };
  }

  return null;
}

export function looksLikePastedLocation(input: string): boolean {
  return parsePastedLocation(input) !== null;
}
