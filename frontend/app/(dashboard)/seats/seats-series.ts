import { zonedDateTimeToUtc } from "./seats-time";

export const MAX_SERIES_RIDES = 24;
export const MAX_REPEAT_WEEKS = 8;

/** 0 = Sunday ... 6 = Saturday, matching Date.getUTCDay. */
export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export type SeriesInput = {
  /** First outbound date, `YYYY-MM-DD` in the pickup time zone. */
  date: string;
  time: string;
  timeZone: string;
  /** Weekdays to repeat on (0-6). Empty = a single date. */
  repeatDays: number[];
  /** Number of weeks to repeat over, 1..MAX_REPEAT_WEEKS. */
  weeks: number;
  /** Return trip departure time on each date, or null for no return. */
  returnTime: string | null;
};

export type SeriesRide = {
  leg: "outbound" | "return";
  date: string;
  depart: Date;
};

function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function weekday(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** The dates a ride runs on: just `date`, or every chosen weekday for `weeks` weeks. */
export function seriesDates(input: Pick<SeriesInput, "date" | "repeatDays" | "weeks">): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return [];
  if (input.repeatDays.length === 0) return [input.date];
  const weeks = Math.min(Math.max(Math.trunc(input.weeks) || 1, 1), MAX_REPEAT_WEEKS);
  const days = new Set(input.repeatDays);
  const dates: string[] = [];
  for (let i = 0; i < weeks * 7; i += 1) {
    const d = addDays(input.date, i);
    if (days.has(weekday(d))) dates.push(d);
  }
  return dates;
}

/** Every ride to publish, outbound first then its return, oldest date first. */
export function buildSeries(input: SeriesInput): SeriesRide[] {
  const rides: SeriesRide[] = [];
  for (const date of seriesDates(input)) {
    const out = zonedDateTimeToUtc(date, input.time, input.timeZone);
    if (out) rides.push({ leg: "outbound", date, depart: out });
    if (input.returnTime) {
      const back = zonedDateTimeToUtc(date, input.returnTime, input.timeZone);
      if (back) rides.push({ leg: "return", date, depart: back });
    }
  }
  return rides;
}

/** Why the plan cannot be published, or null when it is fine. */
export function seriesProblem(
  input: SeriesInput,
  durationMinutes: number,
): string | null {
  const rides = buildSeries(input);
  if (rides.length === 0) return "Pick at least one valid date.";
  if (rides.length > MAX_SERIES_RIDES) {
    return `That makes ${rides.length} rides; the most you can publish at once is ${MAX_SERIES_RIDES}.`;
  }
  if (input.returnTime) {
    const out = zonedDateTimeToUtc(input.date, input.time, input.timeZone);
    const back = zonedDateTimeToUtc(input.date, input.returnTime, input.timeZone);
    if (out && back && back.getTime() < out.getTime() + durationMinutes * 60_000) {
      return "The return must leave after you arrive.";
    }
  }
  return null;
}

/** GeoJSON-style [lon, lat] pairs in reverse order, for the return leg. */
export function reverseGeometry<T extends number[]>(geometry: T[] | undefined): T[] | undefined {
  return geometry ? [...geometry].reverse() : geometry;
}
