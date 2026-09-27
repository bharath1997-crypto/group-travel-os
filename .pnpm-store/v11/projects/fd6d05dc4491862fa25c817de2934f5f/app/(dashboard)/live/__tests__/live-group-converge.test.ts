import { describe, expect, it } from "vitest";
import {
  buildConvergeMembers,
  buildConvergeStatusNotice,
  initialsFromName,
  parseTripLocationsSnapshot,
  resolveLocationStatus,
  wayraNoticeFromAlert,
} from "../live-group-converge";

describe("live-group-converge", () => {
  it("parses RTDB location snapshots", () => {
    const now = Date.now();
    const locations = parseTripLocationsSnapshot(
      {
        "user-1": {
          lat: 41.88,
          lng: -87.63,
          updatedAt: now - 30_000,
          speedMps: 10,
          name: "Ana",
        },
      },
      now,
    );

    expect(locations).toHaveLength(1);
    expect(locations[0]?.userId).toBe("user-1");
    expect(locations[0]?.status).toBe("active");
  });

  it("marks stale locations after four minutes", () => {
    const now = Date.now();
    expect(resolveLocationStatus(now - 5 * 60_000, now)).toBe("stale");
  });

  it("builds converge members from roster and ETAs", () => {
    const members = buildConvergeMembers({
      roster: [
        { userId: "you", fullName: "Jordan Miles", avatarUrl: null },
        { userId: "ana", fullName: "Ana Ruiz", avatarUrl: null },
      ],
      locations: [
        {
          userId: "ana",
          lat: 41.881,
          lng: -87.631,
          updatedAt: Date.now(),
          status: "active",
          speedMps: 8,
        },
      ],
      currentUserId: "you",
      currentUserName: "Jordan Miles",
      yourRouteDurationSeconds: 360,
      memberEtas: { ana: 8 },
      destination: { lat: 41.89, lng: -87.62 },
      travelMode: "Drive",
    });

    expect(members[0]?.isSelf).toBe(true);
    expect(members.some((member) => member.name === "Ana Ruiz")).toBe(true);
  });

  it("creates initials from names", () => {
    expect(initialsFromName("Ana Ruiz")).toBe("AR");
  });

  it("maps Wayra alerts into converge notice cards", () => {
    expect(wayraNoticeFromAlert("Tomas is 14 min behind everyone else.")?.headline).toContain(
      "Tomas",
    );
  });

  it("builds members from RTDB locations when roster is still loading", () => {
    const members = buildConvergeMembers({
      roster: [],
      locations: [
        {
          userId: "you",
          lat: 41.88,
          lng: -87.63,
          updatedAt: Date.now(),
          status: "active",
          speedMps: 10,
          name: "Jordan Miles",
        },
        {
          userId: "ana",
          lat: 41.881,
          lng: -87.631,
          updatedAt: Date.now(),
          status: "active",
          speedMps: 8,
          name: "Ana Ruiz",
        },
      ],
      currentUserId: "you",
      currentUserName: "Jordan Miles",
      yourRouteDurationSeconds: 360,
      memberEtas: { ana: 8 },
      destination: { lat: 41.89, lng: -87.62 },
      travelMode: "Drive",
    });

    expect(members.some((member) => member.name === "You")).toBe(true);
    expect(members.some((member) => member.name === "Ana Ruiz")).toBe(true);
  });

  it("prefers Wayra alert copy for the converge status notice", () => {
    expect(
      buildConvergeStatusNotice({
        members: [],
        wayraAlert: "Tomas is 14 min behind everyone else.",
      }),
    ).toContain("Tomas");
  });

  it("describes a late member when no Wayra alert is available", () => {
    expect(
      buildConvergeStatusNotice({
        members: [
          {
            id: "tomas",
            name: "Tomas",
            initials: "TK",
            avatarClassName: "",
            ringClassName: "",
            detail: "driving · 2.1 mi · running late",
            etaMinutes: 22,
            etaLabel: "22 min",
            status: "late",
          },
        ],
      }),
    ).toBe("Tomas is running late · 22 min");
  });
});
