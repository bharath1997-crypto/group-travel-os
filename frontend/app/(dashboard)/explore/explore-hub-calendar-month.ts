/** Explore "Select the date" month calendar: pure month math + grid cells (no React, no DOM). */

import { formatIsoDate } from "./explore-hub-dates";
import type { ExploreCalendarDaySummary } from "./explore-hub-time-scope";

export type ExploreCalendarMonth = { year: number; month: number }; // month 0–11

export type ExploreCalendarMonthCell = {
  iso: string;
  dayNum: number;
  /** Before today (local) — never selectable. */
  isPast: boolean;
  isToday: boolean;
  /** Dated events loaded for this day in the active location pool. */
  eventCount: number;
  /** Day falls inside the loaded events window, so a 0 count is a real 0. */
  loaded: boolean;
};

const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const EXPLORE_CALENDAR_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function currentCalendarMonth(now = new Date()): ExploreCalendarMonth {
  return { year: now.getFullYear(), month: now.getMonth() };
}

export function calendarMonthFromIso(iso: string): ExploreCalendarMonth {
  const d = new Date(`${iso}T12:00:00`);
  return { year: d.getFullYear(), month: d.getMonth() };
}

export function shiftCalendarMonth(m: ExploreCalendarMonth, deltaMonths: number): ExploreCalendarMonth {
  const d = new Date(m.year, m.month + deltaMonths, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

export function calendarMonthKey(m: ExploreCalendarMonth): string {
  return `${m.year}-${String(m.month + 1).padStart(2, "0")}`;
}

export function calendarMonthLabel(m: ExploreCalendarMonth): string {
  return `${MONTH_LABELS[m.month] ?? ""} ${m.year}`;
}

/** Full calendar month, YYYY-MM-DD inclusive. */
export function calendarMonthRange(m: ExploreCalendarMonth): { dateFrom: string; dateTo: string } {
  const first = new Date(m.year, m.month, 1);
  const last = new Date(m.year, m.month + 1, 0);
  return { dateFrom: formatIsoDate(first), dateTo: formatIsoDate(last) };
}

export function isCurrentOrFutureMonth(m: ExploreCalendarMonth, now = new Date()): boolean {
  const cur = currentCalendarMonth(now);
  return m.year > cur.year || (m.year === cur.year && m.month >= cur.month);
}

/** Past months hold no inventory (providers purge ended events), so navigation stops at this month. */
export function canShiftCalendarMonth(
  m: ExploreCalendarMonth,
  deltaMonths: number,
  now = new Date(),
): boolean {
  return isCurrentOrFutureMonth(shiftCalendarMonth(m, deltaMonths), now);
}

/**
 * Window the calendar asks `/explore/events/calendar` to count: the open month clipped to today
 * (past days are never fetched), at least `minDays` ahead, and always covering an already picked day.
 */
export function calendarFetchDateRange(
  m: ExploreCalendarMonth,
  selectedDayIso: string | null = null,
  now = new Date(),
  minDays = 1,
): { dateFrom: string; dateTo: string } {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayIso = formatIsoDate(today);
  const floor = new Date(today);
  floor.setDate(floor.getDate() + Math.max(1, minDays) - 1);
  const month = calendarMonthRange(m);
  let dateFrom = month.dateFrom < todayIso ? todayIso : month.dateFrom;
  let dateTo = month.dateTo;
  const floorIso = formatIsoDate(floor);
  if (dateTo < floorIso) dateTo = floorIso;
  if (selectedDayIso && selectedDayIso >= todayIso) {
    if (selectedDayIso < dateFrom) dateFrom = selectedDayIso;
    if (selectedDayIso > dateTo) dateTo = selectedDayIso;
  }
  return { dateFrom, dateTo };
}

/** Client-side fallback: per-day counts from the loaded hub pool (`buildCalendarDaySummaries`). */
export function dayCountsFromSummaries(summaries: ExploreCalendarDaySummary[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of summaries) if (s.eventCount > 0) out[s.iso] = s.eventCount;
  return out;
}

/**
 * Sunday-first month grid. `null` cells pad the first week so day numbers sit under their weekday.
 * `countsByIso` comes from `/explore/events/calendar` (SQL counts) or `dayCountsFromSummaries`.
 */
export function buildCalendarMonthGrid(
  m: ExploreCalendarMonth,
  countsByIso: Record<string, number>,
  loadedRange: { dateFrom: string; dateTo: string } | null,
  now = new Date(),
): Array<ExploreCalendarMonthCell | null> {
  const todayIso = formatIsoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
  const countByIso = new Map(Object.entries(countsByIso));
  const first = new Date(m.year, m.month, 1);
  const daysInMonth = new Date(m.year, m.month + 1, 0).getDate();
  const cells: Array<ExploreCalendarMonthCell | null> = [];
  for (let i = 0; i < first.getDay(); i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    const iso = formatIsoDate(new Date(m.year, m.month, day));
    const loaded = Boolean(loadedRange && iso >= loadedRange.dateFrom && iso <= loadedRange.dateTo);
    cells.push({
      iso,
      dayNum: day,
      isPast: iso < todayIso,
      isToday: iso === todayIso,
      eventCount: countByIso.get(iso) ?? 0,
      loaded,
    });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/**
 * Events window the hub feed loads once a day is picked: exactly that day. The When chips are
 * inactive while a day is selected, and a single day never hits the feed's page cap.
 */
export function hubFetchRangeForSelectedDay(selectedDayIso: string | null): { dateFrom: string; dateTo: string } | undefined {
  if (!selectedDayIso) return undefined;
  return { dateFrom: selectedDayIso, dateTo: selectedDayIso };
}

export function calendarCellSelectable(cell: ExploreCalendarMonthCell): boolean {
  return !cell.isPast && cell.eventCount > 0;
}

export function totalCalendarMonthEvents(cells: Array<ExploreCalendarMonthCell | null>): number {
  return cells.reduce((sum, c) => sum + (c && !c.isPast ? c.eventCount : 0), 0);
}

/** Short chip label once a day is picked, e.g. "Wed, Oct 21". */
export function formatCalendarChipLabel(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  const weekday = EXPLORE_CALENDAR_WEEKDAYS[d.getDay()] ?? "";
  const month = (MONTH_LABELS[d.getMonth()] ?? "").slice(0, 3);
  return `${weekday}, ${month} ${d.getDate()}`;
}
