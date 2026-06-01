export type DateQuickPreset = "today" | "weekend" | "week" | null;

export function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseEventDate(value?: string | null): Date | null {
  if (!value) return null;
  const raw = value.split("T")[0];
  const parsed = new Date(`${raw}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getTodayDate(): string {
  return formatLocalDate(new Date());
}

/** Upcoming Fri–Sun window (includes current weekend if we're on Fri/Sat/Sun). */
export function getWeekendRange(base = new Date()): { start: string; end: string } {
  const day = base.getDay();
  const friday = new Date(base);
  if (day === 6) friday.setDate(base.getDate() - 1);
  else if (day === 0) friday.setDate(base.getDate() - 2);
  else friday.setDate(base.getDate() + (5 - day));

  const sunday = new Date(friday);
  sunday.setDate(friday.getDate() + 2);

  return { start: formatLocalDate(friday), end: formatLocalDate(sunday) };
}

/** Mon–Sun of the current calendar week. */
export function getWeekRange(base = new Date()): { start: string; end: string } {
  const day = base.getDay();
  const monday = new Date(base);
  monday.setDate(base.getDate() - (day === 0 ? 6 : day - 1));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: formatLocalDate(monday), end: formatLocalDate(sunday) };
}

export function isDateInRange(dateStr: string, start: string, end: string): boolean {
  return dateStr >= start && dateStr <= end;
}

/** Infer preset label when user picks a day on the calendar grid. */
export function resolveDatePreset(dateStr: string): DateQuickPreset {
  if (dateStr === getTodayDate()) return "today";
  const { start, end } = getWeekendRange();
  if (isDateInRange(dateStr, start, end)) return "weekend";
  return null;
}

export function matchesExploreDateFilter(
  eventDateRaw: string | null | undefined,
  selectedDate: string | null,
  preset: DateQuickPreset,
): boolean {
  if (!selectedDate && !preset) return true;

  const eventDate = eventDateRaw ? eventDateRaw.split("T")[0] : null;
  if (!eventDate) return !selectedDate && !preset;

  if (preset === "weekend") {
    const { start, end } = getWeekendRange();
    return isDateInRange(eventDate, start, end);
  }
  if (preset === "week") {
    const { start, end } = getWeekRange();
    return isDateInRange(eventDate, start, end);
  }
  if (selectedDate) return eventDate === selectedDate;
  return true;
}
