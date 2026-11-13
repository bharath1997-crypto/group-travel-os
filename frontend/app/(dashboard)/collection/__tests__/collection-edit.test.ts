import { describe, expect, it } from "vitest";

import { buildEditPatch, draftFromItem, nextStars, restoreBody } from "../collection-edit";
import type { CollectionItem } from "../collection-types";

const base: CollectionItem = {
  id: "i1",
  user_id: "u1",
  collection_id: "c1",
  name: "Green Mill",
  latitude: 41.9,
  longitude: -87.6,
  city: "Chicago",
  country: "USA",
  category: "Live music",
  subcategory: "Jazz club",
  source: "Link",
  saved_from: "https://youtu.be/x",
  note: "Go early",
  stars: 4,
  match_status: "sure",
  is_unsorted: false,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("collection-edit", () => {
  it("returns an empty patch when nothing changed", () => {
    expect(buildEditPatch(base, draftFromItem(base))).toEqual({});
  });

  it("returns only changed, trimmed fields and nulls cleared ones", () => {
    const patch = buildEditPatch(base, { name: "  Green Mill Lounge ", city: "Chicago", category: "", note: "  " });
    expect(patch).toEqual({ name: "Green Mill Lounge", category: null, note: null });
  });

  it("rejects an empty name", () => {
    expect(buildEditPatch(base, { ...draftFromItem(base), name: "   " })).toBeNull();
  });

  it("tapping the current star clears it, other stars set it", () => {
    expect(nextStars(4, 4)).toBe(0);
    expect(nextStars(4, 2)).toBe(2);
    expect(nextStars(0, 5)).toBe(5);
  });

  it("restoreBody keeps user edits, collection and no server fields", () => {
    const body = restoreBody(base);
    expect(body.note).toBe("Go early");
    expect(body.stars).toBe(4);
    expect(body.collection_id).toBe("c1");
    expect(body).not.toHaveProperty("id");
    expect(body).not.toHaveProperty("created_at");
  });
});
