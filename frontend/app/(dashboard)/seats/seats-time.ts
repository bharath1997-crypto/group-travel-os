import { resolveCountryCodeForPoint, type CurrencyLocationInput } from "./seats-currency";

/** Offset (ms) of `timeZone` from UTC at the instant `ts`. */
function zoneOffsetMs(ts: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(ts));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return asUtc - Math.floor(ts / 1000) * 1000;
}

/** Wall-clock `YYYY-MM-DD` + `HH:mm` in `timeZone` -> the real instant. Invalid input -> null. */
export function zonedDateTimeToUtc(date: string, time: string, timeZone: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const t = /^(\d{2}):(\d{2})$/.exec(time);
  if (!m || !t) return null;
  const guess = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(t[1]), Number(t[2]));
  try {
    let result = guess - zoneOffsetMs(guess, timeZone);
    // Re-check once: the offset can differ at the corrected instant (DST edges).
    result = guess - zoneOffsetMs(result, timeZone);
    return new Date(result);
  } catch {
    return null;
  }
}

/** Time zone for the pickup: India is fixed; elsewhere use the driver's device zone. */
export function resolveOfferTimeZone(from: CurrencyLocationInput): string {
  if (resolveCountryCodeForPoint(from) === "IN") return "Asia/Kolkata";
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** True when the departure is at least `minLeadMinutes` after `now`. */
export function isFutureDeparture(
  date: string,
  time: string,
  timeZone: string,
  now: Date = new Date(),
  minLeadMinutes = 15,
): boolean {
  const at = zonedDateTimeToUtc(date, time, timeZone);
  if (!at) return false;
  return at.getTime() >= now.getTime() + minLeadMinutes * 60_000;
}

/** Today as `YYYY-MM-DD` in `timeZone` (for the date input's min). */
export function todayInZone(timeZone: string, now: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}
