/** Map Explore "When" chips to API date_from / date_to (local calendar, YYYY-MM-DD). */

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function formatIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function dateRangeForWhen(when: string, now = new Date()): { dateFrom?: string; dateTo?: string } {
  const label = when.trim().toLowerCase();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (label === "tonight" || label === "today") {
    const iso = formatIsoDate(start);
    return { dateFrom: iso, dateTo: iso };
  }

  if (label === "tomorrow") {
    const t = new Date(start);
    t.setDate(t.getDate() + 1);
    const iso = formatIsoDate(t);
    return { dateFrom: iso, dateTo: iso };
  }

  if (label.includes("weekend")) {
    const end = new Date(start);
    end.setDate(start.getDate() + ((6 - start.getDay() + 7) % 7));
    return { dateFrom: formatIsoDate(start), dateTo: formatIsoDate(end) };
  }

  if (label.includes("next week")) {
    const day = start.getDay();
    const daysUntilNextMonday = ((8 - day) % 7) || 7;
    const monday = new Date(start);
    monday.setDate(start.getDate() + daysUntilNextMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { dateFrom: formatIsoDate(monday), dateTo: formatIsoDate(sunday) };
  }

  return {};
}

export function eventMatchesWhenRange(eventDate: string, when: string): boolean {
  const range = dateRangeForWhen(when);
  if (!range.dateFrom || !range.dateTo) return true;
  const day = (eventDate || "").split("T")[0]?.slice(0, 10);
  if (!day || day.length < 10) return true;
  return day >= range.dateFrom && day <= range.dateTo;
}

/** Hub calendar strip: loaded event window (client-side day pick stays within this pool). */
export function calendarStripDateRange(now = new Date(), days = 14): { dateFrom: string; dateTo: string } {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + Math.max(1, days) - 1);
  return { dateFrom: formatIsoDate(start), dateTo: formatIsoDate(end) };
}

function minIsoDate(a: string, b: string): string {
  return a <= b ? a : b;
}

function maxIsoDate(a: string, b: string): string {
  return a >= b ? a : b;
}

/** Widen API event fetch so the calendar strip can show per-day counts. */
export function mergeWithCalendarFetchRange(
  whenRange: { dateFrom?: string; dateTo?: string },
  calendarRange = calendarStripDateRange(),
): { dateFrom: string; dateTo: string } {
  const from = whenRange.dateFrom
    ? minIsoDate(whenRange.dateFrom, calendarRange.dateFrom)
    : calendarRange.dateFrom;
  const to = whenRange.dateTo ? maxIsoDate(whenRange.dateTo, calendarRange.dateTo) : calendarRange.dateTo;
  return { dateFrom: from, dateTo: to };
}

export function isoDatesInRange(dateFrom: string, dateTo: string): string[] {
  const out: string[] = [];
  const cur = new Date(`${dateFrom}T12:00:00`);
  const end = new Date(`${dateTo}T12:00:00`);
  while (cur <= end) {
    out.push(formatIsoDate(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}
