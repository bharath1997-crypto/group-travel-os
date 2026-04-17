"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { apiFetch, apiFetchWithStatus } from "@/lib/api";
import { clearToken, getToken } from "@/lib/auth";

const NAVY = "#0F3460";
const CORAL = "#E94560";
const BORDER = "#E9ECEF";
const BG = "#F8F9FA";
const CARD = "#FFFFFF";

const LS_BIO = "travello_profile_bio";
const LS_HOME = "travello_home_city";
const LS_TRAVEL_STATUS = "travello_travel_status";
const LS_AVATAR_EMOJI = "travello_avatar_emoji";
const LS_STREAK_DAYS = "travello_streak_days";
const LS_LAST_OPENED = "travello_last_opened";
const LS_FREEZE_USED = "travello_freeze_used_date";
const LS_FREEZE_WEEK = "travello_streak_freeze_week";

type UserMe = {
  id: string;
  email: string;
  full_name: string;
  username: string | null;
  is_verified: boolean;
  profile_public: boolean;
  country?: string | null;
  home_city?: string | null;
  travel_status?: string | null;
};

type TravelStats = {
  trips_created: number;
  groups_joined: number;
  locations_saved: number;
  expenses_paid: number;
  polls_created?: number;
  countries_from_trips: string[];
};

type PlanOut = {
  plan: string;
  status: string;
  current_period_end: string | null;
};

type ToastState =
  | { kind: "success"; message: string }
  | { kind: "error"; message: string }
  | null;

const AVATAR_EMOJIS = [
  "🧑‍🦱",
  "👩‍🦰",
  "🧔",
  "🧑‍✈️",
  "🏄",
  "🎒",
  "🕵️",
  "🧗",
  "🤿",
  "👱‍♀️",
  "🧑‍🦳",
  "👩‍🦱",
];

const GRID_EMOJIS = ["🏖️", "🏔️", "🌴", "🌅", "✈️", "🗺️", "🎉", "🌊"];

function weekId(d: Date): string {
  const start = new Date(d.getFullYear(), 0, 1);
  const days = Math.floor((d.getTime() - start.getTime()) / 86400000);
  const w = Math.ceil((days + start.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(w).padStart(2, "0")}`;
}

function formatDisplayName(full: string | null | undefined): string {
  if (!full?.trim()) return "Traveler";
  return full
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function planBadgeStyle(plan: string | null): { label: string; className: string } {
  const p = plan ?? "free";
  if (p === "free")
    return { label: "Free", className: "bg-gray-200 text-gray-800" };
  if (p === "pass_3day" || p === "pass_7day")
    return { label: p === "pass_3day" ? "3-Day Pass" : "7-Day Pass", className: "text-white" };
  if (p === "pro" || p === "enterprise")
    return { label: "Pro", className: "bg-purple-100 text-purple-900" };
  return { label: p, className: "bg-gray-200 text-gray-800" };
}

const GLOBE_LEVELS = [
  { min: 0, label: "Beginner", emoji: "🌱" },
  { min: 10, label: "Wanderer", emoji: "🗺️" },
  { min: 25, label: "Explorer", emoji: "🌍" },
  { min: 50, label: "Voyager", emoji: "✈️" },
  { min: 100, label: "Globetrotter", emoji: "🚀" },
  { min: 200, label: "Legend", emoji: "👑" },
] as const;

type GlobeLevelRow = (typeof GLOBE_LEVELS)[number];

function globeLevel(score: number): { label: string; emoji: string } {
  let cur: GlobeLevelRow = GLOBE_LEVELS[0];
  for (const L of GLOBE_LEVELS) {
    if (score >= L.min) cur = L;
  }
  return { label: cur.label, emoji: cur.emoji };
}

function nextGlobeLevel(score: number): GlobeLevelRow | null {
  const next = GLOBE_LEVELS.find((L) => L.min > score);
  return next ?? null;
}

function globeTierProgress(score: number): number {
  const next = nextGlobeLevel(score);
  if (!next) return 100;
  const cur = [...GLOBE_LEVELS].reverse().find((L) => score >= L.min) ?? GLOBE_LEVELS[0];
  const span = next.min - cur.min;
  if (span <= 0) return 100;
  return Math.min(100, ((score - cur.min) / span) * 100);
}

function pointsToNextGlobeLevel(score: number): number {
  const next = nextGlobeLevel(score);
  if (!next) return 0;
  return Math.max(0, next.min - score);
}

function displayAtUsername(me: UserMe): string {
  const u = me.username?.trim();
  if (u) return `@${u}`;
  const fromName = me.full_name?.trim().toLowerCase().replace(/\s+/g, "") ?? "";
  if (fromName) return `@${fromName}`;
  return "@traveler";
}

export default function ProfilePage() {
  const router = useRouter();

  const [me, setMe] = useState<UserMe | null>(null);
  const [stats, setStats] = useState<TravelStats | null>(null);
  const [plan, setPlan] = useState<PlanOut | null>(null);
  const [bootLoading, setBootLoading] = useState(true);

  const [bioLocal, setBioLocal] = useState("");
  const [homeLocal, setHomeLocal] = useState("");
  const [travelStatusLocal, setTravelStatusLocal] = useState("");
  const [avatarEmoji, setAvatarEmoji] = useState<string | null>(null);

  const [streakDays, setStreakDays] = useState(0);

  const [freezeUsedDate, setFreezeUsedDate] = useState<string | null>(null);

  const [toast, setToast] = useState<ToastState>(null);
  const [toastIn, setToastIn] = useState(false);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);

  const [editName, setEditName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editHome, setEditHome] = useState("");
  const [editTravelStatus, setEditTravelStatus] = useState("");
  const [saveBusy, setSaveBusy] = useState(false);

  const [activeTab, setActiveTab] = useState(0);

  const showToast = useCallback((t: ToastState) => {
    if (!t) return;
    setToastIn(false);
    setToast(t);
    requestAnimationFrame(() => setToastIn(true));
    window.setTimeout(() => {
      setToastIn(false);
      window.setTimeout(() => setToast(null), 300);
    }, 3000);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setBioLocal(localStorage.getItem(LS_BIO) ?? "");
    setHomeLocal(localStorage.getItem(LS_HOME) ?? "");
    setTravelStatusLocal(localStorage.getItem(LS_TRAVEL_STATUS) ?? "");
    setAvatarEmoji(localStorage.getItem(LS_AVATAR_EMOJI));
    const today = new Date().toDateString();
    const last = localStorage.getItem(LS_LAST_OPENED);
    let s = parseInt(localStorage.getItem(LS_STREAK_DAYS) ?? "0", 10) || 0;
    if (last !== today) {
      if (!last) {
        s = 1;
      } else {
        const lastD = new Date(last);
        const y = new Date();
        y.setDate(y.getDate() - 1);
        if (lastD.toDateString() === y.toDateString()) s += 1;
        else s = 1;
      }
      localStorage.setItem(LS_STREAK_DAYS, String(s));
      localStorage.setItem(LS_LAST_OPENED, today);
    }
    setStreakDays(s);

    const wk = weekId(new Date());
    const storedWk = localStorage.getItem(LS_FREEZE_WEEK);
    if (storedWk !== wk) {
      localStorage.setItem(LS_FREEZE_WEEK, wk);
      localStorage.removeItem(LS_FREEZE_USED);
    }
    setFreezeUsedDate(localStorage.getItem(LS_FREEZE_USED));
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
        const [meRes, st, pl] = await Promise.all([
          apiFetchWithStatus<UserMe>("/auth/me"),
          apiFetch<TravelStats>("/users/me/travel-stats").catch(() => null),
          apiFetch<PlanOut>("/subscriptions/me").catch(() => null),
        ]);
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
        }
        setStats(
          st ?? {
            trips_created: 0,
            groups_joined: 0,
            locations_saved: 0,
            expenses_paid: 0,
            polls_created: 0,
            countries_from_trips: [],
          },
        );
        setPlan(pl);
      } catch {
        if (!c) showToast({ kind: "error", message: "Could not load profile." });
      } finally {
        if (!c) setBootLoading(false);
      }
    })();
    return () => {
      c = true;
    };
  }, [router, showToast]);

  const countriesCount = stats?.countries_from_trips?.length ?? 0;
  const globeScore = useMemo(() => {
    if (!stats) return 0;
    return (
      stats.trips_created * 10 +
      stats.groups_joined * 3 +
      countriesCount * 15 +
      stats.locations_saved * 1 +
      streakDays * 2
    );
  }, [stats, countriesCount, streakDays]);

  const levelInfo = useMemo(() => globeLevel(globeScore), [globeScore]);
  const nextLevelInfo = useMemo(() => nextGlobeLevel(globeScore), [globeScore]);
  const levelProgress = useMemo(
    () => globeTierProgress(globeScore),
    [globeScore],
  );
  const pointsToNext = useMemo(
    () => pointsToNextGlobeLevel(globeScore),
    [globeScore],
  );

  const isPro = plan?.plan === "pro" || plan?.plan === "enterprise";

  async function saveProfile() {
    if (!me) return;
    setSaveBusy(true);
    try {
      const u = await apiFetch<UserMe>("/auth/me", {
        method: "PATCH",
        body: JSON.stringify({
          full_name: editName.trim(),
          username: editUsername.trim() || null,
        }),
      });
      setMe(u);
      localStorage.setItem(LS_BIO, editBio.slice(0, 150));
      localStorage.setItem(LS_HOME, editHome.trim());
      localStorage.setItem(LS_TRAVEL_STATUS, editTravelStatus.trim());
      setBioLocal(editBio.slice(0, 150));
      setHomeLocal(editHome.trim());
      setTravelStatusLocal(editTravelStatus.trim());
      setEditOpen(false);
      showToast({ kind: "success", message: "Profile updated ✓" });
    } catch (e) {
      showToast({
        kind: "error",
        message: e instanceof Error ? e.message : "Update failed",
      });
    } finally {
      setSaveBusy(false);
    }
  }

  function copyProfileUrl() {
    const u = me?.username?.trim();
    if (!u) {
      showToast({ kind: "error", message: "Set a username first" });
      return;
    }
    const url = `${window.location.origin}/u/${encodeURIComponent(u)}`;
    void navigator.clipboard.writeText(url).then(
      () => showToast({ kind: "success", message: "Link copied" }),
      () => showToast({ kind: "error", message: "Could not copy" }),
    );
  }

  function selectAvatarEmoji(e: string) {
    localStorage.setItem(LS_AVATAR_EMOJI, e);
    setAvatarEmoji(e);
  }

  function resetAvatarDicebear() {
    localStorage.removeItem(LS_AVATAR_EMOJI);
    setAvatarEmoji(null);
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const freezeUsedToday = freezeUsedDate === todayIso;

  function activateFreeze() {
    if (freezeUsedToday) return;
    localStorage.setItem(LS_FREEZE_USED, todayIso);
    setFreezeUsedDate(todayIso);
    showToast({ kind: "success", message: "Streak freeze activated" });
  }

  const weekDays = useMemo(() => {
    const now = new Date();
    const day = now.getDay();
    const mon = new Date(now);
    mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(mon);
      d.setDate(mon.getDate() + i);
      const isToday = d.toDateString() === now.toDateString();
      const isPast = d < new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const isFuture = d > new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return { d, label: labels[i], isToday, isPast, isFuture };
    });
  }, []);

  const badges = useMemo(() => {
    const tc = stats?.trips_created ?? 0;
    const gj = stats?.groups_joined ?? 0;
    const cc = countriesCount;
    return [
      { icon: "🏖️", name: "Beach Lover", earned: cc >= 1 },
      { icon: "👑", name: "Group Leader", earned: gj >= 2 },
      { icon: "🌍", name: "World Traveler", earned: cc >= 5 },
      { icon: "✈️", name: "Frequent Flyer", earned: tc >= 5 },
      { icon: "🏔️", name: "Trekker", earned: false },
      { icon: "💰", name: "Fair Splitter", earned: false },
      { icon: "🎒", name: "Backpacker", earned: false },
      { icon: "⭐", name: "Early Adopter", earned: true },
    ];
  }, [stats, countriesCount]);

  const firstEarnedBadge = badges.find((b) => b.earned);

  if (bootLoading && !me) {
    return (
      <div className="min-h-screen w-full bg-[#F8F9FA] px-4 py-6">
        <div className="mx-auto w-full max-w-[680px] space-y-4 md:mx-auto lg:max-w-none lg:flex lg:gap-6 lg:space-y-0">
          <div className="min-w-0 flex-1 space-y-4">
            <div className="h-10 animate-pulse rounded-lg bg-gray-200" />
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
              <div className="h-[86px] w-[86px] shrink-0 animate-pulse rounded-full bg-gray-200" />
              <div className="grid w-full max-w-xs grid-cols-4 gap-2 sm:max-w-none sm:flex-1">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-14 animate-pulse rounded bg-gray-200" />
                ))}
              </div>
            </div>
            <div className="h-40 animate-pulse rounded-xl bg-gray-200" />
          </div>
          <div className="hidden min-w-0 flex-1 space-y-2 lg:block">
            <div className="grid grid-cols-3 gap-1">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
                <div key={i} className="aspect-square animate-pulse rounded-sm bg-gray-200" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!me) {
    return (
      <div className="p-6 text-sm text-red-600">
        Could not load your profile.
      </div>
    );
  }

  const pb = planBadgeStyle(plan?.plan ?? null);
  const homeLine =
    me.home_city?.trim() ||
    homeLocal.trim() ||
    me.country?.trim() ||
    "Add your city";
  const bioText = bioLocal.trim();

  const atHandle = displayAtUsername(me);
  const postsCount = stats?.polls_created ?? 0;
  const memoriesCount = stats?.locations_saved ?? 0;

  return (
    <div className="min-h-screen w-full pb-24" style={{ backgroundColor: BG }}>
      {/* Top bar — mobile / tablet only */}
      <header
        className="sticky top-0 z-30 flex items-center justify-between border-b bg-white px-4 py-3 lg:hidden"
        style={{ borderColor: BORDER }}
      >
        <button
          type="button"
          className="flex items-center gap-1 text-[15px] font-bold"
          style={{ color: NAVY }}
          onClick={() => {}}
        >
          {atHandle}
          <span className="text-xs text-[#6C757D]" aria-hidden>
            ▾
          </span>
        </button>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/trips")}
            className="text-xl font-light text-[#2C3E50]"
            aria-label="New trip"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="text-xl text-[#2C3E50]"
            aria-label="Menu"
          >
            ☰
          </button>
        </div>
      </header>

      <div className="w-full px-4 pb-8 md:mx-auto md:max-w-[680px] lg:mx-0 lg:flex lg:max-w-none lg:items-start lg:gap-6 lg:px-4 xl:px-6">
        {/* LEFT — profile, highlights, streak, badges, freeze (desktop) */}
        <div className="w-full min-w-0 lg:w-[400px] lg:shrink-0">
          <div
            className="overflow-hidden bg-white lg:rounded-xl lg:border"
            style={{ borderColor: BORDER }}
          >
            <div
              className="hidden items-center justify-between border-b px-4 py-3 lg:flex"
              style={{ borderColor: BORDER }}
            >
              <span className="text-[15px] font-bold" style={{ color: NAVY }}>
                {atHandle}
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => router.push("/trips")}
                  className="text-xl font-light text-[#2C3E50]"
                  aria-label="New trip"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  className="text-xl text-[#2C3E50]"
                  aria-label="Menu"
                >
                  ☰
                </button>
              </div>
            </div>
            {/* Profile header */}
            <section className="px-4 py-4 lg:bg-white" style={{ color: NAVY }}>
          <div className="flex flex-col items-center gap-4 md:flex-row md:items-start md:gap-4">
            <div className="relative shrink-0">
              <div
                className="flex h-[86px] w-[86px] items-center justify-center overflow-hidden rounded-full bg-[#F8F9FA] text-5xl"
                style={{
                  borderWidth: 3,
                  borderStyle: "solid",
                  borderColor: CORAL,
                }}
              >
                {avatarEmoji ? (
                  <span className="leading-none">{avatarEmoji}</span>
                ) : (
                  <img
                    src={`https://api.dicebear.com/7.x/lorelei/svg?seed=${encodeURIComponent(me.id)}`}
                    alt=""
                    width={86}
                    height={86}
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <button
                type="button"
                onClick={() => setAvatarPickerOpen((v) => !v)}
                className="absolute -bottom-0.5 -right-0.5 flex h-[22px] w-[22px] items-center justify-center rounded-full text-[11px] text-white shadow"
                style={{ backgroundColor: CORAL }}
                aria-label="Edit avatar"
              >
                ✏️
              </button>
            </div>
            <div className="grid w-full max-w-xs grid-cols-4 gap-2 text-center md:max-w-none md:flex-1">
              {[
                { n: stats?.trips_created ?? 0, l: "Trips" },
                { n: postsCount, l: "Posts" },
                { n: memoriesCount, l: "Memories" },
                { n: countriesCount, l: "Countries" },
              ].map((s) => (
                <div key={s.l}>
                  <p className="text-lg font-bold leading-tight" style={{ color: NAVY }}>
                    {s.n}
                  </p>
                  <p className="text-[10px] text-[#6C757D]">{s.l}</p>
                </div>
              ))}
            </div>
          </div>

          {avatarPickerOpen ? (
            <div className="mt-4 rounded-xl border p-4" style={{ borderColor: BORDER }}>
              <p className="text-sm font-semibold" style={{ color: NAVY }}>
                Choose travel avatar
              </p>
              <div className="mt-3 grid grid-cols-6 gap-2">
                {AVATAR_EMOJIS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => selectAvatarEmoji(e)}
                    className={`flex aspect-square items-center justify-center rounded-lg border-2 text-2xl ${
                      avatarEmoji === e ? "bg-[#fff0f3]" : "bg-white"
                    }`}
                    style={{
                      borderColor: avatarEmoji === e ? CORAL : BORDER,
                    }}
                  >
                    {e}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={resetAvatarDicebear}
                className="mt-3 text-sm font-medium text-[#6C757D] underline"
              >
                Or use auto avatar
              </button>
              <button
                type="button"
                onClick={() => setAvatarPickerOpen(false)}
                className="mt-4 w-full rounded-xl py-2.5 text-sm font-semibold text-white"
                style={{ backgroundColor: CORAL }}
              >
                Done
              </button>
            </div>
          ) : null}

          <div className="mt-4">
            <p className="text-[14px] font-bold" style={{ color: NAVY }}>
              {formatDisplayName(me.full_name)}
            </p>
            <p className="mt-1 text-[13px]">
              <span className="text-[#6C757D]">📍</span>{" "}
              <span style={{ color: NAVY }}>{homeLine}</span>
            </p>
            {me.travel_status?.trim() || travelStatusLocal ? (
              <p className="mt-0.5 text-[13px]">
                <span className="text-[#6C757D]">✈️</span>{" "}
                <span style={{ color: NAVY }}>
                  {me.travel_status?.trim() || travelStatusLocal}
                </span>
              </p>
            ) : null}
            {bioText ? (
              <p className="mt-2 text-[13px] leading-snug" style={{ color: NAVY }}>
                {bioText}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${pb.className}`}
                style={
                  pb.label.includes("Pass")
                    ? { backgroundColor: CORAL, color: "#fff" }
                    : pb.label === "Pro"
                      ? {}
                      : {}
                }
              >
                {pb.label}
              </span>
              {me.is_verified ? (
                <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">
                  Verified ✓
                </span>
              ) : null}
              {me.profile_public ? (
                <span
                  className="rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
                  style={{ backgroundColor: NAVY }}
                >
                  Public
                </span>
              ) : null}
              {firstEarnedBadge ? (
                <span
                  className="rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
                  style={{ backgroundColor: CORAL }}
                >
                  {firstEarnedBadge.icon} {firstEarnedBadge.name}
                </span>
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setEditOpen((v) => !v);
                setEditName(me.full_name);
                setEditUsername(me.username ?? "");
                setEditBio(bioLocal);
                setEditHome(me.home_city?.trim() || homeLocal);
                setEditTravelStatus(me.travel_status?.trim() || travelStatusLocal);
              }}
              className="rounded-lg border px-4 py-1.5 text-sm font-semibold"
              style={{ borderColor: BORDER, color: NAVY }}
            >
              Edit profile
            </button>
            <button
              type="button"
              onClick={copyProfileUrl}
              className="rounded-lg border px-4 py-1.5 text-sm font-semibold"
              style={{ borderColor: BORDER, color: NAVY }}
            >
              Share profile
            </button>
            <button
              type="button"
              onClick={() => router.push("/travel-hub")}
              className="rounded-lg border px-3 py-1.5 text-sm font-semibold"
              style={{ borderColor: BORDER, color: NAVY }}
              aria-label="Invite"
            >
              👤+
            </button>
          </div>

          {editOpen ? (
            <div className="mt-4 space-y-3 rounded-xl border p-4" style={{ borderColor: BORDER }}>
              <label className="block">
                <span className="text-xs font-semibold text-[#6C757D]">Full name</span>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#E9ECEF] px-3 py-2 text-sm outline-none focus:border-[#E94560]"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-[#6C757D]">Username</span>
                <div className="mt-1 flex rounded-lg border border-[#E9ECEF]">
                  <span className="flex items-center border-r border-[#E9ECEF] bg-[#F8F9FA] px-3 text-sm text-[#6C757D]">
                    @
                  </span>
                  <input
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    className="min-w-0 flex-1 px-3 py-2 text-sm outline-none"
                  />
                </div>
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-[#6C757D]">Bio</span>
                <textarea
                  value={editBio}
                  maxLength={150}
                  onChange={(e) => setEditBio(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-[#E9ECEF] px-3 py-2 text-sm outline-none focus:border-[#E94560]"
                />
                <span className="text-[10px] text-[#6C757D]">
                  {editBio.length}/150
                </span>
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-[#6C757D]">
                  Home city
                </span>
                <input
                  value={editHome}
                  onChange={(e) => setEditHome(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#E9ECEF] px-3 py-2 text-sm outline-none focus:border-[#E94560]"
                  placeholder="City you call home"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-[#6C757D]">
                  Travel status
                </span>
                <input
                  value={editTravelStatus}
                  onChange={(e) => setEditTravelStatus(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#E9ECEF] px-3 py-2 text-sm outline-none focus:border-[#E94560]"
                  placeholder="e.g. Planning Japan 2026"
                />
              </label>
              <div className="flex items-center gap-1 text-sm text-[#6C757D]">
                <span aria-hidden>🔒</span>
                {me.email}
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  disabled={saveBusy}
                  onClick={saveProfile}
                  className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  style={{ backgroundColor: CORAL }}
                >
                  {saveBusy ? (
                    <>
                      <span
                        className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
                        aria-hidden
                      />
                      Saving…
                    </>
                  ) : (
                    "Save changes"
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setEditOpen(false)}
                  className="text-sm font-medium text-[#6C757D]"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
            </section>
          </div>

        {/* Story highlights */}
        <section className="mt-4 overflow-x-auto rounded-xl border bg-white py-3 pb-2 lg:border" style={{ borderColor: BORDER }}>
          <div className="flex min-w-min gap-4 px-4 pr-6">
            {(
              [
                { emoji: "➕", label: "New", href: "#", dashed: true },
                { emoji: "🏖️", label: "Goa", href: "/trips", coral: true },
                { emoji: "🏔️", label: "Manali", href: "/trips", navy: true },
                { emoji: "🌍", label: "World", href: "/map" },
                { emoji: "✈️", label: "Travel", href: "/feed" },
                { emoji: "💰", label: "Expenses", href: "/trips" },
              ] as const
            ).map((h, i) => (
              <Link
                key={i}
                href={h.href}
                className="flex w-[72px] shrink-0 flex-col items-center gap-1.5"
              >
                <span
                  className={`flex h-[58px] w-[58px] items-center justify-center rounded-full border-2 text-2xl ${
                    "dashed" in h && h.dashed
                      ? "border-dashed border-[#ADB5BD] bg-white"
                      : "coral" in h && h.coral
                        ? "border-[#E94560] bg-white"
                        : "navy" in h && h.navy
                          ? "border-[#0F3460] bg-white"
                          : "border-[#DEE2E6] bg-white"
                  }`}
                >
                  {h.emoji}
                </span>
                <span className="max-w-[72px] truncate text-center text-[11px] text-[#6C757D]">
                  {h.label}
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* Travel streak */}
        <section className="mt-4 overflow-hidden rounded-xl border bg-white shadow-sm" style={{ borderColor: BORDER }}>
          <div
            className="px-4 py-6 text-center"
            style={{
              background: `linear-gradient(135deg, ${NAVY} 0%, #1a4d7a 100%)`,
            }}
          >
            <span
              className="inline-block animate-spin text-[48px] leading-none"
              style={{
                animationDuration: "8s",
                animationTimingFunction: "linear",
              }}
              aria-hidden
            >
              🌍
            </span>
            <p className="mt-1 text-[40px] font-extrabold leading-tight text-white">
              {globeScore}
            </p>
            <p className="mt-0.5 text-xs text-white/90">Globe Points</p>
            <span
              className="mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold text-white"
              style={{ backgroundColor: CORAL }}
            >
              {levelInfo.emoji} {levelInfo.label}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 border-t p-3 text-center text-xs" style={{ borderColor: BORDER }}>
            <div className="relative rounded-lg border p-2" style={{ borderColor: BORDER }}>
              {(stats?.trips_created ?? 0) > 0 ? (
                <span
                  className="absolute right-1 top-1 rounded-full px-1.5 py-0.5 text-[8px] font-bold text-white"
                  style={{ backgroundColor: CORAL }}
                >
                  Active
                </span>
              ) : null}
              <p className="text-lg font-bold" style={{ color: NAVY }}>
                {stats?.trips_created ?? 0}
              </p>
              <p className="font-semibold text-[#2C3E50]">Trip Streak</p>
              <p className="text-[10px] text-[#6C757D]">trips completed</p>
            </div>
            <div className="rounded-lg border p-2" style={{ borderColor: BORDER }}>
              <p className="text-lg font-bold" style={{ color: NAVY }}>
                {streakDays}
                {streakDays > 7 ? " 🔥" : ""}
              </p>
              <p className="font-semibold text-[#2C3E50]">Activity Streak</p>
              <p className="text-[10px] text-[#6C757D]">days in a row</p>
            </div>
            <div className="rounded-lg border p-2" style={{ borderColor: BORDER }}>
              <p className="text-lg font-bold" style={{ color: NAVY }}>
                {(stats?.groups_joined ?? 0) + (stats?.trips_created ?? 0)}
              </p>
              <p className="font-semibold text-[#2C3E50]">Planning Streak</p>
              <p className="text-[10px] text-[#6C757D]">weeks planning</p>
            </div>
          </div>
          <div className="border-t px-3 py-4" style={{ borderColor: BORDER }}>
            <div className="flex justify-between gap-1">
              {weekDays.map((wd, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-1">
                  {wd.isToday ? (
                    <div
                      className="flex h-7 w-7 items-center justify-center rounded-full text-sm leading-none text-white"
                      style={{ backgroundColor: NAVY }}
                      title="Today"
                    >
                      🌍
                    </div>
                  ) : wd.isPast ? (
                    <div
                      className="flex h-7 w-7 items-center justify-center rounded-full text-sm leading-none text-white"
                      style={{ backgroundColor: CORAL }}
                      title="Completed"
                    >
                      🌍
                    </div>
                  ) : (
                    <div
                      className="h-7 w-7 rounded-full border-2 border-dashed border-[#CED4DA] bg-white"
                      title="Upcoming"
                    />
                  )}
                  <span className="text-[10px] text-[#6C757D]">{wd.label}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-center text-xs text-[#6C757D]">
              {streakDays > 6
                ? "🔥 Amazing! Keep it up!"
                : streakDays > 3
                  ? `🌍 Keep going! ${Math.max(0, 7 - streakDays)} more days`
                  : "Start your streak today!"}
            </p>
            <div className="mt-4">
              <div className="flex justify-between text-[11px] text-[#6C757D]">
                <span>
                  {levelInfo.emoji} {levelInfo.label}
                </span>
                <span>
                  Next:{" "}
                  {nextLevelInfo
                    ? `${nextLevelInfo.emoji} ${nextLevelInfo.label}`
                    : "Max level"}
                </span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${levelProgress}%`, backgroundColor: CORAL }}
                />
              </div>
              <p className="mt-1 text-center text-[10px] text-[#6C757D]">
                {pointsToNext} points to next level
              </p>
            </div>
          </div>
        </section>

        {/* Badges */}
        <section className="mt-4 rounded-xl border bg-white p-4 shadow-sm" style={{ borderColor: BORDER }}>
          <h2 className="text-sm font-bold" style={{ color: NAVY }}>
            🏆 Travel badges
          </h2>
          <div className="mt-3 grid grid-cols-4 gap-3">
            {badges.map((b) => (
              <div
                key={b.name}
                className={`text-center ${!b.earned ? "opacity-40" : ""}`}
              >
                <div className="text-2xl">{b.icon}</div>
                <p className="mt-1 text-[9px] font-medium leading-tight text-[#2C3E50]">
                  {b.name}
                </p>
              </div>
            ))}
          </div>
          <Link
            href="/stats"
            className="mt-4 inline-block text-sm font-semibold"
            style={{ color: CORAL }}
          >
            View all badges →
          </Link>
        </section>

        {/* Streak freeze */}
        <section className="mt-4 rounded-xl border bg-white p-4 shadow-sm" style={{ borderColor: BORDER }}>
          <p className="text-sm font-semibold" style={{ color: NAVY }}>
            🧊 Streak Freeze
          </p>
          <p className="mt-1 text-xs text-[#6C757D]">
            Miss a day without losing your streak
          </p>
          <p className="mt-2 text-xs text-[#6C757D]">1 freeze remaining</p>
          {freezeUsedToday ? (
            <p className="mt-2 text-sm font-medium text-green-700">
              Freeze used today ✓
            </p>
          ) : (
            <button
              type="button"
              onClick={activateFreeze}
              className="mt-3 rounded-lg px-4 py-2 text-sm font-semibold text-white"
              style={{ backgroundColor: NAVY }}
            >
              Activate freeze
            </button>
          )}
        </section>
        </div>

        {/* RIGHT — post tabs + grid (desktop) */}
        <div className="mt-4 min-w-0 flex-1 lg:mt-0">
          <section
            className="border-t bg-white lg:rounded-xl lg:border lg:border-t lg:shadow-sm"
            style={{ borderColor: BORDER }}
          >
            <div className="flex justify-around border-b" style={{ borderColor: BORDER }}>
              {(
                [
                  { id: 0 as const, icon: "▦", label: "Grid" },
                  { id: 1 as const, icon: "▶", label: "Reels" },
                  { id: 2 as const, icon: "🔖", label: "Saved" },
                  { id: 3 as const, icon: "🧳", label: "Trips" },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-label={t.label}
                  aria-pressed={activeTab === t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`flex-1 py-3 text-center text-lg ${
                    activeTab === t.id ? "border-b-2 font-semibold" : "text-[#6C757D]"
                  }`}
                  style={
                    activeTab === t.id
                      ? { color: NAVY, borderBottomColor: NAVY }
                      : {}
                  }
                >
                  {t.icon}
                </button>
              ))}
            </div>
            <div className="p-0.5">
              {activeTab === 0 ? (
                <div className="grid grid-cols-3 gap-0.5">
                  {GRID_EMOJIS.map((e, i) => (
                    <div
                      key={i}
                      className="flex aspect-square items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-2xl"
                    >
                      {e}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => router.push("/feed")}
                    className="flex aspect-square items-center justify-center border-2 border-dashed border-[#CED4DA] text-2xl text-[#6C757D]"
                  >
                    +
                  </button>
                </div>
              ) : (
                <div className="flex min-h-[120px] items-center justify-center py-8 text-sm text-[#6C757D]">
                  Coming soon
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      <footer className="mt-8 w-full px-4 pb-8 text-center text-[11px] text-[#6C757D]">
        Travello v1.0.0 · Made for travelers ✈️
      </footer>

      {/* Toast */}
      {toast ? (
        <div className="pointer-events-none sticky bottom-5 z-50 mx-auto mt-auto flex w-full max-w-md justify-center self-end px-2">
          <div
            className={`pointer-events-auto w-full rounded-xl border px-4 py-3 text-center text-sm font-medium shadow-lg transition-all duration-300 ${
              toast.kind === "success"
                ? "border-green-200 bg-green-50 text-green-900"
                : "border-red-200 bg-red-50 text-red-900"
            }`}
            style={{ opacity: toastIn ? 1 : 0, transform: toastIn ? "translateY(0)" : "translateY(8px)" }}
          >
            {toast.message}
          </div>
        </div>
      ) : null}

      {/* Settings drawer */}
      {settingsOpen ? (
        <div className="fixed inset-0 z-[100] flex flex-col justify-end">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Close menu"
            onClick={() => setSettingsOpen(false)}
          />
          <div className="relative max-h-[85vh] overflow-y-auto rounded-t-2xl bg-white px-4 pb-8 pt-2 shadow-xl">
            <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-[#DEE2E6]" />
            <nav className="space-y-1 pb-4 text-sm">
              {(
                [
                  {
                    icon: "🎨",
                    label: "Avatar style",
                    desc: "Customize your look",
                    onClick: () => {
                      setSettingsOpen(false);
                      setAvatarPickerOpen(true);
                    },
                  },
                  { icon: "🗺️", label: "Travel identity", href: "/settings#travel" },
                  { icon: "🔒", label: "Privacy", href: "/settings#privacy" },
                  { icon: "🔔", label: "Notifications", href: "/settings#notifications" },
                  { icon: "🔐", label: "Account and security", href: "/settings#account" },
                  { icon: "🔗", label: "Connected accounts", href: "/settings#connected" },
                ] as const
              ).map((item) =>
                "href" in item ? (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={() => setSettingsOpen(false)}
                    className="flex gap-3 rounded-lg py-2.5"
                  >
                    <span>{item.icon}</span>
                    <div>
                      <p className="font-semibold text-[#2C3E50]">{item.label}</p>
                    </div>
                  </Link>
                ) : (
                  <button
                    key={item.label}
                    type="button"
                    onClick={item.onClick}
                    className="flex w-full gap-3 rounded-lg py-2.5 text-left"
                  >
                    <span>{item.icon}</span>
                    <div>
                      <p className="font-semibold text-[#2C3E50]">{item.label}</p>
                      <p className="text-xs text-[#6C757D]">{item.desc}</p>
                    </div>
                  </button>
                ),
              )}
              <div className="my-2 h-px bg-[#E9ECEF]" />
              <Link
                href="/settings#backup"
                onClick={() => setSettingsOpen(false)}
                className="flex items-center justify-between gap-2 rounded-lg py-2.5"
              >
                <span>
                  <span className="mr-2">☁️</span>
                  Backup and export
                </span>
                {!isPro ? (
                  <span className="rounded bg-amber-100 px-1.5 text-[10px] font-bold text-amber-900">
                    Pro
                  </span>
                ) : null}
              </Link>
              <Link
                href="/settings#preferences"
                onClick={() => setSettingsOpen(false)}
                className="block rounded-lg py-2.5"
              >
                ⚙️ App preferences
              </Link>
              <Link
                href="/subscription"
                onClick={() => setSettingsOpen(false)}
                className="block rounded-lg py-2.5"
              >
                ⭐ Subscription
              </Link>
              <div className="my-2 h-px bg-[#E9ECEF]" />
              <button type="button" className="w-full rounded-lg py-2.5 text-left text-[#6C757D]">
                💬 Help and support
              </button>
              <button type="button" className="w-full rounded-lg py-2.5 text-left text-[#6C757D]">
                ⭐ Rate the app
              </button>
              <div className="my-2 h-px bg-[#E9ECEF]" />
              <button
                type="button"
                onClick={() => {
                  clearToken();
                  router.push("/login");
                }}
                className="w-full rounded-lg py-3 text-left font-semibold"
                style={{ color: CORAL }}
              >
                🚪 Sign out
              </button>
            </nav>
          </div>
        </div>
      ) : null}
    </div>
  );
}
