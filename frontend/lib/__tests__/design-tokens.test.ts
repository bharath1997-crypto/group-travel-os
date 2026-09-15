import { describe, expect, it } from "vitest";
import { ROVVY_COLORS, rovvy } from "@/lib/design-tokens";
import { BRAND } from "@/lib/brand";

describe("design-tokens", () => {
  it("uses approved Rovvy brand primary forest green", () => {
    expect(ROVVY_COLORS.primary).toBe("#0E6E5C");
    expect(BRAND.colors.primary).toBe("#0E6E5C");
  });

  it("exposes shared page shell classes", () => {
    expect(rovvy.pageShell).toContain("max-w-6xl");
    expect(rovvy.btnPrimary).toContain("bg-primary");
  });
});
