import type { CollectionItem, CollectionItemPatch } from "./collection-types";

export type EditDraft = {
  name: string;
  city: string;
  category: string;
  note: string;
};

export function draftFromItem(item: CollectionItem): EditDraft {
  return {
    name: item.name,
    city: item.city ?? "",
    category: item.category ?? "",
    note: item.note ?? "",
  };
}

const clean = (v: string): string | null => {
  const t = v.trim();
  return t ? t : null;
};

/** Only the fields that changed. Returns null when the name is empty (invalid). */
export function buildEditPatch(item: CollectionItem, draft: EditDraft): CollectionItemPatch | null {
  const name = draft.name.trim();
  if (!name) return null;
  const patch: CollectionItemPatch = {};
  if (name !== item.name) patch.name = name;
  if (clean(draft.city) !== (item.city ?? null)) patch.city = clean(draft.city);
  if (clean(draft.category) !== (item.category ?? null)) patch.category = clean(draft.category);
  if (clean(draft.note) !== (item.note ?? null)) patch.note = clean(draft.note);
  return patch;
}

/** "date night, #rainy day" -> ["date night", "rainy day"] (max 10, 40 chars each, no repeats). */
export function parseTags(input: string): string[] {
  const out: string[] = [];
  for (const part of input.split(/[,\n]/)) {
    // Only a leading "#" is decoration; "c#" and "f#" are real tags (same rule as the server).
    const tag = part.trim().replace(/^#+\s*/, "").replace(/\s+#/g, " ").replace(/\s+/g, " ").toLowerCase().slice(0, 40);
    if (tag && !out.includes(tag)) out.push(tag);
  }
  return out.slice(0, 10);
}

/** Tapping the star you already have clears the rating. */
export function nextStars(current: number, tapped: number): number {
  return current === tapped ? 0 : tapped;
}

/** Body to put a removed save back (undo). Keeps what the user typed. */
export function restoreBody(item: CollectionItem) {
  return {
    name: item.name,
    city: item.city,
    country: item.country,
    category: item.category,
    subcategory: item.subcategory,
    source: item.source,
    saved_from: item.saved_from,
    note: item.note,
    stars: item.stars,
    match_status: item.match_status,
    is_unsorted: item.is_unsorted,
    collection_id: item.collection_id,
    tags: item.tags ?? [],
    latitude: item.latitude,
    longitude: item.longitude,
  };
}
