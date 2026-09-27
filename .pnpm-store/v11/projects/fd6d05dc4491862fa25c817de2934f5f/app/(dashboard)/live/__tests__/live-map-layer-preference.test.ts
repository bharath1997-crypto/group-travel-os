import { afterEach, describe, expect, it, vi } from "vitest";

describe("live-map-layer-preference", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function loadPreference() {
    return import("../live-map-layer-preference");
  }

  it("does not auto-pick dark while the layer is disabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_CARTO_API_KEY", "test-key");
    const mod = await loadPreference();
    expect(mod.LIVE_MAP_DARK_LAYER_ENABLED).toBe(false);
    expect(mod.resolveAutoLiveMapLayer(new Date("2026-09-14T03:00:00"))).toBe("street");
  });

  it("stays on detailed street map at night without CARTO key", async () => {
    const mod = await loadPreference();
    expect(mod.resolveAutoLiveMapLayer(new Date("2026-09-14T03:00:00"))).toBe("street");
  });
});
