import { describe, expect, it } from "vitest";

import { groupItems, itemMetaLabel } from "../collection-grouping";
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

  it("builds meta label from category and city", () => {
    expect(
      itemMetaLabel(item({ category: "Live music", subcategory: "Jazz club", city: "Chicago" })),
    ).toBe("Live music · Jazz club");
  });
});
