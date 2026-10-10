import type { Map as MapLibreMap, Marker } from "maplibre-gl";

import { OPENFREEMAP_PUBLIC_ORIGIN, resolveOpenFreeMapCleanStyleUrlForLiveMap } from "@/lib/map-providers";

export type ExploreStaticMapOptions = {
  lat: number;
  lng: number;
  zoom?: number;
  showMarker?: boolean;
};

/** Tear down MapLibre without throwing when React already removed the container. */
export function disposeExploreStaticMap(
  map: MapLibreMap,
  container: HTMLElement,
  marker: Marker | null,
  resizeObserver?: ResizeObserver,
): void {
  resizeObserver?.disconnect();
  try {
    marker?.remove();
  } catch {
    /* marker DOM may already be gone */
  }
  try {
    map.remove();
  } catch {
    if (!container.isConnected) {
      container.replaceChildren();
    }
  }
}

/** Non-interactive MapLibre pin map (OpenFreeMap with public fallback). */
export async function mountExploreStaticMap(
  container: HTMLElement,
  { lat, lng, zoom = 17, showMarker = true }: ExploreStaticMapOptions,
  isActive: () => boolean = () => true,
): Promise<() => void> {
  const { default: maplibregl } = await import("maplibre-gl");
  await import("maplibre-gl/dist/maplibre-gl.css");

  if (!isActive() || !container.isConnected) {
    return () => {};
  }

  const map = new maplibregl.Map({
    container,
    style: resolveOpenFreeMapCleanStyleUrlForLiveMap(),
    center: [lng, lat],
    zoom,
    interactive: false,
    attributionControl: { compact: true },
  });

  let marker: Marker | null = null;
  if (showMarker) {
    marker = new maplibregl.Marker({ color: "#0f6b5c" }).setLngLat([lng, lat]).addTo(map);
  }

  let disposed = false;
  const resize = () => {
    if (disposed || !isActive() || !container.isConnected) return;
    try {
      map.resize();
    } catch {
      /* map may be removed */
    }
  };

  map.once("load", resize);
  requestAnimationFrame(resize);

  let resizeObserver: ResizeObserver | undefined;
  if (typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(container);
  }

  let usedFallback = false;
  map.on("error", () => {
    if (disposed || !isActive()) return;
    if (usedFallback) return;
    usedFallback = true;
    map.setStyle(`${OPENFREEMAP_PUBLIC_ORIGIN}/styles/liberty`);
  });

  return () => {
    if (disposed) return;
    disposed = true;
    disposeExploreStaticMap(map, container, marker, resizeObserver);
  };
}
