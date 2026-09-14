import { describe, expect, it } from "vitest";
import {
  applyAddConvoyPickup,
  applyJoinConvoyOffer,
  applyJoinSeatShareVehicle,
  mergeConvoyLocationRefresh,
  riderInitials,
} from "../live-convoy-actions";
import { buildDefaultSeatShare } from "../live-seat-share-mock";

describe("live-convoy-actions", () => {
  it("derives rider initials", () => {
    expect(riderInitials("Jane Doe")).toBe("JD");
  });

  it("decrements open seats when a rider joins", () => {
    const result = applyJoinConvoyOffer(
      {
        label: "Ana's SUV",
        driverName: "Ana",
        seatsTotal: 4,
        seatsOpen: 2,
        costPerHead: 16,
        currency: "USD",
        routeLabel: "Direct · 12 mi",
        destinationName: "Union Station",
        pickups: [],
        lat: 41.922,
        lng: -87.726,
        updatedAt: Date.now(),
      },
      {
        userId: "rider-1",
        name: "Sam Lee",
        pickupLabel: "Western Blue Line",
        etaMinutes: 9,
      },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.offer.seatsOpen).toBe(1);
      expect(result.offer.pickups).toHaveLength(1);
    }
  });

  it("blocks duplicate joins", () => {
    const offer = {
      label: "Ana's SUV",
      driverName: "Ana",
      seatsTotal: 4,
      seatsOpen: 1,
      costPerHead: 16,
      currency: "USD",
      routeLabel: "Direct · 12 mi",
      destinationName: "Union Station",
      pickups: [{ id: "rider-1", label: "Western Blue Line", etaMinutes: 9 }],
      lat: null,
      lng: null,
      updatedAt: Date.now(),
    };

    const result = applyJoinConvoyOffer(offer, {
      userId: "rider-1",
      name: "Sam Lee",
      pickupLabel: "Western Blue Line",
    });

    expect(result.ok).toBe(false);
  });

  it("adds pickup stops without changing seat count", () => {
    const result = applyAddConvoyPickup(
      {
        label: "Your ride",
        driverName: "You",
        seatsTotal: 4,
        seatsOpen: 2,
        costPerHead: 18,
        currency: "USD",
        routeLabel: "Loop · 18 mi",
        destinationName: "Union Station",
        pickups: [],
        lat: null,
        lng: null,
        updatedAt: Date.now(),
      },
      { id: "pickup-1", label: "Milwaukee & Damen", etaMinutes: 6 },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.offer.seatsOpen).toBe(2);
      expect(result.offer.pickups).toHaveLength(1);
    }
  });

  it("preserves seats and pickups during location refresh", () => {
    const merged = mergeConvoyLocationRefresh(
      {
        userId: "driver-1",
        label: "Ana's SUV",
        driverName: "Ana",
        seatsTotal: 4,
        seatsOpen: 1,
        costPerHead: 16,
        currency: "USD",
        routeLabel: "Direct · 12 mi",
        destinationName: "Union Station",
        pickups: [{ id: "rider-1", label: "Western Blue Line", etaMinutes: 9 }],
        lat: 41.922,
        lng: -87.726,
        updatedAt: Date.now(),
      },
      {
        label: "Ana's SUV",
        driverName: "Ana",
        seatsTotal: 4,
        seatsOpen: 2,
        costPerHead: 16,
        currency: "USD",
        routeLabel: "Direct · 14 mi",
        destinationName: "Union Station",
        pickups: [],
        lat: 41.93,
        lng: -87.72,
        updatedAt: Date.now(),
      },
    );

    expect(merged.seatsOpen).toBe(1);
    expect(merged.pickups).toHaveLength(1);
    expect(merged.lat).toBe(41.93);
  });

  it("updates mock seat share vehicles on join", () => {
    const state = buildDefaultSeatShare("Union Station");
    const result = applyJoinSeatShareVehicle(state, "van-tomas", {
      userId: "rider-1",
      name: "Sam Lee",
      pickupLabel: "Ogden & Ashland",
    });

    expect(result.ok).toBe(true);
    if (result.ok && result.state) {
      const vehicle = result.state.vehicles.find((entry) => entry.id === "van-tomas");
      expect(vehicle?.seatsOpen).toBe(0);
      expect(vehicle?.pickups.some((pickup) => pickup.id === "rider-1")).toBe(true);
    }
  });
});
