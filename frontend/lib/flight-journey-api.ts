import type {
  FlightCabin,
  FlightJourneySearchResponse,
  FlightSearchParams,
  FlightSearchPassengerPayload,
  FlightSearchSlicePayload,
  MultiCityLeg,
} from "@/lib/flight-types";
import { apiFetch } from "@/lib/api";
import { normalizeFlightSearchParams } from "@/lib/flight-search-params";

/** Duffel offer requests can exceed the default 8s production apiFetch timeout. */
export const FLIGHT_SEARCH_TIMEOUT_MS = 60_000;

const CABIN_TO_API: Record<FlightCabin, string> = {
  M: "economy",
  W: "premium_economy",
  C: "business",
  F: "first",
};

function buildPassengers(params: FlightSearchParams): FlightSearchPassengerPayload[] {
  const passengers: FlightSearchPassengerPayload[] = [];
  for (let i = 0; i < params.adults; i += 1) {
    passengers.push({ type: "adult" });
  }
  for (let i = 0; i < params.children; i += 1) {
    passengers.push({ age: 10 });
  }
  for (let i = 0; i < params.infants; i += 1) {
    passengers.push({ age: 1 });
  }
  return passengers;
}

export function buildFlightSearchRequestBody(rawParams: FlightSearchParams): {
  trip_type: "one_way" | "round_trip" | "multi_city";
  slices: FlightSearchSlicePayload[];
  passengers: FlightSearchPassengerPayload[];
  cabin: string;
  maximum_connections: number;
  strict_connection_limit: boolean;
  flexible_dates: boolean;
  currency: string;
} {
  const params = normalizeFlightSearchParams(rawParams);
  const passengers = buildPassengers(params);
  const maxConnections = params.nonstop ? 0 : (params.maximumConnections ?? 1);
  const strictConnectionLimit = Boolean(
    params.strictConnectionLimit ||
      params.nonstop ||
      (params.maximumConnections != null && params.maximumConnections !== 1),
  );

  const shared = {
    passengers,
    cabin: CABIN_TO_API[params.cabin],
    maximum_connections: maxConnections,
    strict_connection_limit: strictConnectionLimit,
    flexible_dates: Boolean(params.flexibleDates),
    currency: "USD",
  };

  if (params.tripType === "multicity") {
    const allLegs: MultiCityLeg[] = [
      {
        from: params.from,
        to: params.to,
        depart: params.depart,
        departureTimeFrom: params.departureTimeFrom,
        departureTimeTo: params.departureTimeTo,
      },
      ...(params.multiCityLegs || []),
    ].filter((leg) => leg.from && leg.to && leg.depart);

    if (allLegs.length >= 2) {
      const slices: FlightSearchSlicePayload[] = allLegs.map((leg) => ({
        origin: leg.from,
        destination: leg.to,
        departure_date: leg.depart,
        departure_time_from: leg.departureTimeFrom,
        departure_time_to: leg.departureTimeTo,
      }));
      return {
        trip_type: "multi_city",
        slices,
        ...shared,
      };
    }
  }

  const outbound: FlightSearchSlicePayload = {
    origin: params.from,
    destination: params.to,
    departure_date: params.depart,
    departure_time_from: params.departureTimeFrom,
    departure_time_to: params.departureTimeTo,
  };

  if (params.tripType === "roundtrip" || params.return) {
    return {
      trip_type: "round_trip",
      slices: [
        outbound,
        {
          origin: params.to,
          destination: params.from,
          departure_date: params.return || params.depart,
          departure_time_from: params.returnDepartureTimeFrom,
          departure_time_to: params.returnDepartureTimeTo,
        },
      ],
      ...shared,
    };
  }

  return {
    trip_type: "one_way",
    slices: [outbound],
    ...shared,
  };
}

export async function searchFlightJourneys(params: FlightSearchParams): Promise<FlightJourneySearchResponse> {
  const body = buildFlightSearchRequestBody(params);
  return apiFetch<FlightJourneySearchResponse>(
    "/flights/search",
    {
      method: "POST",
      body: JSON.stringify(body),
    },
    FLIGHT_SEARCH_TIMEOUT_MS,
  );
}
