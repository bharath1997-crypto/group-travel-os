import type { ChatInfo, GroupMemberOut, GroupOut, UserMe } from "./hub-types";

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  INR: "₹",
  JPY: "¥",
  AUD: "A$",
  CAD: "C$",
  CHF: "CHF ",
  CNY: "¥",
  KRW: "₩",
  NZD: "NZ$",
  SEK: "kr ",
  SGD: "S$",
};

export function getCurrencyCodeFromUser(
  u: { preferred_currency?: string | null } | null,
): string {
  const c = u?.preferred_currency?.trim().toUpperCase();
  return c && c.length === 3 ? c : "USD";
}

export function getCurrencySymbolFromUser(
  u: { preferred_currency?: string | null } | null,
): string {
  return CURRENCY_SYMBOLS[getCurrencyCodeFromUser(u)] ?? "$";
}

export function getCurrencySymbol(code: string): string {
  return CURRENCY_SYMBOLS[code.toUpperCase()] ?? "$";
}

export function isAbortError(e: unknown): boolean {
  if (e instanceof Error && e.name === "AbortError") return true;
  const n = (e as { name?: string })?.name;
  return n === "AbortError";
}

const INITIALS_AVATAR_COLORS = [
  "#E8385A",
  "#0EA5E9",
  "#10B981",
  "#F59E0B",
  "#8B5CF6",
] as const;

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i)!;
  return Math.abs(h);
}

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function listAvatarColor(name: string): string {
  return INITIALS_AVATAR_COLORS[hashString(name) % INITIALS_AVATAR_COLORS.length]!;
}

export function formatDisplayNameHub(full: string | null | undefined): string {
  const t = (full ?? "").trim();
  return t || "You";
}

export function formatListTimestamp(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();
  if (isYesterday) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function isInlineSvgDataUrlToSkipForPhoto(url: string): boolean {
  return url.trim().toLowerCase().startsWith("data:image/svg");
}

export function isLegacyDicebearUrl(url: string): boolean {
  return /dicebear\.com/i.test(url);
}

/** Stricter check for the “no account found — invite by email” path */
export function isValidEmailFormat(s: string): boolean {
  const t = s.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

/** Trim; if the query starts with `@`, strip it so the API searches username without the prefix. */
export function normalizeConnectUserSearchQuery(raw: string): string {
  const t = raw.trim();
  return t.startsWith("@") ? t.slice(1) : t;
}

/** Secondary line: `@username · email` (omit missing pieces). */
export function formatUserSearchMeta(u: {
  username?: string | null;
  email?: string | null;
}): string {
  const un = u.username?.trim();
  const at = un ? (un.startsWith("@") ? un : `@${un}`) : null;
  const e = u.email?.trim();
  const parts: string[] = [];
  if (at) parts.push(at);
  if (e) parts.push(e);
  return parts.length ? parts.join(" · ") : " ";
}

export function chatRowDisplayName(c: {
  name: string;
  type: string;
  metadata?: { name?: string };
}): string {
  if (c.type === "group") return c.name;
  const meta = c.metadata?.name?.trim();
  if (meta) return meta;
  return c.name?.trim() || "Chat";
}

/** Display title for lounge dock popups (groups, DMs, self-note chat). */
export function loungeChatDisplayName(
  c: {
    name: string;
    type: string;
    group_id?: string;
    members?: string[];
    isBot?: boolean;
    isAnnouncement?: boolean;
    metadata?: { name?: string };
  } | null | undefined,
  opts?: {
    selfId?: string;
    selfName?: string | null;
    groups?: { id: string; name: string }[];
  },
): string {
  if (!c) return "Chat";
  if (c.isBot) return "Rovvy Help";
  if (c.isAnnouncement) return "Community Updates";
  if (c.type === "group") {
    const trimmed = c.name?.trim();
    if (trimmed && trimmed !== "Direct Chat") return trimmed;
    if (c.group_id && opts?.groups?.length) {
      const g = opts.groups.find((x) => x.id === c.group_id);
      if (g?.name?.trim()) return g.name.trim();
    }
    return trimmed || "Group";
  }
  const selfId = opts?.selfId;
  const peer = selfId ? c.members?.find((m) => m !== selfId) : undefined;
  if (!peer || peer === selfId) {
    return opts?.selfName?.trim() || "You";
  }
  return chatRowDisplayName(c);
}

export function profileOrAvatarPublicUrl(p: {
  full_name: string;
  profile_picture: string | null;
  avatar_url: string | null;
}): string | null {
  const pp = p.profile_picture?.trim();
  if (pp) return pp;
  const av = p.avatar_url?.trim();
  if (av && !isInlineSvgDataUrlToSkipForPhoto(av) && !isLegacyDicebearUrl(av)) {
    return av;
  }
  return null;
}

export function chatRowDmAvatarUrl(c: ChatInfo): string | null {
  if (c.type !== "individual") return null;
  const p = c.metadata?.profile_picture?.trim();
  if (p && !isInlineSvgDataUrlToSkipForPhoto(p) && !isLegacyDicebearUrl(p)) {
    return p;
  }
  const a = c.metadata?.avatar_url?.trim();
  if (a && !isInlineSvgDataUrlToSkipForPhoto(a) && !isLegacyDicebearUrl(a)) {
    return a;
  }
  return null;
}

export function parseLastSeen(v: string | number | null | undefined): number | null {
  if (v == null) return null;
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  const t = Date.parse(String(v));
  return Number.isNaN(t) ? null : t;
}

export function memberOnlineRecently(
  members: GroupMemberOut[],
  selfId: string,
  windowMs = 5 * 60 * 1000,
): boolean {
  const cutoff = Date.now() - windowMs;
  for (const m of members) {
    if (m.user_id === selfId) continue;
    const t = parseLastSeen(m.last_seen ?? null);
    if (t != null && t >= cutoff) return true;
  }
  return false;
}

export function dmListPeerOnline(
  u: UserMe | null,
  c: ChatInfo,
  glist: GroupOut[],
): boolean {
  if (!u || c.type !== "individual" || c.isAnnouncement) return false;
  const peer = c.members.find((m) => m !== u.id);
  if (!peer) return false;
  for (const g of glist) {
    const mems = g.members ?? [];
    if (mems.some((m) => m.user_id === peer)) {
      return memberOnlineRecently(mems, u.id);
    }
  }
  return false;
}
