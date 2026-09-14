import { describe, expect, it } from "vitest";
import { providerSourceLabel } from "@/components/travel/FlightTrustStrip";
import type { ProviderStatusRecord } from "@/lib/flight-types";

function status(providerId: string, environment: "test" | "live" = "test"): ProviderStatusRecord {
  return {
    provider_id: providerId,
    status: "ok",
    offer_count: 2,
    environment,
    message: null,
    elapsed_ms: 100,
  };
}

describe("flight provider source labels", () => {
  it("labels one sandbox provider without calling it the default", () => {
    expect(providerSourceLabel([status("duffel")], true)).toBe("Powered by Duffel sandbox");
  });

  it("labels multiple providers without privileging one source", () => {
    expect(providerSourceLabel([status("duffel"), status("amadeus")], false)).toBe(
      "Offers from 2 authorized providers",
    );
  });

  it("does not count failed providers as offer sources", () => {
    const failed: ProviderStatusRecord = { ...status("future"), status: "timeout", offer_count: 0 };
    expect(providerSourceLabel([status("duffel", "live"), failed], false)).toBe("Offers from Duffel");
  });
});
