import { describe, expect, it } from "vitest";
import { buildDefaultConvergeMembers } from "../live-group-converge-mock";
import {
  buildNightFinishedSummary,
  buildSettleOpenedNotice,
  splitActivitiesHref,
  sumTripExpenses,
} from "../live-night-finished";

describe("live-night-finished", () => {
  it("sums trip expenses in one currency", () => {
    expect(
      sumTripExpenses([
        { amount: 120, currency: "USD" },
        { amount: 66, currency: "USD" },
      ])?.total,
    ).toBe(186);
  });

  it("builds a night finished summary from converge members", () => {
    const summary = buildNightFinishedSummary({
      destinationName: "Fulton Kitchen",
      members: buildDefaultConvergeMembers(),
      memberCount: 6,
      expenseTotal: { total: 186, currency: "USD", expenseCount: 4 },
    });

    expect(summary.headline).toContain("of 6");
    expect(summary.totalSpent).toBe(186);
  });

  it("links split activities with trip id when present", () => {
    expect(splitActivitiesHref("abc-123")).toContain("trip_id=abc-123");
  });

  it("formats the settle opened notice", () => {
    const summary = buildNightFinishedSummary({
      destinationName: "Fulton Kitchen",
      members: buildDefaultConvergeMembers(),
      memberCount: 6,
      expenseTotal: { total: 186, currency: "USD", expenseCount: 4 },
    });
    expect(buildSettleOpenedNotice(summary)).toContain("Night wrapped");
    expect(buildSettleOpenedNotice(summary)).toContain("$186");
  });
});
