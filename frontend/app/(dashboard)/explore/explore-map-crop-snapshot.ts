import {
  OPENFREEMAP_PUBLIC_ORIGIN,
  resolveOpenFreeMapCleanStyleUrlForLiveMap,
} from "@/lib/map-providers";

import type { ExploreStaticMapOptions } from "./explore-static-map";

export const EXPLORE_MAP_CROP_ATTRIBUTION = "© OpenFreeMap © OpenStreetMap contributors";

const MAX_CONCURRENT_MAPS = 2;

const snapshotCache = new Map<string, string>();

type QueueWaiter = {
  run: () => void;
  aborted: boolean;
};

let activeMapCount = 0;
const waitQueue: QueueWaiter[] = [];

export function exploreMapCropSnapshotCacheKey(
  lat: number,
  lng: number,
  zoom: number,
): string {
  return `${lat.toFixed(6)},${lng.toFixed(6)},${zoom}`;
}

export function getCachedExploreMapCropSnapshot(
  lat: number,
  lng: number,
  zoom: number,
): string | null {
  return snapshotCache.get(exploreMapCropSnapshotCacheKey(lat, lng, zoom)) ?? null;
}

/** Test-only: reset queue + in-memory snapshot cache. */
export function resetExploreMapCropSnapshotStateForTests(): void {
  snapshotCache.clear();
  activeMapCount = 0;
  waitQueue.length = 0;
}

/** Test-only: count of MapLibre instances currently rendering (max 2 in production). */
export function getExploreMapCropActiveRenderCountForTests(): number {
  return activeMapCount;
}

/** Test-only: number of jobs waiting for a render slot. */
export function getExploreMapCropWaitQueueLengthForTests(): number {
  return waitQueue.length;
}

function requestRenderSlot(isCancelled: () => boolean): {
  whenReady: Promise<boolean>;
  cancelWait: () => void;
} {
  if (isCancelled()) {
    return { whenReady: Promise.resolve(false), cancelWait: () => {} };
  }
  if (activeMapCount < MAX_CONCURRENT_MAPS) {
    activeMapCount += 1;
    return { whenReady: Promise.resolve(true), cancelWait: () => {} };
  }

  let resolveReady!: (acquired: boolean) => void;
  const whenReady = new Promise<boolean>((resolve) => {
    resolveReady = resolve;
  });

  const waiter: QueueWaiter = {
    aborted: false,
    run: () => {
      if (waiter.aborted || isCancelled()) {
        resolveReady(false);
        return;
      }
      activeMapCount += 1;
      resolveReady(true);
    },
  };

  const cancelWait = () => {
    if (waiter.aborted) return;
    waiter.aborted = true;
    const idx = waitQueue.indexOf(waiter);
    if (idx >= 0) {
      waitQueue.splice(idx, 1);
      resolveReady(false);
    }
  };

  waitQueue.push(waiter);
  return { whenReady, cancelWait };
}

function releaseRenderSlot(): void {
  activeMapCount = Math.max(0, activeMapCount - 1);
  while (waitQueue.length > 0) {
    const next = waitQueue.shift();
    if (!next || next.aborted) continue;
    next.run();
    return;
  }
}

/** Test-only: acquire/release render slots without MapLibre. */
export function testAcquireExploreMapCropRenderSlot(isCancelled: () => boolean = () => false) {
  return requestRenderSlot(isCancelled);
}

export function testReleaseExploreMapCropRenderSlot(): void {
  releaseRenderSlot();
}

/** MapLibre init for feed snapshots (canvas only — venue pin is a CSS overlay). */
export function buildExploreMapCropSnapshotMapOptions(
  container: HTMLElement,
  lng: number,
  lat: number,
  zoom: number,
) {
  return {
    container,
    style: resolveOpenFreeMapCleanStyleUrlForLiveMap(),
    center: [lng, lat] as [number, number],
    zoom,
    interactive: false,
    canvasContextAttributes: { preserveDrawingBuffer: true },
    attributionControl: false as const,
  };
}

async function captureMapToDataUrl(
  container: HTMLElement,
  { lat, lng, zoom = 17 }: ExploreStaticMapOptions,
  isCancelled: () => boolean,
): Promise<string | null> {
  const { default: maplibregl } = await import("maplibre-gl");
  await import("maplibre-gl/dist/maplibre-gl.css");

  if (isCancelled()) return null;

  const map = new maplibregl.Map(
    buildExploreMapCropSnapshotMapOptions(container, lng, lat, zoom),
  );

  let usedFallback = false;
  map.on("error", () => {
    if (usedFallback) return;
    usedFallback = true;
    map.setStyle(`${OPENFREEMAP_PUBLIC_ORIGIN}/styles/liberty`);
  });

  const removeMap = () => {
    try {
      map.remove();
    } catch {
      /* already removed */
    }
  };

  if (isCancelled()) {
    removeMap();
    return null;
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (url: string | null) => {
      if (settled) return;
      settled = true;
      removeMap();
      resolve(url);
    };

    const timeoutId = window.setTimeout(() => finish(null), 15_000);

    map.once("idle", () => {
      window.clearTimeout(timeoutId);
      if (isCancelled()) {
        finish(null);
        return;
      }
      try {
        finish(map.getCanvas().toDataURL("image/png"));
      } catch {
        finish(null);
      }
    });
  });
}

/**
 * Renders a one-shot MapLibre crop, snapshots to PNG, removes the map, and caches by lat/lng/zoom.
 * At most two maps render at once; additional requests wait in a FIFO queue.
 */
export async function queueExploreMapCropSnapshot(
  container: HTMLElement,
  options: ExploreStaticMapOptions,
  isCancelled: () => boolean,
  registerCancelWait?: (cancelWait: () => void) => void,
): Promise<string | null> {
  const zoom = options.zoom ?? 17;
  const key = exploreMapCropSnapshotCacheKey(options.lat, options.lng, zoom);
  const cached = snapshotCache.get(key);
  if (cached) return cached;

  const { whenReady, cancelWait } = requestRenderSlot(isCancelled);
  registerCancelWait?.(cancelWait);

  const acquired = await whenReady;
  registerCancelWait?.(() => {});

  if (!acquired || isCancelled()) return null;

  try {
    const again = snapshotCache.get(key);
    if (again) return again;

    const dataUrl = await captureMapToDataUrl(container, options, isCancelled);
    if (!dataUrl || isCancelled()) return null;

    snapshotCache.set(key, dataUrl);
    return dataUrl;
  } finally {
    releaseRenderSlot();
  }
}
