/** OSM capital admin levels — keep in sync with app/services/live_capital_level.py */

export const CAPITAL_LEVEL_NATIONAL = 2;
export const CAPITAL_LEVEL_STATE_PROVINCE = 4;
export const CAPITAL_LEVEL_DISTRICT = 6;
export const CAPITAL_LEVEL_MUNICIPAL = 8;

export type CapitalLevel =
  | typeof CAPITAL_LEVEL_NATIONAL
  | typeof CAPITAL_LEVEL_STATE_PROVINCE
  | typeof CAPITAL_LEVEL_DISTRICT
  | typeof CAPITAL_LEVEL_MUNICIPAL;

export function parseOsmCapitalLevel(tags: Record<string, unknown> | undefined): CapitalLevel | null {
  if (!tags) return null;
  const raw = tags.capital;
  if (raw == null) return null;
  const text = String(raw).trim().toLowerCase();
  if (text === "yes" || text === "true" || text === "1") return CAPITAL_LEVEL_NATIONAL;
  const level = Number.parseInt(text, 10);
  if (Number.isNaN(level)) return null;
  if (level === 2 || level === 4 || level === 6 || level === 8) return level as CapitalLevel;
  if (level <= 2) return CAPITAL_LEVEL_NATIONAL;
  if (level <= 4) return CAPITAL_LEVEL_STATE_PROVINCE;
  if (level <= 6) return CAPITAL_LEVEL_DISTRICT;
  return CAPITAL_LEVEL_MUNICIPAL;
}

export function capitalLevelsVisibleAtZoom(zoom: number | null | undefined): Set<CapitalLevel> {
  if (zoom == null || !Number.isFinite(zoom)) {
    return new Set([
      CAPITAL_LEVEL_NATIONAL,
      CAPITAL_LEVEL_STATE_PROVINCE,
      CAPITAL_LEVEL_DISTRICT,
      CAPITAL_LEVEL_MUNICIPAL,
    ]);
  }
  if (zoom < 10) return new Set([CAPITAL_LEVEL_NATIONAL]);
  if (zoom < 12) return new Set([CAPITAL_LEVEL_NATIONAL, CAPITAL_LEVEL_STATE_PROVINCE]);
  if (zoom < 14) {
    return new Set([
      CAPITAL_LEVEL_NATIONAL,
      CAPITAL_LEVEL_STATE_PROVINCE,
      CAPITAL_LEVEL_DISTRICT,
    ]);
  }
  return new Set([
    CAPITAL_LEVEL_NATIONAL,
    CAPITAL_LEVEL_STATE_PROVINCE,
    CAPITAL_LEVEL_DISTRICT,
    CAPITAL_LEVEL_MUNICIPAL,
  ]);
}

export function resolveCapitalCategoryLabel(
  tags: Record<string, unknown> | undefined,
): string | null {
  if (!tags) return null;
  const level = parseOsmCapitalLevel(tags);
  const nameLower = String(tags.name ?? "").toLowerCase();

  if (level == null) {
    if (tags.amenity === "townhall") {
      return nameLower.includes("capitol") ? "Capitol" : "Town hall";
    }
    if (tags.building === "government" || tags.historic === "government") {
      return nameLower.includes("capitol") ? "Capitol" : "Government building";
    }
    return null;
  }

  if (nameLower.includes("capitol")) return "Capitol";
  if (level <= CAPITAL_LEVEL_NATIONAL) return "National capital";
  if (level === CAPITAL_LEVEL_STATE_PROVINCE) {
    const country = String(
      tags["addr:country"] ?? tags["is_in:country_code"] ?? tags.country ?? "",
    ).toUpperCase();
    if (country === "US" || country === "USA" || country === "UNITED STATES") {
      return "State capital";
    }
    return "Province capital";
  }
  if (level === CAPITAL_LEVEL_DISTRICT) return "District capital";
  return "Municipality capital";
}
