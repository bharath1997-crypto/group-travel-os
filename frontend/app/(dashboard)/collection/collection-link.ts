import type { ExtractCandidate } from "./collection-types";

export type CandidateDraft = { name: string; city: string; category: string };

export function draftFromCandidate(c: ExtractCandidate): CandidateDraft {
  return { name: c.name, city: c.city ?? "", category: c.category ?? "" };
}

const orNull = (v: string): string | null => {
  const t = v.trim();
  return t ? t : null;
};

/** Body for POST /collection/items from a candidate and the user's edits. */
export function candidateToBody(
  c: ExtractCandidate,
  d: CandidateDraft,
  collectionId?: string | null,
  tags: string[] = [],
) {
  const status = c.match_status ?? "unknown";
  return {
    name: d.name.trim(),
    city: orNull(d.city),
    country: c.country ?? null,
    category: orNull(d.category),
    subcategory: c.subcategory ?? null,
    source: "Link",
    saved_from: c.saved_from ?? null,
    match_status: status,
    // Only places we could place in a known city go straight to the grid.
    is_unsorted: status !== "sure" || !orNull(d.city),
    collection_id: collectionId ?? null,
    tags,
  };
}

/** Body for keeping a link that produced no place (never lose the link). */
/** True for the domain itself or a real subdomain ("notinstagram.com" is not instagram.com). */
export function hostIs(host: string, domain: string): boolean {
  const h = host.toLowerCase();
  return h === domain || h.endsWith(`.${domain}`);
}

/** Share-tracking noise that is safe to drop on every site. */
const COMMON_TRACKING = /^(utm_.*|fbclid|gclid|mc_cid|mc_eid|igsh|igshid)$/i;
/** Only noise on these platforms. `t`, `s`, `ref` and `si` identify content on forums and articles. */
const PLATFORM_TRACKING: Array<[string, RegExp]> = [
  ["youtube.com", /^(si|feature|pp)$/i],
  ["youtu.be", /^(si|feature|pp)$/i],
  ["twitter.com", /^(s|t|ref_src|ref_url)$/i],
  ["x.com", /^(s|t|ref_src|ref_url)$/i],
  ["tiktok.com", /^(is_from_webapp|sender_device|web_id|_t|_r)$/i],
];

/**
 * The same reel shared twice carries different tracking parameters (?igsh=..., ?si=...).
 * Strip those so a link is saved once, and keep everything that identifies the content.
 */
export function canonicalLink(raw: string): string {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return raw.trim();
    const host = u.hostname.toLowerCase();
    const platform = PLATFORM_TRACKING.find(([domain]) => hostIs(host, domain))?.[1];
    for (const key of [...u.searchParams.keys()]) {
      // YouTube `t` is a start time (kept). On a forum `?t=123` is the thread: never dropped.
      if (COMMON_TRACKING.test(key) || platform?.test(key)) u.searchParams.delete(key);
    }
    u.hash = "";
    return u.toString();
  } catch {
    return raw.trim();
  }
}

/** Where a link came from: reels and short videos are "Reel", everything else "Link". */
export function linkSource(url: string): "Reel" | "Link" {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return hostIs(host, "instagram.com") || hostIs(host, "tiktok.com") || host === "instagr.am" ? "Reel" : "Link";
  } catch {
    return "Link";
  }
}

/** A readable name for a saved link: the page/video title when we have one, else what the URL says. */
export function linkName(url: string, title?: string | null): string {
  const t = (title ?? "").trim();
  let host = "";
  let path: string[] = [];
  try {
    const u = new URL(url);
    host = u.hostname.replace(/^www\./, "").toLowerCase();
    path = u.pathname.split("/").filter(Boolean);
  } catch {
    return (t || url).slice(0, 200);
  }
  // The reader returns the bare host as the title when it cannot read a post; that is not a name.
  if (t && t.toLowerCase().replace(/^www\./, "") !== host) return t.slice(0, 200);
  if (hostIs(host, "instagram.com") || host === "instagr.am") {
    const i = path.findIndex((p) => ["reel", "reels", "p", "tv"].includes(p));
    const code = i >= 0 ? path[i + 1] : path[0];
    return `Instagram ${i >= 0 && path[i] !== "p" ? "reel" : "post"}${code ? ` ${code}` : ""}`.slice(0, 200);
  }
  if (hostIs(host, "tiktok.com")) {
    const id = path[path.indexOf("video") + 1];
    return `TikTok video${id ? ` ${id}` : ""}`.slice(0, 200);
  }
  return `${host}${path.length ? `/${path.join("/")}` : ""}`.slice(0, 200);
}

/** The database keeps a link in 500 characters. A longer one must be refused, never cut (a cut link opens the wrong page). */
export const MAX_LINK_LENGTH = 500;

export function linkOnlyBody(url: string, title: string, tags: string[] = []) {
  return {
    tags,
    name: linkName(url, title),
    source: linkSource(url),
    saved_from: url.slice(0, 500),
    match_status: "unknown",
    is_unsorted: true,
  };
}

const URL_IN_TEXT = /https?:\/\/[^\s<>"']+/i;

/** Drop sentence punctuation after a link, but keep a ")" that closes one inside it (Wikipedia: Foo_(bar)). */
function trimLinkEnd(link: string): string {
  let out = link.replace(/[.,;!?]+$/, "");
  while (out.endsWith(")") && (out.match(/\(/g) ?? []).length < (out.match(/\)/g) ?? []).length) {
    out = out.slice(0, -1).replace(/[.,;!?]+$/, "");
  }
  return out;
}

/**
 * The link from a phone share sheet. Apps put it in `url`, or inside `text`
 * ("Look at this https://..."). Returns null when there is no web link.
 */
export function extractSharedUrl(params: { url?: string | null; text?: string | null; title?: string | null }): string | null {
  for (const field of [params.url, params.text, params.title]) {
    const m = field?.match(URL_IN_TEXT);
    if (m) return trimLinkEnd(m[0]);
  }
  return null;
}

/** A saved_from that is a web link becomes a clickable source (fragment hidden). */
export function sourceLink(savedFrom: string | null): { href: string; label: string } | null {
  const value = savedFrom?.trim();
  if (!value || !/^https?:\/\//i.test(value)) return null;
  try {
    const u = new URL(value.split("#")[0]);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return { href: u.toString(), label: u.hostname.replace(/^www\./, "") + (u.pathname.length > 1 ? "…" : "") };
  } catch {
    return null;
  }
}
