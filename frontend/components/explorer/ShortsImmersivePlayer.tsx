"use client";

import {
  ChevronDown,
  ChevronUp,
  MessageCircle,
  Pause,
  Play,
  Search,
  Share2,
  Square,
  SkipBack,
  SkipForward,
  ThumbsDown,
  ThumbsUp,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";

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

export type ShortsYoutubePlayerHandle = {
  stop: () => void;
  togglePlay: () => void;
  skipSeconds: (delta: number) => void;
};

type ShortsYoutubeIframeProps = {
  videoId: string;
  shortsUrl: string;
};

const ShortsYoutubeIframe = forwardRef<
  ShortsYoutubePlayerHandle | null,
  ShortsYoutubeIframeProps
>(function ShortsYoutubeIframe({ videoId, shortsUrl }, ref) {
  const [showLoadFallback, setShowLoadFallback] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [volume, setVolume] = useState(100);
  const [muted, setMuted] = useState(false);
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressTrackRef = useRef<HTMLDivElement>(null);
  const loadTimerRef = useRef<number | null>(null);
  const draggingProgressRef = useRef(false);

  useEffect(() => {
    setProgress(0);
  }, [videoId]);

  useEffect(() => {
    let raf = 0;
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      if (!isPlaying) return;
      if (!draggingProgressRef.current) {
        const p = playerRef.current;
        if (p && typeof p.getCurrentTime === "function") {
          const current = p.getCurrentTime();
          const duration = p.getDuration();
          if (
            typeof duration === "number" &&
            Number.isFinite(duration) &&
            duration > 0
          ) {
            const cur =
              typeof current === "number" && Number.isFinite(current)
                ? current
                : 0;
            setProgress((cur / duration) * 100);
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };

    if (isPlaying) {
      raf = requestAnimationFrame(tick);
    }

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [videoId, isPlaying]);

  const seekFromClientX = useCallback((clientX: number) => {
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
      Math.min(1, (clientX - rect.left) / rect.width),
    );
    p.seekTo(ratio * duration, true);
    setProgress(ratio * 100);
  }, []);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!draggingProgressRef.current) return;
      seekFromClientX(e.clientX);
    };
    const onUp = () => {
      draggingProgressRef.current = false;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [seekFromClientX]);

  const onProgressPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    draggingProgressRef.current = true;
    seekFromClientX(e.clientX);
  };

  useEffect(() => {
    loadTimerRef.current = window.setTimeout(() => {
      setShowLoadFallback(true);
      loadTimerRef.current = null;
    }, 12_000);

    if (!(window as any).YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
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
        videoId,
        playerVars: {
          autoplay: 1,
          controls: 0,
          modestbranding: 1,
          loop: 1,
          playlist: videoId,
          rel: 0,
        },
        events: {
          onReady: (event: any) => {
            event.target.playVideo();
            try {
              event.target.unMute();
              event.target.setVolume(100);
            } catch {
              /* ignore */
            }
            setIsPlaying(true);
            setVolume(100);
            setMuted(false);
          },
          onStateChange: (event: any) => {
            const YT = (window as any).YT;
            const playing =
              event.data === YT?.PlayerState?.PLAYING;
            setIsPlaying(playing);
            try {
              setMuted(!!playerRef.current?.isMuted?.());
              const v = playerRef.current?.getVolume?.();
              if (typeof v === "number" && Number.isFinite(v)) {
                setVolume(v);
              }
            } catch {
              /* ignore */
            }
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

  const togglePlay = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    const state = p.getPlayerState?.();
    if (state === 1) {
      p.pauseVideo();
    } else {
      p.playVideo();
    }
  }, []);

  const skipSeconds = useCallback((delta: number) => {
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
    const c = typeof cur === "number" && Number.isFinite(cur) ? cur : 0;
    const next = Math.max(0, Math.min(duration, c + delta));
    p.seekTo(next, true);
    setProgress((next / duration) * 100);
  }, []);

  const stopPlayback = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    p.seekTo(0, true);
    p.pauseVideo();
    setProgress(0);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      stop: stopPlayback,
      togglePlay,
      skipSeconds,
    }),
    [stopPlayback, togglePlay, skipSeconds],
  );

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const p = playerRef.current;
    if (!p) return;
    if (p.isMuted?.()) {
      p.unMute();
      setMuted(false);
    } else {
      p.mute();
      setMuted(true);
    }
  };

  const onVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const v = Number(e.target.value);
    setVolume(v);
    const p = playerRef.current;
    if (p?.setVolume) {
      p.setVolume(v);
      if (v > 0 && p.isMuted?.()) {
        p.unMute();
        setMuted(false);
      }
    }
  };

  return (
    <>
      <div
        className={`youtube-wrapper relative h-full w-full cursor-pointer ${!isPlaying ? "grayscale" : ""}`}
        onClick={togglePlay}
        role="presentation"
      >
        <div ref={containerRef} />

        {!isPlaying && !showLoadFallback ? (
          <div
            className="pointer-events-none absolute inset-0 z-[13] flex items-center justify-center"
            aria-hidden
          >
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-black/45">
              <Play
                className="ml-1 h-16 w-16 text-white"
                fill="white"
                strokeWidth={1}
              />
            </div>
          </div>
        ) : null}

        <div
          className="absolute left-1/2 top-1/2 z-[14] flex -translate-x-1/2 -translate-y-1/2 items-center gap-2"
          role="group"
          aria-label="Playback controls"
        >
          <button
            type="button"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-black/55 text-white shadow-lg backdrop-blur-sm transition hover:bg-black/70"
            aria-label="Back 10 seconds"
            onClick={(e) => {
              e.stopPropagation();
              skipSeconds(-10);
            }}
          >
            <SkipBack className="h-6 w-6" strokeWidth={2} />
          </button>
          <button
            type="button"
            className="flex h-14 w-14 items-center justify-center rounded-full bg-black/60 text-white shadow-lg backdrop-blur-sm transition hover:bg-black/75"
            aria-label={isPlaying ? "Pause" : "Play"}
            onClick={(e) => {
              e.stopPropagation();
              togglePlay();
            }}
          >
            {isPlaying ? (
              <Pause className="h-7 w-7" fill="currentColor" strokeWidth={2} />
            ) : (
              <Play className="h-7 w-7 ml-0.5" fill="currentColor" strokeWidth={2} />
            )}
          </button>
          <button
            type="button"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-black/55 text-white shadow-lg backdrop-blur-sm transition hover:bg-black/70"
            aria-label="Forward 10 seconds"
            onClick={(e) => {
              e.stopPropagation();
              skipSeconds(10);
            }}
          >
            <SkipForward className="h-6 w-6" strokeWidth={2} />
          </button>
        </div>

        <div className="absolute bottom-10 left-2 z-[14] flex items-center gap-2 rounded-lg bg-black/50 px-2 py-1.5 backdrop-blur-sm">
          <button
            type="button"
            onClick={toggleMute}
            className="flex h-9 w-9 items-center justify-center rounded-full text-white transition hover:bg-white/10"
            aria-label={muted ? "Unmute" : "Mute"}
          >
            {muted ? (
              <VolumeX className="h-5 w-5" strokeWidth={2} />
            ) : (
              <Volume2 className="h-5 w-5" strokeWidth={2} />
            )}
          </button>
          <input
            type="range"
            min={0}
            max={100}
            value={volume}
            onChange={onVolumeChange}
            onClick={(e) => e.stopPropagation()}
            className="h-1 w-24 cursor-pointer accent-[#E94560]"
            aria-label="Volume"
          />
        </div>

        <div className="absolute bottom-0 left-0 right-0 z-[12] px-2 pb-1 pt-1">
          <div
            ref={progressTrackRef}
            role="slider"
            tabIndex={0}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress)}
            aria-label="Video progress"
            className="relative flex h-5 cursor-pointer items-center"
            onPointerDown={onProgressPointerDown}
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
              const next = Math.max(
                0,
                Math.min(1, cur / duration + delta),
              );
              p.seekTo(next * duration, true);
              setProgress(next * 100);
            }}
          >
            <div className="pointer-events-none absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-gray-600">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              />
            </div>
          </div>
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
            className="rounded-full bg-primary px-6 py-3 text-sm font-bold text-white transition hover:bg-[#ff5a75]"
          >
            Watch on YouTube
          </a>
        </div>
      ) : null}
    </>
  );
});

ShortsYoutubeIframe.displayName = "ShortsYoutubeIframe";

function RailButton({
  icon: Icon,
  label,
  onClick,
  href,
  count,
  active,
  activeColor,
}: {
  icon: typeof ThumbsUp;
  label: string;
  onClick?: () => void;
  href?: string;
  count?: string | number;
  active?: boolean;
  activeColor?: string;
}) {
  const className = `flex h-11 w-11 flex-col items-center justify-center gap-0.5 rounded-full bg-black/50 backdrop-blur-sm transition hover:bg-black/65 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/40 ${
    active ? (activeColor || "text-primary") : "text-white"
  }`;

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
        {count !== undefined && count !== null && (
          <span className="text-[10px] font-semibold">{count}</span>
        )}
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
      {count !== undefined && count !== null && (
        <span className="text-[10px] font-semibold">{count}</span>
      )}
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
  const [commentDraft, setCommentDraft] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const ytPlayerRef = useRef<ShortsYoutubePlayerHandle | null>(null);
  const wheelAccumRef = useRef(0);

  const [likesCount, setLikesCount] = useState(0);
  const [dislikesCount, setDislikesCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [reactionState, setReactionState] = useState({
    liked: false,
    disliked: false,
    commented: false,
  });

  // Helper to update localStorage
  const updateReactionStorage = useCallback((videoId: string, state: any) => {
    localStorage.setItem(`travello_reactions_${videoId}`, JSON.stringify(state));
  }, []);

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

  // Restore reaction state and fetch counts (must run after `current` is defined)
  useEffect(() => {
    if (!current?.videoId) return;

    const saved = localStorage.getItem(`travello_reactions_${current.videoId}`);
    if (saved) {
      try {
        setReactionState(JSON.parse(saved));
      } catch {
        /* ignore */
      }
    } else {
      setReactionState({ liked: false, disliked: false, commented: false });
    }

    if (current.id) {
      const fetchCounts = async () => {
        try {
          const res = await fetch(`${API_BASE}/explorer/shorts/${current.id}`);
          if (res.ok) {
            const data = await res.json();
            setLikesCount(data.likes_count || 0);
            setDislikesCount(data.reaction_counts?.dislike || 0);
            setCommentCount(data.comments?.length || 0);
          }
        } catch (e) {
          console.error("Failed to fetch counts:", e);
        }
      };
      void fetchCounts();
    } else {
      setLikesCount(0);
      setDislikesCount(0);
      setCommentCount(0);
    }
  }, [current?.videoId, current?.id]);

  useEffect(() => {
    if (!activeVideoId) setOverrideQueue(null);
  }, [activeVideoId]);

  useEffect(() => {
    setCommentDraft("");
  }, [activeVideoId]);

  useEffect(() => {
    if (!searchOpen) return;
    const id = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(id);
  }, [searchOpen]);

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
      return;
    }
    
    const videoId = current.videoId;
    
    // Optimistic UI update
    if (type === "like") {
      setReactionState(prev => {
        const next = { ...prev, liked: !prev.liked, disliked: prev.liked ? prev.disliked : false };
        updateReactionStorage(videoId, next);
        return next;
      });
      setLikesCount(prev => reactionState.liked ? prev - 1 : prev + 1);
      if (reactionState.disliked) setDislikesCount(prev => prev - 1);
    } else if (type === "dislike") {
      setReactionState(prev => {
        const next = { ...prev, disliked: !prev.disliked, liked: prev.disliked ? prev.liked : false };
        updateReactionStorage(videoId, next);
        return next;
      });
      setDislikesCount(prev => reactionState.disliked ? prev - 1 : prev + 1);
      if (reactionState.liked) setLikesCount(prev => prev - 1);
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
  }, [current, reactionState.liked, reactionState.disliked, updateReactionStorage]);

  const submitComment = useCallback(async () => {
    const text = commentDraft.slice(0, 280).trim();
    if (!text || !current?.id) return;
    
    const videoId = current.videoId;

    // Optimistic update
    setReactionState(prev => {
      const next = { ...prev, commented: true };
      updateReactionStorage(videoId, next);
      return next;
    });
    setCommentCount(prev => prev + 1);

    try {
      const key = `short_comment_${current.id}`;
      const prev = JSON.parse(
        typeof localStorage !== "undefined"
          ? localStorage.getItem(key) || "[]"
          : "[]",
      ) as unknown[];
      const next = [...(Array.isArray(prev) ? prev : []), { t: Date.now(), text }];
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* ignore storage */
    }
    try {
      const token = getToken();
      const headers = new Headers();
      if (token) headers.set("Authorization", `Bearer ${token}`);
      const res = await fetch(
        `${API_BASE}/explorer/shorts/${current.id}/react?reaction_type=list`,
        { method: "POST", headers },
      );
      if (!res.ok) throw new Error("Failed to save");
    } catch (e) {
      console.error("Comment reaction failed:", e);
    }
    setCommentDraft("");
  }, [commentDraft, current, updateReactionStorage]);

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
      if (Math.abs(deltaY) < 80) return;
      if (deltaY > 0) goNext();
      else if (deltaY < 0) goPrev();
    },
    [goNext, goPrev, revealChrome],
  );

  useEffect(() => {
    if (!activeVideoId) return;
    wheelAccumRef.current = 0;
    const handleWheel = (ev: WheelEvent) => {
      revealChrome();
      ev.preventDefault();
      wheelAccumRef.current += ev.deltaY;
      if (Math.abs(wheelAccumRef.current) < 150) return;
      const acc = wheelAccumRef.current;
      wheelAccumRef.current = 0;
      if (acc > 0) goNext();
      else goPrev();
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
      const inComment = (e.target as HTMLElement | null)?.closest?.(
        "[data-shorts-comment-area]",
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
      if (
        inComment &&
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

  const shortsUrl = `https://www.youtube.com/shorts/${current.videoId}`;
  const canPrev = index > 0;
  const canNext = index >= 0 && index < effectiveQueue.length - 1;
  const views =
    typeof current.viewCount === "number" && current.viewCount > 0
      ? `${formatCompactViews(current.viewCount)} views`
      : null;

  const idleUi = !(showChrome || searchOpen);
  const railOpacity = idleUi ? "opacity-70" : "opacity-100";
  const navOpacity = idleUi ? "opacity-70" : "opacity-100";

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
                className="w-full rounded-xl border border-white/15 bg-black/50 py-2 pl-9 pr-3 text-sm text-white placeholder:text-zinc-500 focus:border-primary focus:outline-none"
              />
            </div>
            <button
              type="button"
              disabled={searchLoading || !searchQuery.trim()}
              onClick={() => void runExploreSearch()}
              className="shrink-0 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white transition hover:bg-[#ff5a75] disabled:opacity-50"
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
          className={`absolute left-2 z-[40] flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-opacity duration-300 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-35 sm:left-4 md:h-12 md:w-12 ${navOpacity}`}
          aria-label="Previous short"
        >
          <ChevronUp className="h-6 w-6 md:h-7 md:w-7" strokeWidth={2} />
        </button>

        <button
          type="button"
          disabled={!canNext}
          onClick={goNext}
          className={`absolute right-2 z-[40] flex h-11 w-11 items-center justify-center rounded-full bg-white text-black transition-opacity duration-300 hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-35 sm:right-4 md:h-12 md:w-12 ${navOpacity}`}
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
            ref={ytPlayerRef}
            videoId={current.videoId}
            shortsUrl={shortsUrl}
          />

          <div
            className="absolute left-0 right-0 top-0 z-[26] flex flex-col gap-2 bg-black/60 px-3 py-2.5 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-4 pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  {source === "travello" ? (
                    <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold tracking-wide text-white shadow-sm">
                      travello
                    </span>
                  ) : null}
                  <CityTag cityName={cityTrim} />
                </div>
                <h3 className="truncate text-sm font-semibold text-white sm:text-base">
                  {current.title}
                </h3>
                <p className="truncate text-xs text-white/85 sm:text-sm">
                  {current.channelTitle}
                </p>
                {views ? (
                  <p className="mt-0.5 text-[10px] text-white/55">{views}</p>
                ) : null}
              </div>
              <div className="flex shrink-0 gap-1.5">
                <button
                  type="button"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition hover:bg-black/75"
                  aria-label="Stop playback"
                  title="Stop"
                  onClick={() => ytPlayerRef.current?.stop()}
                >
                  <Square className="h-4 w-4 fill-current" strokeWidth={0} />
                </button>
                <button
                  type="button"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition hover:bg-black/75"
                  aria-label="Close player"
                  onClick={close}
                >
                  <X className="h-5 w-5" strokeWidth={2.25} />
                </button>
              </div>
            </div>
          </div>

          <div
            className={`absolute top-1/2 right-2 z-[25] flex max-h-[min(70vh,480px)] -translate-y-1/2 flex-col gap-3 overflow-y-auto transition-opacity duration-300 sm:right-3 ${railOpacity} pointer-events-auto`}
            onClick={(e) => e.stopPropagation()}
          >
            <RailButton
              icon={ThumbsUp}
              label="Like"
              onClick={() => handleReaction("like")}
              count={likesCount}
              active={reactionState.liked}
              activeColor="text-red-500"
            />
            <RailButton
              icon={ThumbsDown}
              label="Dislike"
              onClick={() => handleReaction("dislike")}
              count={dislikesCount}
              active={reactionState.disliked}
              activeColor="text-blue-500"
            />
            <div className="relative">
              {reactionsOpen ? (
                <div className="absolute bottom-0 right-14 w-[min(240px,calc(100vw-120px))] rounded-2xl border border-[#1E293B] bg-[#1E293B]/95 p-3 shadow-xl backdrop-blur-sm"
                  data-shorts-comment-area
                >
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-white/60">
                    Quick reactions
                  </p>
                  <div className="flex flex-col gap-1.5">
                    <button
                      type="button"
                      className="rounded-lg px-2 py-1.5 text-left text-xs font-semibold text-white transition hover:bg-white/10 hover:text-primary"
                      onClick={() => {
                        handleReaction("love");
                      }}
                    >
                      Love this!
                    </button>
                    <button
                      type="button"
                      className="rounded-lg px-2 py-1.5 text-left text-xs font-semibold text-white transition hover:bg-white/10 hover:text-primary"
                      onClick={() => {
                        handleReaction("helpful");
                      }}
                    >
                      Super helpful
                    </button>
                    <button
                      type="button"
                      className="rounded-lg px-2 py-1.5 text-left text-xs font-semibold text-white transition hover:bg-white/10 hover:text-primary"
                      onClick={() => {
                        handleReaction("list");
                      }}
                    >
                      Adding to list
                    </button>
                  </div>
                  <div className="mt-3 border-t border-white/10 pt-3">
                    <label className="sr-only" htmlFor="shorts-comment">
                      Comment
                    </label>
                    <textarea
                      id="shorts-comment"
                      rows={2}
                      maxLength={280}
                      placeholder={
                        current.id
                          ? "Add a comment…"
                          : "Import this short to comment"
                      }
                      disabled={!current.id}
                      value={commentDraft}
                      onChange={(e) =>
                        setCommentDraft(e.target.value.slice(0, 280))
                      }
                      className="w-full resize-none rounded-xl border border-white/15 bg-black/40 px-2.5 py-2 text-xs text-white placeholder:text-white/40 focus:border-primary focus:outline-none disabled:opacity-50"
                    />
                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      <span className="text-[10px] text-white/45">
                        {commentDraft.length}/280
                      </span>
                      <button
                        type="button"
                        disabled={!commentDraft.trim() || !current.id}
                        onClick={() => void submitComment()}
                        className="rounded-lg bg-primary px-3 py-1 text-[11px] font-bold text-white transition hover:bg-[#ff5a75] disabled:opacity-40"
                      >
                        Send
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
              <RailButton
                icon={MessageCircle}
                label="Comment"
                onClick={() => setReactionsOpen(!reactionsOpen)}
                count={commentCount}
                active={reactionState.commented}
              />
            </div>
            <RailButton icon={Share2} label="Share" onClick={shareShort} />
          </div>
        </div>
      </div>
    </div>
  );
}
