/** Explore drawer → Live tab handoff (no map/network deps). */

export type LiveExploreDeepLink = {
  gersId: string | null;
  lat: number;
  lng: number;
  name: string;
};

/** Overture spine ids are UUIDs; legacy rows may be plain hex. */
function normalizeGersId(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  if (/^[0-9a-f]{16,64}$/i.test(trimmed)) return trimmed.toLowerCase();
  return null;
}

function parseCoord(raw: string | null): number | null {
  if (raw == null || raw.trim() === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return n;
}

function validLat(lat: number): boolean {
  return lat >= -90 && lat <= 90;
}

function validLng(lng: number): boolean {
  return lng >= -180 && lng <= 180;
}

/** Build `/live` URL with place seed query params for Explore Directions handoff. */
export function buildLiveDirectionsHref(input: {
  gersId?: string | null;
  lat?: number | null;
  lng?: number | null;
  name?: string | null;
}): string | null {
  const lat = typeof input.lat === "number" ? input.lat : null;
  const lng = typeof input.lng === "number" ? input.lng : null;
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (!validLat(lat) || !validLng(lng)) return null;

  const params = new URLSearchParams();
  params.set("lat", String(lat));
  params.set("lng", String(lng));
  const name = input.name?.trim();
  if (name) params.set("name", name);
  const gers = normalizeGersId(input.gersId);
  if (gers) params.set("gers_id", gers);
  return `/live?${params.toString()}`;
}

type SearchParamsLike = Pick<URLSearchParams, "get">;

/** Parse Explore→Live deep link; null when params missing or invalid. */
export function parseLiveDeepLink(params: SearchParamsLike): LiveExploreDeepLink | null {
  const latRaw = params.get("lat");
  const lngRaw = params.get("lng");
  if (latRaw == null && lngRaw == null && !params.get("gers_id") && !params.get("name")) {
    return null;
  }
  const lat = parseCoord(latRaw);
  const lng = parseCoord(lngRaw);
  if (lat == null || lng == null || !validLat(lat) || !validLng(lng)) return null;

  const name = (params.get("name") ?? "").trim();
  const gersId = normalizeGersId(params.get("gers_id"));

  return { gersId, lat, lng, name };
}
