/** Minor units (paise/cents) -> editable text such as "470" or "12.50". */
export function minorToMajorText(minor: number): string {
  if (!Number.isFinite(minor) || minor < 0) return "";
  const major = minor / 100;
  return Number.isInteger(major) ? String(major) : major.toFixed(2);
}

/** Editable text -> minor units. Empty, negative or non-numeric input -> null. */
export function majorTextToMinor(text: string): number | null {
  const cleaned = text.trim().replace(/,/g, "");
  if (!/^\d*\.?\d{0,2}$/.test(cleaned) || cleaned === "" || cleaned === ".") return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}
