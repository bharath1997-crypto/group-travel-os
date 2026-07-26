import { describe, expect, it } from "vitest";

import {
  buildWayraSessionGreeting,
  formatWayraMessageTime,
  honorificName,
  tripsThisWeek,
} from "@/lib/wayra/messenger";

describe("wayra messenger", () => {
  it("builds honorific from profile name", () => {
    expect(honorificName("Ram Kumar")).toBe("Mr. Kumar");
    expect(honorificName(null)).toBe("there");
  });

  it("finds trips in the current week", () => {
    const now = new Date("2026-07-22T12:00:00");
    const trips = tripsThisWeek(
      [
        {
          title: "Chicago weekend",
          start_date: "2026-07-25",
          destination: "Chicago",
        },
        {
          title: "Next month",
          start_date: "2026-08-10",
        },
      ],
      now,
    );
    expect(trips).toHaveLength(1);
    expect(trips[0]?.title).toBe("Chicago weekend");
  });

  it("builds personalized session greeting", () => {
    const text = buildWayraSessionGreeting({
      fullName: "Ram Kumar",
      trips: [{ title: "Chicago weekend", start_date: "2026-07-25", destination: "Chicago" }],
      placeLabel: "Grant Park",
      onLive: true,
    });
    expect(text).toContain("Mr. Kumar");
    expect(text).toContain("Grant Park");
    expect(text).toContain("Chicago weekend");
    expect(text).toContain("tap +");
  });

  it("formats same-day message time", () => {
    const now = new Date("2026-07-22T15:30:00").getTime();
    const label = formatWayraMessageTime(
      new Date("2026-07-22T09:05:00").getTime(),
      now,
    );
    expect(label).toMatch(/9:05/);
  });
});
