import { off, onValue, ref, set, type Database } from "firebase/database";
import type { LiveGroupLocationPayload } from "./live-group-location-types";

export function tripLocationsPath(tripId: string): string {
  return `trips/${tripId}/locations`;
}

export function tripMemberLocationPath(tripId: string, userId: string): string {
  return `${tripLocationsPath(tripId)}/${userId}`;
}

export function subscribeTripLocations(
  db: Database,
  tripId: string,
  onChange: (data: Record<string, unknown> | null) => void,
): () => void {
  const locationRef = ref(db, tripLocationsPath(tripId));
  const handler = (snapshot: { val: () => Record<string, unknown> | null }) => {
    onChange(snapshot.val());
  };
  onValue(locationRef, handler);
  return () => off(locationRef, "value", handler);
}

export async function publishTripMemberLocation(
  db: Database,
  tripId: string,
  userId: string,
  payload: LiveGroupLocationPayload,
): Promise<void> {
  await set(ref(db, tripMemberLocationPath(tripId, userId)), payload);
}
