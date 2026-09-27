import {
  COLLECTION_CITY_ORDER,
  COLLECTION_DEMO_META,
  COLLECTION_SHARED_SECTIONS,
} from "./collection-fixtures";
import type { CollectionItem, CollectionSection, GroupMode } from "./collection-types";

export function itemMetaLabel(item: CollectionItem): string {
  const demoMeta = COLLECTION_DEMO_META[item.id];
  if (demoMeta) return demoMeta;

  const parts = [item.category, item.subcategory].filter(Boolean);
  if (parts.length) return parts.join(" · ");
  if (item.city) return item.city;
  return "Saved place";
}

export function formatSavedWhen(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const days = Math.floor((now - then) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "last Tuesday";
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 90) return "in May";
  if (days < 180) return "in June";
  if (days < 365) return "in March";
  return "last year";
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
    .map(([title, sectionItems]) => {
      const shared = COLLECTION_SHARED_SECTIONS[title];
      return {
        title,
        count: sectionItems.length,
        shared: Boolean(shared),
        sharedExtra: shared?.extra ?? "",
        meta: shared?.meta ?? (mode === "city" ? sectionItems[0]?.country ?? "Saved" : "Private"),
        items: sectionItems,
      };
    });
}

export function activeFilterCount(filters: {
  country: string;
  city: string;
  category: string;
}): number {
  return [filters.country, filters.city, filters.category].filter((v) => v !== "Any").length;
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
      item.source,
      item.saved_from,
      item.note,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}
