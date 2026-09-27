export const GT_BUDDY_FAVOURITES = "gt_buddy_favourites";

export function readBuddyFavourites(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const v = localStorage.getItem(GT_BUDDY_FAVOURITES);
    const p = v ? (JSON.parse(v) as unknown) : [];
    return Array.isArray(p) && p.every((x) => typeof x === "string")
      ? (p as string[])
      : [];
  } catch {
    return [];
  }
}

export function toggleBuddyFavourite(id: string): string[] {
  const s = new Set(readBuddyFavourites());
  if (s.has(id)) s.delete(id);
  else s.add(id);
  const next = [...s];
  localStorage.setItem(GT_BUDDY_FAVOURITES, JSON.stringify(next));
  return next;
}

export function addBuddyFavourite(id: string): string[] {
  const s = new Set(readBuddyFavourites());
  s.add(id);
  const next = [...s];
  localStorage.setItem(GT_BUDDY_FAVOURITES, JSON.stringify(next));
  return next;
}
