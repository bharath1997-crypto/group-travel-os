import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearLocalTimeCacheForTests,
  formatLocalTimeInZone,
  formatTimezoneLabel,
  resolveLocalTimeAtPoint,
} from "../live-map-local-time";

describe("live-map-local-time", () => {
  afterEach(() => {
    clearLocalTimeCacheForTests();
    vi.unstubAllGlobals();
  });

  it("formats AM/PM clock in an IANA timezone", () => {
    const label = formatLocalTimeInZone(
      "America/Chicago",
      new Date("2026-09-15T18:30:00Z"),
    );
    expect(label).toMatch(/PM|AM/);
    expect(label).toMatch(/\d:/);
  });

  it("shortens timezone labels for display", () => {
    expect(formatTimezoneLabel("Asia/Kolkata")).toBe("Kolkata");
    expect(formatTimezoneLabel("Europe/London")).toBe("London");
  });

  it("resolves accurate local time from Open-Meteo timezone", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ timezone: "Asia/Tokyo" }),
      })),
    );

    const result = await resolveLocalTimeAtPoint(
      35.6762,
      139.6503,
      new Date("2026-09-15T03:00:00Z"),
    );
    expect(result.approximate).toBe(false);
    expect(result.timezone).toBe("Asia/Tokyo");
    expect(result.timeLabel).toMatch(/local$/);
  });

  it("falls back to solar estimate when timezone lookup fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
      })),
    );

    const result = await resolveLocalTimeAtPoint(0, 0);
    expect(result.approximate).toBe(true);
    expect(result.timeLabel).toMatch(/local$/);
  });
});
