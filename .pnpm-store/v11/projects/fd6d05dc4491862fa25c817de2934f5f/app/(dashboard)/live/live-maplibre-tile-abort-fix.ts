/**
 * Workaround for a MapLibre GL 5.x tile abort race.
 *
 * RasterTileSource.loadTile does:
 *
 *   tile.abortController = new AbortController();
 *   await ImageRequest.getImage(await transformRequest(url), tile.abortController, ...)
 *
 * `tile.abortController` is read only after `transformRequest` resolves. A long
 * jump (globe zoom-out, flyTo another continent) aborts a whole batch of tiles
 * inside that gap, and MapLibre's own abortTile deletes the controller. The
 * pending loadTile then hands `undefined` to the image queue, which does
 * `topItemInQueue.abortController.signal.aborted` and throws
 * "Cannot read properties of undefined (reading 'signal')" once per tile.
 *
 * Fix: abort the controller but keep it on the tile, so the pending loadTile
 * sees an already-aborted signal and the queue skips it cleanly.
 */

import type maplibregl from "maplibre-gl";

type TileWithAbort = { abortController?: AbortController };

type SourceWithAbortTile = {
  abortTile?: (tile: TileWithAbort) => unknown;
};

const patchedPrototypes = new WeakSet<object>();

function patchSourcePrototype(source: unknown): void {
  if (!source || typeof source !== "object") return;

  const proto = Object.getPrototypeOf(source) as SourceWithAbortTile | null;
  if (!proto || patchedPrototypes.has(proto)) return;

  const original = proto.abortTile;
  if (typeof original !== "function") return;

  patchedPrototypes.add(proto);
  proto.abortTile = function patchedAbortTile(this: unknown, tile: TileWithAbort) {
    const controller = tile?.abortController;
    if (!controller) return original.call(this, tile);

    // Abort here, then hide the controller so MapLibre's own branch skips its
    // delete, and restore it afterwards for any loadTile still mid-await.
    controller.abort();
    delete tile.abortController;
    try {
      return original.call(this, tile);
    } finally {
      if (tile.abortController === undefined) {
        tile.abortController = controller;
      }
    }
  };
}

/** Patches the prototypes of the map's current tile sources (idempotent). */
export function patchMapLibreTileAbortRace(map: maplibregl.Map): void {
  const apply = () => {
    let sourceIds: string[];
    try {
      sourceIds = Object.keys(map.getStyle()?.sources ?? {});
    } catch {
      return; // style not ready yet — styledata will call us again
    }
    for (const id of sourceIds) {
      patchSourcePrototype(map.getSource(id));
    }
  };

  apply();
  map.on("styledata", apply);
}
