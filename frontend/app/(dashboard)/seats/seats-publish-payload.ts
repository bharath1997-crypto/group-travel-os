import type { LocationPoint } from "./seats-location";
import type { RouteOption } from "./seats-route";
import type { SeatShareVehicleType } from "./seats-vehicle";
import { mileageForVehicleType } from "./seats-vehicle";

const METERS_PER_MILE = 1609.344;

export function buildPublishRideStops(from: LocationPoint, to: LocationPoint) {
  return [
    { label: from.address || "Pickup", lat: from.lat, lon: from.lng },
    { label: to.address || "Drop-off", lat: to.lat, lon: to.lng },
  ];
}

export type RidePreferences = {
  depart_window_minutes: number;
  luggage: "none" | "small" | "large" | null;
  smoking_allowed: boolean | null;
  pets_allowed: boolean | null;
  quiet_ride: boolean | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_color: string | null;
};

export function buildPublishRidePayload(input: {
  from: LocationPoint;
  to: LocationPoint;
  selectedRoute: RouteOption;
  depart_at: string;
  arrive_est_at: string | null;
  seats_offered: number;
  approval: "instant" | "manual";
  price_per_seat_paise: number;
  vehicle_body_type: SeatShareVehicleType;
  tolls_paise: number | null;
  note: string | null;
  region?: string;
  preferences?: RidePreferences;
  series_id?: string | null;
  /** Return leg: swap pickup and drop-off and walk the same road backwards. */
  reverse?: boolean;
}) {
  const mileage_kmpl = mileageForVehicleType(input.vehicle_body_type);
  const distanceMeters = input.selectedRoute.distanceMiles * METERS_PER_MILE;

  const geometry = input.reverse
    ? [...input.selectedRoute.geometry].reverse()
    : input.selectedRoute.geometry;

  return {
    stops: input.reverse
      ? buildPublishRideStops(input.to, input.from)
      : buildPublishRideStops(input.from, input.to),
    depart_at: input.depart_at,
    arrive_est_at: input.arrive_est_at,
    seats_offered: input.seats_offered,
    visibility: "public" as const,
    approval: input.approval,
    price_per_seat_paise: input.price_per_seat_paise,
    mileage_kmpl,
    vehicle_id: null,
    tolls_paise: input.tolls_paise,
    note: input.note,
    region: input.region ?? "IN-MH",
    route_geometry: geometry,
    route_distance_meters: Math.round(distanceMeters),
    route_distance_miles: input.selectedRoute.distanceMiles,
    vehicle_body_type: input.vehicle_body_type,
    route_option_id: input.selectedRoute.id,
    route_label: input.selectedRoute.label,
    ...(input.preferences ? { preferences: input.preferences } : {}),
    ...(input.series_id ? { series_id: input.series_id } : {}),
  };
}
