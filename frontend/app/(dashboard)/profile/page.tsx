"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  IconArrowLeft,
  IconBookmark,
  IconCalendarPlus,
  IconChevronRight,
  IconClapperboard,
  IconGrid,
  IconMap,
  IconMapPin,
  IconMenu,
  IconMessageCircle,
  IconPlane,
  IconPlay,
  IconSettings,
  IconShare,
  IconUserSquare,
} from "@/components/icons";

import { apiFetch, apiFetchWithStatus } from "@/lib/api";
import { clearToken, getToken } from "@/lib/auth";

/* ─── design tokens ───────────────────────────────────────── */
const RED = "#e53e3e";
const NAVY = "#1e2a3a";
const GREEN = "#1d9e75";
const CREAM = "#f5f5f0";
const CARD_BORDER = "1px solid #e8e8e0";

const LS_AVATAR = "gt_avatar";
const LS_INSTAGRAM = "gt_social_instagram";
const LS_SNAPCHAT = "gt_social_snapchat";
const LS_WHATSAPP = "gt_social_whatsapp";
const LS_MAP_SHARE = "gt_share_map_location";
const LS_STORIES_WATCHED = "gt_stories_watched";
const LS_SAVED_PINS = "gt_saved_pins";
const LS_ACTIVITY = "gt_daily_activity";
const LS_BIO = "gt_profile_bio";
const LS_BIRTHDAY = "gt_profile_birthday";
const LS_FAVORITE_TRIPS = "gt_favorite_trip_ids";
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

const SKINS = [
  "#FDDBB4",
  "#F0C27F",
  "#D08B5B",
  "#AE5D29",
  "#694D3D",
  "#3B2219",
];
const HAIR_COLORS = [
  "#1a1a1a",
  "#4a3728",
  "#8B4513",
  "#DAA520",
  "#FF6B35",
  "#C0392B",
  "#8E44AD",
  "#3498DB",
];
const OUTFIT_COLORS = [
  "#e53e3e",
  "#3182ce",
  "#38a169",
  "#d69e2e",
  "#805ad5",
  "#1e2a3a",
];
const BG_CIRCLE = [
  "#e1f5ee",
  "#e6f1fb",
  "#faeeda",
  "#fbeaf0",
  "#f1efe8",
  "#1e2a3a",
];

const GLOBE_LEVELS = [
  { min: 0, label: "Beginner", emoji: "🌱" },
  { min: 10, label: "Wanderer", emoji: "🧭" },
  { min: 50, label: "Explorer", emoji: "🌍" },
  { min: 100, label: "Adventurer", emoji: "⛰️" },
  { min: 500, label: "Legend", emoji: "👑" },
] as const;

type AvatarOptions = {
  skin: number;
  hair: number;
  hairColor: number;
  eyes: number;
  mouth: number;
  outfit: number;
  accessory: number;
  background: number;
};

const DEFAULT_AVATAR: AvatarOptions = {
  skin: 0,
  hair: 0,
  hairColor: 0,
  eyes: 0,
  mouth: 0,
  outfit: 0,
  accessory: 0,
  background: 0,
};

const ACCESSORY_IDS = [0, 1, 2, 3, 4];
const BG_IDS = [100, 101, 102, 103, 104, 105];

type UserMe = {
  id: string;
  email: string;
  full_name: string;
  username: string | null;
  is_verified: boolean;
  profile_public?: boolean;
  avatar_url?: string | null;
  profile_picture?: string | null;
  home_city?: string | null;
  country?: string | null;
  created_at?: string;
};

type TravelStats = {
  trips_created: number;
  groups_joined: number;
  locations_saved: number;
  expenses_paid: number;
  countries_from_trips: string[];
};

type PlanOut = { plan: string; status: string };

type TripOut = {
  id: string;
  group_id: string;
  title: string;
  description: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
};

type GroupMemberOut = { id: string; user_id: string; full_name: string };
type GroupOut = { id: string; name: string; members: GroupMemberOut[] };

type MergedTrip = TripOut & { member_count: number; group_name: string };

type SocialUserOut = { id: string; username: string | null };

type ProfilePost = {
  id: string;
  src: string;
  caption: string;
  likes: number;
};

type SavedPin = { id: string; name: string };

function loadJsonLs<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const s = localStorage.getItem(key);
    if (!s) return fallback;
    return { ...fallback, ...JSON.parse(s) } as T;
  } catch {
    return fallback;
  }
}

function saveAvatarLs(opts: AvatarOptions) {
  try {
    localStorage.setItem(LS_AVATAR, JSON.stringify(opts));
    window.dispatchEvent(new Event("gt_avatar_updated"));
  } catch {
    /* ignore */
  }
}

function parseYmd(s: string | null): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function todayYmd(): string {
  const x = new Date();
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}

function isTripCompleted(t: MergedTrip, today: string): boolean {
  if (t.status === "completed") return true;
  if (t.end_date && t.end_date < today) return true;
  return false;
}

function isUpcoming(t: MergedTrip, today: string): boolean {
  if (!t.start_date) return false;
  return t.start_date > today;
}

function globePoints(stats: TravelStats | null, streak: number): number {
  if (!stats) return 0;
  const cc = stats.countries_from_trips?.length ?? 0;
  return (
    stats.trips_created * 10 +
    stats.groups_joined * 3 +
    cc * 15 +
    stats.locations_saved * 1 +
    streak * 2
  );
}

function globeLevelFromPoints(pts: number): {
  min: number;
  label: string;
  emoji: string;
  next: { min: number; label: string; emoji: string } | null;
} {
  let cur: (typeof GLOBE_LEVELS)[number] = GLOBE_LEVELS[0];
  let idx = 0;
  for (let i = 0; i < GLOBE_LEVELS.length; i++) {
    if (pts >= GLOBE_LEVELS[i].min) {
      cur = GLOBE_LEVELS[i];
      idx = i;
    }
  }
  const nextRaw = idx + 1 < GLOBE_LEVELS.length ? GLOBE_LEVELS[idx + 1] : null;
  const next = nextRaw
    ? { min: nextRaw.min, label: nextRaw.label, emoji: nextRaw.emoji }
    : null;
  return {
    min: cur.min,
    label: cur.label,
    emoji: cur.emoji,
    next,
  };
}

function levelBarFraction(pts: number): number {
  const info = globeLevelFromPoints(pts);
  if (!info.next) return 1;
  const lo = info.min;
  const hi = info.next.min;
  if (hi <= lo) return 1;
  return Math.min(1, Math.max(0, (pts - lo) / (hi - lo)));
}

function storyLabel(name: string): string {
  const t = name.trim().slice(0, 8);
  return t || "?";
}

function isHttpPhoto(a: string | null | undefined): boolean {
  if (!a?.trim()) return false;
  return a.startsWith("http") || a.startsWith("data:");
}

/** Stable faux view counts for Spotlight tiles */
function fauxViewsFromId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return 40 + (h % 220);
}

function zodiacFromMonthDay(month: number, day: number): string {
  const md = month * 100 + day;
  if (md >= 1222 || md <= 119) return "♑ Capricorn";
  if (md >= 120 && md <= 218) return "♒ Aquarius";
  if (md >= 219 && md <= 320) return "♓ Pisces";
  if (md >= 321 && md <= 419) return "♈ Aries";
  if (md >= 420 && md <= 520) return "♉ Taurus";
  if (md >= 521 && md <= 620) return "♊ Gemini";
  if (md >= 621 && md <= 722) return "♋ Cancer";
  if (md >= 723 && md <= 822) return "♌ Leo";
  if (md >= 823 && md <= 922) return "♍ Virgo";
  if (md >= 923 && md <= 1022) return "♎ Libra";
  if (md >= 1023 && md <= 1121) return "♏ Scorpio";
  return "♐ Sagittarius";
}

function formatJoinedDate(iso?: string | null): string | null {
  if (!iso?.trim()) return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return new Intl.DateTimeFormat(undefined, {
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(d);
  } catch {
    return null;
  }
}

/* ─── inline avatar SVG (120×140 logical) ──────────────────── */
function AvatarFaceSvg({
  o,
  className,
  style,
}: {
  o: AvatarOptions;
  className?: string;
  style?: React.CSSProperties;
}) {
  const skin = SKINS[Math.min(o.skin, SKINS.length - 1)] ?? SKINS[0];
  const hairC = HAIR_COLORS[Math.min(o.hairColor, HAIR_COLORS.length - 1)];
  const outfit = OUTFIT_COLORS[Math.min(o.outfit, OUTFIT_COLORS.length - 1)];
  const bg = BG_CIRCLE[Math.min(o.background, BG_CIRCLE.length - 1)];

  const eyeY = 52;
  const hx = 60;
  const hy = 48;

  const hairLayer = (() => {
    const h = o.hair % 5;
    if (h === 0)
      return (
        <path
          d="M 28 52 Q 30 22 60 20 Q 90 22 92 52 Q 88 38 60 36 Q 32 38 28 52"
          fill={hairC}
        />
      );
    if (h === 1)
      return (
        <g fill={hairC}>
          <ellipse cx="42" cy="28" rx="14" ry="12" />
          <ellipse cx="78" cy="28" rx="14" ry="12" />
          <ellipse cx="60" cy="22" rx="18" ry="14" />
          <ellipse cx="34" cy="40" rx="10" ry="8" />
          <ellipse cx="86" cy="40" rx="10" ry="8" />
        </g>
      );
    if (h === 2)
      return (
        <path
          d="M 26 55 L 28 20 Q 45 10 60 12 Q 75 10 92 20 L 94 55 Q 88 100 82 118 L 38 118 Q 32 100 26 55"
          fill={hairC}
        />
      );
    if (h === 3)
      return (
        <g fill={hairC}>
          <circle cx="72" cy="22" r="14" />
          <path d="M 30 52 Q 32 24 58 22 Q 86 24 90 52 Q 84 36 60 34 Q 36 36 30 52" />
        </g>
      );
    return (
      <g fill={hairC}>
        <path d="M 30 50 Q 32 26 60 24 Q 88 26 90 50 Q 86 40 60 38 Q 34 40 30 50" />
        <path
          d="M 38 76 Q 42 92 60 96 Q 78 92 82 76 Q 78 86 60 90 Q 42 86 38 76"
          fill={hairC}
          opacity={0.92}
        />
      </g>
    );
  })();

  const eyes = (() => {
    const e = o.eyes % 4;
    if (e === 0)
      return (
        <g fill="#1a1a1a">
          <circle cx="48" cy={eyeY} r="4" />
          <circle cx="72" cy={eyeY} r="4" />
        </g>
      );
    if (e === 1)
      return (
        <g fill="none" stroke="#1a1a1a" strokeWidth="2.2" strokeLinecap="round">
          <path d="M 44 52 Q 48 48 52 52" />
          <path d="M 68 52 Q 72 48 76 52" />
        </g>
      );
    if (e === 2)
      return (
        <g fill="#1a1a1a">
          <circle cx="48" cy={eyeY} r="6" />
          <circle cx="72" cy={eyeY} r="6" />
          <circle cx="49" cy="50" r="2" fill="#fff" />
          <circle cx="73" cy="50" r="2" fill="#fff" />
        </g>
      );
    return (
      <g fill="#1a1a1a">
        <path d="M 42 52 L 54 52 L 48 50 Z" />
        <path d="M 66 52 L 78 52 L 72 50 Z" />
      </g>
    );
  })();

  const mouth = (() => {
    const m = o.mouth % 4;
    if (m === 0)
      return (
        <path
          d="M 48 68 Q 60 76 72 68"
          fill="none"
          stroke="#4a3728"
          strokeWidth="2"
          strokeLinecap="round"
        />
      );
    if (m === 1)
      return (
        <path
          d="M 44 66 Q 60 82 76 66"
          fill="none"
          stroke="#4a3728"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      );
    if (m === 2)
      return (
        <line
          x1="48"
          y1="72"
          x2="72"
          y2="72"
          stroke="#4a3728"
          strokeWidth="2"
          strokeLinecap="round"
        />
      );
    return (
      <path
        d="M 52 70 Q 64 74 74 68"
        fill="none"
        stroke="#4a3728"
        strokeWidth="2"
        strokeLinecap="round"
      />
    );
  })();

  const accessory = (() => {
    const a = o.accessory % 5;
    if (a === 0) return null;
    if (a === 1)
      return (
        <g>
          <rect x="36" y="44" width="48" height="8" rx="3" fill="#1a1a1a" />
          <line
            x1="40"
            y1="48"
            x2="80"
            y2="48"
            stroke="#333"
            strokeWidth="1.5"
          />
        </g>
      );
    if (a === 2)
      return (
        <g fill={outfit}>
          <rect x="40" y="18" width="40" height="14" rx="4" />
          <rect x="34" y="30" width="52" height="6" rx="2" />
        </g>
      );
    if (a === 3)
      return (
        <g fill="none" stroke="#333" strokeWidth="3" strokeLinecap="round">
          <path d="M 32 56 Q 32 28 48 24" />
          <path d="M 88 56 Q 88 28 72 24" />
          <path d="M 48 24 L 72 24" />
        </g>
      );
    return (
      <path
        d="M 24 102 L 96 78"
        stroke="#805ad3"
        strokeWidth="5"
        strokeLinecap="round"
        opacity={0.85}
      />
    );
  })();

  return (
    <svg
      viewBox="0 0 120 140"
      className={className}
      style={{ ...style, transition: "all 0.25s ease" }}
      aria-hidden
    >
      <circle cx="60" cy="70" r="56" fill={bg} />
      {/* body / outfit */}
      <path
        d="M 38 92 Q 38 118 60 126 Q 82 118 82 92 L 78 86 Q 60 76 42 86 Z"
        fill={outfit}
      />
      <ellipse cx={hx} cy={hy + 8} rx="30" ry="34" fill={skin} />
      {hairLayer}
      {eyes}
      {mouth}
      {accessory}
    </svg>
  );
}

function PlaceholderAppLogo({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect width="32" height="32" rx="8" fill="#1e2a3a" />
      <path
        d="M16 8l-4.5 7.5c-.6 1-.6 2.2 0 3.2L16 26l4.5-7.3c.6-1 .6-2.2 0-3.2L16 8z"
        fill="#e53e3e"
        opacity="0.95"
      />
      <circle cx="16" cy="16" r="2.25" fill="#f5f5f0" />
    </svg>
  );
}

function SkeletonBar({ h = 18, className = "" }: { h?: number; className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-stone-200/80 ${className}`}
      style={{ height: h }}
    />
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [bootLoading, setBootLoading] = useState(true);
  const [me, setMe] = useState<UserMe | null>(null);
  const [stats, setStats] = useState<TravelStats | null>(null);
  const [plan, setPlan] = useState<PlanOut | null>(null);
  const [tripsLoading, setTripsLoading] = useState(true);
  const [trips, setTrips] = useState<MergedTrip[]>([]);
  const [connections, setConnections] = useState<SocialUserOut[]>([]);
  const [avatarOpts, setAvatarOpts] = useState<AvatarOptions>(DEFAULT_AVATAR);
  const [customizerTab, setCustomizerTab] = useState<
    "skin" | "hair" | "eyes" | "mouth" | "outfit" | "more"
  >("skin");

  const [storyOpen, setStoryOpen] = useState(false);
  const [storyIndex, setStoryIndex] = useState(0);
  const [storyProgress, setStoryProgress] = useState(0);
  const storyTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [contentTab, setContentTab] = useState<
    "posts" | "reels" | "trips" | "saved" | "tagged"
  >("posts");

  const [mapShare, setMapShare] = useState(false);
  const [expenseTotals, setExpenseTotals] = useState<Record<string, number>>({});

  const [posts, setPosts] = useState<ProfilePost[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postModal, setPostModal] = useState<ProfilePost | null>(null);

  const [igModal, setIgModal] = useState(false);
  const [snapModal, setSnapModal] = useState(false);
  const [igDraft, setIgDraft] = useState("");
  const [snapDraft, setSnapDraft] = useState("");
  const [igUser, setIgUser] = useState("");
  const [snapUser, setSnapUser] = useState("");
  const [waPhone, setWaPhone] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editBirthday, setEditBirthday] = useState("");
  const [saveBusy, setSaveBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [bioLine, setBioLine] = useState("");
  const [birthdayIso, setBirthdayIso] = useState("");
  const [favoriteTripIds, setFavoriteTripIds] = useState<string[]>([]);
  const avatarSectionRef = useRef<HTMLElement | null>(null);
  const [profileNavOpen, setProfileNavOpen] = useState(false);
  const profileNavRef = useRef<HTMLDivElement | null>(null);

  const [streakDays, setStreakDays] = useState(0);
  const [activityWeek, setActivityWeek] = useState<boolean[]>([
    false,
    false,
    false,
    false,
    false,
    false,
    false,
  ]);
  const [savedPins, setSavedPins] = useState<SavedPin[]>([]);
  const [watchedStoryIds, setWatchedStoryIds] = useState<Set<string>>(
    () => new Set(),
  );

  const showToast = useCallback((m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(null), 2600);
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!profileNavOpen) return;
    const onDown = (e: MouseEvent) => {
      const el = profileNavRef.current;
      if (el && !el.contains(e.target as Node)) setProfileNavOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [profileNavOpen]);

  useEffect(() => {
    setAvatarOpts(loadJsonLs(LS_AVATAR, DEFAULT_AVATAR));
    setMapShare(localStorage.getItem(LS_MAP_SHARE) === "1");
    setIgUser(localStorage.getItem(LS_INSTAGRAM)?.trim() ?? "");
    setSnapUser(localStorage.getItem(LS_SNAPCHAT)?.trim() ?? "");
    setWaPhone(localStorage.getItem(LS_WHATSAPP)?.trim() ?? "");
    setBioLine(localStorage.getItem(LS_BIO)?.trim() ?? "");
    setBirthdayIso(localStorage.getItem(LS_BIRTHDAY)?.trim()?? "");
    try {
      const ft = JSON.parse(localStorage.getItem(LS_FAVORITE_TRIPS) ?? "[]");
      setFavoriteTripIds(Array.isArray(ft) ? ft.map(String) : []);
    } catch {
      setFavoriteTripIds([]);
    }
    const pins = loadJsonLs<SavedPin[]>(LS_SAVED_PINS, []);
    setSavedPins(Array.isArray(pins) ? pins : []);

    const today = todayYmd();
    try {
      const raw = localStorage.getItem(LS_ACTIVITY);
      const o: Record<string, boolean> = raw ? JSON.parse(raw) : {};
      o[today] = true;
      localStorage.setItem(LS_ACTIVITY, JSON.stringify(o));
      const dots: boolean[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        dots.push(Boolean(o[k]));
      }
      setActivityWeek(dots);
    } catch {
      setActivityWeek([true, false, false, false, false, false, false]);
    }

    try {
      const sw = localStorage.getItem(LS_STORIES_WATCHED);
      const ids: string[] = sw ? JSON.parse(sw) : [];
      setWatchedStoryIds(new Set(ids.map(String)));
    } catch {
      setWatchedStoryIds(new Set());
    }

    let s = parseInt(localStorage.getItem("travello_streak_days") ?? "0", 10) || 0;
    const last = localStorage.getItem("travello_last_opened");
    if (last !== today) {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      if (!last) s = 1;
      else if (new Date(last).toDateString() === y.toDateString()) s += 1;
      else s = 1;
      localStorage.setItem("travello_streak_days", String(s));
      localStorage.setItem("travello_last_opened", today);
    }
    setStreakDays(s);
  }, []);

  const loadTripsAggregate = useCallback(async () => {
    setTripsLoading(true);
    try {
      const attempt = await apiFetchWithStatus<TripOut[]>("/trips");
      let merged: MergedTrip[] = [];
      if (attempt.status === 200 && Array.isArray(attempt.data)) {
        merged = attempt.data.map((t) => ({
          ...t,
          member_count: 0,
          group_name: "",
        }));
      } else {
        const gRes = await apiFetchWithStatus<GroupOut[]>("/groups");
        if (gRes.status !== 200 || !Array.isArray(gRes.data)) {
          setTrips([]);
          return;
        }
        const groups = gRes.data;
        const lists = await Promise.all(
          groups.map(async (g) => {
            try {
              const r = await apiFetchWithStatus<TripOut[]>(
                `/groups/${g.id}/trips`,
              );
              if (r.status === 200 && Array.isArray(r.data)) {
                return { g, trips: r.data };
              }
            } catch {
              /* ignore */
            }
            return { g, trips: [] as TripOut[] };
          }),
        );
        for (const { g, trips: lt } of lists) {
          const mc = g.members?.length ?? 0;
          for (const t of lt) {
            merged.push({
              ...t,
              member_count: mc,
              group_name: g.name,
            });
          }
        }
      }
      setTrips(merged);
    } catch {
      setTrips([]);
    } finally {
      setTripsLoading(false);
    }
  }, []);

  const loadConnections = useCallback(async () => {
    try {
      const r = await apiFetchWithStatus<SocialUserOut[]>("/social/connections");
      if (r.status === 200 && Array.isArray(r.data)) setConnections(r.data);
      else setConnections([]);
    } catch {
      setConnections([]);
    }
  }, []);

  const loadPosts = useCallback(async () => {
    setPostsLoading(true);
    try {
      const r = await apiFetchWithStatus<{ items?: ProfilePost[] }>(
        "/users/me/posts",
      );
      if (r.status === 200 && r.data?.items && Array.isArray(r.data.items)) {
        setPosts(r.data.items);
      } else {
        setPosts([]);
      }
    } catch {
      setPosts([]);
    } finally {
      setPostsLoading(false);
    }
  }, []);

  useEffect(() => {
    let c = false;
    (async () => {
      setBootLoading(true);
      try {
        if (!getToken()) {
          clearToken();
          router.replace("/login");
          return;
        }
        const meRes = await apiFetchWithStatus<UserMe>("/auth/me");
        if (c) return;
        if (meRes.status === 401) {
          clearToken();
          router.replace("/login");
          return;
        }
        if (meRes.data) {
          setMe(meRes.data);
          setEditName(meRes.data.full_name ?? "");
          setEditUsername(meRes.data.username?.trim() ?? "");
          setEditBio(localStorage.getItem(LS_BIO) ?? "");
          setEditBirthday(localStorage.getItem(LS_BIRTHDAY) ?? "");
        }

        let st: TravelStats | null = null;
        try {
          const sr = await apiFetchWithStatus<TravelStats>("/stats");
          if (sr.status === 200 && sr.data) st = sr.data;
        } catch {
          /* ignore */
        }
        if (!st) {
          try {
            st = await apiFetch<TravelStats>("/users/me/travel-stats");
          } catch {
            st = {
              trips_created: 0,
              groups_joined: 0,
              locations_saved: 0,
              expenses_paid: 0,
              countries_from_trips: [],
            };
          }
        }
        if (!c) setStats(st);

        try {
          const pl = await apiFetch<PlanOut>("/subscriptions/me");
          if (!c) setPlan(pl);
        } catch {
          if (!c) setPlan(null);
        }

        if (!c) void loadConnections();
        if (!c) void loadTripsAggregate();
        if (!c) void loadPosts();
      } catch {
        if (!c) showToast("Could not load profile.");
      } finally {
        if (!c) setBootLoading(false);
      }
    })();
    return () => {
      c = true;
    };
  }, [router, loadConnections, loadTripsAggregate, loadPosts, showToast]);

  useEffect(() => {
    if (trips.length === 0) return;
    let cancel = false;
    (async () => {
      const targets = trips.slice(0, 24);
      const entries = await Promise.all(
        targets.map(async (t) => {
          try {
            const rows = await apiFetch<{ amount: number }[]>(
              `/trips/${t.id}/expenses`,
            );
            const sum = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
            return [t.id, sum] as const;
          } catch {
            return [t.id, 0] as const;
          }
        }),
      );
      if (cancel) return;
      const map: Record<string, number> = {};
      for (const [id, v] of entries) map[id] = v;
      setExpenseTotals((prev) => ({ ...prev, ...map }));
    })();
    return () => {
      cancel = true;
    };
  }, [trips]);

  const today = todayYmd();
  const displayName = me?.full_name?.trim() || "Traveler";
  const handle = me?.username?.trim()
    ? `@${me.username.trim()}`
    : `@traveler_${me?.id?.slice(0, 6) ?? "guest"}`;
  const locationLine = [me?.home_city, me?.country].filter(Boolean).join(", ");
  const photoUrl =
    me?.profile_picture?.trim() ||
    (isHttpPhoto(me?.avatar_url) ? me?.avatar_url : null);

  const pts = globePoints(stats, streakDays);
  const level = globeLevelFromPoints(pts);

  const joinedLabel = formatJoinedDate(me?.created_at ?? null);

  const zodiacLabel = useMemo(() => {
    if (!birthdayIso?.trim()) return "✨ Set birthday";
    const p = birthdayIso.trim().split("-");
    if (p.length < 3) return "—";
    const m = parseInt(p[1]!, 10);
    const d = parseInt(p[2]!, 10);
    if (!m || !d) return "—";
    return zodiacFromMonthDay(m, d);
  }, [birthdayIso]);

  const birthdayShort = useMemo(() => {
    if (!birthdayIso?.trim()) return null;
    const d = new Date(birthdayIso.trim());
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }, [birthdayIso]);

  const favoriteTripCards = useMemo(() => {
    const byId = new Map(trips.map((t) => [t.id, t] as const));
    const rows: MergedTrip[] = [];
    for (const id of favoriteTripIds) {
      const t = byId.get(id);
      if (t) rows.push(t);
    }
    if (rows.length < 4) {
      for (const t of trips) {
        if (rows.length >= 4) break;
        if (!favoriteTripIds.includes(t.id)) rows.push(t);
      }
    }
    return rows.slice(0, 8);
  }, [trips, favoriteTripIds]);

  const tripsCount = trips.length;
  const followersCount = connections.length + 2;
  const followingCount = Math.max(0, connections.length - 1);
  const buddiesCount = connections.length;

  const storyTrips = useMemo(() => {
    const dest = (t: MergedTrip) =>
      t.title?.trim() || t.group_name || "Trip";
    return [...trips].sort((a, b) => {
      const da = a.start_date ?? "";
      const db = b.start_date ?? "";
      return db.localeCompare(da);
    }).map((t) => ({ trip: t, label: storyLabel(dest(t)) }));
  }, [trips]);

  const upcomingTrips = useMemo(() => {
    return trips.filter((t) => isUpcoming(t, today)).sort((a, b) => {
      const da = parseYmd(a.start_date)?.getTime() ?? Infinity;
      const db = parseYmd(b.start_date)?.getTime() ?? Infinity;
      return da - db;
    });
  }, [trips, today]);

  const completedTrips = useMemo(() => {
    return trips.filter((t) => isTripCompleted(t, today));
  }, [trips, today]);

  const markStoryWatched = (id: string) => {
    try {
      const raw = localStorage.getItem(LS_STORIES_WATCHED);
      const a: string[] = raw ? JSON.parse(raw) : [];
      if (!a.includes(id)) {
        a.push(id);
        localStorage.setItem(LS_STORIES_WATCHED, JSON.stringify(a));
      }
      setWatchedStoryIds((prev) => new Set([...prev, id]));
    } catch {
      /* ignore */
    }
  };

  const openStory = (idx: number) => {
    setStoryIndex(idx);
    setStoryProgress(0);
    setStoryOpen(true);
    const t = storyTrips[idx]?.trip;
    if (t) markStoryWatched(t.id);
  };

  useEffect(() => {
    if (!storyOpen) {
      if (storyTimerRef.current) {
        clearInterval(storyTimerRef.current);
        storyTimerRef.current = null;
      }
      return;
    }
    const start = Date.now();
    storyTimerRef.current = setInterval(() => {
      const p = Math.min(1, (Date.now() - start) / 5000);
      setStoryProgress(p);
      if (p >= 1) {
        setStoryIndex((i) => {
          const n = i + 1;
          if (n >= storyTrips.length) {
            setStoryOpen(false);
            return 0;
          }
          markStoryWatched(storyTrips[n]!.trip.id);
          return n;
        });
        setStoryProgress(0);
      }
    }, 80);
    return () => {
      if (storyTimerRef.current) clearInterval(storyTimerRef.current);
    };
  }, [storyOpen, storyIndex, storyTrips]);

  const persistMapShare = (on: boolean) => {
    setMapShare(on);
    try {
      localStorage.setItem(LS_MAP_SHARE, on ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  const saveInstagram = () => {
    const u = igDraft.replace(/^@/, "").trim();
    if (!u) return;
    localStorage.setItem(LS_INSTAGRAM, u);
    setIgUser(u);
    setIgModal(false);
    showToast("Instagram saved");
  };

  const saveSnap = () => {
    const u = snapDraft.trim();
    if (!u) return;
    localStorage.setItem(LS_SNAPCHAT, u);
    setSnapUser(u);
    setSnapModal(false);
    showToast("Snapchat saved");
  };

  const shareProfile = async () => {
    const url = `${typeof window !== "undefined" ? window.location.origin : ""}/profile`;
    try {
      if (navigator.share) {
        await navigator.share({ title: displayName, url });
      } else {
        await navigator.clipboard.writeText(url);
        showToast("Link copied");
      }
    } catch {
      showToast("Could not share");
    }
  };

  const onSaveProfile = async () => {
    if (!me) return;
    const u = editUsername.trim();
    if (u && !USERNAME_RE.test(u)) {
      showToast("Username: 3–20 lowercase letters, numbers, underscores");
      return;
    }
    setSaveBusy(true);
    try {
      const updated = await apiFetch<UserMe>("/auth/me", {
        method: "PATCH",
        body: JSON.stringify({
          full_name: editName.trim(),
          username: u || null,
        }),
      });
      setMe(updated);
      try {
        localStorage.setItem(LS_BIO, editBio.slice(0, 150));
        localStorage.setItem(LS_BIRTHDAY, editBirthday.trim());
        setBioLine(editBio.slice(0, 150).trim());
        setBirthdayIso(editBirthday.trim());
      } catch {
        /* ignore */
      }
      setEditOpen(false);
      showToast("Profile saved");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaveBusy(false);
    }
  };

  const isPro = plan?.plan === "pro" || plan?.plan === "enterprise";

  const badges = useMemo(() => {
    const cc = stats?.countries_from_trips?.length ?? 0;
    const tc = stats?.trips_created ?? 0;
    const gj = stats?.groups_joined ?? 0;
    return [
      { id: "b1", icon: "🏖️", name: "Beach", earned: cc >= 1 },
      { id: "b2", icon: "👑", name: "Leader", earned: gj >= 2 },
      { id: "b3", icon: "🌍", name: "Explorer", earned: cc >= 3 },
      { id: "b4", icon: "✈️", name: "Flyer", earned: tc >= 3 },
      { id: "b5", icon: "🏕️", name: "Camper", earned: false },
      { id: "b6", icon: "🎒", name: "Backpack", earned: tc >= 1 },
    ];
  }, [stats]);

  const customizerSlices: Record<
    "skin" | "hair" | "eyes" | "mouth" | "outfit" | "more",
    number[]
  > = {
    skin: SKINS.map((_, i) => i),
    hair: [0, 1, 2, 3, 4],
    eyes: [0, 1, 2, 3],
    mouth: [0, 1, 2, 3],
    outfit: OUTFIT_COLORS.map((_, i) => i),
    more: [...ACCESSORY_IDS, ...BG_IDS],
  };

  const renderCustomizerPreview = (idx: number) => {
    if (customizerTab === "hair") {
      const o = { ...avatarOpts, hair: idx };
      return <AvatarFaceSvg o={o} className="h-11 w-11 shrink-0" />;
    }
    if (customizerTab === "skin") {
      const o = { ...avatarOpts, skin: idx };
      return (
        <div
          className="h-11 w-11 shrink-0 rounded-full border-2 border-stone-200"
          style={{ background: SKINS[idx] }}
        />
      );
    }
    if (customizerTab === "eyes") {
      const o = { ...avatarOpts, eyes: idx };
      return <AvatarFaceSvg o={o} className="h-11 w-11 shrink-0" />;
    }
    if (customizerTab === "mouth") {
      const o = { ...avatarOpts, mouth: idx };
      return <AvatarFaceSvg o={o} className="h-11 w-11 shrink-0" />;
    }
    if (customizerTab === "outfit") {
      const o = { ...avatarOpts, outfit: idx };
      return <AvatarFaceSvg o={o} className="h-11 w-11 shrink-0" />;
    }
    /* more */
    if (idx >= 100) {
      const bi = idx - 100;
      const o = { ...avatarOpts, background: bi };
      return <AvatarFaceSvg o={o} className="h-11 w-11 shrink-0" />;
    }
    const o = { ...avatarOpts, accessory: idx };
    return <AvatarFaceSvg o={o} className="h-11 w-11 shrink-0" />;
  };

  const applyCustomizerPick = (idx: number) => {
    setAvatarOpts((prev) => {
      let next = { ...prev };
      if (customizerTab === "skin") next.skin = idx;
      else if (customizerTab === "hair") next.hair = idx;
      else if (customizerTab === "eyes") next.eyes = idx;
      else if (customizerTab === "mouth") next.mouth = idx;
      else if (customizerTab === "outfit") next.outfit = idx;
      else if (customizerTab === "more") {
        if (idx >= 100) next.background = idx - 100;
        else next.accessory = idx;
      }
      return next;
    });
  };

  const pickerActiveIdx = (): number => {
    if (customizerTab === "skin") return avatarOpts.skin;
    if (customizerTab === "hair") return avatarOpts.hair;
    if (customizerTab === "eyes") return avatarOpts.eyes;
    if (customizerTab === "mouth") return avatarOpts.mouth;
    if (customizerTab === "outfit") return avatarOpts.outfit;
    return -1;
  };

  const saveAvatar = () => {
    saveAvatarLs(avatarOpts);
    showToast("Avatar saved");
  };

  const hairColorRow = customizerTab === "hair" && (
    <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
      {HAIR_COLORS.map((hc, i) => (
        <button
          key={hc}
          type="button"
          onClick={() =>
            setAvatarOpts((p) => ({
              ...p,
              hairColor: i,
            }))
          }
          className="h-9 w-9 shrink-0 rounded-full border-2"
          style={{
            background: hc,
            borderColor: avatarOpts.hairColor === i ? RED : "#ddd",
          }}
          aria-label={`Hair color ${i + 1}`}
        />
      ))}
    </div>
  );

  const storyViewer =
    mounted &&
    storyOpen &&
    storyTrips.length > 0 &&
    createPortal(
      <div className="fixed inset-0 z-[80] flex flex-col bg-black text-white">
        <div className="px-3 pt-3">
          <div className="mb-2 h-1 w-full overflow-hidden rounded-full bg-white/20">
            <div
              className="h-full bg-white transition-[width]"
              style={{ width: `${storyProgress * 100}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-sm">
            <span>
              {storyTrips[storyIndex]?.trip.title ?? "Trip"} ·{" "}
              {storyTrips[storyIndex]?.trip.start_date ?? "—"}
            </span>
            <button
              type="button"
              className="text-lg"
              onClick={() => setStoryOpen(false)}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>
        <button
          type="button"
          className="relative flex min-h-0 flex-1 items-center justify-center px-2"
          onClick={(e) => {
            const w = e.currentTarget.getBoundingClientRect().width;
            if (e.clientX - e.currentTarget.getBoundingClientRect().left < w / 2) {
              setStoryIndex((i) => {
                const n = i - 1;
                return n < 0 ? 0 : n;
              });
              setStoryProgress(0);
            } else {
              setStoryIndex((i) => {
                const n = i + 1;
                if (n >= storyTrips.length) {
                  setStoryOpen(false);
                  return i;
                }
                markStoryWatched(storyTrips[n]!.trip.id);
                return n;
              });
              setStoryProgress(0);
            }
          }}
        >
          <div
            className="flex h-[55vh] max-w-lg flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-[#2a3f5f] to-[#1e2a3a] p-6 text-center"
          >
            <AvatarFaceSvg o={avatarOpts} className="mb-4 h-32 w-32" />
            <p className="text-lg font-semibold">
              {storyTrips[storyIndex]?.label}
            </p>
            <p className="mt-2 text-sm text-white/70">
              {storyTrips[storyIndex]?.trip.description?.slice(0, 120) ||
                "Memories from this trip ✨"}
            </p>
          </div>
        </button>
        <div className="p-4">
          <input
            className="w-full rounded-full border border-white/20 bg-white/10 px-4 py-3 text-sm outline-none placeholder:text-white/50"
            placeholder="Reply to story…"
          />
        </div>
      </div>,
      document.body,
    );

  const igPortal =
    mounted &&
    igModal &&
    createPortal(
      <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
          <h3 className="text-lg font-semibold text-[#1e2a3a]">
            Connect Instagram
          </h3>
          <p className="mt-1 text-sm text-stone-600">
            Enter your Instagram username
          </p>
          <input
            value={igDraft}
            onChange={(e) => setIgDraft(e.target.value)}
            className="mt-3 w-full rounded-xl border border-stone-200 px-3 py-2 text-[#1e2a3a]"
            placeholder="@username"
          />
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              className="rounded-xl px-4 py-2 text-stone-600"
              onClick={() => setIgModal(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-xl px-4 py-2 text-white"
              style={{ background: RED }}
              onClick={saveInstagram}
            >
              Save
            </button>
          </div>
        </div>
      </div>,
      document.body,
    );

  const snapPortal =
    mounted &&
    snapModal &&
    createPortal(
      <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
          <h3 className="text-lg font-semibold text-[#1e2a3a]">
            Connect Snapchat
          </h3>
          <p className="mt-1 text-sm text-stone-600">
            Enter your Snapchat username
          </p>
          <input
            value={snapDraft}
            onChange={(e) => setSnapDraft(e.target.value)}
            className="mt-3 w-full rounded-xl border border-stone-200 px-3 py-2 text-[#1e2a3a]"
            placeholder="snap_user"
          />
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              className="rounded-xl px-4 py-2 text-stone-600"
              onClick={() => setSnapModal(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-xl px-4 py-2 text-white"
              style={{ background: RED }}
              onClick={saveSnap}
            >
              Save
            </button>
          </div>
        </div>
      </div>,
      document.body,
    );

  const postPortal =
    mounted &&
    postModal &&
    createPortal(
      <div
        className="fixed inset-0 z-[85] flex items-center justify-center bg-black/60 p-4"
        onClick={() => setPostModal(null)}
      >
        <div
          className="max-h-[90vh] w-full max-w-md overflow-auto rounded-2xl bg-white p-4"
          onClick={(e) => e.stopPropagation()}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={postModal.src}
            alt=""
            className="max-h-[60vh] w-full rounded-xl object-cover"
          />
          <p className="mt-3 text-[#1e2a3a]">{postModal.caption}</p>
          <p className="mt-2 text-sm text-stone-500">
            ♥ {postModal.likes} likes
          </p>
        </div>
      </div>,
      document.body,
    );

  return (
    <div className="min-h-screen pb-16" style={{ background: CREAM }}>
      {storyViewer}
      {igPortal}
      {snapPortal}
      {postPortal}
      {toast && (
        <div
          className="fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 rounded-full px-5 py-2 text-sm text-white shadow-lg"
          style={{ background: NAVY }}
        >
          {toast}
        </div>
      )}

      {/* Top navigation bar */}
      <header className="sticky top-0 z-50 flex items-center gap-1 border-b border-stone-200/90 bg-white/95 px-1 py-2 backdrop-blur-md sm:px-3">
        <button
          type="button"
          className="rounded-full p-2 text-[#1e2a3a] hover:bg-stone-100"
          aria-label="Back"
          onClick={() => router.back()}
        >
          <IconArrowLeft size={20} />
        </button>
        <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
          <PlaceholderAppLogo className="h-8 w-8 shrink-0 rounded-lg" />
          <span className="min-w-0 truncate text-center text-sm font-bold text-[#1e2a3a] sm:text-base">
            {displayName}
          </span>
        </div>
        <div
          ref={profileNavRef}
          className="relative flex shrink-0 items-center gap-0.5"
        >
          <button
            type="button"
            className="rounded-full p-2 text-[#1e2a3a] hover:bg-stone-100"
            aria-label="Share"
            onClick={() => void shareProfile()}
          >
            <IconShare size={20} />
          </button>
          <button
            type="button"
            className="rounded-full p-2 text-[#1e2a3a] hover:bg-stone-100"
            aria-label="Menu"
            aria-expanded={profileNavOpen}
            aria-haspopup="true"
            onClick={() => setProfileNavOpen((o) => !o)}
          >
            <IconMenu size={20} />
          </button>
          {profileNavOpen ? (
            <div
              className="absolute right-0 top-full z-[60] mt-1.5 min-w-[11rem] overflow-hidden rounded-xl border border-stone-200 bg-white py-1 shadow-lg"
              role="menu"
            >
              <Link
                href="/settings"
                role="menuitem"
                className="flex items-center gap-2 px-4 py-2.5 text-sm text-[#1e2a3a] hover:bg-stone-50"
                onClick={() => setProfileNavOpen(false)}
              >
                <IconSettings size={16} className="shrink-0" />
                Account settings
              </Link>
              <Link
                href="/map"
                role="menuitem"
                className="flex items-center gap-2 px-4 py-2.5 text-sm text-[#1e2a3a] hover:bg-stone-50"
                onClick={() => setProfileNavOpen(false)}
              >
                <IconMap size={16} className="shrink-0" />
                Open map
              </Link>
            </div>
          ) : null}
        </div>
      </header>

      {/* Hero: navy banner + overlapping avatars */}
      <div className="relative">
        <div
          className="relative h-36 w-full overflow-hidden sm:h-40"
          style={{ background: NAVY }}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-25"
            style={{
              background:
                "radial-gradient(circle at 20% 30%, #38a169 0%, transparent 45%), radial-gradient(circle at 80% 70%, #e53e3e 0%, transparent 40%)",
            }}
          />
          <div className="absolute bottom-3 right-4 hidden text-xs font-medium text-white/70 sm:block">
            {handle}
          </div>
          <div className="pointer-events-none absolute bottom-0 left-4 translate-y-1/2">
            <div className="flex items-end gap-2 sm:gap-3">
              <AvatarFaceSvg
                o={avatarOpts}
                className="h-[5.25rem] w-[4.75rem] drop-shadow-lg sm:h-24 sm:w-[5.25rem]"
              />
              <div
                className="relative h-14 w-14 overflow-hidden rounded-full border-4 border-white bg-stone-200 shadow-md sm:h-16 sm:w-16"
                style={{ marginBottom: -2 }}
              >
                {photoUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={photoUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-lg font-bold text-stone-500">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Identity block + quick stat pills */}
        <div className="bg-white px-4 pb-4 pt-14 sm:pt-16">
          <div className="mx-auto flex max-w-3xl flex-col gap-3 lg:flex-row lg:items-start lg:gap-8">
            <div className="-mt-20 hidden self-start lg:block lg:w-36">
              <div
                className="mx-auto h-32 w-32 overflow-hidden rounded-full border-4 border-white bg-stone-100 shadow-lg lg:mx-0"
                style={{ boxShadow: "0 8px 24px rgba(30,42,58,0.12)" }}
              >
                {photoUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={photoUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-stone-400">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            </div>

            <div className="min-w-0 flex-1">
              {bootLoading ? (
                <div className="space-y-2">
                  <SkeletonBar className="w-48" />
                  <SkeletonBar className="w-32" h={14} />
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="text-lg font-bold sm:text-xl"
                      style={{ color: NAVY }}
                    >
                      {handle}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-lg bg-stone-100 px-4 py-1.5 text-sm font-semibold text-[#1e2a3a] hover:bg-stone-200"
                      onClick={() => setEditOpen(true)}
                    >
                      Edit profile
                    </button>
                    <button
                      type="button"
                      className="rounded-lg bg-stone-100 px-4 py-1.5 text-sm font-semibold text-[#1e2a3a] hover:bg-stone-200"
                      onClick={() => setContentTab("trips")}
                    >
                      View archive
                    </button>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-[#1e2a3a]">
                    {displayName}
                  </p>
                  {bioLine ? (
                    <p className="mt-1 max-w-lg text-sm leading-relaxed text-stone-700">
                      {bioLine}
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-stone-400">
                      Tap edit profile to add your story ✈️
                    </p>
                  )}
                  {locationLine ? (
                    <p className="mt-1 text-sm text-stone-500">{locationLine}</p>
                  ) : null}
                  <p
                    className="mt-2 text-xs font-medium sm:text-sm"
                    style={{ color: GREEN }}
                  >
                    {level.emoji} Globe Points · {level.label} ·{" "}
                    {pts.toLocaleString()} pts
                  </p>
                  {/* Instagram stats row */}
                  <p className="mt-3 text-sm text-[#1e2a3a]">
                    <button
                      type="button"
                      className="mr-3 font-semibold hover:underline"
                      onClick={() => setContentTab("posts")}
                    >
                      <span className="font-bold">{posts.length}</span> posts
                    </button>
                    <span className="mr-3">
                      <span className="font-bold">{followersCount}</span>{" "}
                      followers
                    </span>
                    <span>
                      <span className="font-bold">{followingCount}</span>{" "}
                      following
                    </span>
                  </p>
                </>
              )}

              {/* Quick stat pills */}
              <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <button
                  type="button"
                  onClick={() => {
                    setEditBio(bioLine);
                    setEditBirthday(birthdayIso);
                    setEditOpen(true);
                  }}
                  className="flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold sm:text-sm"
                  style={{ borderColor: "#e8e8e0", color: NAVY }}
                >
                  {birthdayShort ? `🎈 ${birthdayShort}` : "🎈 Birthday"}
                </button>
                <span
                  className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold sm:text-sm"
                  style={{ background: "#f0f0eb", color: NAVY }}
                >
                  ✈️ {pts.toLocaleString()} score
                </span>
                <span
                  className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold sm:text-sm"
                  style={{ background: "#f5f0ff", color: "#553c9a" }}
                >
                  {zodiacLabel}
                </span>
                <Link
                  href="/travel-hub"
                  className="flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold text-white sm:text-sm"
                  style={{ background: "#3182ce" }}
                >
                  + Trip group
                </Link>
              </div>

              <div className="mt-4 grid grid-cols-4 gap-2 text-center text-sm">
                {[
                  ["Trips", tripsLoading ? "…" : String(tripsCount)],
                  ["Followers", String(followersCount)],
                  ["Following", String(followingCount)],
                  ["Buddies", String(buddiesCount)],
                ].map(([k, v]) => (
                  <div key={k}>
                    <div className="font-bold text-[#1e2a3a]">{v}</div>
                    <div className="text-xs text-stone-500">{k}</div>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  isPro ? "Pro" : "Free",
                  me?.is_verified ? "Verified" : "Unverified",
                  me?.profile_public !== false ? "Public" : "Private",
                  "Early Adopter",
                ].map((b) => (
                  <span
                    key={b}
                    className="rounded-full border px-2 py-0.5 text-xs font-medium"
                    style={{ borderColor: "#e8e8e0", color: NAVY }}
                  >
                    {b}
                  </span>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-full px-4 py-2 text-sm font-semibold text-white"
                  style={{ background: RED }}
                  onClick={() => setEditOpen(true)}
                >
                  Edit profile
                </button>
                <button
                  type="button"
                  className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-[#1e2a3a]"
                  onClick={() => void shareProfile()}
                >
                  Share profile
                </button>
                <button
                  type="button"
                  className="rounded-full border px-4 py-2 text-sm font-semibold"
                  style={{ borderColor: GREEN, color: GREEN }}
                >
                  Follow +
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-4 px-3 pt-2">
        {/* Group map — same Map page as /map (?embed=1 strips chrome) */}
        <section
          className="overflow-hidden rounded-2xl bg-white"
          style={{
            border: CARD_BORDER,
            boxShadow: "0 8px 28px rgba(30, 42, 58, 0.1)",
          }}
        >
          <div className="px-4 pb-0 pt-4">
            <h2 className="text-lg font-bold tracking-tight text-neutral-900">
              Group map
            </h2>
            <p className="mt-1 text-xs text-stone-500">
              Live view of the Map tab — pan and zoom here; open the full map for
              search, layers, and adding pins.
            </p>
          </div>
          <div className="relative mx-4 mb-3 mt-3 h-[min(360px,52vh)] min-h-[260px] overflow-hidden rounded-[1.25rem] shadow-md ring-1 ring-black/8">
            <iframe
              title="Group map"
              src="/map?embed=1"
              className="pointer-events-auto size-full border-0 bg-stone-100"
              loading="lazy"
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[800] flex flex-col items-center bg-gradient-to-t from-black/65 via-black/25 to-transparent px-4 pb-4 pt-20">
              <p className="mb-2 max-w-[18rem] text-center text-sm font-semibold text-white [text-shadow:0_2px_8px_rgba(0,0,0,0.5)]">
                Explore everywhere your group travels
              </p>
              <Link
                href="/map"
                className="pointer-events-auto rounded-full px-9 py-2.5 text-sm font-bold text-white shadow-lg transition-transform hover:scale-[1.03] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2"
                style={{ background: RED }}
              >
                Open full map
              </Link>
            </div>
          </div>
          <p className="px-4 pb-1 text-center text-[11px] text-stone-500">
            The full map adds search, forecast, pins sheet, and route tools.
          </p>
          <div className="flex items-center justify-between gap-3 border-t border-stone-100 px-4 py-3">
            <span className="text-sm text-stone-600">Share my location</span>
            <button
              type="button"
              role="switch"
              aria-checked={mapShare}
              className="relative h-8 w-14 shrink-0 rounded-full transition-colors"
              style={{ background: mapShare ? GREEN : "#ccc" }}
              onClick={() => persistMapShare(!mapShare)}
            >
              <span
                className="absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all"
                style={{ left: mapShare ? 30 : 4 }}
              />
            </button>
          </div>
        </section>

        {/* Communities */}
        <section
          className="rounded-2xl bg-white p-4 shadow-sm"
          style={{ border: CARD_BORDER }}
        >
          <h2 className="text-base font-bold text-[#1e2a3a]">Communities</h2>
          <Link
            href="/travel-hub"
            className="mt-3 flex items-center gap-3 rounded-xl border border-stone-100 p-3 transition-colors hover:bg-stone-50"
          >
            <span className="text-2xl" aria-hidden>
              🎒
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-[#1e2a3a]">Add a trip group</p>
              <p className="text-xs text-stone-500">
                Meet travelers and share your group trip story.
              </p>
            </div>
            <span
              className="rounded-md px-2 py-0.5 text-[10px] font-bold text-white"
              style={{ background: "#3182ce" }}
            >
              NEW
            </span>
            <IconChevronRight size={20} className="shrink-0" />
          </Link>
        </section>

        <section
          className="rounded-2xl bg-white shadow-sm"
          style={{ border: CARD_BORDER }}
        >
          <button
            type="button"
            className="flex w-full items-center gap-3 p-4 text-left hover:bg-stone-50"
            onClick={() => {
              document
                .getElementById("trip-countdown-section")
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          >
            <IconCalendarPlus size={32} className="shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-[#1e2a3a]">
                Create a new countdown!
              </p>
              <p className="text-xs text-stone-500">
                Invite friends or keep it private until takeoff.
              </p>
            </div>
            <IconChevronRight size={20} className="shrink-0" />
          </button>
        </section>

        {/* Spotlight-style trip strips */}
        <section
          className="rounded-2xl bg-white p-4 shadow-sm"
          style={{ border: CARD_BORDER }}
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-base font-bold text-[#1e2a3a]">
              Spotlight &amp; map moments
            </h2>
            <button
              type="button"
              className="text-xs font-semibold"
              style={{ color: RED }}
              onClick={() => setContentTab("trips")}
            >
              View all →
            </button>
          </div>
          <div className="-mx-1 flex gap-2 overflow-x-auto pb-2">
            {tripsLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-40 w-24 shrink-0 animate-pulse rounded-lg bg-stone-200"
                />
              ))}
            {!tripsLoading &&
              storyTrips.slice(0, 8).map(({ trip, label }, i) => {
                const hue =
                  (trip.id.charCodeAt(0) + trip.id.charCodeAt(1)) % 360;
                return (
                  <button
                    key={trip.id}
                    type="button"
                    onClick={() => openStory(i)}
                    className="group relative h-40 w-24 shrink-0 overflow-hidden rounded-lg text-left shadow-sm"
                    style={{
                      background: `linear-gradient(165deg, hsl(${hue} 42% 38%) 0%, hsl(${(hue + 50) % 360} 30% 18%) 100%)`,
                    }}
                  >
                    <div className="absolute right-1.5 top-1.5">
                      <IconMapPin size={16} className="text-white/90 drop-shadow" active />
                    </div>
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-2 pt-8">
                      <div className="flex items-center gap-1 text-[10px] font-medium text-white">
                        <IconPlay size={14} active />
                        {fauxViewsFromId(trip.id).toLocaleString()}
                      </div>
                    </div>
                    <p className="absolute left-2 top-10 line-clamp-2 pr-6 text-[11px] font-semibold leading-tight text-white drop-shadow">
                      {label}
                    </p>
                  </button>
                );
              })}
            {!tripsLoading && storyTrips.length === 0 && (
              <p className="py-6 text-sm text-stone-500">
                Plan a trip to fill this row with stories.
              </p>
            )}
          </div>
        </section>

        {/* Favorites & reposts */}
        <section
          className="rounded-2xl bg-white p-4 shadow-sm"
          style={{ border: CARD_BORDER }}
        >
          <h2 className="mb-3 text-base font-bold text-[#1e2a3a]">
            My favorites &amp; reposts
          </h2>
          <div className="-mx-1 flex gap-2 overflow-x-auto pb-2">
            {favoriteTripCards.map((t) => {
              const hue = (t.id.charCodeAt(0) * 7) % 360;
              return (
                <Link
                  key={t.id}
                  href={`/trips/${t.id}`}
                  className="relative h-36 w-[5.75rem] shrink-0 overflow-hidden rounded-lg sm:w-24"
                  style={{
                    background: `linear-gradient(165deg, hsl(${hue} 35% 45%) 0%, hsl(${(hue + 40) % 360} 28% 25%) 100%)`,
                  }}
                >
                  <div className="absolute right-1.5 top-1.5">
                    <IconBookmark size={16} className="text-white/90" />
                  </div>
                  <p className="absolute inset-x-0 bottom-0 line-clamp-2 bg-black/50 p-2 text-[10px] font-medium text-white">
                    {t.title}
                  </p>
                </Link>
              );
            })}
            {favoriteTripCards.length === 0 && !tripsLoading && (
              <p className="text-sm text-stone-500">
                Heart trips from your archive — we&apos;ll show them here.
              </p>
            )}
          </div>
        </section>

        {/* Travel selfie shortcut → avatar builder */}
        <section
          className="rounded-2xl bg-white p-4 shadow-sm"
          style={{ border: CARD_BORDER }}
        >
          <h2 className="mb-3 text-base font-bold text-[#1e2a3a]">
            My travel selfie
          </h2>
          <button
            type="button"
            className="flex w-full items-center gap-4 rounded-xl border border-dashed border-stone-300 p-4 text-left transition-colors hover:bg-stone-50"
            onClick={() =>
              avatarSectionRef.current?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              })
            }
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-stone-300 bg-stone-50">
              <AvatarFaceSvg o={avatarOpts} className="h-12 w-12" />
            </div>
            <div>
              <p className="font-semibold text-[#1e2a3a]">
                Update my travel avatar
              </p>
              <p className="text-xs text-stone-500">
                Customize skin, hair, and outfits — saved on this device.
              </p>
            </div>
                      <IconChevronRight size={20} className="ml-auto" />
          </button>
        </section>

        {/* ── Avatar builder card ── */}
        <section
          ref={avatarSectionRef}
          className="rounded-2xl bg-white p-4 shadow-sm"
          style={{ border: CARD_BORDER }}
        >
          <p className="text-sm text-stone-500">
            Custom look — saved on this device
          </p>
          <div className="mt-4 flex flex-col items-center">
            <AvatarFaceSvg
              o={avatarOpts}
              className="mx-auto h-[140px] w-[120px]"
            />
            {hairColorRow}
            <div className="mt-4 flex w-full flex-wrap justify-center gap-2">
              {(
                [
                  "skin",
                  "hair",
                  "eyes",
                  "mouth",
                  "outfit",
                  "more",
                ] as const
              ).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setCustomizerTab(t)}
                  className="rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition-colors"
                  style={{
                    background: customizerTab === t ? NAVY : "#f0f0eb",
                    color: customizerTab === t ? "#fff" : NAVY,
                  }}
                >
                  {t === "more" ? "More" : t}
                </button>
              ))}
            </div>
            <div className="mt-3 flex w-full gap-2 overflow-x-auto pb-2">
              {(customizerTab === "more"
                ? [...ACCESSORY_IDS, ...BG_IDS]
                : customizerSlices[customizerTab]
              ).map((idx) => {
                const active =
                  customizerTab === "more"
                    ? idx >= 100
                      ? avatarOpts.background === idx - 100
                      : avatarOpts.accessory === idx
                    : pickerActiveIdx() === idx;
                return (
                  <button
                    key={`${customizerTab}-${idx}`}
                    type="button"
                    onClick={() => applyCustomizerPick(idx)}
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 bg-stone-50 transition-all"
                    style={{
                      borderColor: active ? RED : "#e5e5e0",
                    }}
                  >
                    {renderCustomizerPreview(idx)}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              className="mt-3 w-full max-w-xs rounded-full py-2.5 text-sm font-bold text-white"
              style={{ background: GREEN }}
              onClick={saveAvatar}
            >
              Save avatar
            </button>
          </div>
        </section>

        {/* ── Stories ── */}
        <section
          className="rounded-2xl bg-white p-4 shadow-sm"
          style={{ border: CARD_BORDER }}
        >
          <h2 className="text-lg font-bold" style={{ color: NAVY }}>
            Stories & highlights
          </h2>
          <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
            <Link
              href="/trips/plan"
              className="flex w-[54px] shrink-0 flex-col items-center gap-1"
            >
              <div
                className="flex h-[54px] w-[54px] items-center justify-center rounded-full border-2 border-dashed border-stone-300 text-xl text-stone-400"
              >
                +
              </div>
              <span className="max-w-[64px] truncate text-center text-[11px] text-stone-500">
                New
              </span>
            </Link>
            {tripsLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-[54px] w-[54px] shrink-0 animate-pulse rounded-full bg-stone-200"
                />
              ))}
            {!tripsLoading &&
              storyTrips.map(({ trip, label }, i) => {
                const watched = watchedStoryIds.has(trip.id);
                return (
                  <button
                    key={trip.id}
                    type="button"
                    className="flex w-[54px] shrink-0 flex-col items-center gap-1"
                    onClick={() => openStory(i)}
                  >
                    <div
                      className="h-[54px] w-[54px] rounded-full p-[3px]"
                      style={{
                        background: watched ? "#ccc" : RED,
                      }}
                    >
                      <div className="flex h-full w-full items-center justify-center rounded-full bg-white p-0.5">
                        <AvatarFaceSvg o={avatarOpts} className="h-10 w-10" />
                      </div>
                    </div>
                    <span className="max-w-[64px] truncate text-center text-[11px] text-stone-600">
                      {label}
                    </span>
                  </button>
                );
              })}
          </div>
        </section>

        {/* ── Content tabs ── */}
        <section
          className="rounded-2xl bg-white p-2 shadow-sm"
          style={{ border: CARD_BORDER }}
        >
          <div className="flex justify-around border-b border-stone-100 px-1">
            {(
              [
                { id: "posts" as const, Icon: IconGrid },
                { id: "reels" as const, Icon: IconClapperboard },
                { id: "trips" as const, Icon: IconPlane },
                { id: "saved" as const, Icon: IconBookmark },
                { id: "tagged" as const, Icon: IconUserSquare },
              ] as const
            ).map(({ id: t, Icon }) => (
              <button
                key={t}
                type="button"
                onClick={() => setContentTab(t)}
                className="relative flex min-w-[52px] flex-1 flex-col items-center gap-1 py-3"
                style={{ color: contentTab === t ? RED : "#64748b" }}
                aria-label={t}
                title={t}
              >
                <Icon
                  size={24}
                  active={contentTab === t}
                />
                {contentTab === t && (
                  <span
                    className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full"
                    style={{ background: RED }}
                  />
                )}
              </button>
            ))}
          </div>
          <div className="p-3">
            {contentTab === "posts" && (
              <>
                {postsLoading && (
                  <div className="grid grid-cols-3 gap-1">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <SkeletonBar key={i} className="aspect-square w-full" h={120} />
                    ))}
                  </div>
                )}
                {!postsLoading && posts.length === 0 && (
                  <p className="py-8 text-center text-sm text-stone-500">
                    No posts yet — complete a trip to share memories!
                  </p>
                )}
                {!postsLoading && posts.length > 0 && (
                  <div className="grid grid-cols-3 gap-1">
                    {posts.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="group relative aspect-square overflow-hidden rounded-sm bg-stone-100"
                        onClick={() => setPostModal(p)}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={p.src}
                          alt=""
                          className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        />
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-3 bg-black/50 text-sm font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">
                          <span className="flex items-center gap-1">
                            ♥ {p.likes}
                          </span>
                          <span className="flex items-center gap-1">
                            <IconMessageCircle size={16} />
                            0
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
            {contentTab === "reels" && (
              <p className="py-10 text-center text-stone-500">Coming soon</p>
            )}
            {contentTab === "trips" && (
              <div className="space-y-3">
                {tripsLoading && <SkeletonBar className="w-full" h={80} />}
                {!tripsLoading && completedTrips.length === 0 && (
                  <p className="text-center text-sm text-stone-500">
                    No completed trips yet.
                  </p>
                )}
                {completedTrips.map((t) => (
                  <div
                    key={t.id}
                    className="rounded-xl border border-stone-100 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold text-[#1e2a3a]">
                          {t.title}
                        </div>
                        <div className="text-xs text-stone-500">
                          {t.group_name || "Group trip"}
                        </div>
                      </div>
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{ background: "#eef2e8", color: NAVY }}
                      >
                        {t.status}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-stone-600">
                      <span>
                        {t.start_date ?? "?"} → {t.end_date ?? "?"}
                      </span>
                      <span>{t.member_count} members</span>
                      <span>
                        Expenses: $
                        {(expenseTotals[t.id] ?? 0).toLocaleString(undefined, {
                          maximumFractionDigits: 0,
                        })}
                      </span>
                    </div>
                    <Link
                      href={`/trips/${t.id}`}
                      className="mt-2 inline-block text-sm font-semibold"
                      style={{ color: RED }}
                    >
                      Open trip →
                    </Link>
                  </div>
                ))}
              </div>
            )}
            {contentTab === "saved" && (
              <div className="space-y-2">
                {savedPins.length === 0 && (
                  <p className="py-6 text-center text-sm text-stone-500">
                    No saved pins yet. Save spots from the map!
                  </p>
                )}
                {savedPins.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-xl border border-stone-100 px-3 py-2"
                  >
                    <span className="text-sm font-medium text-[#1e2a3a]">
                      {p.name}
                    </span>
                    <Link href="/map" className="text-sm" style={{ color: RED }}>
                      Map
                    </Link>
                  </div>
                ))}
              </div>
            )}
            {contentTab === "tagged" && (
              <p className="py-10 text-center text-stone-500">Coming soon</p>
            )}
          </div>
        </section>

        {/* Trip countdown */}
        <section
          id="trip-countdown-section"
          className="rounded-2xl bg-white p-4 shadow-sm"
          style={{ border: CARD_BORDER }}
        >
          <h2 className="text-lg font-bold" style={{ color: NAVY }}>
            Trip countdown
          </h2>
          {tripsLoading && <SkeletonBar className="mt-3" h={100} />}
          {!tripsLoading && upcomingTrips.length === 0 && (
            <div className="mt-4 text-center">
              <p className="text-sm text-stone-500">
                Create a trip to see your countdown here
              </p>
              <Link
                href="/trips/plan"
                className="mt-3 inline-flex rounded-full px-5 py-2 text-sm font-bold text-white"
                style={{ background: RED }}
              >
                + Plan a trip
              </Link>
            </div>
          )}
          {!tripsLoading &&
            upcomingTrips.map((t) => {
              const d0 = parseYmd(t.start_date);
              const now = new Date();
              now.setHours(0, 0, 0, 0);
              const diff = d0
                ? Math.max(
                    0,
                    Math.ceil(
                      (d0.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
                    ),
                  )
                : 0;
              return (
                <div
                  key={t.id}
                  className="mt-4 rounded-xl border border-stone-100 p-4 text-center"
                  style={{ background: "#fafaf8" }}
                >
                  <div
                    className="text-5xl font-black tabular-nums"
                    style={{ color: RED }}
                  >
                    {diff}
                  </div>
                  <div className="text-xs uppercase tracking-wide text-stone-500">
                    days to go
                  </div>
                  <p className="mt-2 font-semibold text-[#1e2a3a]">{t.title}</p>
                  <p className="text-sm text-stone-500">{t.start_date}</p>
                  <p className="text-xs text-stone-500">
                    {t.member_count} members joined
                  </p>
                  <button
                    type="button"
                    className="mt-3 w-full rounded-full border py-2 text-sm font-semibold"
                    style={{ borderColor: RED, color: RED }}
                    onClick={() => {
                      const msg = `⏳ ${diff} days until ${t.title}! (${t.start_date ?? ""}) — Group Travel OS`;
                      void navigator.clipboard
                        .writeText(msg)
                        .then(() =>
                          showToast("Countdown copied — paste in group chat"),
                        )
                        .catch(() => showToast("Could not copy"));
                    }}
                  >
                    Share countdown
                  </button>
                </div>
              );
            })}
        </section>

        {/* Social */}
        <section
          className="rounded-2xl bg-white p-4 shadow-sm"
          style={{ border: CARD_BORDER }}
        >
          <h2 className="text-lg font-bold" style={{ color: NAVY }}>
            Connected accounts
          </h2>
          <div className="mt-3 space-y-3">
            {[
              {
                name: "Instagram",
                emoji: "📸",
                connected: Boolean(igUser),
                onConnect: () => {
                  setIgDraft(igUser);
                  setIgModal(true);
                },
                href: igUser ? `https://instagram.com/${igUser}` : null,
              },
              {
                name: "Snapchat",
                emoji: "👻",
                connected: Boolean(snapUser),
                onConnect: () => {
                  setSnapDraft(snapUser);
                  setSnapModal(true);
                },
                href: snapUser ? `https://www.snapchat.com/add/${snapUser}` : null,
              },
              {
                name: "Facebook",
                emoji: "f",
                connected: false,
                disabled: true,
                onConnect: () => {},
                href: null,
              },
              {
                name: "WhatsApp",
                emoji: "💬",
                connected: Boolean(waPhone),
                onConnect: () => {
                  const n = window.prompt("Phone number (with country code)") ?? "";
                  if (n.trim()) {
                    localStorage.setItem(LS_WHATSAPP, n.trim());
                    setWaPhone(n.trim());
                    showToast("WhatsApp saved");
                  }
                },
                href: waPhone ? `https://wa.me/${waPhone.replace(/\D/g, "")}` : null,
              },
            ].map((row) => (
              <div
                key={row.name}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-stone-100 p-3"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">{row.emoji}</span>
                  <span className="font-medium text-[#1e2a3a]">{row.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  {row.connected && (
                    <span className="text-xs text-green-700">Connected</span>
                  )}
                  {"disabled" in row && row.disabled ? (
                    <button
                      type="button"
                      disabled
                      className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-400"
                    >
                      Soon
                    </button>
                  ) : row.connected ? (
                    row.href && (
                      <a
                        href={row.href}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-semibold"
                        style={{ color: RED }}
                      >
                        View profile
                      </a>
                    )
                  ) : (
                    <button
                      type="button"
                      className="rounded-full px-3 py-1 text-xs font-bold text-white"
                      style={{ background: NAVY }}
                      onClick={row.onConnect}
                    >
                      Connect
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Stats & globe */}
        <section
          className="mb-8 rounded-2xl bg-white p-4 shadow-sm"
          style={{ border: CARD_BORDER }}
        >
          <h2 className="text-lg font-bold" style={{ color: NAVY }}>
            Travel stats & Globe Points
          </h2>
          {bootLoading ? (
            <SkeletonBar className="mt-3" h={120} />
          ) : (
            <>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ["Globe Points", String(pts)],
                  ["Day streak", String(streakDays)],
                  ["Countries", String(stats?.countries_from_trips?.length ?? 0)],
                  ["Trips done", String(stats?.trips_created ?? tripsCount)],
                ].map(([k, v]) => (
                  <div
                    key={k}
                    className="rounded-xl p-3 text-center"
                    style={{ background: "#f8f8f4" }}
                  >
                    <div className="text-lg font-bold text-[#1e2a3a]">{v}</div>
                    <div className="text-[11px] text-stone-500">{k}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <div className="mb-1 flex justify-between text-xs text-stone-600">
                  <span>
                    {level.label} ({level.min}+)
                  </span>
                  <span>
                    {level.next
                      ? `Next: ${level.next.label} (${level.next.min})`
                      : "Max level"}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-stone-200">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${levelBarFraction(pts) * 100}%`,
                      background: GREEN,
                    }}
                  />
                </div>
              </div>
              <h3 className="mt-4 text-sm font-bold text-[#1e2a3a]">Badges</h3>
              <div className="mt-2 grid grid-cols-3 gap-3 sm:grid-cols-6">
                {badges.map((b) => (
                  <div key={b.id} className="flex flex-col items-center text-center">
                    <div
                      className="flex h-11 w-11 items-center justify-center rounded-full text-lg"
                      style={{
                        background: b.earned ? "#e8f8f1" : "#eee",
                        opacity: b.earned ? 1 : 0.45,
                      }}
                    >
                      {b.earned ? b.icon : "🔒"}
                    </div>
                    <span className="mt-1 max-w-[72px] text-[10px] text-stone-600">
                      {b.name}
                    </span>
                  </div>
                ))}
              </div>
              <h3 className="mt-4 text-sm font-bold text-[#1e2a3a]">
                Activity (last 7 days)
              </h3>
              <div className="mt-2 flex justify-between gap-1">
                {activityWeek.map((on, i) => (
                  <div key={i} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{
                        background: on ? GREEN : "#e5e5e0",
                        boxShadow: on ? `0 0 0 2px ${GREEN}33` : "none",
                      }}
                    />
                    <span className="text-[9px] text-stone-400">
                      D{7 - i}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </div>

      <footer className="mx-auto max-w-3xl px-3 pb-12 pt-6 text-center">
        <p className="text-xs text-stone-400">
          {joinedLabel
            ? `Joined Group Travel on ${joinedLabel}.`
            : "Group Travel OS — your trips, your crew."}
        </p>
        <p className="mt-2 text-[11px] text-stone-300">Travel avatar · Map · Stories</p>
      </footer>

      {/* Edit modal (simple) */}
      {editOpen && (
        <div className="fixed inset-0 z-[85] flex items-end justify-center bg-black/40 sm:items-center">
          <div className="w-full max-w-md rounded-t-2xl bg-white p-5 sm:rounded-2xl">
            <h3 className="text-lg font-bold" style={{ color: NAVY }}>
              Edit profile
            </h3>
            <label className="mt-3 block text-xs font-semibold text-stone-500">
              Name
            </label>
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2"
            />
            <label className="mt-2 block text-xs font-semibold text-stone-500">
              Username
            </label>
            <input
              value={editUsername}
              onChange={(e) => setEditUsername(e.target.value.toLowerCase())}
              className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2"
            />
            <label className="mt-2 block text-xs font-semibold text-stone-500">
              Birthday (for zodiac pill)
            </label>
            <input
              type="date"
              value={editBirthday}
              onChange={(e) => setEditBirthday(e.target.value)}
              className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2"
            />
            <label className="mt-2 block text-xs font-semibold text-stone-500">
              Bio
            </label>
            <textarea
              value={editBio}
              onChange={(e) => setEditBio(e.target.value.slice(0, 150))}
              rows={3}
              className="mt-1 w-full resize-none rounded-xl border border-stone-200 px-3 py-2 text-sm"
              placeholder="My story ✈️"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-xl px-4 py-2 text-stone-600"
                onClick={() => setEditOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saveBusy}
                className="rounded-xl px-4 py-2 text-white disabled:opacity-50"
                style={{ background: RED }}
                onClick={() => void onSaveProfile()}
              >
                {saveBusy ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
