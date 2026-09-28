import { afterEach, describe, expect, it, vi } from "vitest";

describe("OpenFreeMap dev tile fallback", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("uses public CDN in next dev even on LAN / Tailscale hosts", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubGlobal("window", {
      location: { hostname: "100.75.122.96" },
    });
    const mod = await import("@/lib/map-providers");
    expect(mod.shouldUsePublicOpenFreeMapTileFallback()).toBe(true);
    expect(mod.resolveOpenFreeMapBaseUrlForBrowser()).toBe(
      "https://tiles.openfreemap.org",
    );
    expect(mod.resolveOpenFreeMapCleanStyleUrlForLiveMap()).toBe(
      "https://tiles.openfreemap.org/styles/liberty",
    );
    expect(mod.rewriteRovvyTileWorkerRequestUrl("https://tiles.rovvy.app/planet/1/0/0.pbf")).toBe(
      "https://tiles.openfreemap.org/planet/1/0/0.pbf",
    );
    expect(mod.getFlightPickerBasemapStyle()).toBe(
      "https://tiles.openfreemap.org/styles/liberty",
    );
  });

  it("keeps Rovvy worker in production builds", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubGlobal("window", {
      location: { hostname: "rovvy.app" },
    });
    const mod = await import("@/lib/map-providers");
    expect(mod.shouldUsePublicOpenFreeMapTileFallback()).toBe(false);
    expect(mod.resolveOpenFreeMapBaseUrlForBrowser()).toBe("https://tiles.rovvy.app");
  });
});
