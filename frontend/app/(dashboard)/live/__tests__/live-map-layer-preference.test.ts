import { afterEach, describe, expect, it, vi } from "vitest";

describe("live-map-layer-preference", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function loadPreference() {
    return import("../live-map-layer-preference");
  }

  it("auto-picks dark at night when CARTO key is set", async () => {
    vi.stubEnv("NEXT_PUBLIC_CARTO_API_KEY", "test-key");
    const mod = await loadPreference();
    expect(mod.resolveAutoLiveMapLayer(new Date("2026-09-14T03:00:00"))).toBe("dark");
  });

  it("stays on clean at night without CARTO key", async () => {
    const mod = await loadPreference();
    expect(mod.resolveAutoLiveMapLayer(new Date("2026-09-14T03:00:00"))).toBe("clean");
  });
});
