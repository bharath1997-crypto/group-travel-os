import { expect } from "vitest";

import { dateRangeForWhen } from "../explore-hub-dates";

export function activeWhenDateFrom(when: string): string {
  const from = dateRangeForWhen(when).dateFrom;
  if (!from) {
    throw new Error(`dateRangeForWhen("${when}") did not return dateFrom`);
  }
  return from;
}

export function offsetIsoDate(isoDate: string, offsetDays: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(y!, m! - 1, d!);
  dt.setDate(dt.getDate() + offsetDays);
  const month = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${dt.getFullYear()}-${month}-${day}`;
}

/** Same calendar anchor production predicates use (no stale fixed clock). */
export function dateInWhenRange(when: string, offsetDays = 0): string {
  return offsetIsoDate(activeWhenDateFrom(when), offsetDays);
}

/** Ensures fixtures stay tied to live Tonight range when the calendar rolls. */
export function expectFixturesAlignedWithTonightRange(): void {
  const tonightFrom = dateRangeForWhen("Tonight").dateFrom!;
  expect(dateInWhenRange("Tonight", 0)).toBe(tonightFrom);
  expect(tonightFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
}
