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
const PINK_RING = "#EC4899";
const CRIMSON = "#DC2626";
const PROFILE_BG_BAR = "#F3F4F6";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const DICEBEAR_LORELEI = "https://api.dicebear.com/7.x/lorelei/svg";
const LS_LAST_OPENED = "travello_last_opened";
const LS_FREEZE_USED = "travello_freeze_used_date";
const LS_FREEZE_WEEK = "travello_streak_freeze_week";

type UserMe = {
  id: string;
  email: string;
  full_name: string;
  username: string | null;
  is_verified: boolean;
  email_verified?: boolean;
  profile_public: boolean;
  avatar_url?: string | null;
  profile_picture?: string | null;
  phone?: string | null;
  google_sub?: string | null;
  whatsapp_verified?: boolean;
  instagram_handle?: string | null;
  country?: string | null;
  home_city?: string | null;
  travel_status?: string | null;
  profile_completion_filled?: number;
  profile_completion_total?: number;
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

type ProfileBadge = {
  id: string;
  icon: string;
  name: string;
  earned: boolean;
  tier: "bronze" | "silver" | "gold";
  unlockLevel: number;
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

function initialsFromName(full: string | null | undefined): string {
  const parts = (full ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return (
    (parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase()
  );
}

function isHttpOrDataAvatar(s: string): boolean {
  const t = s.trim();
  return t.startsWith("data:") || t.startsWith("http://") || t.startsWith("https://");
}

function isLikelyGoogleHostedImageUrl(url: string): boolean {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return h.endsWith("googleusercontent.com") || h.endsWith("ggpht.com");
  } catch {
    return false;
  }
}

/** OAuth / linked image from GET /auth/me: profile_picture, or Google-hosted avatar_url. */
function linkedAccountPhotoFromProfile(payload: {
  profile_picture?: string | null;
  avatar_url?: string | null;
}): string | null {
  const pp = payload.profile_picture?.trim();
  if (pp && isHttpOrDataAvatar(pp)) return pp;
  const au = payload.avatar_url?.trim();
  if (au && isHttpOrDataAvatar(au) && isLikelyGoogleHostedImageUrl(au)) return au;
  return null;
}

type AvatarDisplaySource = {
  avatarUrl: string | null | undefined;
  /** Google (or other) provider URL when different from avatar_url */
  profilePictureUrl?: string | null;
  localEmojiFallback: string | null;
  idSeed: string;
  fullName: string;
};

function httpAvatarCandidates(
  avatarUrl: string | null | undefined,
  profilePictureUrl: string | null | undefined,
): string[] {
  const a = avatarUrl?.trim();
  const p = profilePictureUrl?.trim();
  const out: string[] = [];
  if (a && isHttpOrDataAvatar(a)) out.push(a);
  if (p && isHttpOrDataAvatar(p) && p !== a) out.push(p);
  return out;
}

function ProfileAvatarView({
  src,
  size,
}: {
  src: AvatarDisplaySource;
  size: number;
}) {
  const au = src.avatarUrl?.trim();
  const candidates = httpAvatarCandidates(src.avatarUrl, src.profilePictureUrl);
  const [httpAttempt, setHttpAttempt] = useState(0);

  useEffect(() => {
    setHttpAttempt(0);
  }, [src.avatarUrl, src.profilePictureUrl]);

  if (httpAttempt < candidates.length) {
    const href = candidates[httpAttempt]!;
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        key={`${href}-${httpAttempt}`}
        src={href}
        alt=""
        width={size}
        height={size}
        className="h-full w-full object-cover"
        onError={() => setHttpAttempt((i) => i + 1)}
      />
    );
  }

  if (au) {
    if (!isHttpOrDataAvatar(au)) {
      return <span className="select-none text-[length:2.1rem] leading-none">{au}</span>;
    }
  }
  if (src.localEmojiFallback) {
    return (
      <span className="select-none leading-none" style={{ fontSize: size * 0.55 }}>
        {src.localEmojiFallback}
      </span>
    );
  }
  return (
    <span
      className="flex h-full w-full select-none items-center justify-center text-sm font-bold text-white"
      style={{ backgroundColor: CORAL, fontSize: size * 0.3 }}
    >
      {initialsFromName(src.fullName)}
    </span>
  );
}

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

function isUsernamePatternValid(u: string): boolean {
  return u.length === 0 || USERNAME_RE.test(u);
}

function profileFieldScore(args: {
  avatarSet: boolean;
  fullName: string;
  username: string;
  bio: string;
  home: string;
  travelStatus: string;
}): { filled: number; total: number; pct: number } {
  const total = 6;
  let filled = 0;
  if (args.avatarSet) filled += 1;
  if (args.fullName.trim().length >= 2) filled += 1;
  if (args.username.trim() && USERNAME_RE.test(args.username.trim())) filled += 1;
  if (args.bio.trim().length > 0) filled += 1;
  if (args.home.trim().length > 0) filled += 1;
  if (args.travelStatus.trim().length > 0) filled += 1;
  return { filled, total, pct: Math.round((filled / total) * 100) };
}

export default function ProfilePage() {
  const router = useRouter();

  const [me, setMe] = useState<UserMe | null>(null);
  const meRef = useRef<UserMe | null>(null);
  meRef.current = me;
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
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [photoAccordion, setPhotoAccordion] = useState<
    "upload" | "emoji" | "auto" | "google" | null
  >(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploadSaveBusy, setUploadSaveBusy] = useState(false);
  const [emojiSaveBusy, setEmojiSaveBusy] = useState(false);
  const [autoSaveBusy, setAutoSaveBusy] = useState(false);
  const [googleLinkedUrl, setGoogleLinkedUrl] = useState<string | null>(null);
  const [googleLinkedLoading, setGoogleLinkedLoading] = useState(false);
  const [googleSaveBusy, setGoogleSaveBusy] = useState(false);
  const [modalEmojiPick, setModalEmojiPick] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [shareSheetOpen, setShareSheetOpen] = useState(false);
  const [addFriendOpen, setAddFriendOpen] = useState(false);
  const [addFriendTab, setAddFriendTab] = useState<"hub" | "contacts">("hub");
  const [contactSearch, setContactSearch] = useState("");
  const [badgeStripExpanded, setBadgeStripExpanded] = useState(false);
  const [badgeTip, setBadgeTip] = useState<string | null>(null);
  const [freezePopoverOpen, setFreezePopoverOpen] = useState(false);
  const [dmComposeOpen, setDmComposeOpen] = useState(false);
  const [dmComposeBody, setDmComposeBody] = useState("");
  const freezePopoverRef = useRef<HTMLDivElement>(null);

  const [editName, setEditName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editHome, setEditHome] = useState("");
  const [editTravelStatus, setEditTravelStatus] = useState("");
  const [saveBusy, setSaveBusy] = useState(false);

  const [highlightTab, setHighlightTab] = useState<
    "posts" | "reels" | "trips" | "saved"
  >("posts");

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

  const autoDicebearUrl = useMemo(() => {
    const seed =
      editUsername.trim() ||
      editName.trim() ||
      me?.username?.trim() ||
      me?.full_name?.trim() ||
      me?.id ||
      "traveler";
    return `${DICEBEAR_LORELEI}?seed=${encodeURIComponent(seed)}`;
  }, [editUsername, editName, me?.username, me?.full_name, me?.id]);

  const editCompletion = useMemo(
    () =>
      profileFieldScore({
        avatarSet:
          Boolean(me?.avatar_url?.trim()) ||
          Boolean(avatarEmoji && !me?.avatar_url?.trim()),
        fullName: editName,
        username: editUsername,
        bio: editBio,
        home: editHome,
        travelStatus: editTravelStatus,
      }),
    [
      me?.avatar_url,
      avatarEmoji,
      editName,
      editUsername,
      editBio,
      editHome,
      editTravelStatus,
    ],
  );

  const patchMeAvatar = useCallback(
    async (avatar_url: string) => {
      const u = await apiFetch<UserMe>("/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ avatar_url }),
      });
      setMe(u);
      if (u.avatar_url && !isHttpOrDataAvatar(u.avatar_url)) {
        localStorage.setItem(LS_AVATAR_EMOJI, u.avatar_url);
        setAvatarEmoji(u.avatar_url);
      } else {
        localStorage.removeItem(LS_AVATAR_EMOJI);
        setAvatarEmoji(null);
      }
      return u;
    },
    [],
  );

  const openPhotoModal = useCallback(() => {
    setUploadPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    const a = me?.avatar_url?.trim();
    if (a) {
      if (!isHttpOrDataAvatar(a)) {
        setModalEmojiPick(a);
      } else {
        setModalEmojiPick(AVATAR_EMOJIS[0] ?? "🧑‍🦱");
      }
    } else {
      setModalEmojiPick(avatarEmoji ?? AVATAR_EMOJIS[0] ?? "🧑‍🦱");
    }
    setPhotoModalOpen(true);
  }, [me?.avatar_url, avatarEmoji]);

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(new Error("Could not read file"));
      r.readAsDataURL(file);
    });

  const onProfilePhotoFile = useCallback(
    async (fileList: FileList | null) => {
      const file = fileList?.[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        showToast({ kind: "error", message: "File too large or unsupported format" });
        return;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        showToast({ kind: "error", message: "File too large or unsupported format" });
        return;
      }
      try {
        const dataUrl = await readFileAsDataUrl(file);
        setUploadPreview(dataUrl);
      } catch {
        showToast({ kind: "error", message: "File too large or unsupported format" });
      }
    },
    [showToast],
  );

  const onUploadPreviewSave = useCallback(async () => {
    if (!uploadPreview) return;
    setUploadSaveBusy(true);
    try {
      await patchMeAvatar(uploadPreview);
      setPhotoModalOpen(false);
      setUploadPreview(null);
      setPhotoAccordion(null);
      showToast({ kind: "success", message: "Profile photo updated!" });
    } catch (e) {
      showToast({
        kind: "error",
        message: e instanceof Error ? e.message : "Update failed",
      });
    } finally {
      setUploadSaveBusy(false);
    }
  }, [uploadPreview, patchMeAvatar, showToast]);

  const onModalEmojiSave = useCallback(async () => {
    if (!modalEmojiPick) return;
    setEmojiSaveBusy(true);
    try {
      await patchMeAvatar(modalEmojiPick);
      setPhotoModalOpen(false);
      setPhotoAccordion(null);
      showToast({ kind: "success", message: "Profile photo updated!" });
    } catch (e) {
      showToast({
        kind: "error",
        message: e instanceof Error ? e.message : "Update failed",
      });
    } finally {
      setEmojiSaveBusy(false);
    }
  }, [modalEmojiPick, patchMeAvatar, showToast]);

  const onAutoAvatarSave = useCallback(async () => {
    setAutoSaveBusy(true);
    try {
      await patchMeAvatar(autoDicebearUrl);
      setPhotoModalOpen(false);
      setPhotoAccordion(null);
      showToast({ kind: "success", message: "Profile photo updated!" });
    } catch (e) {
      showToast({
        kind: "error",
        message: e instanceof Error ? e.message : "Update failed",
      });
    } finally {
      setAutoSaveBusy(false);
    }
  }, [autoDicebearUrl, patchMeAvatar, showToast]);

  const applyMeAfterAvatarPatch = useCallback((u: UserMe) => {
    setMe(u);
    if (u.avatar_url && !isHttpOrDataAvatar(u.avatar_url)) {
      localStorage.setItem(LS_AVATAR_EMOJI, u.avatar_url);
      setAvatarEmoji(u.avatar_url);
    } else {
      localStorage.removeItem(LS_AVATAR_EMOJI);
      setAvatarEmoji(null);
    }
  }, []);

  const onGoogleLinkedPhotoSave = useCallback(async () => {
    if (!googleLinkedUrl) return;
    setGoogleSaveBusy(true);
    try {
      const u = await apiFetch<UserMe>("/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ avatar_url: googleLinkedUrl }),
      });
      applyMeAfterAvatarPatch(u);
      setPhotoModalOpen(false);
      setPhotoAccordion(null);
      setGoogleLinkedUrl(null);
      showToast({ kind: "success", message: "Profile photo updated!" });
    } catch (e) {
      showToast({
        kind: "error",
        message: e instanceof Error ? e.message : "Update failed",
      });
    } finally {
      setGoogleSaveBusy(false);
    }
  }, [googleLinkedUrl, applyMeAfterAvatarPatch, showToast]);

  async function saveProfile() {
    if (!me) return;
    const uTrim = editUsername.trim();
    if (uTrim && !USERNAME_RE.test(uTrim)) {
      showToast({
        kind: "error",
        message: "Username must be 3–20 characters: lowercase letters, numbers, underscores only",
      });
      return;
    }
    setSaveBusy(true);
    try {
      const u = await apiFetch<UserMe>("/auth/me", {
        method: "PATCH",
        body: JSON.stringify({
          full_name: editName.trim(),
          username: uTrim || null,
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
      setPhotoModalOpen(false);
      showToast({ kind: "success", message: "Profile saved!" });
      router.back();
    } catch (e) {
      showToast({
        kind: "error",
        message: e instanceof Error ? e.message : "Update failed",
      });
    } finally {
      setSaveBusy(false);
    }
  }

  function copyTravelloProfileLink() {
    const u = me?.username?.trim();
    if (!u) {
      showToast({ kind: "error", message: "Set a username first" });
      return;
    }
    const url = `https://travello.app/@${encodeURIComponent(u)}`;
    void navigator.clipboard.writeText(url).then(
      () => showToast({ kind: "success", message: "Link copied" }),
      () => showToast({ kind: "error", message: "Could not copy" }),
    );
  }

  function openDmComposeWithLink() {
    const u = me?.username?.trim();
    if (!u) {
      showToast({ kind: "error", message: "Set a username first" });
      return;
    }
    setDmComposeBody(`https://travello.app/@${encodeURIComponent(u)}`);
    setShareSheetOpen(false);
    setDmComposeOpen(true);
  }

  async function shareNativeProfile() {
    const u = me?.username?.trim();
    if (!u) {
      showToast({ kind: "error", message: "Set a username first" });
      return;
    }
    const url = `https://travello.app/@${encodeURIComponent(u)}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${me?.full_name ?? "Travello"} on Travello`,
          text: `Check out my Travello profile`,
          url,
        });
        setShareSheetOpen(false);
      } else {
        await navigator.clipboard.writeText(url);
        showToast({ kind: "success", message: "Link copied" });
        setShareSheetOpen(false);
      }
    } catch {
      /* user cancelled share */
    }
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

  const badges = useMemo((): ProfileBadge[] => {
    const tc = stats?.trips_created ?? 0;
    const gj = stats?.groups_joined ?? 0;
    const cc = countriesCount;
    return [
      {
        id: "beach",
        icon: "🏖️",
        name: "Beach Lover",
        earned: cc >= 1,
        tier: "bronze",
        unlockLevel: 2,
      },
      {
        id: "leader",
        icon: "👑",
        name: "Group Leader",
        earned: gj >= 2,
        tier: "silver",
        unlockLevel: 3,
      },
      {
        id: "world",
        icon: "🌍",
        name: "World Traveler",
        earned: cc >= 5,
        tier: "gold",
        unlockLevel: 5,
      },
      {
        id: "flyer",
        icon: "✈️",
        name: "Frequent Flyer",
        earned: tc >= 5,
        tier: "gold",
        unlockLevel: 4,
      },
      {
        id: "trekker",
        icon: "🏔️",
        name: "Trekker",
        earned: false,
        tier: "silver",
        unlockLevel: 4,
      },
      {
        id: "splitter",
        icon: "💰",
        name: "Fair Splitter",
        earned: false,
        tier: "bronze",
        unlockLevel: 2,
      },
      {
        id: "backpacker",
        icon: "🎒",
        name: "Backpacker",
        earned: false,
        tier: "bronze",
        unlockLevel: 3,
      },
      {
        id: "early",
        icon: "⭐",
        name: "Early Adopter",
        earned: true,
        tier: "silver",
        unlockLevel: 1,
      },
    ];
  }, [stats, countriesCount]);

  const sortedBadges = useMemo(() => {
    const earned = badges.filter((b) => b.earned);
    const locked = badges.filter((b) => !b.earned);
    return [...earned, ...locked];
  }, [badges]);

  const tierPillBg = (tier: ProfileBadge["tier"]) => {
    if (tier === "bronze") return "#CD7F32";
    if (tier === "silver") return "#C0C0C0";
    return "#FFD700";
  };

  const tripHighlightCards = useMemo(() => {
    const tc = stats?.trips_created ?? 0;
    const countries = stats?.countries_from_trips ?? [];
    if (tc === 0 && countries.length === 0) return [];
    const n = Math.min(12, Math.max(tc, countries.length, 1));
    const gradients = [
      "linear-gradient(145deg,#0F3460 0%,#E94560 100%)",
      "linear-gradient(145deg,#1a4d7a 0%,#25D366 100%)",
      "linear-gradient(145deg,#7C3AED 0%,#F59E0B 100%)",
      "linear-gradient(145deg,#0891B2 0%,#EC4899 100%)",
    ];
    return Array.from({ length: n }, (_, i) => {
      const dest =
        countries[i % Math.max(countries.length, 1)] || `Destination ${i + 1}`;
      const title =
        countries.length > 0
          ? `${dest} getaway`
          : tc > 0
            ? `Trip ${i + 1}`
            : `Memory ${i + 1}`;
      return {
        id: i,
        title,
        dest,
        bg: gradients[i % gradients.length]!,
      };
    });
  }, [stats]);

  useEffect(() => {
    if (!freezePopoverOpen) return;
    const onDown = (e: MouseEvent) => {
      if (
        freezePopoverRef.current &&
        !freezePopoverRef.current.contains(e.target as Node)
      ) {
        setFreezePopoverOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [freezePopoverOpen]);

  const mockContactResults = useMemo(() => {
    const q = contactSearch.trim().toLowerCase();
    if (q.length < 2) return [];
    return [
      {
        id: "m1",
        name: "Arjun Mehta",
        username: "arjunm",
        mutual: 2,
        avatar: "AM",
        bg: "#2563EB",
      },
      {
        id: "m2",
        name: "Priya Sharma",
        username: "priyatravels",
        mutual: 1,
        avatar: "PS",
        bg: "#7C3AED",
      },
    ].filter(
      (r) =>
        r.name.toLowerCase().includes(q) || r.username.toLowerCase().includes(q),
    );
  }, [contactSearch]);

  const openEditProfileModal = useCallback(() => {
    if (!me) return;
    setEditName(me.full_name);
    setEditUsername(me.username ?? "");
    setEditBio(bioLocal);
    setEditHome(me.home_city?.trim() || homeLocal);
    setEditTravelStatus(me.travel_status?.trim() || travelStatusLocal);
    setPhotoModalOpen(false);
    setEditOpen(true);
  }, [me, bioLocal, homeLocal, travelStatusLocal]);

  useEffect(() => {
    if (!photoModalOpen) {
      setUploadPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setGoogleLinkedUrl(null);
      setGoogleLinkedLoading(false);
    }
  }, [photoModalOpen]);

  useEffect(() => {
    if (!photoModalOpen || photoAccordion !== "google") return;
    let cancelled = false;
    setGoogleLinkedLoading(true);
    const current = meRef.current;
    setGoogleLinkedUrl(current ? linkedAccountPhotoFromProfile(current) : null);
    (async () => {
      try {
        const data = await apiFetch<UserMe>("/auth/me");
        if (cancelled) return;
        const url = linkedAccountPhotoFromProfile(data);
        setGoogleLinkedUrl(url);
      } catch {
        if (!cancelled) {
          const fallback = meRef.current;
          setGoogleLinkedUrl(
            fallback ? linkedAccountPhotoFromProfile(fallback) : null,
          );
          showToast({ kind: "error", message: "Could not load account photo." });
        }
      } finally {
        if (!cancelled) setGoogleLinkedLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [photoModalOpen, photoAccordion, showToast]);

  const firstEarnedBadge = badges.find((b) => b.earned);

  const completeProfileHamburger =
    Boolean(me) &&
    Boolean(
      me?.email_verified &&
        me?.phone &&
        me?.google_sub &&
        me?.whatsapp_verified &&
        me?.instagram_handle &&
        me?.username,
    );

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
  const freezeRemaining = freezeUsedToday ? 0 : 1;

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

      <div className="flex w-full flex-col gap-4 px-4 pb-8 lg:flex-row lg:items-start lg:gap-6 lg:px-4 xl:px-6">
        <div className="flex w-full min-w-0 flex-col gap-4 lg:w-[45%] lg:max-w-none lg:shrink-0">
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
            <section className="px-4 py-4 lg:bg-white" style={{ color: NAVY }}>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-4">
            <button
              type="button"
              onClick={openEditProfileModal}
              className="relative shrink-0 rounded-full outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-[#E94560]"
              aria-label="Edit profile photo"
            >
              <div
                className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-[#F8F9FA] text-5xl"
                style={{
                  borderWidth: 2,
                  borderStyle: "solid",
                  borderColor: PINK_RING,
                }}
              >
                <ProfileAvatarView
                  src={{
                    avatarUrl: me.avatar_url,
                    profilePictureUrl: me.profile_picture,
                    localEmojiFallback:
                      !me.avatar_url?.trim() && avatarEmoji ? avatarEmoji : null,
                    idSeed: me.id,
                    fullName: me.full_name,
                  }}
                  size={80}
                />
              </div>
            </button>
            <div className="grid w-full max-w-xs grid-cols-4 gap-2 text-center sm:max-w-none sm:flex-1">
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

          <div className="mt-4 text-center sm:text-left">
            <p className="text-[15px] font-bold" style={{ color: NAVY }}>
              {formatDisplayName(me.full_name)}
            </p>
            <p className="mt-0.5 text-[13px] text-[#6C757D]">{atHandle}</p>
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

          <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {(badgeStripExpanded ? sortedBadges : sortedBadges.slice(0, 4)).map(
              (b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setBadgeTip(badgeTip === b.id ? null : b.id)}
                  className="relative flex h-11 min-w-[44px] shrink-0 items-center justify-center rounded-full px-2 transition-transform active:scale-95"
                  style={{
                    background: tierPillBg(b.tier),
                    boxShadow: b.earned
                      ? "0 0 14px rgba(233, 69, 96, 0.35)"
                      : undefined,
                  }}
                  aria-label={b.name}
                >
                  <span
                    className="text-[28px] leading-none"
                    style={{
                      filter: b.earned ? undefined : "grayscale(1)",
                      opacity: b.earned ? 1 : 0.85,
                    }}
                  >
                    {b.icon}
                  </span>
                  {!b.earned ? (
                    <span className="absolute bottom-0.5 right-0.5 text-[10px] leading-none">
                      🔒
                    </span>
                  ) : null}
                </button>
              ),
            )}
            {sortedBadges.length > 4 ? (
              <button
                type="button"
                onClick={() => setBadgeStripExpanded((v) => !v)}
                className="shrink-0 rounded-full border px-3 py-2 text-xs font-bold"
                style={{
                  borderColor: BORDER,
                  color: CORAL,
                  minHeight: 44,
                }}
              >
                {badgeStripExpanded
                  ? "Less"
                  : `+${sortedBadges.length - 4} more`}
              </button>
            ) : null}
          </div>
          {badgeTip ? (
            <p
              className="mt-2 rounded-lg px-3 py-2 text-center text-xs leading-snug"
              style={{ background: "#F1F3F5", color: "#2C3E50" }}
            >
              {(() => {
                const b = sortedBadges.find((x) => x.id === badgeTip);
                if (!b) return null;
                return b.earned
                  ? b.name
                  : `Reach Level ${b.unlockLevel} to unlock — ${b.name}`;
              })()}
            </p>
          ) : null}

          <div className="mt-4 grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={openEditProfileModal}
              className="min-h-[44px] rounded-lg border text-sm font-semibold"
              style={{ borderColor: BORDER, color: NAVY }}
            >
              Edit profile
            </button>
            <button
              type="button"
              onClick={() => setShareSheetOpen(true)}
              className="min-h-[44px] rounded-lg border text-sm font-semibold"
              style={{ borderColor: BORDER, color: NAVY }}
            >
              Share profile
            </button>
            <button
              type="button"
              onClick={() => setAddFriendOpen(true)}
              className="min-h-[44px] rounded-lg border text-sm font-semibold"
              style={{ borderColor: BORDER, color: NAVY }}
              aria-label="Add friend"
            >
              👤+
            </button>
          </div>
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
        <section
          className="relative mt-4 overflow-hidden rounded-xl border bg-white shadow-sm"
          style={{ borderColor: BORDER }}
        >
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
          <div
            className="relative border-t px-3 pb-14 pt-4"
            style={{ borderColor: BORDER }}
          >
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
            <div className="absolute bottom-3 right-3 z-10" ref={freezePopoverRef}>
              {freezePopoverOpen ? (
                <div
                  className="absolute bottom-full right-0 mb-2 w-56 rounded-xl border bg-white p-3 shadow-lg"
                  style={{ borderColor: BORDER }}
                >
                  <p className="text-xs font-medium text-[#2C3E50]">
                    Use your streak freeze? ({freezeRemaining} remaining)
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        activateFreeze();
                        setFreezePopoverOpen(false);
                      }}
                      disabled={freezeRemaining === 0}
                      className="min-h-[40px] flex-1 rounded-lg px-2 py-2 text-xs font-semibold text-white disabled:opacity-50"
                      style={{ background: NAVY }}
                    >
                      Yes, use it
                    </button>
                    <button
                      type="button"
                      onClick={() => setFreezePopoverOpen(false)}
                      className="min-h-[40px] flex-1 rounded-lg border px-2 py-2 text-xs font-semibold text-[#6C757D]"
                      style={{ borderColor: BORDER }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
              <button
                type="button"
                disabled={freezeRemaining === 0}
                onClick={() =>
                  freezeRemaining > 0 && setFreezePopoverOpen((o) => !o)
                }
                className="min-h-[44px] rounded-full border px-3 py-2 text-left text-xs font-semibold shadow-sm disabled:cursor-not-allowed"
                style={{
                  borderColor: BORDER,
                  background: "#fff",
                  color: freezeRemaining === 0 ? "#ADB5BD" : NAVY,
                }}
              >
                {freezeRemaining > 0
                  ? `❄️ ${freezeRemaining} Freeze left`
                  : "❄️ No freezes left"}
              </button>
            </div>
          </div>
        </section>
        </div>

        <div className="mt-4 min-h-[280px] w-full min-w-0 lg:mt-0 lg:w-[55%] lg:flex-1">
          <section
            className="border-t bg-white lg:rounded-xl lg:border lg:border-t lg:shadow-sm"
            style={{ borderColor: BORDER }}
          >
            <div className="flex flex-wrap border-b" style={{ borderColor: BORDER }}>
              {(
                [
                  { id: "posts" as const, icon: "📷", label: "Posts" },
                  { id: "reels" as const, icon: "🎬", label: "Reels" },
                  { id: "trips" as const, icon: "🗺️", label: "Trips" },
                  { id: "saved" as const, icon: "🔖", label: "Saved" },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={highlightTab === t.id}
                  onClick={() => setHighlightTab(t.id)}
                  className={`flex min-h-[48px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-2 text-center sm:flex-row sm:gap-1 ${
                    highlightTab === t.id
                      ? "border-b-2 font-semibold"
                      : "text-[#6C757D]"
                  }`}
                  style={
                    highlightTab === t.id
                      ? { color: NAVY, borderBottomColor: NAVY }
                      : {}
                  }
                >
                  <span className="text-base" aria-hidden>
                    {t.icon}
                  </span>
                  <span className="text-[11px] sm:text-xs">{t.label}</span>
                </button>
              ))}
            </div>
            <div className="p-2 sm:p-3">
              {highlightTab === "posts" || highlightTab === "trips" ? (
                tripHighlightCards.length === 0 ? (
                  <div
                    className="flex min-h-[220px] flex-col items-center justify-center gap-3 px-4 py-12 text-center"
                    style={{ color: "#6C757D" }}
                  >
                    <span className="text-5xl" aria-hidden>
                      🧳
                    </span>
                    <p className="max-w-xs text-sm font-medium text-[#2C3E50]">
                      No posts yet — complete a trip to share memories!
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 sm:gap-2 lg:grid-cols-3">
                    {tripHighlightCards.map((card) => (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => router.push("/trips")}
                        className="group relative aspect-square w-full overflow-hidden rounded-lg text-left outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-[#E94560]"
                        style={{ background: card.bg }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
                        <p className="absolute bottom-2 left-2 right-2 text-[12px] font-bold leading-tight text-white drop-shadow-sm">
                          {card.title}
                        </p>
                      </button>
                    ))}
                  </div>
                )
              ) : (
                <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 py-10 text-sm text-[#6C757D]">
                  <span className="text-3xl">
                    {highlightTab === "reels" ? "🎬" : "🔖"}
                  </span>
                  <p>No {highlightTab} yet — check back soon!</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      {editOpen ? (
        <div
          className="fixed inset-0 z-[220] flex h-[100dvh] max-h-[100dvh] flex-col bg-white"
          style={{
            animation: "profileModalSlide 0.2s ease-out forwards",
          }}
        >
          <style
            dangerouslySetInnerHTML={{
              __html:
                "@keyframes profileModalSlide{from{transform:translateY(100%)}to{transform:translateY(0)}}",
            }}
          />
          <header
            className="flex shrink-0 items-center gap-2 border-b px-3 py-3"
            style={{ borderColor: BORDER }}
          >
            <button
              type="button"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center text-xl text-[#2C3E50]"
              aria-label="Close"
              onClick={() => {
                setEditOpen(false);
                setPhotoModalOpen(false);
              }}
            >
              ←
            </button>
            <h1 className="flex-1 text-center text-[17px] font-bold" style={{ color: NAVY }}>
              Edit Profile
            </h1>
            <div className="min-h-[44px] min-w-[44px] shrink-0" aria-hidden />
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
            <div className="flex flex-col items-center">
              <button
                type="button"
                onClick={openPhotoModal}
                className="flex flex-col items-center gap-2 outline-none"
              >
                <div
                  className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-[#F8F9FA] text-5xl"
                  style={{
                    borderWidth: 2,
                    borderStyle: "solid",
                    borderColor: PINK_RING,
                  }}
                >
                  <ProfileAvatarView
                    src={{
                      avatarUrl: me.avatar_url,
                      profilePictureUrl: me.profile_picture,
                      localEmojiFallback:
                        !me.avatar_url?.trim() && avatarEmoji ? avatarEmoji : null,
                      idSeed: me.id,
                      fullName: me.full_name,
                    }}
                    size={80}
                  />
                </div>
                <span className="text-sm font-semibold" style={{ color: CORAL }}>
                  Change profile photo
                </span>
              </button>
              <p
                className="mt-3 text-center text-xs font-medium"
                style={{ color: "#6B7280" }}
              >
                Profile {editCompletion.pct}% complete
              </p>
              <div
                className="mx-auto mt-1 overflow-hidden rounded-sm"
                style={{
                  width: 200,
                  height: 4,
                  backgroundColor: PROFILE_BG_BAR,
                  borderRadius: 2,
                }}
              >
                <div
                  className="h-full rounded-sm transition-all duration-300"
                  style={{ width: `${editCompletion.pct}%`, backgroundColor: CRIMSON }}
                />
              </div>
              <p
                className="mt-1.5 text-center text-[12px]"
                style={{ color: "#6B7280" }}
              >
                {editCompletion.filled} of 6 details added
              </p>
            </div>
            <label className="mt-6 block">
              <span className="text-xs font-semibold text-[#6C757D]">Full name</span>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="mt-1 min-h-[44px] w-full rounded-lg border border-[#E9ECEF] px-3 py-2 text-sm outline-none focus:border-[#E94560]"
              />
            </label>
            <label className="mt-4 block">
              <span className="text-xs font-semibold text-[#6C757D]">Username</span>
              <div className="mt-1 flex min-h-[44px] rounded-lg border border-[#E9ECEF]">
                <span className="flex items-center border-r border-[#E9ECEF] bg-[#F8F9FA] px-3 text-sm text-[#6C757D]">
                  @
                </span>
                <input
                  value={editUsername}
                  onChange={(e) =>
                    setEditUsername(
                      e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20),
                    )
                  }
                  maxLength={20}
                  autoCapitalize="off"
                  autoCorrect="off"
                  className="min-w-0 flex-1 px-3 py-2 text-sm outline-none"
                />
                {editUsername.trim().length > 0 ? (
                  <span
                    className="flex items-center pr-2 text-base"
                    aria-hidden
                    style={{
                      color: isUsernamePatternValid(editUsername) ? "#16A34A" : "#DC2626",
                    }}
                  >
                    {isUsernamePatternValid(editUsername) ? "✓" : "✕"}
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 text-right text-[11px] text-[#6C757D]">
                {editUsername.length}/20
              </p>
            </label>
            <label className="mt-2 block">
              <span className="text-xs font-semibold text-[#6C757D]">Bio</span>
              <textarea
                value={editBio}
                maxLength={150}
                onChange={(e) => setEditBio(e.target.value)}
                rows={4}
                className="mt-1 w-full rounded-lg border border-[#E9ECEF] px-3 py-2 text-sm outline-none focus:border-[#E94560]"
              />
              <div className="mt-0.5 flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between">
                <span
                  className="text-[10px] text-[#6C757D]"
                  style={{
                    color: editBio.length > 130 ? "#DC2626" : "#6C757D",
                  }}
                >
                  {editBio.length}/150
                </span>
                {editBio.length >= 50 && editBio.length <= 150 ? (
                  <span className="text-[10px] font-medium text-green-600">
                    🔥 Great bio!
                  </span>
                ) : null}
              </div>
            </label>
            <label className="mt-4 block">
              <span className="text-xs font-semibold text-[#6C757D]">Home city</span>
              <input
                value={editHome}
                onChange={(e) => setEditHome(e.target.value)}
                className="mt-1 min-h-[44px] w-full rounded-lg border border-[#E9ECEF] px-3 py-2 text-sm outline-none focus:border-[#E94560]"
                placeholder="City you call home"
              />
            </label>
            <label className="mt-4 block">
              <span className="text-xs font-semibold text-[#6C757D]">Travel status</span>
              <input
                value={editTravelStatus}
                onChange={(e) => setEditTravelStatus(e.target.value)}
                className="mt-1 min-h-[44px] w-full rounded-lg border border-[#E9ECEF] px-3 py-2 text-sm outline-none focus:border-[#E94560]"
                placeholder="e.g. Planning Japan 2026"
              />
            </label>
            <div className="mt-4 flex items-center gap-1 text-sm text-[#6C757D]">
              <span aria-hidden>🔒</span>
              {me.email}
            </div>
          </div>
          <div
            className="sticky bottom-0 z-10 border-t bg-white p-4"
            style={{ borderColor: "#F3F4F6" }}
          >
            <button
              type="button"
              disabled={saveBusy}
              onClick={() => void saveProfile()}
              className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl text-[15px] font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: CRIMSON }}
            >
              {saveBusy ? (
                <>
                  <span
                    className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white/30 border-t-white"
                    aria-hidden
                  />
                  Saving…
                </>
              ) : (
                "Save changes"
              )}
            </button>
          </div>
        </div>
      ) : null}

      {photoModalOpen ? (
        <div className="fixed inset-0 z-[230] flex items-end justify-center md:items-center md:px-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Close"
            onClick={() => {
              setPhotoModalOpen(false);
              setPhotoAccordion(null);
            }}
          />
          <div
            className="relative z-10 flex h-full w-full max-h-full flex-col overflow-hidden bg-white md:h-auto md:max-h-[90vh] md:max-w-sm md:rounded-2xl md:shadow-2xl"
            style={{ borderTopLeftRadius: 16, borderTopRightRadius: 16 }}
          >
            <div
              className="grid shrink-0 grid-cols-[44px_1fr_44px] items-center border-b px-2 py-2"
              style={{ borderColor: BORDER }}
            >
              <div aria-hidden className="min-h-[44px]" />
              <h2
                className="text-center text-[17px] font-bold"
                style={{ color: NAVY }}
              >
                Change profile photo
              </h2>
              <button
                type="button"
                onClick={() => {
                  setPhotoModalOpen(false);
                  setPhotoAccordion(null);
                }}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center text-2xl leading-none text-[#2C3E50]"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  void onProfilePhotoFile(e.target.files);
                }}
              />
              {(
                [
                  {
                    id: "upload" as const,
                    icon: "📷",
                    title: "Upload from device",
                    desc: "JPG, PNG, WEBP",
                  },
                  {
                    id: "emoji" as const,
                    icon: "🎭",
                    title: "Choose travel avatar",
                    desc: "Pick a fun emoji",
                  },
                  {
                    id: "auto" as const,
                    icon: "✨",
                    title: "Auto avatar from name",
                    desc: "Generate from your name",
                  },
                  {
                    id: "google" as const,
                    icon: "",
                    title: "Use linked account photo",
                    desc: "From your Google account",
                  },
                ] as const
              ).map((row) => (
                <div key={row.id} className="mb-2 border-b last:border-0" style={{ borderColor: "#F3F4F6" }}>
                  <button
                    type="button"
                    onClick={() =>
                      setPhotoAccordion((c) => (c === row.id ? null : row.id))
                    }
                    className="flex w-full min-h-[52px] items-center gap-3 rounded-lg px-2 py-2 text-left"
                  >
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center"
                      aria-hidden
                    >
                      {row.id === "google" ? (
                        <svg
                          width={28}
                          height={28}
                          viewBox="0 0 48 48"
                          aria-hidden
                        >
                          <path
                            fill="#FFC107"
                            d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.223 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
                          />
                          <path
                            fill="#FF3D00"
                            d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
                          />
                          <path
                            fill="#4CAF50"
                            d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
                          />
                          <path
                            fill="#1976D2"
                            d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
                          />
                        </svg>
                      ) : (
                        <span className="text-2xl">{row.icon}</span>
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-[#111827]">{row.title}</p>
                      <p className="text-xs text-[#6B7280]">{row.desc}</p>
                    </div>
                    <span className="text-[#9CA3AF]">{photoAccordion === row.id ? "▴" : "▾"}</span>
                  </button>
                  {photoAccordion === "upload" && row.id === "upload" ? (
                    <div className="px-1 pb-4">
                      {uploadPreview ? (
                        <div className="flex flex-col items-center gap-3">
                          <div
                            className="h-[100px] w-[100px] shrink-0 overflow-hidden rounded-full bg-gray-100"
                            style={{ border: `2px solid ${PINK_RING}` }}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={uploadPreview}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <button
                            type="button"
                            disabled={uploadSaveBusy}
                            onClick={() => void onUploadPreviewSave()}
                            className="flex min-h-[44px] w-full max-w-xs items-center justify-center gap-2 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                            style={{ backgroundColor: CRIMSON }}
                          >
                            {uploadSaveBusy ? (
                              <span
                                className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                                aria-hidden
                              />
                            ) : null}
                            Looks good — Save
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#D1D5DB] bg-[#FAFAFA] px-4 py-8"
                        >
                          <span className="text-[#4B5563]">
                            <svg
                              width={32}
                              height={32}
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              aria-hidden
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M3 9.75V17.25A2.25 2.25 0 0 0 5.25 19.5H18.75A2.25 2.25 0 0 0 21 17.25V9.75M3 9.75 6.75A2.25 2.25 0 0 1 5.25 4.5H7.2l1-1.5h5.2l1 1.5h1.05A2.25 2.25 0 0 1 16.5 6.75v3H3v0Z"
                              />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
                              />
                            </svg>
                          </span>
                          <p className="text-[14px] font-bold text-[#111827]">Upload from device</p>
                          <p className="text-[12px] text-[#6B7280]">JPG, PNG, WEBP — max 5MB</p>
                        </button>
                      )}
                    </div>
                  ) : null}
                  {photoAccordion === "emoji" && row.id === "emoji" ? (
                    <div className="px-1 pb-4">
                      <div className="grid grid-cols-6 gap-2">
                        {AVATAR_EMOJIS.map((e) => (
                          <button
                            key={e}
                            type="button"
                            onClick={() => setModalEmojiPick(e)}
                            className={`flex aspect-square min-h-[44px] items-center justify-center rounded-lg border-2 text-2xl ${
                              modalEmojiPick === e ? "bg-[#fff0f3]" : "bg-white"
                            }`}
                            style={{
                              borderColor: modalEmojiPick === e ? CORAL : BORDER,
                            }}
                          >
                            {e}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        disabled={emojiSaveBusy || !modalEmojiPick}
                        onClick={() => void onModalEmojiSave()}
                        className="mt-4 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                        style={{ backgroundColor: CRIMSON }}
                      >
                        {emojiSaveBusy ? (
                          <span
                            className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                            aria-hidden
                          />
                        ) : null}
                        Use this avatar
                      </button>
                    </div>
                  ) : null}
                  {photoAccordion === "auto" && row.id === "auto" ? (
                    <div className="px-1 pb-4">
                      <p className="text-xs font-medium text-[#6B7280]">Generate from my name</p>
                      <div className="mt-2 flex flex-col items-center gap-3">
                        <div
                          className="h-20 w-20 overflow-hidden rounded-full border-2"
                          style={{ borderColor: PINK_RING }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={autoDicebearUrl}
                            alt=""
                            className="h-full w-full object-cover"
                            width={80}
                            height={80}
                          />
                        </div>
                        <button
                          type="button"
                          disabled={autoSaveBusy}
                          onClick={() => void onAutoAvatarSave()}
                          className="flex min-h-[48px] w-full max-w-xs items-center justify-center gap-2 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                          style={{ backgroundColor: CRIMSON }}
                        >
                          {autoSaveBusy ? (
                            <span
                              className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                              aria-hidden
                            />
                          ) : null}
                          Use auto avatar
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {photoAccordion === "google" && row.id === "google" ? (
                    <div className="px-1 pb-4">
                      {googleLinkedLoading ? (
                        <div className="flex flex-col items-center gap-3 py-6">
                          <span
                            className="h-8 w-8 animate-spin rounded-full border-2 border-[#E94560]/30 border-t-[#E94560]"
                            aria-hidden
                          />
                          <p className="text-xs text-[#6B7280]">Loading…</p>
                        </div>
                      ) : googleLinkedUrl ? (
                        <div className="flex flex-col items-center gap-3">
                          <div
                            className="h-[100px] w-[100px] shrink-0 overflow-hidden rounded-full bg-gray-100"
                            style={{ border: `2px solid ${PINK_RING}` }}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={googleLinkedUrl}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <button
                            type="button"
                            disabled={googleSaveBusy}
                            onClick={() => void onGoogleLinkedPhotoSave()}
                            className="flex min-h-[44px] w-full max-w-xs items-center justify-center gap-2 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                            style={{ backgroundColor: CRIMSON }}
                          >
                            {googleSaveBusy ? (
                              <span
                                className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                                aria-hidden
                              />
                            ) : null}
                            Use this photo
                          </button>
                        </div>
                      ) : (
                        <p className="py-2 text-center text-sm leading-snug text-[#6B7280]">
                          No linked account photo found. Try signing in with Google.
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {shareSheetOpen ? (
        <div className="fixed inset-0 z-[210] flex flex-col justify-end">
          <style
            dangerouslySetInnerHTML={{
              __html:
                "@keyframes profileSheetUp{from{transform:translateY(100%)}to{transform:translateY(0)}}",
            }}
          />
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close"
            onClick={() => setShareSheetOpen(false)}
          />
          <div
            className="relative rounded-t-2xl bg-white px-4 pb-6 pt-2 shadow-xl"
            style={{ animation: "profileSheetUp 0.2s ease-out forwards" }}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#DEE2E6]" />
            <p className="mb-3 text-center text-sm font-bold" style={{ color: NAVY }}>
              Share profile
            </p>
            <div className="space-y-1">
              <button
                type="button"
                className="flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium hover:bg-[#F8F9FA]"
                onClick={() => {
                  copyTravelloProfileLink();
                  setShareSheetOpen(false);
                }}
              >
                <span className="text-xl">📋</span>
                Copy profile link
              </button>
              <button
                type="button"
                className="flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium hover:bg-[#F8F9FA]"
                onClick={() => openDmComposeWithLink()}
              >
                <span className="text-xl">💬</span>
                Send as Message
              </button>
              <button
                type="button"
                className="flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium hover:bg-[#F8F9FA]"
                onClick={() => void shareNativeProfile()}
              >
                <span className="text-xl">📤</span>
                Share via…
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {dmComposeOpen ? (
        <div className="fixed inset-0 z-[215] flex flex-col justify-end">
          <style
            dangerouslySetInnerHTML={{
              __html:
                "@keyframes profileSheetUpDm{from{transform:translateY(100%)}to{transform:translateY(0)}}",
            }}
          />
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close"
            onClick={() => setDmComposeOpen(false)}
          />
          <div
            className="relative rounded-t-2xl bg-white px-4 pb-8 pt-2 shadow-xl"
            style={{ animation: "profileSheetUpDm 0.2s ease-out forwards" }}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#DEE2E6]" />
            <p className="mb-2 text-sm font-bold" style={{ color: NAVY }}>
              New message
            </p>
            <textarea
              value={dmComposeBody}
              onChange={(e) => setDmComposeBody(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-[#E9ECEF] px-3 py-2 text-sm outline-none"
            />
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setDmComposeOpen(false)}
                className="min-h-[44px] flex-1 rounded-xl border text-sm font-semibold"
                style={{ borderColor: BORDER, color: "#6C757D" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  try {
                    sessionStorage.setItem("travelhub_compose_prefill", dmComposeBody);
                  } catch {
                    /* ignore */
                  }
                  setDmComposeOpen(false);
                  router.push("/travel-hub");
                }}
                className="min-h-[44px] flex-1 rounded-xl text-sm font-semibold text-white"
                style={{ background: CORAL }}
              >
                Open Travel Hub
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {addFriendOpen ? (
        <div className="fixed inset-0 z-[210] flex flex-col justify-end">
          <style
            dangerouslySetInnerHTML={{
              __html:
                "@keyframes profileSheetUpFriend{from{transform:translateY(100%)}to{transform:translateY(0)}}",
            }}
          />
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close"
            onClick={() => setAddFriendOpen(false)}
          />
          <div
            className="relative max-h-[88vh] overflow-hidden rounded-t-2xl bg-white shadow-xl"
            style={{ animation: "profileSheetUpFriend 0.2s ease-out forwards" }}
          >
            <div className="mx-auto mb-2 mt-2 h-1 w-10 rounded-full bg-[#DEE2E6]" />
            <p className="px-4 pb-2 text-center text-sm font-bold" style={{ color: NAVY }}>
              Add Friend
            </p>
            <div className="flex border-b" style={{ borderColor: BORDER }}>
              <button
                type="button"
                className={`min-h-[48px] flex-1 text-sm font-semibold ${
                  addFriendTab === "hub" ? "border-b-2" : "text-[#6C757D]"
                }`}
                style={
                  addFriendTab === "hub"
                    ? { borderBottomColor: NAVY, color: NAVY }
                    : {}
                }
                onClick={() => setAddFriendTab("hub")}
              >
                Travello Hub
              </button>
              <button
                type="button"
                className={`min-h-[48px] flex-1 text-sm font-semibold ${
                  addFriendTab === "contacts" ? "border-b-2" : "text-[#6C757D]"
                }`}
                style={
                  addFriendTab === "contacts"
                    ? { borderBottomColor: NAVY, color: NAVY }
                    : {}
                }
                onClick={() => setAddFriendTab("contacts")}
              >
                From Contacts
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto px-4 py-4">
              {addFriendTab === "hub" ? (
                <div className="space-y-3 text-sm text-[#6C757D]">
                  <p>
                    Discover travelers in Travel Hub — browse the{" "}
                    <span className="font-semibold text-[#2C3E50]">Contacts</span> tab
                    to find people from your groups.
                  </p>
                  <Link
                    href="/travel-hub?tab=contacts"
                    onClick={() => setAddFriendOpen(false)}
                    className="flex min-h-[48px] items-center justify-center rounded-xl text-sm font-bold text-white"
                    style={{ background: CORAL }}
                  >
                    Open Travello Hub
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  <input
                    value={contactSearch}
                    onChange={(e) => setContactSearch(e.target.value)}
                    placeholder="Search name or phone…"
                    className="min-h-[44px] w-full rounded-xl border border-[#E9ECEF] px-3 text-sm outline-none"
                  />
                  {contactSearch.trim().length < 2 ? (
                    <p className="text-center text-xs text-[#6C757D]">
                      Type at least 2 characters
                    </p>
                  ) : mockContactResults.length === 0 ? (
                    <p className="text-center text-sm text-[#6C757D]">
                      No matches on Travello yet.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {mockContactResults.map((r) => (
                        <li
                          key={r.id}
                          className="flex items-center gap-3 rounded-xl border p-3"
                          style={{ borderColor: BORDER }}
                        >
                          <span
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                            style={{ background: r.bg }}
                          >
                            {r.avatar}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-[#2C3E50]">
                              {r.name}
                            </p>
                            <p className="truncate text-xs text-[#6C757D]">
                              @{r.username} · {r.mutual} mutual trips
                            </p>
                          </div>
                          <button
                            type="button"
                            className="min-h-[40px] shrink-0 rounded-full px-4 text-xs font-bold text-white"
                            style={{ background: NAVY }}
                            onClick={() =>
                              showToast({
                                kind: "success",
                                message: "Friend request sent",
                              })
                            }
                          >
                            Add
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

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
              <button
                type="button"
                onClick={() => {
                  setSettingsOpen(false);
                  router.push("/onboarding");
                }}
                className="flex w-full items-center gap-3 rounded-lg py-2.5 text-left"
              >
                {completeProfileHamburger ? (
                  <span
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-sm font-bold text-white"
                    aria-hidden
                  >
                    ✓
                  </span>
                ) : (
                  <span
                    className="inline-block h-8 w-8 shrink-0 rounded-full border-2 border-red-500 bg-white"
                    aria-hidden
                  />
                )}
                <p className="font-semibold text-[#2C3E50]">Complete Profile</p>
              </button>
              <div className="my-2 h-px bg-[#E9ECEF]" role="separator" />
              {(
                [
                  {
                    icon: "🎨",
                    label: "Avatar style",
                    desc: "Customize your look",
                    onClick: () => {
                      setSettingsOpen(false);
                      openEditProfileModal();
                      window.setTimeout(() => openPhotoModal(), 0);
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
