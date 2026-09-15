import { formatLocalDate } from "@/lib/explore-date-utils";

export type ParsedUsDate = {
  iso: string | null;
  month: number | null;
  day: number | null;
  year: number | null;
  isComplete: boolean;
};

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** Auto-insert slashes while typing: MM/DD/YYYY */
export function formatUsDateTyping(raw: string): string {
  const d = digitsOnly(raw).slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

export function isoToUsDisplay(iso: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const [y, m, d] = iso.split("-");
  return `${m}/${d}/${y}`;
}

function tryBuildIso(year: number, month: number, day: number): string | null {
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return formatLocalDate(d);
}

export function parseUsDateInput(text: string, fallbackYear = new Date().getFullYear()): ParsedUsDate {
  const trimmed = text.trim();
  if (!trimmed) {
    return { iso: null, month: null, day: null, year: null, isComplete: false };
  }

  const parts = trimmed.split("/");
  const monthRaw = parts[0] ?? "";
  const dayRaw = parts[1] ?? "";
  const yearRaw = parts[2] ?? "";

  const month =
    monthRaw.length > 0 && !Number.isNaN(Number.parseInt(monthRaw, 10))
      ? Number.parseInt(monthRaw, 10)
      : null;
  const day =
    dayRaw.length > 0 && !Number.isNaN(Number.parseInt(dayRaw, 10))
      ? Number.parseInt(dayRaw, 10)
      : null;
  const year =
    yearRaw.length > 0 && !Number.isNaN(Number.parseInt(yearRaw, 10))
      ? Number.parseInt(yearRaw, 10)
      : null;

  const validMonth = month !== null && month >= 1 && month <= 12 ? month : null;
  const validDay = day !== null && day >= 1 && day <= 31 ? day : null;
  const validYear = year !== null && yearRaw.length === 4 && year >= 1000 ? year : null;

  if (validMonth && validDay && validYear) {
    const iso = tryBuildIso(validYear, validMonth, validDay);
    if (iso) {
      return {
        iso,
        month: validMonth,
        day: validDay,
        year: validYear,
        isComplete: true,
      };
    }
  }

  return {
    iso: null,
    month: validMonth,
    day: validDay,
    year: validYear ?? (yearRaw.length >= 4 ? year : null),
    isComplete: false,
  };
}

/** Calendar month/day highlight while the user is still typing. */
export function previewIsoFromParsed(parsed: ParsedUsDate, fallbackYear = new Date().getFullYear()): string | null {
  if (parsed.iso) return parsed.iso;
  if (!parsed.month || !parsed.day) return null;
  const year = parsed.year && parsed.year >= 1000 ? parsed.year : fallbackYear;
  return tryBuildIso(year, parsed.month, parsed.day);
}

export function viewDateFromParsed(parsed: ParsedUsDate, fallback = new Date()): Date {
  const year = parsed.year && parsed.year >= 1000 ? parsed.year : fallback.getFullYear();
  const month = parsed.month && parsed.month >= 1 && parsed.month <= 12 ? parsed.month - 1 : fallback.getMonth();
  const day = parsed.day && parsed.day >= 1 && parsed.day <= 31 ? parsed.day : 1;
  return new Date(year, month, day);
}

export function isIsoOnOrAfterMin(iso: string, min?: string): boolean {
  if (!min) return true;
  return iso >= min;
}
