import { describe, expect, it } from "vitest";

/** Documents reload banner visibility contract (hook states). */
describe("explore hub saves reload UI contract", () => {
  it("shows alert banner only when signed-in user and reloadState is error", () => {
    const showBanner = (user: unknown, reloadState: string) =>
      Boolean(user) && reloadState === "error";

    expect(showBanner({ id: "1" }, "error")).toBe(true);
    expect(showBanner({ id: "1" }, "loaded")).toBe(false);
    expect(showBanner(null, "error")).toBe(false);
    expect(showBanner({ id: "1" }, "loading")).toBe(false);
  });
});
