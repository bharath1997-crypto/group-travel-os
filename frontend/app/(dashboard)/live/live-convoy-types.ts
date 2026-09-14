import type { SeatSharePickup } from "./live-seat-share-mock";

export type ConvoyOfferPayload = {
  label: string;
  driverName: string;
  seatsTotal: number;
  seatsOpen: number;
  costPerHead: number;
  currency: string;
  routeLabel: string;
  destinationName: string;
  pickups: SeatSharePickup[];
  lat: number | null;
  lng: number | null;
  updatedAt: number;
};

export type ConvoyOfferRecord = ConvoyOfferPayload & {
  userId: string;
};
