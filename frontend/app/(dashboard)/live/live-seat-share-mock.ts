export type SeatSharePickup = {
  id: string;
  label: string;
  etaMinutes: number;
  riderInitials?: string[];
};

export type SeatShareVehicle = {
  id: string;
  label: string;
  driverName: string;
  seatsTotal: number;
  seatsOpen: number;
  costPerHead: number;
  currency: string;
  routeLabel: string;
  pickups: SeatSharePickup[];
};

export type SeatShareState = {
  destinationName: string;
  vehicles: SeatShareVehicle[];
};

export function buildDefaultSeatShare(destinationName = "your destination"): SeatShareState {
  return {
    destinationName,
    vehicles: [
      {
        id: "suv-you",
        label: "Your SUV",
        driverName: "You",
        seatsTotal: 4,
        seatsOpen: 2,
        costPerHead: 18,
        currency: "USD",
        routeLabel: "Loop · 18 mi",
        pickups: [
          { id: "p1", label: "Milwaukee Ave & Damen", etaMinutes: 6, riderInitials: ["AR"] },
          { id: "p2", label: "Western Blue Line", etaMinutes: 11 },
        ],
      },
      {
        id: "van-tomas",
        label: "Tomas · minivan",
        driverName: "Tomas",
        seatsTotal: 6,
        seatsOpen: 1,
        costPerHead: 14,
        currency: "USD",
        routeLabel: "Direct · 22 mi",
        pickups: [{ id: "p3", label: "Ogden & Ashland", etaMinutes: 9, riderInitials: ["JP", "SM"] }],
      },
    ],
  };
}

export function seatShareOpenSeats(state: SeatShareState): number {
  return state.vehicles.reduce((sum, vehicle) => sum + vehicle.seatsOpen, 0);
}

export function buildSeatShareOpenedNotice(
  openSeats: number,
  destinationName: string,
): string {
  const destination = destinationName.trim() || "your destination";
  if (openSeats <= 0) {
    return `Seat Share live to ${destination} — broadcast seats to get riders`;
  }
  return `${openSeats} seat${openSeats === 1 ? "" : "s"} open to ${destination}`;
}
