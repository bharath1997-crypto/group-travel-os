/** Wayra source link helpers — open POIs on Live map instead of external OSM/Maps tabs. */

export type WayraSourceLink = {
  label: string;
  url: string;
  source_type: string;
  snippet?: string | null;
  lat?: number | null;
  lng?: number | null;
};

export type WayraMapFocusTarget = {
  lat: number;
  lng: number;
  name?: string;
};

export function parseCoordsFromMapsUrl(url: string): WayraMapFocusTarget | null {
  try {
    const parsed = new URL(url, "https://rovvy.app");
    const query = parsed.searchParams.get("query");
    if (!query) return null;

    const atMatch = query.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    if (atMatch) {
      return { lat: Number(atMatch[1]), lng: Number(atMatch[2]) };
    }

    const coordMatch = query.match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/);
    if (coordMatch) {
      return { lat: Number(coordMatch[1]), lng: Number(coordMatch[2]) };
    }
  } catch {
    return null;
  }
  return null;
}

export function resolveWayraSourceMapFocus(
  source: WayraSourceLink,
): WayraMapFocusTarget | null {
  if (typeof source.lat === "number" && typeof source.lng === "number") {
    const name = source.label.split(" · ")[0]?.trim();
    return {
      lat: source.lat,
      lng: source.lng,
      name: name && name.length > 0 ? name : undefined,
    };
  }

  if (source.source_type === "osm" || source.source_type === "maps") {
    const parsed = parseCoordsFromMapsUrl(source.url);
    if (parsed) {
      const name = source.label.split(" · ")[0]?.trim();
      return {
        ...parsed,
        name: name && name.length > 0 ? name : parsed.name,
      };
    }
  }

  return null;
}

export function shouldOpenWayraSourceOnLiveMap(
  source: WayraSourceLink,
  onLive: boolean,
): boolean {
  if (!onLive) return false;
  if (source.url.startsWith("/")) return false;
  if (source.source_type === "wikipedia" || source.source_type === "explore") {
    return false;
  }
  return resolveWayraSourceMapFocus(source) != null;
}
