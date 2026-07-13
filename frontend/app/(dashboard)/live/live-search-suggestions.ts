import {
  DEFAULT_RECENT_SUGGESTIONS,
  type RecentSearchItem,
} from "./live-recent-searches";

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

/** Instant local suggestions — no network, shown while the API loads. */
export function filterInstantSuggestions(
  query: string,
  recent: RecentSearchItem[],
  limit = 6,
): RecentSearchItem[] {
  const pool = recent.length > 0 ? recent : DEFAULT_RECENT_SUGGESTIONS;
  const trimmed = query.trim();
  if (!trimmed) return pool.slice(0, limit);
  return pool.filter((item) => matchesQuery(item, trimmed)).slice(0, limit);
}
