import type { CollectionItem } from "./collection-types";

/** What a shared place carries. Never the note, stars, tags or collection (they can be private). */
export type SharedPlace = {
  name: string;
  city: string;
  country: string;
  category: string;
  from: string;
};

const LIMITS = { name: 200, city: 120, country: 120, category: 80, from: 500 } as const;

const clip = (v: string | null | undefined, n: number) => (v ?? "").trim().slice(0, n);

/** First http(s) link of the original source (the reel or article), if any. */
function sourceOf(item: Pick<CollectionItem, "saved_from">): string {
  const v = (item.saved_from ?? "").trim();
  if (!/^https?:\/\//i.test(v)) return "";
  return v.split("#")[0].slice(0, LIMITS.from);
}

/** The Rovvy link that opens "Save this place" for whoever receives it. */
export function buildShareUrl(
  origin: string,
  item: Pick<CollectionItem, "name" | "city" | "country" | "category" | "saved_from">,
): string {
  const params = new URLSearchParams();
  params.set("name", clip(item.name, LIMITS.name));
  if (item.city) params.set("city", clip(item.city, LIMITS.city));
  if (item.country) params.set("country", clip(item.country, LIMITS.country));
  if (item.category) params.set("category", clip(item.category, LIMITS.category));
  const from = sourceOf(item);
  if (from) params.set("from", from);
  return `${origin.replace(/\/$/, "")}/collection/add?${params.toString()}`;
}

/** Read a shared link's parameters. Returns null when there is no usable name. */
export function parseSharedPlace(params: { get(name: string): string | null }): SharedPlace | null {
  const name = clip(params.get("name"), LIMITS.name);
  if (!name) return null;
  const from = clip(params.get("from"), LIMITS.from);
  return {
    name,
    city: clip(params.get("city"), LIMITS.city),
    country: clip(params.get("country"), LIMITS.country),
    category: clip(params.get("category"), LIMITS.category),
    // Only real web links are kept; javascript:, data: and broken ones ("https://[") are dropped.
    from: isWebLink(from) ? from : "",
  };
}

function isWebLink(v: string): boolean {
  try {
    const u = new URL(v);
    return (u.protocol === "http:" || u.protocol === "https:") && Boolean(u.hostname);
  } catch {
    return false;
  }
}

/** One stable key per shared place so opening the same link twice saves once. */
export function sharedPlaceKey(p: SharedPlace): string {
  const slug = `${p.name}|${p.city}`
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  const base = p.from ? p.from.split("#")[0] : "https://rovvy.app/shared";
  return `${base}#shared=${slug || "place"}`.slice(0, 500);
}

/** Text that goes with the link in WhatsApp, Messages, etc. */
export function shareText(item: Pick<CollectionItem, "name" | "city">): string {
  return item.city ? `${item.name} in ${item.city}, saved on Rovvy` : `${item.name}, saved on Rovvy`;
}
