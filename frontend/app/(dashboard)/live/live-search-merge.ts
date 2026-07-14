import type { AutocompleteResult } from "./live-geocoding";

/** Merge map-local hits ahead of API results, deduped by placeKey or coordinates. */
export function mergeAutocompleteResults(
  apiResults: AutocompleteResult[],
  mapResults: AutocompleteResult[],
  limit = 10,
): AutocompleteResult[] {
  const seen = new Set<string>();
  const merged: AutocompleteResult[] = [];

  for (const row of [...mapResults, ...apiResults]) {
    const key =
      row.placeKey ||
      `${row.lat.toFixed(5)},${row.lng.toFixed(5)}:${row.name.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(row);
    if (merged.length >= limit) break;
  }

  return merged;
}
