import type { SeatShareState, SeatShareVehicle } from "./live-seat-share-mock";
import type { ConvoyOfferPayload, ConvoyOfferRecord } from "./live-convoy-types";

export function formatRouteLabel(input: {
  distanceMeters: number | null | undefined;
  durationSeconds: number | null | undefined;
}): string {
  const miles =
    input.distanceMeters != null ? (input.distanceMeters / 1609.34).toFixed(0) : null;
  const minutes =
    input.durationSeconds != null ? Math.max(1, Math.round(input.durationSeconds / 60)) : null;
  if (miles && minutes) return `Direct · ${miles} mi · ${minutes} min`;
  if (miles) return `Direct · ${miles} mi`;
  return "Route ready";
}

export function convoyPayloadToRecord(
  userId: string,
  payload: ConvoyOfferPayload,
): ConvoyOfferRecord {
  return {
    userId,
    label: payload.label,
    driverName: payload.driverName,
    seatsTotal: payload.seatsTotal,
    seatsOpen: payload.seatsOpen,
    costPerHead: payload.costPerHead,
    currency: payload.currency,
    routeLabel: payload.routeLabel,
    destinationName: payload.destinationName,
    pickups: payload.pickups,
    lat: payload.lat,
    lng: payload.lng,
    updatedAt: payload.updatedAt,
  };
}

export function buildYourConvoyOffer(input: {
  userId: string;
  driverName: string;
  destinationName: string;
  routeLabel: string;
  lat: number | null;
  lng: number | null;
  seatsTotal?: number;
  seatsOpen?: number;
  costPerHead?: number;
}): ConvoyOfferPayload {
  return {
    label: "Your ride",
    driverName: input.driverName,
    seatsTotal: input.seatsTotal ?? 4,
    seatsOpen: input.seatsOpen ?? 2,
    costPerHead: input.costPerHead ?? 18,
    currency: "USD",
    routeLabel: input.routeLabel,
    destinationName: input.destinationName,
    pickups: [],
    lat: input.lat,
    lng: input.lng,
    updatedAt: Date.now(),
  };
}

export function parseConvoySnapshot(
  data: Record<string, unknown> | null | undefined,
): ConvoyOfferRecord[] {
  if (!data) return [];

  const offers: ConvoyOfferRecord[] = [];
  for (const [userId, raw] of Object.entries(data)) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const driverName = typeof row.driverName === "string" ? row.driverName : "Driver";
    const label = typeof row.label === "string" ? row.label : driverName;
    offers.push({
      userId,
      label,
      driverName,
      seatsTotal: Number(row.seatsTotal ?? 4),
      seatsOpen: Number(row.seatsOpen ?? 0),
      costPerHead: Number(row.costPerHead ?? 0),
      currency: typeof row.currency === "string" ? row.currency : "USD",
      routeLabel: typeof row.routeLabel === "string" ? row.routeLabel : "On route",
      destinationName:
        typeof row.destinationName === "string" ? row.destinationName : "destination",
      pickups: Array.isArray(row.pickups)
        ? row.pickups
            .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
            .map((pickup, index) => ({
              id: String(pickup.id ?? `pickup-${index}`),
              label: String(pickup.label ?? "Pickup point"),
              etaMinutes: Number(pickup.etaMinutes ?? 10),
              riderInitials: Array.isArray(pickup.riderInitials)
                ? pickup.riderInitials.map(String)
                : undefined,
            }))
        : [],
      lat: row.lat != null ? Number(row.lat) : null,
      lng: row.lng != null ? Number(row.lng) : null,
      updatedAt: Number(row.updatedAt ?? 0),
    });
  }

  return offers.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function convoyOffersToSeatShare(
  offers: ConvoyOfferRecord[],
  destinationName: string,
  currentUserId: string | null,
): SeatShareState {
  const vehicles: SeatShareVehicle[] = offers.map((offer) => ({
    id: offer.userId,
    label: currentUserId === offer.userId ? "Your ride" : offer.label,
    driverName: currentUserId === offer.userId ? "You" : offer.driverName,
    seatsTotal: Math.max(1, offer.seatsTotal),
    seatsOpen: Math.max(0, Math.min(offer.seatsOpen, offer.seatsTotal)),
    costPerHead: offer.costPerHead,
    currency: offer.currency,
    routeLabel: offer.routeLabel,
    pickups: offer.pickups,
  }));

  return {
    destinationName,
    vehicles,
  };
}
