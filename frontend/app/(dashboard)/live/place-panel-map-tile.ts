/** Web Mercator tile index for static map crop at a given zoom. */
export function lonLatToTile(lon: number, lat: number, zoom: number): { x: number; y: number; z: number } {
  const z = Math.max(0, Math.min(22, Math.floor(zoom)));
  const scale = 2 ** z;
  const x = Math.floor(((lon + 180) / 360) * scale);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * scale);
  return { x, y, z };
}

/** Fractional position of a lon/lat within its tile (0–1), for background-position centering. */
export function lonLatTileFraction(lon: number, lat: number, zoom: number): { fx: number; fy: number } {
  const z = Math.max(0, Math.min(22, zoom));
  const scale = 2 ** z;
  const xExact = ((lon + 180) / 360) * scale;
  const latRad = (lat * Math.PI) / 180;
  const yExact = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * scale;
  return {
    fx: xExact - Math.floor(xExact),
    fy: yExact - Math.floor(yExact),
  };
}

const MAP_CROP_ZOOM = 17;

/** Rovvy tile Worker — never tile.openstreetmap.org (ToS + referrer blocks). */
export const ROVVY_TILE_WORKER_DEFAULT = "https://tiles.rovvy.app/t/{z}/{x}/{y}";

function trimEnv(value: string | undefined): string {
  return value?.trim() ?? "";
}

/** Raster template with `{z}/{x}/{y}` placeholders for map-crop media. */
export function resolveMapCropTileTemplate(): string {
  const rovvy = trimEnv(process.env.NEXT_PUBLIC_ROVVY_TILE_URL);
  if (rovvy.includes("{z}") && rovvy.includes("{x}") && rovvy.includes("{y}")) {
    return rovvy;
  }
  const mapOverride = trimEnv(process.env.NEXT_PUBLIC_MAP_TILE_URL);
  if (
    mapOverride.includes("{z}") &&
    mapOverride.includes("{x}") &&
    mapOverride.includes("{y}") &&
    !mapOverride.includes("openstreetmap.org")
  ) {
    return mapOverride;
  }
  return ROVVY_TILE_WORKER_DEFAULT;
}

function expandTileTemplate(template: string, z: number, x: number, y: number): string {
  return template.replace(/\{z\}/g, String(z)).replace(/\{x\}/g, String(x)).replace(/\{y\}/g, String(y));
}

/**
 * Static tile centered on the pin — served from Rovvy's tile Worker.
 * Real map data; never a stock illustration.
 */
export function buildMapCropTileUrl(lat: number, lon: number, zoom = MAP_CROP_ZOOM): string {
  const { x, y, z } = lonLatToTile(lon, lat, zoom);
  return expandTileTemplate(resolveMapCropTileTemplate(), z, x, y);
}

export function buildMapCropBackgroundPosition(lat: number, lon: number, zoom = MAP_CROP_ZOOM): string {
  const { fx, fy } = lonLatTileFraction(lon, lat, zoom);
  const px = Math.round(fx * 100);
  const py = Math.round(fy * 100);
  return `${px}% ${py}%`;
}

export const MAP_CROP_ZOOM_LEVEL = MAP_CROP_ZOOM;
