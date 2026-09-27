import { afterEach, describe, expect, it, vi } from "vitest";

describe("live-map-style-prefetch", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("prefetches clean and street style JSON in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("window", { location: { hostname: "localhost" } });
    vi.stubGlobal("document", {
      head: {
        querySelector: () => null,
        appendChild: vi.fn(),
      },
      createElement: () => {
        return { rel: "", href: "", crossOrigin: "", dataset: {} as Record<string, string> };
      },
    });

    const mod = await import("../live-map-style-prefetch");
    mod.prefetchLiveOpenFreeMapStyles();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("tiles.openfreemap.org/styles/");
  });
});
