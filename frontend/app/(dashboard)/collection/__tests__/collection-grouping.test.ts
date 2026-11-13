import { describe, expect, it } from "vitest";

import {
  filterByFacets,
  formatSavedFrom,
  formatSavedWhen,
  groupItems,
  itemMetaLabel,
  looksLikeUrl,
} from "../collection-grouping";
import type { CollectionItem } from "../collection-types";

function item(partial: Partial<CollectionItem>): CollectionItem {
  return {
    id: partial.id ?? "1",
    user_id: "u1",
    collection_id: null,
    name: partial.name ?? "Place",
    latitude: null,
    longitude: null,
    city: partial.city ?? null,
    country: partial.country ?? null,
    category: partial.category ?? null,
    subcategory: partial.subcategory ?? null,
    source: partial.source ?? "Search",
    saved_from: null,
    note: null,
    stars: 0,
    match_status: "sure",
    is_unsorted: partial.is_unsorted ?? false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

describe("collection-grouping", () => {
  it("groups by city and skips unsorted", () => {
    const sections = groupItems(
      [
        item({ id: "a", city: "Chicago", category: "Food" }),
        item({ id: "b", city: "Chicago", category: "Bars" }),
        item({ id: "c", city: "Austin", category: "Food", is_unsorted: true }),
      ],
      "city",
    );
    expect(sections).toHaveLength(1);
    expect(sections[0]?.title).toBe("Chicago");
    expect(sections[0]?.count).toBe(2);
  });

  it("formats real saved dates, not hard-coded months", () => {
    const now = new Date("2026-11-13T12:00:00Z").getTime();
    const ago = (d: number) => new Date(now - d * 86_400_000).toISOString();
    expect(formatSavedWhen(ago(0), now)).toBe("today");
    expect(formatSavedWhen(ago(1), now)).toBe("yesterday");
    expect(formatSavedWhen(ago(4), now)).toBe("4 days ago");
    expect(formatSavedWhen(ago(8), now)).toBe("1 week ago");
    expect(formatSavedWhen(ago(21), now)).toBe("3 weeks ago");
    expect(formatSavedWhen("2026-06-01T12:00:00Z", now)).toBe("Jun 1");
    expect(formatSavedWhen("2025-03-04T12:00:00Z", now)).toBe("Mar 4, 2025");
    expect(formatSavedWhen("not a date", now)).toBe("");
    expect(formatSavedWhen(ago(-2), now)).toBe("today");
  });

  it("hides internal explore keys from the From line", () => {
    expect(formatSavedFrom("explore:listing:abc123")).toBe("Explore");
    expect(formatSavedFrom("Searched from the map")).toBe("Searched from the map");
    expect(formatSavedFrom(null)).toBeNull();
  });

  it("filters by country, city and category", () => {
    const list = [
      item({ id: "a", city: "Chicago", country: "USA", category: "Food" }),
      item({ id: "b", city: "Lisbon", country: "Portugal", category: "Bars" }),
    ];
    const any = { country: "Any", city: "Any", category: "Any" };
    expect(filterByFacets(list, any)).toHaveLength(2);
    expect(filterByFacets(list, { ...any, country: "Portugal" }).map((i) => i.id)).toEqual(["b"]);
    expect(filterByFacets(list, { ...any, country: "Portugal", category: "Food" })).toHaveLength(0);
  });

  it("detects links", () => {
    expect(looksLikeUrl("https://youtu.be/abc")).toBe(true);
    expect(looksLikeUrl("jazz")).toBe(false);
  });

  it("builds meta label from category and city", () => {
    expect(
      itemMetaLabel(item({ category: "Live music", subcategory: "Jazz club", city: "Chicago" })),
    ).toBe("Live music · Jazz club");
  });
});
