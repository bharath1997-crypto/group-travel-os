import maplibregl from "maplibre-gl";
import {
  getFlightPickerBasemapStyle,
  getLiveMapLibreLayerStyles,
  resolveOpenFreeMapCleanStyleUrlForLiveMap,
  rewriteRovvyTileWorkerRequestUrl,
} from "@/lib/map-providers";

export type SeatShareMapOptions = {
  container: HTMLElement;
  center: [number, number];
  zoom: number;
  attributionControl?: boolean;
};

/** MapLibre init shared by SeatShare pickers — localhost tile fallback + style recovery. */
export function attachSeatShareMapTileFallback(map: maplibregl.Map): void {
  let usedFallback = false;
  map.on("error", (event) => {
    const message = event.error?.message || "";
    const tileFailure =
      message.includes("failed to fetch") ||
      message.includes("403") ||
      message.includes("404") ||
      message.includes("Tile");
    if (!tileFailure || usedFallback) return;
    usedFallback = true;
    try {
      const fallback =
        getLiveMapLibreLayerStyles().clean || resolveOpenFreeMapCleanStyleUrlForLiveMap();
      map.setStyle(fallback as maplibregl.StyleSpecification);
    } catch {
      /* secondary failure — leave map as-is */
    }
  });
}

export function seatShareMapOptions({
  container,
  center,
  zoom,
  attributionControl = false,
}: SeatShareMapOptions): maplibregl.MapOptions {
  return {
    container,
    style: getFlightPickerBasemapStyle() as maplibregl.StyleSpecification,
    center,
    zoom,
    ...(attributionControl ? {} : { attributionControl: false as const }),
    transformRequest: (url) => ({ url: rewriteRovvyTileWorkerRequestUrl(url) }),
  };
}

export type SeatShareMapMount = {
  map: maplibregl.Map;
  resize: () => void;
  destroy: () => void;
};

/** Create map + resize observers (flex/grid panels need explicit resize). */
export function mountSeatShareMap(
  container: HTMLElement,
  center: [number, number],
  zoom: number,
): SeatShareMapMount {
  const map = new maplibregl.Map(
    seatShareMapOptions({
      container,
      center,
      zoom,
    }),
  );
  attachSeatShareMapTileFallback(map);
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
  map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");

  const resize = () => {
    try {
      map.resize();
    } catch {
      /* map tearing down */
    }
  };

  map.once("load", resize);
  map.once("idle", resize);
  const resizeTimer = window.setTimeout(resize, 150);
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
  ro?.observe(container);

  return {
    map,
    resize,
    destroy: () => {
      window.clearTimeout(resizeTimer);
      ro?.disconnect();
      map.remove();
    },
  };
}
