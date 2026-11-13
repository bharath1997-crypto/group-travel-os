import { describe, expect, it } from "vitest";
import { buildShareTripText, rideDetailChips } from "../seats-ride-details";

describe("rideDetailChips", () => {
  it("shows only what the driver stated", () => {
    expect(rideDetailChips(null)).toEqual([]);
    expect(rideDetailChips({})).toEqual([]);
    expect(
      rideDetailChips({ depart_window_minutes: 15, luggage: "small", pets_allowed: true, quiet_ride: true }),
    ).toEqual(["Flexible ± 15 min", "Small bags", "Pets allowed", "Quiet ride"]);
  });
  it("ignores a zero window and unknown luggage", () => {
    expect(rideDetailChips({ depart_window_minutes: 0, luggage: "x" as never })).toEqual([]);
  });
});

describe("buildShareTripText", () => {
  it("includes route and time, and optional car and note", () => {
    const t = buildShareTripText({ from: "A", to: "B", departLabel: "Mon 8:00", car: "Blue Toyota", note: "Gate 2" });
    expect(t).toContain("from A to B");
    expect(t).toContain("Car: Blue Toyota");
    expect(t).toContain("Pickup note: Gate 2");
    expect(t).not.toMatch(/plate/i);
  });
  it("leaves out missing car and note", () => {
    const t = buildShareTripText({ from: "A", to: "B", departLabel: "x" });
    expect(t).not.toContain("Car:");
    expect(t).not.toContain("Pickup note:");
  });
});
