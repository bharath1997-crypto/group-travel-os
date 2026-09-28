/** Live search — destination / POI category intents (not place names). */
import taxonomy from "@/data/live_search_taxonomy.json";

export type LiveSearchCategory = {
  key: string;
  label: string;
  mapLabel: string;
  icon: string;
  group?: string;
  keywords: string[];
};

export const LIVE_SEARCH_CATEGORIES: LiveSearchCategory[] = (
  taxonomy.categories as Array<{
    key: string;
    label: string;
    mapLabel: string;
    icon: string;
    group?: string;
    keywords: string[];
  }>
).map((cat) => ({
  key: cat.key,
  label: cat.label,
  mapLabel: cat.mapLabel,
  icon: cat.icon,
  group: cat.group,
  keywords: cat.keywords ?? [],
}));

export const LIVE_SEARCH_GROUPS = taxonomy.groups as Array<{ id: string; label: string }>;

function normalizeQuery(q: string): string {
  return q.trim().toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ");
}

/** True when the query is a category intent (e.g. "waterfalls"), not a named place. */
export function resolveLiveSearchCategory(query: string): LiveSearchCategory | null {
  const q = normalizeQuery(query);
  if (!q) return null;

  for (const cat of LIVE_SEARCH_CATEGORIES) {
    if (cat.keywords.some((kw) => q === kw || q === `${kw}s`)) return cat;
    if (cat.key === q) return cat;
  }

  let best: LiveSearchCategory | null = null;
  let bestLen = 0;
  for (const cat of LIVE_SEARCH_CATEGORIES) {
    for (const kw of cat.keywords) {
      if (kw.length < 3) continue;
      if (q.includes(kw) && kw.length > bestLen) {
        best = cat;
        bestLen = kw.length;
      }
    }
  }
  return best;
}

export function isExactCategoryQuery(query: string): boolean {
  const q = normalizeQuery(query);
  if (!q) return false;
  return LIVE_SEARCH_CATEGORIES.some(
    (cat) => cat.key === q || cat.keywords.some((kw) => q === kw),
  );
}

/** How many POI pins to fetch — scales with viewport (12–50). */
export function nearbyResultLimitForScreen(): number {
  if (typeof window === "undefined") return 24;
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (w < 640 || h < 640) return 12;
  if (w < 900) return 24;
  if (w < 1280) return 36;
  return 50;
}

export function getNearbyCategoryTitle(categoryKey: string): string {
  const cat = LIVE_SEARCH_CATEGORIES.find((c) => c.key === categoryKey);
  if (cat) return cat.label;
  return `${categoryKey} nearby`;
}

export function listCategoriesByGroup(groupId: string): LiveSearchCategory[] {
  return LIVE_SEARCH_CATEGORIES.filter((c) => c.group === groupId);
}
