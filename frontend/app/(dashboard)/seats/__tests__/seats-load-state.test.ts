import { describe, expect, it } from "vitest";
import { resolveSeatsMeLoadFailure, resolveSeatsSearchLoadFailure } from "../seats-load-state";

describe("resolveSeatsSearchLoadFailure", () => {
  it("maps 401 to auth", () => {
    expect(resolveSeatsSearchLoadFailure({ status: 401 })).toEqual({ kind: "auth" });
  });

  it("maps 403 to auth", () => {
    expect(resolveSeatsSearchLoadFailure({ status: 403 })).toEqual({ kind: "auth" });
  });

  it("maps other failures to error message", () => {
    const r = resolveSeatsSearchLoadFailure({ status: 500 });
    expect(r.kind).toBe("error");
    if (r.kind === "error") expect(r.message).toMatch(/could not load/i);
  });
});

describe("resolveSeatsMeLoadFailure", () => {
  it("maps 401 to auth", () => {
    expect(resolveSeatsMeLoadFailure({ status: 401 })).toEqual({ kind: "auth" });
  });

  it("maps network errors to error message", () => {
    const r = resolveSeatsMeLoadFailure(new Error("network"));
    expect(r.kind).toBe("error");
  });
});
