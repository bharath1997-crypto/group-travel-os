import { fetchLiveRoute, type FetchRouteResult } from "@/app/(dashboard)/live/live-routing";
import type { LocationPoint } from "./seats-location";
import { buildSeatShareRouteOptions, type RouteOption } from "./seats-route";

export type SeatShareRoutesResult = {
  options: RouteOption[];
  error?: string;
};

export async function fetchSeatShareDriveRoutes(
  from: LocationPoint,
  to: LocationPoint,
): Promise<SeatShareRoutesResult> {
  const raw: FetchRouteResult = await fetchLiveRoute(
    { lat: from.lat, lng: from.lng },
    { lat: to.lat, lng: to.lng },
    "Drive",
    false,
    from.source === "gps_confirmed" ? "gps" : "search",
    {
      destinationName: to.address || null,
    },
  );

  if (raw.error && !raw.route) {
    return { options: [], error: raw.error };
  }

  const options = buildSeatShareRouteOptions(raw);
  if (options.length === 0) {
    return { options: [], error: raw.error || "No drivable route found." };
  }

  return { options, error: raw.error };
}
