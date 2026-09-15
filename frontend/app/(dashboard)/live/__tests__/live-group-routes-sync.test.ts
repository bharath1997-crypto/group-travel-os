import { describe, expect, it } from "vitest";

import { buildGroupConvergeRoutes } from "../live-group-routes-sync";

describe("live-group-routes-sync", () => {
  it("builds self and friend segments toward the destination", () => {
    const routes = buildGroupConvergeRoutes(
      [
        {
          userId: "friend-ana",
          name: "Ana",
          lat: 41.93,
          lng: -87.72,
          lastSeenAt: new Date().toISOString(),
          status: "active",
        },
      ],
      { lat: 41.92, lng: -87.71 },
      { lat: 41.925, lng: -87.715 },
    );

    expect(routes).toHaveLength(2);
    expect(routes[0]?.userId).toBe("you");
    expect(routes[0]?.to).toEqual({ lat: 41.92, lng: -87.71 });
    expect(routes[1]?.userId).toBe("friend-ana");
    expect(routes[1]?.from).toEqual({ lat: 41.93, lng: -87.72 });
  });

  it("returns friend-only segments when self location is missing", () => {
    const routes = buildGroupConvergeRoutes(
      [
        {
          userId: "friend-tomas",
          name: "Tomas",
          lat: 41.91,
          lng: -87.7,
          lastSeenAt: new Date().toISOString(),
          status: "active",
        },
      ],
      { lat: 41.92, lng: -87.71 },
      null,
    );

    expect(routes).toHaveLength(1);
    expect(routes[0]?.userId).toBe("friend-tomas");
  });
});
