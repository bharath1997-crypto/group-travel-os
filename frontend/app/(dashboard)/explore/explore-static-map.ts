import { OPENFREEMAP_PUBLIC_ORIGIN, resolveOpenFreeMapCleanStyleUrlForLiveMap } from "@/lib/map-providers";

export type ExploreStaticMapOptions = {
  lat: number;
  lng: number;
  zoom?: number;
  showMarker?: boolean;
};

/** Non-interactive MapLibre pin map (OpenFreeMap with public fallback). */
export async function mountExploreStaticMap(
  container: HTMLElement,
  { lat, lng, zoom = 17, showMarker = true }: ExploreStaticMapOptions,
): Promise<() => void> {
  const { default: maplibregl } = await import("maplibre-gl");
  await import("maplibre-gl/dist/maplibre-gl.css");

  const map = new maplibregl.Map({
    container,
    style: resolveOpenFreeMapCleanStyleUrlForLiveMap(),
    center: [lng, lat],
    zoom,
    interactive: false,
    attributionControl: { compact: true },
  });

  if (showMarker) {
    new maplibregl.Marker({ color: "#0f6b5c" }).setLngLat([lng, lat]).addTo(map);
  }

  let usedFallback = false;
  map.on("error", () => {
    if (usedFallback) return;
    usedFallback = true;
    map.setStyle(`${OPENFREEMAP_PUBLIC_ORIGIN}/styles/liberty`);
  });

  return () => map.remove();
}
