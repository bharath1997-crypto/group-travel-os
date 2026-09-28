import { describe, expect, it } from "vitest";
import { buildDemoSeatRideCards } from "../seats-demo-cards";
import { getSeatsDemoRides } from "../seats-fixtures";

describe("getSeatsDemoRides", () => {
  it("uses INR paise-scale prices for India", () => {
    const rides = getSeatsDemoRides("INR");
    expect(rides[0]?.priceMinor).toBeGreaterThan(10_000);
    expect(rides[0]?.departPlace).toMatch(/Mumbai/i);
  });

  it("uses USD cent-scale prices for United States", () => {
    const rides = getSeatsDemoRides("USD");
    expect(rides[0]?.priceMinor).toBeLessThan(10_000);
    expect(rides[0]?.departPlace).toMatch(/Chicago/i);
  });
});

describe("buildDemoSeatRideCards", () => {
  it("formats US demo cards in dollars", () => {
    const cards = buildDemoSeatRideCards(
      {
        address: "Chicago, IL",
        lat: 41.88,
        lng: -87.62,
        isConfirmed: true,
        source: "map_pin",
        countryCode: "US",
      },
      {
        address: "Milwaukee, WI",
        lat: 43.04,
        lng: -87.91,
        isConfirmed: true,
        source: "map_pin",
        countryCode: "US",
      },
    );
    expect(cards[0]?.price_per_seat.currency).toBe("USD");
    expect(cards[0]?.price_per_seat.display).toMatch(/^\$/);
    expect(cards[0]?.stops[0]?.label).toMatch(/Chicago/i);
  });
});
