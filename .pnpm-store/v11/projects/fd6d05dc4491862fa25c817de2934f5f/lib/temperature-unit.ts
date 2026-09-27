/** Shared with Settings — keep key stable for user preferences. */
export const TEMP_UNIT_STORAGE_KEY = "travello_temp_unit";

export type TempUnit = "C" | "F";

export function readStoredTempUnit(): TempUnit {
  if (typeof window === "undefined") return "C";
  try {
    const v = window.localStorage.getItem(TEMP_UNIT_STORAGE_KEY);
    if (v === "F" || v === "C") return v;
  } catch {
    /* ignore */
  }
  return "C";
}

export function formatTemp(temp: number, unit: TempUnit): string {
  if (unit === "F") return `${Math.round((temp * 9) / 5 + 32)}°F`;
  return `${Math.round(temp)}°C`;
}
