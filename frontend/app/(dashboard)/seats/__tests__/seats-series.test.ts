import { describe, expect, it } from "vitest";
import { buildSeries, MAX_SERIES_RIDES, seriesDates, seriesProblem } from "../seats-series";

const base = {
  date: "2026-12-01", // a Tuesday
  time: "08:00",
  timeZone: "America/Chicago",
  repeatDays: [] as number[],
  weeks: 1,
  returnTime: null as string | null,
};

describe("seriesDates", () => {
  it("is just the date when not repeating", () => {
    expect(seriesDates(base)).toEqual(["2026-12-01"]);
  });
  it("repeats on the chosen weekdays, oldest first", () => {
    // Starts Tuesday Dec 1; Mon/Wed/Fri inside the next 14 days.
    expect(seriesDates({ ...base, repeatDays: [1, 3, 5], weeks: 2 })).toEqual([
      "2026-12-02",
      "2026-12-04",
      "2026-12-07",
      "2026-12-09",
      "2026-12-11",
      "2026-12-14", // the 14-day window starting Tuesday Dec 1 ends on Monday Dec 14
    ]);
  });
  it("clamps weeks to the maximum and ignores bad dates", () => {
    expect(seriesDates({ ...base, repeatDays: [2], weeks: 99 })).toHaveLength(8);
    expect(seriesDates({ ...base, date: "" })).toEqual([]);
  });
});

describe("buildSeries", () => {
  it("adds a return leg on each date", () => {
    const rides = buildSeries({ ...base, repeatDays: [2], weeks: 2, returnTime: "17:00" });
    expect(rides.map((r) => r.leg)).toEqual(["outbound", "return", "outbound", "return"]);
    expect(rides[0].depart.toISOString()).toBe("2026-12-01T14:00:00.000Z");
    expect(rides[1].depart.toISOString()).toBe("2026-12-01T23:00:00.000Z");
  });
});

describe("seriesProblem", () => {
  it("accepts a normal plan", () => {
    expect(seriesProblem({ ...base, returnTime: "17:00" }, 120)).toBeNull();
  });
  it("rejects a return before arrival", () => {
    expect(seriesProblem({ ...base, returnTime: "09:00" }, 120)).toMatch(/after you arrive/);
  });
  it("rejects too many rides", () => {
    const all = [0, 1, 2, 3, 4, 5, 6];
    const msg = seriesProblem({ ...base, repeatDays: all, weeks: 8, returnTime: "17:00" }, 60);
    expect(msg).toContain(String(MAX_SERIES_RIDES));
  });
});
