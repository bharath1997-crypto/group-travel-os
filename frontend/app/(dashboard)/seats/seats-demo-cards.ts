import type { SeatRideCard } from "./seats-api";
import { resolveSeatShareCurrency } from "./seats-currency";
import { getSeatsDemoRides } from "./seats-fixtures";
import { formatSeatShareMoney } from "./seats-money";
import { withResolvedCountryCode, type LocationPoint } from "./seats-location";

export function buildDemoSeatRideCards(
  from: LocationPoint,
  to: LocationPoint,
): SeatRideCard[] {
  const currency = resolveSeatShareCurrency(
    withResolvedCountryCode(from),
    withResolvedCountryCode(to),
  );
  const demos = getSeatsDemoRides(currency);

  return demos.map((r, i) => ({
    id: r.id,
    depart_at: `2026-09-18T${r.departTime}:00${r.tzOffset}`,
    arrive_est_at: `2026-09-18T${r.arriveTime}:00${r.tzOffset}`,
    board_seq: 0,
    alight_seq: 2,
    seats_offered: r.seatsTotal,
    seats_free: r.seatsFree,
    approval: r.cta === "book" ? "instant" : "manual",
    price_per_seat: formatSeatShareMoney(r.priceMinor, currency),
    note: r.note,
    driver: {
      id: `d-${i}`,
      name: r.driverName,
      verified: r.driverVerified,
      profile_public: r.driverVerified,
      rating: r.rating,
      ride_count: parseInt(r.rideCount, 10) || 0,
    },
    vehicle: { display: r.vehicleLabel, body_type: r.vehicleBodyType },
    route_summary: r.routeMeta,
    stops: [
      { seq: 0, label: r.departPlace, lat: r.fromLat, lon: r.fromLon },
      { seq: 2, label: r.arrivePlace, lat: r.toLat, lon: r.toLon },
    ],
  }));
}
