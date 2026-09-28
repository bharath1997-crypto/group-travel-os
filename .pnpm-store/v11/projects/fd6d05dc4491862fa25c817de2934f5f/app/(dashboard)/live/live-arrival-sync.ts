import { off, onValue, ref, set, type Database } from "firebase/database";

export type ArrivalPayload = {
  lat: number;
  lng: number;
  arrivedAt: number;
};

export function tripArrivalsPath(tripId: string): string {
  return `trips/${tripId}/arrivals`;
}

export function tripMemberArrivalPath(tripId: string, userId: string): string {
  return `${tripArrivalsPath(tripId)}/${userId}`;
}

export function subscribeTripArrivals(
  db: Database,
  tripId: string,
  onChange: (data: Record<string, unknown> | null) => void,
): () => void {
  const arrivalRef = ref(db, tripArrivalsPath(tripId));
  const handler = (snapshot: { val: () => Record<string, unknown> | null }) => {
    onChange(snapshot.val());
  };
  onValue(arrivalRef, handler);
  return () => off(arrivalRef, "value", handler);
}

export async function publishTripArrival(
  db: Database,
  tripId: string,
  userId: string,
  payload: ArrivalPayload,
): Promise<void> {
  await set(ref(db, tripMemberArrivalPath(tripId, userId)), payload);
}
