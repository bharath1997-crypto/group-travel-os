import type { ConvoyOfferRecord } from "./live-convoy-types";
import type { SeatShareVehicle } from "./live-seat-share-mock";

export type ConvoyMapPin = {
  id: string;
  driverName: string;
  label: string;
  seatsOpen: number;
  lat: number;
  lng: number;
  isSelf?: boolean;
};

const MOCK_OFFSETS = [
  { lat: 0.004, lng: -0.003 },
  { lat: -0.005, lng: 0.004 },
  { lat: 0.002, lng: 0.006 },
  { lat: -0.003, lng: -0.005 },
];

export function convoyOffersToMapPins(
  offers: ConvoyOfferRecord[],
  currentUserId: string | null,
): ConvoyMapPin[] {
  return offers
    .filter(
      (offer) =>
        offer.lat != null &&
        offer.lng != null &&
        Number.isFinite(offer.lat) &&
        Number.isFinite(offer.lng),
    )
    .map((offer) => ({
      id: offer.userId,
      driverName: offer.driverName,
      label: currentUserId === offer.userId ? "Your ride" : offer.label,
      seatsOpen: Math.max(0, offer.seatsOpen),
      lat: offer.lat as number,
      lng: offer.lng as number,
      isSelf: currentUserId === offer.userId,
    }));
}

export function buildMockConvoyMapPins(input: {
  vehicles: SeatShareVehicle[];
  anchorLat: number;
  anchorLng: number;
}): ConvoyMapPin[] {
  return input.vehicles.map((vehicle, index) => {
    const offset = MOCK_OFFSETS[index % MOCK_OFFSETS.length]!;
    return {
      id: vehicle.id,
      driverName: vehicle.driverName,
      label: vehicle.label,
      seatsOpen: vehicle.seatsOpen,
      lat: input.anchorLat + offset.lat,
      lng: input.anchorLng + offset.lng,
      isSelf: vehicle.driverName === "You",
    };
  });
}
