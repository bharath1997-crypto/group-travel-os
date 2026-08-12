import { describe, expect, it, vi } from "vitest";
import type { LiveMapLayer } from "@/lib/map-providers";
import {
  beginLiveMapStyleSwitch,
  detectLiveMapBaseLayer,
  liveMapBaseLayerMatches,
  resetLiveMapStyleSwitchGenerationForTests,
} from "../live-map-style-switch";

function createMockMap(initialLayer: LiveMapLayer | null = "dark") {
  let styleLoaded = true;
  const handlers: Record<string, Set<() => void>> = {
    "style.load": new Set(),
    idle: new Set(),
  };
  const layers = new Map<string, object>();

  const applyLayerMarkers = (layer: LiveMapLayer | null) => {
    layers.clear();
    if (layer === "dark") layers.set("carto-tiles", {});
    if (layer === "terrain") layers.set("esri-topo-tiles", {});
    if (layer === "satellite") layers.set("esri-tiles", {});
  };

  applyLayerMarkers(initialLayer);

  const map = {
    isStyleLoaded: () => styleLoaded,
    getLayer: (id: string) => (layers.has(id) ? { id } : undefined),
    getStyle: () => ({ sources: {}, layers: [...layers.keys()].map((id) => ({ id })) }),
    on: (event: string, fn: () => void) => {
      handlers[event]?.add(fn);
    },
    off: (event: string, fn: () => void) => {
      handlers[event]?.delete(fn);
    },
    once: (event: string, fn: () => void) => {
      const wrapper = () => {
        handlers[event]?.delete(wrapper);
        fn();
      };
      handlers[event]?.add(wrapper);
    },
    setStyle: vi.fn((_style: unknown, _opts?: unknown) => {
      styleLoaded = false;
      queueMicrotask(() => {
        const nextLayer = (map.setStyle as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0]
          ?.layers?.[0]?.id;
        if (nextLayer === "esri-topo-tiles") applyLayerMarkers("terrain");
        else if (nextLayer === "carto-tiles") applyLayerMarkers("dark");
        styleLoaded = true;
        handlers["style.load"].forEach((fn) => fn());
      });
    }),
  };

  return map;
}

describe("live-map-style-switch", () => {
  it("detects dark and terrain marker layers", () => {
    const darkMap = createMockMap("dark");
    expect(detectLiveMapBaseLayer(darkMap as never)).toBe("dark");
    expect(liveMapBaseLayerMatches(darkMap as never, "terrain")).toBe(false);

    const terrainMap = createMockMap("terrain");
    expect(detectLiveMapBaseLayer(terrainMap as never)).toBe("terrain");
    expect(liveMapBaseLayerMatches(terrainMap as never, "terrain")).toBe(true);
  });

  it("ignores stale style.load callbacks when switching rapidly", async () => {
    resetLiveMapStyleSwitchGenerationForTests();
    const map = createMockMap("dark");
    const ready = vi.fn();

    const terrainStyle = {
      version: 8 as const,
      sources: { esri: { type: "raster" as const, tiles: [], tileSize: 256 } },
      layers: [{ id: "esri-topo-tiles", type: "raster" as const, source: "esri" }],
    };
    const darkStyle = {
      version: 8 as const,
      sources: { carto: { type: "raster" as const, tiles: [], tileSize: 256 } },
      layers: [{ id: "carto-tiles", type: "raster" as const, source: "carto" }],
    };

    beginLiveMapStyleSwitch(map as never, "terrain", terrainStyle, ready);
    beginLiveMapStyleSwitch(map as never, "dark", darkStyle, ready);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(map.setStyle).toHaveBeenCalledTimes(2);
    expect(ready).toHaveBeenCalledTimes(1);
    expect(ready.mock.calls[0]?.[1]).toBe("dark");
    expect(liveMapBaseLayerMatches(map as never, "dark")).toBe(true);
  });

  it("calls onReady for the latest terrain request", async () => {
    resetLiveMapStyleSwitchGenerationForTests();
    const map = createMockMap("dark");
    const ready = vi.fn();

    const terrainStyle = {
      version: 8 as const,
      sources: { esri: { type: "raster" as const, tiles: [], tileSize: 256 } },
      layers: [{ id: "esri-topo-tiles", type: "raster" as const, source: "esri" }],
    };

    beginLiveMapStyleSwitch(map as never, "terrain", terrainStyle, ready);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(ready).toHaveBeenCalledTimes(1);
    expect(ready.mock.calls[0]?.[1]).toBe("terrain");
    expect(liveMapBaseLayerMatches(map as never, "terrain")).toBe(true);
  });
});
