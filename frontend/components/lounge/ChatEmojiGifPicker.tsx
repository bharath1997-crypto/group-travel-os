"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import { TENOR_API_KEY } from "@/lib/lounge/constants";
import { TRAVEL_STICKER_PACK } from "@/lib/lounge/stickers";
import {
  EMOJI_CATEGORIES,
  EMOJI_CAT_KEYS,
  EMOJI_CAT_LABELS,
  EMOJI_CAT_TAGS,
  type EmojiCatKey,
} from "@/lib/lounge/emoji-data";
import { pushRecentEmoji, readRecentEmojisLs } from "@/lib/lounge/storage";
import { LOUNGE_FULL } from "@/lib/lounge/theme";

export type ChatEmojiGifPickerTab = "emoji" | "gif" | "stickers";

function parseTenorResultUrls(body: unknown): string[] {
  const o = body as { results?: unknown[] } | null;
  const results = Array.isArray(o?.results) ? o.results : [];
  const urls: string[] = [];
  for (const it of results) {
    if (!it || typeof it !== "object") continue;
    const mf = (it as { media_formats?: Record<string, { url?: string }> }).media_formats;
    if (!mf) continue;
    const u = mf.tinygif?.url || mf.nanogif?.url || mf.gif?.url || mf.mediumgif?.url;
    if (u) urls.push(u);
  }
  return urls;
}

export function ChatEmojiGifPicker({
  open,
  tab,
  onTabChange,
  panelHeightPx = 220,
  onClose,
  onInsertEmoji,
  onPickGifUrl,
  onPickSticker,
  variant = "light",
}: {
  open: boolean;
  tab: ChatEmojiGifPickerTab;
  onTabChange: (t: ChatEmojiGifPickerTab) => void;
  panelHeightPx?: number;
  onClose: () => void;
  onInsertEmoji: (emoji: string) => void;
  onPickGifUrl: (url: string) => void;
  onPickSticker?: (emoji: string) => void;
  variant?: "light" | "dark";
}) {
  const isDark = variant === "dark";
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);
  const [emojiSearch, setEmojiSearch] = useState("");
  const [emojiCat, setEmojiCat] = useState<EmojiCatKey>("smileys");
  const [gifInput, setGifInput] = useState("");
  const [gifDebounced, setGifDebounced] = useState("");
  const [gifUrls, setGifUrls] = useState<string[]>([]);
  const [gifLoading, setGifLoading] = useState(false);
  const gifAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (open) setRecentEmojis(readRecentEmojisLs());
  }, [open]);

  useEffect(() => {
    const t = window.setTimeout(() => setGifDebounced(gifInput), 500);
    return () => window.clearTimeout(t);
  }, [gifInput]);

  useEffect(() => {
    if (!open || tab !== "gif") return;
    gifAbortRef.current?.abort();
    const ac = new AbortController();
    gifAbortRef.current = ac;
    setGifLoading(true);
    const q = gifDebounced.trim();
    const url = q
      ? `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(q)}&key=${encodeURIComponent(TENOR_API_KEY)}&limit=16&media_filter=gif`
      : `https://tenor.googleapis.com/v2/featured?key=${encodeURIComponent(TENOR_API_KEY)}&limit=16&media_filter=gif`;
    void fetch(url, { signal: ac.signal })
      .then((r) => r.json())
      .then((j) => {
        if (!ac.signal.aborted) setGifUrls(parseTenorResultUrls(j));
      })
      .catch(() => {
        if (!ac.signal.aborted) setGifUrls([]);
      })
      .finally(() => {
        if (!ac.signal.aborted) setGifLoading(false);
      });
    return () => ac.abort();
  }, [open, tab, gifDebounced]);

  const emojiGrid = useMemo(() => {
    const q = emojiSearch.trim().toLowerCase();
    if (emojiCat === "recent") {
      const r = recentEmojis.length ? recentEmojis : readRecentEmojisLs();
      return q ? r : r;
    }
    const base = EMOJI_CATEGORIES[emojiCat] ?? [];
    if (!q) return base;
    const hitCats = (Object.keys(EMOJI_CAT_TAGS) as (keyof typeof EMOJI_CAT_TAGS)[]).filter(
      (k) => EMOJI_CAT_TAGS[k].toLowerCase().includes(q),
    );
    if (hitCats.length) {
      const set = new Set<string>();
      for (const k of hitCats) {
        for (const e of EMOJI_CATEGORIES[k] ?? []) set.add(e);
      }
      return [...set];
    }
    return base;
  }, [emojiCat, emojiSearch, recentEmojis]);

  if (!open) return null;

  return (
    <div
      className={`absolute bottom-full left-0 right-0 z-[210] flex flex-col border-t shadow-lg ${
        isDark ? "" : "border-stone-200 bg-white"
      }`}
      style={{
        height: panelHeightPx,
        ...(isDark
          ? { background: LOUNGE_FULL.pickerBg, borderColor: "rgba(255,255,255,0.1)" }
          : {}),
      }}
    >
      <div
        className={`flex shrink-0 items-center gap-1 border-b px-2 pt-1 ${isDark ? "" : "border-stone-100"}`}
        style={isDark ? { borderColor: "rgba(255,255,255,0.1)" } : undefined}
      >
        {(["emoji", "gif", "stickers"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => onTabChange(k)}
            className={
              isDark
                ? "shrink-0 rounded-t-lg px-3 py-2 text-[13px] font-semibold"
                : `shrink-0 rounded-t-lg px-2.5 py-1.5 text-[11px] font-semibold ${
                    tab === k ? "bg-teal-50 text-primary" : "text-stone-500"
                  }`
            }
            style={
              isDark
                ? {
                    background: tab === k ? "rgba(255,255,255,0.08)" : "transparent",
                    color: tab === k ? "#fff" : LOUNGE_FULL.pickerMuted,
                  }
                : undefined
            }
          >
            {k === "emoji" ? "Emoji" : k === "gif" ? "GIF" : "Stickers"}
          </button>
        ))}
        <button
          type="button"
          onClick={onClose}
          className={`ml-auto p-1 ${isDark ? "text-slate-400 hover:bg-white/10 hover:text-white rounded-lg" : "text-stone-400 hover:text-stone-600"}`}
        >
          <X size={isDark ? 20 : 14} strokeWidth={isDark ? 1.5 : 2} />
        </button>
      </div>

      {tab === "stickers" ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-stone-500">Travel pack</p>
          <div className="grid grid-cols-4 gap-2">
            {TRAVEL_STICKER_PACK.map((s) => (
              <button
                key={s.id}
                type="button"
                title={s.label}
                onClick={() => onPickSticker?.(s.emoji)}
                className="flex flex-col items-center gap-0.5 rounded-lg border border-stone-100 bg-stone-50 p-2 hover:bg-teal-50"
              >
                <span className="text-2xl leading-none">{s.emoji}</span>
                <span className="text-[8px] font-semibold text-stone-500">{s.label}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {tab === "emoji" ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="shrink-0 px-2 pt-1.5">
            <input
              value={emojiSearch}
              onChange={(e) => setEmojiSearch(e.target.value)}
              placeholder="Search emoji..."
              className={
                isDark
                  ? "w-full rounded-lg border-0 px-3 py-2 text-sm text-white outline-none placeholder:text-[#5c6a7d]"
                  : "w-full rounded-lg border border-stone-200 px-2 py-1 text-xs outline-none focus:border-primary"
              }
              style={isDark ? { background: "rgba(0,0,0,0.25)" } : undefined}
            />
          </div>
          <div className="flex shrink-0 gap-0.5 overflow-x-auto px-2 py-1">
            {EMOJI_CAT_KEYS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setEmojiCat(k)}
                className={
                  isDark
                    ? "h-9 shrink-0 rounded-lg px-2.5 text-[11px] font-semibold whitespace-nowrap"
                    : `shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ${
                        emojiCat === k ? "bg-primary text-white" : "text-stone-500"
                      }`
                }
                style={
                  isDark
                    ? {
                        minWidth: 40,
                        background: emojiCat === k ? "rgba(255,255,255,0.12)" : "transparent",
                        color: emojiCat === k ? "#fff" : LOUNGE_FULL.pickerMuted,
                      }
                    : undefined
                }
              >
                {EMOJI_CAT_LABELS[k]}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-1">
            <div className="grid grid-cols-8 gap-0.5 justify-items-center">
              {emojiGrid.map((em) => (
                <button
                  key={`${emojiCat}-${em}`}
                  type="button"
                  onClick={() => {
                    pushRecentEmoji(em);
                    setRecentEmojis(readRecentEmojisLs());
                    onInsertEmoji(em);
                  }}
                  className={
                    isDark
                      ? "flex h-9 w-9 items-center justify-center rounded-md text-[22px] leading-none hover:bg-white/10"
                      : "flex h-7 w-7 items-center justify-center rounded text-lg hover:bg-stone-100"
                  }
                >
                  {em}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {tab === "gif" ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="shrink-0 px-2 pt-1.5">
            <input
              value={gifInput}
              onChange={(e) => setGifInput(e.target.value)}
              placeholder="Search GIFs..."
              className={
                isDark
                  ? "w-full rounded-lg border-0 px-3 py-2 text-sm text-white outline-none placeholder:text-[#5c6a7d]"
                  : "w-full rounded-lg border border-stone-200 px-2 py-1 text-xs outline-none focus:border-primary"
              }
              style={isDark ? { background: "rgba(0,0,0,0.25)" } : undefined}
            />
          </div>
          <div className="relative min-h-0 flex-1 overflow-y-auto px-2 pb-2">
            {gifLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-1 pt-1">
                {gifUrls.map((u) => (
                  <button key={u} type="button" onClick={() => onPickGifUrl(u)} className="overflow-hidden rounded-lg">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={u} alt="" className="h-auto w-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
