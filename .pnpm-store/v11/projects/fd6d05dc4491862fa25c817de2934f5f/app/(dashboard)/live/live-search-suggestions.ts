import {
  DEFAULT_RECENT_SUGGESTIONS,
  type RecentSearchItem,
} from "./live-recent-searches";
import {
  LIVE_SEARCH_CATEGORIES,
  resolveLiveSearchCategory,
  type LiveSearchCategory,
} from "./live-search-categories";

function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ");
}

function matchesQuery(item: RecentSearchItem, query: string): boolean {
  const q = normalizeForMatch(query);
  if (!q) return true;

  const haystacks = [
    item.label,
    item.subtitle ?? "",
    item.query ?? "",
    item.category ?? "",
    item.address ?? "",
  ].map(normalizeForMatch);

  if (haystacks.some((text) => text.includes(q))) return true;

  const qWords = q.split(" ").filter(Boolean);
  if (qWords.length <= 1) return false;

  return haystacks.some((text) => qWords.every((word) => text.includes(word)));
}

function categoryToSuggestion(cat: LiveSearchCategory): RecentSearchItem {
  return {
    id: `taxonomy_${cat.key}`,
    label: cat.label,
    subtitle: "Show on map",
    type: "category_search",
    query: cat.key,
    category: cat.key,
    lastUsedAt: "",
    useCount: 0,
  };
}

function dedupeSuggestions(items: RecentSearchItem[]): RecentSearchItem[] {
  const seen = new Set<string>();
  const out: RecentSearchItem[] = [];
  for (const item of items) {
    const key =
      item.type === "category_search"
        ? `category:${item.category ?? item.query ?? item.label}`
        : `item:${item.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/** Instant local suggestions — no network, shown while the API loads. */
export function filterInstantSuggestions(
  query: string,
  recent: RecentSearchItem[],
  limit = 8,
): RecentSearchItem[] {
  const trimmed = query.trim();
  const pool = recent.length > 0 ? recent : DEFAULT_RECENT_SUGGESTIONS;

  if (!trimmed) {
    return pool.slice(0, limit);
  }

  const resolved = resolveLiveSearchCategory(trimmed);
  const categoryMatches = resolved ? [categoryToSuggestion(resolved)] : [];

  const keywordMatches = LIVE_SEARCH_CATEGORIES.filter((cat) =>
    cat.keywords.some((kw) => {
      const normalizedKw = normalizeForMatch(kw);
      const normalizedQuery = normalizeForMatch(trimmed);
      return (
        normalizedQuery.includes(normalizedKw) ||
        normalizedKw.includes(normalizedQuery)
      );
    }),
  ).map(categoryToSuggestion);

  const fromPool = pool.filter((item) => matchesQuery(item, trimmed));

  return dedupeSuggestions([...categoryMatches, ...keywordMatches, ...fromPool]).slice(
    0,
    limit,
  );
}
