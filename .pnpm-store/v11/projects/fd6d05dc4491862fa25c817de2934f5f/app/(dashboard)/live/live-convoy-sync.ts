import { off, onValue, ref, runTransaction, set, type Database } from "firebase/database";
import { applyAddConvoyPickup, applyJoinConvoyOffer, type ConvoyJoinRider } from "./live-convoy-actions";
import type { ConvoyOfferPayload } from "./live-convoy-types";
import type { SeatSharePickup } from "./live-seat-share-mock";

export function tripConvoyPath(tripId: string): string {
  return `trips/${tripId}/convoy`;
}

export function tripConvoyOfferPath(tripId: string, userId: string): string {
  return `${tripConvoyPath(tripId)}/${userId}`;
}

export function subscribeTripConvoy(
  db: Database,
  tripId: string,
  onChange: (data: Record<string, unknown> | null) => void,
): () => void {
  const convoyRef = ref(db, tripConvoyPath(tripId));
  const handler = (snapshot: { val: () => Record<string, unknown> | null }) => {
    onChange(snapshot.val());
  };
  onValue(convoyRef, handler);
  return () => off(convoyRef, "value", handler);
}

export async function publishConvoyOffer(
  db: Database,
  tripId: string,
  userId: string,
  payload: ConvoyOfferPayload,
): Promise<void> {
  await set(ref(db, tripConvoyOfferPath(tripId, userId)), payload);
}

function parseConvoyOfferPayload(raw: unknown): ConvoyOfferPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  return {
    label: typeof row.label === "string" ? row.label : "Driver",
    driverName: typeof row.driverName === "string" ? row.driverName : "Driver",
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
    updatedAt: Number(row.updatedAt ?? Date.now()),
  };
}

export async function transactionJoinConvoySeat(
  db: Database,
  tripId: string,
  driverUserId: string,
  rider: ConvoyJoinRider,
): Promise<{ ok: boolean; error?: string }> {
  const offerRef = ref(db, tripConvoyOfferPath(tripId, driverUserId));
  let failure: string | undefined;

  await runTransaction(offerRef, (current) => {
    const offer = parseConvoyOfferPayload(current);
    if (!offer) {
      failure = "Driver offer is no longer available.";
      return;
    }

    const result = applyJoinConvoyOffer(offer, rider);
    if (!result.ok) {
      failure = result.error;
      return;
    }

    return result.offer;
  });

  return failure ? { ok: false, error: failure } : { ok: true };
}

export async function transactionAddConvoyPickup(
  db: Database,
  tripId: string,
  driverUserId: string,
  pickup: SeatSharePickup,
): Promise<{ ok: boolean; error?: string }> {
  const offerRef = ref(db, tripConvoyOfferPath(tripId, driverUserId));
  let failure: string | undefined;

  await runTransaction(offerRef, (current) => {
    const offer = parseConvoyOfferPayload(current);
    if (!offer) {
      failure = "Could not update this ride.";
      return;
    }

    const result = applyAddConvoyPickup(offer, pickup);
    if (!result.ok) {
      failure = result.error;
      return;
    }

    return result.offer;
  });

  return failure ? { ok: false, error: failure } : { ok: true };
}
