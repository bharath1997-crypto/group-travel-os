import {
  GT_CALL_HISTORY,
  GT_RECENT_EMOJIS,
  GT_STARRED_MESSAGES,
  type GtCallHistoryEntry,
  type StarredMessage,
} from "./constants";

export function readJsonLs<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJsonLs(key: string, val: unknown): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {
    /* ignore */
  }
}

export function readCallHistoryLs(): GtCallHistoryEntry[] {
  return readJsonLs<GtCallHistoryEntry[]>(GT_CALL_HISTORY, []);
}

export function writeCallHistoryLs(entries: GtCallHistoryEntry[]): void {
  writeJsonLs(GT_CALL_HISTORY, entries.slice(0, 200));
}

export function readStarredMessagesLs(): StarredMessage[] {
  return readJsonLs<StarredMessage[]>(GT_STARRED_MESSAGES, []);
}

export function writeStarredMessagesLs(entries: StarredMessage[]): void {
  writeJsonLs(GT_STARRED_MESSAGES, entries.slice(0, 100));
}

export function readRecentEmojisLs(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(GT_RECENT_EMOJIS);
    if (!raw) return [];
    const p = JSON.parse(raw) as unknown;
    if (!Array.isArray(p)) return [];
    return p.filter((x): x is string => typeof x === "string").slice(0, 24);
  } catch {
    return [];
  }
}

export function writeRecentEmojisLs(emojis: string[]): void {
  writeJsonLs(GT_RECENT_EMOJIS, emojis.slice(0, 24));
}

export function pushRecentEmoji(emoji: string): void {
  const cur = readRecentEmojisLs().filter((e) => e !== emoji);
  writeRecentEmojisLs([emoji, ...cur]);
}

export function formatCallDurationFmt(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function formatCallHistorySubline(e: GtCallHistoryEntry): string {
  const d = new Date(e.timestamp);
  const today = new Date();
  const timeStr = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const dayPart = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const timePart =
    d.toDateString() === today.toDateString() ? `Today ${timeStr}` : dayPart;
  const dir =
    e.direction === "outgoing"
      ? "Outgoing"
      : e.direction === "missed"
        ? "Missed"
        : "Incoming";
  return `${dir} · ${timePart}`;
}
