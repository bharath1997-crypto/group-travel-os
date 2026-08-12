/**
 * MapLibre GL 5.x raster/vector tile abort race.
 *
 * RasterTileSource.loadTile assigns `tile.abortController`, then awaits
 * transformRequest before reading it back as an argument. If the map jumps far
 * enough that abortTile runs inside that await window, abortTile deletes
 * tile.abortController, so `undefined` reaches ImageRequest.getImage and the
 * image queue throws "Cannot read properties of undefined (reading 'signal')".
 *
 * The affected tiles are already aborted and off-screen, so the rejection is
 * cosmetic — but it reaches the Next.js dev overlay. Match it very narrowly
 * (message AND maplibre frame) so real app errors are never swallowed.
 */

/** Covers both "of undefined (reading 'signal')" and the older "property 'signal' of undefined". */
const SIGNAL_MESSAGE =
  /(?:undefined \(reading '?signal'?\)|property '?signal'? of undefined)/i;

export function isMapLibreTileAbortNoise(reason: unknown): boolean {
  if (!(reason instanceof Error)) return false;
  if (!SIGNAL_MESSAGE.test(reason.message)) return false;
  return typeof reason.stack === "string" && reason.stack.includes("maplibre-gl");
}

export function installMapLibreAbortNoiseGuard(): void {
  if (typeof window === "undefined") return;
  const w = window as Window & { __rovvyMapLibreAbortGuard?: boolean };
  if (w.__rovvyMapLibreAbortGuard) return;
  w.__rovvyMapLibreAbortGuard = true;

  window.addEventListener(
    "unhandledrejection",
    (event: PromiseRejectionEvent) => {
      if (!isMapLibreTileAbortNoise(event.reason)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    },
    true,
  );

  window.addEventListener(
    "error",
    (event: ErrorEvent) => {
      if (!isMapLibreTileAbortNoise(event.error)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    },
    true,
  );
}
