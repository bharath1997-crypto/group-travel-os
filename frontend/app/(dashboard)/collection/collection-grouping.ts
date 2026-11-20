import { COLLECTION_CITY_ORDER, COLLECTION_DEMO_META } from "./collection-fixtures";
import type { CollectionItem, CollectionSection, GroupMode } from "./collection-types";

export type CollectionFilters = { country: string; city: string; category: string };

export function itemMetaLabel(item: CollectionItem): string {
  const demoMeta = COLLECTION_DEMO_META[item.id];
  if (demoMeta) return demoMeta;

  const parts = [item.category, item.subcategory].filter(Boolean);
  if (parts.length) return parts.join(" · ");
  if (item.city) return item.city;
  return "Saved place";
}

/** Real relative date: "today", "3 days ago", "2 weeks ago", then "Mar 4" / "Mar 4, 2025". */
export function formatSavedWhen(iso: string, now: number = Date.now()): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "";
  // Calendar days, not 24-hour blocks: 11 pm yesterday is "yesterday" at 1 am, not "today".
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(new Date(now)) - startOf(then)) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
  }
  const sameYear = then.getFullYear() === new Date(now).getFullYear();
  return then.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

/** Readable origin for a save; hides internal keys such as `explore:listing:...`. */
export function formatSavedFrom(savedFrom: string | null): string | null {
  const value = savedFrom?.trim();
  if (!value) return null;
  if (value.toLowerCase().startsWith("explore:")) return "Explore";
  if (value.toLowerCase().startsWith("share:")) return null; // shown as "Shared by <name>"
  return value;
}

export function looksLikeUrl(text: string): boolean {
  return /^https?:\/\/\S+$/i.test(text.trim());
}

function sectionSortKey(title: string, mode: GroupMode): number {
  if (mode === "city") {
    const idx = COLLECTION_CITY_ORDER.indexOf(title as (typeof COLLECTION_CITY_ORDER)[number]);
    return idx >= 0 ? idx : 99;
  }
  return 99;
}

export function groupItems(
  items: CollectionItem[],
  mode: GroupMode,
): CollectionSection[] {
  const sorted = items.filter((i) => !i.is_unsorted);
  const buckets = new Map<string, CollectionItem[]>();

  for (const item of sorted) {
    const key = (mode === "city" ? item.city : item.category)?.trim() || "Other";
    const list = buckets.get(key) ?? [];
    list.push(item);
    buckets.set(key, list);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => {
      const orderA = sectionSortKey(a, mode);
      const orderB = sectionSortKey(b, mode);
      if (orderA !== orderB) return orderA - orderB;
      return a.localeCompare(b);
    })
    .map(([title, sectionItems]) => ({
      title,
      count: sectionItems.length,
      meta: mode === "city" ? sectionItems[0]?.country ?? "Saved" : "Private",
      items: sectionItems,
    }));
}

export function activeFilterCount(filters: CollectionFilters): number {
  return [filters.country, filters.city, filters.category].filter((v) => v !== "Any").length;
}

export function filterByFacets(items: CollectionItem[], filters: CollectionFilters): CollectionItem[] {
  return items.filter(
    (i) =>
      (filters.country === "Any" || i.country === filters.country) &&
      (filters.city === "Any" || i.city === filters.city) &&
      (filters.category === "Any" || i.category === filters.category),
  );
}

export function filterBySearch(items: CollectionItem[], query: string): CollectionItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => {
    const haystack = [
      item.name,
      item.city,
      item.country,
      item.category,
      item.subcategory,
      item.note,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}
