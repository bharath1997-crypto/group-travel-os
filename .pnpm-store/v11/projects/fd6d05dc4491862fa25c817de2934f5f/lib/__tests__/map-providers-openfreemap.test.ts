import { afterEach, describe, expect, it, vi } from "vitest";

describe("OpenFreeMap self-host resolvers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function loadMapProviders() {
    return import("@/lib/map-providers");
  }

  it("defaults to Rovvy tile worker origin", async () => {
    const mod = await loadMapProviders();
    expect(mod.resolveOpenFreeMapBaseUrl()).toBe("https://tiles.rovvy.app");
    expect(mod.isOpenFreeMapSelfHosted()).toBe(true);
    expect(mod.isLiveOpenFreeMapBasemapPrimary()).toBe(true);
    expect(mod.resolveStreetTileUrl()).toBe("");
    expect(mod.resolveOpenFreeMapCleanStyleUrl()).toBe(
      "https://tiles.rovvy.app/styles/liberty",
    );
    expect(mod.resolveOpenFreeMapVectorTilesUrl()).toBe(
      "https://tiles.rovvy.app/planet/{z}/{x}/{y}.pbf",
    );
  });

  it("uses self-hosted base URL when configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_OPENFREEMAP_BASE_URL", "https://tiles.rovvy.app/");
    const mod = await loadMapProviders();
    expect(mod.resolveOpenFreeMapBaseUrl()).toBe("https://tiles.rovvy.app");
    expect(mod.isOpenFreeMapSelfHosted()).toBe(true);
    expect(mod.isLiveOpenFreeMapBasemapPrimary()).toBe(true);
    expect(mod.resolveOpenFreeMapStreetStyleUrl()).toBe(
      "https://tiles.rovvy.app/styles/bright",
    );
  });

  it("appends CARTO key to raster street tiles", async () => {
    vi.stubEnv("NEXT_PUBLIC_CARTO_API_KEY", "test-carto-key");
    vi.stubEnv("NEXT_PUBLIC_LIVE_BASEMAP", "carto");
    const mod = await loadMapProviders();
    expect(mod.isLiveOpenFreeMapBasemapPrimary()).toBe(false);
    expect(mod.resolveStreetTileUrl()).toContain("key=test-carto-key");
  });

  it("skips CARTO raster when OpenFreeMap basemap is primary", async () => {
    vi.stubEnv("NEXT_PUBLIC_LIVE_BASEMAP", "openfreemap");
    const mod = await loadMapProviders();
    expect(mod.resolveStreetTileUrl()).toBe("");
    expect(mod.resolveStreetRasterTileUrls()).toEqual([]);
  });
});
