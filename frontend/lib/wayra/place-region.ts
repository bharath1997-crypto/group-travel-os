/** Shared helpers for turning coordinates / reverse-geocode into human place labels. */

export const GENERIC_PLACE_NAMES = new Set([
  "dropped pin",
  "selected location",
  "address",
  "place",
  "map pin",
]);

export function isGenericPlaceName(name?: string | null): boolean {
  const normalized = name?.trim().toLowerCase();
  if (!normalized) return true;
  return GENERIC_PLACE_NAMES.has(normalized);
}

export function buildRegionLabel(parts: {
  city?: string | null;
  state?: string | null;
  country?: string | null;
}): string | null {
  const segments = [parts.city, parts.state, parts.country]
    .map((value) => value?.trim())
    .filter(Boolean) as string[];
  if (segments.length === 0) return null;
  return [...new Set(segments)].join(", ");
}

export function resolvePlaceDisplayName(
  name: string | null | undefined,
  region: {
    city?: string | null;
    state?: string | null;
    country?: string | null;
    address?: string | null;
  },
): string {
  if (!isGenericPlaceName(name)) return name!.trim();

  const regionLabel = buildRegionLabel(region);
  if (regionLabel) return regionLabel;

  const address = region.address?.trim();
  if (address && !address.startsWith("Coordinates:")) {
    const parts = address.split(",").map((part) => part.trim()).filter(Boolean);
    if (parts.length >= 2) return parts.slice(0, 3).join(", ");
    if (parts.length === 1 && !isGenericPlaceName(parts[0])) return parts[0]!;
  }

  return name?.trim() || "Dropped pin";
}
