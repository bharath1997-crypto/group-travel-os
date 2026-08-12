import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchWithTimeout,
  normalizeRequestInit,
  optionalSignalInit,
} from "@/lib/safe-fetch";

describe("optionalSignalInit", () => {
  it("omits signal when absent", () => {
    expect(optionalSignalInit()).toEqual({});
    expect(optionalSignalInit(undefined)).toEqual({});
    expect(optionalSignalInit(null)).toEqual({});
  });

  it("includes a real signal when given one", () => {
    const controller = new AbortController();
    expect(optionalSignalInit(controller.signal)).toEqual({
      signal: controller.signal,
    });
  });
});

describe("normalizeRequestInit", () => {
  it("turns missing or non-object init into an empty object", () => {
    expect(normalizeRequestInit()).toEqual({});
    expect(normalizeRequestInit(null)).toEqual({});
    expect(normalizeRequestInit(undefined)).toEqual({});
  });

  it("strips an explicitly undefined signal", () => {
    const out = normalizeRequestInit({ method: "POST", signal: undefined });
    expect(out).toEqual({ method: "POST" });
    expect("signal" in out).toBe(false);
  });

  it("preserves other options", () => {
    expect(normalizeRequestInit({ method: "PUT", body: "x" })).toEqual({
      method: "PUT",
      body: "x",
    });
  });
});

describe("fetchWithTimeout", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubFetch() {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(null, { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("supplies its own signal when init is undefined", async () => {
    const fetchMock = stubFetch();

    await fetchWithTimeout("http://example.com", undefined);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBeDefined();
  });

  it("aborts immediately when the caller's signal is already aborted", async () => {
    const fetchMock = stubFetch();

    const controller = new AbortController();
    controller.abort();
    await fetchWithTimeout("http://example.com", { signal: controller.signal });

    expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  });
});
