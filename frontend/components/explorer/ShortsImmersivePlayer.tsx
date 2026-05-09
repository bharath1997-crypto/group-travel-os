"use client";

import {
  ChevronDown,
  ChevronUp,
  MessageCircle,
  Search,
  Share2,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CityTag } from "@/components/shared/CityTag";
import { getToken } from "@/lib/auth";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const CHROME_HIDE_MS = 3000;

export type ShortsVideoSource = "youtube" | "travello";

export type ShortsImmersiveItem = {
  id?: string; // Database UUID for imported shorts
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  viewCount?: number;
  description?: string;
  /** Feed origin — drives source pill */
  source?: ShortsVideoSource;
  /** Future UGC flag; YouTube items stay false */
  is_creator?: boolean;
};

type ShortsImmersivePlayerProps = {
  queue: ShortsImmersiveItem[];
  activeVideoId: string | null;
  onActiveVideoIdChange: (videoId: string | null) => void;
  city?: string;
};

function formatCompactViews(n: number): string {
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return `${v >= 10 ? Math.round(v) : v.toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (n >= 1_000) {
    const v = n / 1_000;
    return `${v >= 100 ? Math.round(v) : v.toFixed(1).replace(/\.0$/, "")}K`;
  }
  if (n > 0) return n.toLocaleString();
  return "—";
}

function asRecord(v: unknown): Record<string, unknown> | null {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return null;
}

function pickString(obj: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const val = obj[k];
    if (typeof val === "string" && val.trim()) return val.trim();
  }
  return "";
}

function thumbnailFromSnippet(snippet: Record<string, unknown>): string {
  const thumbs = asRecord(snippet.thumbnails);
  if (!thumbs) return "";
  for (const size of ["maxres", "high", "medium", "standard", "default"]) {
    const t = asRecord(thumbs[size]);
    if (t && typeof t.url === "string") return t.url;
  }
  return "";
}

function parseViewCountImm(o: Record<string, unknown>): number | undefined {
  const st = asRecord(o.statistics);
  if (!st) return undefined;
  const raw = st.viewCount;
  if (typeof raw === "string") {
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : undefined;
  }
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  return undefined;
}

function parseSource(o: Record<string, unknown>): ShortsVideoSource {
  const s = pickString(o, ["source", "provider"]).toLowerCase();
  return s === "travello" ? "travello" : "youtube";
}

function parseIsCreator(o: Record<string, unknown>): boolean {
  if (o.is_creator === true) return true;
  const sn = asRecord(o.snippet);
  if (sn && sn.is_creator === true) return true;
  return false;
}

function itemToImmersive(raw: unknown): ShortsImmersiveItem | null {
  const o = asRecord(raw);
  if (!o) return null;
  const idBlock = asRecord(o.id) ?? o;
  const videoId =
    pickString(idBlock as Record<string, unknown>, ["videoId"]) ||
    pickString(o, ["videoId", "video_id"]);
  if (!videoId) return null;
  const id = pickString(o, ["id"]);
  const sn = asRecord(o.snippet);
  const title = sn ? pickString(sn, ["title"]) : "";
  const description = sn ? pickString(sn, ["description"]) : "";
  const channelTitle = sn ? pickString(sn, ["channelTitle"]) : "";
  const thumbnailUrl = sn ? thumbnailFromSnippet(sn) : "";
  const vc = parseViewCountImm(o);
  const source = parseSource(o);
  const is_creator = parseIsCreator(o);
  return {
    videoId,
    title: title || "Short video",
    channelTitle: channelTitle || "YouTube",
    thumbnailUrl:
      thumbnailUrl || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    ...(id ? { id } : {}),
    ...(description ? { description } : {}),
    ...(typeof vc === "number" ? { viewCount: vc } : {}),
    source,
    is_creator,
  };
}

function normalizeRawList(raw: unknown): ShortsImmersiveItem[] {
  if (!Array.isArray(raw)) return [];
  const out: ShortsImmersiveItem[] = [];
  raw.forEach((row) => {
    const it = itemToImmersive(row);
    if (it) out.push(it);
  });
  return out;
}

function parseShortsPayloadToQueue(shorts: unknown): ShortsImmersiveItem[] {
  const seen = new Set<string>();
  const out: ShortsImmersiveItem[] = [];
  const push = (list: ShortsImmersiveItem[]) => {
    for (const it of list) {
      if (seen.has(it.videoId)) continue;
      seen.add(it.videoId);
      out.push(it);
    }
  };
  if (shorts && typeof shorts === "object" && !Array.isArray(shorts)) {
    const o = shorts as Record<string, unknown>;
    push(normalizeRawList(o.trending));
    push(normalizeRawList(o.recent));
    return out;
  }
  push(normalizeRawList(shorts));
  return out;
}

function extractHashtagsFromText(
  text: string,
  max = 10,
): { label: string; slug: string }[] {
  const re = /#[\p{L}\p{M}\p{N}_]+/gu;
  const seen = new Set<string>();
  const out: { label: string; slug: string }[] = [];
  for (const m of text.matchAll(re)) {
    const label = m[0];
    const slug = label.slice(1).toLowerCase();
    if (slug.length < 2) continue;
    if (!seen.has(slug)) {
      seen.add(slug);
      out.push({ label, slug });
      if (out.length >= max) break;
    }
  }
  return out;
}

type ShortsYoutubeIframeProps = {
  videoId: string;
  shortsUrl: string;
};

function ShortsYoutubeIframe({ videoId, shortsUrl }: ShortsYoutubeIframeProps) {
  const [showLoadFallback, setShowLoadFallback] = useState(false);
  const [progress, setProgress] = useState(0);
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressTrackRef = useRef<HTMLDivElement>(null);
  const loadTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setProgress(0);
  }, [videoId]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const p = playerRef.current;
      if (!p || typeof p.getCurrentTime !== "function") return;
      const current = p.getCurrentTime();
      const duration = p.getDuration();
      if (
        typeof duration !== "number" ||
        !Number.isFinite(duration) ||
        duration <= 0
      ) {
        return;
      }
      const cur =
        typeof current === "number" && Number.isFinite(current) ? current : 0;
      setProgress((cur / duration) * 100);
    }, 1000);
    return () => clearInterval(interval);
  }, [videoId]);

  useEffect(() => {
    loadTimerRef.current = window.setTimeout(() => {
      setShowLoadFallback(true);
      loadTimerRef.current = null;
    }, 12_000);

    // Load YouTube Iframe API script
    if (!(window as any).YT) {
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }

    (window as any).onYouTubeIframeAPIReady = () => {
      createPlayer();
    };

    if ((window as any).YT && (window as any).YT.Player) {
      createPlayer();
    }

    function createPlayer() {
      if (!containerRef.current) return;
      
      if (loadTimerRef.current) {
        clearTimeout(loadTimerRef.current);
        loadTimerRef.current = null;
      }
      setShowLoadFallback(false);

      playerRef.current = new (window as any).YT.Player(containerRef.current, {
        videoId: videoId,
        playerVars: {
          autoplay: 1,
          controls: 0,
          modestbranding: 1,
          loop: 1,
          playlist: videoId, // Required for loop
          rel: 0,
        },
        events: {
          onReady: (event: any) => {
            event.target.playVideo();
          },
        },
      });
    }

    return () => {
      if (loadTimerRef.current) {
        clearTimeout(loadTimerRef.current);
      }
      if (playerRef.current) {
        playerRef.current.destroy();
      }
    };
  }, [videoId]);

  const onProgressTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const p = playerRef.current;
    const track = progressTrackRef.current;
    if (!p || !track || typeof p.seekTo !== "function") return;
    const duration = p.getDuration();
    if (
      typeof duration !== "number" ||
      !Number.isFinite(duration) ||
      duration <= 0
    ) {
      return;
    }
    const rect = track.getBoundingClientRect();
    const ratio = Math.max(
      0,
      Math.min(1, (e.clientX - rect.left) / rect.width),
    );
    p.seekTo(ratio * duration, true);
    setProgress(ratio * 100);
  };

  const togglePlay = () => {
    if (!playerRef.current) return;
    const state = playerRef.current.getPlayerState();
    if (state === 1) {
      playerRef.current.pauseVideo();
    } else {
      playerRef.current.playVideo();
    }
  };

  return (
    <>
      <div
        className="youtube-wrapper relative h-full w-full cursor-pointer"
        onClick={togglePlay}
        role="presentation"
      >
        <div ref={containerRef} />
        <div
          ref={progressTrackRef}
          role="slider"
          tabIndex={0}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
          aria-label="Video progress"
          className="absolute bottom-0 left-0 right-0 z-[12] h-2 cursor-pointer bg-white/20"
          onClick={onProgressTrackClick}
          onKeyDown={(e) => {
            if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
            e.preventDefault();
            const p = playerRef.current;
            if (!p || typeof p.getCurrentTime !== "function") return;
            const duration = p.getDuration();
            const cur = p.getCurrentTime();
            if (
              typeof duration !== "number" ||
              !Number.isFinite(duration) ||
              duration <= 0
            ) {
              return;
            }
            const delta = (e.key === "ArrowLeft" ? -5 : 5) / duration;
            const next = Math.max(0, Math.min(1, cur / duration + delta));
            p.seekTo(next * duration, true);
            setProgress(next * 100);
          }}
        >
          <div
            className="h-1 bg-[#E94560]"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      </div>
      
      {showLoadFallback ? (
        <div className="absolute inset-0 z-[15] flex flex-col items-center justify-center gap-4 bg-black/90 px-6 text-center">
          <p className="max-w-sm text-sm text-white/90">
            This video did not load in the player (blocked or network issue).
          </p>
          <a
            href={shortsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-[#E94560] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#ff5a75]"
          >
            Watch on YouTube
          </a>
        </div>
      ) : null}
    </>
  );
}

function RailButton({
  icon: Icon,
  label,
  onClick,
  href,
}: {
  icon: typeof ThumbsUp;
  label: string;
  onClick?: () => void;
  href?: string;
}) {
  const className =
    "flex h-11 w-11 flex-col items-center justify-center gap-0.5 rounded-full bg-black/50 text-white backdrop-blur-sm transition hover:bg-black/65 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/40";

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        title={label}
        aria-label={label}
      >
        <Icon className="h-5 w-5" strokeWidth={2} />
      </a>
    );
  }
  return (
    <button
      type="button"
      className={className}
      title={label}
      aria-label={label}
      onClick={onClick}
    >
      <Icon className="h-5 w-5" strokeWidth={2} />
    </button>
  );
}

export function ShortsImmersivePlayer({
  queue,
  activeVideoId,
  onActiveVideoIdChange,
  city = "Chicago",
}: ShortsImmersivePlayerProps) {
  const router = useRouter();
  const cityTrim = (city || "Chicago").trim() || "Chicago";

  const [overrideQueue, setOverrideQueue] = useState<
    ShortsImmersiveItem[] | null
  >(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [reactionsOpen, setReactionsOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const [showChrome, setShowChrome] = useState(false);
  const chromeHideTimerRef = useRef<number | null>(null);

  const revealChrome = useCallback(() => {
    setShowChrome(true);
    if (chromeHideTimerRef.current) {
      clearTimeout(chromeHideTimerRef.current);
    }
    chromeHideTimerRef.current = window.setTimeout(() => {
      setShowChrome(false);
      chromeHideTimerRef.current = null;
    }, CHROME_HIDE_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (chromeHideTimerRef.current) {
        clearTimeout(chromeHideTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!activeVideoId) setOverrideQueue(null);
  }, [activeVideoId]);

  useEffect(() => {
    setOverrideQueue(null);
  }, [queue]);

  useEffect(() => {
    if (!searchOpen) return;
    const id = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(id);
  }, [searchOpen]);

  const effectiveQueue = useMemo(
    () => overrideQueue ?? queue,
    [overrideQueue, queue],
  );

  const index = useMemo(() => {
    if (!activeVideoId) return -1;
    return effectiveQueue.findIndex((x) => x.videoId === activeVideoId);
  }, [effectiveQueue, activeVideoId]);

  const current = useMemo(() => {
    if (!activeVideoId) return null;
    if (index >= 0) return effectiveQueue[index];
    return effectiveQueue.find((x) => x.videoId === activeVideoId) ?? null;
  }, [effectiveQueue, activeVideoId, index]);

  useEffect(() => {
    if (!activeVideoId || !current) return;
    revealChrome();
  }, [activeVideoId, current?.videoId, revealChrome]);

  useEffect(() => {
    if (!activeVideoId) return;
    const onMove = () => revealChrome();
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [activeVideoId, revealChrome]);

  const goNext = useCallback(() => {
    revealChrome();
    if (index < 0 || index >= effectiveQueue.length - 1) return;
    onActiveVideoIdChange(effectiveQueue[index + 1]!.videoId);
  }, [index, effectiveQueue, onActiveVideoIdChange, revealChrome]);

  const goPrev = useCallback(() => {
    revealChrome();
    if (index <= 0) return;
    onActiveVideoIdChange(effectiveQueue[index - 1]!.videoId);
  }, [index, effectiveQueue, onActiveVideoIdChange, revealChrome]);

  const close = useCallback(() => {
    setSearchOpen(false);
    onActiveVideoIdChange(null);
  }, [onActiveVideoIdChange]);

  const shareShort = useCallback(async () => {
    if (!current) return;
    const url =
      current.source === "travello"
        ? typeof window !== "undefined"
          ? window.location.href
          : ""
        : `https://www.youtube.com/shorts/${current.videoId}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: current.title, url });
        return;
      }
    } catch {
      /* user cancelled or unsupported */
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    }
  }, [current]);

  const handleReaction = useCallback(async (type: string) => {
    if (!current || !current.id) {
      // If it's a pure YouTube short not imported yet, we might not have an ID
      return;
    }
    try {
      const token = getToken();
      const headers = new Headers();
      if (token) headers.set("Authorization", `Bearer ${token}`);
      
      const res = await fetch(`${API_BASE}/explorer/shorts/${current.id}/react?reaction_type=${type}`, {
        method: "POST",
        headers,
      });
      if (!res.ok) throw new Error("Failed to react");
    } catch (e) {
      console.error("Failed to react:", e);
    }
  }, [current]);

  const runExploreSearch = useCallback(async () => {
    const q = searchQuery.trim();
    if (!q) return;
    setSearchLoading(true);
    setSearchError(null);
    try {
      const token = getToken();
      const headers = new Headers();
      if (token) headers.set("Authorization", `Bearer ${token}`);
      const params = new URLSearchParams({
        city: cityTrim,
        tag: q.replace(/^#+/, ""),
      });
      const res = await fetch(`${API_BASE}/explore?${params.toString()}`, {
        headers,
      });
      if (!res.ok) {
        let msg = res.statusText || "Search failed";
        try {
          const j = (await res.json()) as { detail?: unknown };
          if (typeof j.detail === "string") msg = j.detail;
        } catch {
          /* keep msg */
        }
        throw new Error(msg);
      }
      const data = (await res.json()) as { shorts?: unknown };
      const next = parseShortsPayloadToQueue(data.shorts);
      if (next.length === 0) {
        setSearchError("No shorts found for that search.");
        return;
      }
      setOverrideQueue(next);
      onActiveVideoIdChange(next[0]!.videoId);
      setSearchOpen(false);
      setSearchQuery("");
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setSearchLoading(false);
    }
  }, [cityTrim, searchQuery, onActiveVideoIdChange]);

  const touchStartYRef = useRef<number | null>(null);

  const onModalTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartYRef.current = e.touches[0]?.clientY ?? null;
  }, []);

  const onModalTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      revealChrome();
      const start = touchStartYRef.current;
      touchStartYRef.current = null;
      if (start == null) return;
      const end = e.changedTouches[0]?.clientY;
      if (end == null) return;
      const deltaY = end - start;
      if (deltaY > 50) goNext();
      else if (deltaY < -50) goPrev();
    },
    [goNext, goPrev, revealChrome],
  );

  useEffect(() => {
    if (!activeVideoId) return;
    const handleWheel = (ev: WheelEvent) => {
      revealChrome();
      ev.preventDefault();
      if (ev.deltaY > 0) goNext();
      else if (ev.deltaY < 0) goPrev();
    };
    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleWheel);
  }, [activeVideoId, goNext, goPrev, revealChrome]);

  useEffect(() => {
    if (!activeVideoId) return;
    if (
      effectiveQueue.length === 0 ||
      !effectiveQueue.some((x) => x.videoId === activeVideoId)
    ) {
      onActiveVideoIdChange(null);
    }
  }, [activeVideoId, effectiveQueue, onActiveVideoIdChange]);

  useEffect(() => {
    if (!activeVideoId) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [activeVideoId]);

  useEffect(() => {
    if (!activeVideoId) return;
    const onKey = (e: KeyboardEvent) => {
      revealChrome();
      if (e.ctrlKey && e.key === "f") {
        e.preventDefault();
        setSearchOpen(true);
        return;
      }
      if (e.key === "Escape") {
        if (searchOpen) {
          e.preventDefault();
          setSearchOpen(false);
          return;
        }
        close();
        return;
      }
      const inSearch = (e.target as HTMLElement | null)?.closest?.(
        "[data-shorts-search-popover]",
      );
      if (
        inSearch &&
        (e.key === "ArrowUp" ||
          e.key === "ArrowDown" ||
          e.key === "j" ||
          e.key === "J" ||
          e.key === "k" ||
          e.key === "K")
      ) {
        return;
      }
      if (e.key === "ArrowDown" || e.key === "j" || e.key === "J") {
        e.preventDefault();
        goNext();
      }
      if (e.key === "ArrowUp" || e.key === "k" || e.key === "K") {
        e.preventDefault();
        goPrev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeVideoId, close, goNext, goPrev, searchOpen, revealChrome]);

  if (!activeVideoId || !current) return null;

  const source: ShortsVideoSource = current.source ?? "youtube";
  const isCreator = current.is_creator === true;

  const tagLinks = extractHashtagsFromText(
    `${current.title} ${current.description ?? ""}`,
    10,
  );

  const shortsUrl = `https://www.youtube.com/shorts/${current.videoId}`;
  const canPrev = index > 0;
  const canNext = index >= 0 && index < effectiveQueue.length - 1;
  const views =
    typeof current.viewCount === "number" && current.viewCount > 0
      ? `${formatCompactViews(current.viewCount)} views`
      : null;

  const chromeVisible = showChrome || searchOpen;
  const chromeOpacity = chromeVisible
    ? "pointer-events-auto opacity-100"
    : "pointer-events-none opacity-0";

  const frameStyle = {
    width: "min(100vw, 420px, calc(100dvh * 9 / 16))",
    aspectRatio: "9 / 16",
  } as const;

  return (
    <div
      className="fixed inset-0 z-[100] flex h-[100dvh] w-screen flex-col bg-black"
      role="dialog"
      aria-modal="true"
      aria-label="Shorts player"
      onMouseMove={revealChrome}
      onTouchStart={onModalTouchStart}
      onTouchEnd={onModalTouchEnd}
    >
      {searchOpen ? (
        <div
          className="fixed inset-0 z-[125] bg-black/60"
          aria-hidden
          onClick={() => setSearchOpen(false)}
        />
      ) : null}

      {searchOpen ? (
        <div
          data-shorts-search-popover
          className="fixed left-1/2 top-[max(1rem,env(safe-area-inset-top))] z-[130] w-[min(92vw,420px)] -translate-x-1/2 rounded-2xl border border-white/10 bg-[#1a1a1a] p-3 text-white shadow-2xl"
          role="search"
          onClick={(ev) => ev.stopPropagation()}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold">Find shorts by tag</span>
            <button
              type="button"
              className="rounded-full p-1 text-gray-400 transition hover:bg-white/10 hover:text-white"
              aria-label="Close search"
              onClick={() => setSearchOpen(false)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                ref={searchInputRef}
                type="search"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSearchError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void runExploreSearch();
                }}
                placeholder="e.g. food, skyline"
                className="w-full rounded-xl border border-white/15 bg-black/50 py-2 pl-9 pr-3 text-sm text-white placeholder:text-zinc-500 focus:border-[#E94560] focus:outline-none"
              />
            </div>
            <button
              type="button"
              disabled={searchLoading || !searchQuery.trim()}
              onClick={() => void runExploreSearch()}
              className="shrink-0 rounded-xl bg-[#E94560] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#ff5a75] disabled:opacity-50"
            >
              {searchLoading ? "…" : "Go"}
            </button>
          </div>
          {searchError ? (
            <p className="mt-2 text-xs text-red-300">{searchError}</p>
          ) : null}
          <p className="mt-2 text-[10px] text-zinc-500">
            Ctrl+F · Esc closes search
          </p>
        </div>
      ) : null}

      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        <button
          type="button"
          disabled={!canPrev}
          onClick={goPrev}
          className={`absolute left-2 z-[40] flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 disabled:pointer-events-none disabled:opacity-0 sm:left-4 md:h-12 md:w-12 ${chromeOpacity}`}
          aria-label="Previous short"
        >
          <ChevronUp className="h-6 w-6 md:h-7 md:w-7" strokeWidth={2} />
        </button>

        <button
          type="button"
          disabled={!canNext}
          onClick={goNext}
          className={`absolute right-2 z-[40] flex h-11 w-11 items-center justify-center rounded-full bg-white text-black transition hover:bg-white/90 disabled:pointer-events-none disabled:opacity-0 sm:right-4 md:h-12 md:w-12 ${chromeOpacity}`}
          aria-label="Next short"
        >
          <ChevronDown className="h-6 w-6 md:h-7 md:w-7" strokeWidth={2} />
        </button>

        <div
          key={current.videoId}
          className="shorts-player-slide-in relative overflow-hidden bg-black"
          style={frameStyle}
        >
          <ShortsYoutubeIframe
            videoId={current.videoId}
            shortsUrl={shortsUrl}
          />

          <div
            className={`absolute inset-0 z-20 flex flex-col justify-between transition-opacity duration-300 ${chromeOpacity}`}
          >
            <div
              className="pointer-events-none absolute left-3 top-[max(0.75rem,env(safe-area-inset-top))] z-30"
              aria-hidden
            >
              {source === "travello" && (
                <span className="rounded-full bg-[#E94560] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
                  Travello
                </span>
              )}
            </div>

            <div
              className="flex shrink-0 items-start justify-between gap-2 bg-gradient-to-b from-black/70 to-transparent p-3 pb-8 pt-[max(0.75rem,env(safe-area-inset-top))] sm:p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <CityTag cityName={cityTrim} />
              <button
                type="button"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition hover:bg-black/70"
                aria-label="Close"
                onClick={close}
              >
                <X className="h-5 w-5" strokeWidth={2.25} />
              </button>
            </div>

            <div className="relative flex flex-1 items-end">
              {/* Bottom text overlays removed to prevent clashing with YouTube native UI */}

              <div className="absolute top-1/2 -translate-y-1/2 right-2 flex flex-col gap-3 sm:right-3">
                <RailButton
                  icon={ThumbsUp}
                  label="Like"
                  onClick={() => handleReaction("like")}
                />
                <RailButton
                  icon={ThumbsDown}
                  label="Dislike"
                  onClick={() => handleReaction("dislike")}
                />
                <div className="relative">
                  {reactionsOpen && (
                    <div className="absolute bottom-0 right-14 flex flex-col gap-2 rounded-2xl border border-[#1e4976] bg-[#1a3554]/90 p-2 backdrop-blur-sm shadow-xl">
                      <button className="text-xs font-semibold text-white hover:text-[#E94560] p-1 whitespace-nowrap" onClick={() => { handleReaction("love"); setReactionsOpen(false); }}>😍 Love this!</button>
                      <button className="text-xs font-semibold text-white hover:text-[#E94560] p-1 whitespace-nowrap" onClick={() => { handleReaction("helpful"); setReactionsOpen(false); }}>🔥 Super helpful</button>
                      <button className="text-xs font-semibold text-white hover:text-[#E94560] p-1 whitespace-nowrap" onClick={() => { handleReaction("list"); setReactionsOpen(false); }}>📍 Adding to list</button>
                    </div>
                  )}
                  <RailButton
                    icon={MessageCircle}
                    label="Comment"
                    onClick={() => setReactionsOpen(!reactionsOpen)}
                  />
                </div>
                <RailButton icon={Share2} label="Share" onClick={shareShort} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
