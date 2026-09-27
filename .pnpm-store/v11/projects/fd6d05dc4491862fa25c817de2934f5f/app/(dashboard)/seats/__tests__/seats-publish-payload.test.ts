import { describe, expect, it } from "vitest";
import { buildPublishRidePayload } from "../seats-publish-payload";

describe("buildPublishRidePayload", () => {
  it("includes route geometry and confirmed stops", () => {
    const payload = buildPublishRidePayload({
      from: {
        address: "Andheri East",
        lat: 19.11,
        lng: 72.87,
        isConfirmed: true,
        source: "map_pin",
      },
      to: {
        address: "Pune",
        lat: 18.59,
        lng: 73.74,
        isConfirmed: true,
        source: "autocomplete",
      },
      selectedRoute: {
        id: "primary",
        label: "Primary route",
        distanceMiles: 95,
        durationMinutes: 180,
        geometry: [
          [72.87, 19.11],
          [73.74, 18.59],
        ],
        isEligible: true,
      },
      depart_at: "2026-09-20T05:30:00+05:30",
      arrive_est_at: "2026-09-20T08:30:00+05:30",
      seats_offered: 3,
      approval: "instant",
      price_per_seat_paise: 47000,
      vehicle_body_type: "sedan",
      tolls_paise: null,
      note: "Pickup at gate 2",
    });

    expect(payload.stops).toHaveLength(2);
    expect(payload.stops[0].label).toBe("Andheri East");
    expect(payload.route_geometry).toHaveLength(2);
    expect(payload.route_distance_meters).toBeGreaterThan(0);
    expect(payload.vehicle_body_type).toBe("sedan");
    expect(payload.visibility).toBe("public");
  });
});
