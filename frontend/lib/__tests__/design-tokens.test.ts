import { describe, expect, it } from "vitest";
import { ROVVY_COLORS, rovvy } from "@/lib/design-tokens";
import { BRAND } from "@/lib/brand";

describe("design-tokens", () => {
  it("uses approved Rovvy brand primary teal", () => {
    expect(ROVVY_COLORS.primary).toBe("#0F766E");
    expect(BRAND.colors.primary).toBe("#0F766E");
  });

  it("exposes shared page shell classes", () => {
    expect(rovvy.pageShell).toContain("max-w-6xl");
    expect(rovvy.btnPrimary).toContain("bg-primary");
  });
});
