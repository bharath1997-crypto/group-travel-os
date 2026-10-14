import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  authHref,
  authReturnPathFromParams,
  recalledAuthReturnPath,
  rememberAuthReturnPath,
  safeAuthReturnPath,
} from "@/lib/auth-return";

describe("authentication return paths", () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal("window", {});
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      clear: () => values.clear(),
    });
  });

  afterEach(() => sessionStorage.clear());

  it("accepts local application paths and rejects external redirects", () => {
    expect(safeAuthReturnPath("/routes?from=ORD&to=JFK")).toContain("/routes");
    expect(safeAuthReturnPath("https://evil.example/steal")).toBe("/explore");
    expect(safeAuthReturnPath("//evil.example/steal")).toBe("/explore");
  });

  it("supports next and the legacy returnTo parameter", () => {
    expect(authReturnPathFromParams(new URLSearchParams("next=%2Froutes%3Ffrom%3DORD"))).toBe(
      "/routes?from=ORD",
    );
    expect(authReturnPathFromParams(new URLSearchParams("returnTo=%2Fplan"))).toBe("/plan");
  });

  it("round-trips the intended destination through session storage", () => {
    const next = "/routes?from=CHI&to=HYD&restored=1";
    rememberAuthReturnPath(next);
    expect(recalledAuthReturnPath()).toBe(next);
    expect(recalledAuthReturnPath("/explore", true)).toBe(next);
    expect(recalledAuthReturnPath()).toBe("/explore");
  });

  it("builds an encoded login URL", () => {
    expect(authHref("/login", "/routes?from=ORD&to=HYD")).toBe(
      "/login?next=%2Froutes%3Ffrom%3DORD%26to%3DHYD",
    );
  });
});
