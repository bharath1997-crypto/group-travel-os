import { normalizePlaceCategory } from "./live-geocoding";

const RAW_OSM_INFRA_LABELS = new Set([
  "secondary",
  "primary",
  "tertiary",
  "trunk",
  "motorway",
  "residential",
  "unclassified",
  "service",
  "track",
  "path",
  "footway",
  "cycleway",
  "steps",
  "road",
  "highway",
  "rail",
  "transportation",
  "line",
]);

function titleCaseToken(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

/** Never surface raw OSM highway/infrastructure tokens as category lines. */
export function sanitizePlaceCategoryLabel(
  label: string | null | undefined,
  tags?: Record<string, unknown> | null,
): string | null {
  const fromTags = tags ? normalizePlaceCategory(tags) : null;
  if (fromTags) return fromTags;

  const trimmed = (label ?? "").trim();
  if (!trimmed) return null;

  const normalized = trimmed.toLowerCase().replace(/\s+/g, " ");
  if (RAW_OSM_INFRA_LABELS.has(normalized)) return null;
  if (/^(node|way|relation)$/i.test(trimmed)) return null;

  return titleCaseToken(trimmed);
}
