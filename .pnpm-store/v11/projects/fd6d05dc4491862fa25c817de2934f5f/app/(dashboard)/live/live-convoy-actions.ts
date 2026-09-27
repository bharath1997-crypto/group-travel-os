import type { ConvoyOfferPayload, ConvoyOfferRecord } from "./live-convoy-types";
import type { SeatSharePickup, SeatShareState, SeatShareVehicle } from "./live-seat-share-mock";

export type ConvoyJoinRider = {
  userId: string;
  name: string;
  pickupLabel: string;
  etaMinutes?: number;
};

export type ConvoyActionResult =
  | { ok: true; offer: ConvoyOfferPayload }
  | { ok: false; error: string };

export function riderInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "R";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

export function riderJoinedOffer(offer: ConvoyOfferPayload, riderUserId: string): boolean {
  return offer.pickups.some((pickup) => pickup.id === riderUserId);
}

export function findJoinedDriverId(
  offers: ConvoyOfferRecord[],
  riderUserId: string | null,
): string | null {
  if (!riderUserId) return null;
  for (const offer of offers) {
    if (riderJoinedOffer(offer, riderUserId)) return offer.userId;
  }
  return null;
}

export function applyJoinConvoyOffer(
  offer: ConvoyOfferPayload,
  rider: ConvoyJoinRider,
): ConvoyActionResult {
  if (offer.seatsOpen <= 0) {
    return { ok: false, error: "No seats left on this ride." };
  }
  if (riderJoinedOffer(offer, rider.userId)) {
    return { ok: false, error: "You already requested this ride." };
  }

  const pickup: SeatSharePickup = {
    id: rider.userId,
    label: rider.pickupLabel,
    etaMinutes: rider.etaMinutes ?? 12,
    riderInitials: [riderInitials(rider.name)],
  };

  return {
    ok: true,
    offer: {
      ...offer,
      seatsOpen: Math.max(0, offer.seatsOpen - 1),
      pickups: [...offer.pickups, pickup],
      updatedAt: Date.now(),
    },
  };
}

export function applyAddConvoyPickup(
  offer: ConvoyOfferPayload,
  pickup: SeatSharePickup,
): ConvoyActionResult {
  if (offer.pickups.some((entry) => entry.id === pickup.id)) {
    return { ok: false, error: "That pickup stop is already on this ride." };
  }

  return {
    ok: true,
    offer: {
      ...offer,
      pickups: [...offer.pickups, pickup],
      updatedAt: Date.now(),
    },
  };
}

export function mergeConvoyLocationRefresh(
  existing: ConvoyOfferRecord | null | undefined,
  base: ConvoyOfferPayload,
): ConvoyOfferPayload {
  if (!existing) return base;

  return {
    ...base,
    label: existing.label,
    seatsTotal: existing.seatsTotal,
    seatsOpen: existing.seatsOpen,
    costPerHead: existing.costPerHead,
    currency: existing.currency,
    pickups: existing.pickups,
    updatedAt: Date.now(),
  };
}

export function applyJoinSeatShareVehicle(
  state: SeatShareState,
  vehicleId: string,
  rider: ConvoyJoinRider,
): ConvoyActionResult & { state?: SeatShareState } {
  const vehicle = state.vehicles.find((entry) => entry.id === vehicleId);
  if (!vehicle) return { ok: false, error: "Vehicle not found." };
  if (vehicle.driverName === "You") {
    return { ok: false, error: "That is your ride offer." };
  }

  const joined = applyJoinConvoyOffer(
    {
      label: vehicle.label,
      driverName: vehicle.driverName,
      seatsTotal: vehicle.seatsTotal,
      seatsOpen: vehicle.seatsOpen,
      costPerHead: vehicle.costPerHead,
      currency: vehicle.currency,
      routeLabel: vehicle.routeLabel,
      destinationName: state.destinationName,
      pickups: vehicle.pickups,
      lat: null,
      lng: null,
      updatedAt: Date.now(),
    },
    rider,
  );

  if (!joined.ok) return joined;

  const nextVehicle: SeatShareVehicle = {
    ...vehicle,
    seatsOpen: joined.offer.seatsOpen,
    pickups: joined.offer.pickups,
  };

  return {
    ok: true,
    offer: joined.offer,
    state: {
      ...state,
      vehicles: state.vehicles.map((entry) => (entry.id === vehicleId ? nextVehicle : entry)),
    },
  };
}

export function applyAddPickupToSeatShare(
  state: SeatShareState,
  vehicleId: string,
  pickup: SeatSharePickup,
): ConvoyActionResult & { state?: SeatShareState } {
  const vehicle = state.vehicles.find((entry) => entry.id === vehicleId);
  if (!vehicle) return { ok: false, error: "Vehicle not found." };

  const added = applyAddConvoyPickup(
    {
      label: vehicle.label,
      driverName: vehicle.driverName,
      seatsTotal: vehicle.seatsTotal,
      seatsOpen: vehicle.seatsOpen,
      costPerHead: vehicle.costPerHead,
      currency: vehicle.currency,
      routeLabel: vehicle.routeLabel,
      destinationName: state.destinationName,
      pickups: vehicle.pickups,
      lat: null,
      lng: null,
      updatedAt: Date.now(),
    },
    pickup,
  );

  if (!added.ok) return added;

  return {
    ok: true,
    offer: added.offer,
    state: {
      ...state,
      vehicles: state.vehicles.map((entry) =>
        entry.id === vehicleId ? { ...entry, pickups: added.offer.pickups } : entry,
      ),
    },
  };
}

export function ownVehicleId(
  state: SeatShareState,
  currentUserId: string | null,
): string | null {
  if (currentUserId) {
    const match = state.vehicles.find((vehicle) => vehicle.id === currentUserId);
    if (match) return match.id;
  }
  const yours = state.vehicles.find((vehicle) => vehicle.driverName === "You");
  return yours?.id ?? null;
}
