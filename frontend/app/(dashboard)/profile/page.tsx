"use client";

import Link from "next/link";
import { LogOut, User, Lock, Eye, EyeOff, Archive, HelpCircle, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { RovvyLogo } from "@/components/RovvyLogo";
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

import BrandedLoading from "@/components/BrandedLoading";
import { apiFetch, apiFetchWithStatus } from "@/lib/api";
import { clearToken, getToken } from "@/lib/auth";
import {
  bindAvatarStorageToUser,
  isSyntheticGuestUsername,
  LS_AVATAR,
} from "@/lib/userSessionStorage";

/* ─── design tokens ───────────────────────────────────────── */
const RED = "#e53e3e";
const NAVY = "#1e2a3a";
const GREEN = "#1d9e75";
const CREAM = "#f5f5f0";
const CARD_BORDER = "1px solid #e8e8e0";

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
  cover_url?: string | null;
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

function saveAvatarLs(opts: AvatarOptions, userId: string) {
  try {
    bindAvatarStorageToUser(userId);
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
  const coverInputRef = useRef<HTMLInputElement>(null);
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
    "posts" | "reels" | "trips" | "saved" | "tagged" | "friends"
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
  const [birthdayVisibility, setBirthdayVisibility] = useState("friends"); // only_me, friends, everyone
  const [statsVisibility, setStatsVisibility] = useState({
    trips: true,
    countries: true,
    cities: true,
    buddies: true,
  });
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

  const handleSignOut = useCallback(() => {
    const confirmed = window.confirm(
      "Are you sure you want to sign out?",
    );
    if (!confirmed) return;
    clearToken();
    window.location.href = "/login";
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
    if (!me?.id) return;
    bindAvatarStorageToUser(me.id);
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
  }, [me?.id]);

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
        if (meRes.status === 401 || !meRes.data?.id) {
          clearToken();
          router.replace("/login");
          return;
        }
        if (
          isSyntheticGuestUsername(meRes.data.username) &&
          meRes.data.username
        ) {
          clearToken();
          router.replace("/login");
          return;
        }
        bindAvatarStorageToUser(meRes.data.id);
        setMe(meRes.data);
        setEditName(meRes.data.full_name ?? "");
        setEditUsername(meRes.data.username?.trim() ?? "");
        setEditBio(localStorage.getItem(LS_BIO) ?? "");
        setEditBirthday(localStorage.getItem(LS_BIRTHDAY) ?? "");

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
        if (!c) {
          clearToken();
          router.replace("/login");
        }
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
  const displayName = me?.full_name?.trim() || me?.email?.split("@")[0] || "Account";
  const handle = (() => {
    if (!me?.id) return "";
    const raw = me.username?.trim();
    if (raw && !isSyntheticGuestUsername(raw)) {
      const bare = raw.replace(/^@/, "");
      return bare;
    }
    return `user_${me.id.replace(/-/g, "").slice(0, 8)}`;
  })();
  const locationLine = [me?.home_city, me?.country].filter(Boolean).join(", ");
  const photoUrl =
    me?.profile_picture?.trim() ||
    (isHttpPhoto(me?.avatar_url) ? me?.avatar_url : null);
  const coverUrl =
    me?.cover_url?.trim() ||
    "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1200&h=400&fit=crop";

  const pts = globePoints(stats, streakDays);
  const level = globeLevelFromPoints(pts);

  const joinedLabel = formatJoinedDate(me?.created_at ?? null);
  
  // Ownership check: for now we assume true as this is the /profile route
  // In the future, this can be checked against a URL param vs me.id
  const isOwner = true;

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

  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64Data = reader.result as string;
      try {
        const updated = await apiFetch<UserMe>("/auth/me", {
          method: "PATCH",
          body: JSON.stringify({
            cover_url: base64Data,
          }),
        });
        setMe(updated);
        showToast("Cover image updated!");
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Failed to update cover");
      }
    };
    reader.onerror = () => {
      showToast("Error reading file");
    };
    reader.readAsDataURL(file);
  };

  const triggerCoverUpload = (e: React.MouseEvent) => {
    e.stopPropagation();
    coverInputRef.current?.click();
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
      const next = { ...prev };
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
    if (!me?.id) return;
    saveAvatarLs(avatarOpts, me.id);
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

  if (bootLoading || !me?.id) {
    return <BrandedLoading fullScreen message="Loading your profile…" />;
  }

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

      {/* 1. PROFILE HERO HEADER */}
      <div className="relative">
        {/* Cover Image - Full Bleed */}
        <div 
          className={`relative h-56 w-full overflow-hidden bg-stone-200 md:h-72 ${isOwner ? "cursor-pointer" : ""}`}
          onClick={isOwner ? triggerCoverUpload : undefined}
        >
          <input
            type="file"
            ref={coverInputRef}
            onChange={handleCoverChange}
            accept="image/*"
            className="hidden"
          />
          <img 
            src={coverUrl} 
            alt="Cover" 
            className="h-full w-full object-cover" 
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/40" />
          
          {isOwner && (
            <button
              type="button"
              onClick={triggerCoverUpload}
              className="absolute bottom-4 right-4 rounded-full bg-black/50 p-2.5 text-white text-xs font-semibold backdrop-blur-sm flex items-center gap-1.5 hover:bg-black/70 transition-all border border-white/10"
            >
              <span>📷</span>
              <span>Change Cover</span>
            </button>
          )}
          
          {/* Floating Action Buttons - Styled elegantly */}
          <div className="absolute inset-x-0 top-0 flex items-center justify-end p-4 bg-gradient-to-b from-black/40 to-transparent">
            <div className="flex gap-3">
              <button
                type="button"
                className="rounded-full bg-white/20 backdrop-blur-md p-2.5 text-white hover:bg-white/40 transition-colors shadow-sm flex items-center justify-center"
                aria-label="Share"
                onClick={() => void shareProfile()}
              >
                <IconShare size={18} />
              </button>
              <button
                type="button"
                className="rounded-full bg-white/20 backdrop-blur-md p-2.5 text-white hover:bg-white/40 transition-colors shadow-sm flex items-center justify-center"
                aria-label="Menu"
                onClick={() => setProfileNavOpen(!profileNavOpen)}
              >
                <IconMenu size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Profile Info Area - Overlapping */}
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="relative -mt-20 flex flex-col items-center sm:-mt-24 sm:flex-row sm:items-end sm:gap-6">
            {/* Avatar */}
            <div className="relative h-36 w-36 shrink-0 overflow-hidden rounded-full border-4 border-white bg-white shadow-lg sm:h-44 sm:w-44">
              {photoUrl ? (
                <img src={photoUrl} alt={displayName} className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-stone-100 flex items-center justify-center">
                  <AvatarFaceSvg o={avatarOpts} className="h-32 w-32" />
                </div>
              )}
            </div>

            {/* Identity */}
            <div className="mt-4 flex flex-1 flex-col items-center text-center sm:mt-0 sm:items-start sm:pb-2 sm:text-left min-w-0">
              <div className="flex items-center gap-2 max-w-full">
                <h1 className="text-2xl font-extrabold text-stone-800 sm:text-3xl break-words">{displayName}</h1>
                {me?.is_verified && (
                  <span className="text-teal-600 shrink-0" title="Verified">
                    <IconPlane size={20} active />
                  </span>
                )}
              </div>
              <p className="text-sm font-medium text-stone-500">@{handle.replace(/^@/, "")}</p>
              
              {locationLine && (
                <div className="mt-2 flex items-center gap-1 text-sm text-stone-600">
                  <IconMapPin size={16} className="text-teal-600" />
                  <span>{locationLine}</span>
                </div>
              )}
              
              {/* Action Row - Separated clearly */}
              {isOwner && (
                <div className="mt-4 flex gap-2 w-full sm:w-auto">
                  <button 
                    type="button"
                    className="flex items-center justify-center gap-2 rounded-full bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 transition-colors shadow-sm w-full sm:w-auto"
                    onClick={() => setEditOpen(true)}
                  >
                    <span>Edit Profile</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Bio & Vibe Tags */}
          <div className="mt-5 max-w-3xl text-center sm:text-left">
            {bioLine ? (
              <p className="text-sm text-stone-600 leading-relaxed">{bioLine}</p>
            ) : isOwner ? (
              <p className="text-sm text-stone-400 italic">Add your story ✈️</p>
            ) : (
              <p className="text-sm text-stone-400 italic">No bio yet.</p>
            )}
            
            <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
              <span className="rounded-full bg-teal-50 px-3.5 py-1 text-xs font-semibold text-teal-700">
                {level.emoji} {level.label}
              </span>
              <span className="rounded-full bg-stone-100 px-3.5 py-1 text-xs font-semibold text-stone-700">
                🏆 {pts.toLocaleString()} pts
              </span>
              {zodiacLabel && (
                <span className="rounded-full bg-amber-50 px-3.5 py-1 text-xs font-semibold text-amber-700">
                  {zodiacLabel}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-8 max-w-4xl px-4 sm:px-6 lg:px-8 space-y-8">
        {/* 2. PREMIUM STATS ROW */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { key: "trips", label: "Trips Done", value: tripsLoading ? "…" : String(tripsCount), icon: IconPlane, color: "bg-teal-50 text-teal-600", onClick: () => setContentTab("trips") },
            { key: "countries", label: "Countries", value: String(stats?.countries_from_trips?.length ?? 0), icon: IconMap, color: "bg-sky-50 text-sky-600", href: "/map" },
            { key: "cities", label: "Cities", value: String(stats?.locations_saved ?? 0), icon: IconMapPin, color: "bg-amber-50 text-amber-600", href: "/map" },
            { key: "buddies", label: "Buddies", value: String(buddiesCount), icon: IconUserSquare, color: "bg-rose-50 text-rose-600", onClick: () => setContentTab("friends") },
          ]
            .filter((stat) => isOwner || statsVisibility[stat.key as keyof typeof statsVisibility])
            .map((stat) => {
              const isVisible = statsVisibility[stat.key as keyof typeof statsVisibility];
              const CardContent = (
                <>
                  <div className={`mb-2 flex h-10 w-10 items-center justify-center rounded-full ${stat.color}`}>
                    <stat.icon size={20} active />
                  </div>
                  <div className="text-2xl font-bold text-stone-800">{stat.value}</div>
                  <div className="text-xs font-medium text-stone-500 uppercase tracking-wide mt-0.5">{stat.label}</div>
                  
                  {isOwner && (
                    <div
                      className="absolute top-2 right-2 p-1 text-stone-400 hover:text-stone-600 cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setStatsVisibility((prev) => ({ ...prev, [stat.key]: !isVisible }));
                      }}
                    >
                      {isVisible ? <Eye size={16} /> : <EyeOff size={16} />}
                    </div>
                  )}
                </>
              );
              
              return stat.href ? (
                <Link href={stat.href} key={stat.key} className="relative flex flex-col items-center rounded-2xl border border-stone-100 bg-white p-5 text-center shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                  {CardContent}
                </Link>
              ) : (
                <button key={stat.key} onClick={stat.onClick} className="relative flex flex-col items-center rounded-2xl border border-stone-100 bg-white p-5 text-center shadow-sm hover:shadow-md transition-shadow cursor-pointer w-full">
                  {CardContent}
                </button>
              )
            })}
        </div>

        {/* 3. GROUP MAP - Cleaned Up */}
        <div className="overflow-hidden rounded-2xl border border-stone-100 bg-white shadow-sm hover:shadow-md transition-shadow">
          <div className="px-5 py-4 flex items-center justify-between border-b border-stone-50">
            <div>
              <h2 className="text-lg font-bold text-stone-800">Travel Map</h2>
              <p className="text-xs text-stone-500 mt-0.5">Live view of your group travels</p>
            </div>
            <Link
              href="/map"
              className="text-sm font-semibold text-teal-600 hover:text-teal-700"
            >
              Full Map →
            </Link>
          </div>
          <div className="relative h-64 bg-stone-50">
            <iframe
              title="Group map"
              src="/map?embed=1"
              className="pointer-events-auto size-full border-0"
              loading="lazy"
            />
            {/* Minimal overlay to prevent accidental scrolling while browsing profile */}
            <div className="absolute inset-0 bg-black/5 pointer-events-none" />
          </div>

        </div>

        {/* 4. INTENTIONAL CARDS: COMMUNITIES & SPOTLIGHT */}
        <div className="grid gap-6 sm:grid-cols-2">
          {/* Communities Card */}
          <div className="rounded-2xl border border-stone-100 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-stone-800">Communities</h2>
              <span className="text-xl">🎒</span>
            </div>
            <p className="text-sm text-stone-600 leading-relaxed">
              Join travel groups, meet like-minded explorers, and share your journey.
            </p>
            <Link
              href="/travel-hub"
              className="mt-4 inline-flex items-center gap-2 rounded-full border border-teal-600 px-4 py-1.5 text-xs font-semibold text-teal-600 hover:bg-teal-50"
            >
              Explore Hub
              <IconChevronRight size={14} />
            </Link>
          </div>

          {/* Spotlight Card */}
          <div className="rounded-2xl border border-stone-100 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-stone-800">Spotlight</h2>
              <span className="text-xl">✨</span>
            </div>
            {upcomingTrips.length > 0 ? (
              <div>
                <p className="text-sm text-stone-600 font-medium truncate">{upcomingTrips[0].title}</p>
                <p className="text-xs text-stone-500 mt-0.5">{upcomingTrips[0].start_date}</p>
                <div className="mt-3 flex -space-x-2">
                  {Array.from({ length: Math.min(3, upcomingTrips[0].member_count) }).map((_, i) => (
                    <div key={i} className="h-6 w-6 rounded-full bg-stone-200 border-2 border-white flex items-center justify-center text-[10px] font-bold text-stone-600">
                      ?
                    </div>
                  ))}
                  {upcomingTrips[0].member_count > 3 && (
                    <div className="h-6 w-6 rounded-full bg-stone-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-stone-500">
                      +{upcomingTrips[0].member_count - 3}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <p className="text-sm text-stone-500">No upcoming trips planned yet.</p>
                <Link href="/trips/plan" className="mt-4 inline-flex items-center gap-2 rounded-full bg-teal-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-teal-700">
                  Plan a Trip
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* 5. HIGHLIGHT STRIP (Stories) */}
        {storyTrips.length > 0 && (
          <div>
            <h2 className="mb-3 text-sm font-semibold text-stone-500 uppercase tracking-wide">Highlights</h2>
            <div className="flex gap-4 overflow-x-auto pb-2 [scrollbar-width:thin]">
              {storyTrips.slice(0, 8).map(({ trip, label }, i) => (
                <button
                  key={trip.id}
                  type="button"
                  onClick={() => openStory(i)}
                  className="flex flex-col items-center gap-1.5 shrink-0"
                >
                  <div className="h-16 w-16 rounded-full p-0.5 border-2 border-teal-600 bg-white flex items-center justify-center shadow-sm">
                    <div className="h-14 w-14 rounded-full bg-stone-100 overflow-hidden flex items-center justify-center">
                      <AvatarFaceSvg o={avatarOpts} className="h-12 w-12" />
                    </div>
                  </div>
                  <span className="max-w-[72px] truncate text-xs font-medium text-stone-700">
                    {label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 6. MAIN PROFILE TABS */}
        <div className="border-b border-stone-200">
          <nav className="flex gap-6 overflow-x-auto [scrollbar-width:none]">
            {[
              { id: "posts", label: "Photos", icon: IconGrid },
              { id: "trips", label: "Trips", icon: IconPlane },
              { id: "saved", label: "Bucket List", icon: IconBookmark },
              { id: "friends", label: "Friends", icon: IconUserSquare },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setContentTab(tab.id as any)}
                className={`flex items-center gap-2 border-b-2 py-3.5 px-1 text-sm font-semibold transition-colors ${
                  contentTab === tab.id
                    ? "border-teal-600 text-teal-600"
                    : "border-transparent text-stone-500 hover:text-stone-700"
                }`}
              >
                <tab.icon size={16} active={contentTab === tab.id} />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* 7. TAB CONTENT - Better Empty States */}
        <div className="min-h-[200px]">
          {contentTab === "posts" && (
            <div>
              {postsLoading ? (
                <div className="grid grid-cols-3 gap-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <SkeletonBar key={i} className="aspect-square w-full rounded-xl" h={120} />
                  ))}
                </div>
              ) : posts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="h-16 w-16 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 mb-4">
                    <IconGrid size={24} />
                  </div>
                  <h3 className="text-lg font-bold text-stone-800">No photos yet</h3>
                  <p className="text-sm text-stone-500 mt-1 max-w-sm">Complete a trip and share your favorite moments with your crew.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {posts.map((p) => (
                    <div key={p.id} className="aspect-square overflow-hidden rounded-xl bg-stone-100 group relative shadow-sm">
                      <img src={p.src} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-sm font-semibold">
                        ♥ {p.likes}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {contentTab === "trips" && (
            <div>
              {tripsLoading ? (
                <SkeletonBar className="w-full rounded-xl" h={80} />
              ) : completedTrips.length === 0 && upcomingTrips.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="h-16 w-16 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 mb-4">
                    <IconPlane size={24} />
                  </div>
                  <h3 className="text-lg font-bold text-stone-800">No trips yet</h3>
                  <p className="text-sm text-stone-500 mt-1 max-w-sm">Start planning your next adventure with friends.</p>
                  <Link href="/trips/plan" className="mt-4 inline-flex items-center gap-2 rounded-full bg-teal-600 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-700">
                    Plan a Trip
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {upcomingTrips.map((t) => (
                    <div key={t.id} className="rounded-2xl border border-stone-100 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-stone-800">{t.title}</div>
                          <div className="text-xs text-stone-500 mt-0.5">{t.group_name || "Group trip"}</div>
                        </div>
                        <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold bg-teal-50 text-teal-700">
                          Upcoming
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-4 text-xs text-stone-600">
                        <span>📅 {t.start_date ?? "?"}</span>
                        <span>👥 {t.member_count} members</span>
                      </div>
                    </div>
                  ))}
                  {completedTrips.map((t) => (
                    <div key={t.id} className="rounded-2xl border border-stone-100 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-stone-800">{t.title}</div>
                          <div className="text-xs text-stone-500 mt-0.5">{t.group_name || "Group trip"}</div>
                        </div>
                        <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold bg-stone-100 text-stone-600">
                          Completed
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-4 text-xs text-stone-600">
                        <span>📅 {t.start_date ?? "?"}</span>
                        <span>👥 {t.member_count} members</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {contentTab === "saved" && (
            <div>
              {savedPins.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="h-16 w-16 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 mb-4">
                    <IconBookmark size={24} />
                  </div>
                  <h3 className="text-lg font-bold text-stone-800">Your bucket list is empty</h3>
                  <p className="text-sm text-stone-500 mt-1 max-w-sm">Save spots from the map to build your dream itinerary.</p>
                  <Link href="/map" className="mt-4 inline-flex items-center gap-2 rounded-full border border-teal-600 px-5 py-2 text-sm font-semibold text-teal-600 hover:bg-teal-50">
                    Explore Map
                  </Link>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {savedPins.map((p) => (
                    <div key={p.id} className="flex items-center justify-between rounded-xl border border-stone-100 bg-white px-4 py-3 shadow-sm">
                      <span className="text-sm font-semibold text-stone-800">{p.name}</span>
                      <Link href="/map" className="text-sm font-semibold text-teal-600 hover:text-teal-700">View</Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {contentTab === "friends" && (
            <div>
              {connections.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="h-16 w-16 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 mb-4">
                    <IconUserSquare size={24} />
                  </div>
                  <h3 className="text-lg font-bold text-stone-800">No friends connected</h3>
                  <p className="text-sm text-stone-500 mt-1 max-w-sm">Connect with other travelers to coordinate group trips.</p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {connections.map((c) => (
                    <div key={c.id} className="flex items-center justify-between rounded-2xl border border-stone-100 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 overflow-hidden rounded-full bg-stone-100 flex items-center justify-center text-sm font-bold text-stone-500">
                          {c.username?.charAt(0).toUpperCase() || "?"}
                        </div>
                        <div>
                          <h4 className="font-bold text-stone-800">@{c.username}</h4>
                        </div>
                      </div>
                      <button className="rounded-full border border-teal-600 px-4 py-1.5 text-xs font-semibold text-teal-600 hover:bg-teal-50">
                        Message
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <footer className="mx-auto max-w-3xl px-3 pb-12 pt-12 text-center">
        <p className="text-xs text-stone-400">
          {joinedLabel
            ? `Joined Rovvy on ${joinedLabel}.`
            : "Rovvy — your trips, your crew."}
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
            <div className="flex gap-2">
              <input
                type="date"
                value={editBirthday}
                onChange={(e) => setEditBirthday(e.target.value)}
                className="mt-1 flex-1 rounded-xl border border-stone-200 px-3 py-2 text-sm"
              />
              <select
                value={birthdayVisibility}
                onChange={(e) => setBirthdayVisibility(e.target.value)}
                className="mt-1 rounded-xl border border-stone-200 px-3 py-2 text-sm text-stone-700"
              >
                <option value="only_me">Only me</option>
                <option value="friends">Friends</option>
                <option value="everyone">Everyone</option>
              </select>
            </div>
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

      {/* 8. SETTINGS DRAWER / ACTION SHEET */}
      {profileNavOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 sm:items-center">
          {/* Backdrop */}
          <div className="absolute inset-0" onClick={() => setProfileNavOpen(false)} />
          
          {/* Sheet */}
          <div className="relative w-full max-w-md rounded-t-3xl bg-white p-6 shadow-2xl transition-transform sm:rounded-3xl sm:max-w-sm">
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-stone-300 sm:hidden" />
            
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-stone-800">Options</h3>
              <button 
                type="button" 
                className="p-1 text-stone-500 hover:text-stone-700 transition-colors"
                onClick={() => setProfileNavOpen(false)}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-1">
              {[
                { label: "Edit Profile", icon: User, onClick: () => { setEditOpen(true); setProfileNavOpen(false); } },
                { label: "Settings", icon: IconSettings, href: "/settings" },
                { label: "Privacy", icon: Lock, href: "/settings/privacy" },
                { label: "Travel Visibility", icon: Eye, href: "/settings/visibility" },
                { label: "Map Sharing", icon: IconMap, onClick: () => persistMapShare(!mapShare) },
                { label: "Buddy Visibility", icon: IconUserSquare, href: "/settings/buddies" },
                { label: "Saved Trips", icon: IconBookmark, href: "/settings/saved" },
                { label: "Archive", icon: Archive, href: "/settings/archive" },
                { label: "Help", icon: HelpCircle, href: "/settings/help" },
              ].map((item) => (
                item.href ? (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="flex items-center gap-3 w-full p-3 text-sm font-semibold text-stone-700 hover:bg-stone-50 rounded-xl transition-colors"
                  >
                    <item.icon size={18} className="text-stone-500" />
                    <span>{item.label}</span>
                  </Link>
                ) : (
                  <button
                    key={item.label}
                    type="button"
                    onClick={item.onClick}
                    className="flex items-center gap-3 w-full p-3 text-sm font-semibold text-stone-700 hover:bg-stone-50 rounded-xl transition-colors text-left"
                  >
                    <item.icon size={18} className="text-stone-500" />
                    <span>{item.label}</span>
                    {item.label === "Map Sharing" && (
                      <span className={`ml-auto text-xs font-bold ${mapShare ? "text-teal-600" : "text-stone-400"}`}>
                        {mapShare ? "ON" : "OFF"}
                      </span>
                    )}
                  </button>
                )
              ))}
              
              <div className="my-2 border-t border-stone-100" />
              
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="flex items-center gap-3 w-full p-3 text-sm font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors text-left"
              >
                <LogOut size={18} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
