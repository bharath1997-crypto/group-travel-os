import { apiFetch } from "@/lib/api";
import type { Money } from "./seats-money";

export type SeatsSort = "earliest" | "cheapest" | "rated";
export type SeatsMode = "find" | "offer" | "yours";

export type SeatStop = { seq: number; label: string; lat: number; lon: number };

export type SeatsPerson = {
  id: string;
  name: string;
  username?: string | null;
  verified: boolean;
  profile_public?: boolean;
};

export type SeatRideVehicle = {
  make?: string | null;
  model?: string | null;
  body_type?: string | null;
  display?: string | null;
};

export type SeatRideCard = {
  id: string;
  depart_at: string;
  arrive_est_at?: string | null;
  board_seq?: number;
  alight_seq?: number;
  seats_offered: number;
  seats_free: number;
  approval: "instant" | "manual";
  price_per_seat: Money;
  note?: string | null;
  route_summary?: string | null;
  vehicle?: SeatRideVehicle | null;
  driver: SeatsPerson & {
    rating: string;
    ride_count?: number;
  };
  stops: SeatStop[];
};

export type CostPreview = {
  cost_basis: Record<string, unknown>;
  cost_total: Money;
  max_per_seat: Money;
  distance_km: number;
};

export type SeatsMe = {
  driving: Array<{
    ride_id: string;
    depart_at: string;
    status: string;
    seats_free: number;
    pending_count: number;
  }>;
  riding: Array<{
    booking_id: string;
    status: string;
    seats: number;
    price_total: Money;
    driver: SeatsPerson;
    ride: { id: string; depart_at: string; stops: Array<{ label: string }> };
  }>;
  history_driving: Array<{
    ride_id: string;
    depart_at: string;
    status: string;
    stops: Array<{ label: string }>;
  }>;
  history_riding: Array<{
    booking_id: string;
    status: string;
    seats: number;
    price_total: Money;
    driver: SeatsPerson;
    ride: { id: string; depart_at: string; stops: Array<{ label: string }> };
  }>;
  pending_as_driver: Array<{
    ride_id: string;
    depart_at: string;
    stops: Array<{ label: string }>;
    request_count: number;
    requests: Array<{
      booking_id: string;
      seats: number;
      rider: SeatsPerson;
    }>;
  }>;
  pending_count: number;
  profile_public?: boolean;
};

const DEMO = {
  from_lat: 19.1136,
  from_lon: 72.8697,
  to_lat: 18.5912,
  to_lon: 73.7389,
};

export async function searchSeats(params: {
  from_lat: number;
  from_lon: number;
  to_lat: number;
  to_lon: number;
  date: string;
  seats: number;
  sort: SeatsSort;
}): Promise<SeatRideCard[]> {
  const qs = new URLSearchParams({
    from_lat: String(params.from_lat),
    from_lon: String(params.from_lon),
    to_lat: String(params.to_lat),
    to_lon: String(params.to_lon),
    date: params.date,
    seats: String(params.seats),
    sort: params.sort,
  });
  return apiFetch<SeatRideCard[]>(`/seats/rides?${qs}`);
}

export async function previewRideCost(body: {
  stops: Array<{ label: string; lat: number; lon: number }>;
  mileage_kmpl: number;
  seats_offered: number;
  tolls_paise?: number | null;
}): Promise<CostPreview> {
  return apiFetch<CostPreview>("/seats/rides/00000000-0000-0000-0000-000000000000/cost", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export type PublishRideBody = Record<string, unknown> & {
  stops: Array<{ label: string; lat: number; lon: number }>;
  route_geometry?: [number, number][];
  route_distance_meters?: number;
  vehicle_body_type?: string;
};

export async function publishRide(body: PublishRideBody): Promise<{ id: string }> {
  return apiFetch<{ id: string }>("/seats/rides", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function bookSeat(
  rideId: string,
  body: { seats: number; board_seq: number; alight_seq: number },
): Promise<{ id: string; status: string }> {
  return apiFetch(`/seats/rides/${rideId}/bookings`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function fetchSeatsMe(): Promise<SeatsMe> {
  return apiFetch<SeatsMe>("/seats/me");
}

export async function decideBooking(
  bookingId: string,
  action: "approve" | "decline" | "withdraw",
): Promise<void> {
  await apiFetch(`/seats/bookings/${bookingId}`, {
    method: "PATCH",
    body: JSON.stringify({ action }),
  });
}

export type SeatRouteWatch = {
  id: string;
  from_lat: number;
  from_lon: number;
  to_lat: number;
  to_lon: number;
  from_label: string | null;
  to_label: string | null;
  date_from: string | null;
  date_to: string | null;
  seats: number;
  active: boolean;
  last_alert_at: string | null;
  created_at: string;
};

export async function fetchSeatsWatches(): Promise<SeatRouteWatch[]> {
  return apiFetch<SeatRouteWatch[]>("/seats/watches");
}

export async function fetchSeatsWatchAlerts(): Promise<{
  unread_alerts: number;
  active_watches: number;
}> {
  return apiFetch("/seats/watches/unread-alerts");
}

export async function createRouteWatch(body: {
  from_lat: number;
  from_lon: number;
  to_lat: number;
  to_lon: number;
  from_label?: string | null;
  to_label?: string | null;
  date_from?: string;
  seats: number;
}): Promise<{ id: string }> {
  return apiFetch("/seats/watches", { method: "POST", body: JSON.stringify(body) });
}

export async function deleteRouteWatch(watchId: string): Promise<void> {
  await apiFetch(`/seats/watches/${watchId}`, { method: "DELETE" });
}

export async function cancelPublishedRide(rideId: string): Promise<{ id: string; status: string }> {
  return apiFetch(`/seats/rides/${rideId}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "cancelled" }),
  });
}

export { DEMO };
