"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Play } from "lucide-react";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";

import {
  ShortsImmersivePlayer,
  type ShortsImmersiveItem,
} from "@/components/explorer/ShortsImmersivePlayer";
import { CityTag } from "@/components/shared/CityTag";
import { getToken } from "@/lib/auth";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

type ExplorePayload = {
  city?: string;
  tag?: string | null;
  shorts?: unknown;
};

type ShortItem = {
  key: string;
  id?: string;
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  viewCount: number;
  publishedAtMs: number;
  source?: string;
  is_creator?: boolean;
};

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

function publishedAtMsFromSnippet(sn: Record<string, unknown> | null): number {
  if (!sn) return 0;
  const raw = pickString(sn, ["publishedAt"]);
  if (!raw) return 0;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? t : 0;
}

function parseViewCount(item: Record<string, unknown>): number {
  const st = asRecord(item.statistics);
  if (!st) return 0;
  const raw = st.viewCount;
  if (typeof raw === "string") {
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : 0;
  }
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  return 0;
}

function normalizeShortItemList(raw: unknown): ShortItem[] {
  if (!Array.isArray(raw)) return [];
  const out: ShortItem[] = [];
  raw.forEach((item, index) => {
    const o = asRecord(item);
    if (!o) return;
    const idBlock = asRecord(o.id) ?? o;
    const videoId =
      pickString(idBlock as Record<string, unknown>, ["videoId"]) ||
      pickString(o, ["videoId", "video_id"]);
    if (!videoId) return;
    const id = pickString(o, ["id"]);
    const source = pickString(o, ["source"]);
    const is_creator = o.is_creator === true;
    
    const sn = asRecord(o.snippet);
    const title = sn ? pickString(sn, ["title"]) : "";
    const channelTitle = sn ? pickString(sn, ["channelTitle"]) : "";
    const thumbnailUrl = sn ? thumbnailFromSnippet(sn) : "";
    out.push({
      key: `${videoId}-${index}`,
      id: id || undefined,
      videoId,
      title: title || "Short video",
      channelTitle: channelTitle || "YouTube",
      thumbnailUrl:
        thumbnailUrl || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      viewCount: parseViewCount(o),
      publishedAtMs: publishedAtMsFromSnippet(sn),
      source: source || undefined,
      is_creator,
    });
  });
  return out;
}

function parseExploreShortsPayload(shorts: unknown): {
  trending: ShortItem[];
  recent: ShortItem[];
} {
  if (shorts && typeof shorts === "object" && !Array.isArray(shorts)) {
    const o = shorts as Record<string, unknown>;
    const trending = normalizeShortItemList(o.trending);
    const recent = normalizeShortItemList(o.recent);
    trending.sort((a, b) => b.viewCount - a.viewCount);
    recent.sort((a, b) => b.publishedAtMs - a.publishedAtMs);
    return { trending, recent };
  }
  const flat = normalizeShortItemList(shorts);
  flat.sort((a, b) => b.viewCount - a.viewCount);
  return { trending: flat, recent: [] };
}

/** Distinct hashtag tokens from titles (#tag, case-insensitive dedupe). */
function extractHashtagsFromShortItems(
  trending: ShortItem[],
  recent: ShortItem[],
  max = 20,
): string[] {
  const re = /#[\p{L}\p{M}\p{N}_]+/gu;
  const seen = new Set<string>();
  const out: string[] = [];
  const scan = (text: string) => {
    for (const m of text.matchAll(re)) {
      const full = m[0];
      const key = full.slice(1).toLowerCase();
      if (key.length < 2) continue;
      if (!seen.has(key)) {
        seen.add(key);
        out.push(full);
        if (out.length >= max) return;
      }
    }
  };
  for (const s of trending) {
    scan(s.title);
    if (out.length >= max) return out;
  }
  for (const s of recent) {
    scan(s.title);
    if (out.length >= max) return out;
  }
  return out;
}

export function formatCompactViews(n: number): string {
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return `${v >= 10 ? Math.round(v) : v.toFixed(1).replace(/\.0$/, "")}M views`;
  }
  if (n >= 1_000) {
    const v = n / 1_000;
    return `${v >= 100 ? Math.round(v) : v.toFixed(1).replace(/\.0$/, "")}K views`;
  }
  if (n > 0) return `${n.toLocaleString()} views`;
  return "Short";
}

async function fetchExploreShorts(
  city: string,
  options?: { tag?: string | null; signal?: AbortSignal },
): Promise<ExplorePayload> {
  const { tag, signal } = options ?? {};
  const token = getToken();
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const params = new URLSearchParams({ city });
  const tagTrim = tag?.trim().replace(/^#+/, "") ?? "";
  if (tagTrim) params.set("tag", tagTrim);
  const res = await fetch(`${API_BASE}/explore?${params.toString()}`, {
    signal,
    headers,
  });
  if (!res.ok) {
    let msg = res.statusText || "Request failed";
    try {
      const j = (await res.json()) as { detail?: unknown };
      if (typeof j.detail === "string") msg = j.detail;
    } catch {
      /* keep msg */
    }
    throw new Error(msg);
  }
  return res.json() as Promise<ExplorePayload>;
}

function TrendingRowSkeleton() {
  return (
    <div className="flex gap-3 overflow-hidden pb-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="h-[240px] w-[135px] shrink-0 animate-pulse rounded-2xl border border-[#1e4976] bg-[#162d4a]"
        />
      ))}
    </div>
  );
}

function RecentGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="aspect-[9/16] animate-pulse rounded-2xl border border-[#1e4976] bg-[#162d4a]"
        />
      ))}
    </div>
  );
}

function PageFallback() {
  return (
    <div className="min-h-full bg-[#1E3A5F] px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 h-8 w-48 animate-pulse rounded-lg bg-[#162d4a]" />
        <div className="mb-2 h-5 w-32 animate-pulse rounded bg-[#162d4a]/80" />
        <TrendingRowSkeleton />
        <div className="mb-2 mt-8 h-5 w-40 animate-pulse rounded bg-[#162d4a]/80" />
        <RecentGridSkeleton />
      </div>
    </div>
  );
}

type ShortsHashtagChipProps = {
  label: string;
  city: string;
  slug: string | null;
  active: boolean;
};

function ShortsHashtagChip({
  label,
  city,
  slug,
  active,
}: ShortsHashtagChipProps) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        if (!slug) {
          router.push(`/explore/shorts?city=${encodeURIComponent(city)}`);
          return;
        }
        router.push(
          `/explore/shorts?city=${encodeURIComponent(city)}&tag=${encodeURIComponent(slug)}`,
        );
      }}
      className={
        active
          ? "shrink-0 rounded-full border border-[#E94560] bg-[#1a3554] px-3 py-1 text-xs font-semibold text-white shadow-sm"
          : "shrink-0 rounded-full border border-[#1e4976] bg-[#162d4a] px-3 py-1 text-xs font-medium text-[#E94560] transition hover:border-[#E94560]/80 hover:text-white"
      }
    >
      {label}
    </button>
  );
}

type CardProps = {
  item: ShortItem;
  variant: "trending" | "recent";
  onOpen: () => void;
};

function ShortCardButton({ item, variant, onOpen }: CardProps) {
  const isTrending = variant === "trending";
  return (
    <button
      type="button"
      onClick={onOpen}
      className={
        isTrending
          ? "group relative h-[260px] w-[148px] shrink-0 snap-start overflow-hidden rounded-2xl border border-[#1e4976] bg-[#162d4a] text-left shadow-lg transition hover:-translate-y-0.5 hover:border-[#E94560]/50 sm:h-[280px] sm:w-[158px]"
          : "group relative aspect-[9/16] w-full overflow-hidden rounded-2xl border border-[#1e4976] bg-[#162d4a] text-left shadow-lg transition hover:-translate-y-0.5 hover:border-[#E94560]/50"
      }
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.thumbnailUrl}
        alt=""
        className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent" />
      {isTrending ? (
        <span className="absolute left-2 top-2 rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-semibold text-white">
          {formatCompactViews(item.viewCount)}
        </span>
      ) : null}
      <span className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-black shadow-lg ring-2 ring-[#E94560]/60 opacity-95 transition group-hover:scale-110">
        <Play className="ml-0.5 h-5 w-5 fill-current" />
      </span>
      <div className="absolute inset-x-0 bottom-0 p-3">
        <p className="line-clamp-2 text-sm font-semibold leading-snug text-white">
          {item.title}
        </p>
        <p className="mt-1 truncate text-[11px] text-gray-300">
          {item.channelTitle}
        </p>
      </div>
    </button>
  );
}

function ExploreShortsContent() {
  const searchParams = useSearchParams();
  const city = searchParams.get("city")?.trim() || "Chicago";
  const tagParamRaw = searchParams.get("tag")?.trim() || "";
  const tagSlug = tagParamRaw.replace(/^#+/, "").toLowerCase();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trending, setTrending] = useState<ShortItem[]>([]);
  const [recent, setRecent] = useState<ShortItem[]>([]);
  const [modalVideoId, setModalVideoId] = useState<string | null>(null);

  const playbackQueue = useMemo(() => {
    const seen = new Set<string>();
    const q: ShortsImmersiveItem[] = [];
    const push = (s: ShortItem) => {
      if (seen.has(s.videoId)) return;
      seen.add(s.videoId);
      q.push({
        id: s.id,
        videoId: s.videoId,
        title: s.title,
        channelTitle: s.channelTitle,
        thumbnailUrl: s.thumbnailUrl,
        viewCount: s.viewCount,
        source: s.source as any,
        is_creator: s.is_creator,
      });
    };
    trending.forEach(push);
    recent.forEach(push);
    return q;
  }, [trending, recent]);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchExploreShorts(city, {
          signal,
          tag: tagSlug || null,
        });
        const parsed = parseExploreShortsPayload(data.shorts);
        setTrending(parsed.trending);
        setRecent(parsed.recent);
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
        setError(e instanceof Error ? e.message : "Could not load shorts");
        setTrending([]);
        setRecent([]);
      } finally {
        setLoading(false);
      }
    },
    [city, tagSlug],
  );

  useEffect(() => {
    const ac = new AbortController();
    void load(ac.signal);
    return () => ac.abort();
  }, [load]);

  const hasAny = trending.length > 0 || recent.length > 0;

  const hashtagLabels = useMemo(
    () => extractHashtagsFromShortItems(trending, recent),
    [trending, recent],
  );

  return (
    <div className="min-h-full bg-[#1E3A5F] px-4 py-6 text-white sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <Link
              href="/explorer"
              className="mb-1 inline-block text-sm text-gray-300 hover:text-white hover:underline"
            >
              ← Back to Explorer
            </Link>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
              Travel shorts
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-300">
              <CityTag cityName={city} />
              {tagSlug ? (
                <span>
                  · Filter:{" "}
                  <span className="font-semibold text-[#E94560]">
                    #{tagSlug}
                  </span>
                </span>
              ) : (
                <span>· Trending by views, then newest uploads</span>
              )}
            </p>
          </div>
          {!loading && error ? (
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-xl border border-[#1e4976] bg-[#162d4a] px-4 py-2 text-sm font-semibold text-white hover:border-[#E94560]/50"
            >
              Try again
            </button>
          ) : null}
        </div>

        {!loading && hashtagLabels.length > 0 ? (
          <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-[#1e4976]/80 pb-5">
            <span className="w-full text-[11px] font-bold uppercase tracking-wide text-gray-400 sm:w-auto">
              Hashtags in feed
            </span>
            {tagSlug ? (
              <ShortsHashtagChip
                label="All"
                city={city}
                slug={null}
                active={false}
              />
            ) : null}
            {hashtagLabels.map((h) => {
              const slug = h.slice(1).toLowerCase();
              return (
                <ShortsHashtagChip
                  key={slug}
                  label={h}
                  city={city}
                  slug={slug}
                  active={tagSlug === slug}
                />
              );
            })}
          </div>
        ) : null}

        {loading ? (
          <>
            <h2 className="mb-3 text-sm font-bold text-white">🔥 Trending</h2>
            <TrendingRowSkeleton />
            <h2 className="mb-3 mt-8 text-sm font-bold text-white">
              🆕 Recent Uploads
            </h2>
            <RecentGridSkeleton />
          </>
        ) : error ? (
          <div
            role="alert"
            className="rounded-2xl border border-red-400 bg-[#162d4a] px-4 py-5 text-red-300"
          >
            <p className="font-semibold">Something went wrong</p>
            <p className="mt-1 text-sm opacity-90">{error}</p>
          </div>
        ) : !hasAny ? (
          <p className="rounded-2xl border border-dashed border-[#1e4976] bg-[#162d4a] px-4 py-12 text-center text-gray-300">
            No shorts found for this city yet.
          </p>
        ) : (
          <>
            {trending.length > 0 ? (
              <section className="mb-10">
                <h2 className="mb-3 text-sm font-bold tracking-wide text-white">
                  🔥 Trending
                </h2>
                <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-color:#1e4976_#1E3A5F] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#1e4976] [&::-webkit-scrollbar-track]:bg-[#1E3A5F]">
                  {trending.map((s) => (
                    <ShortCardButton
                      key={s.key}
                      item={s}
                      variant="trending"
                      onOpen={() => setModalVideoId(s.videoId)}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            {recent.length > 0 ? (
              <section>
                <h2 className="mb-3 text-sm font-bold tracking-wide text-white">
                  🆕 Recent Uploads
                </h2>
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
                  {recent.map((s) => (
                    <ShortCardButton
                      key={s.key}
                      item={s}
                      variant="recent"
                      onOpen={() => setModalVideoId(s.videoId)}
                    />
                  ))}
                </div>
              </section>
            ) : null}
          </>
        )}
      </div>

      <ShortsImmersivePlayer
        queue={playbackQueue}
        activeVideoId={modalVideoId}
        onActiveVideoIdChange={setModalVideoId}
        city={city}
      />
    </div>
  );
}

export default function ExploreShortsPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <ExploreShortsContent />
    </Suspense>
  );
}
