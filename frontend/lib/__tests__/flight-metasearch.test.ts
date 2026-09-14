import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { providerSourceLabel } from "@/components/travel/FlightTrustStrip";

describe("flight metasearch UI language", () => {
  const files = [
    "components/travel/FlightPricePanel.tsx",
    "components/travel/FlightTrustStrip.tsx",
    "app/(dashboard)/flights/results/page.tsx",
    "app/(dashboard)/flights/page.tsx",
  ];

  it("does not claim in-app booking on metasearch results", () => {
    for (const relativePath of files) {
      const absolutePath = join(process.cwd(), relativePath);
      expect(existsSync(absolutePath)).toBe(true);
      const content = readFileSync(absolutePath, "utf8");
      expect(content).not.toContain("Book with Rovvy");
      expect(content).not.toContain("Book entirely inside Rovvy");
      expect(content).not.toContain("Secure booking through Rovvy");
    }
  });

  it("uses view options entry point", () => {
    const panel = readFileSync(join(process.cwd(), "components/travel/FlightPricePanel.tsx"), "utf8");
    expect(panel).toContain("View options");
  });

  it("labels test inventory without live wording", () => {
    const strip = readFileSync(join(process.cwd(), "components/travel/FlightTrustStrip.tsx"), "utf8");
    expect(strip).toContain("Test airline offers");
    expect(strip).toContain("Compare available airline offers");
    expect(
      providerSourceLabel(
        [
          {
            provider_id: "duffel",
            status: "ok",
            offer_count: 1,
            environment: "test",
            message: null,
            elapsed_ms: 10,
          },
        ],
        true,
      ),
    ).toBe("Powered by Duffel sandbox");
    expect(strip).not.toContain("Live airline offers");
  });

  it("prohibits provider_checkout and internal booking links in options drawer", () => {
    const drawer = readFileSync(join(process.cwd(), "components/travel/FlightOptionsDrawer.tsx"), "utf8");
    expect(drawer).toContain("An external provider link is not available for this offer.");
    expect(drawer).toContain("Compare available airline offers");
    expect(drawer).not.toContain('option.action_type === "provider_checkout"');
    expect(drawer).not.toContain("/flights/offer/");
    expect(drawer).not.toContain("authHref(");
    expect(drawer).not.toContain("Sign in to continue");
    expect(drawer).toContain("Payment, ticketing, flight changes, cancellations, refunds, and customer support are handled by");
  });

  it("does not prompt guests to sign in on results page", () => {
    const results = readFileSync(join(process.cwd(), "app/(dashboard)/flights/results/page.tsx"), "utf8");
    expect(results).not.toContain("Sign in to book this flight");
    expect(results).not.toContain("AuthRequiredModal");
    expect(results).toContain("FlightOptionsDrawer");
  });
});
