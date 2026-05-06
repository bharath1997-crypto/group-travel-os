"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  ChevronRight,
  MapPin,
  Newspaper,
  Play,
  Sparkles,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { apiFetch } from "@/lib/api";
import {
  ExplorerNewsReaderModal,
  type NewsReaderArticle,
} from "@/components/explorer/ExplorerNewsReaderModal";

const CORAL = "#E94560";

type ExploreFeedPayload = {
  city?: string;
  news?: unknown;
  shorts?: unknown;
};

export type ExplorerMediaFeedProps = {
  /** City query for `/api/v1/explore` — defaults to Chicago */
  city?: string;
  className?: string;
};

type NormalizedShort = {
  key: string;
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
};

type NormalizedNews = {
  key: string;
  title: string;
  snippet: string;
  url: string;
  domain?: string;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return null;
}

function pickString(obj: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function normalizeNewsItems(raw: unknown): NormalizedNews[] {
  if (!Array.isArray(raw)) return [];
  const out: NormalizedNews[] = [];
  raw.forEach((item) => {
    const o = asRecord(item);
    if (!o) return;
    const title = pickString(o, ["title", "headline"]);
    const url = pickString(o, ["url", "link", "original_url"]);
    const snippet = pickString(o, [
      "snippet",
      "description",
      "extended_snippet",
      "text",
    ]);
    if (!title || !/^https?:\/\//i.test(url)) return;
    const domain =
      pickString(o, ["domain", "source"]) ||
      (() => {
        try {
          if (!url) return "";
          const host = new URL(url).hostname.replace(/^www\./, "");
          return host;
        } catch {
          return "";
        }
      })();
    out.push({
      key: url,
      title,
      snippet:
        snippet ||
        "Open the source for the full story — pull to refresh later for more context.",
      url,
      domain: domain || undefined,
    });
  });
  return out;
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

function shortsPayloadToTrendingArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const t = (raw as Record<string, unknown>).trending;
    if (Array.isArray(t)) return t;
  }
  return [];
}

function normalizeShorts(raw: unknown): NormalizedShort[] {
  const arr = Array.isArray(raw) ? raw : [];
  const out: NormalizedShort[] = [];
  arr.forEach((item, index) => {
    const o = asRecord(item);
    if (!o) return;
    const idBlock = asRecord(o.id) ?? o;
    const videoId =
      pickString(idBlock as Record<string, unknown>, ["videoId"]) ||
      pickString(o, ["videoId", "video_id"]);
    if (!videoId) return;
    const sn = asRecord(o.snippet);
    const title = sn ? pickString(sn, ["title"]) : "";
    const channelTitle = sn ? pickString(sn, ["channelTitle"]) : "";
    const thumbnailUrl = sn ? thumbnailFromSnippet(sn) : "";
    out.push({
      key: videoId || `short-${index}`,
      videoId,
      title: title || "Short video",
      channelTitle: channelTitle || "YouTube",
      thumbnailUrl: thumbnailUrl || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    });
  });
  return out;
}

function ShortsRowSkeleton() {
  return (
    <div className="flex gap-3 overflow-hidden pb-1 pl-1 pr-1 pt-1">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="relative h-[280px] w-[158px] shrink-0 overflow-hidden rounded-2xl border border-[#1e4976] bg-[#162d4a]"
        >
          <div className="absolute inset-0 animate-pulse bg-gradient-to-b from-[#1e4976]/40 via-[#162d4a] to-[#162d4a]" />
          <div className="absolute bottom-3 left-3 right-3 h-12 rounded-lg bg-[#1e4976]/50" />
        </div>
      ))}
    </div>
  );
}

function NewsGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-2xl border border-[#1e4976] bg-[#162d4a] p-5"
        >
          <div className="mb-4 h-3 w-24 animate-pulse rounded-full bg-[#1e4976]/60" />
          <div className="mb-2 h-5 w-full animate-pulse rounded-md bg-[#1e4976]/35" />
          <div className="mb-2 h-5 w-4/5 animate-pulse rounded-md bg-[#1e4976]/30" />
          <div className="mt-4 h-16 w-full animate-pulse rounded-lg bg-[#1e4976]/25" />
        </div>
      ))}
    </div>
  );
}

export function ExplorerMediaFeed({
  city = "Chicago",
  className = "",
}: ExplorerMediaFeedProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<ExploreFeedPayload | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [newsReaderArticle, setNewsReaderArticle] =
    useState<NewsReaderArticle | null>(null);
  const [visibleNewsCount, setVisibleNewsCount] = useState(12);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const newsSentinelRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<ExploreFeedPayload>(
        `/explore?city=${encodeURIComponent(city)}`,
        { signal },
      );
      setPayload(data);
    } catch (e) {
      if (
        e instanceof Error &&
        (e.name === "AbortError" || e.message === "canceled")
      ) {
        return;
      }
      setError(
        e instanceof Error ? e.message : "Could not load explore content",
      );
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, [city]);

  useEffect(() => {
    const ac = new AbortController();
    void load(ac.signal);
    return () => ac.abort();
  }, [load]);

  const shorts = useMemo(
    () => normalizeShorts(shortsPayloadToTrendingArray(payload?.shorts)),
    [payload?.shorts],
  );
  const news = useMemo(() => normalizeNewsItems(payload?.news), [payload?.news]);

  useEffect(() => {
    setVisibleNewsCount(12);
  }, [news]);

  const visibleNews = useMemo(
    () => news.slice(0, visibleNewsCount),
    [news, visibleNewsCount],
  );
  const hasMoreNews = visibleNewsCount < news.length;

  useEffect(() => {
    if (!hasMoreNews || loading) return;
    const node = newsSentinelRef.current;
    if (!node) return;
    const ob = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleNewsCount((c) => Math.min(c + 12, news.length));
        }
      },
      { rootMargin: "240px", threshold: 0 },
    );
    ob.observe(node);
    return () => ob.disconnect();
  }, [hasMoreNews, loading, news.length]);

  const loadMoreNews = useCallback(() => {
    setVisibleNewsCount((c) => Math.min(c + 12, news.length));
  }, [news.length]);

  const displayCity = payload?.city?.trim() || city;

  const scrollShorts = (dir: -1 | 1) => {
    const el = scrollRef.current;
    if (!el) return;
    const delta = dir * Math.min(el.clientWidth * 0.85, 420);
    el.scrollBy({ left: delta, behavior: "smooth" });
  };

  return (
    <>
    <section
      className={`rounded-3xl border border-[#1e4976] bg-[#1E3A5F] p-5 shadow-lg shadow-black/20 sm:p-6 ${className}`.trim()}
      aria-label="City media explore feed"
    >
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-white">
            <Sparkles className="h-3.5 w-3.5" style={{ color: CORAL }} aria-hidden />
            Live city pulse
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-[1.65rem]">
            Stories &amp; headlines
          </h2>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-300">
            <MapPin className="h-4 w-4 shrink-0" style={{ color: CORAL }} aria-hidden />
            <span>
              Curated for{" "}
              <span className="font-semibold text-white">{displayCity}</span>
            </span>
          </p>
        </div>
        {!loading && error ? (
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-[#1e4976] bg-[#162d4a] px-4 py-2.5 text-sm font-semibold text-white transition hover:border-[#E94560]/50 hover:bg-[#1a3554] motion-reduce:transition-none"
          >
            Try again
          </button>
        ) : null}
      </header>

      {loading ? (
        <div className="space-y-10">
          <div>
            <div className="mb-4 flex items-center gap-2">
              <div className="h-9 w-9 animate-pulse rounded-xl bg-[#1e4976]/50" />
              <div className="h-4 w-32 animate-pulse rounded bg-[#1e4976]/40" />
            </div>
            <ShortsRowSkeleton />
          </div>
          <div>
            <div className="mb-4 flex items-center gap-2">
              <div className="h-9 w-9 animate-pulse rounded-xl bg-[#1e4976]/50" />
              <div className="h-4 w-40 animate-pulse rounded bg-[#1e4976]/40" />
            </div>
            <NewsGridSkeleton />
          </div>
        </div>
      ) : error ? (
        <div
          role="alert"
          className="rounded-2xl border border-red-400 bg-[#162d4a] px-4 py-5 text-sm text-red-300"
        >
          <p className="font-semibold text-red-300">Something went wrong</p>
          <p className="mt-1 text-red-300/90">{error}</p>
        </div>
      ) : (
        <>
          {/* —— Shorts carousel —— */}
          <div className="relative mb-10">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#1e4976] bg-[#162d4a] shadow-inner shadow-black/30 ring-1 ring-[#1e4976]/80"
                  aria-hidden
                >
                  <Play className="h-4 w-4 fill-white text-white" />
                </span>
                <div>
                  <Link
                    href={`/explore/shorts?city=${encodeURIComponent(city)}`}
                    className="block w-fit cursor-pointer text-base font-bold text-white hover:underline"
                  >
                    Travel shorts
                  </Link>
                  <p className="text-xs text-gray-300">Swipe or scroll — tap to play in place</p>
                </div>
              </div>
              <div className="hidden items-center gap-1 sm:flex">
                <button
                  type="button"
                  aria-label="Scroll shorts left"
                  onClick={() => scrollShorts(-1)}
                  className="rounded-lg border border-[#1e4976] bg-[#162d4a] p-2 text-gray-300 transition hover:border-[#E94560]/45 hover:bg-[#1a3554] hover:text-white motion-reduce:transition-none"
                >
                  <ChevronRight className="h-4 w-4 rotate-180" />
                </button>
                <button
                  type="button"
                  aria-label="Scroll shorts right"
                  onClick={() => scrollShorts(1)}
                  className="rounded-lg border border-[#1e4976] bg-[#162d4a] p-2 text-gray-300 transition hover:border-[#E94560]/45 hover:bg-[#1a3554] hover:text-white motion-reduce:transition-none"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div
              className="pointer-events-none absolute left-0 top-[3.25rem] z-10 h-[280px] w-10 bg-gradient-to-r from-[#1E3A5F] to-transparent sm:top-[3.5rem]"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute right-0 top-[3.25rem] z-10 h-[280px] w-10 bg-gradient-to-l from-[#1E3A5F] to-transparent sm:top-[3.5rem]"
              aria-hidden
            />

            {shorts.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-[#1e4976] bg-[#162d4a] px-4 py-10 text-center text-sm text-gray-300">
                No shorts yet for this city — check back after the cache refreshes.
              </p>
            ) : (
              <div
                ref={scrollRef}
                className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 pl-1 pr-1 pt-1 scrollbar-thin scrollbar-track-[#1E3A5F] scrollbar-thumb-[#1e4976] [scrollbar-color:#1e4976_#1E3A5F] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#1e4976] [&::-webkit-scrollbar-track]:bg-[#1E3A5F]"
              >
                {shorts.map((s) => {
                  const isPlaying = playingId === s.videoId;
                  const ytShortsUrl = `https://www.youtube.com/shorts/${s.videoId}`;
                  const embedUrl = `https://www.youtube.com/embed/${s.videoId}?autoplay=1&mute=0&playsinline=1&rel=0`;
                  return (
                    <article
                      key={s.key}
                      className="group relative snap-center snap-always"
                    >
                      <div className="relative h-[280px] w-[158px] overflow-hidden rounded-2xl border border-[#1e4976] bg-[#162d4a] shadow-md shadow-black/30 transition duration-500 ease-out will-change-transform hover:-translate-y-1 hover:border-[#E94560]/50 hover:shadow-lg motion-reduce:transition-none motion-reduce:hover:transform-none sm:h-[320px] sm:w-[180px]">
                        {isPlaying ? (
                          <div className="relative h-full w-full bg-black">
                            <iframe
                              title={s.title}
                              src={embedUrl}
                              className="absolute inset-0 h-full w-full border-0"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                              allowFullScreen
                            />
                            <button
                              type="button"
                              aria-label="Close video"
                              className="absolute right-2 top-2 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/65 text-white backdrop-blur-md transition hover:bg-black/80"
                              onClick={() => setPlayingId(null)}
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={s.thumbnailUrl}
                              alt=""
                              className="h-full w-full object-cover transition duration-500 ease-out group-hover:scale-[1.06] motion-reduce:group-hover:scale-100"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-indigo-900/30" />
                            <button
                              type="button"
                              className="absolute inset-0 z-10 flex flex-col justify-end p-3 text-left transition hover:bg-black/10"
                              onClick={() =>
                                setPlayingId((id) =>
                                  id === s.videoId ? null : s.videoId,
                                )
                              }
                              aria-label={`Play short: ${s.title}`}
                            >
                              <span className="mb-3 flex h-11 w-11 items-center justify-center self-center rounded-full bg-white/95 text-black shadow-lg ring-2 ring-[#E94560]/60 transition duration-300 group-hover:scale-110 group-hover:ring-[#E94560] motion-reduce:transition-none motion-reduce:group-hover:scale-100">
                                <Play className="ml-0.5 h-5 w-5 fill-current" />
                              </span>
                              <span className="line-clamp-2 text-xs font-semibold leading-snug text-white drop-shadow-md">
                                {s.title}
                              </span>
                              <span className="mt-1 line-clamp-1 text-[10px] font-medium uppercase tracking-wide text-gray-300">
                                {s.channelTitle}
                              </span>
                            </button>
                            <a
                              href={ytShortsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="absolute right-2 top-2 z-20 flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/90 backdrop-blur-md transition hover:bg-black/75 hover:text-white"
                              onClick={(e) => e.stopPropagation()}
                            >
                              YouTube
                              <ArrowUpRight className="h-3 w-3" />
                            </a>
                          </>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          {/* —— News grid —— */}
          <div>
            <div className="mb-4 flex items-center gap-2.5">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#1e4976] bg-[#162d4a] shadow-inner shadow-black/30 ring-1 ring-[#1e4976]/80"
                aria-hidden
              >
                <Newspaper className="h-4 w-4 text-white" />
              </span>
              <div>
                <h3 className="text-base font-bold text-white">Local news desk</h3>
                <p className="text-xs text-gray-300">Fresh headlines from the open web</p>
              </div>
            </div>

            {news.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-[#1e4976] bg-[#162d4a] px-4 py-10 text-center text-sm text-gray-300">
                No news articles cached for this city yet.
              </p>
            ) : (
              <>
                <div className="columns-1 gap-4 space-y-4 sm:columns-2 xl:columns-3">
                  {visibleNews.map((article, index) => (
                    <button
                      key={`${article.key}__${index}`}
                      type="button"
                      onClick={() =>
                        setNewsReaderArticle({
                          url: article.url,
                          title: article.title,
                          domain: article.domain,
                        })
                      }
                      className="group block w-full break-inside-avoid rounded-2xl border border-[#1e4976] bg-[#162d4a] text-left transition duration-300 hover:-translate-y-0.5 hover:border-[#E94560]/40 hover:shadow-lg hover:shadow-black/25 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                    >
                      <div className="rounded-[0.9rem] bg-[#162d4a] p-4 sm:p-5">
                        {article.domain ? (
                          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">
                            {article.domain}
                          </p>
                        ) : null}
                        <h4 className="text-[15px] font-bold leading-snug text-white transition duration-300 group-hover:text-[#E94560] motion-reduce:transition-none sm:text-base">
                          {article.title}
                        </h4>
                        <p className="mt-2 line-clamp-4 text-sm leading-relaxed text-gray-300">
                          {article.snippet}
                        </p>
                        <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-gray-300 transition group-hover:gap-2 group-hover:text-[#E94560]">
                          Read article
                          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
                {hasMoreNews ? (
                  <>
                    <div
                      ref={newsSentinelRef}
                      className="h-1 w-full shrink-0"
                      aria-hidden
                    />
                    <div className="mt-6 flex justify-center">
                      <button
                        type="button"
                        onClick={loadMoreNews}
                        className="rounded-xl border border-[#1e4976] bg-[#162d4a] px-5 py-2.5 text-sm font-semibold text-white hover:border-[#E94560]/50"
                      >
                        Load more ({news.length - visibleNewsCount} left)
                      </button>
                    </div>
                  </>
                ) : null}
              </>
            )}
          </div>
        </>
      )}
    </section>
    <ExplorerNewsReaderModal
      article={newsReaderArticle}
      onClose={() => setNewsReaderArticle(null)}
    />
    </>
  );
}

export default ExplorerMediaFeed;
