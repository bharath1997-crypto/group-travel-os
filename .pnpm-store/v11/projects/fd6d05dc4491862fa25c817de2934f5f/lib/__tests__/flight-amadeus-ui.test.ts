import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { providerSourceLabel } from "@/components/travel/FlightTrustStrip";
import type { ProviderStatusRecord, RovvyItineraryGroup, RovvySellerOption } from "@/lib/flight-types";

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

describe("two-provider flight UI", () => {
  it("labels two successful providers without privileging one source", () => {
    expect(providerSourceLabel([status("duffel"), status("amadeus")], false)).toBe(
      "Offers from 2 authorized providers",
    );
  });

  it("shows partial-result warning copy in trust strip", () => {
    const strip = readFileSync(join(process.cwd(), "components/travel/FlightTrustStrip.tsx"), "utf8");
    expect(strip).toContain("Some providers are temporarily unavailable");
  });

  it("discloses test-provider wording for Amadeus in options drawer", () => {
    const drawer = readFileSync(join(process.cwd(), "components/travel/FlightOptionsDrawer.tsx"), "utf8");
    expect(drawer).toContain("Test offer supplied through Amadeus");
    expect(drawer).toContain("Test airline offers");
  });

  it("supports one itinerary with multiple source options", () => {
    const group: RovvyItineraryGroup = {
      itinerary_key: "abc",
      marketing_airlines: ["AA"],
      operating_airlines: ["AA"],
      slices: [],
      total_duration_minutes: 100,
      stops: 0,
      departure_at: "2026-10-10T08:00:00Z",
      arrival_at: "2026-10-10T10:00:00Z",
      origin: "ORD",
      destination: "LAX",
      seller_options: [
        {
          provider_id: "duffel",
          provider_offer_id: "d1",
          seller_id: "duffel",
          seller_name: "Duffel sandbox",
          total_price: 900,
          currency: "USD",
          baggage: { carry_on_included: null, checked_bag_included: null, summary: "Not confirmed" },
          fare_conditions: { refundable: null, changeable: null, summary: "Not confirmed" },
          protected_connection: null,
          separate_tickets: null,
          self_transfer: null,
          redirect_url: null,
          action_type: "unavailable",
          checked_at: "2026-10-01T12:00:00Z",
          expires_at: "2099-01-01T00:00:00Z",
          environment: "test",
        },
        {
          provider_id: "amadeus",
          provider_offer_id: "a1",
          seller_id: "amadeus",
          seller_name: "Amadeus test",
          total_price: 850,
          currency: "USD",
          baggage: { carry_on_included: null, checked_bag_included: null, summary: "Not confirmed" },
          fare_conditions: { refundable: null, changeable: null, summary: "Not confirmed" },
          protected_connection: null,
          separate_tickets: null,
          self_transfer: null,
          redirect_url: null,
          action_type: "unavailable",
          checked_at: "2026-10-01T12:00:00Z",
          expires_at: "2099-01-01T00:00:00Z",
          environment: "test",
        },
      ],
      lowest_price: 850,
      currency: "USD",
    };
    expect(group.seller_options).toHaveLength(2);
    expect(new Set(group.seller_options.map((option) => option.provider_id))).toEqual(new Set(["duffel", "amadeus"]));
  });

  it("does not expose Book with Rovvy on results page", () => {
    const results = readFileSync(join(process.cwd(), "app/(dashboard)/flights/results/page.tsx"), "utf8");
    expect(results).not.toContain("Book with Rovvy");
  });

  it("does not bypass offer review with a direct checkout URL", () => {
    const results = readFileSync(join(process.cwd(), "app/(dashboard)/flights/results/page.tsx"), "utf8");
    expect(results).not.toContain("/flights/checkout");
    expect(results).not.toContain("provider_checkout");
  });

  it("keeps View Options available without login gate", () => {
    const results = readFileSync(join(process.cwd(), "app/(dashboard)/flights/results/page.tsx"), "utf8");
    expect(results).toContain("FlightOptionsDrawer");
    expect(results).not.toContain("AuthRequiredModal");
  });

  it("discloses last ticketing date without inventing expiration countdown", () => {
    const drawer = readFileSync(join(process.cwd(), "components/travel/FlightOptionsDrawer.tsx"), "utf8");
    expect(drawer).toContain("Last ticketing date:");
    expect(drawer).not.toContain("23:59:59Z");
  });

  it("disables external action when no authorized URL exists", () => {
    const drawer = readFileSync(join(process.cwd(), "components/travel/FlightOptionsDrawer.tsx"), "utf8");
    expect(drawer).toContain("An external provider link is not available for this offer.");
    const option: RovvySellerOption = {
      provider_id: "amadeus",
      provider_offer_id: "a1",
      seller_id: "amadeus",
      seller_name: "Amadeus test",
      total_price: 850,
      currency: "USD",
      baggage: { carry_on_included: null, checked_bag_included: null, summary: "Not confirmed" },
      fare_conditions: { refundable: null, changeable: null, summary: "Not confirmed" },
      protected_connection: null,
      separate_tickets: null,
      self_transfer: null,
      redirect_url: null,
      action_type: "unavailable",
      checked_at: "2026-10-01T12:00:00Z",
      expires_at: null,
      last_ticketing_date: "2026-12-01",
      environment: "test",
    };
    expect(option.action_type).toBe("unavailable");
    expect(option.redirect_url).toBeNull();
  });
});
