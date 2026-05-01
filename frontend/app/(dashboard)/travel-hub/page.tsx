"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getDatabase,
  ref,
  push,
  onValue,
  onChildAdded,
  onDisconnect,
  set,
  update,
  get,
  query,
  orderByChild,
  limitToLast,
  remove,
  type Database,
} from "firebase/database";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type MutableRefObject,
  type ReactNode,
  type SetStateAction,
  type TouchEvent,
} from "react";

import {
  Accessibility,
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Asterisk,
  Ban,
  Banknote,
  BarChart2,
  Bell,
  BellOff,
  Bluetooth,
  Bug,
  Calendar,
  Camera,
  Cloud,
  Database as DatabaseIcon,
  FileText,
  Folder,
  Globe2,
  Headphones,
  Heart,
  HelpCircle,
  Check,
  CheckCheck,
  Info,
  KeyRound,
  LifeBuoy,
  Loader2,
  Lock,
  LogOut,
  Mail,
  Map as MapIcon,
  MapPin,
  Megaphone,
  MessageCircle,
  MessageSquareText,
  Mic,
  MicOff,
  Monitor,
  Moon as MoonIcon,
  MoreHorizontal,
  MoreVertical,
  Music,
  Palette,
  Phone,
  PhoneCall,
  PhoneOff,
  Play,
  Plus,
  QrCode,
  UserCircle2,
  UserPlus,
  UsersRound,
  Search,
  Share2,
  Shield,
  Smartphone,
  SmilePlus,
  Star,
  Trash2,
  User,
  Users,
  Video,
  VideoOff,
  Volume2,
  X,
} from "lucide-react";

import { API_BASE, apiFetch, apiFetchWithStatus } from "@/lib/api";
import { clearToken } from "@/lib/auth";
import { CallParticipantSelector, type SelectableContact } from "@/components/CallParticipantSelector";
import { AdvancedScheduledCallModal, type ScheduledCallData, type Attachment } from "@/components/AdvancedScheduledCallModal";

function isAbortError(e: unknown): boolean {
  if (e instanceof Error && e.name === "AbortError") return true;
  const n = (e as { name?: string })?.name;
  return n === "AbortError";
}

function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const { signal: external, ...rest } = init;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  const onExternalAbort = () => {
    clearTimeout(timeout);
    controller.abort();
  };
  if (external) {
    if (external.aborted) {
      clearTimeout(timeout);
      controller.abort();
    } else {
      external.addEventListener("abort", onExternalAbort, { once: true });
    }
  }
  return fetch(input, { ...rest, signal: controller.signal }).finally(() => {
    clearTimeout(timeout);
    if (external) {
      external.removeEventListener("abort", onExternalAbort);
    }
  });
}

/** Connect hub: Travelo Connect shell + warm chat (WhatsApp-inspired) */
const BG = "#0f3460";
const LIST_ROW_HOVER = "#fff0f3";
const LIST_ROW_SELECTED = "#E94560";
const SURFACE = "#2d4060";
const BORDER_SUB = "rgba(255,255,255,0.08)";
const TEXT = "#e8eaf0";
const TEXT_MUTED = "#8892a4";
const TEXT_SECONDARY = "#8892a4";
const SECTION_LABEL = "#8892a4";
const ACCENT = "#4a9eff";
const BRAND_ACCENT = "#E94560";
const LIST_TEXT = "#1f2937";
const LIST_TEXT_MUTED = "#6b7280";
const LIST_BORDER = "#eef2f7";
const HUB_GREEN = "#00a884";
const ONLINE = "#22C55E";
/** Expense lines (with white label text; amounts use these) */
const MONEY_LINE_RED = "#F87171";
const MONEY_LINE_GREEN = "#4ADE80";
const MONEY_LINE_BLUE = "#60A5FA";
const MONEY_TOTAL_POS = "#4ADE80";
const MONEY_TOTAL_NEG = "#F87171";
const MONEY_TOTAL_ZERO = "#94A3B8";
const RIGHT_PANEL_BG = "#e8ddd0";

const CHAT_PREFS_KEY = "travelhub_chat_prefs_v1";
const DELETED_CHATS_KEY = "travelhub_deleted_chats_v1";
const GT_BUDDY_FAVOURITES = "gt_buddy_favourites";
const GT_TRAVELHUB_OPEN_PROFILE = "gt_travelhub_open_profile";
const GT_OPEN_DM_USER_ID = "gt_open_dm_user_id";
const GT_TRAVELHUB_ACTIVE_TAB = "gt_travelhub_active_tab";

/** Initials-avatar background colors (name hash) */
const INITIALS_AVATAR_COLORS = [
  "#E8385A",
  "#0EA5E9",
  "#10B981",
  "#F59E0B",
  "#8B5CF6",
] as const;

const DEMO_CHAT_TRAVELLO_HELP_ID = "__demo_travello_help__";
const DEMO_CHAT_COMMUNITY_ID = "__demo_community_updates__";

/** Legacy message thread colors */
const MSG_BORDER = "#e9edef";
const WA_BG = "#e8ddd0";

/** Quick text chips (no emoji) for optional compose shortcuts */
const QUICK_REACTION_CHIPS = [
  "OK",
  "Hi",
  "Thanks",
  "On my way",
  "Sounds good",
  "Will do",
  "Done",
  "Yes",
  "No",
  "Maybe",
  "See you",
  "On it",
  "Let me know",
  "Call me",
  "Later",
  "Here",
  "Arrived",
  "Busy",
  "Free",
  "Hello",
] as const;

const GT_RECENT_EMOJIS = "gt_recent_emojis";
const TENOR_API_KEY = "AIzaSyAyimkuYQYF_FXVALexPzkcsvZpe6MePdw";

/** WhatsApp-style picker grids (Unicode); flags list matches product spec. */
const EMOJI_CATEGORIES: Record<string, string[]> = {
  recent: [],
  smileys: [
    "😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "🙃", "😉", "😊", "😇", "🥰", "😍", "🤩", "😘", "😗", "😚", "😙", "😋", "😛", "😜", "🤪", "😝", "🤑", "🤗", "🤭", "🤫", "🤔", "🤐", "🤨", "😐", "😑", "😶", "😏", "😒", "🙄", "😬", "🤥", "😌", "😔", "😪", "🤤", "😴", "😷", "🤒", "🤕", "🤢", "🤮", "🤧", "🥵", "🥶", "🥴", "😵", "🤯", "🤠", "🥳", "😎", "🤓", "🧐", "😕", "😟", "🙁", "☹️", "😮", "😯", "😲", "😳", "🥺", "😦", "😧", "😨", "😰", "😥", "😢", "😭", "😱", "😖", "😣", "😞", "😓", "😩", "😫", "🥱", "😤", "😡", "😠", "🤬", "😈", "👿", "💀", "☠️", "💩", "🤡", "👹", "👺", "👻", "👽", "👾", "🤖",
  ],
  people: [
    "👋", "🤚", "🖐", "✋", "🖖", "👌", "🤌", "🤏", "✌️", "🤞", "🤟", "🤘", "🤙", "👈", "👉", "👆", "🖕", "👇", "☝️", "👍", "👎", "✊", "👊", "🤛", "🤜", "👏", "🙌", "👐", "🤲", "🤝", "🙏", "✍️", "💅", "🤳", "💪", "🦾", "🦿", "🦵", "🦶", "👂", "🦻", "👃", "🫀", "🫁", "🧠", "🦷", "🦴", "👀", "👁", "👅", "👄", "👶", "🧒", "👦", "👧", "🧑", "👱", "👨", "🧔", "👩", "🧓", "👴", "👵", "🙍", "🙎", "🙅", "🙆", "💁", "🙋", "🧏", "🙇", "🤦", "🤷",
  ],
  nature: [
    "🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐮", "🐷", "🐸", "🐵", "🙈", "🙉", "🙊", "🐒", "🐔", "🐧", "🐦", "🐤", "🦆", "🦅", "🦉", "🦇", "🐺", "🐗", "🐴", "🦄", "🐝", "🐛", "🦋", "🐌", "🐞", "🐜", "🦟", "🦗", "🕷", "🦂", "🐢", "🐍", "🦎", "🦖", "🦕", "🐙", "🦑", "🦐", "🦞", "🦀", "🐡", "🐠", "🐟", "🐬", "🐳", "🐋", "🦈", "🌸", "🌺", "🌻", "🌹", "🌷", "🌱", "🌿", "🍀", "🌾", "🍁", "🍂", "🍃",
  ],
  food: [
    "🍎", "🍐", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓", "🫐", "🍈", "🍒", "🍑", "🥭", "🍍", "🥥", "🥝", "🍅", "🍆", "🥑", "🥦", "🥬", "🥒", "🌶", "🫑", "🧄", "🧅", "🥔", "🌽", "🥕", "🫛", "🧆", "🥚", "🍳", "🥘", "🍲", "🫕", "🥣", "🥗", "🍿", "🧂", "🥫", "🍱", "🍘", "🍙", "🍚", "🍛", "🍜", "🍝", "🍠", "🍢", "🍣", "🍤", "🍥", "🥮", "🍡", "🥟", "🥠", "🥡", "🍦", "🍧", "🍨", "🍩", "🍪", "🎂", "🍰", "🧁", "🥧", "🍫", "🍬", "🍭", "🍮", "🍯",
  ],
  travel: [
    "🚗", "🚕", "🚙", "🚌", "🚎", "🏎", "🚓", "🚑", "🚒", "🚐", "🛻", "🚚", "🚛", "🚜", "🏍", "🛵", "🚲", "🛴", "🛹", "🛼", "🚏", "🛣", "🛤", "⛽", "🚨", "🚥", "🚦", "🛑", "🚧", "⚓", "🛟", "⛵", "🚤", "🛥", "🛳", "⛴", "🚢", "✈️", "🛩", "🛫", "🛬", "💺", "🚁", "🚟", "🚠", "🚡", "🛰", "🚀", "🛸", "🏖", "🏝", "🏕", "⛺", "🌍", "🌎", "🌏", "🗺", "🧭", "🏔", "⛰", "🌋", "🗻", "🏠", "🏡", "🏢", "🏣", "🏤", "🏥", "🏦", "🏨", "🏩", "🏪", "🏫", "🏬", "🏭", "🗼", "🗽",
  ],
  objects: [
    "⌚", "📱", "📲", "💻", "⌨️", "🖥", "🖨", "🖱", "🖲", "💽", "💾", "💿", "📀", "🧮", "📷", "📸", "📹", "🎥", "📽", "🎞", "📞", "☎️", "📟", "📠", "📺", "📻", "🧭", "⏱", "⏲", "⏰", "🕰", "⌛", "⏳", "📡", "🔋", "🔌", "💡", "🔦", "🕯", "🪔", "🧯", "🛢", "💰", "💴", "💵", "💶", "💷", "💸", "💳", "🪙", "💹", "📈", "📉", "📊", "📋", "🗒", "🗓", "📆", "📅", "📇", "📁", "📂", "🗂", "🗃", "🗄", "🗑", "🔒", "🔓", "🔏", "🔐", "🔑", "🗝", "🔨", "🪓", "⛏", "⚒", "🛠", "🗡", "⚔️", "🔫", "🪃", "🏹", "🛡", "🪚", "🔧", "🪛", "🔩", "⚙️",
  ],
  symbols: [
    "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❤️‍🔥", "❤️‍🩹", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟", "☮️", "✝️", "☪️", "🕉", "✡️", "🔯", "🕎", "☯️", "☦️", "🛐", "⛎", "♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓", "🆔", "⚛️", "🉑", "☢️", "☣️", "📴", "📳", "🈶", "🈚", "🈸", "🈺", "🈷️", "✴️", "🆚", "💮", "🉐", "㊙️", "㊗️", "🈴", "🈵", "🈹", "🈲", "🅰️", "🅱️", "🆎", "🆑", "🅾️", "🆘", "❌", "⭕", "🛑", "⛔", "📛", "🚫", "✅", "☑️", "✔️", "❎", "➰", "➿",
  ],
  flags: [
    "🏳️", "🏴", "🚩", "🏁", "🏳️‍🌈", "🏳️‍⚧️", "🏴‍☠️", "🇦🇫", "🇦🇱", "🇩🇿", "🇦🇩", "🇦🇴", "🇦🇬", "🇦🇷", "🇦🇲", "🇦🇺", "🇦🇹", "🇦🇿", "🇧🇸", "🇧🇭", "🇧🇩", "🇧🇧", "🇧🇾", "🇧🇪", "🇧🇿", "🇧🇯", "🇧🇹", "🇧🇴", "🇧🇦", "🇧🇼", "🇧🇷", "🇧🇳", "🇧🇬", "🇧🇫", "🇧🇮", "🇨🇻", "🇨🇰", "🇨🇦", "🇨🇫", "🇹🇩", "🇨🇱", "🇨🇳", "🇨🇴", "🇰🇲", "🇨🇩", "🇨🇬", "🇨🇷", "🇭🇷", "🇨🇺", "🇨🇾", "🇨🇿", "🇩🇰", "🇩🇯", "🇩🇲", "🇩🇴", "🇪🇨", "🇪🇬", "🇸🇻", "🇬🇶", "🇪🇷", "🇪🇪", "🇸🇿", "🇪🇹", "🇫🇯", "🇫🇮", "🇫🇷", "🇬🇦", "🇬🇲", "🇬🇪", "🇩🇪", "🇬🇭", "🇬🇷", "🇬🇩", "🇬🇹", "🇬🇳", "🇬🇼", "🇬🇾", "🇭🇹", "🇭🇳", "🇭🇺", "🇮🇸", "🇮🇳", "🇮🇩", "🇮🇷", "🇮🇶", "🇮🇪", "🇮🇱", "🇮🇹", "🇯🇲", "🇯🇵", "🇯🇴", "🇰🇿", "🇰🇪", "🇰🇮", "🇰🇵", "🇰🇷", "🇰🇼", "🇰🇬", "🇱🇦", "🇱🇻", "🇱🇧", "🇱🇸", "🇱🇷", "🇱🇾", "🇱🇮", "🇱🇹", "🇱🇺", "🇲🇬", "🇲🇼", "🇲🇾", "🇲🇻", "🇲🇱", "🇲🇹", "🇲🇭", "🇲🇷", "🇲🇺", "🇲🇽", "🇫🇲", "🇲🇩", "🇲🇨", "🇲🇳", "🇲🇪", "🇲🇦", "🇲🇿", "🇲🇲", "🇳🇦", "🇳🇷", "🇳🇵", "🇳🇱", "🇳🇿", "🇳🇮", "🇳🇪", "🇳🇬", "🇳🇴", "🇴🇲", "🇵🇰", "🇵🇼", "🇵🇸", "🇵🇦", "🇵🇬", "🇵🇾", "🇵🇪", "🇵🇭", "🇵🇱", "🇵🇹", "🇶🇦", "🇷🇴", "🇷🇺", "🇷🇼", "🇰🇳", "🇱🇨", "🇻🇨", "🇼🇸", "🇸🇲", "🇸🇹", "🇸🇦", "🇸🇳", "🇷🇸", "🇸🇨", "🇸🇱", "🇸🇬", "🇸🇰", "🇸🇮", "🇸🇧", "🇸🇴", "🇿🇦", "🇸🇸", "🇪🇸", "🇱🇰", "🇸🇩", "🇸🇷", "🇸🇪", "🇨🇭", "🇸🇾", "🇹🇼", "🇹🇯", "🇹🇿", "🇹🇭", "🇹🇱", "🇹🇬", "🇹🇴", "🇹🇹", "🇹🇳", "🇹🇷", "🇹🇲", "🇹🇻", "🇺🇬", "🇺🇦", "🇦🇪", "🇬🇧", "🇺🇸", "🇺🇾", "🇺🇿", "🇻🇺", "🇻🇪", "🇻🇳", "🇾🇪", "🇿🇲", "🇿🇼",
  ],
};

const EMOJI_CAT_KEYS = [
  "recent",
  "smileys",
  "people",
  "nature",
  "food",
  "travel",
  "objects",
  "symbols",
  "flags",
] as const;
type EmojiCatKey = (typeof EMOJI_CAT_KEYS)[number];

const EMOJI_CAT_LABELS: Record<EmojiCatKey, string> = {
  recent: "Recent",
  smileys: "Smileys",
  people: "People",
  nature: "Nature",
  food: "Food",
  travel: "Travel",
  objects: "Objects",
  symbols: "Symbols",
  flags: "Flags",
};

/** Category keywords for emoji search (no emoji in strings). */
const EMOJI_CAT_TAGS: Record<Exclude<EmojiCatKey, "recent">, string> = {
  smileys:
    "smile happy laugh emotion face grin sad angry cry tear funny love cool",
  people: "people hand wave body finger thumb clap family baby",
  nature: "nature animal plant dog cat tree flower bug bird fish",
  food: "food fruit drink eat meal pizza burger sushi rice",
  travel: "travel car plane transport city road trip map beach",
  objects: "object phone computer tool money clock photo video",
  symbols: "symbol heart star sign zodiac religion love peace",
  flags: "flag country nation",
};

type ChatEmojiGifPickerTab = "emoji" | "gif" | "stickers";

function readRecentEmojisLs(): string[] {
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

function writeRecentEmojisLs(emojis: string[]) {
  if (typeof window === "undefined") return;
  const next = emojis.slice(0, 24);
  try {
    localStorage.setItem(GT_RECENT_EMOJIS, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

function pushRecentEmoji(emoji: string) {
  const cur = readRecentEmojisLs().filter((e) => e !== emoji);
  writeRecentEmojisLs([emoji, ...cur]);
}

function insertTextInComposerInput(
  input: HTMLInputElement | null,
  current: string,
  insert: string,
  setValue: (s: string) => void,
) {
  if (!input) {
    setValue(current + insert);
    return;
  }
  const start = input.selectionStart ?? current.length;
  const end = input.selectionEnd ?? current.length;
  const before = current.slice(0, start);
  const after = current.slice(end);
  const next = before + insert + after;
  setValue(next);
  const pos = start + insert.length;
  requestAnimationFrame(() => {
    input.focus();
    try {
      input.setSelectionRange(pos, pos);
    } catch {
      /* ignore */
    }
  });
}

function parseTenorResultUrls(body: unknown): string[] {
  const o = body as { results?: unknown[] } | null;
  const results = Array.isArray(o?.results) ? o.results : [];
  const urls: string[] = [];
  for (const it of results) {
    if (!it || typeof it !== "object") continue;
    const mf = (it as { media_formats?: Record<string, { url?: string }> })
      .media_formats;
    if (!mf || typeof mf !== "object") continue;
    const u =
      mf.tinygif?.url || mf.nanogif?.url || mf.gif?.url || mf.mediumgif?.url;
    if (u && typeof u === "string") urls.push(u);
  }
  return urls;
}

function ChatEmojiGifPicker({
  open,
  tab,
  onTabChange,
  panelHeightPx,
  onClose,
  onInsertEmoji,
  onPickGifUrl,
}: {
  open: boolean;
  tab: ChatEmojiGifPickerTab;
  onTabChange: (t: ChatEmojiGifPickerTab) => void;
  panelHeightPx: number;
  onClose: () => void;
  onInsertEmoji: (emoji: string) => void;
  onPickGifUrl: (url: string) => void;
}) {
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);
  const [emojiSearch, setEmojiSearch] = useState("");
  const [emojiCat, setEmojiCat] = useState<EmojiCatKey>("smileys");
  const [gifInput, setGifInput] = useState("");
  const [gifDebounced, setGifDebounced] = useState("");
  const [gifUrls, setGifUrls] = useState<string[]>([]);
  const [gifLoading, setGifLoading] = useState(false);
  const gifAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!open) return;
    setRecentEmojis(readRecentEmojisLs());
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
      ? `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(q)}&key=${encodeURIComponent(TENOR_API_KEY)}&limit=20&media_filter=gif`
      : `https://tenor.googleapis.com/v2/featured?key=${encodeURIComponent(TENOR_API_KEY)}&limit=20&media_filter=gif`;
    void fetch(url, { signal: ac.signal })
      .then((r) => r.json())
      .then((j) => {
        if (ac.signal.aborted) return;
        setGifUrls(parseTenorResultUrls(j));
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
      if (!q) return r;
      const hitCats = (
        Object.keys(EMOJI_CAT_TAGS) as (keyof typeof EMOJI_CAT_TAGS)[]
      ).filter((k) => EMOJI_CAT_TAGS[k].toLowerCase().includes(q));
      if (hitCats.length) {
        const set = new Set<string>();
        for (const k of hitCats) {
          for (const e of EMOJI_CATEGORIES[k] ?? []) set.add(e);
        }
        return [...set];
      }
      return r.filter((e) => e === q);
    }
    const base = EMOJI_CATEGORIES[emojiCat] ?? [];
    if (!q) return base;
    if (EMOJI_CAT_TAGS[emojiCat as Exclude<EmojiCatKey, "recent">]?.toLowerCase().includes(q))
      return base;
    const hitCats = (
      Object.keys(EMOJI_CAT_TAGS) as (keyof typeof EMOJI_CAT_TAGS)[]
    ).filter((k) => EMOJI_CAT_TAGS[k].toLowerCase().includes(q));
    if (hitCats.length) {
      const set = new Set<string>();
      for (const k of hitCats) {
        for (const e of EMOJI_CATEGORIES[k] ?? []) set.add(e);
      }
      return [...set];
    }
    return base.filter((e) => e === q);
  }, [emojiCat, emojiSearch, recentEmojis]);

  if (!open) return null;

  return (
    <div
      className="absolute bottom-full left-0 right-0 z-[210] flex flex-col border-t shadow-[0_-4px_24px_rgba(0,0,0,0.35)] animate-in slide-in-from-bottom-2 duration-200"
      style={{
        height: panelHeightPx,
        background: "#1e2a3a",
        borderColor: "rgba(255,255,255,0.1)",
      }}
      role="dialog"
      aria-label="Emoji and GIF"
    >
      <div
        className="flex shrink-0 items-center gap-1 border-b px-2 pt-1"
        style={{ borderColor: "rgba(255,255,255,0.1)" }}
      >
        {(["emoji", "gif", "stickers"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => onTabChange(k)}
            className="shrink-0 rounded-t-lg px-3 py-2 text-[13px] font-semibold"
            style={{
              background: tab === k ? "rgba(255,255,255,0.08)" : "transparent",
              color: tab === k ? "#fff" : "#8896a0",
            }}
          >
            {k === "emoji"
              ? "Emoji"
              : k === "gif"
                ? "GIF"
                : "Stickers"}
          </button>
        ))}
        <button
          type="button"
          onClick={onClose}
          className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white"
          aria-label="Close"
        >
          <X className="h-5 w-5" strokeWidth={1.5} />
        </button>
      </div>

      {tab === "stickers" ? (
        <div
          className="flex flex-1 flex-col items-center justify-center px-4 text-center"
          style={{ color: "#8896a0" }}
        >
          <p className="text-sm font-medium text-white">Coming soon</p>
          <p className="mt-1 text-xs">Sticker packs will appear here.</p>
        </div>
      ) : null}

      {tab === "emoji" ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="shrink-0 px-2 pt-2">
            <input
              value={emojiSearch}
              onChange={(e) => setEmojiSearch(e.target.value)}
              placeholder="Search emoji..."
              className="w-full rounded-lg border-0 px-3 py-2 text-sm text-white outline-none placeholder:text-[#5c6a7d]"
              style={{ background: "rgba(0,0,0,0.25)" }}
            />
          </div>
          <div
            className="flex shrink-0 gap-1 overflow-x-auto px-2 py-2"
            style={{ maxHeight: 44 }}
          >
            {EMOJI_CAT_KEYS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setEmojiCat(k)}
                className="h-9 shrink-0 rounded-lg px-2.5 text-[11px] font-semibold whitespace-nowrap"
                style={{
                  minWidth: 40,
                  background:
                    emojiCat === k ? "rgba(255,255,255,0.12)" : "transparent",
                  color: emojiCat === k ? "#fff" : "#8896a0",
                }}
              >
                {EMOJI_CAT_LABELS[k]}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-2 emoji-scrollbar">
            <div
              className="grid gap-0.5"
              style={{
                gridTemplateColumns: "repeat(8, 36px)",
                justifyContent: "center",
              }}
            >
              {emojiGrid.map((em) => (
                <button
                  key={`${emojiCat}-${em}`}
                  type="button"
                  title={em}
                  onClick={() => {
                    pushRecentEmoji(em);
                    setRecentEmojis(readRecentEmojisLs());
                    onInsertEmoji(em);
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-md text-[22px] leading-none hover:bg-white/10"
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
          <div className="shrink-0 px-2 pt-2">
            <input
              value={gifInput}
              onChange={(e) => setGifInput(e.target.value)}
              placeholder="Search GIFs..."
              className="w-full rounded-lg border-0 px-3 py-2 text-sm text-white outline-none placeholder:text-[#5c6a7d]"
              style={{ background: "rgba(0,0,0,0.25)" }}
            />
          </div>
          <div className="relative min-h-0 flex-1 overflow-y-auto px-2 pb-2 emoji-scrollbar">
            {gifLoading ? (
              <div className="flex flex-1 items-center justify-center py-12">
                <Loader2
                  className="h-8 w-8 animate-spin text-slate-400"
                  strokeWidth={1.5}
                  aria-hidden
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-1.5 pt-2">
                {gifUrls.map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => onPickGifUrl(u)}
                    className="relative overflow-hidden rounded-lg bg-black/20"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={u}
                      alt=""
                      className="h-auto w-full object-cover"
                      loading="lazy"
                    />
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

type UserMe = {
  id: string;
  email?: string | null;
  full_name: string | null;
  username?: string | null;
  /** ISO 4217, e.g. USD — used for split / currency display when present */
  preferred_currency?: string | null;
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  INR: "₹",
  JPY: "¥",
  AUD: "A$",
  CAD: "C$",
  CHF: "CHF ",
  CNY: "¥",
  KRW: "₩",
  NZD: "NZ$",
  SEK: "kr ",
  SGD: "S$",
};

function getCurrencyCodeFromUser(u: UserMe | null): string {
  const c = u?.preferred_currency?.trim();
  if (c && c.length >= 3) return c.toUpperCase().slice(0, 3);
  return "USD";
}

function getCurrencySymbolFromUser(u: UserMe | null): string {
  return CURRENCY_SYMBOLS[getCurrencyCodeFromUser(u)] ?? "$";
}

type GroupMemberOut = {
  id: string;
  user_id: string;
  full_name: string;
  avatar_url?: string | null;
  role?: string;
  last_seen?: string | number | null;
};

type GroupOut = {
  id: string;
  name: string;
  description: string | null;
  group_type?: string;
  invite_code?: string;
  created_by?: string;
  created_at?: string | number;
  members: GroupMemberOut[];
};

type TripOut = {
  id: string;
  group_id: string;
  title: string;
  description?: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  created_at?: string;
};

type ChatInfo = {
  id: string;
  name: string;
  type: "group" | "individual";
  group_id?: string;
  members: string[];
  created_by: string;
  created_at: number;
  last_message?: string;
  last_message_time?: number;
  last_message_sender?: string;
  isBot?: boolean;
  isAnnouncement?: boolean;
  isDemo?: boolean;
  demoKind?: "arjun" | "priya" | "suresh" | "self";
  demoAvatarBg?: string;
  demoInitials?: string;
  displayTime?: string;
  displayPreview?: string;
  demoUnread?: number;
  listAvatarBg?: string;
  listInitials?: string;
  /** Realtime DB `chats/{id}/metadata` for DM display (name + avatars) */
  metadata?: {
    name?: string;
    profile_picture?: string | null;
    avatar_url?: string | null;
  };
};

type UserProfileIdOut = {
  id: string;
  full_name: string;
  username: string | null;
  profile_picture?: string | null;
  avatar_url?: string | null;
};

type ChatMessage = {
  id: string;
  sender_id: string;
  sender_name?: string;
  sender_avatar?: string;
  text?: string;
  type?: string;
  timestamp: number;
  read_by?: Record<string, boolean>;
  metadata?: Record<string, unknown>;
};

type ContactPerson = {
  id: string;
  full_name: string;
  username?: string | null;
  avatar_url?: string | null;
};

type UserSearchFriendStatus =
  | "none"
  | "pending_sent"
  | "pending_received"
  | "accepted"
  | "blocked";

type UserSearchResultRow = {
  id: string;
  full_name: string;
  username: string | null;
  email?: string | null;
  profile_picture: string | null;
  avatar_url: string | null;
  friend_status: UserSearchFriendStatus;
  is_verified?: boolean;
  plan?: string;
};

/** New Group modal: search pick or “add by email” chip. */
type SelectedGroupParticipant = UserSearchResultRow & {
  isEmailInvite?: boolean;
  email?: string | null;
};

const EMAIL_INVITE_AVATAR_BG = "#0d9488";
const ADD_BY_EMAIL_ROW_BG = "#1e2538";

/** Stricter check for the “no account found — invite by email” path */
function isValidEmailFormat(s: string): boolean {
  const t = s.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

type ChatPrefs = {
  muted?: boolean;
  pinned?: boolean;
  archived?: boolean;
  favorite?: boolean;
  lastReadAt?: number;
};

/** e.g. "Traveler ac899a" from bad client defaults */
function isTravelerFragmentName(name: string | undefined | null): boolean {
  if (name == null) return false;
  return /^Traveler [a-zA-Z0-9]+$/i.test(name.trim());
}

function hasUsableContactFullName(s: string | undefined | null): boolean {
  if (s == null) return false;
  const t = s.trim();
  if (!t) return false;
  if (t === "Traveler") return false;
  if (isTravelerFragmentName(t)) return false;
  if (/^Traveler\s+/i.test(t)) return false;
  return true;
}

function dmStoredNameNeedsApiRepair(
  name: string | undefined | null,
  metaName: string | undefined | null,
): boolean {
  return (
    isTravelerFragmentName(name) ||
    isTravelerFragmentName(metaName) ||
    (name ?? "").trim() === "Traveler" ||
    (metaName ?? "").trim() === "Traveler"
  );
}

/** Shown in DM list row + header: metadata name wins over `info.name`. */
function chatRowDisplayName(c: ChatInfo): string {
  if (c.type === "group") return c.name;
  const m = c.metadata?.name?.trim();
  if (m) return m;
  return c.name;
}

function chatRowDmAvatarUrl(c: ChatInfo): string | null {
  if (c.type !== "individual") return null;
  const p = c.metadata?.profile_picture?.trim();
  if (p && !isInlineSvgDataUrlToSkipForPhoto(p) && !isLegacyDicebearUrl(p)) {
    return p;
  }
  const a = c.metadata?.avatar_url?.trim();
  if (a && !isInlineSvgDataUrlToSkipForPhoto(a) && !isLegacyDicebearUrl(a)) {
    return a;
  }
  return null;
}

function buildPeerSearchRowFromChat(
  chat: ChatInfo,
  peerId: string,
  connectionsList: UserSearchResultRow[],
): UserSearchResultRow {
  const conn = connectionsList.find((c) => c.id === peerId);
  if (conn) return conn;
  return {
    id: peerId,
    full_name: chatRowDisplayName(chat),
    username: null,
    profile_picture: chat.metadata?.profile_picture ?? null,
    avatar_url: chat.metadata?.avatar_url ?? null,
    friend_status: "accepted",
  };
}

async function resolvePeerForDm(
  other: ContactPerson,
  connections: UserSearchResultRow[],
  signal?: AbortSignal,
): Promise<{
  full_name: string;
  profile_picture: string | null;
  avatar_url: string | null;
}> {
  const fromConn = connections.find((r) => r.id === other.id);
  let fullName = "";
  let profilePicture: string | null = null;
  let avatarUrl: string | null = null;

  if (hasUsableContactFullName(other.full_name)) {
    fullName = other.full_name.trim();
    avatarUrl = other.avatar_url ?? null;
  } else if (fromConn && hasUsableContactFullName(fromConn.full_name)) {
    fullName = fromConn.full_name.trim();
    profilePicture = fromConn.profile_picture;
    avatarUrl = fromConn.avatar_url ?? fromConn.profile_picture;
  } else {
    const r = await apiFetchWithStatus<UserProfileIdOut>(`/users/${other.id}`, {
      signal,
    });
    if (r.status === 200 && r.data) {
      const fn = r.data.full_name?.trim();
      if (fn) {
        fullName = fn;
        profilePicture = r.data.profile_picture ?? null;
        avatarUrl = r.data.avatar_url ?? null;
      }
    }
  }
  if (!fullName) fullName = "Unknown";
  if (!avatarUrl && profilePicture) avatarUrl = profilePicture;
  return {
    full_name: fullName,
    profile_picture: profilePicture,
    avatar_url: avatarUrl,
  };
}

/** Smaller name label above other members' bubbles in group chat */
const BUBBLE_SENDER_CORAL = "#FF7F50";

function isInlineSvgDataUrlToSkipForPhoto(url: string): boolean {
  const u = url.trim().toLowerCase();
  return (
    u.startsWith("data:image/svg+xml;base64,") ||
    u.startsWith("data:image/svg+xml,")
  );
}

function isLegacyDicebearUrl(url: string): boolean {
  return url.toLowerCase().includes("dicebear.com");
}

/** Profile panel / list rows: use photo URL, or `null` to show initials. */
function profileOrAvatarPublicUrl(p: {
  full_name: string;
  profile_picture: string | null;
  avatar_url: string | null;
}): string | null {
  const pp = p.profile_picture?.trim();
  if (pp) return pp;
  const av = p.avatar_url?.trim();
  if (av && !isInlineSvgDataUrlToSkipForPhoto(av) && !isLegacyDicebearUrl(av)) {
    return av;
  }
  return null;
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function initFirebase(): {
  app: FirebaseApp | null;
  db: Database | null;
  ok: boolean;
} {
  if (typeof window === "undefined") {
    return { app: null, db: null, ok: false };
  }
  const hasUrl = Boolean(
    firebaseConfig.databaseURL && firebaseConfig.apiKey,
  );
  if (!hasUrl) {
    return { app: null, db: null, ok: false };
  }
  try {
    const app =
      getApps().length === 0
        ? initializeApp(firebaseConfig)
        : getApps()[0]!;
    const db = getDatabase(app);
    return { app, db, ok: true };
  } catch {
    return { app: null, db: null, ok: false };
  }
}

/** List row timestamps: "2h ago" / "Yesterday" / "Apr 20" */
function formatListTimestamp(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  if (d.toDateString() === today.toDateString()) {
    if (diff < 60000) return "now";
    if (mins < 60) return `${mins}m ago`;
    return `${hours}h ago`;
  }
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Calls tab recent row: e.g. "Outgoing · Today 3:28 AM" or "Outgoing · Apr 25" */
function formatCallsOutgoingLine(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const timeStr = d.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  if (d.toDateString() === today.toDateString()) {
    return `Outgoing · Today ${timeStr}`;
  }
  const dayPart = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `Outgoing · ${dayPart}`;
}

/** Heuristic: only then show Bluetooth-oriented copy/icons in call menu (no OS-level BT pairing API in browsers). */
function looksLikeBluetoothAudioDeviceLabel(label: string): boolean {
  if (!label.trim()) return false;
  return /bluetooth|bt\s|airpods|airpod|buds|galaxy\s|hands[- ]free|headset\s*\(|wireless|bone\s*conduction/i.test(
    label,
  );
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
    { urls: "stun:stun.relay.metered.ca:80" },
    {
      urls: "turn:standard.relay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:standard.relay.metered.ca:443",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turns:standard.relay.metered.ca:443",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ],
};

const GT_CALL_HISTORY = "gt_call_history";

type GtCallHistoryEntry = {
  user_id: string;
  user_name: string;
  call_type: "audio" | "video";
  direction: "outgoing" | "incoming" | "missed";
  duration: number;
  timestamp: number;
  status: string;
};

function readCallHistoryLs(): GtCallHistoryEntry[] {
  return readJsonLs<GtCallHistoryEntry[]>(GT_CALL_HISTORY, []);
}

function formatCallDurationFmt(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function formatCallHistorySubline(e: GtCallHistoryEntry): string {
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

function readBuddyFavourites(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const v = localStorage.getItem(GT_BUDDY_FAVOURITES);
    const p = v ? (JSON.parse(v) as unknown) : [];
    return Array.isArray(p) && p.every((x) => typeof x === "string")
      ? (p as string[])
      : [];
  } catch {
    return [];
  }
}

function addBuddyFavourite(id: string) {
  const s = new Set(readBuddyFavourites());
  s.add(id);
  localStorage.setItem(GT_BUDDY_FAVOURITES, JSON.stringify([...s]));
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i)!;
  return Math.abs(h);
}

function initialsFromName(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (p.length >= 2) return (p[0]![0]! + p[1]![0]!).toUpperCase();
  const w = p[0] ?? "?";
  return w.slice(0, 2).toUpperCase();
}

function formatDisplayNameHub(full: string | null | undefined): string {
  if (!full?.trim()) return "You";
  return full.trim();
}

function listAvatarColor(name: string): string {
  return INITIALS_AVATAR_COLORS[hashString(name) % INITIALS_AVATAR_COLORS.length]!;
}

function InitialsAvatar({
  name,
  size,
  className = "",
}: {
  name: string;
  size: 32 | 40 | 46 | 80 | 120;
  className?: string;
}) {
  const label = (name.trim() || "?").toUpperCase();
  const letter = label.charAt(0) || "?";
  const bg = listAvatarColor(name.trim() || "?");
  const textClass =
    size === 32
      ? "text-sm"
      : size === 40
        ? "text-base"
        : size === 46
          ? "text-lg"
          : size === 80
            ? "text-2xl"
            : size === 120
              ? "text-3xl"
              : "text-3xl";
  return (
    <span
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-full font-bold text-white ${textClass} ${className}`.trim()}
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        background: bg,
      }}
      aria-hidden
    >
      {letter}
    </span>
  );
}

const DEMO_CHAT_TRAVELLO_HELP: ChatInfo = {
  id: DEMO_CHAT_TRAVELLO_HELP_ID,
  name: "Travello Help",
  type: "individual",
  members: [],
  created_by: "system",
  created_at: Date.now(),
  isBot: true,
  displayTime: "now",
  displayPreview: "Hi! Ask me anything about planning your trip",
  demoUnread: 1,
};

const DEMO_CHAT_COMMUNITY: ChatInfo = {
  id: DEMO_CHAT_COMMUNITY_ID,
  name: "Community Updates",
  type: "group",
  members: [],
  created_by: "system",
  created_at: Date.now(),
  isAnnouncement: true,
  displayTime: "Apr 22",
  displayPreview: "New feature: AI trip planner is now live",
  demoUnread: 3,
  listAvatarBg: "#2563EB",
  listInitials: "CU",
};

function readJsonLs<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJsonLs(key: string, val: unknown): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {
    /* ignore */
  }
}

function parseLastSeen(v: string | number | null | undefined): number | null {
  if (v == null) return null;
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  const t = Date.parse(String(v));
  return Number.isNaN(t) ? null : t;
}

function memberOnlineRecently(
  members: GroupMemberOut[],
  selfId: string,
  windowMs = 5 * 60 * 1000,
): boolean {
  const cutoff = Date.now() - windowMs;
  for (const m of members) {
    if (m.user_id === selfId) continue;
    const t = parseLastSeen(m.last_seen ?? null);
    if (t != null && t >= cutoff) return true;
  }
  return false;
}

function dmListPeerOnline(
  u: UserMe | null,
  c: ChatInfo,
  glist: GroupOut[],
): boolean {
  if (!u || c.type !== "individual" || c.isAnnouncement) return false;
  const peer = c.members.find((m) => m !== u.id);
  if (!peer) return false;
  for (const g of glist) {
    const mems = g.members ?? [];
    if (mems.some((m) => m.user_id === peer)) {
      return memberOnlineRecently(mems, u.id);
    }
  }
  return false;
}

function getUnreadCount(chat: ChatInfo, pref: ChatPrefs | undefined): number {
  if (chat.demoUnread != null) {
    if (pref?.lastReadAt) return 0;
    return chat.demoUnread;
  }
  const t = chat.last_message_time ?? chat.created_at ?? 0;
  const readAt = pref?.lastReadAt ?? 0;
  if (t <= readAt) return 0;
  const msg = (chat.last_message ?? "").trim();
  if (!msg) return 0;
  return 1;
}

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function BotFaceIcon({ className, size = 24 }: { className?: string; size?: number }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <rect
        x="5"
        y="7"
        width="14"
        height="12"
        rx="2.5"
        fill="white"
        fillOpacity={0.95}
      />
      <circle cx="9.5" cy="12.5" r="1.2" fill="#DC2626" />
      <circle cx="14.5" cy="12.5" r="1.2" fill="#DC2626" />
      <path
        d="M10 16.5h4"
        stroke="#DC2626"
        strokeWidth={1.4}
        strokeLinecap="round"
      />
      <path
        d="M12 4.5v2M10 5.5h4"
        stroke="white"
        strokeOpacity={0.95}
        strokeWidth={1.2}
        strokeLinecap="round"
      />
    </svg>
  );
}

function shouldShowDateSeparator(
  messages: ChatMessage[],
  index: number,
): boolean {
  if (index === 0) return true;
  const curr = messages[index];
  const prev = messages[index - 1];
  if (!curr?.timestamp || !prev?.timestamp) return true;
  return (
    new Date(curr.timestamp).toDateString() !==
    new Date(prev.timestamp).toDateString()
  );
}

function getDateLabel(timestamp: number): string {
  const d = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

const WA_MSG_BG = "#f5ede4";
const WA_INCOMING_BUBBLE = "#ffffff";
const WA_OUTGOING_BUBBLE = "#fde8d8";
const BUBBLE_TEXT = "#1a1a2e";
const BUBBLE_TS = "#8896a0";
const WA_HEADER_GROUP = "#f0f2f5";
const WA_CORAL = "#4a9eff";
const WA_GREEN = "#00a884";
const WA_MUTED = "#667781";
const WA_TEXT = "#111b21";
const WA_INPUT_ROW = "#f0f2f5";
const WA_INPUT_FIELD = "#ffffff";
const WA_PATTERN =
  "radial-gradient(#b2a898 1px, transparent 1px)";

const TH_MUTED = "#9ca3af";
const TH_LABEL = "#6b7280";

function ThStatusDot({
  color,
  className,
}: {
  color: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-block shrink-0 rounded-full ${className ?? ""}`}
      style={{ width: 6, height: 6, background: color }}
      aria-hidden
    />
  );
}

function ThIconSearch({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="m21 21-4.35-4.35"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ThIconPhoneHandset({
  size = 18,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      <path
        d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.6 19.79 19.79 0 0 1 1.61 5a2 2 0 0 1 1.99-2.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 10.91a16 16 0 0 0 6 6l.92-.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ThIconVideoCam({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      <polygon
        points="23 7 16 12 23 17 23 7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x="1"
        y="5"
        width="15"
        height="14"
        rx="2"
        ry="2"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function ThIconMoreDots({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="1" fill="currentColor" />
      <circle cx="19" cy="12" r="1" fill="currentColor" />
      <circle cx="5" cy="12" r="1" fill="currentColor" />
    </svg>
  );
}

function ThIconPaperclip({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      <path
        d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ThIconSmile({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M8 13s1.5 2 4 2 4-2 4-2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line x1="9" y1="9" x2="9.01" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="15" y1="9" x2="15.01" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ThIconMicLine({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      <path
        d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19 10v2a7 7 0 0 1-14 0v-2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" strokeWidth="1.5" />
      <line x1="8" y1="23" x2="16" y2="23" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function ThIconSendPlane({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      <line x1="22" y1="2" x2="11" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <polygon
        points="22 2 15 22 11 13 2 9 22 2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ThIconUsersGroup({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      <path
        d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M23 21v-2a4 4 0 0 0-3-3.87"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 3.13a4 4 0 0 1 0 7.75"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ThIconCheckCircle({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      <path
        d="M22 11.08V12a10 10 0 1 1-5.93-9.14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <polyline
        points="22 4 12 14.01 9 11.01"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ThIconXCircle({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
      <line x1="15" y1="9" x2="9" y2="15" stroke="currentColor" strokeWidth="1.5" />
      <line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function ThIconPlane({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      <path
        d="M17.8 19.2 16 11l3.5-3.5C21 6 21 4 19 4c-2 0-3 1-4.5 2.5L11 10 2.8 8.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 15l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 4.2 7.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ThIconPlus({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      <line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ThIconChevronLeft({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      <path
        d="M15 18l-6-6 6-6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ThIconChevronRight({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      <path
        d="M9 18l6-6-6-6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ThIconLink({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      <path
        d="M10 13a5 5 0 0 1 0-7l1-1a5 5 0 0 1 7 7l-1 1M14 11a5 5 0 0 1 0 7l-1 1a5 5 0 0 1-7-7l1-1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ThIconPin({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      <path
        d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function ThIconZap({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      <path
        d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ThIconMail({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="m22 6-10 7L2 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function getGroupWaDateLabel(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function daysDiff(a: Date, b: Date): number {
  return Math.max(
    0,
    Math.round((a.getTime() - b.getTime()) / 86400000),
  );
}

function formatTripHeaderDates(t: TripOut): string {
  const a = t.start_date
    ? new Date(t.start_date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : "—";
  const b = t.end_date
    ? new Date(t.end_date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : "—";
  return `${a} \u2013 ${b}`;
}

function groupTripStatusPill(t: TripOut): {
  bg: string;
  text: string;
  dotColor: string;
} {
  const st = String(t.status || "").toLowerCase();
  const now = new Date();
  if (st === "ongoing" && t.end_date) {
    const d = daysDiff(new Date(t.end_date), now);
    return {
      bg: "rgba(29, 158, 117, 0.25)",
      text: `ONGOING \u00b7 ${d} day${d === 1 ? "" : "s"} to go`,
      dotColor: "#1d9e75",
    };
  }
  if ((st === "planning" || st === "confirmed") && t.start_date) {
    const d = daysDiff(new Date(t.start_date), now);
    return {
      bg: "rgba(59, 130, 246, 0.2)",
      text: `UPCOMING \u00b7 starts in ${d} day${d === 1 ? "" : "s"}`,
      dotColor: "#60a5fa",
    };
  }
  if (st === "completed" || st === "cancelled") {
    return {
      bg: "rgba(107, 114, 128, 0.25)",
      text: "COMPLETED",
      dotColor: "#9ca3af",
    };
  }
  return {
    bg: "rgba(107, 114, 128, 0.25)",
    text: t.status || "\u2014",
    dotColor: "#9ca3af",
  };
}

function groupReadReceipt(
  msg: ChatMessage,
  me: string,
): "sent" | "delivered" | "read" {
  const rb = msg.read_by || {};
  const otherReaders = Object.keys(rb).filter((k) => k !== me && rb[k]);
  if (otherReaders.length > 0) return "read";
  return "delivered";
}

function SwipeChatRow({
  children,
  leftActions,
  rightActions,
}: {
  children: ReactNode;
  leftActions: { label: string; bg: string; onClick: () => void }[];
  rightActions: { label: string; bg: string; onClick: () => void }[];
}) {
  const [dx, setDx] = useState(0);
  const [touching, setTouching] = useState(false);
  const startX = useRef(0);
  const originDx = useRef(0);
  const dxLive = useRef(0);
  const w = 64;
  const maxL = leftActions.length * w;
  const maxR = rightActions.length * w;

  const snap = useCallback(
    (x: number) => {
      if (x > 40 && maxL) setDx(maxL);
      else if (x < -40 && maxR) setDx(-maxR);
      else setDx(0);
    },
    [maxL, maxR],
  );

  return (
    <div
      className="relative overflow-hidden"
      style={{ background: "#ffffff" }}
    >
      <div
        className="absolute inset-y-0 left-0 z-0 flex"
        style={{ width: maxL || undefined }}
      >
        {leftActions.map((a, i) => (
          <button
            key={i}
            type="button"
            onClick={() => {
              a.onClick();
              setDx(0);
            }}
            className="flex shrink-0 items-center justify-center px-1 text-[11px] font-semibold text-white"
            style={{ width: w, background: a.bg }}
          >
            {a.label}
          </button>
        ))}
      </div>
      <div
        className="absolute inset-y-0 right-0 z-0 flex flex-row-reverse"
        style={{ width: maxR || undefined }}
      >
        {rightActions.map((a, i) => (
          <button
            key={i}
            type="button"
            onClick={() => {
              a.onClick();
              setDx(0);
            }}
            className="flex shrink-0 items-center justify-center px-1 text-[11px] font-semibold text-white"
            style={{ width: w, background: a.bg }}
          >
            {a.label}
          </button>
        ))}
      </div>
      <div
        className="relative z-10"
        style={{
          transform: `translateX(${dx}px)`,
          transition: touching ? "none" : "transform 0.2s ease-out",
          background: "#ffffff",
        }}
        onTouchStart={(e) => {
          setTouching(true);
          startX.current = e.touches[0]?.clientX ?? 0;
          originDx.current = dx;
          dxLive.current = dx;
        }}
        onTouchMove={(e) => {
          const x = e.touches[0]?.clientX ?? 0;
          let ndx = originDx.current + (x - startX.current);
          if (ndx > maxL) ndx = maxL;
          if (ndx < -maxR) ndx = -maxR;
          dxLive.current = ndx;
          setDx(ndx);
        }}
        onTouchEnd={() => {
          setTouching(false);
          snap(dxLive.current);
        }}
      >
        {children}
      </div>
    </div>
  );
}

function HubSearchField({
  value,
  onChange,
  placeholder = "Search chats...",
  tone = "dark",
}: {
  value: string;
  onChange: (v: string) => void;
  /** @default "Search chats..." */
  placeholder?: string;
  tone?: "dark" | "light";
}) {
  const isLight = tone === "light";
  return (
    <div className="shrink-0 px-4 py-2">
      <div
        className="flex items-center gap-2 rounded-full border px-3 py-2"
        style={{
          background: isLight ? "#f3f4f6" : "#152030",
          borderColor: isLight ? "#e5e7eb" : "#2a3a50",
        }}
      >
        <span style={{ color: isLight ? LIST_TEXT_MUTED : TEXT_MUTED }} aria-hidden>
          <Search className="h-5 w-5 opacity-80" strokeWidth={1.5} />
        </span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-gray-400"
          style={{
            color: isLight ? LIST_TEXT : TEXT,
          }}
        />
        {value ? (
          <button
            type="button"
            aria-label="Clear search"
            className="text-lg leading-none"
            style={{ color: isLight ? LIST_TEXT_MUTED : TEXT_MUTED }}
            onClick={() => onChange("")}
          >
            ×
          </button>
        ) : null}
      </div>
    </div>
  );
}

function ChatListRow72({
  active,
  onClick,
  avatar,
  name,
  preview,
  time,
  unread,
  muted,
}: {
  active: boolean;
  onClick: () => void;
  avatar: ReactNode;
  name: string;
  preview: string;
  time: string;
  unread: number;
  muted?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full cursor-pointer items-center gap-3 border-b px-4 text-left transition-colors duration-150"
      style={{
        height: 72,
        borderBottom: `1px solid ${LIST_BORDER}`,
        background: active ? LIST_ROW_SELECTED : "transparent",
      }}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLButtonElement).style.background = LIST_ROW_HOVER;
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLButtonElement).style.background = "transparent";
      }}
    >
      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center">
        {avatar}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="min-w-0 truncate text-[14px] font-medium"
            style={{ color: active ? "#ffffff" : LIST_TEXT }}
          >
            {name}
            {muted ? (
              <span
                className="ml-1 inline-flex items-center"
                style={{ color: active ? "rgba(255,255,255,0.72)" : "#64748b" }}
                title="Muted"
              >
                <BellOff className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
              </span>
            ) : null}
          </span>
          <span
            className="ml-auto shrink-0 text-[11px]"
            style={{ color: active ? "rgba(255,255,255,0.72)" : LIST_TEXT_MUTED }}
          >
            {time}
          </span>
        </div>
        <div className="mt-0.5 flex min-w-0 items-center gap-2">
          <p
            className="min-w-0 flex-1 truncate text-[13px]"
            style={{
              color: active ? "rgba(255,255,255,0.82)" : LIST_TEXT_MUTED,
              maxWidth: "calc(100% - 32px)",
            }}
          >
            {preview}
          </p>
          {unread > 0 ? (
            <span
              className="flex h-[18px] w-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
              style={{ background: muted ? TEXT_MUTED : BRAND_ACCENT }}
            >
              {unread > 99 ? "99+" : unread}
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}

function HubChatsTab({
  groups,
  user,
  mainChatList,
  activeChatId,
  chatPrefs,
  onSelectChat,
  onNavigateToGroup,
  updateChatPref,
  markChatDeleted,
  showToast,
  setContextMenu,
  longPressTimerRef,
}: {
  groups: GroupOut[];
  user: UserMe | null;
  mainChatList: ChatInfo[];
  activeChatId?: string;
  chatPrefs: Record<string, ChatPrefs>;
  onSelectChat: (c: ChatInfo) => void;
  onNavigateToGroup: (groupId: string) => void;
  updateChatPref: (id: string, p: Partial<ChatPrefs>) => void;
  markChatDeleted: (id: string) => void;
  showToast: (m: string, t?: "success" | "error") => void;
  setContextMenu: (v: { x: number; y: number; chat: ChatInfo } | null) => void;
  longPressTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
}) {
  const demosAlways = [DEMO_CHAT_TRAVELLO_HELP, DEMO_CHAT_COMMUNITY];
  const syntheticGroupChats: ChatInfo[] = useMemo(() => {
    if (!user) return [];
    return groups
      .filter(
        (g) =>
          !mainChatList.some(
            (c) =>
              c.type === "group" &&
              (c.group_id === g.id || c.id === `group_${g.id}`),
          ),
      )
      .map((g) => {
        const ids = (g.members ?? []).map((m) => m.user_id);
        return {
          id: `group_${g.id}`,
          name: g.name,
          type: "group" as const,
          group_id: g.id,
          members: ids.length > 0 ? ids : [user.id],
          created_by: user.id,
          created_at: Date.now(),
          last_message_time: 0,
          last_message: "",
        } satisfies ChatInfo;
      });
  }, [groups, mainChatList, user]);

  const mergedFlat = useMemo(() => {
    const skipDemo = new Set<string>([
      DEMO_CHAT_TRAVELLO_HELP.id,
      DEMO_CHAT_COMMUNITY.id,
    ]);
    const list = mainChatList.filter((c) => !skipDemo.has(c.id));
    const comb = [...list, ...syntheticGroupChats];
    const sorted = [...comb].sort((a, b) => {
      const pa = chatPrefs[a.id]?.pinned ? 1 : 0;
      const pb = chatPrefs[b.id]?.pinned ? 1 : 0;
      if (pb !== pa) return pb - pa;
      return (
        (b.last_message_time ?? b.created_at ?? 0) -
        (a.last_message_time ?? a.created_at ?? 0)
      );
    });
    return sorted;
  }, [mainChatList, syntheticGroupChats, chatPrefs]);

  const openContext = (chat: ChatInfo, clientX: number, clientY: number) => {
    setContextMenu({ x: clientX, y: clientY, chat });
  };

  const startLongPress = (chat: ChatInfo, ex: number, ey: number) => {
    if (chat.isBot || chat.isAnnouncement) return;
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      openContext(chat, ex, ey);
      longPressTimerRef.current = null;
    }, 500);
  };

  const clearLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const renderAvatar = (c: ChatInfo) => {
    if (c.isBot) {
      return (
        <span
          className="flex h-10 w-10 items-center justify-center rounded-full"
          style={{ background: ACCENT }}
        >
          <BotFaceIcon size={24} />
        </span>
      );
    }
    const rowLabel = chatRowDisplayName(c);
    const isGroup = c.type === "group";
    const gMeta = c.group_id
      ? groups.find((g) => g.id === c.group_id)
      : undefined;
    const onlineDm = user
      ? dmListPeerOnline(user, c, groups)
      : false;
    const dmAv = !isGroup ? chatRowDmAvatarUrl(c) : null;
    if (dmAv) {
      return (
        <div className="relative">
          <img
            src={dmAv}
            alt=""
            className="h-10 w-10 rounded-full object-cover"
            width={40}
            height={40}
          />
          {onlineDm ? (
            <span
              className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-white"
              style={{ background: ONLINE }}
            />
          ) : null}
        </div>
      );
    }
    if (!isGroup) {
      return (
        <div className="relative">
          <InitialsAvatar name={rowLabel} size={40} />
          {onlineDm ? (
            <span
              className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-white"
              style={{ background: ONLINE }}
            />
          ) : null}
        </div>
      );
    }
    return (
      <div className="relative">
        <InitialsAvatar name={rowLabel} size={40} />
        <span
          className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-white/10"
          style={{ background: BG, color: TEXT_MUTED }}
          aria-hidden
        >
          <Users className="h-2 w-2" strokeWidth={2.5} />
        </span>
      </div>
    );
  };

  const rowInner = (c: ChatInfo) => {
    const pref = chatPrefs[c.id];
    const unread = getUnreadCount(c, pref);
    const t = c.last_message_time ?? c.created_at ?? Date.now();
    let preview: string;
    if (c.displayPreview != null) {
      preview = c.displayPreview;
    } else {
      const raw = (c.last_message ?? "").trim();
      preview = raw
        ? `${c.type === "group" && c.last_message_sender ? `${c.last_message_sender}: ` : ""}${c.last_message ?? ""}`
        : "No messages yet — say hello!";
    }
    const timeStr =
      c.displayTime ?? formatListTimestamp(t);

    const isSyntheticGroupRow =
      c.type === "group" &&
      c.group_id &&
      !mainChatList.some((m) => m.id === c.id);
    const onRowActivate = () => {
      if (isSyntheticGroupRow && c.group_id) {
        onNavigateToGroup(c.group_id);
        return;
      }
      onSelectChat(c);
    };

    return (
      <ChatListRow72
        active={activeChatId === c.id}
        onClick={onRowActivate}
        avatar={renderAvatar(c)}
        name={chatRowDisplayName(c)}
        preview={preview}
        time={timeStr}
        unread={unread}
        muted={pref?.muted}
      />
    );
  };

  const wrapSwipe = (c: ChatInfo, inner: ReactNode) => {
    if (c.isBot || c.isAnnouncement) {
      return <li key={c.id}>{inner}</li>;
    }
    return (
      <li key={c.id}>
        <SwipeChatRow
          leftActions={[
            {
              label: "Read",
              bg: "#475569",
              onClick: () =>
                updateChatPref(c.id, { lastReadAt: Date.now() }),
            },
            {
              label: "Pin",
              bg: "#0369A1",
              onClick: () =>
                updateChatPref(c.id, {
                  pinned: !chatPrefs[c.id]?.pinned,
                }),
            },
          ]}
          rightActions={[
            {
              label: "Mute",
              bg: "#7F1D1D",
              onClick: () =>
                updateChatPref(c.id, {
                  muted: !chatPrefs[c.id]?.muted,
                }),
            },
            {
              label: "Archive",
              bg: "#44403C",
              onClick: () => updateChatPref(c.id, { archived: true }),
            },
            {
              label: "Delete",
              bg: "#DC2626",
              onClick: () => {
                markChatDeleted(c.id);
                showToast("Chat removed from this device", "success");
              },
            },
          ]}
        >
          <div
            onTouchStart={(e) => {
              const touch = e.touches[0];
              if (touch) startLongPress(c, touch.clientX, touch.clientY);
            }}
            onTouchEnd={clearLongPress}
            onTouchMove={clearLongPress}
            onContextMenu={(e) => {
              e.preventDefault();
              openContext(c, e.clientX, e.clientY);
            }}
          >
            {inner}
          </div>
        </SwipeChatRow>
      </li>
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <ul className="m-0 min-h-0 flex-1 list-none custom-scrollbar overflow-y-auto pb-24 p-0">
        {demosAlways.map((c) =>
          wrapSwipe(
            c,
            <div key={c.id} className="block w-full">
              {rowInner(c)}
            </div>,
          ),
        )}
        {mergedFlat.map((c) =>
          wrapSwipe(
            c,
            <div key={c.id} className="block w-full">
              {rowInner(c)}
            </div>,
          ),
        )}
        {mergedFlat.length === 0 ? (
          <li
            className="list-none px-4 py-8 text-center text-sm"
            style={{ color: LIST_TEXT_MUTED }}
          >
            No other conversations yet — use search to find people and groups
          </li>
        ) : null}
      </ul>
    </div>
  );
}

/** Trim; if the query starts with `@`, strip it so the API searches username without the prefix. */
function normalizeConnectUserSearchQuery(raw: string): string {
  const t = raw.trim();
  return t.startsWith("@") ? t.slice(1) : t;
}

/** Secondary line: `@username · email` (omit missing pieces). */
function formatUserSearchMeta(u: UserSearchResultRow): string {
  const un = u.username?.trim();
  const at = un ? (un.startsWith("@") ? un : `@${un}`) : null;
  const e = u.email?.trim();
  const parts: string[] = [];
  if (at) parts.push(at);
  if (e) parts.push(e);
  return parts.length ? parts.join(" · ") : " ";
}

function HubGroupsTab({
  searchQuery,
  onSearchChange,
  groups,
  user,
  groupsOnlyList,
  activeChatId,
  chatPrefs,
  onSelectChat,
  reloadGroups,
  onGroupCreated,
  onUnauthorized,
  updateChatPref,
  markChatDeleted,
  showToast,
  setContextMenu,
  longPressTimerRef,
  masterAbortRef,
  listHidden,
  openCreateRequestId,
}: {
  searchQuery: string;
  onSearchChange: (v: string) => void;
  groups: GroupOut[];
  user: UserMe | null;
  groupsOnlyList: ChatInfo[];
  activeChatId?: string;
  chatPrefs: Record<string, ChatPrefs>;
  onSelectChat: (c: ChatInfo) => void;
  reloadGroups: () => Promise<GroupOut[] | null>;
  onGroupCreated: (group: GroupOut) => void;
  onUnauthorized: () => void;
  updateChatPref: (id: string, p: Partial<ChatPrefs>) => void;
  markChatDeleted: (id: string) => void;
  showToast: (m: string, t?: "success" | "error") => void;
  setContextMenu: (v: { x: number; y: number; chat: ChatInfo } | null) => void;
  longPressTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  masterAbortRef: MutableRefObject<AbortController | null>;
  listHidden?: boolean;
  openCreateRequestId?: number;
}) {
  const MODAL_CREATE_BG = "#1a1f35";
  const [createOpen, setCreateOpen] = useState(false);
  const [createStep, setCreateStep] = useState(1);
  const [participantQuery, setParticipantQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserSearchResultRow[]>(
    [],
  );
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<
    SelectedGroupParticipant[]
  >([]);
  const [groupKind, setGroupKind] = useState<"regular" | "travel">("regular");
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDesc, setNewGroupDesc] = useState("");
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const createSearchSeq = useRef(0);

  const resetCreateGroupModal = useCallback(() => {
    setCreateStep(1);
    setParticipantQuery("");
    setSearchResults([]);
    setSearchLoading(false);
    setSelectedMembers([]);
    setGroupKind("regular");
    setNewGroupName("");
    setNewGroupDesc("");
    setPhotoPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  useEffect(() => {
    if (openCreateRequestId == null || openCreateRequestId < 1) return;
    resetCreateGroupModal();
    setCreateOpen(true);
  }, [openCreateRequestId, resetCreateGroupModal]);

  useEffect(() => {
    if (!createOpen || createStep !== 1) return;
    const q = participantQuery.trim();
    if (q.length < 1) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    const timer = setTimeout(() => {
      const seq = ++createSearchSeq.current;
      void (async () => {
        setSearchLoading(true);
        try {
          const res = await apiFetchWithStatus<UserSearchResultRow[]>(
            `/users/search?q=${encodeURIComponent(normalizeConnectUserSearchQuery(q))}&limit=20`,
            { signal: masterAbortRef.current?.signal },
          );
          if (createSearchSeq.current !== seq) return;
          if (res.status === 401) {
            onUnauthorized();
            return;
          }
          const rows = Array.isArray(res.data) ? res.data : [];
          setSearchResults(
            user
              ? rows.filter(
                  (r) => String(r.id) !== String(user.id),
                )
              : rows,
          );
        } catch {
          if (createSearchSeq.current === seq) setSearchResults([]);
        } finally {
          if (createSearchSeq.current === seq) setSearchLoading(false);
        }
      })();
    }, 400);
    return () => clearTimeout(timer);
  }, [
    participantQuery,
    createOpen,
    createStep,
    user,
    onUnauthorized,
    masterAbortRef,
  ]);

  const requestCloseCreateModal = useCallback(() => {
    if (creating) return;
    if (selectedMembers.length > 0) {
      if (!window.confirm("Discard group?")) return;
    }
    setCreateOpen(false);
    resetCreateGroupModal();
  }, [creating, selectedMembers.length, resetCreateGroupModal]);

  const selectedIdSet = useMemo(
    () => new Set(selectedMembers.map((m) => m.id)),
    [selectedMembers],
  );

  const addEmailByInvite = useCallback(() => {
    const t = participantQuery.trim();
    if (!isValidEmailFormat(t) || selectedIdSet.has(t)) return;
    setSelectedMembers((prev) => {
      if (prev.some((m) => m.isEmailInvite && m.email === t)) return prev;
      const row: SelectedGroupParticipant = {
        id: t,
        full_name: t,
        email: t,
        username: null,
        profile_picture: null,
        avatar_url: null,
        friend_status: "none",
        isEmailInvite: true,
      };
      return [...prev, row];
    });
    setParticipantQuery("");
  }, [participantQuery, selectedIdSet]);

  const addParticipant = (row: UserSearchResultRow) => {
    if (selectedIdSet.has(row.id)) return;
    setSelectedMembers((prev) => [...prev, row as SelectedGroupParticipant]);
  };

  const removeParticipant = (id: string) => {
    setSelectedMembers((prev) => prev.filter((m) => m.id !== id));
  };

  const handleCreateGroup = useCallback(async () => {
    console.log("handleCreateGroup called", {
      newGroupName,
      selectedGroupType: groupKind,
      selectedMembers,
    });

    if (!newGroupName.trim()) {
      alert("Please enter a group name");
      return;
    }

    setCreating(true);

    const fetchSignal = masterAbortRef.current?.signal;
    try {
      const token = localStorage.getItem("gt_token");

      const createRes = await fetchWithTimeout(
        "http://localhost:8000/api/v1/groups",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: newGroupName.trim(),
            description: newGroupDesc.trim() || undefined,
            group_type: groupKind,
          }),
          signal: fetchSignal,
        },
      );

      if (!createRes.ok) {
        const err = await createRes.text();
        console.error("Create group failed:", createRes.status, err);
        alert(`Failed to create group: ${createRes.status}`);
        setCreating(false);
        return;
      }

      const newGroup = (await createRes.json()) as GroupOut;
      console.log("Group created:", newGroup);

      const realMembers = selectedMembers.filter((m) => !m.isEmailInvite);
      const authHeaders: HeadersInit = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };
      let invitesSent = 0;
      for (const member of realMembers) {
        try {
          const inv = await fetchWithTimeout(
            `http://localhost:8000/api/v1/invitations/group/${newGroup.id}/invite`,
            {
              method: "POST",
              headers: authHeaders,
              body: JSON.stringify({ user_id: member.id }),
              signal: fetchSignal,
            },
          );
          if (inv.ok) invitesSent += 1;
        } catch (e) {
          if (isAbortError(e)) {
            return;
          }
          /* skip */
        }
      }

      setCreateOpen(false);
      setNewGroupName("");
      setNewGroupDesc("");
      setSelectedMembers([]);
      setGroupKind("regular");
      setCreateStep(1);
      setPhotoPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });

      const list = await reloadGroups();
      const enriched =
        list?.find((g) => g.id === newGroup.id) ?? newGroup;
      onGroupCreated(enriched);

      if (realMembers.length === 0) {
        alert("Group created! Share the invite code to add members.");
      } else {
        alert(
          invitesSent === 1
            ? "Group created! Invitations sent to 1 member."
            : `Group created! Invitations sent to ${invitesSent} members.`,
        );
      }
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }
      console.error("Create group error:", error);
      alert("Something went wrong. Please try again.");
    } finally {
      setCreating(false);
    }
  }, [
    newGroupName,
    newGroupDesc,
    groupKind,
    selectedMembers,
    reloadGroups,
    onGroupCreated,
    masterAbortRef,
  ]);

  const participantTrim = participantQuery.trim();
  const showAddByEmailRow =
    !searchLoading &&
    searchResults.length === 0 &&
    participantTrim.length > 0 &&
    isValidEmailFormat(participantTrim) &&
    !selectedIdSet.has(participantTrim);

  const q = searchQuery.trim().toLowerCase();
  const filtered = q
    ? groupsOnlyList.filter((c) => c.name?.toLowerCase().includes(q))
    : groupsOnlyList;

  const openContext = (chat: ChatInfo, clientX: number, clientY: number) => {
    setContextMenu({ x: clientX, y: clientY, chat });
  };

  const startLongPress = (chat: ChatInfo, ex: number, ey: number) => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      openContext(chat, ex, ey);
      longPressTimerRef.current = null;
    }, 500);
  };

  const clearLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  return (
    <>
      {!listHidden ? (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <HubSearchField value={searchQuery} onChange={onSearchChange} />
      <ul className="m-0 min-h-0 flex-1 list-none custom-scrollbar overflow-y-auto p-0 pb-14">
        {filtered.map((c) => {
          const gMeta = c.group_id
            ? groups.find((g) => g.id === c.group_id)
            : undefined;
          const online =
            user && gMeta
              ? memberOnlineRecently(gMeta.members ?? [], user.id)
              : false;
          const pref = chatPrefs[c.id];
          const unread = getUnreadCount(c, pref);
          const t = c.last_message_time ?? c.created_at ?? Date.now();
          const raw = (c.last_message ?? "").trim();
          const preview = raw
            ? `${c.last_message_sender ? `${c.last_message_sender}: ` : ""}${c.last_message ?? ""}`
            : "No messages yet — say hello!";
          const avatar = (
            <div className="relative">
              <span
                className="flex h-12 w-12 items-center justify-center rounded-full text-[15px] font-bold text-white"
                style={{
                  background: gMeta
                    ? listAvatarColor(gMeta.name)
                    : listAvatarColor(c.name),
                }}
              >
                {initialsFromName(c.name)}
              </span>
              {online ? (
                <span
                  className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-[#0F172A]"
                  style={{ background: ONLINE }}
                />
              ) : null}
            </div>
          );
          const row = (
            <ChatListRow72
              active={activeChatId === c.id}
              onClick={() => onSelectChat(c)}
              avatar={avatar}
              name={c.name}
              preview={preview}
              time={formatListTimestamp(t)}
              unread={unread}
              muted={pref?.muted}
            />
          );
          return (
            <li key={c.id} className="list-none">
              <SwipeChatRow
                leftActions={[
                  {
                    label: "Read",
                    bg: "#475569",
                    onClick: () =>
                      updateChatPref(c.id, { lastReadAt: Date.now() }),
                  },
                  {
                    label: "Pin",
                    bg: "#0369A1",
                    onClick: () =>
                      updateChatPref(c.id, {
                        pinned: !chatPrefs[c.id]?.pinned,
                      }),
                  },
                ]}
                rightActions={[
                  {
                    label: "Mute",
                    bg: "#7F1D1D",
                    onClick: () =>
                      updateChatPref(c.id, {
                        muted: !chatPrefs[c.id]?.muted,
                      }),
                  },
                  {
                    label: "Archive",
                    bg: "#44403C",
                    onClick: () =>
                      updateChatPref(c.id, { archived: true }),
                  },
                  {
                    label: "Delete",
                    bg: "#DC2626",
                    onClick: () => {
                      markChatDeleted(c.id);
                      showToast("Chat removed from this device", "success");
                    },
                  },
                ]}
              >
                <div
                  onTouchStart={(e) => {
                    const touch = e.touches[0];
                    if (touch) startLongPress(c, touch.clientX, touch.clientY);
                  }}
                  onTouchEnd={clearLongPress}
                  onTouchMove={clearLongPress}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    openContext(c, e.clientX, e.clientY);
                  }}
                >
                  {row}
                </div>
              </SwipeChatRow>
            </li>
          );
        })}
      </ul>
      {filtered.length === 0 ? (
        <p
          className="px-4 py-8 text-center text-sm"
          style={{ color: TEXT_MUTED }}
        >
          No group chats yet
        </p>
      ) : null}
    </div>
      ) : null}
      {createOpen ? (
        <div
          className="fixed inset-0 z-[600] flex items-end justify-center sm:items-center sm:p-6"
          style={{ background: "rgba(0,0,0,0.65)" }}
          role="presentation"
          onClick={() => {
            if (!creating) requestCloseCreateModal();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="hub-create-group-title"
            className="box-border w-full max-w-md overflow-hidden rounded-t-2xl border shadow-2xl sm:rounded-2xl"
            style={{
              background: MODAL_CREATE_BG,
              borderColor: MSG_BORDER,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2 border-b border-slate-600/50 px-4 py-3">
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex justify-center gap-2">
                  {([1, 2, 3] as const).map((i) => {
                    const done = createStep > i;
                    const active = createStep === i;
                    return (
                      <span
                        key={i}
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={
                          active
                            ? { background: ACCENT }
                            : done
                              ? {
                                  border: `2px solid ${ACCENT}`,
                                  background: "transparent",
                                }
                              : { background: "#475569" }
                        }
                      />
                    );
                  })}
                </div>
                <p
                  className="mt-1.5 text-center text-[11px]"
                  style={{ color: TEXT_MUTED }}
                >
                  {createStep === 1
                    ? "Step 1 of 3 — Add Participants"
                    : createStep === 2
                      ? "Step 2 of 3 — Group Type"
                      : "Step 3 of 3 — Group Details"}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                disabled={creating}
                onClick={() => requestCloseCreateModal()}
                className="shrink-0 rounded-full p-1 text-slate-400 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-hidden px-4 pb-4 pt-1">
              <h2
                id="hub-create-group-title"
                className="text-center text-lg font-semibold text-white"
              >
                {createStep === 1
                  ? "Add Participants"
                  : createStep === 2
                    ? "What kind of group is this?"
                    : "Name your group"}
              </h2>

              <div className="relative mt-2 min-h-[min(50vh,320px)] sm:min-h-[300px]">
                {createStep === 1 ? (
                  <div className="box-border w-full min-w-0 px-0.5 pr-2">
                    {selectedMembers.length > 0 ? (
                      <div className="mb-3 max-h-24 flex-wrap gap-1.5 custom-scrollbar overflow-y-auto">
                        <div className="flex flex-wrap gap-1.5">
                          {selectedMembers.map((m) => (
                            <div
                              key={m.id}
                              className="inline-flex max-w-full items-center gap-1 rounded-full border py-0.5 pl-1 pr-0.5"
                              style={{
                                borderColor: MSG_BORDER,
                                background: "rgba(255,255,255,0.05)",
                              }}
                            >
                              {m.isEmailInvite ? (
                                <span
                                  className="flex h-6 w-6 items-center justify-center rounded-full text-white"
                                  style={{ background: EMAIL_INVITE_AVATAR_BG }}
                                  aria-hidden
                                >
                                  <ThIconMail size={12} className="text-white" />
                                </span>
                              ) : (
                                <span
                                  className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white"
                                  style={{
                                    background: listAvatarColor(m.full_name),
                                  }}
                                >
                                  {initialsFromName(m.full_name)}
                                </span>
                              )}
                              <span className="max-w-[120px] truncate text-xs text-slate-200">
                                {m.full_name}
                              </span>
                              <button
                                type="button"
                                aria-label={`Remove ${m.full_name}`}
                                onClick={() => removeParticipant(m.id)}
                                className="rounded-full p-0.5 text-slate-400 hover:bg-white/10 hover:text-white"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    <input
                      value={participantQuery}
                      onChange={(e) => setParticipantQuery(e.target.value)}
                      placeholder="Search by name or email..."
                      className="w-full rounded-xl border px-3 py-2.5 text-[15px] text-white outline-none placeholder:text-slate-500"
                      style={{
                        background: BG,
                        borderColor: MSG_BORDER,
                      }}
                    />
                    <div
                      className="mt-2 min-h-[180px] custom-scrollbar overflow-y-auto rounded-xl border p-0.5"
                      style={{
                        background: BG,
                        borderColor: MSG_BORDER,
                      }}
                    >
                      {participantQuery.trim().length < 1 ? (
                        <p
                          className="px-3 py-4 text-center text-sm"
                          style={{ color: TEXT_MUTED }}
                        >
                          Type to find people
                        </p>
                      ) : searchLoading ? (
                        <p
                          className="px-3 py-4 text-center text-sm"
                          style={{ color: TEXT_MUTED }}
                        >
                          Searching…
                        </p>
                      ) : !showAddByEmailRow && searchResults.length === 0 ? (
                        <p
                          className="px-3 py-4 text-center text-sm"
                          style={{ color: TEXT_MUTED }}
                        >
                          No results
                        </p>
                      ) : (
                        <ul className="m-0 list-none p-0">
                          {searchResults.map((row) => {
                            const selected = selectedIdSet.has(row.id);
                            return (
                              <li key={row.id} className="list-none">
                                <button
                                  type="button"
                                  disabled={selected}
                                  onClick={() => addParticipant(row)}
                                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition hover:bg-white/5 disabled:cursor-default"
                                >
                                  <span
                                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white"
                                    style={{
                                      background: listAvatarColor(
                                        row.full_name,
                                      ),
                                    }}
                                  >
                                    {initialsFromName(row.full_name)}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <div className="truncate text-[15px] text-white">
                                      {row.full_name}
                                    </div>
                                    <div
                                      className="truncate text-xs"
                                      style={{ color: TEXT_MUTED }}
                                    >
                                      {formatUserSearchMeta(row)}
                                    </div>
                                  </div>
                                  {selected ? (
                                    <span
                                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                                      style={{
                                        background: "rgba(34,197,94,0.2)",
                                        color: "#4ADE80",
                                      }}
                                    >
                                      <Check className="h-4 w-4" />
                                    </span>
                                  ) : null}
                                </button>
                              </li>
                            );
                          })}
                          {showAddByEmailRow ? (
                            <li
                              key="__add_by_email"
                              className="list-none p-0.5"
                            >
                              <div
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") addEmailByInvite();
                                }}
                                onClick={addEmailByInvite}
                                className="flex w-full cursor-pointer items-center gap-2 rounded-lg border border-dashed px-2 py-2.5 text-left transition hover:opacity-95"
                                style={{
                                  borderColor: "#475569",
                                  background: ADD_BY_EMAIL_ROW_BG,
                                }}
                              >
                                <span
                                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white"
                                  style={{ background: EMAIL_INVITE_AVATAR_BG }}
                                  aria-hidden
                                >
                                  <ThIconMail size={18} className="text-white" />
                                </span>
                                <div className="min-w-0 flex-1">
                                  <div
                                    className="text-[15px] leading-snug text-white"
                                    style={{ wordBreak: "break-word" }}
                                  >
                                    No account found — invite {participantTrim}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    addEmailByInvite();
                                  }}
                                  className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
                                  style={{ background: ACCENT }}
                                >
                                  Add
                                </button>
                              </div>
                            </li>
                          ) : null}
                        </ul>
                      )}
                    </div>
                    <p
                      className="mt-3 text-center text-sm"
                      style={{ color: TEXT_MUTED }}
                    >
                      {selectedMembers.length === 0
                        ? "No participants selected yet"
                        : selectedMembers.length === 1
                          ? "1 participant selected"
                          : `${selectedMembers.length} participants selected`}
                    </p>
                    <div className="mt-2 flex flex-col items-center gap-2">
                      <button
                        type="button"
                        disabled={selectedMembers.length === 0}
                        onClick={() => setCreateStep(2)}
                        className="h-11 w-full rounded-xl text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                        style={{ background: ACCENT }}
                      >
                        <span className="inline-flex w-full items-center justify-center gap-1.5">
                          Next
                          <ThIconChevronRight size={18} className="text-white" />
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setCreateStep(2)}
                        className="text-xs font-medium"
                        style={{ color: TEXT_MUTED }}
                      >
                        Skip
                      </button>
                    </div>
                  </div>
                ) : null}
                {createStep === 2 ? (
                  <div className="box-border w-full min-w-0 px-0.5 pr-2">
                    <div className="mt-1 flex min-h-[280px] flex-col gap-3 sm:flex-row sm:min-h-[240px]">
                      <button
                        type="button"
                        onClick={() => setGroupKind("regular")}
                        className="flex min-h-[120px] flex-1 flex-col rounded-2xl border-2 p-3 text-left transition"
                        style={
                          groupKind === "regular"
                            ? {
                                borderColor: ACCENT,
                                background: "rgba(220, 38, 38, 0.12)",
                              }
                            : {
                                borderColor: MSG_BORDER,
                                background: "rgba(255,255,255,0.04)",
                              }
                        }
                      >
                        <MessageCircle className="h-7 w-7 text-white" strokeWidth={1.5} aria-hidden />
                        <span className="mt-1 text-[15px] font-semibold text-white">
                          Regular Group
                        </span>
                        <span
                          className="mt-1 text-xs leading-snug"
                          style={{ color: TEXT_MUTED }}
                        >
                          Ongoing chat group, like WhatsApp. No expiry.
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setGroupKind("travel")}
                        className="flex min-h-[120px] flex-1 flex-col rounded-2xl border-2 p-3 text-left transition"
                        style={
                          groupKind === "travel"
                            ? {
                                borderColor: ACCENT,
                                background: "rgba(220, 38, 38, 0.12)",
                              }
                            : {
                                borderColor: MSG_BORDER,
                                background: "rgba(255,255,255,0.04)",
                              }
                        }
                      >
                        <ThIconPlane size={28} className="text-white" aria-hidden />
                        <span className="mt-1 text-[15px] font-semibold text-white">
                          Travel Group
                        </span>
                        <span
                          className="mt-1 text-xs leading-snug"
                          style={{ color: TEXT_MUTED }}
                        >
                          Linked to a trip. Tracks expenses and balances.
                        </span>
                      </button>
                    </div>
                    <div className="mt-4 flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => setCreateStep(3)}
                        className="h-11 w-full rounded-xl text-sm font-semibold text-white"
                        style={{ background: ACCENT }}
                      >
                        <span className="inline-flex w-full items-center justify-center gap-1.5">
                          Next
                          <ThIconChevronRight size={18} className="text-white" />
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setCreateStep(1)}
                        className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl text-sm font-medium text-slate-300"
                        style={{ background: "transparent" }}
                      >
                        <ThIconChevronLeft size={18} className="text-slate-300" />
                        Back
                      </button>
                    </div>
                  </div>
                ) : null}
                {createStep === 3 ? (
                  <div className="box-border w-full min-w-0 pl-1">
                    <label className="mt-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Group name <span className="text-red-500">*</span>
                    </label>
                    <input
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      placeholder='e.g. "Goa Gang", "Family Crew", "Thailand 2026"'
                      maxLength={120}
                      className="mt-1.5 w-full rounded-xl border px-3 py-2.5 text-[15px] text-white outline-none placeholder:text-slate-500"
                      style={{
                        background: BG,
                        borderColor: MSG_BORDER,
                      }}
                    />
                    <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Description (optional)
                    </label>
                    <textarea
                      value={newGroupDesc}
                      onChange={(e) => setNewGroupDesc(e.target.value)}
                      placeholder="What's this group for?"
                      maxLength={500}
                      rows={3}
                      className="mt-1.5 w-full resize-none rounded-xl border px-3 py-2.5 text-[14px] text-white outline-none placeholder:text-slate-500"
                      style={{
                        background: BG,
                        borderColor: MSG_BORDER,
                      }}
                    />
                    <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Group photo (optional)
                    </p>
                    <div className="mt-1 flex flex-col items-center">
                      <input
                        ref={photoInputRef}
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          e.target.value = "";
                          if (!f || !f.type.startsWith("image/")) return;
                          setPhotoPreviewUrl((prev) => {
                            if (prev) URL.revokeObjectURL(prev);
                            return URL.createObjectURL(f);
                          });
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => photoInputRef.current?.click()}
                        className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2"
                        style={{
                          borderColor: MSG_BORDER,
                          background: "rgba(255,255,255,0.06)",
                        }}
                      >
                        {photoPreviewUrl ? (
                          <img
                            src={photoPreviewUrl}
                            alt="Group photo preview"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <Camera className="h-8 w-8 text-slate-400" />
                        )}
                      </button>
                      <span
                        className="mt-1 text-center text-xs"
                        style={{ color: TEXT_MUTED }}
                      >
                        Add group photo
                      </span>
                    </div>

                    <div
                      className="mt-3 rounded-xl border px-2.5 py-2"
                      style={{ borderColor: MSG_BORDER, background: BG }}
                    >
                      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                        {selectedMembers.slice(0, 5).map((m) =>
                            m.isEmailInvite ? (
                            <span
                              key={m.id}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-white"
                              title={m.full_name}
                              style={{ background: EMAIL_INVITE_AVATAR_BG }}
                              aria-hidden
                            >
                              <ThIconMail size={12} className="text-white" />
                            </span>
                          ) : (
                            <span
                              key={m.id}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white"
                              title={m.full_name}
                              style={{ background: listAvatarColor(m.full_name) }}
                            >
                              {initialsFromName(m.full_name)}
                            </span>
                          ),
                        )}
                        {selectedMembers.length > 5 ? (
                          <span
                            className="text-xs font-medium"
                            style={{ color: TEXT_MUTED }}
                          >
                            +{selectedMembers.length - 5} more
                          </span>
                        ) : null}
                        <span
                          className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold"
                          style={{
                            background: "rgba(220, 38, 38, 0.2)",
                            color: "#FCA5A5",
                          }}
                        >
                          {groupKind === "travel" ? (
                            <span className="inline-flex items-center gap-0.5">
                              <ThIconPlane size={12} className="text-[#FCA5A5]" />
                              Travel
                            </span>
                          ) : (
                            "Regular"
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCreateStep(2)}
                        disabled={creating}
                        className="h-10 shrink-0 rounded-xl px-3 text-sm font-medium text-slate-300"
                        style={{ background: "transparent" }}
                      >
                        <span className="inline-flex w-full items-center justify-center gap-1.5">
                          <ThIconChevronLeft size={18} className="text-slate-300" />
                          Back
                        </span>
                      </button>
                      <button
                        type="button"
                        disabled={creating}
                        onClick={() => {
                          void handleCreateGroup();
                        }}
                        className="h-10 min-w-0 flex-1 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                        style={{ background: ACCENT }}
                      >
                        {creating ? "Creating..." : "Create Group"}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

type ContactRow = ContactPerson & { groupsTogether: number };

type DemoContactRow = {
  id: string;
  name: string;
  initials: string;
  bg: string;
  sub: string;
  kind: "arjun" | "priya" | "suresh";
};

const DEMO_CONTACTS: DemoContactRow[] = [
  {
    id: "__demo_contact_arjun__",
    name: "Arjun Mehta",
    initials: "AM",
    bg: "#2563EB",
    sub: "2 groups in common · Last seen today",
    kind: "arjun",
  },
  {
    id: "__demo_contact_priya__",
    name: "Priya Sharma",
    initials: "PS",
    bg: "#7C3AED",
    sub: "1 group in common · Last seen yesterday",
    kind: "priya",
  },
  {
    id: "__demo_contact_suresh__",
    name: "Suresh Kumar",
    initials: "SK",
    bg: "#059669",
    sub: "3 groups in common · Last seen Apr 20",
    kind: "suresh",
  },
];

type DemoScriptLine = { dir: "in" | "out"; text: string; time: string };

const DEMO_DM_SCRIPTS: Record<
  DemoContactRow["kind"] | "self",
  DemoScriptLine[]
> = {
  arjun: [
    { dir: "in", text: "Hey! Are we still going to Goa next month?", time: "Apr 20, 10:30 AM" },
    { dir: "out", text: "Yes! Booking flights this week. Check the poll I created.", time: "Apr 20, 10:32 AM" },
    { dir: "in", text: "Perfect. Should I book the hotel or will the group decide?", time: "Apr 20, 10:33 AM" },
    { dir: "out", text: "Let's do a poll for that too.", time: "Apr 20, 10:35 AM" },
    { dir: "in", text: "Good idea. Also Suresh is asking about the budget split.", time: "Apr 20, 11:00 AM" },
    { dir: "out", text: "Tell him to check the Split Activities section — it's all tracked there!", time: "Apr 20, 11:02 AM" },
    { dir: "in", text: "This app is actually really useful.", time: "Apr 20, 11:05 AM" },
  ],
  priya: [
    { dir: "in", text: "Did you add me to the Manali trip?", time: "Apr 21, 9:00 AM" },
    { dir: "out", text: "Yes! Check your groups — you should see Manali Winter there.", time: "Apr 21, 9:02 AM" },
    { dir: "in", text: "Got it! The live location feature is great.", time: "Apr 21, 9:10 AM" },
    { dir: "out", text: "Right? It works best when everyone enables it at the same time.", time: "Apr 21, 9:11 AM" },
    { dir: "in", text: "How do I check who owes me money?", time: "Apr 21, 9:15 AM" },
    { dir: "out", text: "Go to the trip, then the Expenses tab, then Balance Summary. It shows everything.", time: "Apr 21, 9:16 AM" },
    { dir: "in", text: "Found it! Arjun owes me ₹800.", time: "Apr 21, 9:18 AM" },
  ],
  suresh: [
    { dir: "in", text: "Bhai when is the Kashmir trip confirmed?", time: "Apr 19, 6:00 PM" },
    { dir: "out", text: "Still planning. Join the group and vote on the poll!", time: "Apr 19, 6:05 PM" },
    { dir: "in", text: "Done! I voted for June dates. Budget looks a bit high though.", time: "Apr 19, 6:10 PM" },
    { dir: "out", text: "We can split differently — I'll adjust the expense split.", time: "Apr 19, 6:12 PM" },
    { dir: "in", text: "The map with all our saved pins is amazing.", time: "Apr 19, 6:20 PM" },
    { dir: "out", text: "Haha yes! I saved like 15 spots already from Instagram reels.", time: "Apr 19, 6:21 PM" },
    { dir: "in", text: "See you in Kashmir then!", time: "Apr 19, 6:25 PM" },
  ],
  self: [
    {
      dir: "in",
      text: "This is your own account — use it to test group features!",
      time: "System",
    },
  ],
};

const DEMO_AUTO_REPLIES = [
  "Got it!",
  "Sounds good!",
  "Let me check and get back to you.",
  "Ha! True.",
  "Yes, definitely!",
  "I'll ask the group.",
] as const;

function HubContactsTab({
  contacts,
  onMessage,
  onOpenDemo,
  currentUser,
}: {
  contacts: ContactRow[];
  onMessage: (p: ContactPerson) => void;
  onOpenDemo: (row: DemoContactRow | { kind: "self"; id: string; name: string; initials: string; bg: string; sub: string }) => void;
  currentUser: UserMe | null;
}) {
  return (
    <ul className="m-0 list-none p-0">
      <li
        className="list-none py-2 pl-4 pr-4 text-[11px] font-semibold uppercase tracking-wide"
        style={{ color: SECTION_LABEL, background: RIGHT_PANEL_BG }}
      >
        Demo contacts
      </li>
      {DEMO_CONTACTS.map((d) => (
        <li
          key={d.id}
          className="list-none border-b"
          style={{ borderColor: BORDER_SUB, borderBottomWidth: 0.5 }}
        >
          <div
            className="flex h-[72px] cursor-default items-center gap-3 px-4"
          >
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[15px] font-bold text-white"
              style={{ background: d.bg }}
            >
              {d.initials}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-[14px] font-bold text-white">
                  {d.name}
                </span>
                <span
                  className="shrink-0 rounded px-1.5 py-0.5 text-[10px] uppercase"
                  style={{
                    background: SURFACE,
                    color: TEXT_MUTED,
                  }}
                >
                  Demo
                </span>
              </div>
              <p
                className="truncate text-[12px]"
                style={{ color: TEXT_MUTED }}
              >
                {d.sub}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenDemo(d)}
              className="h-7 shrink-0 rounded-full px-3 text-[11px]"
              style={{
                border: `0.5px solid ${MSG_BORDER}`,
                color: TEXT_MUTED,
                background: "transparent",
              }}
            >
              Message
            </button>
          </div>
        </li>
      ))}
      {currentUser ? (
        <li
          className="list-none border-b"
          style={{ borderColor: BORDER_SUB, borderBottomWidth: 0.5 }}
        >
          <div className="flex h-[72px] cursor-default items-center gap-3 px-4">
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[15px] font-bold text-white"
              style={{
                background: listAvatarColor(
                  currentUser.full_name || currentUser.id || "me",
                ),
              }}
            >
              {initialsFromName(currentUser.full_name || "You")}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-[14px] font-bold text-white">
                  {formatDisplayNameHub(currentUser.full_name)}
                </span>
                <span
                  className="shrink-0 rounded px-1.5 py-0.5 text-[10px] uppercase"
                  style={{
                    background: SURFACE,
                    color: TEXT_MUTED,
                  }}
                >
                  Demo
                </span>
              </div>
              <p className="truncate text-[12px]" style={{ color: TEXT_MUTED }}>
                Your account · demo self-chat
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                onOpenDemo({
                  kind: "self",
                  id: "__demo_contact_self__",
                  name: formatDisplayNameHub(currentUser.full_name),
                  initials: initialsFromName(currentUser.full_name || "You"),
                  bg: listAvatarColor(
                    currentUser.full_name || currentUser.id || "me",
                  ),
                  sub: "Your account · demo self-chat",
                })
              }
              className="h-7 shrink-0 rounded-full px-3 text-[11px]"
              style={{
                border: `0.5px solid ${MSG_BORDER}`,
                color: TEXT_MUTED,
                background: "transparent",
              }}
            >
              Message
            </button>
          </div>
        </li>
      ) : null}
      {contacts.length > 0 ? (
        <li
          className="list-none py-2 pl-4 pr-4 text-[11px] font-semibold uppercase tracking-wide"
          style={{ color: SECTION_LABEL, background: BG }}
        >
          From your groups
        </li>
      ) : null}
      {contacts.map((c) => (
        <li
          key={c.id}
          className="list-none border-b"
          style={{ borderColor: BORDER_SUB, borderBottomWidth: 0.5 }}
        >
          <div className="flex h-[72px] items-center gap-3 px-4">
            {c.avatar_url &&
            c.avatar_url.trim() &&
            !isInlineSvgDataUrlToSkipForPhoto(c.avatar_url) &&
            !isLegacyDicebearUrl(c.avatar_url) ? (
              <img
                src={c.avatar_url}
                alt=""
                className="h-10 w-10 shrink-0 rounded-full object-cover"
                width={40}
                height={40}
              />
            ) : (
              <InitialsAvatar name={c.full_name} size={40} />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-bold text-white">
                {c.full_name}
              </p>
              <p
                className="truncate text-[12px]"
                style={{ color: TEXT_MUTED }}
              >
                in {c.groupsTogether} group
                {c.groupsTogether === 1 ? "" : "s"} together
              </p>
            </div>
            <button
              type="button"
              onClick={() => onMessage(c)}
              className="h-7 shrink-0 rounded-full px-3 text-[11px]"
              style={{
                border: `0.5px solid ${MSG_BORDER}`,
                color: TEXT_MUTED,
                background: "transparent",
              }}
            >
              Message
            </button>
          </div>
        </li>
      ))}
      {contacts.length === 0 ? (
        <li
          className="list-none px-4 py-8 text-center text-sm"
          style={{ color: TEXT_MUTED }}
        >
          No contacts from your groups yet.
        </li>
      ) : null}
    </ul>
  );
}

function CallsSvgPhone20({ className }: { className?: string }) {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      className={className}
      aria-hidden
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.6 19.79 19.79 0 0 1 1.61 5a2 2 0 0 1 1.99-2.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 10.91a16 16 0 0 0 6 6l.92-.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function CallsSvgVideo20({ className }: { className?: string }) {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      className={className}
      aria-hidden
    >
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
}

function CallsSvgVideo32() {
  return (
    <svg
      width={32}
      height={32}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      aria-hidden
    >
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
}

function CallsSvgLink32() {
  return (
    <svg
      width={32}
      height={32}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function CallsSvgKeypad32() {
  return (
    <svg
      width={32}
      height={32}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      aria-hidden
    >
      <rect x="3" y="3" width="4" height="4" rx="1" />
      <rect x="10" y="3" width="4" height="4" rx="1" />
      <rect x="17" y="3" width="4" height="4" rx="1" />
      <rect x="3" y="10" width="4" height="4" rx="1" />
      <rect x="10" y="10" width="4" height="4" rx="1" />
      <rect x="17" y="10" width="4" height="4" rx="1" />
      <rect x="3" y="17" width="4" height="4" rx="1" />
      <rect x="10" y="17" width="4" height="4" rx="1" />
      <rect x="17" y="17" width="4" height="4" rx="1" />
    </svg>
  );
}

function CallsSvgCalendar32() {
  return (
    <svg
      width={32}
      height={32}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      aria-hidden
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function CallsSvgLock14() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      className="inline-block shrink-0 align-middle"
      aria-hidden
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function CallsConnectRightPanel({
  showCallToast,
  activeChat,
  user,
  onStartVideoCall,
  mainChatList,
  groups,
  startOutgoingCall,
}: {
  showCallToast: (message: string) => void;
  activeChat: ChatInfo | null;
  user: UserMe | null;
  onStartVideoCall: () => void;
  mainChatList: ChatInfo[];
  groups: GroupOut[];
  startOutgoingCall: (type: "audio" | "video", peer: { id: string; name: string; avatar: string | null }) => void;
}) {
  const cream = "#f5ede4";
  const copyLink = "https://travello.app/call/join";
  
  // Modal states
  const [participantModalOpen, setParticipantModalOpen] = useState(false);
  const [participantModalMode, setParticipantModalMode] = useState<"start" | "link" | "schedule">("start");
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [scheduledCalls, setScheduledCalls] = useState<ScheduledCallData[]>([]);
  const [preCallMessage, setPreCallMessage] = useState("");
  const [selectedCallParticipants, setSelectedCallParticipants] = useState<string[]>([]);

  // Load scheduled calls from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("gt_scheduled_calls_v1");
      if (raw) {
        const parsed = JSON.parse(raw);
        // Filter out past calls
        const now = Date.now();
        const filtered = parsed.filter((s: ScheduledCallData) => new Date(s.scheduledAt).getTime() > now - 3600000);
        setScheduledCalls(filtered);
      }
    } catch {
      setScheduledCalls([]);
    }
  }, []);

  // Build selectable contacts list
  const selectableContacts = useMemo(() => {
    const contacts: SelectableContact[] = [];
    
    // Add individual chats (DMs)
    mainChatList
      .filter((c) => c.type === "individual" && !c.isBot && !c.isDemo && !c.isAnnouncement)
      .forEach((c) => {
        const peerId = c.members.find((m) => m !== user?.id);
        if (peerId) {
          contacts.push({
            id: peerId,
            name: chatRowDisplayName(c),
            avatar: chatRowDmAvatarUrl(c),
            type: "individual",
            subtitle: "Direct message",
            isOnline: false, // Will be populated from presence data if available
          });
        }
      });
    
    // Add groups
    groups.forEach((g) => {
      contacts.push({
        id: `group_${g.id}`,
        name: g.name,
        type: "group",
        subtitle: `${g.members?.length || 0} members`,
        members: g.members?.map((m: GroupMemberOut) => m.user_id),
      });
    });
    
    return contacts;
  }, [mainChatList, groups, user?.id]);

  const handleStartCallClick = () => {
    setParticipantModalMode("start");
    setParticipantModalOpen(true);
  };

  const handleNewLinkClick = () => {
    setParticipantModalMode("link");
    setParticipantModalOpen(true);
  };

  const handleScheduleClick = () => {
    setScheduleModalOpen(true);
  };

  const handleParticipantConfirm = (selectedIds: string[], message?: string) => {
    setSelectedCallParticipants(selectedIds);
    setPreCallMessage(message || "");
    setParticipantModalOpen(false);

    if (participantModalMode === "start") {
      // For video call, start with first selected participant
      const firstId = selectedIds[0];
      if (firstId) {
        const contact = selectableContacts.find((c) => c.id === firstId);
        if (contact) {
          startOutgoingCall("video", {
            id: contact.id,
            name: contact.name,
            avatar: contact.avatar || null,
          });
          
          // If there's a pre-call message, show a toast about it
          if (message) {
            showCallToast("Call started with message preview");
          }
        }
      }
    } else if (participantModalMode === "link") {
      // Copy link and notify about sending to selected participants
      navigator.clipboard.writeText(copyLink).then(() => {
        showCallToast(`Link copied! Will notify ${selectedIds.length} participant(s)`);
        
        // Here you would typically send the link + message via chat API
        if (message) {
          console.log("Sending call link with message to:", selectedIds, "Message:", message);
        }
      });
    }
  };

  const handleScheduleCall = (data: Omit<ScheduledCallData, "id" | "createdAt">) => {
    const newCall: ScheduledCallData = {
      ...data,
      id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
    };
    
    const updated = [...scheduledCalls, newCall];
    setScheduledCalls(updated);
    localStorage.setItem("gt_scheduled_calls_v1", JSON.stringify(updated));
    
    showCallToast(`Call scheduled for ${new Date(data.scheduledAt).toLocaleString()}`);
    
    // Here you would:
    // 1. Send notifications to all participants
    // 2. Pin the scheduled call in chat histories
    // 3. Set up reminder notifications
    console.log("Scheduled call:", newCall);
  };

  // Check for upcoming calls and show reminders
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      scheduledCalls.forEach((call) => {
        const callTime = new Date(call.scheduledAt).getTime();
        
        // Check if any reminder should trigger
        call.reminders.forEach((reminderMinutes) => {
          const reminderTime = callTime - reminderMinutes * 60000;
          const windowStart = reminderTime - 30000; // 30 sec window
          const windowEnd = reminderTime + 30000;
          
          if (now >= windowStart && now <= windowEnd) {
            showCallToast(`📞 "${call.title}" starts ${reminderMinutes === 0 ? "now" : `in ${reminderMinutes} min`}!`);
          }
        });
      });
    }, 60000); // Check every minute
    
    return () => clearInterval(interval);
  }, [scheduledCalls, showCallToast]);

  return (
    <>
      <div
        className="flex min-h-0 min-w-0 flex-1 flex-col"
        style={{ background: cream }}
      >
        <div
          className="flex min-h-0 flex-1 flex-col items-center justify-center px-4"
          style={{ background: cream }}
        >
          {/* Clean 3-button layout - plain and simple, no phone dialer */}
          <div className="flex flex-col items-center justify-center gap-4">
            <div className="flex flex-wrap items-center justify-center gap-3">
              {/* Start call - pill style */}
              <button
                type="button"
                onClick={handleStartCallClick}
                className="flex items-center gap-2 px-5 py-3 text-sm font-medium transition-all hover:shadow-md"
                style={{
                  background: "#ffffff",
                  border: "1px solid #d1c4b0",
                  borderRadius: 24,
                  color: "#1e2a3a",
                }}
              >
                <CallsSvgVideo32 />
                Start call
              </button>

              {/* New call link - pill style */}
              <button
                type="button"
                onClick={handleNewLinkClick}
                className="flex items-center gap-2 px-5 py-3 text-sm font-medium transition-all hover:shadow-md"
                style={{
                  background: "#ffffff",
                  border: "1px solid #d1c4b0",
                  borderRadius: 24,
                  color: "#1e2a3a",
                }}
              >
                <CallsSvgLink32 />
                New call link
              </button>

              {/* Schedule call - pill style */}
              <button
                type="button"
                onClick={handleScheduleClick}
                className="flex items-center gap-2 px-5 py-3 text-sm font-medium transition-all hover:shadow-md"
                style={{
                  background: "#ffffff",
                  border: "1px solid #d1c4b0",
                  borderRadius: 24,
                  color: "#1e2a3a",
                }}
              >
                <CallsSvgCalendar32 />
                Schedule call
              </button>
            </div>

            {/* Show upcoming scheduled calls */}
            {scheduledCalls.length > 0 && (
              <div className="mt-4 w-full max-w-sm rounded-lg border p-3" style={{ borderColor: "#d1c4b0", background: "#fff" }}>
                <p className="mb-2 text-xs font-medium" style={{ color: "#6b7280" }}>
                  Upcoming calls
                </p>
                {scheduledCalls.slice(0, 3).map((call) => (
                  <div key={call.id} className="mb-2 flex items-center gap-2 text-sm">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full" style={{ background: "#8b5cf620" }}>
                      <CallsSvgCalendarSmall />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium" style={{ color: "#1e2a3a" }}>{call.title}</p>
                      <p className="text-xs" style={{ color: "#8896a0" }}>
                        {new Date(call.scheduledAt).toLocaleString(undefined, { 
                          month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" 
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <p className="mt-2 text-xs" style={{ color: "#8896a0" }}>
              Quick actions for your meetings
            </p>
          </div>
        </div>
        <p
          className="flex shrink-0 flex-wrap items-center justify-center gap-1.5 px-4 pb-6 text-center text-[12px] leading-snug"
          style={{ color: "#8896a0" }}
        >
          <CallsSvgLock14 />
          <span>Your calls are end-to-end encrypted</span>
        </p>
      </div>

      {/* Participant Selector Modal */}
      <CallParticipantSelector
        isOpen={participantModalOpen}
        onClose={() => setParticipantModalOpen(false)}
        contacts={selectableContacts}
        mode={participantModalMode}
        onConfirm={handleParticipantConfirm}
        currentUserId={user?.id || ""}
      />

      {/* Advanced Scheduled Call Modal */}
      <AdvancedScheduledCallModal
        isOpen={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
        contacts={selectableContacts}
        onSchedule={handleScheduleCall}
        currentUserId={user?.id || ""}
      />
    </>
  );
}

// Helper component for scheduled call list
function CallsSvgCalendarSmall() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function HubCallsTab({
  showCallToast,
  mainChatList,
  callHistory,
  onOpenHistoryRow,
  onStartAudioCall,
  onStartVideoCall,
  handleUnauthorized,
  masterAbortRef,
}: {
  showCallToast: (message: string) => void;
  mainChatList: ChatInfo[];
  callHistory: GtCallHistoryEntry[];
  onOpenHistoryRow: (e: GtCallHistoryEntry) => void;
  onStartAudioCall: (
    userId: string,
    name: string,
    avatar: string | null,
  ) => void;
  onStartVideoCall: (
    userId: string,
    name: string,
    avatar: string | null,
  ) => void;
  handleUnauthorized: () => void;
  masterAbortRef: MutableRefObject<AbortController | null>;
}) {
  const [q, setQ] = useState("");
  const [friends, setFriends] = useState<UserSearchResultRow[]>([]);
  const [friendsLoadDone, setFriendsLoadDone] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    void (async () => {
      try {
        const r = await apiFetchWithStatus<UserSearchResultRow[]>(
          "/social/friends",
          { signal: ac.signal },
        );
        if (r.status === 401) {
          handleUnauthorized();
          return;
        }
        if (r.status === 200 && Array.isArray(r.data)) {
          setFriends(r.data);
        } else {
          setFriends([]);
        }
      } catch {
        setFriends([]);
      } finally {
        setFriendsLoadDone(true);
      }
    })();
    return () => ac.abort();
  }, [handleUnauthorized]);

  const historySorted = useMemo(
    () => [...callHistory].sort((a, b) => b.timestamp - a.timestamp),
    [callHistory],
  );
  const qLower = q.trim().toLowerCase();
  const friendsTop3 = useMemo(() => friends.slice(0, 3), [friends]);
  const favoriteRows = useMemo(() => {
    if (!qLower) return friendsTop3;
    return friendsTop3.filter((f) =>
      (f.full_name || "").toLowerCase().includes(qLower),
    );
  }, [friendsTop3, qLower]);
  const historyRows = useMemo(() => {
    if (!qLower) return historySorted;
    return historySorted.filter((h) =>
      h.user_name.toLowerCase().includes(qLower),
    );
  }, [historySorted, qLower]);

  const nameCol = LIST_TEXT;
  const muted = LIST_TEXT_MUTED;
  const iconCol = BRAND_ACCENT;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <div
        className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-4 py-3"
        style={{ background: "#ffffff", borderColor: LIST_BORDER }}
      >
        <span
          className="text-[16px] font-bold"
          style={{ color: LIST_TEXT }}
        >
          Calls
        </span>
        <button
          type="button"
          aria-label="New call"
          className="flex h-9 w-9 items-center justify-center"
          style={{ color: iconCol }}
          onClick={() => showCallToast("Calls coming soon")}
        >
          <CallsSvgPhone20 />
        </button>
      </div>
      <HubSearchField
        value={q}
        onChange={setQ}
        placeholder="Search calls..."
        tone="light"
      />
      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
        {friendsLoadDone && favoriteRows.length > 0 ? (
          <div>
            <p
              className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase"
              style={{ color: muted }}
            >
              Favorites
            </p>
            <ul className="m-0 list-none p-0">
              {favoriteRows.map((f) => {
                const url =
                  f.profile_picture?.trim() && !isInlineSvgDataUrlToSkipForPhoto(f.profile_picture) && !isLegacyDicebearUrl(f.profile_picture)
                    ? f.profile_picture
                    : f.avatar_url?.trim() && !isInlineSvgDataUrlToSkipForPhoto(f.avatar_url) && !isLegacyDicebearUrl(f.avatar_url)
                      ? f.avatar_url
                      : null;
                return (
                  <li
                    key={f.id}
                    className="border-b"
                  style={{ borderColor: LIST_BORDER }}
                  >
                    <div
                      className="flex items-center gap-3 px-4"
                      style={{ minHeight: 72 }}
                    >
                      {url ? (
                        <img
                          src={url}
                          alt=""
                          className="h-[46px] w-[46px] shrink-0 rounded-full object-cover"
                          width={46}
                          height={46}
                        />
                      ) : (
                        <InitialsAvatar
                          name={f.full_name || "?"}
                          size={46}
                        />
                      )}
                      <span
                        className="min-w-0 flex-1 truncate text-sm font-bold"
                        style={{ color: nameCol }}
                      >
                        {f.full_name}
                      </span>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          aria-label="Video call"
                          className="flex h-9 w-9 items-center justify-center"
                          style={{ color: iconCol }}
                          onClick={() => {
                            const url =
                              f.profile_picture?.trim() &&
                              !isInlineSvgDataUrlToSkipForPhoto(f.profile_picture) &&
                              !isLegacyDicebearUrl(f.profile_picture)
                                ? f.profile_picture
                                : f.avatar_url?.trim() &&
                                    !isInlineSvgDataUrlToSkipForPhoto(f.avatar_url) &&
                                    !isLegacyDicebearUrl(f.avatar_url)
                                  ? f.avatar_url
                                  : null;
                            onStartVideoCall(f.id, f.full_name, url);
                          }}
                        >
                          <CallsSvgVideo20 />
                        </button>
                        <button
                          type="button"
                          aria-label="Voice call"
                          className="flex h-9 w-9 items-center justify-center"
                          style={{ color: iconCol }}
                          onClick={() => {
                            const url =
                              f.profile_picture?.trim() &&
                              !isInlineSvgDataUrlToSkipForPhoto(f.profile_picture) &&
                              !isLegacyDicebearUrl(f.profile_picture)
                                ? f.profile_picture
                                : f.avatar_url?.trim() &&
                                    !isInlineSvgDataUrlToSkipForPhoto(f.avatar_url) &&
                                    !isLegacyDicebearUrl(f.avatar_url)
                                  ? f.avatar_url
                                  : null;
                            onStartAudioCall(f.id, f.full_name, url);
                          }}
                        >
                          <CallsSvgPhone20 />
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        <p
          className="px-4 pb-1 pt-3 text-[11px] font-semibold uppercase"
          style={{ color: muted }}
        >
          Recent
        </p>
        {historySorted.length > 0 && historyRows.length === 0 && qLower ? (
          <p className="px-4 py-2 text-sm" style={{ color: muted }}>
            No matching calls
          </p>
        ) : null}
        {friendsLoadDone && historySorted.length === 0 && !qLower ? (
          <div className="flex flex-col items-center justify-center px-6 pb-8 pt-4 text-center">
            <span
              className="flex h-12 w-12 items-center justify-center"
              style={{ color: iconCol }}
            >
              <svg
                width={48}
                height={48}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                aria-hidden
              >
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.6 19.79 19.79 0 0 1 1.61 5a2 2 0 0 1 1.99-2.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 10.91a16 16 0 0 0 6 6l.92-.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            </span>
            <p className="mt-3 text-sm font-medium" style={{ color: nameCol }}>
              No recent calls
            </p>
            <p className="mt-1 text-sm" style={{ color: muted }}>
              Your call history will appear here
            </p>
          </div>
        ) : null}
        {historyRows.length > 0 ? (
          <ul className="m-0 list-none p-0">
            {historyRows.map((e) => {
              const ch = mainChatList.find(
                (c) =>
                  c.type === "individual" &&
                  c.members.includes(e.user_id),
              );
              const photo =
                ch &&
                chatRowDmAvatarUrl(ch) &&
                !isInlineSvgDataUrlToSkipForPhoto(
                  chatRowDmAvatarUrl(ch) ?? "",
                ) &&
                !isLegacyDicebearUrl(chatRowDmAvatarUrl(ch) ?? "")
                  ? chatRowDmAvatarUrl(ch)
                  : null;
              return (
                <li
                  key={`${e.user_id}-${e.timestamp}`}
                  className="border-b"
                  style={{ borderColor: LIST_BORDER }}
                >
                  <div
                    className="flex h-[72px] items-center gap-3 px-4"
                    style={{ minHeight: 72 }}
                  >
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      onClick={() => onOpenHistoryRow(e)}
                    >
                      {photo ? (
                        <img
                          src={photo}
                          alt=""
                          className="h-[46px] w-[46px] shrink-0 rounded-full object-cover"
                          width={46}
                          height={46}
                        />
                      ) : (
                        <InitialsAvatar name={e.user_name} size={46} />
                      )}
                      <div className="min-w-0 flex-1 text-left">
                        <p
                          className="truncate text-sm font-bold"
                          style={{
                            color:
                              e.direction === "missed" ? "#e8956d" : nameCol,
                          }}
                        >
                          {e.user_name}
                        </p>
                        <p
                          className="truncate text-xs"
                          style={{ color: muted }}
                        >
                          {formatCallHistorySubline(e)}
                        </p>
                      </div>
                    </button>
                    <button
                      type="button"
                      aria-label="Call"
                      className="flex h-9 w-9 shrink-0 items-center justify-center"
                      style={{ color: iconCol }}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onStartAudioCall(
                          e.user_id,
                          e.user_name,
                          photo,
                        );
                      }}
                    >
                      <CallsSvgPhone20 />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

function HubUpdatesTab({ currentUser }: { currentUser: UserMe | null }) {
  return (
    <div
      className="flex min-h-0 flex-1 flex-col bg-white"
    >
      <div
        className="flex items-center gap-3 border-b px-4 py-3"
        style={{ borderColor: LIST_BORDER }}
      >
        {currentUser ? (
          <InitialsAvatar
            name={currentUser.full_name?.trim() || "You"}
            size={40}
          />
        ) : (
          <div
            className="h-10 w-10 shrink-0 rounded-full"
            style={{ background: "#e5e7eb" }}
          />
        )}
        <p
          className="min-w-0 flex-1 text-left text-[15px] font-medium"
          style={{ color: LIST_TEXT }}
        >
          My Status
        </p>
      </div>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6">
        <p className="text-center text-sm" style={{ color: LIST_TEXT_MUTED }}>
          No updates yet
        </p>
      </div>
    </div>
  );
}

function ConnectHeaderComposeIcon({ className }: { className?: string }) {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      className={className}
      aria-hidden
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

type NewChatContactRow = {
  id: string;
  full_name: string;
  sub: string;
  avatar_url: string | null;
};

function NewChatSlidePanel({
  onClose,
  onNewGroup,
  onPickContact,
  user,
  groups,
  mainChatList,
  handleUnauthorized,
  masterAbortRef,
}: {
  onClose: () => void;
  onNewGroup: () => void;
  onPickContact: (p: ContactPerson) => void;
  user: UserMe;
  groups: GroupOut[];
  mainChatList: ChatInfo[];
  handleUnauthorized: () => void;
  masterAbortRef: MutableRefObject<AbortController | null>;
}) {
  const newChatMuted = "#8896a0";
  const newChatName = "#e9edef";
  const newChatSearchBg = "#263545";
  const newGroupAmber = "#f0a500";

  const [searchQuery, setSearchQuery] = useState("");
  const [baseRows, setBaseRows] = useState<NewChatContactRow[]>([]);
  const [searchHits, setSearchHits] = useState<UserSearchResultRow[] | null>(
    null,
  );
  const [loadingBase, setLoadingBase] = useState(false);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [entered, setEntered] = useState(false);
  const searchSeq = useRef(0);
  const baseLoadSeq = useRef(0);

  useLayoutEffect(() => {
    setEntered(false);
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const seq = ++baseLoadSeq.current;
    setLoadingBase(true);
    const ac = new AbortController();
    void (async () => {
      try {
        const merged = new Map<string, NewChatContactRow>();
        try {
          const connR = await apiFetchWithStatus<UserSearchResultRow[]>(
            "/social/connections",
            { signal: ac.signal },
          );
          if (baseLoadSeq.current !== seq) return;
          if (connR.status === 401) {
            handleUnauthorized();
            return;
          }
          if (connR.status === 200 && Array.isArray(connR.data)) {
            for (const r of connR.data) {
              if (r.id === user.id) continue;
              merged.set(r.id, {
                id: r.id,
                full_name: r.full_name,
                sub: formatUserSearchMeta(r),
                avatar_url: r.profile_picture ?? r.avatar_url,
              });
            }
          }
        } catch {
          if (baseLoadSeq.current === seq) {
            /* keep partial */
          }
        }
        try {
          const frR = await apiFetchWithStatus<UserSearchResultRow[]>(
            "/social/friends",
            { signal: ac.signal },
          );
          if (baseLoadSeq.current !== seq) return;
          if (frR.status === 200 && Array.isArray(frR.data)) {
            for (const r of frR.data) {
              if (r.id === user.id) continue;
              if (!merged.has(r.id)) {
                merged.set(r.id, {
                  id: r.id,
                  full_name: r.full_name,
                  sub: formatUserSearchMeta(r),
                  avatar_url: r.profile_picture ?? r.avatar_url,
                });
              }
            }
          }
        } catch {
          /* route may not exist */
        }
        for (const g of groups) {
          for (const m of g.members ?? []) {
            const uid = m.user_id ?? m.id;
            if (!uid || uid === user.id) continue;
            if (!merged.has(uid)) {
              merged.set(uid, {
                id: uid,
                full_name: m.full_name?.trim() || "Member",
                sub: "Group member",
                avatar_url: m.avatar_url ?? null,
              });
            }
          }
        }
        for (const ch of mainChatList) {
          if (ch.type !== "individual" || ch.isBot || ch.isDemo) continue;
          const peer = ch.members.find((x) => x !== user.id);
          if (!peer || merged.has(peer)) continue;
          const pRow = buildPeerSearchRowFromChat(ch, peer, []);
          merged.set(peer, {
            id: peer,
            full_name: chatRowDisplayName(ch),
            sub: formatUserSearchMeta(pRow),
            avatar_url:
              ch.metadata?.profile_picture?.trim() ||
              ch.metadata?.avatar_url?.trim() ||
              null,
          });
        }
        if (baseLoadSeq.current !== seq) return;
        setBaseRows(
          Array.from(merged.values()).sort((a, b) =>
            a.full_name.localeCompare(b.full_name, undefined, {
              sensitivity: "base",
            }),
          ),
        );
      } catch {
        if (baseLoadSeq.current === seq) setBaseRows([]);
      } finally {
        if (baseLoadSeq.current === seq) setLoadingBase(false);
      }
    })();
    return () => {
      ac.abort();
    };
  }, [user, groups, mainChatList, handleUnauthorized]);

  useEffect(() => {
    if (searchQuery.trim().length < 1) {
      setSearchHits(null);
    }
  }, [searchQuery]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 1) {
      return;
    }
    const seq = ++searchSeq.current;
    const t = setTimeout(() => {
      void (async () => {
        setLoadingSearch(true);
        try {
          const r = await apiFetchWithStatus<UserSearchResultRow[]>(
            `/users/search?q=${encodeURIComponent(normalizeConnectUserSearchQuery(q))}&limit=20`,
            { signal: masterAbortRef.current?.signal },
          );
          if (searchSeq.current !== seq) return;
          if (r.status === 401) {
            handleUnauthorized();
            return;
          }
          if (r.status === 200 && Array.isArray(r.data)) {
            setSearchHits(r.data.filter((row) => row.id !== user.id));
          } else {
            setSearchHits([]);
          }
        } catch {
          if (searchSeq.current === seq) setSearchHits([]);
        } finally {
          if (searchSeq.current === seq) setLoadingSearch(false);
        }
      })();
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery, user, handleUnauthorized, masterAbortRef]);

  const displayRows: NewChatContactRow[] = useMemo(() => {
    const q = searchQuery.trim();
    if (q.length >= 1) {
      if (searchHits !== null) {
        return searchHits.map((r) => ({
          id: r.id,
          full_name: r.full_name,
          sub: formatUserSearchMeta(r),
          avatar_url: r.profile_picture ?? r.avatar_url,
        }));
      }
      const ql = q.toLowerCase();
      return baseRows.filter(
        (r) =>
          r.full_name.toLowerCase().includes(ql) ||
          r.sub.toLowerCase().includes(ql),
      );
    }
    return baseRows;
  }, [searchQuery, searchHits, baseRows]);

  const requestBack = useCallback(() => {
    if (exiting) return;
    setExiting(true);
    setEntered(false);
    setTimeout(() => {
      setExiting(false);
      setSearchQuery("");
      setSearchHits(null);
      onClose();
    }, 200);
  }, [exiting, onClose]);

  const animStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    background: "#1e2a3a",
    opacity: exiting ? 0 : entered ? 1 : 0,
    transform: exiting
      ? "translateX(-10px)"
      : entered
        ? "translateX(0)"
        : "translateX(-10px)",
    transition: "opacity 200ms ease, transform 200ms ease",
  };

  return (
    <div
      className="absolute inset-0 z-[30] min-h-0"
      style={animStyle}
    >
      <div
        className="flex shrink-0 items-center justify-between border-b px-3 py-3 pl-2"
        style={{ borderColor: "rgba(255,255,255,0.05)" }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-0.5">
          <button
            type="button"
            onClick={requestBack}
            className="flex h-9 w-9 shrink-0 items-center justify-center text-white/90"
            aria-label="Back"
          >
            <ThIconChevronLeft size={22} className="text-white" />
          </button>
          <span
            className="min-w-0 text-[16px] font-bold"
            style={{ color: "#e8eaf0" }}
          >
            New chat
          </span>
        </div>
        <button
          type="button"
          className="flex h-9 w-9 shrink-0 items-center justify-center"
          style={{ color: newChatMuted }}
          aria-label="More"
        >
          <MoreVertical className="h-5 w-5" strokeWidth={1.5} />
        </button>
      </div>

      <div className="shrink-0 px-3 pb-2 pt-1">
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-2.5"
          style={{ background: newChatSearchBg }}
        >
          <Search className="h-4 w-4 shrink-0" style={{ color: newChatMuted }} />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search name or email..."
            className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none"
            style={{ color: newChatName }}
            autoComplete="off"
          />
        </div>
      </div>

      <div className="shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <button
          type="button"
          onClick={() => {
            if (exiting) return;
            setExiting(true);
            setEntered(false);
            setTimeout(() => {
              onNewGroup();
              setExiting(false);
              setSearchQuery("");
              setSearchHits(null);
              onClose();
            }, 200);
          }}
          className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors"
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background =
              LIST_ROW_HOVER;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
          }}
        >
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
            style={{ background: newGroupAmber }}
          >
            <UserPlus className="h-5 w-5 text-white" strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <p
              className="text-[14px] font-bold"
              style={{ color: newChatName }}
            >
              New group
            </p>
            <p className="text-[12px]" style={{ color: newChatMuted }}>
              Create a group chat
            </p>
          </div>
        </button>
      </div>

      <p
        className="shrink-0 px-3 py-2 text-[11px] font-semibold uppercase"
        style={{ color: newChatMuted }}
      >
        Contacts
      </p>

      <div
        className="custom-scrollbar min-h-0 flex-1 overflow-y-auto"
        style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
      >
        {loadingBase && displayRows.length === 0 && searchQuery.trim().length < 1 ? (
          <p className="px-3 py-4 text-sm" style={{ color: newChatMuted }}>
            Loading…
          </p>
        ) : null}
        {searchQuery.trim().length >= 1 && loadingSearch && searchHits === null ? (
          <p className="px-3 py-2 text-sm" style={{ color: newChatMuted }}>
            Searching…
          </p>
        ) : null}
        {displayRows.length === 0 && !loadingBase && searchQuery.trim().length >= 1 && !loadingSearch ? (
          <p className="px-3 py-4 text-sm" style={{ color: newChatMuted }}>
            No results
          </p>
        ) : null}
        {displayRows.map((row) => {
          const photo = row.avatar_url?.trim() &&
            !isInlineSvgDataUrlToSkipForPhoto(row.avatar_url) &&
            !isLegacyDicebearUrl(row.avatar_url)
            ? row.avatar_url
            : null;
          return (
            <button
              key={row.id}
              type="button"
              onClick={() => {
                onPickContact({
                  id: row.id,
                  full_name: row.full_name,
                  username: null,
                  avatar_url: row.avatar_url,
                });
                onClose();
              }}
              className="flex w-full items-center gap-3 border-b px-3 text-left transition-colors"
              style={{
                minHeight: 64,
                borderColor: "rgba(255,255,255,0.05)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  LIST_ROW_HOVER;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              }}
            >
              {photo ? (
                <img
                  src={photo}
                  alt=""
                  className="h-[46px] w-[46px] shrink-0 rounded-full object-cover"
                  width={46}
                  height={46}
                />
              ) : (
                <InitialsAvatar name={row.full_name} size={46} />
              )}
              <div className="min-w-0 flex-1 py-1">
                <p
                  className="truncate text-[14px] font-bold"
                  style={{ color: newChatName }}
                >
                  {row.full_name}
                </p>
                <p
                  className="truncate text-[12px]"
                  style={{ color: newChatMuted }}
                >
                  {row.sub}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DemoDmChatPanel({
  chat,
  onBack,
  showToast,
}: {
  chat: ChatInfo;
  onBack: () => void;
  showToast: (message: string, type?: "success" | "error") => void;
}) {
  const kind = chat.demoKind ?? "arjun";
  const baseScript = DEMO_DM_SCRIPTS[kind] ?? DEMO_DM_SCRIPTS.arjun;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [extra, setExtra] = useState<
    { id: string; dir: "in" | "out"; text: string; time: string }[]
  >([]);
  const [input, setInput] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const replyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setExtra([]);
    setInput("");
    setEmojiOpen(false);
    return () => {
      if (replyTimerRef.current) clearTimeout(replyTimerRef.current);
    };
  }, [chat.id]);

  useEffect(() => {
    globalThis.requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    });
  }, [kind, extra.length, chat.id]);

  const avatarBg = chat.demoAvatarBg ?? listAvatarColor(chat.name);
  const initials = chat.demoInitials ?? initialsFromName(chat.name);

  const sendDemo = () => {
    const t = input.trim();
    if (!t) return;
    const id = `${Date.now()}-${Math.random()}`;
    const timeStr = new Date().toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
    setExtra((e) => [...e, { id, dir: "out", text: t, time: timeStr }]);
    setInput("");
    setEmojiOpen(false);
    if (replyTimerRef.current) clearTimeout(replyTimerRef.current);
    replyTimerRef.current = setTimeout(() => {
      const rid = `${Date.now()}-${Math.random()}`;
      const pick =
        DEMO_AUTO_REPLIES[
          Math.floor(Math.random() * DEMO_AUTO_REPLIES.length)
        ]!;
      setExtra((e) => [
        ...e,
        {
          id: rid,
          dir: "in",
          text: pick,
          time: new Date().toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          }),
        },
      ]);
    }, 1200);
  };

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      style={{ background: RIGHT_PANEL_BG }}
    >
      <header
        className="flex shrink-0 items-center gap-3 border-b px-3 py-3 md:px-4"
        style={{ borderColor: BORDER_SUB, background: BG }}
      >
        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center text-white/90 md:hidden"
          aria-label="Back"
          onClick={onBack}
        >
          <ThIconChevronLeft size={22} className="text-white" />
        </button>
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[15px] font-bold text-white"
          style={{ background: avatarBg }}
        >
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold text-white">{chat.name}</p>
          <p
            className="flex items-center gap-1.5 truncate text-[12px]"
            style={{ color: TEXT_MUTED }}
          >
            <span
              className="inline-block h-2 w-2 shrink-0 rounded-full"
              style={{ background: ONLINE }}
            />
            Demo account · for testing
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-4 text-white">
          <button
            type="button"
            aria-label="Video call"
            className="text-white"
            onClick={() => showToast("Calls coming soon", "success")}
          >
            <Video className="h-6 w-6" strokeWidth={2} />
          </button>
          <button
            type="button"
            aria-label="Voice call"
            className="text-white"
            onClick={() => showToast("Calls coming soon", "success")}
          >
            <Phone className="h-6 w-6" strokeWidth={2} />
          </button>
        </div>
      </header>
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 custom-scrollbar overflow-y-auto px-4 py-3"
      >
        {kind === "self" ? (
          <div
            className="mb-3 rounded-lg px-2 py-2 text-center text-[12px]"
            style={{ background: SURFACE, color: TEXT_MUTED, padding: 8 }}
          >
            This is a demo self-conversation for testing purposes
          </div>
        ) : null}
        {baseScript.map((line, i) => (
          <div
            key={`base-${kind}-${i}`}
            className={`mb-2 flex w-full ${line.dir === "out" ? "justify-end" : "justify-start"}`}
          >
            <div
              className="relative max-w-[85%] px-3 py-2 text-[14px] leading-snug text-white"
              style={{
                background: line.dir === "out" ? ACCENT : SURFACE,
                borderRadius:
                  line.dir === "out" ? "16px 16px 0 16px" : "0 16px 16px 16px",
              }}
            >
              {line.text}
              <div
                className="mt-1 text-right text-[10px]"
                style={{
                  color: line.dir === "out" ? "rgba(255,255,255,0.7)" : TEXT_MUTED,
                }}
              >
                {line.time}
              </div>
            </div>
          </div>
        ))}
        {extra.map((line) => (
          <div
            key={line.id}
            className={`mb-2 flex w-full ${line.dir === "out" ? "justify-end" : "justify-start"}`}
          >
            <div
              className="relative max-w-[85%] px-3 py-2 text-[14px] leading-snug text-white"
              style={{
                background: line.dir === "out" ? ACCENT : SURFACE,
                borderRadius:
                  line.dir === "out" ? "16px 16px 0 16px" : "0 16px 16px 16px",
              }}
            >
              {line.text}
              <div
                className="mt-1 text-right text-[10px]"
                style={{
                  color: line.dir === "out" ? "rgba(255,255,255,0.7)" : TEXT_MUTED,
                }}
              >
                {line.time}
              </div>
            </div>
          </div>
        ))}
      </div>
      {emojiOpen ? (
        <div
          className="mx-3 mb-1 grid grid-cols-10 gap-1 rounded-xl border p-2"
          style={{ borderColor: MSG_BORDER, background: SURFACE }}
        >
          {QUICK_REACTION_CHIPS.map((em) => (
            <button
              key={em}
              type="button"
              className="rounded px-1 py-0.5 text-[10px] text-white/90 hover:bg-white/10"
              onClick={() => setInput((p) => p + (p && !p.endsWith(" ") ? " " : "") + em + " ")}
            >
              {em}
            </button>
          ))}
        </div>
      ) : null}
      <div
        className="flex shrink-0 items-center gap-2 border-t px-3 py-2"
        style={{ borderColor: BORDER_SUB, background: BG }}
      >
        <button
          type="button"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
          style={{ color: TH_MUTED }}
          aria-label="Emoji"
          onClick={() => setEmojiOpen((o) => !o)}
        >
          <ThIconSmile size={18} className="text-current" />
        </button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") sendDemo();
          }}
          placeholder="Message..."
          className="min-w-0 flex-1 rounded-full border-0 px-4 py-2.5 text-sm text-white outline-none placeholder:text-slate-500"
          style={{ background: SURFACE }}
        />
        <button
          type="button"
          onClick={sendDemo}
          className="shrink-0 rounded-full px-5 py-2 text-sm font-semibold text-white"
          style={{ background: ACCENT }}
        >
          Send
        </button>
      </div>
    </div>
  );
}

const BOT_CHIP_QUESTIONS = [
  "How do I create a trip?",
  "How does expense split work?",
  "What is live coordination?",
  "How to invite friends?",
  "What's included in Pro plan?",
] as const;

const BOT_ANSWERS: Record<(typeof BOT_CHIP_QUESTIONS)[number], string> = {
  "How do I create a trip?":
    "Go to Trips, click Plan New Trip, choose Social or Business, then fill in details or upload a document and our AI will fill it for you.",
  "How does expense split work?":
    "Tap the split button in any group chat, enter the amount, choose who paid, and select who to split with. Everyone sees their share instantly.",
  "What is live coordination?":
    "When your trip starts, activate Live mode. Everyone's location appears on a shared map. Drop meetup pins, set countdown timers, and see who has arrived. Needs a 3-Day Pass or Pro.",
  "How to invite friends?":
    "Open your group, share the invite code, or copy the invite link. Friends can join by entering the code. No app download is needed on the web.",
  "What's included in Pro plan?":
    "Pro (₹849/month) includes: unlimited trips, live coordination, receipt scanner, expense export PDF, AI trip planner, and everything in Free. Upgrade in your Profile.",
};

const BOT_FALLBACK =
  "I don't have an answer for that yet, but our team is working on it! Try one of the suggested questions above.";

function normalizeBotMatch(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[?.!]+$/g, "");
}

function findBotAnswerForText(input: string): string {
  const t = normalizeBotMatch(input);
  if (!t) return BOT_FALLBACK;
  for (const q of BOT_CHIP_QUESTIONS) {
    const nq = normalizeBotMatch(q);
    if (t.includes(nq) || nq.includes(t)) return BOT_ANSWERS[q];
  }
  const rules: [string[], (typeof BOT_CHIP_QUESTIONS)[number]][] = [
    [["create", "trip"], "How do I create a trip?"],
    [["expense", "split"], "How does expense split work?"],
    [["live coordination"], "What is live coordination?"],
    [["invite", "friend"], "How to invite friends?"],
    [["pro plan", "pro"], "What's included in Pro plan?"],
  ];
  for (const [keys, q] of rules) {
    if (keys.every((k) => t.includes(k))) return BOT_ANSWERS[q];
  }
  return BOT_FALLBACK;
}

type BotMsg = {
  id: string;
  role: "user" | "bot";
  text: string;
  timestamp: number;
};

function TravelloHelpChatPanel() {
  const isResponding = useRef(false);
  const [messages, setMessages] = useState<BotMsg[]>(() => [
    {
      id: `welcome-${Date.now()}-${Math.random()}`,
      role: "bot",
      text: "Hi! I'm your Travello assistant. I can help you plan trips, split expenses, find destinations, and more. Try asking me something!",
      timestamp: Date.now(),
    },
  ]);
  const [showChips, setShowChips] = useState(true);
  const [input, setInput] = useState("");
  const [botBusy, setBotBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, showChips]);

  const sendFlow = (question: string) => {
    const q = question.trim();
    if (!q) return;
    if (isResponding.current || botBusy) return;
    isResponding.current = true;
    setBotBusy(true);
    const uid = `${Date.now()}-${Math.random()}`;
    setMessages((m) => [
      ...m,
      { id: uid, role: "user", text: q, timestamp: Date.now() },
    ]);
    setShowChips(false);
    setInput("");
    const answer = findBotAnswerForText(q);
    globalThis.setTimeout(() => {
      setMessages((m) => [
        ...m,
        {
          id: `${Date.now()}-${Math.random()}`,
          role: "bot",
          text: answer,
          timestamp: Date.now(),
        },
      ]);
      setShowChips(true);
      globalThis.setTimeout(() => {
        isResponding.current = false;
        setBotBusy(false);
      }, 800);
    }, 600);
  };

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      style={{ background: RIGHT_PANEL_BG }}
    >
      <header
        className="flex shrink-0 items-center gap-3 border-b px-4 py-3"
        style={{ borderColor: BORDER_SUB, background: BG }}
      >
        <span
          className="flex h-9 w-9 items-center justify-center rounded-full"
          style={{ background: ACCENT }}
        >
          <BotFaceIcon size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium text-white">
            Travello Help
          </p>
          <p className="flex items-center gap-1.5 text-[12px]" style={{ color: TEXT_MUTED }}>
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: ONLINE }}
            />
            AI Assistant · always online
          </p>
        </div>
      </header>
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 custom-scrollbar overflow-y-auto px-4 py-3"
      >
        {messages.map((m) => (
          <div
            key={m.id}
            className={`mb-3 flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className="max-w-[85%] rounded-2xl px-3 py-2 text-[14px] leading-snug"
              style={{
                background: m.role === "user" ? ACCENT : SURFACE,
                color: "white",
              }}
            >
              {m.text}
            </div>
          </div>
        ))}
        {showChips ? (
          <div className="mb-4 flex flex-wrap gap-2">
            {BOT_CHIP_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                disabled={botBusy}
                onClick={() => sendFlow(q)}
                className="rounded-full border px-3 py-1.5 text-left text-[12px] text-white disabled:opacity-45"
                style={{ borderColor: MSG_BORDER, background: SURFACE }}
              >
                {q}
              </button>
            ))}
            <button
              type="button"
              disabled={botBusy}
              onClick={() => {
                setMessages([
                  {
                    id: `${Date.now()}-${Math.random()}`,
                    role: "bot",
                    text: "Hi! I'm your Travello assistant. I can help you plan trips, split expenses, find destinations, and more. Try asking me something!",
                    timestamp: Date.now(),
                  },
                ]);
                setShowChips(true);
              }}
              className="rounded-full px-3 py-1.5 text-[12px] disabled:opacity-45"
              style={{ color: TEXT_SECONDARY, border: `1px dashed ${MSG_BORDER}` }}
            >
              Ask another question
            </button>
          </div>
        ) : null}
      </div>
      <div
        className="flex shrink-0 gap-2 border-t px-3 py-2"
        style={{ borderColor: BORDER_SUB, background: BG }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") sendFlow(input);
          }}
          disabled={botBusy}
          placeholder="Ask a question…"
          className="min-w-0 flex-1 rounded-full border-0 px-4 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 disabled:opacity-45"
          style={{ background: SURFACE }}
        />
        <button
          type="button"
          disabled={botBusy}
          onClick={() => sendFlow(input)}
          className="shrink-0 rounded-full px-5 py-2 text-sm font-semibold text-white disabled:opacity-45"
          style={{ background: ACCENT }}
        >
          Send
        </button>
      </div>
    </div>
  );
}

function CommunityAnnouncementPanel() {
  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      style={{ background: RIGHT_PANEL_BG }}
    >
      <header
        className="flex shrink-0 items-center gap-3 border-b px-4 py-3"
        style={{ borderColor: BORDER_SUB, background: BG }}
      >
        <span
          className="flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-bold text-white"
          style={{ background: "#2563EB" }}
        >
          CU
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium text-white">
            Community Updates
          </p>
          <p className="text-[12px]" style={{ color: TEXT_MUTED }}>
            Official channel · read only
          </p>
        </div>
        <Megaphone className="h-5 w-5 shrink-0 text-[#9ca3af]" strokeWidth={1.5} aria-hidden />
      </header>
      <div className="min-h-0 flex-1 custom-scrollbar overflow-y-auto px-4 py-3">
        <div className="my-3 flex justify-center">
          <span
            className="rounded-full px-3 py-1 text-[11px]"
            style={{ background: SURFACE, color: TEXT_MUTED }}
          >
            Today
          </span>
        </div>
        <div className="mb-3 max-w-[90%] rounded-2xl px-3 py-2" style={{ background: SURFACE }}>
          <p className="text-[11px] font-semibold" style={{ color: ACCENT }}>
            Travello Team
          </p>
          <p className="mt-1 text-[14px] leading-relaxed text-white">
            New feature alert: AI Trip Planner is now live. Upload any document
            (screenshot, PDF, Word, or Excel) and our AI fills your entire trip
            plan automatically. Try it in Trips, Plan New Trip.
          </p>
          <p className="mt-1 text-[10px]" style={{ color: TEXT_MUTED }}>
            2:10 AM
          </p>
        </div>
        <div className="mb-3 max-w-[90%] rounded-2xl px-3 py-2" style={{ background: SURFACE }}>
          <p className="text-[11px] font-semibold" style={{ color: ACCENT }}>
            Travello Team
          </p>
          <p className="mt-1 text-[14px] leading-relaxed text-white">
            Live Coordination upgrade: meetup pins now show distance in real
            time. When you are within 100m of the meetup point, you will see a
            &apos;You have arrived!&apos; celebration.
          </p>
          <p className="mt-1 text-[10px]" style={{ color: TEXT_MUTED }}>
            Apr 21
          </p>
        </div>
        <div className="my-3 flex justify-center">
          <span
            className="rounded-full px-3 py-1 text-[11px]"
            style={{ background: SURFACE, color: TEXT_MUTED }}
          >
            Apr 20
          </span>
        </div>
        <div className="mb-3 max-w-[90%] rounded-2xl px-3 py-2" style={{ background: SURFACE }}>
          <p className="text-[11px] font-semibold" style={{ color: ACCENT }}>
            Travello Team
          </p>
          <p className="mt-1 text-[14px] leading-relaxed text-white">
            Buddy Trips launching soon. Solo traveler? Post a trip listing and
            find companions who match your vibe, budget, and destination. Coming
            in our next update.
          </p>
          <p className="mt-1 text-[10px]" style={{ color: TEXT_MUTED }}>
            Apr 20
          </p>
        </div>
        <div className="mb-3 max-w-[90%] rounded-2xl px-3 py-2" style={{ background: SURFACE }}>
          <p className="text-[11px] font-semibold" style={{ color: ACCENT }}>
            Travello Team
          </p>
          <p className="mt-1 text-[14px] leading-relaxed text-white">
            Split money in chat: you can now split expenses directly from the
            chat box. Tap the split action in any group chat to split a bill and
            post it as a message. All members see their share instantly.
          </p>
          <p className="mt-1 text-[10px]" style={{ color: TEXT_MUTED }}>
            Apr 20
          </p>
        </div>
      </div>
      <div
        className="shrink-0 px-4 py-3 text-center text-[12px] leading-relaxed"
        style={{
          background: SURFACE,
          borderTop: `0.5px solid ${MSG_BORDER}`,
          color: TEXT_MUTED,
        }}
      >
        This is an official announcement channel. Only the Travello team can
        post here.
      </div>
    </div>
  );
}

const API_V1_BASE = "http://localhost:8000/api/v1";
const GI_BG = "#fdf6ed";
const GI_CARD = "#ffffff";
const GI_CORAL = "#ff6b6b";
const GI_GREEN = "#1d9e75";
const GI_MUTED = "#8896a0";
const GI_TEXT = "#1e2a3a";
const GI_ACTION_BG = "#f5ede0";
const GI_SECTION_BORDER = "#e8d5b7";

function groupInfoAuthHeaders(): HeadersInit {
  const token = localStorage.getItem("gt_token");
  return {
    Authorization: token ? `Bearer ${token}` : "",
  };
}

function netForUserInTripSummary(
  rows: { from_user_id: string; to_user_id: string; amount: number }[],
  me: string,
): number {
  const m = me.replace(/-/g, "").toLowerCase();
  let n = 0;
  for (const r of rows) {
    const from = String(r.from_user_id).replace(/-/g, "").toLowerCase();
    const to = String(r.to_user_id).replace(/-/g, "").toLowerCase();
    if (to === m) n += r.amount;
    if (from === m) n -= r.amount;
  }
  return Math.round(n * 100) / 100;
}

function formatTripBarDate(
  s: string | null | undefined,
  fallback = "—",
): string {
  if (s == null || !String(s).trim()) return fallback;
  const t = Date.parse(String(s));
  if (Number.isNaN(t)) return fallback;
  return new Date(t).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type GroupInfoPanelProps = {
  group: GroupOut;
  selfId: string;
  onClose: () => void;
  onSearchInGroupChat: () => void;
  openDirectChat: (p: ContactPerson) => void;
  onLeaveSuccess: (groupId: string) => void;
  showToast: (message: string, type?: "success" | "error") => void;
  onUnauthorized: () => void;
  loadBackend: () => void | Promise<unknown>;
  onViewFullSplit: () => void;
  onSettleAll: () => void;
  masterAbortRef: MutableRefObject<AbortController | null>;
  onVoiceCall: () => void;
  onVideoCall: () => void;
  onScheduleCall: () => void;
  onClearChat: () => void;
  onToggleFavorite: () => void;
  isFavorite: boolean;
  scheduleVersion: number;
  onScheduleChanged: () => void;
};

function GroupInfoPanel({
  group: groupProp,
  selfId,
  onClose,
  onSearchInGroupChat,
  openDirectChat,
  onLeaveSuccess,
  showToast,
  onUnauthorized,
  loadBackend,
  onViewFullSplit,
  onSettleAll,
  masterAbortRef,
  onVoiceCall,
  onVideoCall,
  onScheduleCall,
  onClearChat,
  onToggleFavorite,
  isFavorite,
  scheduleVersion,
  onScheduleChanged,
}: GroupInfoPanelProps) {
  const [scheduledCalls, setScheduledCalls] = useState<
    {
      id: string;
      chatId: string;
      chatName: string;
      title: string;
      at: number;
    }[]
  >([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("gt_scheduled_calls_v1");
      const list = raw
        ? (JSON.parse(raw) as {
            id: string;
            chatId: string;
            chatName: string;
            title: string;
            at: number;
          }[])
        : [];
      const groupChatId = `group_${groupProp.id}`;
      const filtered = list
        .filter((x) => x.chatId === groupChatId)
        .sort((a, b) => a.at - b.at);
      setScheduledCalls(filtered);
    } catch {
      setScheduledCalls([]);
    }
  }, [groupProp.id, scheduleVersion]);

  const removeScheduledCall = (id: string) => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("gt_scheduled_calls_v1");
      const list = raw
        ? (JSON.parse(raw) as {
            id: string;
            chatId: string;
            chatName: string;
            title: string;
            at: number;
          }[])
        : [];
      const next = list.filter((x) => x.id !== id);
      window.localStorage.setItem(
        "gt_scheduled_calls_v1",
        JSON.stringify(next),
      );
      onScheduleChanged();
    } catch {
      /* localStorage unavailable */
    }
  };
  const [panelOpacity, setPanelOpacity] = useState(0);
  const [group, setGroup] = useState<GroupOut>(groupProp);
  const [members, setMembers] = useState<GroupMemberOut[] | null>(null);
  const [membersLoading, setMembersLoading] = useState(true);
  const [firstTrip, setFirstTrip] = useState<TripOut | null>(null);
  const [tripsLoading, setTripsLoading] = useState(false);
  const [expenseSummary, setExpenseSummary] = useState<
    { from_user_id: string; to_user_id: string; amount: number }[] | null
  >(null);
  const [summaryError, setSummaryError] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [memberBalances, setMemberBalances] = useState<Record<string, number>>(
    {},
  );
  const [showAllMembers, setShowAllMembers] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [actionMoreOpen, setActionMoreOpen] = useState(false);
  const [memberSheet, setMemberSheet] = useState<GroupMemberOut | null>(null);
  const [memberSheetDetail, setMemberSheetDetail] = useState<{
    total_net: number;
    by_group: {
      group_id: string;
      group_name: string;
      net_amount: number;
    }[];
  } | null>(null);
  const [adminAction, setAdminAction] = useState<GroupMemberOut | null>(null);
  const [reassignPickerOpen, setReassignPickerOpen] = useState(false);
  const [memberActionLoading, setMemberActionLoading] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [budgetTotals, setBudgetTotals] = useState<{
    total: number;
    expenses: number;
    currency: string;
  } | null>(null);
  const actionMoreRef = useRef<HTMLDivElement | null>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [infoMediaTab, setInfoMediaTab] = useState<"media" | "links" | "docs">(
    "media",
  );
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [addMemberQuery, setAddMemberQuery] = useState("");
  const [addMemberResults, setAddMemberResults] = useState<UserSearchResultRow[]>(
    [],
  );
  const [addMemberSearching, setAddMemberSearching] = useState(false);
  const [addMemberInvite, setAddMemberInvite] = useState<
    Record<string, "invited" | "already">
  >({});
  const [invitingUserId, setInvitingUserId] = useState<string | null>(null);
  const [pendingInvitesCount, setPendingInvitesCount] = useState<number | null>(
    null,
  );

  const memberDetailFetchAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      memberDetailFetchAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    setGroup(groupProp);
  }, [groupProp.id, groupProp]);

  const isTravel = useMemo(
    () => (group.group_type ?? "regular") === "travel",
    [group.group_type],
  );

  useEffect(() => {
    setPanelOpacity(0);
    const t = setTimeout(() => setPanelOpacity(1), 10);
    return () => clearTimeout(t);
  }, [group.id]);

  useEffect(() => {
    if (!actionMoreOpen) return;
    const h = (e: MouseEvent) => {
      const a = actionMoreRef.current;
      if (a && !a.contains(e.target as Node)) setActionMoreOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [actionMoreOpen]);

  const refreshGroupDetail = useCallback(async () => {
    try {
      const r = await fetchWithTimeout(
        `${API_V1_BASE}/groups/${encodeURIComponent(group.id)}`,
        {
          headers: groupInfoAuthHeaders(),
          signal: masterAbortRef.current?.signal,
        },
      );
      if (r.status === 401) {
        onUnauthorized();
        return;
      }
      if (r.status === 200) {
        const d = (await r.json()) as GroupOut;
        setGroup((prev) => ({ ...prev, ...d, members: prev?.members ?? [] }));
      }
    } catch (e) {
      if (isAbortError(e)) return;
      /* ignore */
    }
  }, [group.id, onUnauthorized]);

  useEffect(() => {
    let cancel = false;
    const runSignal = masterAbortRef.current?.signal;
    void (async () => {
      setMembersLoading(true);
      setMembers(null);
      try {
        const [gRes, mRes] = await Promise.all([
          fetchWithTimeout(
            `${API_V1_BASE}/groups/${encodeURIComponent(group.id)}`,
            { headers: groupInfoAuthHeaders(), signal: runSignal },
          ),
          fetchWithTimeout(
            `${API_V1_BASE}/groups/${encodeURIComponent(group.id)}/members`,
            { headers: groupInfoAuthHeaders(), signal: runSignal },
          ),
        ]);
        if (gRes.status === 401 || mRes.status === 401) {
          onUnauthorized();
          return;
        }
        if (gRes.status === 200) {
          const d = (await gRes.json()) as GroupOut;
          if (!cancel) setGroup((prev) => ({ ...prev, ...d }));
        }
        if (mRes.status === 200) {
          const list = (await mRes.json()) as GroupMemberOut[];
          if (!cancel) setMembers(Array.isArray(list) ? list : []);
        } else {
          if (!cancel) setMembers([]);
        }
      } catch (e) {
        if (isAbortError(e)) return;
        if (!cancel) setMembers([]);
      } finally {
        if (!cancel) setMembersLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [group.id, onUnauthorized]);

  useEffect(() => {
    if (!isTravel) {
      setFirstTrip(null);
      return;
    }
    let cancel = false;
    const runSignal = masterAbortRef.current?.signal;
    void (async () => {
      setTripsLoading(true);
      setFirstTrip(null);
      try {
        const r = await fetchWithTimeout(
          `${API_V1_BASE}/groups/${encodeURIComponent(group.id)}/trips`,
          { headers: groupInfoAuthHeaders(), signal: runSignal },
        );
        if (r.status === 401) {
          onUnauthorized();
          return;
        }
        if (r.status === 200) {
          const list = (await r.json()) as TripOut[];
          if (!cancel && Array.isArray(list) && list.length > 0)
            setFirstTrip(list[0]!);
        }
      } catch (e) {
        if (isAbortError(e)) return;
        if (!cancel) setFirstTrip(null);
      } finally {
        if (!cancel) setTripsLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [group.id, isTravel, onUnauthorized]);

  useEffect(() => {
    if (!isTravel || !firstTrip) {
      setExpenseSummary(null);
      setSummaryError(false);
      return;
    }
    let cancel = false;
    const runSignal = masterAbortRef.current?.signal;
    void (async () => {
      setSummaryLoading(true);
      setSummaryError(false);
      try {
        const r = await fetchWithTimeout(
          `${API_V1_BASE}/trips/${encodeURIComponent(firstTrip.id)}/expenses/summary`,
          { headers: groupInfoAuthHeaders(), signal: runSignal },
        );
        if (r.status === 401) {
          onUnauthorized();
          return;
        }
        if (r.status === 200) {
          const data = (await r.json()) as {
            from_user_id: string;
            to_user_id: string;
            amount: number;
          }[];
          if (!cancel) setExpenseSummary(Array.isArray(data) ? data : []);
        } else {
          if (!cancel) {
            setExpenseSummary(null);
            setSummaryError(true);
          }
        }
      } catch (e) {
        if (isAbortError(e)) return;
        if (!cancel) {
          setExpenseSummary(null);
          setSummaryError(true);
        }
      } finally {
        if (!cancel) setSummaryLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [isTravel, firstTrip?.id, onUnauthorized]);

  useEffect(() => {
    if (!isTravel || !firstTrip) {
      setBudgetTotals(null);
      return;
    }
    let cancel = false;
    const runSignal = masterAbortRef.current?.signal;
    void (async () => {
      try {
        const r = await fetchWithTimeout(
          `${API_V1_BASE}/trips/${encodeURIComponent(firstTrip.id)}/expenses/summary/category`,
          { headers: groupInfoAuthHeaders(), signal: runSignal },
        );
        if (r.status === 401) {
          onUnauthorized();
          return;
        }
        if (r.status === 200) {
          const rows = (await r.json()) as {
            category: string;
            total: number;
            currency: string;
            expense_count: number;
          }[];
          if (cancel) return;
          let total = 0;
          let count = 0;
          let currency = "INR";
          for (const row of rows) {
            total += Number(row.total) || 0;
            count += Number(row.expense_count) || 0;
            if (row.currency) currency = row.currency;
          }
          setBudgetTotals({ total, expenses: count, currency });
        } else {
          if (!cancel) setBudgetTotals(null);
        }
      } catch (e) {
        if (isAbortError(e)) return;
        if (!cancel) setBudgetTotals(null);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [isTravel, firstTrip?.id, onUnauthorized]);

  const isAdmin = useMemo(() => {
    if (!members) return false;
    return members.some(
      (m) =>
        m.user_id === selfId &&
        String(m.role ?? "").toLowerCase() === "admin",
    );
  }, [members, selfId]);

  const refetchPendingInvites = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const r = await fetchWithTimeout(
        `${API_V1_BASE}/invitations/group/${encodeURIComponent(group.id)}/pending`,
        {
          headers: groupInfoAuthHeaders(),
          signal: masterAbortRef.current?.signal,
        },
      );
      if (r.status !== 200) return;
      const d: unknown = await r.json();
      let n = 0;
      if (Array.isArray(d)) n = d.length;
      else if (d && typeof d === "object") {
        const o = d as Record<string, unknown>;
        if (typeof o.count === "number") n = o.count;
        else if (typeof o.pending === "number") n = o.pending;
        else if (Array.isArray(o.items)) n = o.items.length;
      }
      setPendingInvitesCount(n);
    } catch (e) {
      if (isAbortError(e)) return;
      /* skip silently */
    }
  }, [isAdmin, group.id]);

  useEffect(() => {
    if (!isAdmin) {
      setPendingInvitesCount(null);
      return;
    }
    void refetchPendingInvites();
  }, [isAdmin, refetchPendingInvites]);

  useEffect(() => {
    setAddMemberOpen(false);
    setAddMemberQuery("");
    setAddMemberResults([]);
    setAddMemberInvite({});
    setInvitingUserId(null);
  }, [group.id]);

  useEffect(() => {
    if (!addMemberOpen) return;
    const q = addMemberQuery.trim();
    if (!q) {
      setAddMemberResults([]);
      setAddMemberSearching(false);
      return;
    }
    setAddMemberSearching(true);
    const t = setTimeout(() => {
      const runSignal = masterAbortRef.current?.signal;
      void (async () => {
        try {
          const r = await fetchWithTimeout(
            `${API_V1_BASE}/users/search?q=${encodeURIComponent(normalizeConnectUserSearchQuery(q))}&limit=20`,
            { headers: groupInfoAuthHeaders(), signal: runSignal },
          );
          if (r.status === 401) {
            onUnauthorized();
            setAddMemberSearching(false);
            return;
          }
          if (r.status !== 200) {
            setAddMemberResults([]);
            setAddMemberSearching(false);
            return;
          }
          const data = (await r.json()) as UserSearchResultRow[];
          const mlist = members ?? group.members ?? [];
          const inGroup = new Set(mlist.map((x) => x.user_id));
          const filtered = (Array.isArray(data) ? data : []).filter(
            (u) => u.id !== selfId && !inGroup.has(u.id),
          );
          setAddMemberResults(filtered);
        } catch (e) {
          if (isAbortError(e)) return;
          setAddMemberResults([]);
        } finally {
          setAddMemberSearching(false);
        }
      })();
    }, 400);
    return () => clearTimeout(t);
  }, [
    addMemberQuery,
    addMemberOpen,
    group.id,
    selfId,
    members,
    group.members,
    onUnauthorized,
  ]);

  const sendGroupInvite = useCallback(
    async (row: UserSearchResultRow) => {
      try {
        setInvitingUserId(row.id);
        const r = await fetchWithTimeout(
          `${API_V1_BASE}/invitations/group/${encodeURIComponent(group.id)}/invite`,
          {
            method: "POST",
            headers: {
              ...(groupInfoAuthHeaders() as Record<string, string>),
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ user_id: row.id }),
            signal: masterAbortRef.current?.signal,
          },
        );
        if (r.status === 401) {
          onUnauthorized();
          return;
        }
        if (r.status === 200 || r.status === 201 || r.status === 204) {
          setAddMemberInvite((k) => ({ ...k, [row.id]: "invited" }));
          showToast(`Invitation sent to ${row.full_name}!`, "success");
          void refetchPendingInvites();
          return;
        }
        if (r.status === 409) {
          setAddMemberInvite((k) => ({ ...k, [row.id]: "already" }));
          return;
        }
        showToast("Failed to send invite", "error");
      } catch (e) {
        if (isAbortError(e)) return;
        showToast("Failed to send invite", "error");
      } finally {
        setInvitingUserId(null);
      }
    },
    [group.id, onUnauthorized, showToast, refetchPendingInvites],
  );

  useEffect(() => {
    setMemberBalances({});
    setShowAllMembers(false);
  }, [group.id]);

  const myTripNet = useMemo(() => {
    if (!expenseSummary || !selfId) return 0;
    return netForUserInTripSummary(expenseSummary, selfId);
  }, [expenseSummary, selfId]);

  const pendingPeopleCount = useMemo(() => {
    if (!expenseSummary) return 0;
    const ids = new Set<string>();
    for (const r of expenseSummary) {
      if (Math.abs(r.amount) >= 0.01) {
        ids.add(String(r.from_user_id).toLowerCase());
        ids.add(String(r.to_user_id).toLowerCase());
      }
    }
    return ids.size;
  }, [expenseSummary]);

  const travelLeaveDisabled =
    isTravel && firstTrip && !summaryLoading
      ? Math.abs(myTripNet) > 0.01
      : false;

  const openMemberSheet = (m: GroupMemberOut) => {
    if (m.user_id === selfId) return;
    memberDetailFetchAbortRef.current?.abort();
    const ac = new AbortController();
    memberDetailFetchAbortRef.current = ac;
    const panelSig = masterAbortRef.current?.signal;
    if (panelSig) {
      if (panelSig.aborted) {
        return;
      }
      const onPanelAbort = () => ac.abort();
      panelSig.addEventListener("abort", onPanelAbort, { once: true });
    }
    setMemberSheet(m);
    setMemberSheetDetail(null);
    void (async () => {
      try {
        const r = await fetchWithTimeout(
          `${API_V1_BASE}/users/${encodeURIComponent(m.user_id)}/balance`,
          { headers: groupInfoAuthHeaders(), signal: ac.signal },
        );
        if (r.status === 200) {
          const d = (await r.json()) as {
            total_net: number;
            by_group: { group_id: string; group_name: string; net_amount: number }[];
          };
          setMemberSheetDetail({
            total_net: d.total_net ?? 0,
            by_group: Array.isArray(d.by_group) ? d.by_group : [],
          });
          if (typeof d.total_net === "number")
            setMemberBalances((b) => ({ ...b, [m.user_id]: d.total_net }));
        }
      } catch (e) {
        if (isAbortError(e)) return;
        setMemberSheetDetail({ total_net: 0, by_group: [] });
      }
    })();
  };

  const callLeaveOnce = async (): Promise<
    "ok" | "deleted" | "needs_admin" | "balance" | "error"
  > => {
    try {
      const r = await fetchWithTimeout(
        `${API_V1_BASE}/groups/${encodeURIComponent(group.id)}/leave`,
        {
          method: "DELETE",
          headers: groupInfoAuthHeaders(),
          signal: masterAbortRef.current?.signal,
        },
      );
      if (r.status === 401) {
        onUnauthorized();
        return "error";
      }
      if (r.status === 200 || r.status === 204) {
        try {
          const body = (await r.clone().json()) as { deleted?: boolean };
          return body?.deleted ? "deleted" : "ok";
        } catch {
          return "ok";
        }
      }
      if (r.status === 400) {
        let detail = "";
        try {
          const j = (await r.json()) as { detail?: string };
          detail = (j?.detail ?? "").toLowerCase();
        } catch {
          /* ignore */
        }
        if (detail.includes("admin")) return "needs_admin";
        if (detail.includes("balance") || detail.includes("settle"))
          return "balance";
      }
      return "error";
    } catch (e) {
      if (isAbortError(e)) return "error";
      return "error";
    }
  };

  const doLeave = async () => {
    const name = group.name;
    if (
      !window.confirm(
        `Leave ${name}? You will lose access to all messages.`,
      )
    )
      return;
    const result = await callLeaveOnce();
    if (result === "ok") {
      showToast("Left group", "success");
      onLeaveSuccess(group.id);
      return;
    }
    if (result === "deleted") {
      showToast("Group dissolved", "success");
      onLeaveSuccess(group.id);
      return;
    }
    if (result === "balance") {
      showToast(
        "Settle your balance before leaving this travel group",
        "error",
      );
      return;
    }
    if (result === "needs_admin") {
      const others = (members ?? group.members).filter(
        (m) => m.user_id !== selfId,
      );
      if (others.length === 0) {
        showToast("Cannot leave: no other members to promote", "error");
        return;
      }
      setReassignPickerOpen(true);
      return;
    }
    showToast("Could not leave group", "error");
  };

  const reassignAndLeave = async (newAdminUserId: string) => {
    const ok = await setMemberRoleApi(newAdminUserId, "admin");
    if (!ok) return;
    setReassignPickerOpen(false);
    const result = await callLeaveOnce();
    if (result === "ok" || result === "deleted") {
      showToast("Left group", "success");
      onLeaveSuccess(group.id);
      return;
    }
    if (result === "balance") {
      showToast(
        "Settle your balance before leaving this travel group",
        "error",
      );
      return;
    }
    showToast("Could not leave group", "error");
  };

  const doCloseGroup = async () => {
    try {
      const r = await fetchWithTimeout(
        `${API_V1_BASE}/groups/${encodeURIComponent(group.id)}/close-check`,
        {
          headers: groupInfoAuthHeaders(),
          signal: masterAbortRef.current?.signal,
        },
      );
      if (r.status === 401) {
        onUnauthorized();
        return;
      }
      if (r.status !== 200) {
        showToast("Could not check group", "error");
        return;
      }
      const d = (await r.json()) as {
        can_close: boolean;
        pending_member_count: number;
      };
      if (!d.can_close) {
        globalThis.alert(
          `Cannot close — ${d.pending_member_count} members still have pending balances`,
        );
        return;
      }
      if (
        !window.confirm(
          `Delete group "${group.name}"? This cannot be undone.`,
        )
      )
        return;
      const del = await fetchWithTimeout(
        `${API_V1_BASE}/groups/${encodeURIComponent(group.id)}`,
        {
          method: "DELETE",
          headers: groupInfoAuthHeaders(),
          signal: masterAbortRef.current?.signal,
        },
      );
      if (del.status === 401) {
        onUnauthorized();
        return;
      }
      if (del.status === 204 || del.status === 200) {
        showToast("Group closed", "success");
        onLeaveSuccess(group.id);
        return;
      }
      showToast("Group delete is not available", "error");
    } catch (e) {
      if (isAbortError(e)) return;
      showToast("Could not close group", "error");
    }
  };

  const copyCode = async () => {
    const code = group.invite_code ?? "";
    if (!code) {
      void refreshGroupDetail();
      return;
    }
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      showToast("Could not copy", "error");
    }
  };

  const reloadMembers = useCallback(async () => {
    try {
      const r = await fetchWithTimeout(
        `${API_V1_BASE}/groups/${encodeURIComponent(group.id)}/members`,
        {
          headers: groupInfoAuthHeaders(),
          signal: masterAbortRef.current?.signal,
        },
      );
      if (r.status === 401) {
        onUnauthorized();
        return;
      }
      if (r.status === 200) {
        const list = (await r.json()) as GroupMemberOut[];
        setMembers(Array.isArray(list) ? list : []);
      }
    } catch (e) {
      if (isAbortError(e)) return;
    }
  }, [group.id, onUnauthorized, masterAbortRef]);

  const setMemberRoleApi = async (
    userId: string,
    role: "admin" | "member",
  ): Promise<boolean> => {
    setMemberActionLoading(true);
    try {
      const r = await fetchWithTimeout(
        `${API_V1_BASE}/groups/${encodeURIComponent(group.id)}/members/${encodeURIComponent(userId)}/role`,
        {
          method: "PATCH",
          headers: {
            ...groupInfoAuthHeaders(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ role }),
          signal: masterAbortRef.current?.signal,
        },
      );
      if (r.status === 401) {
        onUnauthorized();
        return false;
      }
      if (r.status === 200) {
        await reloadMembers();
        return true;
      }
      let detail = "";
      try {
        const j = (await r.json()) as { detail?: string };
        detail = j?.detail ?? "";
      } catch {
        /* ignore */
      }
      showToast(detail || "Could not update role", "error");
      return false;
    } catch (e) {
      if (isAbortError(e)) return false;
      showToast("Could not update role", "error");
      return false;
    } finally {
      setMemberActionLoading(false);
    }
  };

  const removeMemberApi = async (userId: string): Promise<boolean> => {
    setMemberActionLoading(true);
    try {
      const r = await fetchWithTimeout(
        `${API_V1_BASE}/groups/${encodeURIComponent(group.id)}/members/${encodeURIComponent(userId)}`,
        {
          method: "DELETE",
          headers: groupInfoAuthHeaders(),
          signal: masterAbortRef.current?.signal,
        },
      );
      if (r.status === 401) {
        onUnauthorized();
        return false;
      }
      if (r.status === 204 || r.status === 200) {
        await reloadMembers();
        return true;
      }
      let detail = "";
      try {
        const j = (await r.json()) as { detail?: string };
        detail = j?.detail ?? "";
      } catch {
        /* ignore */
      }
      showToast(detail || "Could not remove member", "error");
      return false;
    } catch (e) {
      if (isAbortError(e)) return false;
      showToast("Could not remove member", "error");
      return false;
    } finally {
      setMemberActionLoading(false);
    }
  };

  const shareLink = async () => {
    const code = group.invite_code ?? "";
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    const link = `${origin}/?invite=${encodeURIComponent(code)}`;
    try {
      await navigator.clipboard.writeText(link);
      showToast("Link copied", "success");
    } catch {
      showToast("Could not copy link", "error");
    }
  };

  const memberList = members ?? group.members;
  const memberCount = memberList.length;
  const listSlice = showAllMembers
    ? memberList
    : memberList.slice(0, 10);
  const displayName = group.name || "Group";
  const init = initialsFromName(displayName);
  const avBg = listAvatarColor(displayName);
  const desc =
    (group.description ?? "").trim() || "";

  const tripStatusBadge = (s: string) => {
    const u = s.toLowerCase();
    if (u === "ongoing")
      return (
        <span
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold"
          style={{ background: "rgba(29, 158, 117, 0.2)", color: GI_GREEN }}
        >
          <ThStatusDot color={GI_GREEN} />
          Ongoing
        </span>
      );
    if (u === "planning" || u === "confirmed")
      return (
        <span
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold"
          style={{ background: "rgba(59, 130, 246, 0.2)", color: "#60a5fa" }}
        >
          <ThStatusDot color="#60a5fa" />
          Upcoming
        </span>
      );
    if (u === "completed" || u === "cancelled")
      return (
        <span
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium"
          style={{ color: "#9ca3af" }}
        >
          <ThStatusDot color="#9ca3af" />
          Completed
        </span>
      );
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium"
        style={{ color: "#9ca3af" }}
      >
        <ThStatusDot color="#9ca3af" />
        {s}
      </span>
    );
  };

  const formatMoneyInr = (n: number) => {
    const a = Math.abs(n);
    return `₹${a.toFixed(2)}`;
  };

  const rolePill = (m: GroupMemberOut) => {
    const isAdm = String(m.role ?? "").toLowerCase() === "admin";
    return (
      <span
        className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
        style={{
          background: isAdm ? "#f0a500" : GI_ACTION_BG,
          color: isAdm ? GI_TEXT : GI_MUTED,
        }}
      >
        {isAdm ? "Admin" : "Member"}
      </span>
    );
  };

  const cardBase =
    "mb-3 rounded-[12px] p-4";
  const cardStyle: CSSProperties = {
    background: GI_CARD,
    border: `1px solid ${GI_SECTION_BORDER}`,
  };

  return (
    <div
      className="flex min-h-0 min-w-0 flex-1 flex-col transition-opacity duration-200"
      style={{
        background: GI_BG,
        opacity: panelOpacity,
      }}
    >
      <div
        className="min-h-0 flex-1 custom-scrollbar overflow-y-auto"
        style={{ background: GI_BG }}
      >
        <div className="relative">
          <button
            type="button"
            className="absolute right-3 top-3 z-20 rounded p-1.5 hover:bg-black/5"
            style={{ color: GI_MUTED }}
            onClick={onClose}
            aria-label="Close group info"
          >
            <X className="h-5 w-5" strokeWidth={2.5} />
          </button>
          <div
            className="h-[100px] w-full"
            style={
              isTravel
                ? {
                    background: GI_ACTION_BG,
                    borderBottom: `2px solid ${GI_CORAL}`,
                  }
                : { background: GI_ACTION_BG, borderBottom: `1px solid ${GI_SECTION_BORDER}` }
            }
          />
          <div className="flex flex-col items-center px-4 pb-4 pt-0">
            <div
              className="relative -mt-8 flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-[3px] border-white text-lg font-bold text-white"
              style={{ background: avBg }}
            >
              {init}
            </div>
            <p className="mt-2 flex items-center justify-center gap-0.5 text-center text-base font-bold" style={{ color: GI_TEXT }}>
              <span>{displayName}</span>
              {isTravel ? (
                <span
                  className="inline-flex shrink-0"
                  style={{ color: GI_CORAL }}
                  aria-label="Travel group"
                >
                  <ThIconPlane size={14} className="text-current" />
                </span>
              ) : null}
            </p>
            <p className="text-center text-xs" style={{ color: GI_MUTED }}>
              {memberCount} {memberCount === 1 ? "member" : "members"}
            </p>
            <div className="mt-4 flex w-full max-w-sm justify-center gap-2">
              {(
                [
                  { key: "search", label: "Search" as const },
                  { key: "voice", label: "Voice" as const },
                  { key: "video", label: "Video" as const },
                  { key: "schedule", label: "Schedule" as const },
                  { key: "more", label: "More" as const },
                ] as const
              ).map((row) => {
                const iconNode =
                  row.key === "search" ? (
                    <ThIconSearch size={18} className="text-[#1e2a3a]" />
                  ) : row.key === "voice" ? (
                    <ThIconPhoneHandset size={18} className="text-[#1e2a3a]" />
                  ) : row.key === "video" ? (
                    <ThIconVideoCam size={18} className="text-[#1e2a3a]" />
                  ) : row.key === "schedule" ? (
                    <Calendar
                      className="h-[18px] w-[18px] text-[#1e2a3a]"
                      strokeWidth={2}
                    />
                  ) : (
                    <ThIconMoreDots size={18} className="text-[#1e2a3a]" />
                  );
                return (
                <div key={row.key} className="relative flex-1" ref={row.key === "more" ? actionMoreRef : undefined}>
                  <button
                    type="button"
                    className="flex h-11 w-full flex-col items-center justify-center gap-0.5 rounded-xl"
                    style={{ background: GI_ACTION_BG, minHeight: 44, color: GI_TEXT }}
                    onClick={() => {
                      if (row.key === "search") {
                        onSearchInGroupChat();
                      } else if (row.key === "voice") {
                        onVoiceCall();
                      } else if (row.key === "video") {
                        onVideoCall();
                      } else if (row.key === "schedule") {
                        onScheduleCall();
                      } else {
                        setActionMoreOpen((o) => !o);
                      }
                    }}
                  >
                    {iconNode}
                    <span className="text-[10px]" style={{ color: GI_MUTED }}>
                      {row.label}
                    </span>
                  </button>
                  {row.key === "more" && actionMoreOpen ? (
                    <div
                      className="absolute bottom-full left-0 right-0 z-30 mb-1 overflow-hidden rounded-lg border py-1 shadow-xl"
                      style={{ background: GI_CARD, borderColor: GI_SECTION_BORDER }}
                    >
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-xs hover:bg-black/5"
                        style={{ color: GI_TEXT }}
                        onClick={() => {
                          setActionMoreOpen(false);
                          onToggleFavorite();
                        }}
                      >
                        {isFavorite
                          ? "Remove from Favorites"
                          : "Add to Favorites"}
                      </button>
                      {isTravel ? (
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left text-xs hover:bg-black/5"
                          style={{ color: GI_GREEN }}
                          onClick={() => {
                            setActionMoreOpen(false);
                            onClose();
                            onViewFullSplit();
                          }}
                        >
                          Settle up
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-xs hover:bg-black/5"
                        style={{ color: GI_TEXT }}
                        onClick={() => {
                          setActionMoreOpen(false);
                          onClearChat();
                        }}
                      >
                        Clear Chat
                      </button>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-xs hover:bg-black/5"
                        style={{ color: GI_TEXT }}
                        onClick={() => {
                          setActionMoreOpen(false);
                          showToast("Notifications muted (local)", "success");
                        }}
                      >
                        Mute Notifications
                      </button>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-xs hover:bg-black/5"
                        style={{ color: GI_CORAL }}
                        onClick={() => {
                          setActionMoreOpen(false);
                          globalThis.alert("Report submitted. We'll review this group.");
                        }}
                      >
                        Report Group
                      </button>
                    </div>
                  ) : null}
                </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="px-3 pb-6">
          {scheduledCalls.length > 0 ? (
            <div className={cardBase} style={cardStyle}>
              <div className="mb-2 flex items-center justify-between">
                <p
                  className="text-xs font-bold uppercase tracking-wide"
                  style={{ color: GI_MUTED }}
                >
                  Scheduled calls
                </p>
                <button
                  type="button"
                  className="rounded-md px-2 py-1 text-[11px] font-semibold hover:bg-black/5"
                  style={{ color: GI_CORAL }}
                  onClick={onScheduleCall}
                >
                  + New
                </button>
              </div>
              <ul className="space-y-2">
                {scheduledCalls.map((s) => {
                  const upcoming = s.at >= Date.now();
                  return (
                    <li
                      key={s.id}
                      className="flex items-center gap-2 rounded-lg border px-3 py-2"
                      style={{
                        borderColor: GI_SECTION_BORDER,
                        background: GI_ACTION_BG,
                        opacity: upcoming ? 1 : 0.6,
                      }}
                    >
                      <Calendar
                        className="h-4 w-4 shrink-0"
                        strokeWidth={1.8}
                        style={{ color: GI_TEXT }}
                      />
                      <div className="min-w-0 flex-1">
                        <p
                          className="truncate text-xs font-semibold"
                          style={{ color: GI_TEXT }}
                        >
                          {s.title}
                        </p>
                        <p
                          className="text-[11px]"
                          style={{ color: GI_MUTED }}
                        >
                          {new Date(s.at).toLocaleString()}
                          {!upcoming ? " · past" : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="shrink-0 rounded p-1 hover:bg-black/5"
                        style={{ color: GI_MUTED }}
                        aria-label="Remove reminder"
                        onClick={() => removeScheduledCall(s.id)}
                      >
                        <X className="h-4 w-4" strokeWidth={1.8} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
          {isTravel && firstTrip && !tripsLoading ? (
            <div
              className="mb-3 flex items-center justify-between gap-2 rounded-full border px-3 py-2"
              style={cardStyle}
            >
              <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium" style={{ color: GI_TEXT }}>
                <ThIconPlane size={14} className="shrink-0 text-[#1e2a3a]" />
                <span>
                  {formatTripBarDate(firstTrip.start_date)} &nbsp;&rarr;{" "}
                  {formatTripBarDate(firstTrip.end_date)}
                </span>
              </span>
              {tripStatusBadge(String(firstTrip.status))}
            </div>
          ) : null}

          {isTravel && firstTrip ? (
            <div className={cardBase} style={cardStyle}>
              <div className="mb-2 flex items-center justify-between">
                <p
                  className="text-[11px] font-bold uppercase"
                  style={{ color: GI_MUTED, letterSpacing: "0.06em" }}
                >
                  Split Activity
                </p>
                {Math.abs(myTripNet) >= 0.01 ? (
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                    style={{
                      background:
                        myTripNet > 0
                          ? "rgba(29,158,117,0.15)"
                          : "rgba(255,107,107,0.15)",
                      color: myTripNet > 0 ? GI_GREEN : GI_CORAL,
                    }}
                  >
                    {myTripNet > 0 ? "You're owed" : "You owe"}
                  </span>
                ) : (
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                    style={{
                      background: "rgba(29,158,117,0.15)",
                      color: GI_GREEN,
                    }}
                  >
                    All settled
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div
                  className="rounded-lg border px-2.5 py-2 text-center"
                  style={{
                    background: GI_ACTION_BG,
                    borderColor: GI_SECTION_BORDER,
                  }}
                >
                  <p className="text-[10px] uppercase" style={{ color: GI_MUTED }}>
                    Group total
                  </p>
                  <p
                    className="mt-0.5 truncate text-sm font-bold"
                    style={{ color: GI_TEXT }}
                    title={
                      budgetTotals ? String(budgetTotals.total) : undefined
                    }
                  >
                    {budgetTotals
                      ? `₹${budgetTotals.total.toFixed(0)}`
                      : summaryLoading
                        ? "…"
                        : "—"}
                  </p>
                </div>
                <div
                  className="rounded-lg border px-2.5 py-2 text-center"
                  style={{
                    background: GI_ACTION_BG,
                    borderColor: GI_SECTION_BORDER,
                  }}
                >
                  <p className="text-[10px] uppercase" style={{ color: GI_MUTED }}>
                    Expenses
                  </p>
                  <p
                    className="mt-0.5 text-sm font-bold"
                    style={{ color: GI_TEXT }}
                  >
                    {budgetTotals ? budgetTotals.expenses : "—"}
                  </p>
                </div>
                <div
                  className="rounded-lg border px-2.5 py-2 text-center"
                  style={{
                    background: GI_ACTION_BG,
                    borderColor: GI_SECTION_BORDER,
                  }}
                >
                  <p className="text-[10px] uppercase" style={{ color: GI_MUTED }}>
                    Pending
                  </p>
                  <p
                    className="mt-0.5 text-sm font-bold"
                    style={{
                      color: pendingPeopleCount > 0 ? GI_CORAL : GI_GREEN,
                    }}
                  >
                    {pendingPeopleCount}
                  </p>
                </div>
              </div>
              <div
                className="mt-3 flex items-center justify-between rounded-lg border px-3 py-2"
                style={{
                  borderColor: GI_SECTION_BORDER,
                  background:
                    Math.abs(myTripNet) < 0.01
                      ? GI_ACTION_BG
                      : myTripNet > 0
                        ? "rgba(29,158,117,0.08)"
                        : "rgba(255,107,107,0.08)",
                }}
              >
                <span className="text-xs" style={{ color: GI_MUTED }}>
                  Your balance
                </span>
                <span
                  className="text-sm font-bold"
                  style={{
                    color:
                      Math.abs(myTripNet) < 0.01
                        ? GI_MUTED
                        : myTripNet > 0
                          ? GI_GREEN
                          : GI_CORAL,
                  }}
                >
                  {Math.abs(myTripNet) < 0.01
                    ? "₹0"
                    : myTripNet > 0
                      ? `+₹${myTripNet.toFixed(2)}`
                      : `-₹${Math.abs(myTripNet).toFixed(2)}`}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="min-w-0 flex-1 rounded-xl py-2.5 text-sm font-semibold"
                  style={{ background: GI_ACTION_BG, color: GI_TEXT }}
                  onClick={() => {
                    onClose();
                    onViewFullSplit();
                  }}
                >
                  View full split
                </button>
                <button
                  type="button"
                  className="min-w-0 flex-1 rounded-xl py-2.5 text-sm font-semibold text-white"
                  style={{ background: GI_GREEN }}
                  onClick={() => {
                    onClose();
                    onViewFullSplit();
                  }}
                >
                  Settle up
                </button>
              </div>
            </div>
          ) : null}

          {isTravel ? (
            <div className={cardBase} style={cardStyle}>
              <p
                className="mb-2.5 text-[11px] font-bold uppercase"
                style={{ color: GI_MUTED, letterSpacing: "0.06em" }}
              >
                Trip Details
              </p>
              {!firstTrip && !tripsLoading ? (
                <p className="text-sm" style={{ color: GI_MUTED }}>
                  No trip linked to this group yet
                </p>
              ) : firstTrip ? (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span style={{ color: GI_MUTED }}>Status</span>
                  <span className="text-right font-medium" style={{ color: GI_TEXT }}>
                    {String(firstTrip.status)}
                  </span>
                  <span style={{ color: GI_MUTED }}>Created</span>
                  <span className="text-right" style={{ color: GI_TEXT }}>
                    {formatTripBarDate(
                      firstTrip.created_at,
                      "—",
                    )}
                  </span>
                </div>
              ) : (
                <div className="h-4 animate-pulse rounded bg-[#e8d5b7]/50" />
              )}
            </div>
          ) : null}

          {!isTravel ? (
            <div className={cardBase} style={cardStyle}>
              <p
                className="mb-2.5 text-[11px] font-bold uppercase"
                style={{ color: GI_MUTED, letterSpacing: "0.06em" }}
              >
                Description
              </p>
              <p
                className="text-sm leading-relaxed"
                style={{ color: desc ? GI_TEXT : GI_MUTED }}
              >
                {desc || "No description added"}
              </p>
            </div>
          ) : null}

          <div
            className="mb-3 mx-3 rounded-[12px] p-4"
            style={cardStyle}
          >
            <div
              className="mb-2.5 flex gap-1 border-b pb-2"
              style={{ borderColor: GI_SECTION_BORDER }}
            >
              {(["media", "links", "docs"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  className="flex-1 rounded-lg py-1.5 text-center text-[11px] font-bold uppercase"
                  style={{
                    color: infoMediaTab === t ? GI_TEXT : GI_MUTED,
                    background:
                      infoMediaTab === t ? GI_ACTION_BG : "transparent",
                    letterSpacing: "0.06em",
                  }}
                  onClick={() => setInfoMediaTab(t)}
                >
                  {t === "media" ? "MEDIA" : t === "links" ? "LINKS" : "DOCS"}
                </button>
              ))}
            </div>
            <p className="py-3 text-center text-sm" style={{ color: GI_MUTED }}>
              No {infoMediaTab} yet
            </p>
          </div>

          <div className={cardBase} style={cardStyle}>
            <div className="mb-2.5">
              <div className="flex items-center justify-between gap-2">
                <p
                  className="min-w-0 flex-1 text-[11px] font-bold leading-snug"
                  style={{ color: GI_MUTED, letterSpacing: "0.06em" }}
                >
                  <span className="uppercase">MEMBERS · {memberCount}</span>
                  {isAdmin &&
                  pendingInvitesCount != null &&
                  pendingInvitesCount > 0 ? (
                    <span
                      className="ml-1.5 text-[10px] font-normal normal-case tracking-normal"
                      style={{ color: GI_MUTED }}
                    >
                      ({pendingInvitesCount} pending)
                    </span>
                  ) : null}
                </p>
                {isAdmin ? (
                  <button
                    type="button"
                    className="shrink-0 rounded border px-2 py-1 text-[11px] font-semibold"
                    style={{
                      borderColor: "#f0a500",
                      color: "#f0a500",
                      background: "transparent",
                    }}
                    onClick={() => {
                      setAddMemberOpen((o) => {
                        if (o) {
                          setAddMemberQuery("");
                          setAddMemberResults([]);
                        }
                        return !o;
                      });
                    }}
                  >
                    <span className="inline-flex items-center gap-1">
                      <ThIconPlus size={14} className="text-current" />
                      Add Member
                    </span>
                  </button>
                ) : null}
              </div>
              {isAdmin && addMemberOpen ? (
                <div
                  className="mb-3 mt-3 rounded-[10px] border p-3"
                  style={{
                    borderColor: GI_SECTION_BORDER,
                    background: GI_ACTION_BG,
                  }}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold" style={{ color: GI_TEXT }}>
                      Add Members
                    </span>
                    <button
                      type="button"
                      className="text-lg leading-none"
                      style={{ color: GI_MUTED }}
                      aria-label="Close add members"
                      onClick={() => {
                        setAddMemberOpen(false);
                        setAddMemberQuery("");
                        setAddMemberResults([]);
                      }}
                    >
                      ×
                    </button>
                  </div>
                  <div
                    className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5"
                    style={{ borderColor: GI_SECTION_BORDER, background: GI_CARD }}
                  >
                    <span className="inline-flex" style={{ color: GI_MUTED }} aria-hidden>
                      <ThIconSearch size={18} className="text-current" />
                    </span>
                    <input
                      type="search"
                      value={addMemberQuery}
                      onChange={(e) => setAddMemberQuery(e.target.value)}
                      placeholder="Search by name or email..."
                      className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#8896a0]"
                      style={{ color: GI_TEXT }}
                      autoComplete="off"
                    />
                  </div>
                  {addMemberSearching ? (
                    <p
                      className="mt-2 text-center text-xs"
                      style={{ color: GI_MUTED }}
                    >
                      Searching…
                    </p>
                  ) : null}
                  {addMemberQuery.trim().length > 0 &&
                  addMemberQuery.includes("@") &&
                  !addMemberSearching &&
                  addMemberResults.length === 0 ? (
                    <p
                      className="mt-2 text-center text-xs"
                      style={{ color: GI_MUTED }}
                    >
                      No account found for this email
                    </p>
                  ) : null}
                  {!addMemberSearching &&
                    addMemberQuery.trim().length > 0 &&
                    addMemberResults.length > 0 ? (
                      <ul className="mt-2 max-h-48 list-none space-y-0 custom-scrollbar overflow-y-auto p-0">
                        {addMemberResults.map((u) => {
                          const sub = formatUserSearchMeta(u);
                          const inv = addMemberInvite[u.id];
                          const av =
                            u.avatar_url?.trim() ||
                            u.profile_picture?.trim() ||
                            null;
                          return (
                            <li
                              key={u.id}
                              className="flex items-center gap-2 border-b py-2 last:border-b-0"
                              style={{ borderColor: GI_SECTION_BORDER }}
                            >
                              {av &&
                              !isInlineSvgDataUrlToSkipForPhoto(av) &&
                              !isLegacyDicebearUrl(av) ? (
                                <img
                                  src={av}
                                  alt=""
                                  className="h-9 w-9 shrink-0 rounded-full object-cover"
                                  width={36}
                                  height={36}
                                />
                              ) : (
                                <InitialsAvatar
                                  name={u.full_name}
                                  size={40}
                                />
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[13px] font-medium" style={{ color: GI_TEXT }}>
                                  {u.full_name}
                                </p>
                                <p
                                  className="truncate text-[11px]"
                                  style={{ color: GI_MUTED }}
                                >
                                  {sub.trim() || " "}
                                </p>
                              </div>
                              {inv === "invited" ? (
                                <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-emerald-400">
                                  <ThIconCheckCircle
                                    size={14}
                                    className="text-[#9ca3af]"
                                  />
                                  Invited
                                </span>
                              ) : inv === "already" ? (
                                <span
                                  className="shrink-0 text-xs font-medium"
                                  style={{ color: GI_MUTED }}
                                >
                                  Already invited
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  disabled={invitingUserId === u.id}
                                  className="shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-60"
                                  style={{ background: GI_CORAL }}
                                  onClick={() => {
                                    void sendGroupInvite(u);
                                  }}
                                >
                                  {invitingUserId === u.id ? "…" : "Add"}
                                </button>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                </div>
              ) : null}
            </div>
            {membersLoading && !memberList.length ? (
              <div className="space-y-2">
                <div className="h-9 animate-pulse rounded bg-[#e8d5b7]/50" />
                <div className="h-9 animate-pulse rounded bg-[#e8d5b7]/50" />
              </div>
            ) : null}
            {listSlice.map((m) => {
              const b = memberBalances[m.user_id];
              const hasB = typeof b === "number" && isTravel;
              const showAdminMenu = isAdmin && m.user_id !== selfId;
              return (
                <div
                  key={m.id ?? m.user_id}
                  className="mb-2 flex w-full items-center gap-2 rounded-lg py-1 last:mb-0"
                >
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-2 rounded-lg py-1 text-left hover:bg-black/[0.04]"
                  onClick={() => {
                    if (m.user_id === selfId) return;
                    if (isTravel) openMemberSheet(m);
                    else {
                      onClose();
                      void openDirectChat({
                        id: m.user_id,
                        full_name: m.full_name,
                        avatar_url: m.avatar_url ?? null,
                      });
                    }
                  }}
                >
                  {m.avatar_url ? (
                    <img
                      src={m.avatar_url}
                      alt=""
                      className="h-9 w-9 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ background: listAvatarColor(m.full_name) }}
                    >
                      {initialsFromName(m.full_name)}
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate text-[13px] font-bold" style={{ color: GI_TEXT }}>
                    {m.full_name}
                  </span>
                  {rolePill(m)}
                  {isTravel && hasB ? (
                    <span
                      className="shrink-0 text-xs font-semibold"
                      style={{
                        color:
                          Math.abs(b) < 0.01
                            ? "#9ca3af"
                            : b > 0
                              ? GI_GREEN
                              : GI_CORAL,
                      }}
                    >
                      {Math.abs(b) < 0.01
                        ? "₹0"
                        : b > 0
                          ? `+${formatMoneyInr(b)}`
                          : `-${formatMoneyInr(b)}`}
                    </span>
                  ) : null}
                </button>
                {showAdminMenu ? (
                  <button
                    type="button"
                    className="shrink-0 rounded p-1 hover:bg-black/[0.06]"
                    style={{ color: GI_MUTED }}
                    aria-label={`Manage ${m.full_name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setAdminAction(m);
                    }}
                  >
                    <ThIconMoreDots size={18} className="text-current" />
                  </button>
                ) : null}
                </div>
              );
            })}
            {memberCount > 10 && !showAllMembers ? (
              <button
                type="button"
                className="mt-1 text-sm font-medium"
                style={{ color: "#f0a500" }}
                onClick={() => setShowAllMembers(true)}
              >
                Show all {memberCount}
              </button>
            ) : null}
            {showAllMembers && memberCount > 10 ? (
              <button
                type="button"
                className="mt-1 text-sm"
                style={{ color: GI_MUTED }}
                onClick={() => setShowAllMembers(false)}
              >
                Show less
              </button>
            ) : null}
          </div>

          {isTravel ? (
            <div className={cardBase} style={cardStyle}>
              <p
                className="mb-2.5 text-[11px] font-bold uppercase"
                style={{ color: GI_MUTED, letterSpacing: "0.06em" }}
              >
                Group Validity
              </p>
              {firstTrip?.end_date ? (
                <p className="text-sm" style={{ color: GI_TEXT }}>
                  Expires: {formatTripBarDate(firstTrip.end_date)}
                </p>
              ) : null}
              <p className="mt-1 text-xs leading-relaxed" style={{ color: GI_MUTED }}>
                Admin can close group only after all balances are settled
              </p>
              {isAdmin ? (
                <button
                  type="button"
                  className="mt-3 w-full rounded-lg border py-2.5 text-sm"
                  style={{ borderColor: GI_SECTION_BORDER, color: GI_TEXT }}
                  onClick={() => void doCloseGroup()}
                >
                  Close Group
                </button>
              ) : null}
            </div>
          ) : null}

          <div className={cardBase} style={cardStyle}>
            <p
              className="mb-2.5 text-[11px] font-bold uppercase"
              style={{ color: GI_MUTED, letterSpacing: "0.06em" }}
            >
              Invite Link
            </p>
            {(() => {
              const code = group.invite_code ?? "";
              const origin =
                typeof window !== "undefined" ? window.location.origin : "";
              const link = code
                ? `${origin}/join?code=${encodeURIComponent(code)}`
                : "";
              const shareText = `Join ${group.name} on Group Travel: ${link}`;
              return (
                <>
                  <div className="flex items-center gap-2">
                    <div
                      className="flex-1 truncate text-sm"
                      style={{
                        background: GI_ACTION_BG,
                        color: GI_TEXT,
                        border: `1px solid ${GI_SECTION_BORDER}`,
                        borderRadius: 8,
                        padding: "8px 12px",
                      }}
                      title={link}
                    >
                      {link || (membersLoading ? "…" : "—")}
                    </div>
                    <button
                      type="button"
                      className="shrink-0 rounded-lg px-3 py-2 text-xs font-semibold"
                      style={{ background: GI_ACTION_BG, color: GI_TEXT }}
                      disabled={!link}
                      onClick={async () => {
                        if (!link) return;
                        try {
                          await navigator.clipboard.writeText(link);
                          setLinkCopied(true);
                          if (copiedTimerRef.current)
                            clearTimeout(copiedTimerRef.current);
                          copiedTimerRef.current = setTimeout(
                            () => setLinkCopied(false),
                            2000,
                          );
                        } catch {
                          showToast("Could not copy link", "error");
                        }
                      }}
                    >
                      {linkCopied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                  <p className="mt-2 text-[11px]" style={{ color: GI_MUTED }}>
                    Anyone with this link can request to join the group.
                    {code ? (
                      <>
                        {" "}
                        Code:{" "}
                        <span className="font-mono" style={{ color: GI_TEXT }}>
                          {code}
                        </span>
                      </>
                    ) : null}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-lg px-3 py-2 text-sm font-semibold"
                      style={{ background: GI_ACTION_BG, color: GI_TEXT }}
                      disabled={!link}
                      onClick={async () => {
                        if (!link) return;
                        const nav = navigator as Navigator & {
                          share?: (data: {
                            title?: string;
                            text?: string;
                            url?: string;
                          }) => Promise<void>;
                        };
                        try {
                          if (typeof nav.share === "function") {
                            await nav.share({
                              title: group.name,
                              text: `Join ${group.name} on Group Travel`,
                              url: link,
                            });
                            return;
                          }
                          await nav.clipboard.writeText(link);
                          showToast("Link copied", "success");
                        } catch {
                          /* user cancelled or no share api */
                        }
                      }}
                    >
                      Share Link
                    </button>
                    <button
                      type="button"
                      className="rounded-lg px-3 py-1.5 text-xs font-medium"
                      style={{ background: GI_ACTION_BG, color: "#25D366" }}
                      disabled={!link}
                      onClick={() => {
                        if (!link) return;
                        globalThis.open(
                          `https://wa.me/?text=${encodeURIComponent(shareText)}`,
                          "_blank",
                        );
                      }}
                    >
                      WhatsApp
                    </button>
                    <button
                      type="button"
                      className="rounded-lg px-3 py-1.5 text-xs font-medium"
                      style={{ background: GI_ACTION_BG, color: "#2AABEE" }}
                      disabled={!link}
                      onClick={() => {
                        if (!link) return;
                        globalThis.open(
                          `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(`Join ${group.name}`)}`,
                          "_blank",
                        );
                      }}
                    >
                      Telegram
                    </button>
                    <button
                      type="button"
                      className="rounded-lg px-3 py-1.5 text-xs font-medium"
                      style={{ background: GI_ACTION_BG, color: GI_TEXT }}
                      onClick={() => void copyCode()}
                    >
                      {copiedCode ? "Copied!" : "Copy Code"}
                    </button>
                  </div>
                </>
              );
            })()}
          </div>

          <div className="mb-2 rounded-[12px] p-4" style={cardStyle}>
            {isTravel && travelLeaveDisabled ? (
              <p
                className="mb-2 flex items-center gap-1.5 text-xs"
                style={{ color: GI_CORAL }}
              >
                <AlertTriangle
                  className="h-3.5 w-3.5 shrink-0"
                  strokeWidth={1.5}
                  aria-hidden
                />
                <span>
                  Cannot leave &mdash; ₹{Math.abs(myTripNet).toFixed(0)} pending
                </span>
              </p>
            ) : null}
            <button
              type="button"
              className="mb-2 w-full rounded-lg border py-2.5 text-sm font-semibold"
              style={{ borderColor: "#e17055", color: "#e17055" }}
              disabled={isTravel && travelLeaveDisabled}
              onClick={() => void doLeave()}
            >
              Leave Group
            </button>
            {isAdmin ? (
              <button
                type="button"
                className="mb-2 w-full rounded-lg py-2.5 text-sm font-bold text-white"
                style={{ background: "#dc2626" }}
                onClick={() => void doCloseGroup()}
              >
                Delete Group
              </button>
            ) : null}
            <button
              type="button"
              className="w-full rounded-lg border py-2.5 text-sm"
              style={{ borderColor: GI_SECTION_BORDER, color: GI_MUTED }}
              onClick={() => {
                globalThis.alert("Report submitted. We'll review this group.");
              }}
            >
              Report Group
            </button>
          </div>
        </div>
      </div>

      {memberSheet && isTravel ? (
        <div
          className="fixed inset-0 z-[400] flex items-end justify-center bg-black/50 p-0"
          onClick={() => {
            setMemberSheet(null);
            setMemberSheetDetail(null);
          }}
        >
          <div
            className="w-full max-w-lg rounded-t-2xl p-4 shadow-xl"
            style={{ background: GI_CARD }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between">
              <div className="flex items-center gap-2">
                {memberSheet.avatar_url ? (
                  <img
                    src={memberSheet.avatar_url}
                    alt=""
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
                    style={{ background: listAvatarColor(memberSheet.full_name) }}
                  >
                    {initialsFromName(memberSheet.full_name)}
                  </span>
                )}
                <p className="text-base font-bold" style={{ color: GI_TEXT }}>
                  {memberSheet.full_name}
                </p>
              </div>
              <button
                type="button"
                className="p-1"
                style={{ color: GI_MUTED }}
                onClick={() => {
                  setMemberSheet(null);
                  setMemberSheetDetail(null);
                }}
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm" style={{ color: GI_MUTED }}>
              Net balance with you:{" "}
              <span className="font-semibold" style={{ color: GI_TEXT }}>
                {memberSheetDetail
                  ? `₹${Number(memberSheetDetail.total_net).toFixed(2)}`
                  : "…"}
              </span>
            </p>
            <ul className="mt-2 max-h-32 custom-scrollbar overflow-y-auto text-sm">
              {(memberSheetDetail?.by_group ?? []).map((g) => (
                <li
                  key={g.group_id}
                  className="flex justify-between border-b py-1"
                  style={{ borderColor: GI_SECTION_BORDER }}
                >
                  <span style={{ color: GI_TEXT }}>{g.group_name}</span>
                  <span
                    className="font-mono"
                    style={{
                      color: g.net_amount > 0 ? GI_GREEN : g.net_amount < 0 ? GI_CORAL : GI_MUTED,
                    }}
                  >
                    ₹{g.net_amount.toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="mt-4 w-full rounded-xl py-2.5 text-sm font-bold text-white"
              style={{ background: GI_CORAL }}
              onClick={() => {
                const m = memberSheet;
                setMemberSheet(null);
                setMemberSheetDetail(null);
                void openDirectChat({
                  id: m.user_id,
                  full_name: m.full_name,
                  avatar_url: m.avatar_url ?? null,
                });
              }}
            >
              Message
            </button>
          </div>
        </div>
      ) : null}

      {adminAction ? (
        <div
          className="fixed inset-0 z-[400] flex items-end justify-center bg-black/50 sm:items-center"
          onClick={() => setAdminAction(null)}
        >
          <div
            className="w-full max-w-md rounded-t-2xl p-4 shadow-xl sm:rounded-2xl"
            style={{ background: GI_CARD }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center gap-3">
              {adminAction.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={adminAction.avatar_url}
                  alt=""
                  className="h-10 w-10 rounded-full object-cover"
                />
              ) : (
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{ background: listAvatarColor(adminAction.full_name) }}
                >
                  {initialsFromName(adminAction.full_name)}
                </span>
              )}
              <div className="min-w-0">
                <p
                  className="truncate text-sm font-semibold"
                  style={{ color: GI_TEXT }}
                >
                  {adminAction.full_name}
                </p>
                <p className="text-xs" style={{ color: GI_MUTED }}>
                  {String(adminAction.role) === "admin" ? "Admin" : "Member"}
                </p>
              </div>
            </div>

            <div className="space-y-1">
              <button
                type="button"
                disabled={memberActionLoading}
                className="w-full rounded-lg px-3 py-2.5 text-left text-sm hover:bg-black/[0.04] disabled:opacity-60"
                style={{ color: GI_TEXT }}
                onClick={() => {
                  const m = adminAction;
                  setAdminAction(null);
                  onClose();
                  void openDirectChat({
                    id: m.user_id,
                    full_name: m.full_name,
                    avatar_url: m.avatar_url ?? null,
                  });
                }}
              >
                Message {adminAction.full_name.split(" ")[0] || "member"}
              </button>
              {String(adminAction.role) === "admin" ? (
                <button
                  type="button"
                  disabled={memberActionLoading}
                  className="w-full rounded-lg px-3 py-2.5 text-left text-sm hover:bg-black/[0.04] disabled:opacity-60"
                  style={{ color: GI_TEXT }}
                  onClick={async () => {
                    const m = adminAction;
                    if (
                      !window.confirm(
                        `Demote ${m.full_name} to member?`,
                      )
                    )
                      return;
                    const ok = await setMemberRoleApi(m.user_id, "member");
                    if (ok) showToast("Member updated", "success");
                    setAdminAction(null);
                  }}
                >
                  Dismiss as admin
                </button>
              ) : (
                <button
                  type="button"
                  disabled={memberActionLoading}
                  className="w-full rounded-lg px-3 py-2.5 text-left text-sm hover:bg-black/[0.04] disabled:opacity-60"
                  style={{ color: GI_TEXT }}
                  onClick={async () => {
                    const m = adminAction;
                    const ok = await setMemberRoleApi(m.user_id, "admin");
                    if (ok)
                      showToast(
                        `${m.full_name} is now an admin`,
                        "success",
                      );
                    setAdminAction(null);
                  }}
                >
                  Make group admin
                </button>
              )}
              <div
                className="my-1 h-px w-full"
                style={{ background: GI_SECTION_BORDER }}
              />
              <button
                type="button"
                disabled={memberActionLoading}
                className="w-full rounded-lg px-3 py-2.5 text-left text-sm hover:bg-black/[0.04] disabled:opacity-60"
                style={{ color: GI_CORAL }}
                onClick={async () => {
                  const m = adminAction;
                  if (
                    !window.confirm(
                      `Remove ${m.full_name} from ${group.name}?`,
                    )
                  )
                    return;
                  const ok = await removeMemberApi(m.user_id);
                  if (ok)
                    showToast(
                      `Removed ${m.full_name}`,
                      "success",
                    );
                  setAdminAction(null);
                }}
              >
                Remove from group
              </button>
            </div>

            <button
              type="button"
              className="mt-3 w-full rounded-lg border py-2 text-sm"
              style={{ borderColor: GI_SECTION_BORDER, color: GI_MUTED }}
              onClick={() => setAdminAction(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {reassignPickerOpen ? (
        <div
          className="fixed inset-0 z-[400] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setReassignPickerOpen(false)}
        >
          <div
            className="flex w-full max-w-md flex-col overflow-hidden rounded-2xl shadow-xl"
            style={{ background: GI_CARD, maxHeight: "80vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 pt-4">
              <p
                className="text-base font-bold"
                style={{ color: GI_TEXT }}
              >
                Choose a new admin
              </p>
              <p className="mt-1 text-xs" style={{ color: GI_MUTED }}>
                You're the only admin of {group.name}. Promote a member, then
                you can leave.
              </p>
            </div>
            <ul className="flex-1 space-y-1 overflow-y-auto px-2 py-3">
              {(members ?? group.members)
                .filter((m) => m.user_id !== selfId)
                .map((m) => (
                  <li key={m.user_id}>
                    <button
                      type="button"
                      disabled={memberActionLoading}
                      className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-black/[0.04] disabled:opacity-60"
                      onClick={() => {
                        if (
                          !window.confirm(
                            `Make ${m.full_name} the new admin and leave?`,
                          )
                        )
                          return;
                        void reassignAndLeave(m.user_id);
                      }}
                    >
                      {m.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={m.avatar_url}
                          alt=""
                          className="h-9 w-9 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <span
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                          style={{ background: listAvatarColor(m.full_name) }}
                        >
                          {initialsFromName(m.full_name)}
                        </span>
                      )}
                      <span
                        className="min-w-0 flex-1 truncate text-sm"
                        style={{ color: GI_TEXT }}
                      >
                        {m.full_name}
                      </span>
                      {String(m.role) === "admin" ? (
                        <span
                          className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
                          style={{
                            background: "#f0a500",
                            color: GI_TEXT,
                          }}
                        >
                          Admin
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
            </ul>
            <div className="flex justify-end border-t p-3" style={{ borderColor: GI_SECTION_BORDER }}>
              <button
                type="button"
                className="rounded-lg px-3 py-1.5 text-sm"
                style={{ color: GI_MUTED }}
                onClick={() => setReassignPickerOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

type DmInfoPanelProps = {
  chatId: string;
  peerName: string;
  peerUsername: string | null;
  peerAvatarUrl: string | null;
  peerOnline: boolean | null;
  isFavorite: boolean;
  isMuted: boolean;
  onClose: () => void;
  onSearchInChat: () => void;
  onVoiceCall: () => void;
  onVideoCall: () => void;
  onScheduleCall: () => void;
  onClearChat: () => void;
  onBlockPeer: () => void;
  onReport: () => void;
  onToggleFavorite: () => void;
  onToggleMute: () => void;
  onViewFullProfile: () => void;
  scheduleVersion: number;
  onScheduleChanged: () => void;
};

function DmInfoPanel({
  chatId,
  peerName,
  peerUsername,
  peerAvatarUrl,
  peerOnline,
  isFavorite,
  isMuted,
  onClose,
  onSearchInChat,
  onVoiceCall,
  onVideoCall,
  onScheduleCall,
  onClearChat,
  onBlockPeer,
  onReport,
  onToggleFavorite,
  onToggleMute,
  onViewFullProfile,
  scheduleVersion,
  onScheduleChanged,
}: DmInfoPanelProps) {
  const [actionMoreOpen, setActionMoreOpen] = useState(false);
  const actionMoreRef = useRef<HTMLDivElement | null>(null);
  const [scheduledCalls, setScheduledCalls] = useState<
    {
      id: string;
      chatId: string;
      chatName: string;
      title: string;
      at: number;
    }[]
  >([]);

  useEffect(() => {
    if (!actionMoreOpen) return;
    const close = (e: MouseEvent) => {
      const el = actionMoreRef.current;
      if (el && !el.contains(e.target as Node)) setActionMoreOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [actionMoreOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("gt_scheduled_calls_v1");
      const list = raw
        ? (JSON.parse(raw) as {
            id: string;
            chatId: string;
            chatName: string;
            title: string;
            at: number;
          }[])
        : [];
      const filtered = list
        .filter((x) => x.chatId === chatId)
        .sort((a, b) => a.at - b.at);
      setScheduledCalls(filtered);
    } catch {
      setScheduledCalls([]);
    }
  }, [chatId, scheduleVersion]);

  const removeScheduledCall = (id: string) => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("gt_scheduled_calls_v1");
      const list = raw
        ? (JSON.parse(raw) as {
            id: string;
            chatId: string;
            chatName: string;
            title: string;
            at: number;
          }[])
        : [];
      const next = list.filter((x) => x.id !== id);
      window.localStorage.setItem(
        "gt_scheduled_calls_v1",
        JSON.stringify(next),
      );
      onScheduleChanged();
    } catch {
      /* ignore */
    }
  };

  const ini = initialsFromName(peerName);
  const avBg = listAvatarColor(peerName);
  const presenceText =
    peerOnline === true
      ? "Active now"
      : peerOnline === false
        ? "Last seen recently"
        : "Last seen recently";

  const cardBase = "mb-3 rounded-[12px] p-4";
  const cardStyle: CSSProperties = {
    background: GI_CARD,
    border: `1px solid ${GI_SECTION_BORDER}`,
  };

  return (
    <div
      className="flex min-h-0 min-w-0 flex-1 flex-col"
      style={{ background: GI_BG }}
    >
      <div
        className="min-h-0 flex-1 custom-scrollbar overflow-y-auto"
        style={{ background: GI_BG }}
      >
        <div className="relative">
          <button
            type="button"
            className="absolute right-3 top-3 z-20 rounded p-1.5 hover:bg-black/5"
            style={{ color: GI_MUTED }}
            onClick={onClose}
            aria-label="Close contact info"
          >
            <X className="h-5 w-5" strokeWidth={2.5} />
          </button>
          <div
            className="h-[100px] w-full"
            style={{
              background: GI_ACTION_BG,
              borderBottom: `1px solid ${GI_SECTION_BORDER}`,
            }}
          />
          <div className="flex flex-col items-center px-4 pb-4 pt-0">
            <div
              className="relative -mt-8 flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border-[3px] border-white text-lg font-bold text-white"
              style={{ background: avBg }}
            >
              {peerAvatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={peerAvatarUrl}
                  alt={peerName}
                  className="h-full w-full object-cover"
                />
              ) : (
                ini
              )}
            </div>
            <p
              className="mt-2 text-center text-base font-bold"
              style={{ color: GI_TEXT }}
            >
              {peerName}
            </p>
            {peerUsername ? (
              <p className="text-center text-xs" style={{ color: GI_MUTED }}>
                @{peerUsername}
              </p>
            ) : null}
            <p
              className="mt-0.5 inline-flex items-center gap-1 text-center text-xs"
              style={{ color: GI_MUTED }}
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{
                  background: peerOnline === true ? GI_GREEN : "#9ca3af",
                }}
                aria-hidden
              />
              {presenceText}
            </p>
            <div className="mt-4 flex w-full max-w-sm justify-center gap-2">
              {(
                [
                  { key: "search", label: "Search" as const },
                  { key: "voice", label: "Voice" as const },
                  { key: "video", label: "Video" as const },
                  { key: "schedule", label: "Schedule" as const },
                  { key: "more", label: "More" as const },
                ] as const
              ).map((row) => {
                const iconNode =
                  row.key === "search" ? (
                    <ThIconSearch size={18} className="text-[#1e2a3a]" />
                  ) : row.key === "voice" ? (
                    <ThIconPhoneHandset size={18} className="text-[#1e2a3a]" />
                  ) : row.key === "video" ? (
                    <ThIconVideoCam size={18} className="text-[#1e2a3a]" />
                  ) : row.key === "schedule" ? (
                    <Calendar
                      className="h-[18px] w-[18px] text-[#1e2a3a]"
                      strokeWidth={2}
                    />
                  ) : (
                    <ThIconMoreDots size={18} className="text-[#1e2a3a]" />
                  );
                return (
                  <div
                    key={row.key}
                    className="relative flex-1"
                    ref={row.key === "more" ? actionMoreRef : undefined}
                  >
                    <button
                      type="button"
                      className="flex h-11 w-full flex-col items-center justify-center gap-0.5 rounded-xl"
                      style={{
                        background: GI_ACTION_BG,
                        minHeight: 44,
                        color: GI_TEXT,
                      }}
                      onClick={() => {
                        if (row.key === "search") onSearchInChat();
                        else if (row.key === "voice") onVoiceCall();
                        else if (row.key === "video") onVideoCall();
                        else if (row.key === "schedule") onScheduleCall();
                        else setActionMoreOpen((o) => !o);
                      }}
                    >
                      {iconNode}
                      <span
                        className="text-[10px]"
                        style={{ color: GI_MUTED }}
                      >
                        {row.label}
                      </span>
                    </button>
                    {row.key === "more" && actionMoreOpen ? (
                      <div
                        className="absolute bottom-full left-0 right-0 z-30 mb-1 overflow-hidden rounded-lg border py-1 shadow-xl"
                        style={{
                          background: GI_CARD,
                          borderColor: GI_SECTION_BORDER,
                        }}
                      >
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left text-xs hover:bg-black/5"
                          style={{ color: GI_TEXT }}
                          onClick={() => {
                            setActionMoreOpen(false);
                            onToggleFavorite();
                          }}
                        >
                          {isFavorite
                            ? "Remove from Favorites"
                            : "Add to Favorites"}
                        </button>
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left text-xs hover:bg-black/5"
                          style={{ color: GI_TEXT }}
                          onClick={() => {
                            setActionMoreOpen(false);
                            onToggleMute();
                          }}
                        >
                          {isMuted ? "Unmute" : "Mute Notifications"}
                        </button>
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left text-xs hover:bg-black/5"
                          style={{ color: GI_TEXT }}
                          onClick={() => {
                            setActionMoreOpen(false);
                            onClearChat();
                          }}
                        >
                          Clear Chat
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="px-3 pb-6">
          {scheduledCalls.length > 0 ? (
            <div className={cardBase} style={cardStyle}>
              <div className="mb-2 flex items-center justify-between">
                <p
                  className="text-xs font-bold uppercase tracking-wide"
                  style={{ color: GI_MUTED }}
                >
                  Scheduled calls
                </p>
                <button
                  type="button"
                  className="rounded-md px-2 py-1 text-[11px] font-semibold hover:bg-black/5"
                  style={{ color: GI_CORAL }}
                  onClick={onScheduleCall}
                >
                  + New
                </button>
              </div>
              <ul className="space-y-2">
                {scheduledCalls.map((s) => {
                  const upcoming = s.at >= Date.now();
                  return (
                    <li
                      key={s.id}
                      className="flex items-center gap-2 rounded-lg border px-3 py-2"
                      style={{
                        borderColor: GI_SECTION_BORDER,
                        background: GI_ACTION_BG,
                        opacity: upcoming ? 1 : 0.6,
                      }}
                    >
                      <Calendar
                        className="h-4 w-4 shrink-0"
                        strokeWidth={1.8}
                        style={{ color: GI_TEXT }}
                      />
                      <div className="min-w-0 flex-1">
                        <p
                          className="truncate text-xs font-semibold"
                          style={{ color: GI_TEXT }}
                        >
                          {s.title}
                        </p>
                        <p
                          className="text-[11px]"
                          style={{ color: GI_MUTED }}
                        >
                          {new Date(s.at).toLocaleString()}
                          {!upcoming ? " · past" : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="shrink-0 rounded p-1 hover:bg-black/5"
                        style={{ color: GI_MUTED }}
                        aria-label="Remove reminder"
                        onClick={() => removeScheduledCall(s.id)}
                      >
                        <X className="h-4 w-4" strokeWidth={1.8} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          <button
            type="button"
            className={`${cardBase} flex w-full items-center justify-between text-left`}
            style={cardStyle}
            onClick={onViewFullProfile}
          >
            <span
              className="text-sm font-semibold"
              style={{ color: GI_TEXT }}
            >
              View full profile
            </span>
            <ThIconChevronRight size={18} className="text-[#8896a0]" />
          </button>

          <div className={cardBase} style={cardStyle}>
            <button
              type="button"
              className="flex w-full items-center justify-between py-2 text-left text-sm"
              style={{ color: GI_TEXT }}
              onClick={onClearChat}
            >
              Clear chat
              <ThIconChevronRight size={18} className="text-[#8896a0]" />
            </button>
            <div
              className="my-1 h-px w-full"
              style={{ background: GI_SECTION_BORDER }}
            />
            <button
              type="button"
              className="flex w-full items-center justify-between py-2 text-left text-sm"
              style={{ color: GI_CORAL }}
              onClick={onBlockPeer}
            >
              Block {peerName.split(" ")[0] || "user"}
              <ThIconChevronRight size={18} className="text-[#8896a0]" />
            </button>
            <div
              className="my-1 h-px w-full"
              style={{ background: GI_SECTION_BORDER }}
            />
            <button
              type="button"
              className="flex w-full items-center justify-between py-2 text-left text-sm"
              style={{ color: GI_CORAL }}
              onClick={onReport}
            >
              Report {peerName.split(" ")[0] || "user"}
              <ThIconChevronRight size={18} className="text-[#8896a0]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

type ConnectScreen =
  | "main"
  | "account"
  | "privacy"
  | "chats"
  | "notifications"
  | "storage"
  | "lists"
  | "language"
  | "help"
  | "invite"
  | "blocked"
  | "delete-account";

type ConnectPrefs = {
  account: {
    security_notifications: boolean;
    two_step_pin_set: boolean;
  };
  privacy: {
    last_seen: "everyone" | "contacts" | "nobody";
    profile_picture: "everyone" | "contacts" | "nobody";
    about: "everyone" | "contacts" | "nobody";
    status: "everyone" | "contacts" | "nobody";
    groups: "everyone" | "contacts" | "nobody";
    avatar_stickers: "everyone" | "contacts" | "nobody";
    live_location: boolean;
    silence_unknown_callers: boolean;
    read_receipts: boolean;
    default_disappearing_seconds: number;
    app_lock: boolean;
    chat_lock: boolean;
    camera_effects: boolean;
    ip_protect_calls: boolean;
    disable_link_previews: boolean;
  };
  chats: {
    theme: "light" | "dark" | "system";
    wallpaper: string;
    enter_is_send: boolean;
    media_visibility: boolean;
    font_size: "small" | "medium" | "large";
    keep_archived: boolean;
  };
  notifications: {
    conversation_tones: boolean;
    reminders: boolean;
    notification_tone: string;
    vibrate: "off" | "default" | "short" | "long";
    light: string;
    high_priority: boolean;
    reaction_notifications: boolean;
    call_notifications: boolean;
  };
  storage: {
    use_less_data_for_calls: boolean;
    media_upload_quality: "standard" | "hd";
    auto_download_quality: string;
    auto_download_mobile: string[];
    auto_download_wifi: string[];
    auto_download_roaming: string[];
  };
  language: string;
};

const VISIBILITY_OPTIONS: { value: "everyone" | "contacts" | "nobody"; label: string }[] = [
  { value: "everyone", label: "Everyone" },
  { value: "contacts", label: "My contacts" },
  { value: "nobody", label: "Nobody" },
];

const DISAPPEARING_OPTIONS = [
  { value: 0, label: "Off" },
  { value: 86400, label: "24 hours" },
  { value: 604800, label: "7 days" },
  { value: 7776000, label: "90 days" },
];

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English", sub: "(device's language)" },
  { value: "es", label: "Español", sub: "Spanish" },
  { value: "pt-br", label: "Português (Brasil)", sub: "Portuguese (Brazil)" },
  { value: "ar", label: "العربية", sub: "Arabic" },
  { value: "zh-cn", label: "简体中文", sub: "Simplified Chinese" },
  { value: "fr", label: "Français", sub: "French" },
  { value: "ru", label: "Русский", sub: "Russian" },
  { value: "vi", label: "Tiếng Việt", sub: "Vietnamese" },
  { value: "ko", label: "한국어", sub: "Korean" },
  { value: "hi", label: "हिन्दी", sub: "Hindi" },
  { value: "te", label: "తెలుగు", sub: "Telugu" },
  { value: "ta", label: "தமிழ்", sub: "Tamil" },
];

const visibilityLabel = (v: string) =>
  VISIBILITY_OPTIONS.find((o) => o.value === v)?.label ?? "Everyone";

const disappearingLabel = (n: number) =>
  DISAPPEARING_OPTIONS.find((o) => o.value === n)?.label ?? "Off";

function ConnectSettingsPanel({
  user,
  onClose,
  showToast,
  onShareInvite,
  onLogout,
}: {
  user: UserMe | null;
  onClose: () => void;
  showToast: (m: string, t?: "success" | "error") => void;
  onShareInvite: () => Promise<void> | void;
  onLogout: () => void;
}) {
  const router = useRouter();
  const [screen, setScreen] = useState<ConnectScreen>("main");
  const [prefs, setPrefs] = useState<ConnectPrefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  // Load prefs from /settings/app
  useEffect(() => {
    let cancel = false;
    void (async () => {
      try {
        const data = await apiFetch<{
          preferences: { connect?: Partial<ConnectPrefs> };
        }>("/settings/app");
        const c = data.preferences?.connect ?? {};
        if (!cancel) {
          setPrefs({
            account: {
              security_notifications: c.account?.security_notifications ?? true,
              two_step_pin_set: c.account?.two_step_pin_set ?? false,
            },
            privacy: {
              last_seen: c.privacy?.last_seen ?? "everyone",
              profile_picture: c.privacy?.profile_picture ?? "everyone",
              about: c.privacy?.about ?? "everyone",
              status: c.privacy?.status ?? "contacts",
              groups: c.privacy?.groups ?? "everyone",
              avatar_stickers: c.privacy?.avatar_stickers ?? "contacts",
              live_location: c.privacy?.live_location ?? false,
              silence_unknown_callers: c.privacy?.silence_unknown_callers ?? false,
              read_receipts: c.privacy?.read_receipts ?? true,
              default_disappearing_seconds:
                c.privacy?.default_disappearing_seconds ?? 0,
              app_lock: c.privacy?.app_lock ?? false,
              chat_lock: c.privacy?.chat_lock ?? false,
              camera_effects: c.privacy?.camera_effects ?? true,
              ip_protect_calls: c.privacy?.ip_protect_calls ?? false,
              disable_link_previews: c.privacy?.disable_link_previews ?? false,
            },
            chats: {
              theme: c.chats?.theme ?? "system",
              wallpaper: c.chats?.wallpaper ?? "default",
              enter_is_send: c.chats?.enter_is_send ?? false,
              media_visibility: c.chats?.media_visibility ?? true,
              font_size: c.chats?.font_size ?? "medium",
              keep_archived: c.chats?.keep_archived ?? false,
            },
            notifications: {
              conversation_tones: c.notifications?.conversation_tones ?? true,
              reminders: c.notifications?.reminders ?? true,
              notification_tone: c.notifications?.notification_tone ?? "default",
              vibrate: c.notifications?.vibrate ?? "default",
              light: c.notifications?.light ?? "white",
              high_priority: c.notifications?.high_priority ?? true,
              reaction_notifications:
                c.notifications?.reaction_notifications ?? true,
              call_notifications: c.notifications?.call_notifications ?? true,
            },
            storage: {
              use_less_data_for_calls:
                c.storage?.use_less_data_for_calls ?? false,
              media_upload_quality: c.storage?.media_upload_quality ?? "hd",
              auto_download_quality:
                c.storage?.auto_download_quality ?? "auto",
              auto_download_mobile: c.storage?.auto_download_mobile ?? [
                "photos",
              ],
              auto_download_wifi: c.storage?.auto_download_wifi ?? [
                "photos",
                "audio",
                "video",
                "docs",
              ],
              auto_download_roaming: c.storage?.auto_download_roaming ?? [],
            },
            language: c.language ?? "en",
          });
        }
      } catch {
        if (!cancel) setPrefs(null);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  // Patch helper: deep-merge a partial connect.* tree
  const patchPref = useCallback(
    async (partial: Record<string, unknown>) => {
      if (saving) return;
      setSaving(true);
      try {
        await apiFetch("/settings/app", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ preferences: { connect: partial } }),
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Could not save";
        showToast(msg, "error");
      } finally {
        setSaving(false);
      }
    },
    [saving, showToast],
  );

  const updateAccount = (k: keyof ConnectPrefs["account"], v: boolean) => {
    setPrefs((p) =>
      p ? { ...p, account: { ...p.account, [k]: v } } : p,
    );
    void patchPref({ account: { [k]: v } });
  };
  const updatePrivacy = <K extends keyof ConnectPrefs["privacy"]>(
    k: K,
    v: ConnectPrefs["privacy"][K],
  ) => {
    setPrefs((p) =>
      p ? { ...p, privacy: { ...p.privacy, [k]: v } } : p,
    );
    void patchPref({ privacy: { [k]: v } });
  };
  const updateChats = <K extends keyof ConnectPrefs["chats"]>(
    k: K,
    v: ConnectPrefs["chats"][K],
  ) => {
    setPrefs((p) => (p ? { ...p, chats: { ...p.chats, [k]: v } } : p));
    void patchPref({ chats: { [k]: v } });
  };
  const updateNotifications = <K extends keyof ConnectPrefs["notifications"]>(
    k: K,
    v: ConnectPrefs["notifications"][K],
  ) => {
    setPrefs((p) =>
      p ? { ...p, notifications: { ...p.notifications, [k]: v } } : p,
    );
    void patchPref({ notifications: { [k]: v } });
  };
  const updateStorage = <K extends keyof ConnectPrefs["storage"]>(
    k: K,
    v: ConnectPrefs["storage"][K],
  ) => {
    setPrefs((p) =>
      p ? { ...p, storage: { ...p.storage, [k]: v } } : p,
    );
    void patchPref({ storage: { [k]: v } });
  };
  const updateLanguage = (v: string) => {
    setPrefs((p) => (p ? { ...p, language: v } : p));
    void patchPref({ language: v });
  };

  const goExternal = (href: string) => {
    onClose();
    router.push(href);
  };

  const headerTitle =
    screen === "main"
      ? "Settings"
      : screen === "account"
        ? "Account"
        : screen === "privacy"
          ? "Privacy"
          : screen === "chats"
            ? "Chats"
            : screen === "notifications"
              ? "Notifications"
              : screen === "storage"
                ? "Storage and data"
                : screen === "lists"
                  ? "Lists"
                  : screen === "language"
                    ? "App language"
                    : screen === "help"
                      ? "Help and feedback"
                      : screen === "invite"
                        ? "Invite a contact"
                        : screen === "blocked"
                          ? "Blocked contacts"
                          : screen === "delete-account"
                            ? "Delete account"
                            : "Settings";

  const headerBack = () => {
    if (screen === "main") onClose();
    else if (screen === "blocked" || screen === "delete-account")
      setScreen("account");
    else setScreen("main");
  };

  const displayName = (user?.full_name ?? "").trim() || "You";
  const initials = initialsFromName(displayName);
  const avBg = listAvatarColor(displayName);

  return (
    <div
      className="fixed inset-0 z-[380] flex flex-col"
      style={{ background: "#ffffff" }}
    >
      <header
        className="flex shrink-0 items-center gap-3 border-b px-3 py-3"
        style={{ borderColor: "#e5e7eb", background: "#ffffff" }}
      >
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-black/5"
          aria-label="Back"
          onClick={headerBack}
        >
          <ThIconChevronLeft size={22} className="text-[#1e2a3a]" />
        </button>
        <h1
          className="flex-1 text-lg font-bold"
          style={{ color: "#1e2a3a" }}
        >
          {headerTitle}
        </h1>
        {saving ? (
          <Loader2
            className="h-4 w-4 animate-spin"
            style={{ color: "#9ca3af" }}
            aria-label="Saving"
          />
        ) : null}
      </header>

      <div className="flex-1 overflow-y-auto" style={{ background: "#ffffff" }}>
        {loading && screen === "main" ? (
          <div className="flex justify-center py-16">
            <Loader2
              className="h-6 w-6 animate-spin"
              style={{ color: "#9ca3af" }}
            />
          </div>
        ) : null}

        {screen === "main" && !loading ? (
          <ConnectMainScreen
            search={search}
            setSearch={setSearch}
            user={user}
            displayName={displayName}
            initials={initials}
            avBg={avBg}
            showToast={showToast}
            onShareInvite={onShareInvite}
            goExternal={goExternal}
            setScreen={setScreen}
          />
        ) : null}

        {screen === "account" && prefs ? (
          <ConnectAccountScreen
            user={user}
            prefs={prefs.account}
            onChange={updateAccount}
            onOpenDelete={() => setScreen("delete-account")}
            onOpenBlocked={() => setScreen("blocked")}
            onLogout={onLogout}
            showToast={showToast}
          />
        ) : null}

        {screen === "privacy" && prefs ? (
          <ConnectPrivacyScreen
            prefs={prefs.privacy}
            onChange={updatePrivacy}
            onOpenBlocked={() => setScreen("blocked")}
            showToast={showToast}
          />
        ) : null}

        {screen === "chats" && prefs ? (
          <ConnectChatsScreen
            prefs={prefs.chats}
            onChange={updateChats}
            showToast={showToast}
          />
        ) : null}

        {screen === "notifications" && prefs ? (
          <ConnectNotificationsScreen
            prefs={prefs.notifications}
            onChange={updateNotifications}
          />
        ) : null}

        {screen === "storage" && prefs ? (
          <ConnectStorageScreen
            prefs={prefs.storage}
            onChange={updateStorage}
            showToast={showToast}
          />
        ) : null}

        {screen === "lists" ? <ConnectListsScreen showToast={showToast} /> : null}

        {screen === "language" && prefs ? (
          <ConnectLanguageScreen
            value={prefs.language}
            onChange={updateLanguage}
          />
        ) : null}

        {screen === "help" ? (
          <ConnectHelpScreen showToast={showToast} goExternal={goExternal} />
        ) : null}

        {screen === "invite" ? (
          <ConnectInviteScreen onShareInvite={onShareInvite} />
        ) : null}

        {screen === "blocked" ? (
          <ConnectBlockedScreen showToast={showToast} />
        ) : null}

        {screen === "delete-account" ? (
          <ConnectDeleteAccountScreen
            user={user}
            onCancel={() => setScreen("account")}
            onDeleted={() => {
              showToast("Account deleted", "success");
              onLogout();
            }}
          />
        ) : null}

        {screen === "main" ? (
          <p
            className="py-6 text-center text-xs"
            style={{ color: "#9ca3af" }}
          >
            from <span className="font-bold">Group Travel</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}

// ── Connect Settings sub-screens ──────────────────────────────────────────────

const SETTINGS_BG = "#ffffff";
const SETTINGS_HOVER = "rgba(0,0,0,0.03)";
const SETTINGS_SECTION_BG = "#f1f3f5";
const SETTINGS_BORDER = "#e5e7eb";
const SETTINGS_TEXT = "#1e2a3a";
const SETTINGS_MUTED = "#6b7280";
const SETTINGS_ACCENT = "#1d9e75";

function SettingsRow({
  icon,
  label,
  sublabel,
  trailing,
  onClick,
  destructive,
}: {
  icon?: React.ReactNode;
  label: string;
  sublabel?: string | React.ReactNode;
  trailing?: React.ReactNode;
  onClick?: () => void;
  destructive?: boolean;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`flex w-full items-center gap-4 px-4 py-3 text-left ${onClick ? "hover:bg-black/[0.03]" : ""}`}
    >
      {icon ? (
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center"
          style={{ color: destructive ? "#dc2626" : SETTINGS_TEXT }}
        >
          {icon}
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <p
          className="truncate text-[15px] font-semibold"
          style={{ color: destructive ? "#dc2626" : SETTINGS_TEXT }}
        >
          {label}
        </p>
        {sublabel ? (
          <div
            className="truncate text-xs"
            style={{ color: SETTINGS_MUTED }}
          >
            {sublabel}
          </div>
        ) : null}
      </div>
      {trailing ? (
        <div className="ml-2 flex shrink-0 items-center gap-2">{trailing}</div>
      ) : null}
    </Tag>
  );
}

function SettingsToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      className="relative h-6 w-11 shrink-0 rounded-full transition-colors"
      style={{ background: on ? "#1d2939" : "#d1d5db" }}
      onClick={onToggle}
    >
      <span
        className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow"
        style={{
          left: on ? "calc(100% - 22px)" : "2px",
          transition: "left 0.18s ease",
        }}
      />
    </button>
  );
}

function SettingsSection({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      {title ? (
        <p
          className="px-4 pt-4 pb-1 text-xs"
          style={{ color: SETTINGS_MUTED }}
        >
          {title}
        </p>
      ) : (
        <div className="h-2" style={{ background: SETTINGS_SECTION_BG }} />
      )}
      <div style={{ background: SETTINGS_BG }}>{children}</div>
    </section>
  );
}

function ConnectMainScreen({
  search,
  setSearch,
  user: _user,
  displayName,
  initials,
  avBg,
  showToast,
  onShareInvite,
  goExternal,
  setScreen,
}: {
  search: string;
  setSearch: (v: string) => void;
  user: UserMe | null;
  displayName: string;
  initials: string;
  avBg: string;
  showToast: (m: string, t?: "success" | "error") => void;
  onShareInvite: () => Promise<void> | void;
  goExternal: (href: string) => void;
  setScreen: (s: ConnectScreen) => void;
}) {
  type Row = {
    icon: React.ReactNode;
    label: string;
    sublabel?: string;
    onClick: () => void;
  };

  const sections: { rows: Row[] }[] = [
    {
      rows: [
        {
          icon: <UserCircle2 className="h-5 w-5" strokeWidth={1.5} />,
          label: "Account",
          sublabel: "Security notifications, change number",
          onClick: () => setScreen("account"),
        },
        {
          icon: <Lock className="h-5 w-5" strokeWidth={1.5} />,
          label: "Privacy",
          sublabel: "Blocked accounts, disappearing messages",
          onClick: () => setScreen("privacy"),
        },
        {
          icon: <SmilePlus className="h-5 w-5" strokeWidth={1.5} />,
          label: "Avatar",
          sublabel: "Create, edit, profile photo",
          onClick: () => goExternal("/settings/edit-profile"),
        },
        {
          icon: <UsersRound className="h-5 w-5" strokeWidth={1.5} />,
          label: "Lists",
          sublabel: "Manage people and groups",
          onClick: () => setScreen("lists"),
        },
      ],
    },
    {
      rows: [
        {
          icon: <MessageSquareText className="h-5 w-5" strokeWidth={1.5} />,
          label: "Chats",
          sublabel: "Theme, wallpapers, chat history",
          onClick: () => setScreen("chats"),
        },
        {
          icon: <Bell className="h-5 w-5" strokeWidth={1.5} />,
          label: "Notifications",
          sublabel: "Message, group & call tones",
          onClick: () => setScreen("notifications"),
        },
        {
          icon: <DatabaseIcon className="h-5 w-5" strokeWidth={1.5} />,
          label: "Storage and data",
          sublabel: "Network usage, auto-download",
          onClick: () => setScreen("storage"),
        },
        {
          icon: <Globe2 className="h-5 w-5" strokeWidth={1.5} />,
          label: "App language",
          sublabel: "English (device's language)",
          onClick: () => setScreen("language"),
        },
      ],
    },
    {
      rows: [
        {
          icon: <LifeBuoy className="h-5 w-5" strokeWidth={1.5} />,
          label: "Help and feedback",
          sublabel: "Help center, contact us, privacy policy",
          onClick: () => setScreen("help"),
        },
        {
          icon: <UserPlus className="h-5 w-5" strokeWidth={1.5} />,
          label: "Invite a contact",
          onClick: () => {
            setScreen("invite");
          },
        },
      ],
    },
  ];

  const filtered = (() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return sections;
    return sections
      .map((s) => ({
        ...s,
        rows: s.rows.filter((r) =>
          `${r.label} ${r.sublabel ?? ""}`.toLowerCase().includes(needle),
        ),
      }))
      .filter((s) => s.rows.length > 0);
  })();

  return (
    <>
      <div className="px-3 py-3">
        <div
          className="flex items-center gap-2 rounded-full px-3 py-2"
          style={{ background: SETTINGS_SECTION_BG }}
        >
          <Search
            className="h-4 w-4 shrink-0"
            strokeWidth={2}
            style={{ color: SETTINGS_MUTED }}
          />
          <input
            type="text"
            placeholder="Search settings"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            style={{ color: SETTINGS_TEXT }}
          />
          {search ? (
            <button
              type="button"
              aria-label="Clear search"
              className="flex h-5 w-5 items-center justify-center rounded-full"
              style={{ background: "#d1d5db" }}
              onClick={() => setSearch("")}
            >
              <X className="h-3 w-3" style={{ color: SETTINGS_TEXT }} />
            </button>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-black/[0.03]"
        onClick={() => goExternal("/profile")}
      >
        <span
          className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full text-base font-bold text-white"
          style={{ background: avBg }}
        >
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-base font-bold"
            style={{ color: SETTINGS_TEXT }}
          >
            {displayName}
          </p>
          <button
            type="button"
            className="mt-1 inline-flex items-center gap-1 rounded-full border px-3 py-0.5 text-xs"
            style={{ borderColor: SETTINGS_BORDER, color: "#374151" }}
            onClick={(e) => {
              e.stopPropagation();
              showToast("Status coming soon", "success");
            }}
          >
            <span aria-hidden>😊</span>
            Drop a thought
          </button>
        </div>
        <button
          type="button"
          aria-label="Show QR code"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg hover:bg-black/5"
          onClick={(e) => {
            e.stopPropagation();
            showToast("QR profile coming soon", "success");
          }}
        >
          <QrCode className="h-5 w-5" strokeWidth={1.5} style={{ color: SETTINGS_TEXT }} />
        </button>
      </button>

      {filtered.map((sec, idx) => (
        <SettingsSection key={idx}>
          {sec.rows.map((r) => (
            <SettingsRow
              key={r.label}
              icon={r.icon}
              label={r.label}
              sublabel={r.sublabel}
              onClick={r.onClick}
            />
          ))}
        </SettingsSection>
      ))}

      <button
        type="button"
        className="mt-4 w-full px-4 py-3 text-left text-sm font-semibold"
        style={{ color: "#dc2626" }}
        onClick={() => {
          void onShareInvite();
        }}
      >
        Share Group Travel with a friend
      </button>
    </>
  );
}

function ConnectAccountScreen({
  user,
  prefs,
  onChange,
  onOpenDelete,
  onOpenBlocked: _onOpenBlocked,
  onLogout,
  showToast,
}: {
  user: UserMe | null;
  prefs: ConnectPrefs["account"];
  onChange: (k: keyof ConnectPrefs["account"], v: boolean) => void;
  onOpenDelete: () => void;
  onOpenBlocked: () => void;
  onLogout: () => void;
  showToast: (m: string, t?: "success" | "error") => void;
}) {
  return (
    <>
      <SettingsSection>
        <SettingsRow
          icon={<Shield className="h-5 w-5" strokeWidth={1.5} />}
          label="Security notifications"
          sublabel={
            prefs.security_notifications
              ? "On — alerts for new logins"
              : "Off"
          }
          trailing={
            <SettingsToggle
              on={prefs.security_notifications}
              onToggle={() =>
                onChange(
                  "security_notifications",
                  !prefs.security_notifications,
                )
              }
            />
          }
        />
        <SettingsRow
          icon={<KeyRound className="h-5 w-5" strokeWidth={1.5} />}
          label="Passkeys"
          sublabel="Sign in without a password"
          onClick={() => showToast("Passkeys coming soon", "success")}
        />
        <SettingsRow
          icon={<Mail className="h-5 w-5" strokeWidth={1.5} />}
          label="Email address"
          sublabel={user?.email ?? "—"}
          onClick={() => showToast("Email change coming soon", "success")}
        />
        <SettingsRow
          icon={<Asterisk className="h-5 w-5" strokeWidth={1.5} />}
          label="Two-step verification"
          sublabel={prefs.two_step_pin_set ? "Enabled" : "Disabled"}
          trailing={
            <SettingsToggle
              on={prefs.two_step_pin_set}
              onToggle={() =>
                onChange("two_step_pin_set", !prefs.two_step_pin_set)
              }
            />
          }
        />
        <SettingsRow
          icon={<PhoneCall className="h-5 w-5" strokeWidth={1.5} />}
          label="Change phone number"
          onClick={() => showToast("Phone change coming soon", "success")}
        />
        <SettingsRow
          icon={<FileText className="h-5 w-5" strokeWidth={1.5} />}
          label="Request account info"
          onClick={() => showToast("Data export coming soon", "success")}
        />
      </SettingsSection>

      <SettingsSection>
        <SettingsRow
          icon={<LogOut className="h-5 w-5" strokeWidth={1.5} />}
          label="Log out"
          onClick={() => {
            if (window.confirm("Log out of Group Travel?")) onLogout();
          }}
        />
        <SettingsRow
          icon={<Trash2 className="h-5 w-5" strokeWidth={1.5} />}
          label="Delete account"
          destructive
          onClick={onOpenDelete}
        />
      </SettingsSection>
    </>
  );
}

function VisibilityRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: "everyone" | "contacts" | "nobody";
  onChange: (v: "everyone" | "contacts" | "nobody") => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <SettingsRow
        label={label}
        sublabel={visibilityLabel(value)}
        onClick={() => setOpen(true)}
      />
      {open ? (
        <div
          className="fixed inset-0 z-[400] flex items-end justify-center bg-black/40 sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-t-2xl bg-white p-2 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p
              className="px-3 py-2 text-xs"
              style={{ color: SETTINGS_MUTED }}
            >
              {label}
            </p>
            {VISIBILITY_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-left text-sm hover:bg-black/[0.03]"
                style={{ color: SETTINGS_TEXT }}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
              >
                {o.label}
                {value === o.value ? (
                  <Check
                    className="h-4 w-4"
                    style={{ color: SETTINGS_ACCENT }}
                  />
                ) : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}

function ConnectPrivacyScreen({
  prefs,
  onChange,
  onOpenBlocked,
  showToast,
}: {
  prefs: ConnectPrefs["privacy"];
  onChange: <K extends keyof ConnectPrefs["privacy"]>(
    k: K,
    v: ConnectPrefs["privacy"][K],
  ) => void;
  onOpenBlocked: () => void;
  showToast: (m: string, t?: "success" | "error") => void;
}) {
  const [timerOpen, setTimerOpen] = useState(false);
  return (
    <>
      <SettingsSection title="Who can see my personal info">
        <VisibilityRow
          label="Last seen and online"
          value={prefs.last_seen}
          onChange={(v) => onChange("last_seen", v)}
        />
        <VisibilityRow
          label="Profile picture"
          value={prefs.profile_picture}
          onChange={(v) => onChange("profile_picture", v)}
        />
        <VisibilityRow
          label="About"
          value={prefs.about}
          onChange={(v) => onChange("about", v)}
        />
        <VisibilityRow
          label="Status"
          value={prefs.status}
          onChange={(v) => onChange("status", v)}
        />
        <SettingsRow
          label="Read receipts"
          sublabel="If turned off, you won't send or receive read receipts. Read receipts are always sent for group chats."
          trailing={
            <SettingsToggle
              on={prefs.read_receipts}
              onToggle={() => onChange("read_receipts", !prefs.read_receipts)}
            />
          }
        />
      </SettingsSection>

      <SettingsSection title="Disappearing messages">
        <SettingsRow
          label="Default message timer"
          sublabel="Start new chats with disappearing messages set to your timer"
          trailing={
            <span className="text-sm" style={{ color: SETTINGS_MUTED }}>
              {disappearingLabel(prefs.default_disappearing_seconds)}
            </span>
          }
          onClick={() => setTimerOpen(true)}
        />
        {timerOpen ? (
          <div
            className="fixed inset-0 z-[400] flex items-end justify-center bg-black/40 sm:items-center"
            onClick={() => setTimerOpen(false)}
          >
            <div
              className="w-full max-w-md rounded-t-2xl bg-white p-2 sm:rounded-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {DISAPPEARING_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-left text-sm"
                  style={{ color: SETTINGS_TEXT }}
                  onClick={() => {
                    onChange("default_disappearing_seconds", o.value);
                    setTimerOpen(false);
                  }}
                >
                  {o.label}
                  {prefs.default_disappearing_seconds === o.value ? (
                    <Check
                      className="h-4 w-4"
                      style={{ color: SETTINGS_ACCENT }}
                    />
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </SettingsSection>

      <SettingsSection>
        <VisibilityRow
          label="Groups"
          value={prefs.groups}
          onChange={(v) => onChange("groups", v)}
        />
        <VisibilityRow
          label="Avatar stickers"
          value={prefs.avatar_stickers}
          onChange={(v) => onChange("avatar_stickers", v)}
        />
        <SettingsRow
          label="Live location"
          sublabel={prefs.live_location ? "Sharing enabled" : "Disabled"}
          trailing={
            <SettingsToggle
              on={prefs.live_location}
              onToggle={() => onChange("live_location", !prefs.live_location)}
            />
          }
        />
        <SettingsRow
          label="Calls"
          sublabel="Silence unknown callers"
          trailing={
            <SettingsToggle
              on={prefs.silence_unknown_callers}
              onToggle={() =>
                onChange(
                  "silence_unknown_callers",
                  !prefs.silence_unknown_callers,
                )
              }
            />
          }
        />
        <SettingsRow
          label="Contacts"
          sublabel="Blocked accounts"
          onClick={onOpenBlocked}
        />
        <SettingsRow
          label="App lock"
          sublabel={prefs.app_lock ? "Enabled" : "Disabled"}
          trailing={
            <SettingsToggle
              on={prefs.app_lock}
              onToggle={() => onChange("app_lock", !prefs.app_lock)}
            />
          }
        />
        <SettingsRow
          label="Chat lock"
          trailing={
            <SettingsToggle
              on={prefs.chat_lock}
              onToggle={() => onChange("chat_lock", !prefs.chat_lock)}
            />
          }
        />
        <SettingsRow
          label="Allow camera effects"
          sublabel="Use effects in the camera and video calls"
          trailing={
            <SettingsToggle
              on={prefs.camera_effects}
              onToggle={() => onChange("camera_effects", !prefs.camera_effects)}
            />
          }
        />
      </SettingsSection>

      <SettingsSection title="Advanced">
        <SettingsRow
          label="Protect IP address in calls"
          trailing={
            <SettingsToggle
              on={prefs.ip_protect_calls}
              onToggle={() =>
                onChange("ip_protect_calls", !prefs.ip_protect_calls)
              }
            />
          }
        />
        <SettingsRow
          label="Disable link previews"
          trailing={
            <SettingsToggle
              on={prefs.disable_link_previews}
              onToggle={() =>
                onChange("disable_link_previews", !prefs.disable_link_previews)
              }
            />
          }
        />
      </SettingsSection>

      <SettingsSection>
        <SettingsRow
          label="Privacy checkup"
          sublabel="Control your privacy and choose the right settings for you."
          onClick={() =>
            showToast("Privacy checkup coming soon", "success")
          }
        />
      </SettingsSection>
    </>
  );
}

function ConnectChatsScreen({
  prefs,
  onChange,
  showToast,
}: {
  prefs: ConnectPrefs["chats"];
  onChange: <K extends keyof ConnectPrefs["chats"]>(
    k: K,
    v: ConnectPrefs["chats"][K],
  ) => void;
  showToast: (m: string, t?: "success" | "error") => void;
}) {
  const [themeOpen, setThemeOpen] = useState(false);
  const [fontOpen, setFontOpen] = useState(false);
  return (
    <>
      <SettingsSection title="Display">
        <SettingsRow
          icon={<MoonIcon className="h-5 w-5" strokeWidth={1.5} />}
          label="Theme"
          sublabel={
            prefs.theme === "system"
              ? "System default"
              : prefs.theme === "light"
                ? "Light"
                : "Dark"
          }
          onClick={() => setThemeOpen(true)}
        />
        <SettingsRow
          icon={<Palette className="h-5 w-5" strokeWidth={1.5} />}
          label="Default chat theme"
          onClick={() => showToast("Wallpapers coming soon", "success")}
        />
        {themeOpen ? (
          <div
            className="fixed inset-0 z-[400] flex items-end justify-center bg-black/40 sm:items-center"
            onClick={() => setThemeOpen(false)}
          >
            <div
              className="w-full max-w-md rounded-t-2xl bg-white p-2 sm:rounded-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {(["system", "light", "dark"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-left text-sm"
                  style={{ color: SETTINGS_TEXT }}
                  onClick={() => {
                    onChange("theme", t);
                    setThemeOpen(false);
                  }}
                >
                  {t === "system"
                    ? "System default"
                    : t === "light"
                      ? "Light"
                      : "Dark"}
                  {prefs.theme === t ? (
                    <Check
                      className="h-4 w-4"
                      style={{ color: SETTINGS_ACCENT }}
                    />
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </SettingsSection>

      <SettingsSection title="Chat settings">
        <SettingsRow
          label="Enter is send"
          sublabel="Enter key will send your message"
          trailing={
            <SettingsToggle
              on={prefs.enter_is_send}
              onToggle={() => onChange("enter_is_send", !prefs.enter_is_send)}
            />
          }
        />
        <SettingsRow
          label="Media visibility"
          sublabel="Show newly downloaded media in your device's gallery"
          trailing={
            <SettingsToggle
              on={prefs.media_visibility}
              onToggle={() =>
                onChange("media_visibility", !prefs.media_visibility)
              }
            />
          }
        />
        <SettingsRow
          label="Font size"
          sublabel={
            prefs.font_size === "small"
              ? "Small"
              : prefs.font_size === "large"
                ? "Large"
                : "Medium"
          }
          onClick={() => setFontOpen(true)}
        />
        {fontOpen ? (
          <div
            className="fixed inset-0 z-[400] flex items-end justify-center bg-black/40 sm:items-center"
            onClick={() => setFontOpen(false)}
          >
            <div
              className="w-full max-w-md rounded-t-2xl bg-white p-2 sm:rounded-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {(["small", "medium", "large"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-left text-sm"
                  style={{ color: SETTINGS_TEXT }}
                  onClick={() => {
                    onChange("font_size", f);
                    setFontOpen(false);
                  }}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                  {prefs.font_size === f ? (
                    <Check
                      className="h-4 w-4"
                      style={{ color: SETTINGS_ACCENT }}
                    />
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </SettingsSection>

      <SettingsSection title="Archived chats">
        <SettingsRow
          label="Keep chats archived"
          sublabel="Archived chats will remain archived when you receive a new message"
          trailing={
            <SettingsToggle
              on={prefs.keep_archived}
              onToggle={() => onChange("keep_archived", !prefs.keep_archived)}
            />
          }
        />
        <SettingsRow
          icon={<Cloud className="h-5 w-5" strokeWidth={1.5} />}
          label="Chat backup"
          onClick={() => showToast("Chat backup coming soon", "success")}
        />
      </SettingsSection>
    </>
  );
}

function ConnectNotificationsScreen({
  prefs,
  onChange,
}: {
  prefs: ConnectPrefs["notifications"];
  onChange: <K extends keyof ConnectPrefs["notifications"]>(
    k: K,
    v: ConnectPrefs["notifications"][K],
  ) => void;
}) {
  const [vibrateOpen, setVibrateOpen] = useState(false);
  return (
    <>
      <SettingsSection>
        <SettingsRow
          label="Conversation tones"
          sublabel="Play sounds for incoming and outgoing messages."
          trailing={
            <SettingsToggle
              on={prefs.conversation_tones}
              onToggle={() =>
                onChange("conversation_tones", !prefs.conversation_tones)
              }
            />
          }
        />
        <SettingsRow
          label="Reminders"
          sublabel="Get occasional reminders about messages or status updates you haven't seen"
          trailing={
            <SettingsToggle
              on={prefs.reminders}
              onToggle={() => onChange("reminders", !prefs.reminders)}
            />
          }
        />
      </SettingsSection>

      <SettingsSection title="Messages">
        <SettingsRow
          label="Notification tone"
          sublabel={prefs.notification_tone || "Default"}
          onClick={() => onChange("notification_tone", "default")}
        />
        <SettingsRow
          label="Vibrate"
          sublabel={
            prefs.vibrate.charAt(0).toUpperCase() + prefs.vibrate.slice(1)
          }
          onClick={() => setVibrateOpen(true)}
        />
        {vibrateOpen ? (
          <div
            className="fixed inset-0 z-[400] flex items-end justify-center bg-black/40 sm:items-center"
            onClick={() => setVibrateOpen(false)}
          >
            <div
              className="w-full max-w-md rounded-t-2xl bg-white p-2 sm:rounded-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {(["off", "default", "short", "long"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-left text-sm"
                  style={{ color: SETTINGS_TEXT }}
                  onClick={() => {
                    onChange("vibrate", v);
                    setVibrateOpen(false);
                  }}
                >
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                  {prefs.vibrate === v ? (
                    <Check
                      className="h-4 w-4"
                      style={{ color: SETTINGS_ACCENT }}
                    />
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <SettingsRow
          label="Light"
          sublabel={prefs.light}
          onClick={() => onChange("light", "white")}
        />
        <SettingsRow
          label="Use high priority notifications"
          sublabel="Show previews of notifications at the top of the screen"
          trailing={
            <SettingsToggle
              on={prefs.high_priority}
              onToggle={() => onChange("high_priority", !prefs.high_priority)}
            />
          }
        />
        <SettingsRow
          label="Reaction notifications"
          sublabel="Show notifications for reactions to messages you send"
          trailing={
            <SettingsToggle
              on={prefs.reaction_notifications}
              onToggle={() =>
                onChange(
                  "reaction_notifications",
                  !prefs.reaction_notifications,
                )
              }
            />
          }
        />
      </SettingsSection>

      <SettingsSection title="Calls">
        <SettingsRow
          label="Call notifications"
          trailing={
            <SettingsToggle
              on={prefs.call_notifications}
              onToggle={() =>
                onChange("call_notifications", !prefs.call_notifications)
              }
            />
          }
        />
      </SettingsSection>
    </>
  );
}

function ConnectStorageScreen({
  prefs,
  onChange,
  showToast,
}: {
  prefs: ConnectPrefs["storage"];
  onChange: <K extends keyof ConnectPrefs["storage"]>(
    k: K,
    v: ConnectPrefs["storage"][K],
  ) => void;
  showToast: (m: string, t?: "success" | "error") => void;
}) {
  const [uploadOpen, setUploadOpen] = useState(false);
  return (
    <>
      <SettingsSection>
        <SettingsRow
          icon={<Folder className="h-5 w-5" strokeWidth={1.5} />}
          label="Manage storage"
          sublabel="Calculating…"
          onClick={() => showToast("Storage manager coming soon", "success")}
        />
        <SettingsRow
          icon={<Activity className="h-5 w-5" strokeWidth={1.5} />}
          label="Network usage"
          sublabel="Track sent / received"
          onClick={() => showToast("Network usage coming soon", "success")}
        />
        <SettingsRow
          label="Use less data for calls"
          trailing={
            <SettingsToggle
              on={prefs.use_less_data_for_calls}
              onToggle={() =>
                onChange(
                  "use_less_data_for_calls",
                  !prefs.use_less_data_for_calls,
                )
              }
            />
          }
        />
        <SettingsRow
          label="Proxy"
          sublabel="Off"
          onClick={() => showToast("Proxy not supported on web", "success")}
        />
      </SettingsSection>

      <SettingsSection>
        <SettingsRow
          label="Media upload quality"
          sublabel={prefs.media_upload_quality === "hd" ? "HD quality" : "Standard"}
          onClick={() => setUploadOpen(true)}
        />
        {uploadOpen ? (
          <div
            className="fixed inset-0 z-[400] flex items-end justify-center bg-black/40 sm:items-center"
            onClick={() => setUploadOpen(false)}
          >
            <div
              className="w-full max-w-md rounded-t-2xl bg-white p-2 sm:rounded-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {(["standard", "hd"] as const).map((q) => (
                <button
                  key={q}
                  type="button"
                  className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-left text-sm"
                  style={{ color: SETTINGS_TEXT }}
                  onClick={() => {
                    onChange("media_upload_quality", q);
                    setUploadOpen(false);
                  }}
                >
                  {q === "hd" ? "HD quality" : "Standard"}
                  {prefs.media_upload_quality === q ? (
                    <Check
                      className="h-4 w-4"
                      style={{ color: SETTINGS_ACCENT }}
                    />
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <SettingsRow
          label="Auto-download quality"
          sublabel={prefs.auto_download_quality}
          onClick={() => onChange("auto_download_quality", "auto")}
        />
      </SettingsSection>

      <SettingsSection title="Media auto-download">
        <SettingsRow
          label="When using mobile data"
          sublabel={prefs.auto_download_mobile.join(", ") || "No media"}
        />
        <SettingsRow
          label="When connected on Wi-Fi"
          sublabel={prefs.auto_download_wifi.join(", ") || "No media"}
        />
        <SettingsRow
          label="When roaming"
          sublabel={prefs.auto_download_roaming.join(", ") || "No media"}
        />
      </SettingsSection>
    </>
  );
}

function ConnectListsScreen({
  showToast,
}: {
  showToast: (m: string, t?: "success" | "error") => void;
}) {
  return (
    <>
      <div className="px-6 pt-6 text-center">
        <p
          className="text-sm"
          style={{ color: SETTINGS_MUTED }}
        >
          Focus on who matters most. Easily send and share across Connect.
        </p>
        <button
          type="button"
          className="mt-4 inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold"
          style={{ background: SETTINGS_SECTION_BG, color: SETTINGS_TEXT }}
          onClick={() => showToast("Custom lists coming soon", "success")}
        >
          <Plus className="h-4 w-4" />
          Create a custom list
        </button>
      </div>
      <SettingsSection title="Your lists">
        <SettingsRow
          icon={<MessageSquareText className="h-5 w-5" strokeWidth={1.5} />}
          label="Unread"
          sublabel="Preset"
          onClick={() => showToast("Filter by unread in chats", "success")}
        />
        <SettingsRow
          icon={<Heart className="h-5 w-5" strokeWidth={1.5} />}
          label="Favorites"
          sublabel="Preset"
          onClick={() => showToast("Filter by favorites in chats", "success")}
        />
        <SettingsRow
          icon={<UsersRound className="h-5 w-5" strokeWidth={1.5} />}
          label="Groups"
          sublabel="Preset"
          onClick={() => showToast("Switch to Groups tab", "success")}
        />
      </SettingsSection>
    </>
  );
}

function ConnectLanguageScreen({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <SettingsSection>
      {LANGUAGE_OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-black/[0.03]"
          onClick={() => onChange(o.value)}
        >
          <span
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border"
            style={{
              borderColor: value === o.value ? "#1d2939" : "#9ca3af",
              background: value === o.value ? "#1d2939" : "transparent",
            }}
          >
            {value === o.value ? (
              <Check className="h-3 w-3 text-white" strokeWidth={3} />
            ) : null}
          </span>
          <div className="min-w-0 flex-1">
            <p
              className="truncate text-[15px]"
              style={{ color: SETTINGS_TEXT }}
            >
              {o.label}
            </p>
            <p className="truncate text-xs" style={{ color: SETTINGS_MUTED }}>
              {o.sub}
            </p>
          </div>
        </button>
      ))}
    </SettingsSection>
  );
}

function ConnectHelpScreen({
  showToast,
  goExternal,
}: {
  showToast: (m: string, t?: "success" | "error") => void;
  goExternal: (href: string) => void;
}) {
  return (
    <SettingsSection>
      <SettingsRow
        icon={<HelpCircle className="h-5 w-5" strokeWidth={1.5} />}
        label="Help center"
        sublabel="Get help, contact us"
        onClick={() => goExternal("/settings/support")}
      />
      <SettingsRow
        icon={<Bug className="h-5 w-5" strokeWidth={1.5} />}
        label="Send feedback"
        sublabel="Report technical issues"
        onClick={() => goExternal("/settings/support#bugs")}
      />
      <SettingsRow
        icon={<FileText className="h-5 w-5" strokeWidth={1.5} />}
        label="Terms"
        onClick={() => goExternal("/settings/support#terms")}
      />
      <SettingsRow
        icon={<AlertOctagon className="h-5 w-5" strokeWidth={1.5} />}
        label="Channel reports"
        onClick={() => showToast("No reports", "success")}
      />
      <SettingsRow
        icon={<Info className="h-5 w-5" strokeWidth={1.5} />}
        label="App info"
        sublabel="Group Travel"
        onClick={() => showToast("Group Travel · web", "success")}
      />
    </SettingsSection>
  );
}

function ConnectInviteScreen({
  onShareInvite,
}: {
  onShareInvite: () => Promise<void> | void;
}) {
  return (
    <>
      <SettingsSection>
        <SettingsRow
          icon={
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full"
              style={{ background: "#1d2939" }}
            >
              <Share2 className="h-4 w-4 text-white" strokeWidth={1.8} />
            </span>
          }
          label="Share link"
          onClick={() => {
            void onShareInvite();
          }}
        />
      </SettingsSection>
      <p
        className="px-4 pt-4 text-xs"
        style={{ color: SETTINGS_MUTED }}
      >
        We'll soon let you invite contacts directly from your address book.
      </p>
    </>
  );
}

function ConnectBlockedScreen({
  showToast,
}: {
  showToast: (m: string, t?: "success" | "error") => void;
}) {
  const [items, setItems] = useState<
    { id: string; full_name: string; avatar_url: string | null }[] | null
  >(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<
        { id: string; full_name: string; avatar_url: string | null }[]
      >("/social/blocked");
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const unblock = async (id: string) => {
    if (!window.confirm("Unblock this user?")) return;
    try {
      await apiFetch(`/social/block/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      showToast("User unblocked", "success");
      await load();
    } catch {
      showToast("Could not unblock", "error");
    }
  };

  return (
    <>
      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: "#9ca3af" }} />
        </div>
      ) : items && items.length > 0 ? (
        <SettingsSection>
          {items.map((it) => (
            <SettingsRow
              key={it.id}
              icon={
                it.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={it.avatar_url}
                    alt=""
                    className="h-9 w-9 rounded-full object-cover"
                  />
                ) : (
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ background: listAvatarColor(it.full_name) }}
                  >
                    {initialsFromName(it.full_name)}
                  </span>
                )
              }
              label={it.full_name}
              trailing={
                <button
                  type="button"
                  className="rounded-lg px-2 py-1 text-xs font-semibold"
                  style={{ color: SETTINGS_ACCENT }}
                  onClick={() => void unblock(it.id)}
                >
                  Unblock
                </button>
              }
            />
          ))}
        </SettingsSection>
      ) : (
        <p className="px-6 py-10 text-center text-sm" style={{ color: SETTINGS_MUTED }}>
          You haven't blocked anyone.
        </p>
      )}
    </>
  );
}

function ConnectDeleteAccountScreen({
  user,
  onCancel,
  onDeleted,
}: {
  user: UserMe | null;
  onCancel: () => void;
  onDeleted: () => void;
}) {
  const [confirmation, setConfirmation] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const userEmail = user?.email ?? "";

  const submit = async () => {
    if (confirmation !== "DELETE") {
      setError('Type DELETE in the confirmation field');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch("/auth/account/deactivate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation, password: password || null }),
      });
      onDeleted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete account");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="px-4 py-6">
      <p className="text-sm" style={{ color: SETTINGS_TEXT }}>
        Deleting your account will:
      </p>
      <ul
        className="ml-5 mt-2 list-disc text-sm"
        style={{ color: SETTINGS_MUTED }}
      >
        <li>Permanently remove your messages, groups and trips</li>
        <li>Cancel any active subscriptions</li>
        <li>Erase your profile from search and friend lists</li>
      </ul>

      <p
        className="mt-5 text-xs font-semibold uppercase"
        style={{ color: SETTINGS_MUTED }}
      >
        Confirm
      </p>
      <input
        type="text"
        placeholder="Type DELETE to confirm"
        value={confirmation}
        onChange={(e) => setConfirmation(e.target.value)}
        className="mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none"
        style={{ borderColor: SETTINGS_BORDER, color: SETTINGS_TEXT }}
      />

      {userEmail ? (
        <>
          <p
            className="mt-4 text-xs font-semibold uppercase"
            style={{ color: SETTINGS_MUTED }}
          >
            Password (leave empty for OAuth-only accounts)
          </p>
          <input
            type="password"
            placeholder="Your account password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none"
            style={{ borderColor: SETTINGS_BORDER, color: SETTINGS_TEXT }}
          />
        </>
      ) : null}

      {error ? (
        <p className="mt-3 text-sm" style={{ color: "#dc2626" }}>
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex gap-2">
        <button
          type="button"
          className="flex-1 rounded-lg border py-2.5 text-sm font-semibold"
          style={{ borderColor: SETTINGS_BORDER, color: SETTINGS_TEXT }}
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </button>
        <button
          type="button"
          className="flex-1 rounded-lg py-2.5 text-sm font-bold text-white disabled:opacity-60"
          style={{ background: "#dc2626" }}
          onClick={() => void submit()}
          disabled={submitting || confirmation !== "DELETE"}
        >
          {submitting ? "Deleting…" : "Delete account"}
        </button>
      </div>
    </div>
  );
}

type GtWebrtcCallState = "idle" | "outgoing" | "incoming" | "active" | "ended";

type GtWebrtcCallCurrent = {
  callId: string;
  callType: "audio" | "video";
  remoteUser: { id: string; name: string; avatar: string | null };
  direction: "outgoing" | "incoming";
  startTime: number | null;
  duration: number;
};

/** Web Audio ringtone: softer/slower when callee likely offline ("Calling"), louder/faster when online ("Ringing"). */
function startCallRingtoneLoop(
  mode: "calling" | "ringing" | "incoming",
): () => void {
  if (typeof window === "undefined") return () => {};
  const AC =
    window.AudioContext ||
    (
      window as unknown as {
        webkitAudioContext: typeof AudioContext;
      }
    ).webkitAudioContext;
  if (!AC) return () => {};

  const ctx = new AC();
  let interval: ReturnType<typeof setInterval> | null = null;
  let alive = true;

  const params =
    mode === "calling"
      ? { gain: 0.055, periodMs: 3200 }
      : mode === "ringing"
        ? { gain: 0.14, periodMs: 1600 }
        : { gain: 0.16, periodMs: 2000 };

  const playBurst = () => {
    if (!alive) return;
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
    const t = ctx.currentTime;
    const peak = params.gain;
    const beep = (offset: number, f1: number, f2: number) => {
      const o1 = ctx.createOscillator();
      const o2 = ctx.createOscillator();
      const gn = ctx.createGain();
      o1.type = "sine";
      o2.type = "sine";
      o1.frequency.value = f1;
      o2.frequency.value = f2;
      o1.connect(gn);
      o2.connect(gn);
      gn.connect(ctx.destination);
      const st = t + offset;
      const dur = 0.19;
      gn.gain.setValueAtTime(0, st);
      gn.gain.linearRampToValueAtTime(peak, st + 0.02);
      gn.gain.linearRampToValueAtTime(0.0001, st + dur);
      o1.start(st);
      o1.stop(st + dur);
      o2.start(st);
      o2.stop(st + dur);
    };
    beep(0, 480, 440);
    beep(0.3, 520, 470);
  };

  playBurst();
  interval = globalThis.setInterval(playBurst, params.periodMs);

  return () => {
    alive = false;
    if (interval) globalThis.clearInterval(interval);
    void ctx.close();
  };
}

type GtActiveCallMenuAction =
  | "screen_share"
  | "send_message"
  | "toggle_video"
  | "audio_output"
  | "toggle_mute"
  | "audio_mode"
  | "end";

function WebrtcCallOverlays({
  callState,
  callType,
  currentCall,
  isMuted,
  isCameraOff,
  isSpeaker,
  callDurationSec,
  endedDisplaySec,
  localVideoRef,
  remoteVideoRef,
  remoteStream,
  onToggleMute,
  onToggleCamera,
  onToggleSpeaker,
  onEnd,
  onAccept,
  onDecline,
  outgoingPeerOnline,
  onActiveCallMenuAction,
}: {
  callState: GtWebrtcCallState;
  callType: "audio" | "video";
  currentCall: GtWebrtcCallCurrent | null;
  isMuted: boolean;
  isCameraOff: boolean;
  isSpeaker: boolean;
  callDurationSec: number;
  endedDisplaySec: number;
  localVideoRef: React.RefObject<HTMLVideoElement | null>;
  remoteVideoRef: React.RefObject<HTMLVideoElement | null>;
  remoteStream: MediaStream | null;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onToggleSpeaker: () => void;
  onEnd: () => void;
  onAccept: () => void;
  onDecline: () => void;
  /** Firebase `presence/{peerId}/online`; true = "Ringing…", false/null = "Calling…" */
  outgoingPeerOnline: boolean | null;
  /** Active call overflow (three dots): screen share, message, devices, etc. */
  onActiveCallMenuAction?: (action: GtActiveCallMenuAction) => void;
}) {
  const [activeCallMoreOpen, setActiveCallMoreOpen] = useState(false);
  const [audioOutMenuMeta, setAudioOutMenuMeta] = useState<{
    sub: string;
    useBtIcon: boolean;
  }>({
    sub: "Built-in speaker & wired output",
    useBtIcon: false,
  });
  const activeCallMoreBtnRef = useRef<HTMLButtonElement | null>(null);
  const activeCallMorePanelRef = useRef<HTMLDivElement | null>(null);
  const [callLayoutMobile, setCallLayoutMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = () => setCallLayoutMobile(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (!activeCallMoreOpen || callState !== "active") return;
    let cancelled = false;
    void (async () => {
      try {
        const list = (
          await navigator.mediaDevices.enumerateDevices()
        ).filter((d) => d.kind === "audiooutput");
        const bt = list.some((d) =>
          looksLikeBluetoothAudioDeviceLabel(d.label),
        );
        if (!cancelled) {
          setAudioOutMenuMeta({
            sub: bt
              ? "Speaker, phone, or Bluetooth"
              : "Built-in speaker & wired output",
            useBtIcon: bt,
          });
        }
      } catch {
        if (!cancelled) {
          setAudioOutMenuMeta({
            sub: "Built-in speaker & wired output",
            useBtIcon: false,
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeCallMoreOpen, callState]);

  useEffect(() => {
    if (!activeCallMoreOpen) return;
    const onDoc = (e: MouseEvent) => {
      const n = e.target as Node;
      if (activeCallMorePanelRef.current?.contains(n)) return;
      if (activeCallMoreBtnRef.current?.contains(n)) return;
      setActiveCallMoreOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [activeCallMoreOpen]);

  useEffect(() => {
    if (callState !== "active") setActiveCallMoreOpen(false);
  }, [callState]);

  if (callState === "idle") return null;
  if (!currentCall && callState !== "ended") return null;
  const name = currentCall?.remoteUser.name || "Contact";
  const photo = currentCall?.remoteUser.avatar ?? null;
  const gradBg =
    "linear-gradient(135deg, #1e2a3a 0%, #0f1923 100%)";
  const endBtn = (
    <button
      type="button"
      onClick={onEnd}
      className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full"
      style={{ background: "#e53e3e" }}
      aria-label="End call"
    >
      <PhoneOff
        className="h-7 w-7 text-white"
        strokeWidth={1.5}
        style={{ transform: "rotate(135deg)" }}
        aria-hidden
      />
    </button>
  );
  const circBtn = (
    on: boolean,
    onCol: string,
    offCol: string,
    onClick: () => void,
    label: string,
    onIcon: ReactNode,
    offIcon: ReactNode,
  ) => (
    <button
      type="button"
      onClick={onClick}
      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full"
      style={{ background: on ? onCol : offCol }}
      aria-label={label}
    >
      {on ? onIcon : offIcon}
    </button>
  );

  if (callState === "ended") {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6 animate-in fade-in"
        style={{ background: "rgba(15, 25, 35, 0.95)" }}
      >
        <p className="text-center text-lg font-semibold text-white">Call ended</p>
        <p className="mt-2 text-2xl font-mono text-white" style={{ color: "#e9edef" }}>
          {formatCallDurationFmt(endedDisplaySec)}
        </p>
      </div>
    );
  }

  if (callState === "outgoing") {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col items-stretch"
        style={{ background: gradBg }}
      >
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6">
          {photo && !isInlineSvgDataUrlToSkipForPhoto(photo) && !isLegacyDicebearUrl(photo) ? (
            <img
              src={photo}
              alt=""
              className="h-20 w-20 rounded-full object-cover"
              width={80}
              height={80}
            />
          ) : (
            <InitialsAvatar name={name} size={80} className="!text-2xl" />
          )}
          <p className="mt-4 text-center text-[20px] font-bold text-white">
            {name}
          </p>
          <p
            className="mt-1 text-center text-sm"
            style={{ color: "#8896a0" }}
            aria-live="polite"
          >
            <span>{outgoingPeerOnline ? "Ringing" : "Calling"}</span>
            <span className="inline-block w-5 text-left">
              <span className="inline animate-pulse">.</span>
              <span className="inline animate-pulse" style={{ animationDelay: "0.2s" }}>
                .
              </span>
              <span className="inline animate-pulse" style={{ animationDelay: "0.4s" }}>
                .
              </span>
            </span>
          </p>
        </div>
        <div className="flex shrink-0 items-center justify-center gap-5 pb-10 pt-4">
          {callType === "video"
            ? circBtn(
                !isCameraOff,
                "#2d4060",
                "#e8956d",
                onToggleCamera,
                "Camera",
                <Video className="h-6 w-6 text-white" strokeWidth={1.5} />,
                <VideoOff className="h-6 w-6 text-white" strokeWidth={1.5} />,
              )
            : null}
          {circBtn(
            !isMuted,
            "#2d4060",
            "#e8956d",
            onToggleMute,
            "Mute",
            <Mic className="h-6 w-6 text-white" strokeWidth={1.5} />,
            <MicOff className="h-6 w-6 text-white" strokeWidth={1.5} />,
          )}
          {endBtn}
        </div>
      </div>
    );
  }

  if (callState === "incoming") {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col items-stretch"
        style={{ background: gradBg }}
      >
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6">
          <div className="relative flex h-24 w-24 items-center justify-center">
            <span
              className="absolute h-24 w-24 animate-ping rounded-full bg-white/10"
              aria-hidden
            />
            {photo && !isInlineSvgDataUrlToSkipForPhoto(photo) && !isLegacyDicebearUrl(photo) ? (
              <img
                src={photo}
                alt=""
                className="relative h-20 w-20 rounded-full object-cover"
                width={80}
                height={80}
              />
            ) : (
              <div className="relative">
                <InitialsAvatar name={name} size={80} className="!text-2xl" />
              </div>
            )}
          </div>
          <p className="mt-4 text-center text-[20px] font-bold text-white">
            {name}
          </p>
          <p className="mt-1 text-center text-sm" style={{ color: "#8896a0" }}>
            Incoming {callType} call…
          </p>
        </div>
        <div className="flex shrink-0 items-center justify-center gap-20 pb-12 pt-4">
          <button
            type="button"
            onClick={onDecline}
            className="flex h-16 w-16 items-center justify-center rounded-full"
            style={{ background: "#e53e3e" }}
            aria-label="Decline"
          >
            <PhoneOff className="h-7 w-7 text-white" strokeWidth={1.5} />
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="flex h-16 w-16 items-center justify-center rounded-full"
            style={{ background: "#00a884" }}
            aria-label="Accept"
          >
            <Phone className="h-7 w-7 text-white" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    );
  }

  if (callState === "active") {
    const runMenu = (a: GtActiveCallMenuAction) => {
      onActiveCallMenuAction?.(a);
      setActiveCallMoreOpen(false);
    };
    const pipW = callLayoutMobile ? 80 : 120;
    const pipH = callLayoutMobile ? 110 : 160;
    const hasRemoteVideoTrack =
      remoteStream?.getVideoTracks().some((t) => t.readyState === "live") ?? false;
    const remoteUserInitials = initialsFromName(name).trim() || "?";
    const placeholderSub = !remoteStream
      ? "Connecting…"
      : !hasRemoteVideoTrack && callType === "video"
        ? "Waiting for video…"
        : callType === "audio"
          ? "Voice call"
          : "";

    return (
      <div
        className="fixed inset-0 z-50 overflow-hidden"
        style={{
          background: "#0f1923",
        }}
      >
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          muted={false}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            zIndex: 1,
          }}
        />

        {!hasRemoteVideoTrack ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 2,
              background: "#0f1923",
            }}
          >
            {photo && !isInlineSvgDataUrlToSkipForPhoto(photo) && !isLegacyDicebearUrl(photo) ? (
              <img
                src={photo}
                alt=""
                width={80}
                height={80}
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: "50%",
                  objectFit: "cover",
                }}
              />
            ) : (
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: "50%",
                  background: "#1d9e75",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 28,
                  color: "#fff",
                  fontWeight: 500,
                }}
              >
                {remoteUserInitials}
              </div>
            )}
            <div style={{ color: "#fff", marginTop: 12, fontSize: 16 }}>{name}</div>
            {placeholderSub ? (
              <div style={{ color: "#8896a0", marginTop: 4, fontSize: 13 }}>
                {placeholderSub}
              </div>
            ) : null}
          </div>
        ) : null}

        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted={true}
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            width: pipW,
            height: pipH,
            objectFit: "cover",
            borderRadius: 12,
            border: "2px solid rgba(255,255,255,0.3)",
            zIndex: 10,
            background: "#1e2538",
          }}
        />

        <div
          style={{
            position: "absolute",
            top: 16,
            left: 16,
            zIndex: 20,
            color: "#fff",
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 500 }}>{name}</div>
          <div
            style={{
              fontSize: 13,
              color: "rgba(255,255,255,0.7)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {formatCallDurationFmt(callDurationSec)}
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 20,
            background: "linear-gradient(transparent, rgba(0,0,0,0.6))",
            padding: "40px 24px 24px",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          {callType === "video"
            ? circBtn(
                !isCameraOff,
                "#2d4060",
                "#e8956d",
                onToggleCamera,
                "Camera",
                <Video className="h-6 w-6 text-white" strokeWidth={1.5} />,
                <VideoOff className="h-6 w-6 text-white" strokeWidth={1.5} />,
              )
            : null}
          {circBtn(
            !isMuted,
            "#2d4060",
            "#e8956d",
            onToggleMute,
            "Mute",
            <Mic className="h-6 w-6 text-white" strokeWidth={1.5} />,
            <MicOff className="h-6 w-6 text-white" strokeWidth={1.5} />,
          )}
          {circBtn(
            isSpeaker,
            "#2d4060",
            "#e8956d",
            onToggleSpeaker,
            "Speaker",
            <Volume2 className="h-6 w-6 text-white" strokeWidth={1.5} />,
            <Volume2 className="h-5 w-5 text-white/80" strokeWidth={1.5} />,
          )}
          {onActiveCallMenuAction ? (
            <div className="relative">
              <button
                type="button"
                ref={activeCallMoreBtnRef}
                onClick={() => setActiveCallMoreOpen((o) => !o)}
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full"
                style={{ background: "#2d4060" }}
                aria-label="More options"
                aria-expanded={activeCallMoreOpen}
              >
                <MoreVertical
                  className="h-7 w-7 text-white"
                  strokeWidth={1.5}
                  aria-hidden
                />
              </button>
              {activeCallMoreOpen ? (
                <div
                  ref={activeCallMorePanelRef}
                  role="menu"
                  className="absolute bottom-full left-1/2 z-[100] mb-2 w-64 -translate-x-1/2 rounded-2xl border border-white/10 py-1 shadow-2xl"
                  style={{ background: "#1b2838" }}
                >
                  {(
                    [
                      {
                        a: "screen_share" as const,
                        label: "Screen share",
                        icon: (
                          <Monitor
                            className="h-5 w-5 shrink-0 text-white"
                            strokeWidth={1.5}
                          />
                        ),
                      },
                      {
                        a: "send_message" as const,
                        label: "Send message",
                        icon: (
                          <MessageCircle
                            className="h-5 w-5 shrink-0 text-white"
                            strokeWidth={1.5}
                          />
                        ),
                      },
                      {
                        a: "toggle_video" as const,
                        label: "Video",
                        icon: (
                          <Video
                            className="h-5 w-5 shrink-0 text-white"
                            strokeWidth={1.5}
                          />
                        ),
                      },
                      {
                        a: "audio_output" as const,
                        label: "Audio output",
                        sub: audioOutMenuMeta.sub,
                        icon: audioOutMenuMeta.useBtIcon ? (
                          <Bluetooth
                            className="h-5 w-5 shrink-0 text-white"
                            strokeWidth={1.5}
                          />
                        ) : (
                          <Headphones
                            className="h-5 w-5 shrink-0 text-white"
                            strokeWidth={1.5}
                          />
                        ),
                      },
                      {
                        a: "toggle_mute" as const,
                        label: "Mute",
                        icon: (
                          <Mic
                            className="h-5 w-5 shrink-0 text-white"
                            strokeWidth={1.5}
                          />
                        ),
                      },
                      {
                        a: "audio_mode" as const,
                        label: isSpeaker ? "Earpiece mode" : "Speaker mode",
                        sub: "Where you hear the call",
                        icon: (
                          <Smartphone
                            className="h-5 w-5 shrink-0 text-white"
                            strokeWidth={1.5}
                          />
                        ),
                      },
                      {
                        a: "end" as const,
                        label: "End call",
                        icon: (
                          <PhoneOff
                            className="h-5 w-5 shrink-0 text-white"
                            strokeWidth={1.5}
                          />
                        ),
                        danger: true,
                      },
                    ] as const
                  ).map((row) => (
                    <button
                      key={row.a}
                      type="button"
                      role="menuitem"
                      onClick={() => runMenu(row.a)}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm text-white hover:bg-white/10"
                      style={
                        "danger" in row && row.danger
                          ? { color: "#feb4b4" }
                          : undefined
                      }
                    >
                      {row.icon}
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{row.label}</span>
                        {"sub" in row && row.sub ? (
                          <span
                            className="mt-0.5 block text-xs font-normal"
                            style={{ color: "#8896a0" }}
                          >
                            {row.sub}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          {endBtn}
        </div>
      </div>
    );
  }

  return null;
}

const NOTIF_ICON = "/icon-192x192.png";

/** Mutable context for browser notifications (avoids stale closures in Firebase callbacks). */
const hubNotifCtx = {
  activeChatId: null as string | null,
  userId: null as string | null,
};

/** `renotify` is valid in browsers but not in default `NotificationOptions` DOM typings. */
type HubNotificationOptions = NotificationOptions & { renotify?: boolean };

function chatMessagePreviewForNotification(m: ChatMessage): string {
  if (m.type === "gif") return "GIF";
  if (m.type === "text" || m.type === undefined || m.type === "")
    return (m.text ?? "").slice(0, 240);
  if (m.type === "split") return (m.text ?? "").trim() || "Split request";
  return `Attachment (${m.type ?? "file"})`;
}

function showMessageNotification(
  senderName: string,
  message: string,
  chatId: string,
) {
  if (typeof window === "undefined") return;
  if (Notification.permission !== "granted") return;
  if (
    document.visibilityState === "visible" &&
    hubNotifCtx.activeChatId === chatId
  ) {
    return;
  }
  const notification = new Notification(senderName, {
    body: message,
    icon: NOTIF_ICON,
    tag: `message-${chatId}`,
    renotify: true,
  } as HubNotificationOptions);
  notification.onclick = () => {
    window.focus();
    notification.close();
  };
}

function showCallNotification(callerName: string, callType: string) {
  if (typeof window === "undefined") return;
  if (Notification.permission !== "granted") return;
  const notification = new Notification(`Incoming ${callType} call`, {
    body: `${callerName} is calling you`,
    icon: NOTIF_ICON,
    tag: "incoming-call",
    renotify: true,
    requireInteraction: true,
  } as HubNotificationOptions);
  notification.onclick = () => {
    window.focus();
    notification.close();
  };
}

function showGroupInviteNotification(inviterName: string, groupName: string) {
  if (typeof window === "undefined") return;
  if (Notification.permission !== "granted") return;
  if (document.visibilityState === "visible") return;
  const notification = new Notification("Group Invitation", {
    body: `${inviterName} invited you to ${groupName}`,
    icon: NOTIF_ICON,
    tag: "group-invite",
    renotify: true,
  } as HubNotificationOptions);
  notification.onclick = () => {
    window.focus();
    window.location.href = "/notifications";
    notification.close();
  };
}

type HubNotificationRow = {
  id: string;
  type: string;
  title?: string;
  body?: string;
  data: Record<string, unknown> | null;
};

type HubNotificationListOut = {
  notifications: HubNotificationRow[];
  unread_count?: number;
};

export default function TravelHubPage() {
  const router = useRouter();
  const [firebaseReady, setFirebaseReady] = useState(false);
  const [db, setDb] = useState<Database | null>(null);

  const [user, setUser] = useState<UserMe | null>(null);
  const [groups, setGroups] = useState<GroupOut[]>([]);
  const groupsRef = useRef<GroupOut[]>([]);
  groupsRef.current = groups;
  const [trips, setTrips] = useState<TripOut[]>([]);
  const [chats, setChats] = useState<ChatInfo[]>([]);
  const [activeChat, setActiveChat] = useState<ChatInfo | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageText, setMessageText] = useState("");
  const [activeTab, setActiveTab] = useState<
    "chats" | "calls" | "updates"
  >("chats");
  const [createGroupRequestId, setCreateGroupRequestId] = useState(0);
  const [showNewChatPanel, setShowNewChatPanel] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [showSplitPopup, setShowSplitPopup] = useState(false);
  const [splitAmount, setSplitAmount] = useState("");
  const [splitEqually, setSplitEqually] = useState(true);
  const [attachMiniOpen, setAttachMiniOpen] = useState(false);
  const attachMenuRef = useRef<HTMLDivElement | null>(null);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showSearchOverlay, setShowSearchOverlay] = useState(false);
  const [showMenuDrawer, setShowMenuDrawer] = useState(false);
  const [showConnectSettings, setShowConnectSettings] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isMd, setIsMd] = useState(false);
  const [chatPrefs, setChatPrefs] = useState<Record<string, ChatPrefs>>({});
  const [deletedChatIds, setDeletedChatIds] = useState<string[]>([]);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    chat: ChatInfo;
  } | null>(null);
  // Message context menu (WhatsApp style)
  const [messageContextMenu, setMessageContextMenu] = useState<{
    x: number;
    y: number;
    message: ChatMessage;
    mine: boolean;
  } | null>(null);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [contacts, setContacts] = useState<ContactPerson[]>([]);
  const [emojiGifPickerOpen, setEmojiGifPickerOpen] = useState(false);
  const [emojiGifPickerTab, setEmojiGifPickerTab] =
    useState<ChatEmojiGifPickerTab>("emoji");
  const composerMediaPickerRef = useRef<HTMLDivElement | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
    callStyle?: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  /** Mobile visual viewport inset for keeping composer above keyboard */
  const [keyboardBottomOffset, setKeyboardBottomOffset] = useState(0);
  const [profileBannerDismissed, setProfileBannerDismissed] = useState(false);
  const [firebaseBannerDismissed, setFirebaseBannerDismissed] = useState(false);

  const [callState, setCallState] = useState<GtWebrtcCallState>("idle");
  const [currentCall, setCurrentCall] = useState<GtWebrtcCallCurrent | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(true);
  const [callDurationSec, setCallDurationSec] = useState(0);
  const [endedDisplaySec, setEndedDisplaySec] = useState(0);
  const [callHistory, setCallHistory] = useState<GtCallHistoryEntry[]>([]);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteMediaStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const callListenersRef = useRef<(() => void)[]>([]);
  const callStateRef = useRef<GtWebrtcCallState>("idle");
  const callRoleRef = useRef<"caller" | "callee" | null>(null);
  const processedIceRef = useRef<Set<string>>(new Set());
  const callDeleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const endedScreenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const currentCallRef = useRef<GtWebrtcCallCurrent | null>(null);
  const webrtcCleanupLockRef = useRef(false);
  const pendingIncomingDataRef = useRef<{
    callId: string;
    callerId: string;
    callerName: string;
    callerAvatar: string;
    callType: "audio" | "video";
  } | null>(null);

  const notifPermissionAskedThisSessionRef = useRef(false);
  const messageNotifStateRef = useRef<{
    chatId: string;
    primed: boolean;
    seen: Set<string>;
  } | null>(null);
  const lastIncomingCallNotifCallIdRef = useRef<string | null>(null);
  const groupInviteNotifPrimedRef = useRef(false);
  const knownGroupInviteNotifIdsRef = useRef<Set<string>>(new Set());

  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(
    null,
  );
  const [recordSeconds, setRecordSeconds] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesUnsubRef = useRef<(() => void) | null>(null);
  const chatInfoUnsubsRef = useRef<(() => void)[]>([]);
  const recordIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const streamRef = useRef<MediaStream | null>(null);
  const userSearchSeq = useRef(0);
  const [userSearchResults, setUserSearchResults] = useState<
    UserSearchResultRow[]
  >([]);
  const [connectionsList, setConnectionsList] = useState<
    UserSearchResultRow[]
  >([]);
  const [discoverGroupsList, setDiscoverGroupsList] = useState<GroupOut[]>(
    [],
  );
  const [searchOverlayLoading, setSearchOverlayLoading] = useState(false);
  const [incomingFrIdBySender, setIncomingFrIdBySender] = useState<
    Record<string, string>
  >({});
  const [userSearchActionId, setUserSearchActionId] = useState<string | null>(
    null,
  );
  const [searchProfileFor, setSearchProfileFor] =
    useState<UserSearchResultRow | null>(null);
  const [profileReportDialogOpen, setProfileReportDialogOpen] =
    useState(false);
  const [searchProfileSubTab, setSearchProfileSubTab] = useState<
    "media" | "links" | "docs" | "trips" | "activities"
  >("media");
  /** When true on viewports under 768px, show full-screen chat (list hidden). */
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [buddiesMenuOpenId, setBuddiesMenuOpenId] = useState<string | null>(
    null,
  );
  const showSearchOverlayPrev = useRef(false);
  const dmHandoffFromBuddiesDone = useRef(false);
  const chatSearchInputRef = useRef<HTMLInputElement | null>(null);
  const messageComposerInputRef = useRef<HTMLInputElement | null>(null);
  const [showInChatSearch, setShowInChatSearch] = useState(false);
  const [inChatSearchQuery, setInChatSearchQuery] = useState("");
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [showDmInfo, setShowDmInfo] = useState(false);
  useEffect(() => {
    setShowDmInfo(false);
    setShowGroupInfo(false);
  }, [activeChat?.id]);
  const [groupCallPicker, setGroupCallPicker] = useState<{
    type: "audio" | "video";
    chat: ChatInfo;
  } | null>(null);
  const [scheduleCallOpen, setScheduleCallOpen] = useState<{
    chat: ChatInfo;
  } | null>(null);
  const [scheduleCallTitle, setScheduleCallTitle] = useState("");
  const [scheduleCallAt, setScheduleCallAt] = useState("");
  const [scheduleVersion, setScheduleVersion] = useState(0);
  const [groupDrawerWidth, setGroupDrawerWidth] = useState<number>(() => {
    if (typeof window === "undefined") return 400;
    const raw = window.localStorage.getItem("gt_group_drawer_width");
    const n = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(n) && n >= 320 && n <= 640 ? n : 400;
  });
  const drawerResizeRef = useRef<{ startX: number; startW: number } | null>(
    null,
  );
  const [activeGroupHydrateLoading, setActiveGroupHydrateLoading] =
    useState(false);
  const [groupMemberPanelGroupId, setGroupMemberPanelGroupId] = useState<
    string | null
  >(null);
  const [peerLastReadAt, setPeerLastReadAt] = useState(0);
  /** Firebase /presence/{peerId}/online for active DM header */
  const [dmHeaderPeerOnline, setDmHeaderPeerOnline] = useState<boolean | null>(
    null,
  );
  /** Outgoing only: `true` when callee has `presence/…/online` — show "Ringing…" vs "Calling…" */
  const [outgoingPeerOnline, setOutgoingPeerOnline] = useState<
    boolean | null
  >(null);
  /**
   * When non-null, show picker to set HTMLMediaElement.setSinkId (Chrome/Edge).
   */
  const [callAudioOutputDevices, setCallAudioOutputDevices] = useState<
    MediaDeviceInfo[] | null
  >(null);
  /** Firebase /presence/{id}/online for open profile panel */
  const [profilePanelPeerOnline, setProfilePanelPeerOnline] = useState<
    boolean | null
  >(null);

  const cleanupRef = useRef<(() => void)[]>([]);
  const registerCleanup = useCallback((fn: () => void) => {
    cleanupRef.current.push(fn);
  }, []);

  const masterAbortRef = useRef<AbortController | null>(null);
  const toastHideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const messagesScrollToEndTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const v = localStorage.getItem(GT_TRAVELHUB_ACTIVE_TAB);
      if (v === "groups" || v === "contacts") {
        setActiveTab("chats");
        localStorage.setItem(GT_TRAVELHUB_ACTIVE_TAB, "chats");
      }
    } catch {
      /* ignore */
    }
  }, []);

  useLayoutEffect(() => {
    masterAbortRef.current = new AbortController();
    registerCleanup(() => {
      try {
        masterAbortRef.current?.abort();
        messagesUnsubRef.current?.();
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        if (messagesScrollToEndTimeoutRef.current) {
          clearTimeout(messagesScrollToEndTimeoutRef.current);
          messagesScrollToEndTimeoutRef.current = null;
        }
        if (recordIntervalRef.current) {
          clearInterval(recordIntervalRef.current);
          recordIntervalRef.current = null;
        }
        if (toastHideTimeoutRef.current) {
          clearTimeout(toastHideTimeoutRef.current);
          toastHideTimeoutRef.current = null;
        }
      } catch {
        /* ignore */
      }
    });
    return () => {
      masterAbortRef.current?.abort();
      masterAbortRef.current = null;
    };
  }, [registerCleanup]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onPageHide = (ev: PageTransitionEvent) => {
      if (ev.persisted) return;
      masterAbortRef.current?.abort();
    };
    window.addEventListener("pagehide", onPageHide);
    registerCleanup(() => {
      try {
        window.removeEventListener("pagehide", onPageHide);
      } catch {
        /* ignore */
      }
    });
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [registerCleanup]);

  const showToast = useCallback(
    (message: string, type: "success" | "error" = "success") => {
      if (toastHideTimeoutRef.current) {
        clearTimeout(toastHideTimeoutRef.current);
        toastHideTimeoutRef.current = null;
      }
      setToast({ message, type });
      toastHideTimeoutRef.current = globalThis.setTimeout(() => {
        setToast(null);
        toastHideTimeoutRef.current = null;
      }, 3000);
    },
    [],
  );

  const showCallToast = useCallback((message: string) => {
    if (toastHideTimeoutRef.current) {
      clearTimeout(toastHideTimeoutRef.current);
      toastHideTimeoutRef.current = null;
    }
    setToast({ message, type: "success", callStyle: true });
    toastHideTimeoutRef.current = globalThis.setTimeout(() => {
      setToast(null);
      toastHideTimeoutRef.current = null;
    }, 2000);
  }, []);

  const requestNotificationPermission = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") return;
    if (Notification.permission === "denied") return;
    if (notifPermissionAskedThisSessionRef.current) return;
    notifPermissionAskedThisSessionRef.current = true;
    const permission = await Notification.requestPermission();
    console.log("Notification permission:", permission);
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    const t = globalThis.setTimeout(() => {
      void requestNotificationPermission();
    }, 3000);
    return () => clearTimeout(t);
  }, [user?.id, requestNotificationPermission]);

  useEffect(() => {
    hubNotifCtx.activeChatId = activeChat?.id ?? null;
  }, [activeChat?.id]);

  useEffect(() => {
    hubNotifCtx.userId = user?.id ?? null;
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      groupInviteNotifPrimedRef.current = false;
      knownGroupInviteNotifIdsRef.current.clear();
      return;
    }
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await apiFetchWithStatus<HubNotificationListOut>(
          "/notifications?limit=25",
        );
        if (cancelled || res.status !== 200 || !Array.isArray(res.data?.notifications))
          return;
        const list = res.data.notifications;
        if (!groupInviteNotifPrimedRef.current) {
          for (const n of list) {
            if (n.type === "group_invite") knownGroupInviteNotifIdsRef.current.add(n.id);
          }
          groupInviteNotifPrimedRef.current = true;
          return;
        }
        for (const n of list) {
          if (n.type !== "group_invite") continue;
          if (knownGroupInviteNotifIdsRef.current.has(n.id)) continue;
          knownGroupInviteNotifIdsRef.current.add(n.id);
          const data = n.data;
          const inviter =
            typeof data?.invited_by_name === "string"
              ? data.invited_by_name
              : "Someone";
          const gname =
            typeof data?.group_name === "string"
              ? data.group_name
              : "a group";
          showGroupInviteNotification(inviter, gname);
        }
      } catch {
        /* ignore */
      }
    };
    void poll();
    const iv = globalThis.setInterval(() => void poll(), 90_000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [user?.id]);

  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  useEffect(() => {
    currentCallRef.current = currentCall;
  }, [currentCall]);

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setCallHistory(readCallHistoryLs());
  }, []);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      void remoteVideoRef.current.play().catch(console.log);
    }
  }, [remoteStream]);

  useLayoutEffect(() => {
    const el = remoteVideoRef.current;
    if (!el) return;
    el.muted = false;
    if (callState === "active") {
      el.volume = isSpeaker ? 1 : 0.28;
    } else {
      el.volume = 1;
    }
  }, [isSpeaker, remoteStream, callState]);

  const addCallListener = useCallback((unsub: () => void) => {
    callListenersRef.current.push(unsub);
  }, []);

  const clearCallDurationTimer = useCallback(() => {
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
  }, []);

  const attachSymmetricRenegotiationListeners = useCallback(
    (pc: RTCPeerConnection, callId: string) => {
      if (!db) return;

      const uAnswer = onValue(ref(db, `calls/${callId}/answer`), async (snap) => {
        const a = snap.val() as { type?: string; sdp?: string } | null;
        if (!a?.sdp || peerConnectionRef.current !== pc) return;
        if (pc.signalingState !== "have-local-offer") return;
        if (pc.remoteDescription?.sdp === a.sdp) return;
        try {
          await pc.setRemoteDescription(
            new RTCSessionDescription({
              type: (a.type ?? "answer") as RTCSdpType,
              sdp: a.sdp,
            }),
          );
          if (callStateRef.current === "outgoing") {
            setCallState("active");
            setCurrentCall((prev) =>
              prev
                ? {
                    ...prev,
                    startTime: Date.now(),
                  }
                : prev,
            );
            clearCallDurationTimer();
            setCallDurationSec(0);
            durationTimerRef.current = globalThis.setInterval(() => {
              setCallDurationSec((s) => s + 1);
            }, 1000);
          }
        } catch {
          /* ignore */
        }
      });
      addCallListener(uAnswer);

      const uOffer = onValue(ref(db, `calls/${callId}/offer`), async (snap) => {
        const o = snap.val() as { type?: string; sdp?: string } | null;
        if (!o?.sdp || peerConnectionRef.current !== pc) return;
        if (pc.signalingState !== "stable") return;
        if (pc.localDescription?.sdp === o.sdp) return;
        if (pc.remoteDescription?.sdp === o.sdp) return;
        try {
          await pc.setRemoteDescription(
            new RTCSessionDescription({
              type: (o.type ?? "offer") as RTCSdpType,
              sdp: o.sdp,
            }),
          );
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await set(ref(db, `calls/${callId}/answer`), {
            type: answer.type,
            sdp: answer.sdp,
          });
        } catch {
          /* ignore */
        }
      });
      addCallListener(uOffer);
    },
    [db, addCallListener, clearCallDurationTimer],
  );

  const triggerRenegotiationOffer = useCallback(
    async (pc: RTCPeerConnection, callId: string) => {
      if (!db || peerConnectionRef.current !== pc) return;
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await set(ref(db, `calls/${callId}/offer`), {
          type: offer.type,
          sdp: offer.sdp,
        });
      } catch {
        showCallToast("Could not update call connection");
      }
    },
    [db, showCallToast],
  );

  const endCallAndCleanup = useCallback(
    async (opts: {
      history?: GtCallHistoryEntry;
      setEnded?: boolean;
    }) => {
      if (webrtcCleanupLockRef.current) return;
      webrtcCleanupLockRef.current = true;
      const cc = currentCallRef.current;
      const callId = cc?.callId;
      const d = db;
      if (d && callId) {
        try {
          await update(ref(d, `calls/${callId}`), { status: "ended" });
        } catch {
          /* ignore */
        }
        if (cc && user) {
          const other =
            cc.direction === "outgoing" ? cc.remoteUser.id : cc.remoteUser.id;
          try {
            await remove(ref(d, `users/${other}/incoming_call`));
          } catch {
            /* ignore */
          }
          try {
            await remove(ref(d, `users/${user.id}/incoming_call`));
          } catch {
            /* ignore */
          }
        }
        if (callDeleteTimerRef.current) {
          clearTimeout(callDeleteTimerRef.current);
        }
        callDeleteTimerRef.current = globalThis.setTimeout(() => {
          if (!d) return;
          void remove(ref(d, `calls/${callId}`)).catch(() => {});
          callDeleteTimerRef.current = null;
        }, 30_000);
      }
      try {
        localStreamRef.current?.getTracks().forEach((t) => t.stop());
      } catch {
        /* ignore */
      }
      setLocalStream(null);
      setRemoteStream(null);
      remoteMediaStreamRef.current = null;
      peerConnectionRef.current?.close();
      peerConnectionRef.current = null;
      callRoleRef.current = null;
      processedIceRef.current = new Set();
      callListenersRef.current.forEach((u) => {
        try {
          u();
        } catch {
          /* ignore */
        }
      });
      callListenersRef.current = [];
      clearCallDurationTimer();
      setIsMuted(false);
      setIsCameraOff(false);
      if (endedScreenTimerRef.current) {
        clearTimeout(endedScreenTimerRef.current);
        endedScreenTimerRef.current = null;
      }
      if (opts.setEnded && cc) {
        const dur =
          opts.history?.duration ??
          (cc.startTime != null
            ? Math.max(0, Math.floor((Date.now() - cc.startTime) / 1000))
            : 0);
        setEndedDisplaySec(dur);
        if (opts.history) {
          setCallHistory((prev) => {
            const n = [opts.history!, ...prev].slice(0, 200);
            writeJsonLs(GT_CALL_HISTORY, n);
            return n;
          });
        }
        setCallState("ended");
        endedScreenTimerRef.current = globalThis.setTimeout(() => {
          setCallState("idle");
          setCurrentCall(null);
          setEndedDisplaySec(0);
        }, 2000);
      } else {
        setCallState("idle");
        setCurrentCall(null);
        if (opts.history) {
          setCallHistory((prev) => {
            const n = [opts.history!, ...prev].slice(0, 200);
            writeJsonLs(GT_CALL_HISTORY, n);
            return n;
          });
        }
      }
      globalThis.setTimeout(() => {
        webrtcCleanupLockRef.current = false;
      }, 400);
    },
    [db, user, clearCallDurationTimer],
  );

  const startOutgoingCall = useCallback(
    async (
      callType: "audio" | "video",
      remote: { id: string; name: string; avatar: string | null },
    ) => {
      if (typeof RTCPeerConnection === "undefined") {
        showCallToast(
          "Your browser doesn't support calls. Please use Chrome or Edge.",
        );
        return;
      }
      if (!db || !user) {
        showCallToast("Cannot start call");
        return;
      }
      if (callStateRef.current !== "idle") return;
      const exist = await apiFetchWithStatus<UserProfileIdOut>(
        `/users/${encodeURIComponent(remote.id)}`,
      );
      if (exist.status === 404) {
        showCallToast("This user doesn't have an account.");
        return;
      }
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: callType === "video",
        });
      } catch (e) {
        const n = (e as { name?: string })?.name;
        if (n === "NotAllowedError") {
          showCallToast("Please allow microphone/camera access");
        } else {
          showCallToast("Could not access camera/microphone");
        }
        return;
      }
      const callId = push(ref(db, "calls")).key;
      if (!callId) {
        stream.getTracks().forEach((t) => t.stop());
        showCallToast("Could not start call");
        return;
      }
      localStreamRef.current = stream;
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      setIsMuted(false);
      setIsCameraOff(false);
      setCurrentCall({
        callId,
        callType,
        remoteUser: {
          id: remote.id,
          name: remote.name,
          avatar: remote.avatar,
        },
        direction: "outgoing",
        startTime: null,
        duration: 0,
      });
      callRoleRef.current = "caller";
      setCallState("outgoing");
      remoteMediaStreamRef.current = null;
      const pc = new RTCPeerConnection(ICE_SERVERS);
      peerConnectionRef.current = pc;
      processedIceRef.current = new Set();
      pc.oniceconnectionstatechange = () => {
        console.log("ICE state:", pc.iceConnectionState);
      };
      pc.onconnectionstatechange = () => {
        console.log("Connection state:", pc.connectionState);
        if (pc.connectionState === "connected") {
          console.log("WebRTC connected successfully!");
        }
        if (pc.connectionState === "failed") {
          console.log("WebRTC connection failed - trying to restart ICE");
          pc.restartIce();
        }
      };
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      pc.ontrack = (event) => {
        console.log("ontrack:", event.track.kind);
        setRemoteStream((prev) => {
          const stream = prev ?? new MediaStream();
          const exists = stream.getTracks().some((t) => t.id === event.track.id);
          if (!exists) {
            stream.addTrack(event.track);
          }
          remoteMediaStreamRef.current = stream;
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = stream;
            void remoteVideoRef.current.play().catch(console.log);
          }
          return stream;
        });
      };
      const icePath = `calls/${callId}/ice_candidates/caller`;
      pc.onicecandidate = (ev) => {
        if (!ev.candidate) return;
        void push(
          ref(db, icePath),
          ev.candidate.toJSON
            ? ev.candidate.toJSON()
            : {
                candidate: ev.candidate.candidate,
                sdpMid: ev.candidate.sdpMid,
                sdpMLineIndex: ev.candidate.sdpMLineIndex,
              },
        );
      };
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await set(ref(db, `calls/${callId}/offer`), {
          type: offer.type,
          sdp: offer.sdp,
        });
        await update(ref(db, `calls/${callId}`), {
          caller_id: user.id,
          callee_id: remote.id,
          call_type: callType,
          status: "ringing",
          created_at: Date.now(),
        });
        try {
          await set(ref(db, `users/${remote.id}/incoming_call`), {
            call_id: callId,
            caller_name: user.full_name ?? "Someone",
            caller_avatar: "",
            call_type: callType,
          });
        } catch {
          void remove(ref(db, `calls/${callId}`)).catch(() => {});
          showCallToast("This user doesn't have an account.");
          stream.getTracks().forEach((t) => t.stop());
          setLocalStream(null);
          setCallState("idle");
          setCurrentCall(null);
          peerConnectionRef.current?.close();
          peerConnectionRef.current = null;
          return;
        }
        attachSymmetricRenegotiationListeners(pc, callId);
        const uIce = onChildAdded(
          ref(db, `calls/${callId}/ice_candidates/callee`),
          async (c) => {
            const v = c.val() as
              | { candidate?: string; sdpMid?: string | null; sdpMLineIndex?: number | null }
              | null;
            if (!v?.candidate || !pc) return;
            const k = c.key;
            if (!k || processedIceRef.current.has(`c${k}`)) return;
            processedIceRef.current.add(`c${k}`);
            try {
              await pc.addIceCandidate(
                new RTCIceCandidate({
                  candidate: v.candidate,
                  sdpMid: v.sdpMid ?? null,
                  sdpMLineIndex: v.sdpMLineIndex ?? 0,
                }),
              );
            } catch {
              /* ignore */
            }
          },
        );
        addCallListener(uIce);
        const uEnd = onValue(
          ref(db, `calls/${callId}/status`),
          (s) => {
            if (s.val() === "ended" && callStateRef.current !== "idle") {
              void endCallAndCleanup({
                history: {
                  user_id: remote.id,
                  user_name: remote.name,
                  call_type: callType,
                  direction: "outgoing",
                  duration: 0,
                  timestamp: Date.now(),
                  status: "ended",
                },
                setEnded: true,
              });
            }
          },
        );
        addCallListener(uEnd);
      } catch {
        showCallToast("Could not start call");
        stream.getTracks().forEach((t) => t.stop());
        setLocalStream(null);
        setCallState("idle");
        setCurrentCall(null);
        peerConnectionRef.current?.close();
        peerConnectionRef.current = null;
      }
    },
    [
      db,
      user,
      showCallToast,
      addCallListener,
      clearCallDurationTimer,
      endCallAndCleanup,
      attachSymmetricRenegotiationListeners,
    ],
  );

  const acceptIncomingCall = useCallback(async () => {
    const p = pendingIncomingDataRef.current;
    if (typeof RTCPeerConnection === "undefined" || !p || !db || !user) {
      showCallToast("Cannot accept call");
      return;
    }
    if (callStateRef.current !== "incoming") return;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: p.callType === "video",
      });
    } catch (e) {
      const n = (e as { name?: string })?.name;
      if (n === "NotAllowedError") {
        showCallToast("Please allow microphone/camera access");
      } else {
        showCallToast("Could not access camera/microphone");
      }
      return;
    }
    const callId = p.callId;
    remoteMediaStreamRef.current = null;
    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionRef.current = pc;
    processedIceRef.current = new Set();
    callRoleRef.current = "callee";
    localStreamRef.current = stream;
    setLocalStream(stream);
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }
    pc.oniceconnectionstatechange = () => {
      console.log("ICE state:", pc.iceConnectionState);
    };
    pc.onconnectionstatechange = () => {
      console.log("Connection state:", pc.connectionState);
      if (pc.connectionState === "connected") {
        console.log("WebRTC connected successfully!");
      }
      if (pc.connectionState === "failed") {
        console.log("WebRTC connection failed - trying to restart ICE");
        pc.restartIce();
      }
    };
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));
    pc.ontrack = (event) => {
      console.log("ontrack:", event.track.kind);
      setRemoteStream((prev) => {
        const stream = prev ?? new MediaStream();
        const exists = stream.getTracks().some((t) => t.id === event.track.id);
        if (!exists) {
          stream.addTrack(event.track);
        }
        remoteMediaStreamRef.current = stream;
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
          void remoteVideoRef.current.play().catch(console.log);
        }
        return stream;
      });
    };
    const icePathCallee = `calls/${callId}/ice_candidates/callee`;
    pc.onicecandidate = (ev) => {
      if (!ev.candidate) return;
      void push(
        ref(db, icePathCallee),
        ev.candidate.toJSON
          ? ev.candidate.toJSON()
          : {
              candidate: ev.candidate.candidate,
              sdpMid: ev.candidate.sdpMid,
              sdpMLineIndex: ev.candidate.sdpMLineIndex,
            },
      );
    };
    try {
      const os = await get(ref(db, `calls/${callId}/offer`));
      const o = os.val() as { type?: string; sdp?: string } | null;
      if (!o?.sdp) throw new Error("no offer");
      await pc.setRemoteDescription(
        new RTCSessionDescription({
          type: (o.type ?? "offer") as RTCSdpType,
          sdp: o.sdp,
        }),
      );
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await set(ref(db, `calls/${callId}/answer`), {
        type: answer.type,
        sdp: answer.sdp,
      });
      await update(ref(db, `calls/${callId}`), { status: "active" });
      try {
        await remove(ref(db, `users/${user.id}/incoming_call`));
      } catch {
        /* ignore */
      }
      setCurrentCall((prev) =>
        prev
          ? { ...prev, startTime: Date.now() }
          : {
              callId,
              callType: p.callType,
              remoteUser: {
                id: p.callerId,
                name: p.callerName,
                avatar: p.callerAvatar || null,
              },
              direction: "incoming",
              startTime: Date.now(),
              duration: 0,
            },
      );
      setCallState("active");
      clearCallDurationTimer();
      setCallDurationSec(0);
      durationTimerRef.current = globalThis.setInterval(() => {
        setCallDurationSec((s) => s + 1);
      }, 1000);
      const uIceC = onChildAdded(
        ref(db, `calls/${callId}/ice_candidates/caller`),
        async (c) => {
          const v = c.val() as
            | { candidate?: string; sdpMid?: string | null; sdpMLineIndex?: number | null }
            | null;
          if (!v?.candidate) return;
          const k = c.key;
          if (!k || processedIceRef.current.has(`b${k}`)) return;
          processedIceRef.current.add(`b${k}`);
          try {
            await pc.addIceCandidate(
              new RTCIceCandidate({
                candidate: v.candidate,
                sdpMid: v.sdpMid ?? null,
                sdpMLineIndex: v.sdpMLineIndex ?? 0,
              }),
            );
          } catch {
            /* ignore */
          }
        },
      );
      addCallListener(uIceC);
      const uEnd = onValue(
        ref(db, `calls/${callId}/status`),
        (s) => {
          if (s.val() === "ended") {
            void endCallAndCleanup({
              history: {
                user_id: p.callerId,
                user_name: p.callerName,
                call_type: p.callType,
                direction: "incoming",
                duration: 0,
                timestamp: Date.now(),
                status: "ended",
              },
              setEnded: true,
            });
          }
        },
      );
      addCallListener(uEnd);
      attachSymmetricRenegotiationListeners(pc, callId);
    } catch {
      showCallToast("Could not connect call");
      stream.getTracks().forEach((t) => t.stop());
      setLocalStream(null);
      setCallState("idle");
      setCurrentCall(null);
      peerConnectionRef.current?.close();
      peerConnectionRef.current = null;
    }
  }, [
    db,
    user,
    showCallToast,
    addCallListener,
    clearCallDurationTimer,
    endCallAndCleanup,
    attachSymmetricRenegotiationListeners,
  ]);

  const declineIncomingCall = useCallback(async () => {
    const p = pendingIncomingDataRef.current;
    if (!p || !db) return;
    try {
      await update(ref(db, `calls/${p.callId}`), { status: "ended" });
    } catch {
      /* ignore */
    }
    if (user) {
      try {
        await remove(ref(db, `users/${user.id}/incoming_call`));
      } catch {
        /* ignore */
      }
    }
    setCallState("idle");
    setCurrentCall(null);
    pendingIncomingDataRef.current = null;
  }, [db, user]);

  const hangupCall = useCallback(() => {
    const cc = currentCall;
    if (!cc) return;
    const dur =
      cc.startTime != null
        ? Math.max(0, Math.floor((Date.now() - cc.startTime) / 1000))
        : 0;
    const hist: GtCallHistoryEntry = {
      user_id: cc.remoteUser.id,
      user_name: cc.remoteUser.name,
      call_type: cc.callType,
      direction: cc.direction,
      duration: dur,
      timestamp: Date.now(),
      status: "ended",
    };
    void endCallAndCleanup({ history: hist, setEnded: true });
  }, [currentCall, endCallAndCleanup]);

  const onCallToggleMute = useCallback(() => {
    setIsMuted((m) => {
      const next = !m;
      localStreamRef.current?.getAudioTracks().forEach((t) => {
        t.enabled = !next;
      });
      return next;
    });
  }, []);

  const onCallToggleCamera = useCallback(() => {
    setIsCameraOff((c) => {
      const next = !c;
      localStreamRef.current?.getVideoTracks().forEach((t) => {
        t.enabled = !next;
      });
      return next;
    });
  }, []);

  const onCallToggleSpeaker = useCallback(() => {
    setIsSpeaker((s) => !s);
  }, []);

  const handleActiveCallMenuAction = useCallback(
    async (action: GtActiveCallMenuAction) => {
      switch (action) {
        case "screen_share": {
          const pc = peerConnectionRef.current;
          const cc = currentCallRef.current;
          if (!pc || !cc) {
            showCallToast("Call not ready");
            break;
          }
          try {
            const display = await navigator.mediaDevices.getDisplayMedia({
              video: true,
              audio: true,
            });
            const vTrack = display.getVideoTracks()[0];
            if (!vTrack) {
              showCallToast("No screen track");
              break;
            }
            const videoSender = pc
              .getSenders()
              .find((s) => s.track?.kind === "video");
            if (videoSender) {
              await videoSender.replaceTrack(vTrack);
              vTrack.addEventListener("ended", () => {
                const loc = localStreamRef.current?.getVideoTracks()[0];
                if (loc) void videoSender.replaceTrack(loc);
              });
              showCallToast("You’re sharing your screen");
            } else {
              try {
                pc.addTrack(vTrack, display);
                await triggerRenegotiationOffer(pc, cc.callId);
                showCallToast("You’re sharing your screen");
              } catch {
                showCallToast("Could not share screen in this call");
              }
            }
          } catch {
            showCallToast("Screen share cancelled or not allowed");
          }
          break;
        }
        case "send_message": {
          messageComposerInputRef.current?.focus();
          showCallToast("Type your message in the bar below");
          break;
        }
        case "toggle_video": {
          const pc = peerConnectionRef.current;
          const cc = currentCallRef.current;
          if (!pc || !cc || callStateRef.current !== "active") {
            onCallToggleCamera();
            break;
          }
          const streamNow = localStreamRef.current;
          const hasVideoTrack = !!streamNow?.getVideoTracks().length;
          if (cc.callType === "audio" && !hasVideoTrack) {
            try {
              const cam = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: false,
              });
              const vt = cam.getVideoTracks()[0];
              if (!vt || !streamNow) {
                showCallToast("Could not start camera");
                cam.getTracks().forEach((t) => t.stop());
                break;
              }
              const aud = streamNow.getAudioTracks()[0];
              if (!aud) {
                showCallToast("Could not start camera");
                cam.getTracks().forEach((t) => t.stop());
                break;
              }
              const merged = new MediaStream([aud, vt]);
              localStreamRef.current = merged;
              setLocalStream(merged);
              if (localVideoRef.current) {
                localVideoRef.current.srcObject = merged;
              }
              pc.addTrack(vt, merged);
              setCurrentCall((prev) =>
                prev ? { ...prev, callType: "video" } : prev,
              );
              setIsCameraOff(false);
              await triggerRenegotiationOffer(pc, cc.callId);
              showCallToast("Video is on");
            } catch {
              showCallToast("Could not start camera");
            }
            break;
          }
          onCallToggleCamera();
          break;
        }
        case "audio_output": {
          try {
            const list = (
              await navigator.mediaDevices.enumerateDevices()
            ).filter((d) => d.kind === "audiooutput");
            const el = remoteVideoRef.current;
            const suggestBt = list.some((d) =>
              looksLikeBluetoothAudioDeviceLabel(d.label),
            );
            if (
              !list.length ||
              !el ||
              typeof (el as HTMLVideoElement & { setSinkId?: (id: string) => Promise<void> })
                .setSinkId !== "function"
            ) {
              showCallToast(
                suggestBt
                  ? "Change speaker or Bluetooth in your system or the browser’s site settings"
                  : "Change speaker in your system or the browser’s site settings",
              );
              break;
            }
            setCallAudioOutputDevices(list);
          } catch {
            showCallToast("Could not list audio outputs");
          }
          break;
        }
        case "toggle_mute": {
          onCallToggleMute();
          break;
        }
        case "audio_mode": {
          onCallToggleSpeaker();
          break;
        }
        case "end": {
          hangupCall();
          break;
        }
      }
    },
    [
      showCallToast,
      hangupCall,
      onCallToggleCamera,
      onCallToggleMute,
      onCallToggleSpeaker,
      triggerRenegotiationOffer,
      setCurrentCall,
      setIsCameraOff,
      setLocalStream,
    ],
  );

  useEffect(() => {
    return () => {
      if (toastHideTimeoutRef.current) {
        clearTimeout(toastHideTimeoutRef.current);
        toastHideTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !db || !user?.id) return;
    const r = ref(db, `users/${user.id}/incoming_call`);
    const unsub = onValue(r, (snap) => {
      if (!snap.exists()) {
        if (callStateRef.current === "incoming") {
          setCallState("idle");
          setCurrentCall(null);
        }
        pendingIncomingDataRef.current = null;
        lastIncomingCallNotifCallIdRef.current = null;
        return;
      }
      const v = snap.val() as
        | {
            call_id?: string;
            caller_name?: string;
            caller_avatar?: string;
            call_type?: string;
          }
        | null;
      if (!v?.call_id) return;
      if (callStateRef.current !== "idle") return;
      const callType: "audio" | "video" =
        v.call_type === "video" ? "video" : "audio";
      if (lastIncomingCallNotifCallIdRef.current !== v.call_id) {
        lastIncomingCallNotifCallIdRef.current = v.call_id;
        showCallNotification(v.caller_name ?? "Someone", callType);
      }
      pendingIncomingDataRef.current = {
        callId: v.call_id,
        callerId: "unknown",
        callerName: v.caller_name ?? "Someone",
        callerAvatar: v.caller_avatar ?? "",
        callType,
      };
      get(ref(db, `calls/${v.call_id}`))
        .then((s) => {
          const data = s.val() as { caller_id?: string } | null;
          const cid = data?.caller_id ?? "unknown";
          if (pendingIncomingDataRef.current) {
            pendingIncomingDataRef.current = {
              ...pendingIncomingDataRef.current,
              callerId: cid,
            };
          }
          setCurrentCall({
            callId: v.call_id!,
            callType,
            remoteUser: {
              id: cid,
              name: v.caller_name ?? "Someone",
              avatar: v.caller_avatar || null,
            },
            direction: "incoming",
            startTime: null,
            duration: 0,
          });
          setCallState("incoming");
        })
        .catch(() => {
          setCurrentCall({
            callId: v.call_id!,
            callType,
            remoteUser: {
              id: "unknown",
              name: v.caller_name ?? "Someone",
              avatar: v.caller_avatar || null,
            },
            direction: "incoming",
            startTime: null,
            duration: 0,
          });
          setCallState("incoming");
        });
    });
    registerCleanup(() => {
      try {
        unsub();
      } catch {
        /* ignore */
      }
    });
    return () => {
      try {
        unsub();
      } catch {
        /* ignore */
      }
    };
  }, [db, user?.id, registerCleanup]);

  useEffect(() => {
    return () => {
      try {
        localStreamRef.current?.getTracks().forEach((t) => t.stop());
        peerConnectionRef.current?.close();
        callListenersRef.current.forEach((u) => {
          try {
            u();
          } catch {
            /* ignore */
          }
        });
        callListenersRef.current = [];
      } catch {
        /* ignore */
      }
    };
  }, []);

  const handleUnauthorized = useCallback(() => {
    clearToken();
    router.push("/login");
  }, [router]);

  const tryEnrichOpenProfile = useCallback(async (row: UserSearchResultRow) => {
    const token = localStorage.getItem("gt_token");
    if (!token) return;
    const first =
      (row.full_name || "").trim().split(/\s+/).filter(Boolean)[0] ?? "";
    if (first.length < 2) return;
    try {
      const res = await fetchWithTimeout(
        `http://localhost:8000/api/v1/users/search?q=${encodeURIComponent(normalizeConnectUserSearchQuery(first))}&limit=20`,
        {
          headers: { Authorization: `Bearer ${token}` },
          signal: masterAbortRef.current?.signal,
        },
      );
      if (!res.ok) return;
      const data: unknown = await res.json();
      if (!Array.isArray(data)) return;
      const found = data.find(
        (x: { id: string }) => (x as UserSearchResultRow).id === row.id,
      ) as UserSearchResultRow | undefined;
      if (found) {
        setSearchProfileFor((prev) => {
          if (prev?.id !== row.id) return prev;
          return { ...found, friend_status: prev.friend_status };
        });
      }
    } catch (e) {
      if (isAbortError(e)) return;
      /* ignore */
    }
  }, []);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const raw = sessionStorage.getItem(GT_TRAVELHUB_OPEN_PROFILE);
    if (!raw) return;
    try {
      const p = JSON.parse(raw) as UserSearchResultRow;
      sessionStorage.removeItem(GT_TRAVELHUB_OPEN_PROFILE);
      setSearchProfileFor(p);
      setSearchProfileSubTab("media");
      void tryEnrichOpenProfile(p);
    } catch {
      /* ignore */
    }
  }, [tryEnrichOpenProfile]);

  useEffect(() => {
    if (searchProfileFor) setSearchProfileSubTab("media");
  }, [searchProfileFor?.id]);

  useEffect(() => {
    if (!db || !user?.id) return;
    const r = ref(db, `presence/${user.id}/online`);
    set(r, true)
      .then(() => onDisconnect(r).set(false))
      .catch(() => {
        /* rules / offline */
      });
    return () => {
      set(r, false).catch(() => {});
    };
  }, [db, user?.id]);

  /** HTTP presence: slow, silent, tab-visible only — must never set React state or surface errors. */
  useEffect(() => {
    if (typeof window === "undefined" || !user?.id) return;

    const pingPresence = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const token = localStorage.getItem("gt_token");
        if (!token) return;
        await fetch(`${API_BASE}/auth/presence`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(5000),
        });
      } catch {
        /* silent */
      }
    };

    void pingPresence();
    const intervalId = window.setInterval(pingPresence, 120_000);

    let visibilityPingTimer: number | null = null;
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        if (visibilityPingTimer) {
          clearTimeout(visibilityPingTimer);
          visibilityPingTimer = null;
        }
        visibilityPingTimer = window.setTimeout(() => {
          visibilityPingTimer = null;
          void pingPresence();
        }, 2000);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(intervalId);
      if (visibilityPingTimer) clearTimeout(visibilityPingTimer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!db || !user?.id) {
      setDmHeaderPeerOnline(null);
      return;
    }
    if (
      !activeChat ||
      activeChat.isDemo ||
      activeChat.isBot ||
      activeChat.type !== "individual"
    ) {
      setDmHeaderPeerOnline(null);
      return;
    }
    const peerId = activeChat.members.find((m) => m !== user.id);
    if (!peerId) {
      setDmHeaderPeerOnline(null);
      return;
    }
    const r = ref(db, `presence/${peerId}/online`);
    const unsub = onValue(r, (snap) => {
      setDmHeaderPeerOnline(snap.val() === true);
    });
    registerCleanup(() => {
      try {
        unsub();
      } catch {
        /* ignore */
      }
    });
    return () => {
      unsub();
    };
  }, [db, user?.id, activeChat, registerCleanup]);

  useEffect(() => {
    if (!db || callState !== "outgoing" || !currentCall) {
      setOutgoingPeerOnline(null);
      return;
    }
    const peerId = currentCall.remoteUser.id;
    const r = ref(db, `presence/${peerId}/online`);
    const unsub = onValue(r, (snap) => {
      setOutgoingPeerOnline(snap.val() === true);
    });
    return () => {
      unsub();
      setOutgoingPeerOnline(null);
    };
  }, [db, callState, currentCall?.callId, currentCall?.remoteUser.id]);

  useEffect(() => {
    if (callState !== "outgoing" && callState !== "incoming") {
      return;
    }
    const mode =
      callState === "incoming"
        ? "incoming"
        : outgoingPeerOnline
          ? "ringing"
          : "calling";
    const stop = startCallRingtoneLoop(mode);
    return () => {
      stop();
    };
  }, [callState, outgoingPeerOnline]);

  useEffect(() => {
    if (!db || !searchProfileFor?.id) {
      setProfilePanelPeerOnline(null);
      return;
    }
    const r = ref(db, `presence/${searchProfileFor.id}/online`);
    const unsub = onValue(r, (snap) => {
      setProfilePanelPeerOnline(snap.val() === true);
    });
    registerCleanup(() => {
      try {
        unsub();
      } catch {
        /* ignore */
      }
    });
    return () => {
      unsub();
    };
  }, [db, searchProfileFor?.id, registerCleanup]);

  useEffect(() => {
    if (buddiesMenuOpenId == null) return;
    const on = (e: MouseEvent) => {
      const t = e.target as Element | null;
      if (t && !t.closest("[data-buddies-root]")) setBuddiesMenuOpenId(null);
    };
    document.addEventListener("mousedown", on);
    return () => document.removeEventListener("mousedown", on);
  }, [buddiesMenuOpenId]);

  useEffect(() => {
    if (!attachMiniOpen) return;
    const on = (e: MouseEvent) => {
      const el = attachMenuRef.current;
      if (el && !el.contains(e.target as Node)) setAttachMiniOpen(false);
    };
    document.addEventListener("mousedown", on);
    return () => document.removeEventListener("mousedown", on);
  }, [attachMiniOpen]);

  useEffect(() => {
    const { db: d, ok } = initFirebase();
    setDb(d);
    setFirebaseReady(ok);
    setChatPrefs(readJsonLs<Record<string, ChatPrefs>>(CHAT_PREFS_KEY, {}));
    setDeletedChatIds(readJsonLs<string[]>(DELETED_CHATS_KEY, []));
    if (typeof window !== "undefined") {
      setProfileBannerDismissed(
        localStorage.getItem("profile_banner_dismissed") === "true",
      );
      setFirebaseBannerDismissed(
        localStorage.getItem("firebase_banner_dismissed") === "true",
      );
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 768px)");
    const apply = () => setIsMd(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (isMd) setMobileShowChat(false);
  }, [isMd]);

  const bumpMobileChatOpen = useCallback(() => {
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(min-width: 768px)").matches) {
      setMobileShowChat(true);
    }
  }, []);

  const closeMobileChat = useCallback(() => {
    setMobileShowChat(false);
    setActiveChat(null);
  }, []);

  const updateChatPref = useCallback(
    (chatId: string, patch: Partial<ChatPrefs>) => {
      setChatPrefs((prev) => {
        const next = {
          ...prev,
          [chatId]: { ...prev[chatId], ...patch },
        };
        writeJsonLs(CHAT_PREFS_KEY, next);
        return next;
      });
    },
    [],
  );

  const markChatDeleted = useCallback((chatId: string) => {
    setDeletedChatIds((prev) => {
      if (prev.includes(chatId)) return prev;
      const next = [...prev, chatId];
      writeJsonLs(DELETED_CHATS_KEY, next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || isMd) {
      setKeyboardBottomOffset(0);
      return;
    }
    const vv = window.visualViewport;
    if (!vv) return;
    const sync = () => {
      const visibleBottom = vv.height + vv.offsetTop;
      const inset = Math.max(0, window.innerHeight - visibleBottom);
      setKeyboardBottomOffset(inset);
    };
    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
    };
  }, [isMd]);

  const initGroupChat = useCallback(
    async (
      database: Database,
      group: GroupOut,
      members: GroupMemberOut[],
      current: UserMe,
    ) => {
      const chatId = `group_${group.id}`;
      const chatRef = ref(database, `chats/${chatId}/info`);
      try {
        const snapshot = await get(chatRef);
        const memberIds = members.map((m) => m.user_id);
        if (!snapshot.exists()) {
          await set(chatRef, {
            id: chatId,
            name: group.name,
            type: "group",
            group_id: group.id,
            members: memberIds,
            created_by: current.id,
            created_at: Date.now(),
            last_message: "",
            last_message_time: Date.now(),
            last_message_sender: "",
          });
          for (const uid of memberIds) {
            await set(ref(database, `user_chats/${uid}/${chatId}`), true);
          }
        } else {
          await update(chatRef, { members: memberIds });
        }
      } catch (e) {
        console.warn("initGroupChat", e);
      }
    },
    [],
  );

  const loadBackend = useCallback(async (): Promise<GroupOut[] | null> => {
    const runSignal = masterAbortRef.current?.signal;
    const isGone = () => runSignal?.aborted;
    setLoading(true);
    try {
      const [meRes, groupsRes] = await Promise.all([
        apiFetchWithStatus<UserMe>("/auth/me", { signal: runSignal }),
        apiFetchWithStatus<GroupOut[]>("/groups", { signal: runSignal }),
      ]);
      if (isGone()) return null;
      if (meRes.status === 401 || groupsRes.status === 401) {
        handleUnauthorized();
        return null;
      }
      if (meRes.status === 0 || groupsRes.status === 0) {
        if (isGone()) return null;
        showToast(
          "Cannot reach the server. Check that the API is running (e.g. localhost:8000) and try again.",
          "error",
        );
        return null;
      }
      if (!meRes.data) {
        if (isGone()) return null;
        showToast("Could not load profile", "error");
        return null;
      }
      if (isGone()) return null;
      setUser(meRes.data);
      const gList = groupsRes.data ?? [];
      const enrichedGroups: GroupOut[] = gList.map((g) => ({
        ...g,
        members: g.members ?? [],
      }));
      if (isGone()) return null;
      setGroups(enrichedGroups);

      const memberSet = new Map<string, ContactPerson>();
      for (const g of enrichedGroups) {
        for (const m of g.members ?? []) {
          if (m.user_id !== meRes.data.id && !memberSet.has(m.user_id)) {
            memberSet.set(m.user_id, {
              id: m.user_id,
              full_name: m.full_name,
              username: null,
              avatar_url: m.avatar_url ?? null,
            });
          }
        }
      }
      if (isGone()) return null;
      setContacts([...memberSet.values()]);
      if (isGone()) return null;
      setTrips([]);
      return enrichedGroups;
    } catch (e) {
      if (isAbortError(e) || runSignal?.aborted) return null;
      console.error(e);
      showToast(
        e instanceof Error ? e.message : "Failed to load",
        "error",
      );
      return null;
    } finally {
      setLoading(false);
    }
  }, [handleUnauthorized, showToast]);

  /** After leave/close: drop group from lists, Firebase user_chats, and refresh API state. */
  const handleGroupLeft = useCallback(
    (groupId: string) => {
      const chatId = `group_${groupId}`;
      markChatDeleted(chatId);
      if (db && user?.id) {
        void remove(ref(db, `user_chats/${user.id}/${chatId}`)).catch(
          () => undefined,
        );
      }
      setGroups((prev) => prev.filter((g) => g.id !== groupId));
      setTrips((prev) => prev.filter((t) => t.group_id !== groupId));
      setShowGroupInfo(false);
      setActiveChat((cur) => {
        if (
          cur?.type === "group" &&
          (cur.group_id === groupId || cur.id === chatId)
        ) {
          return null;
        }
        return cur;
      });
      void loadBackend();
    },
    [markChatDeleted, db, user?.id, loadBackend],
  );

  useEffect(() => {
    if (!db || !user?.id) {
      setActiveGroupHydrateLoading(false);
      return;
    }
    if (
      !activeChat ||
      activeChat.type !== "group" ||
      !activeChat.group_id ||
      activeChat.isDemo ||
      activeChat.isBot ||
      activeChat.isAnnouncement
    ) {
      setActiveGroupHydrateLoading(false);
      return;
    }
    const gid = activeChat.group_id;
    const runSignal = masterAbortRef.current?.signal;
    if (runSignal?.aborted) {
      setActiveGroupHydrateLoading(false);
      return;
    }
    let cancelled = false;
    setActiveGroupHydrateLoading(true);
    void (async () => {
      try {
        const memRes = await apiFetchWithStatus<GroupMemberOut[]>(
          `/groups/${gid}/members`,
          { signal: runSignal },
        );
        if (cancelled || runSignal?.aborted) return;
        const tripRes = await apiFetchWithStatus<TripOut[]>(
          `/groups/${gid}/trips`,
          { signal: runSignal },
        );
        if (cancelled || runSignal?.aborted) return;
        if (memRes.status === 401 || tripRes.status === 401) {
          handleUnauthorized();
          return;
        }
        if (memRes.status === 200 && memRes.data) {
          const members = memRes.data;
          setGroups((prev) =>
            prev.map((g) => (g.id === gid ? { ...g, members } : g)),
          );
          setContacts((cPrev) => {
            const s = new Map(cPrev.map((c) => [c.id, c]));
            for (const m of members) {
              if (m.user_id !== user.id && !s.has(m.user_id)) {
                s.set(m.user_id, {
                  id: m.user_id,
                  full_name: m.full_name,
                  username: null,
                  avatar_url: m.avatar_url ?? null,
                });
              }
            }
            return [...s.values()];
          });
          const gRow =
            groupsRef.current.find((x) => x.id === gid) ??
            ({
              id: gid,
              name: activeChat.name,
              description: null,
              members,
              group_type: "regular",
            } as GroupOut);
          void initGroupChat(db, { ...gRow, members }, members, user);
        }
        if (tripRes.status === 200 && Array.isArray(tripRes.data)) {
          setTrips((prev) => {
            const rest = prev.filter((t) => t.group_id !== gid);
            return [...rest, ...tripRes.data!];
          });
        }
      } catch (e) {
        if (isAbortError(e)) return;
        console.error(e);
      } finally {
        if (!cancelled) setActiveGroupHydrateLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    db,
    user,
    activeChat?.id,
    activeChat?.type,
    activeChat?.group_id,
    activeChat?.name,
    activeChat?.isDemo,
    activeChat?.isBot,
    activeChat?.isAnnouncement,
    handleUnauthorized,
    initGroupChat,
  ]);

  useEffect(() => {
    void loadBackend();
  }, [loadBackend]);

  useEffect(() => {
    if (typeof globalThis.window === "undefined") return;
    const onReload = () => {
      void loadBackend();
    };
    globalThis.window.addEventListener("gt-reload-travelhub-groups", onReload);
    registerCleanup(() => {
      try {
        globalThis.window.removeEventListener(
          "gt-reload-travelhub-groups",
          onReload,
        );
      } catch {
        /* ignore */
      }
    });
    return () =>
      globalThis.window.removeEventListener(
        "gt-reload-travelhub-groups",
        onReload,
      );
  }, [loadBackend, registerCleanup]);

  useEffect(() => {
    if (!db || !user?.id) return;
    chatInfoUnsubsRef.current.forEach((u) => u());
    chatInfoUnsubsRef.current = [];

    const userChatsRef = ref(db, `user_chats/${user.id}`);
    const unsub = onValue(userChatsRef, (snapIdx) => {
      const val = snapIdx.val() as Record<string, boolean> | null;
      const chatIds = val ? Object.keys(val) : [];

      chatInfoUnsubsRef.current.forEach((u) => u());
      chatInfoUnsubsRef.current = [];

      const merged: Record<string, ChatInfo> = {};

      chatIds.forEach((chatId) => {
        const infoRef = ref(db, `chats/${chatId}/info`);
        const u = onValue(infoRef, (snapInfo) => {
          if (!snapInfo.exists()) return;
          const data = snapInfo.val() as ChatInfo;
          const prev = merged[chatId];
          merged[chatId] = { ...data, id: chatId, metadata: prev?.metadata };
          const list = Object.values(merged).sort(
            (a, b) =>
              (b.last_message_time ?? 0) - (a.last_message_time ?? 0),
          );
          setChats(list);
        });
        chatInfoUnsubsRef.current.push(u);

        const metaRef = ref(db, `chats/${chatId}/metadata`);
        const uMeta = onValue(metaRef, (snapMeta) => {
          if (!merged[chatId]) return;
          const val = snapMeta.exists()
            ? (snapMeta.val() as NonNullable<ChatInfo["metadata"]>)
            : undefined;
          merged[chatId] = { ...merged[chatId]!, metadata: val };
          const list = Object.values(merged).sort(
            (a, b) =>
              (b.last_message_time ?? 0) - (a.last_message_time ?? 0),
          );
          setChats(list);
        });
        chatInfoUnsubsRef.current.push(uMeta);
      });

      if (chatIds.length === 0) setChats([]);
    });

    registerCleanup(() => {
      try {
        unsub();
        chatInfoUnsubsRef.current.forEach((u) => u());
        chatInfoUnsubsRef.current = [];
      } catch {
        /* ignore */
      }
    });
    return () => {
      unsub();
      chatInfoUnsubsRef.current.forEach((u) => u());
      chatInfoUnsubsRef.current = [];
    };
  }, [db, user?.id, registerCleanup]);

  useEffect(() => {
    setActiveChat((prev) => {
      if (!prev) return prev;
      const row = chats.find((c) => c.id === prev.id);
      if (!row) return prev;
      const mPrev = prev.metadata;
      const mRow = row.metadata;
      const metaEq =
        (mPrev?.name ?? null) === (mRow?.name ?? null) &&
        (mPrev?.profile_picture ?? null) === (mRow?.profile_picture ?? null) &&
        (mPrev?.avatar_url ?? null) === (mRow?.avatar_url ?? null);
      if (metaEq && prev.name === row.name) return prev;
      return { ...prev, name: row.name, metadata: row.metadata };
    });
  }, [chats]);

  useEffect(() => {
    setShowGroupInfo(false);
  }, [activeChat?.id]);

  useEffect(() => {
    if (!user) return;
    const needIncomingMap =
      showSearchOverlay ||
      (searchProfileFor != null &&
        searchProfileFor.friend_status === "pending_received");
    if (!needIncomingMap) return;
    void (async () => {
      const r = await apiFetchWithStatus<
        { id: string; sender_id: string; status: string }[]
      >("/social/friend-requests", {
        signal: masterAbortRef.current?.signal,
      });
      if (r.status === 401) {
        handleUnauthorized();
        return;
      }
      if (r.status === 200 && Array.isArray(r.data)) {
        const m: Record<string, string> = {};
        for (const fr of r.data) {
          if (fr.status === "pending") m[fr.sender_id] = fr.id;
        }
        setIncomingFrIdBySender(m);
      }
    })();
  }, [showSearchOverlay, searchProfileFor, user, handleUnauthorized]);

  useEffect(() => {
    if (showSearchOverlayPrev.current && !showSearchOverlay) {
      userSearchSeq.current += 1;
      setUserSearchResults([]);
      setConnectionsList([]);
      setDiscoverGroupsList([]);
      setSearchOverlayLoading(false);
    }
    showSearchOverlayPrev.current = showSearchOverlay;
  }, [showSearchOverlay]);

  useEffect(() => {
    if (!showSearchOverlay) return;
    const q = searchQuery.trim();
    if (q.length < 2) {
      setUserSearchResults([]);
      setConnectionsList([]);
      setDiscoverGroupsList([]);
      setSearchOverlayLoading(false);
      return;
    }
    const timer = setTimeout(() => {
      const seq = ++userSearchSeq.current;
      void (async () => {
        setSearchOverlayLoading(true);
        try {
          const reqSignal = masterAbortRef.current?.signal;
          const [connRes, searchRes, groupsParamRes] = await Promise.all([
            apiFetchWithStatus<UserSearchResultRow[]>("/social/connections", {
              signal: reqSignal,
            }),
            apiFetchWithStatus<UserSearchResultRow[]>(
              `/users/search?q=${encodeURIComponent(normalizeConnectUserSearchQuery(q))}&limit=20`,
              { signal: reqSignal },
            ),
            apiFetchWithStatus<GroupOut[]>(
              `/groups?search=${encodeURIComponent(q)}`,
              { signal: reqSignal },
            ),
          ]);
          if (userSearchSeq.current !== seq) return;
          if (
            connRes.status === 401 ||
            searchRes.status === 401 ||
            groupsParamRes.status === 401
          ) {
            handleUnauthorized();
            return;
          }
          const connections = Array.isArray(connRes.data) ? connRes.data : [];
          setConnectionsList(connections);
          const people = Array.isArray(searchRes.data) ? searchRes.data : [];
          setUserSearchResults(people);

          const myIds = new Set(groups.map((g) => g.id));
          const qLower = q.toLowerCase();
          let discover: GroupOut[] = [];
          if (groupsParamRes.status === 200 && Array.isArray(groupsParamRes.data)) {
            discover = groupsParamRes.data.filter(
              (g) =>
                !myIds.has(g.id) &&
                (g.name?.toLowerCase().includes(qLower) ?? false),
            );
          }
          if (discover.length === 0) {
            const allRes = await apiFetchWithStatus<GroupOut[]>("/groups", {
              signal: reqSignal,
            });
            if (userSearchSeq.current !== seq) return;
            if (allRes.status === 401) {
              handleUnauthorized();
              return;
            }
            if (allRes.status === 200 && Array.isArray(allRes.data)) {
              discover = allRes.data.filter(
                (g) =>
                  !myIds.has(g.id) &&
                  (g.name?.toLowerCase().includes(qLower) ?? false),
              );
            }
          }
          setDiscoverGroupsList(discover);
        } catch {
          if (userSearchSeq.current === seq) {
            setUserSearchResults([]);
            setConnectionsList([]);
            setDiscoverGroupsList([]);
          }
        } finally {
          if (userSearchSeq.current === seq) {
            setSearchOverlayLoading(false);
          }
        }
      })();
    }, 300);
    registerCleanup(() => clearTimeout(timer));
    return () => clearTimeout(timer);
  }, [searchQuery, showSearchOverlay, groups, handleUnauthorized, registerCleanup]);

  const loadMessages = useCallback(
    (chatId: string) => {
      if (!db) return;
      messagesUnsubRef.current?.();
      messagesUnsubRef.current = null;

      const messagesRef = ref(db, `chats/${chatId}/messages`);
      const messagesQuery = query(
        messagesRef,
        orderByChild("timestamp"),
        limitToLast(100),
      );

      const unsub = onValue(messagesQuery, (snapshot) => {
        const msgs: ChatMessage[] = [];
        snapshot.forEach((child) => {
          const v = child.val() as Omit<ChatMessage, "id">;
          const ts =
            typeof v.timestamp === "number"
              ? v.timestamp
              : Date.now();
          msgs.push({
            id: child.key ?? "",
            ...v,
            timestamp: ts,
          });
        });
        msgs.sort((a, b) => a.timestamp - b.timestamp);

        let st = messageNotifStateRef.current;
        if (!st || st.chatId !== chatId) {
          messageNotifStateRef.current = {
            chatId,
            primed: false,
            seen: new Set(),
          };
          st = messageNotifStateRef.current;
        }
        const state = st;
        const wasPrimed = state.primed;
        const newMsgs = msgs.filter((m) => !state.seen.has(m.id));
        for (const m of msgs) state.seen.add(m.id);
        if (!wasPrimed) {
          state.primed = true;
        } else {
          const uid = hubNotifCtx.userId;
          for (const m of newMsgs) {
            if (uid && m.sender_id === uid) continue;
            showMessageNotification(
              m.sender_name || "Someone",
              chatMessagePreviewForNotification(m),
              chatId,
            );
          }
        }

        setMessages(msgs);
        if (messagesScrollToEndTimeoutRef.current) {
          clearTimeout(messagesScrollToEndTimeoutRef.current);
        }
        messagesScrollToEndTimeoutRef.current = globalThis.setTimeout(() => {
          messagesScrollToEndTimeoutRef.current = null;
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 80);
      });
      messagesUnsubRef.current = unsub;
    },
    [db],
  );

  useEffect(() => {
    return () => {
      messagesUnsubRef.current?.();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (messagesScrollToEndTimeoutRef.current) {
        clearTimeout(messagesScrollToEndTimeoutRef.current);
        messagesScrollToEndTimeoutRef.current = null;
      }
      mediaRecorder?.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
    };
  }, [mediaRecorder]);

  const sendMessage = useCallback(
    async (
      type: string,
      content: string,
      metadata?: Record<string, unknown> | null,
    ) => {
      if (!db || !user || !activeChat || activeChat.isDemo) return;
      if (type === "text" && !content.trim()) return;
      if (type === "gif" && !content.trim()) return;
      if (type === "split") {
        const raw = metadata?.amount;
        const n =
          typeof raw === "number" ? raw : parseFloat(String(raw ?? ""));
        if (!Number.isFinite(n) || n <= 0) {
          showToast("Enter a valid amount", "error");
          return;
        }
      }

      const chatId = activeChat.id;
      const messagesRef = ref(db, `chats/${chatId}/messages`);

      const message: Record<string, unknown> = {
        sender_id: user.id,
        sender_name: user.full_name || "You",
        text: content,
        type,
        timestamp: Date.now(),
        read_by: { [user.id]: true },
      };
      if (metadata && Object.keys(metadata).length)
        message.metadata = metadata;

      try {
        await push(messagesRef, message);
        const preview =
          type === "text"
            ? content
            : type === "split"
              ? content
              : type === "gif"
                ? "GIF"
                : `Attachment (${type})`;
        await update(ref(db, `chats/${chatId}/info`), {
          last_message: preview,
          last_message_time: Date.now(),
          last_message_sender: user.full_name || "You",
        });
        setMessageText("");
        setShowAttach(false);
        setEmojiGifPickerOpen(false);
        if (type === "split") {
          setShowSplitPopup(false);
          setSplitAmount("");
          setSplitEqually(true);
        }
      } catch (e) {
        console.error(e);
        showToast("Could not send message", "error");
      }
    },
    [db, user, activeChat, showToast],
  );

  useEffect(() => {
    if (isRecording) setEmojiGifPickerOpen(false);
  }, [isRecording]);

  useEffect(() => {
    if (!emojiGifPickerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEmojiGifPickerOpen(false);
    };
    globalThis.addEventListener("keydown", onKey);
    return () => globalThis.removeEventListener("keydown", onKey);
  }, [emojiGifPickerOpen]);

  useEffect(() => {
    if (!emojiGifPickerOpen) return;
    const onDown = (e: MouseEvent) => {
      const el = composerMediaPickerRef.current;
      const t = e.target;
      if (!el || !(t instanceof Node)) return;
      if (!el.contains(t)) setEmojiGifPickerOpen(false);
    };
    globalThis.document.addEventListener("mousedown", onDown);
    return () => globalThis.document.removeEventListener("mousedown", onDown);
  }, [emojiGifPickerOpen]);

  const handleTyping = useCallback(() => {
    if (!db || !user || !activeChat) return;
    const r = ref(db, `chats/${activeChat.id}/typing/${user.id}`);
    set(r, user.full_name || "Someone");
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      remove(r).catch(() => {});
    }, 2000);
  }, [db, user, activeChat]);

  useEffect(() => {
    if (
      !db ||
      !activeChat ||
      !user?.id ||
      activeChat.isBot ||
      activeChat.isAnnouncement ||
      activeChat.isDemo
    )
      return;
    const typingRef = ref(db, `chats/${activeChat.id}/typing`);
    const unsub = onValue(typingRef, (snapshot) => {
      const typing: string[] = [];
      snapshot.forEach((child) => {
        if (child.key !== user.id && child.val()) {
          typing.push(String(child.val()));
        }
      });
      setTypingUsers(typing);
    });
    registerCleanup(() => {
      try {
        unsub();
      } catch {
        /* ignore */
      }
    });
    return () => {
      unsub();
    };
  }, [db, activeChat?.id, user?.id, registerCleanup]);

  useEffect(() => {
    if (!db || !user?.id || !activeChat?.id) return;
    if (activeChat.isDemo || activeChat.isBot || activeChat.isAnnouncement)
      return;
    void set(
      ref(db, `chats/${activeChat.id}/read/${user.id}`),
      Date.now(),
    );
  }, [
    db,
    user?.id,
    activeChat?.id,
    activeChat?.isDemo,
    activeChat?.isBot,
    activeChat?.isAnnouncement,
  ]);

  useEffect(() => {
    if (!db || !user?.id || !activeChat || activeChat.type !== "individual") {
      setPeerLastReadAt(0);
      return;
    }
    if (activeChat.isDemo || activeChat.isBot || activeChat.isAnnouncement) {
      setPeerLastReadAt(0);
      return;
    }
    const peerId = activeChat.members.find((m) => m !== user.id);
    if (!peerId) {
      setPeerLastReadAt(0);
      return;
    }
    const rref = ref(db, `chats/${activeChat.id}/read/${peerId}`);
    const unsub = onValue(rref, (snap) => {
      const v = snap.val();
      const n =
        typeof v === "number"
          ? v
          : typeof v === "string"
            ? parseInt(v, 10) || 0
            : 0;
      setPeerLastReadAt(n);
    });
    registerCleanup(() => {
      try {
        unsub();
      } catch {
        /* ignore */
      }
    });
    return () => {
      unsub();
    };
  }, [db, activeChat, user?.id, registerCleanup]);

  useLayoutEffect(() => {
    if (showInChatSearch) {
      globalThis.setTimeout(() => {
        chatSearchInputRef.current?.focus();
      }, 0);
    }
  }, [showInChatSearch]);

  useEffect(() => {
    if (!showInChatSearch) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowInChatSearch(false);
        setInChatSearchQuery("");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showInChatSearch]);

  const openPeerProfileFromActiveChat = useCallback(async () => {
    if (!activeChat || activeChat.type !== "individual" || !user) return;
    const peerId = activeChat.members.find((m) => m !== user.id);
    if (!peerId) return;
    const base = buildPeerSearchRowFromChat(
      activeChat,
      peerId,
      connectionsList,
    );
    const contact: ContactPerson = {
      id: base.id,
      full_name: base.full_name,
      username: base.username,
      avatar_url: base.avatar_url,
    };
    const resolved = await resolvePeerForDm(
      contact,
      connectionsList,
      masterAbortRef.current?.signal,
    );
    setSearchProfileFor({
      ...base,
      full_name: resolved.full_name,
      profile_picture: resolved.profile_picture,
      avatar_url: resolved.avatar_url ?? base.avatar_url,
    });
  }, [activeChat, user, connectionsList]);

  const clearActiveChatMessages = useCallback(async () => {
    if (!db || !activeChat) return;
    if (activeChat.isDemo) return;
    if (!window.confirm("Clear all messages in this chat?")) return;
    try {
      await remove(ref(db, `chats/${activeChat.id}/messages`));
      setMessages([]);
      showToast("Chat cleared", "success");
    } catch (e) {
      console.error(e);
      showToast("Could not clear chat", "error");
    }
  }, [db, activeChat, showToast]);

  const blockActiveChatPeer = useCallback(async () => {
    if (!activeChat || activeChat.type !== "individual" || !user) return;
    const peerId = activeChat.members.find((m) => m !== user.id);
    if (!peerId) return;
    const r = await apiFetchWithStatus<unknown>("/social/block", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: peerId }),
      signal: masterAbortRef.current?.signal,
    });
    if (r.status === 401) {
      handleUnauthorized();
      return;
    }
    if (r.status < 400) {
      showToast("User blocked", "success");
      setActiveChat(null);
    } else {
      showToast("Could not block user", "error");
    }
  }, [activeChat, user, showToast, handleUnauthorized]);

  const leaveActiveGroupChat = useCallback(async () => {
    if (!activeChat || activeChat.type !== "group" || !user?.id) return;
    const gid = activeChat.group_id;
    if (!gid) return;
    if (!window.confirm("Leave this group?")) return;
    const r = await apiFetchWithStatus<unknown>(`/groups/${gid}/leave`, {
      method: "DELETE",
      signal: masterAbortRef.current?.signal,
    });
    if (r.status === 401) {
      handleUnauthorized();
      return;
    }
    if (r.status === 204 || r.status === 200) {
      showToast("You left the group", "success");
      handleGroupLeft(gid);
      return;
    }
    if (r.status === 400) {
      showToast(
        "Settle your balance before leaving this travel group",
        "error",
      );
      return;
    }
    showToast("Could not leave group", "error");
  }, [
    activeChat,
    user?.id,
    showToast,
    handleUnauthorized,
    handleGroupLeft,
  ]);

  const openDirectChat = useCallback(
    async (other: ContactPerson) => {
      if (!db || !user) return;
      const resolved = await resolvePeerForDm(
        other,
        connectionsList,
        masterAbortRef.current?.signal,
      );
      const realName = resolved.full_name;
      const meta = {
        name: realName,
        profile_picture: resolved.profile_picture,
        avatar_url: resolved.avatar_url,
      };
      const ids = [user.id, other.id].sort();
      const chatId = `dm_${ids[0]}_${ids[1]}`;
      const chatRef = ref(db, `chats/${chatId}/info`);
      const metadataPath = ref(db, `chats/${chatId}/metadata`);
      try {
        const snapshot = await get(chatRef);
        if (!snapshot.exists()) {
          await set(chatRef, {
            id: chatId,
            name: realName,
            type: "individual",
            members: [user.id, other.id],
            created_by: user.id,
            created_at: Date.now(),
            last_message: "",
            last_message_time: Date.now(),
            last_message_sender: "",
          });
          await set(ref(db, `user_chats/${user.id}/${chatId}`), true);
          await set(ref(db, `user_chats/${other.id}/${chatId}`), true);
        } else {
          await update(chatRef, { name: realName });
        }
        // /chats/{id}/info/name and /chats/{id}/metadata/name (via update) — always
        await update(metadataPath, {
          name: realName,
          profile_picture: meta.profile_picture,
          avatar_url: meta.avatar_url,
        });
        const info = snapshot.exists()
          ? (snapshot.val() as ChatInfo)
          : {
              id: chatId,
              name: realName,
              type: "individual" as const,
              members: [user.id, other.id],
              created_by: user.id,
              created_at: Date.now(),
            };
        setActiveChat({
          ...info,
          id: chatId,
          name: realName,
          metadata: meta,
        });
        setActiveTab("chats");
        updateChatPref(chatId, { lastReadAt: Date.now() });
        loadMessages(chatId);
        bumpMobileChatOpen();
      } catch (e) {
        console.error(e);
        showToast("Could not open chat", "error");
      }
    },
    [
      db,
      user,
      loadMessages,
      showToast,
      updateChatPref,
      connectionsList,
      bumpMobileChatOpen,
    ],
  );

  useEffect(() => {
    if (typeof window === "undefined" || !db || !user?.id) return;
    if (dmHandoffFromBuddiesDone.current) return;
    const raw = sessionStorage.getItem(GT_OPEN_DM_USER_ID);
    if (!raw?.trim()) return;
    sessionStorage.removeItem(GT_OPEN_DM_USER_ID);
    dmHandoffFromBuddiesDone.current = true;
    const handoffId = raw.trim();
    void (async () => {
      const r = await apiFetchWithStatus<UserProfileIdOut>(
        `/users/${handoffId}`,
        { signal: masterAbortRef.current?.signal },
      );
      if (r.status !== 200 || !r.data) return;
      const d = r.data;
      await openDirectChat({
        id: String(d.id),
        full_name: d.full_name,
        username: d.username,
        avatar_url: d.profile_picture ?? d.avatar_url ?? null,
      });
    })();
  }, [db, user?.id, openDirectChat]);

  const connectUserSearchRow = useCallback(
    async (row: UserSearchResultRow) => {
      setUserSearchActionId(row.id);
      const r = await apiFetchWithStatus<{ id: string }>("/social/friend-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiver_id: row.id }),
        signal: masterAbortRef.current?.signal,
      });
      setUserSearchActionId(null);
      if (r.status === 401) {
        handleUnauthorized();
        return;
      }
      if (r.status >= 400 || !r.data) {
        showToast("Could not send request", "error");
        return;
      }
      setUserSearchResults((prev) =>
        prev.map((u) =>
          u.id === row.id
            ? { ...u, friend_status: "pending_sent" as const }
            : u,
        ),
      );
      setSearchProfileFor((p) =>
        p?.id === row.id
          ? { ...p, friend_status: "pending_sent" as const }
          : p,
      );
      showToast("Request sent", "success");
    },
    [handleUnauthorized, showToast],
  );

  const acceptUserSearchRow = useCallback(
    async (row: UserSearchResultRow) => {
      const frId = incomingFrIdBySender[row.id];
      if (!frId) {
        showToast("Request not found. Try closing and opening search again.", "error");
        return;
      }
      setUserSearchActionId(row.id);
      const r = await apiFetchWithStatus<unknown>(
        `/social/friend-requests/${frId}/accept`,
        { method: "PATCH" },
      );
      setUserSearchActionId(null);
      if (r.status === 401) {
        handleUnauthorized();
        return;
      }
      if (r.status >= 400) {
        showToast("Could not accept request", "error");
        return;
      }
      setIncomingFrIdBySender((prev) => {
        const n = { ...prev };
        delete n[row.id];
        return n;
      });
      setUserSearchResults((prev) =>
        prev.map((u) =>
          u.id === row.id
            ? { ...u, friend_status: "accepted" as const }
            : u,
        ),
      );
      setConnectionsList((prev) => {
        const has = prev.some((p) => p.id === row.id);
        if (has) {
          return prev.map((p) =>
            p.id === row.id
              ? { ...p, friend_status: "accepted" as const }
              : p,
          );
        }
        return [...prev, { ...row, friend_status: "accepted" as const }];
      });
      setSearchProfileFor((p) =>
        p?.id === row.id
          ? { ...p, friend_status: "accepted" as const }
          : p,
      );
      setBuddiesMenuOpenId(null);
      showToast("You are now connected", "success");
    },
    [incomingFrIdBySender, handleUnauthorized, showToast],
  );

  const messageUserSearchRow = useCallback(
    (row: UserSearchResultRow) => {
      setBuddiesMenuOpenId(null);
      setSearchProfileFor(null);
      setShowSearchOverlay(false);
      void openDirectChat({
        id: row.id,
        full_name: row.full_name,
        username: row.username,
        avatar_url: row.profile_picture ?? row.avatar_url ?? null,
      });
    },
    [openDirectChat],
  );

  const blockUserSearch = useCallback(
    async (row: UserSearchResultRow) => {
      const r = await apiFetchWithStatus<unknown>("/social/block", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: row.id }),
        signal: masterAbortRef.current?.signal,
      });
      if (r.status === 401) {
        handleUnauthorized();
        return;
      }
      if (r.status < 400) {
        showToast("User blocked", "success");
        setBuddiesMenuOpenId(null);
        setSearchProfileFor((p) => (p?.id === row.id ? null : p));
        setUserSearchResults((prev) =>
          prev.map((u) =>
            u.id === row.id
              ? { ...u, friend_status: "blocked" as const }
              : u,
          ),
        );
      } else {
        showToast("Could not block user", "error");
      }
    },
    [handleUnauthorized, showToast],
  );

  const selectChat = useCallback(
    (c: ChatInfo) => {
      setActiveChat(c);
      setShowInChatSearch(false);
      setInChatSearchQuery("");
      messagesUnsubRef.current?.();
      messagesUnsubRef.current = null;
      setMessages([]);
      updateChatPref(c.id, { lastReadAt: Date.now() });
      if (!(c.isBot || c.isAnnouncement || c.isDemo)) {
        loadMessages(c.id);
        if (
          db &&
          user?.id &&
          c.type === "individual" &&
          c.id.startsWith("dm_")
        ) {
          const peerId = c.members.find((m) => m !== user.id);
          if (
            peerId != null &&
            dmStoredNameNeedsApiRepair(c.name, c.metadata?.name)
          ) {
            void (async () => {
              const r = await apiFetchWithStatus<UserProfileIdOut>(
                `/users/${peerId}`,
              );
              if (r.status !== 200 || !r.data) return;
              const fn = r.data.full_name?.trim();
              if (!fn) return;
              const nextMeta = {
                name: fn,
                profile_picture: r.data.profile_picture ?? null,
                avatar_url: r.data.avatar_url ?? null,
              };
              try {
                await update(ref(db, `chats/${c.id}/info`), { name: fn });
                await update(ref(db, `chats/${c.id}/metadata`), nextMeta);
              } catch (e) {
                console.warn("dm name repair", e);
              }
              setActiveChat((prev) => {
                if (!prev || prev.id !== c.id) return prev;
                return {
                  ...prev,
                  name: fn,
                  metadata: { ...prev.metadata, ...nextMeta },
                };
              });
            })();
          }
        }
      }
      bumpMobileChatOpen();
    },
    [loadMessages, updateChatPref, db, user?.id, bumpMobileChatOpen],
  );

  const openGroupChatFromSearch = useCallback(
    (c: ChatInfo) => {
      setShowSearchOverlay(false);
      setSearchQuery("");
      selectChat(c);
    },
    [selectChat],
  );

  const joinDiscoverGroup = useCallback(
    async () => {
      const code = window.prompt("Enter the group invite code");
      if (code == null || !String(code).trim()) return;
      const r = await apiFetchWithStatus<GroupOut>("/groups/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invite_code: String(code).trim() }),
        signal: masterAbortRef.current?.signal,
      });
      if (r.status === 401) {
        handleUnauthorized();
        return;
      }
      if (r.status === 200 && r.data) {
        showToast(`Joined ${r.data.name}`, "success");
        setShowSearchOverlay(false);
        setSearchQuery("");
        void loadBackend();
      } else {
        showToast("Could not join. Check the code.", "error");
      }
    },
    [handleUnauthorized, showToast, loadBackend],
  );

  const openDemoDm = useCallback(
    (
      row:
        | DemoContactRow
        | {
            kind: "self";
            id: string;
            name: string;
            initials: string;
            bg: string;
            sub: string;
          },
    ) => {
      const isSelf = row.kind === "self";
      const chat: ChatInfo = {
        id: row.id,
        name: row.name,
        type: "individual",
        members: [],
        created_by: "demo",
        created_at: Date.now(),
        isDemo: true,
        demoKind: isSelf ? "self" : row.kind,
        demoAvatarBg: row.bg,
        demoInitials: row.initials,
      };
      setActiveChat(chat);
      setActiveTab("chats");
      bumpMobileChatOpen();
    },
    [bumpMobileChatOpen],
  );

  const filteredChats = useMemo(() => chats, [chats]);

  const filteredChatMessages = useMemo(() => {
    const q = inChatSearchQuery.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter((m) =>
      (m.text || "").toLowerCase().includes(q),
    );
  }, [messages, inChatSearchQuery]);

  const activeGroupFromList = useMemo(
    () =>
      activeChat?.group_id
        ? groups.find((g) => g.id === activeChat.group_id)
        : undefined,
    [activeChat?.group_id, groups],
  );
  const isActiveGroupTravel =
    (activeGroupFromList?.group_type ?? "regular") === "travel";

  const headerGroupTrip = useMemo(() => {
    if (!activeChat?.group_id || activeChat.type !== "group") return null;
    const g = groups.find((x) => x.id === activeChat.group_id);
    if ((g?.group_type ?? "regular") !== "travel") return null;
    const list = trips.filter((t) => t.group_id === activeChat.group_id);
    if (list.length === 0) return null;
    return list[0]!;
  }, [activeChat?.group_id, activeChat?.type, groups, trips]);

  const headerGroupTripLoading = useMemo(() => {
    if (!activeChat?.group_id || activeChat.type !== "group") return false;
    const g = groups.find((x) => x.id === activeChat.group_id);
    if ((g?.group_type ?? "regular") !== "travel") return false;
    return activeGroupHydrateLoading;
  }, [activeChat, groups, activeGroupHydrateLoading]);

  const chatsWithoutDeleted = useMemo(
    () => filteredChats.filter((c) => !deletedChatIds.includes(c.id)),
    [filteredChats, deletedChatIds],
  );

  const sortedChatsForList = useMemo(() => {
    const list = [...chatsWithoutDeleted];
    list.sort((a, b) => {
      const pa = chatPrefs[a.id]?.pinned ? 1 : 0;
      const pb = chatPrefs[b.id]?.pinned ? 1 : 0;
      if (pb !== pa) return pb - pa;
      return (
        (b.last_message_time ?? b.created_at ?? 0) -
        (a.last_message_time ?? a.created_at ?? 0)
      );
    });
    return list;
  }, [chatsWithoutDeleted, chatPrefs]);

  const mainChatList = useMemo(
    () => sortedChatsForList.filter((c) => !chatPrefs[c.id]?.archived),
    [sortedChatsForList, chatPrefs],
  );

  const groupsOnlyList = useMemo(
    () => mainChatList.filter((c) => c.type === "group"),
    [mainChatList],
  );

  const overlayChats = useMemo(() => {
    const n = searchQuery.trim().toLowerCase();
    if (n.length < 2) return [] as ChatInfo[];
    return mainChatList.filter(
      (c) =>
        c.type === "group" && (c.name?.toLowerCase().includes(n) ?? false),
    );
  }, [mainChatList, searchQuery]);

  const overlayContacts = useMemo(() => {
    const n = searchQuery.trim().toLowerCase();
    if (n.length < 2) return [] as UserSearchResultRow[];
    return connectionsList.filter((c) => {
      const fn = (c.full_name ?? "").toLowerCase();
      const un = (c.username ?? "").toLowerCase();
      return fn.includes(n) || un.includes(n);
    });
  }, [connectionsList, searchQuery]);

  const connectionIdSet = useMemo(
    () => new Set(connectionsList.map((c) => c.id)),
    [connectionsList],
  );

  const overlayPeople = useMemo(() => {
    const n = searchQuery.trim().toLowerCase();
    if (n.length < 2) return [] as UserSearchResultRow[];
    return userSearchResults.filter((u) => !connectionIdSet.has(u.id));
  }, [userSearchResults, connectionIdSet, searchQuery]);

  const contactsWithGroupCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const g of groups) {
      for (const m of g.members) {
        if (m.user_id === user?.id) continue;
        counts.set(m.user_id, (counts.get(m.user_id) ?? 0) + 1);
      }
    }
    return contacts
      .map((c) => ({
        ...c,
        groupsTogether: counts.get(c.id) ?? 0,
      }))
      .sort((a, b) =>
        a.full_name.localeCompare(b.full_name, undefined, {
          sensitivity: "base",
        }),
      );
  }, [contacts, groups, user?.id]);

  const startRecording = useCallback(() => {
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        streamRef.current = stream;
        const chunks: BlobPart[] = [];
        const recorder = new MediaRecorder(stream);
        setMediaRecorder(recorder);
        setIsRecording(true);
        setRecordSeconds(0);
        recordIntervalRef.current = setInterval(() => {
          setRecordSeconds((s) => s + 1);
        }, 1000);
        recorder.ondataavailable = (e) => {
          if (e.data.size) chunks.push(e.data);
        };
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: "audio/webm" });
          const reader = new FileReader();
          reader.onloadend = () => {
            void sendMessage("audio", "Voice message", {
              url: reader.result,
              duration: `${Math.floor(recordSeconds / 60)}:${String(recordSeconds % 60).padStart(2, "0")}`,
            });
          };
          reader.readAsDataURL(blob);
          stream.getTracks().forEach((t) => t.stop());
          setIsRecording(false);
          setMediaRecorder(null);
          if (recordIntervalRef.current) {
            clearInterval(recordIntervalRef.current);
            recordIntervalRef.current = null;
          }
        };
        recorder.start();
      })
      .catch(() => showToast("Microphone access denied", "error"));
  }, [recordSeconds, sendMessage, showToast]);

  const stopRecordingSend = useCallback(() => {
    mediaRecorder?.stop();
  }, [mediaRecorder]);

  const cancelRecording = useCallback(() => {
    mediaRecorder?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setIsRecording(false);
    setMediaRecorder(null);
    if (recordIntervalRef.current) {
      clearInterval(recordIntervalRef.current);
      recordIntervalRef.current = null;
    }
  }, [mediaRecorder]);

  const listScrollRef = useRef<HTMLDivElement>(null);
  const pullStartY = useRef(0);
  const [pullDist, setPullDist] = useState(0);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onListTouchStart = useCallback((e: TouchEvent) => {
    const el = listScrollRef.current;
    if (!el || el.scrollTop > 0) return;
    pullStartY.current = e.touches[0]?.clientY ?? 0;
  }, []);

  const onListTouchMove = useCallback((e: TouchEvent) => {
    const el = listScrollRef.current;
    if (!el || el.scrollTop > 0) return;
    const y = e.touches[0]?.clientY ?? 0;
    const dy = y - pullStartY.current;
    if (dy > 0) setPullDist(Math.min(dy, 88));
  }, []);

  const onListTouchEnd = useCallback(() => {
    if (pullDist >= 60) void loadBackend();
    setPullDist(0);
  }, [pullDist, loadBackend]);

  useEffect(() => {
    return () => {
      for (const fn of cleanupRef.current) {
        try {
          fn();
        } catch {
          /* ignore */
        }
      }
      cleanupRef.current = [];
    };
  }, []);

  const tabBar = (
    <div
      className="flex w-full shrink-0"
      style={{
        height: 44,
        background: BG,
        borderBottom: `0.5px solid ${BORDER_SUB}`,
      }}
    >
      {(
        [
          ["chats", "Chats"],
          ["calls", "Calls"],
          ["updates", "Updates"],
        ] as const
      ).map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => setActiveTab(id)}
          className="flex-1 border-0 text-center text-[14px] outline-none"
          style={{
            lineHeight: "44px",
            padding: 0,
            color: activeTab === id ? "#ffffff" : "rgba(255,255,255,0.68)",
            fontWeight: 500,
            borderBottom:
              activeTab === id
                ? `2px solid ${BRAND_ACCENT}`
                : "2px solid transparent",
            background: "transparent",
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );

  const travelHubShellStyle = useMemo((): CSSProperties => {
    const base: CSSProperties = {
      background: BG,
      color: TEXT,
    };
    if (isMd) {
      return { ...base, height: "calc(100vh - 64px)" };
    }
    return {
      ...base,
      position: "fixed",
      left: 0,
      right: 0,
      top: "52px",
      bottom: "calc(56px + env(safe-area-inset-bottom, 0px))",
      zIndex: 20,
    };
  }, [isMd]);

  const mobileComposerBottomStyle = useMemo((): CSSProperties => {
    if (isMd) return {};
    return {
      paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + ${keyboardBottomOffset}px)`,
    };
  }, [isMd, keyboardBottomOffset]);

  if (loading && !user) {
    return (
      <div
        className="flex animate-pulse gap-4 p-4 md:relative"
        style={travelHubShellStyle}
      >
        <div className="h-full w-80 rounded-xl" style={{ background: SURFACE }} />
        <div className="flex-1 rounded-xl" style={{ background: SURFACE }} />
      </div>
    );
  }

  return (
    <div
      className="chat-container relative flex w-full flex-col overflow-hidden md:static md:max-h-none"
      style={travelHubShellStyle}
    >
      {user && !profileBannerDismissed ? (
        <div
          className="relative flex shrink-0 items-center border-b py-2.5 pl-3 pr-10"
          style={{
            borderColor: BORDER_SUB,
            background: SURFACE,
          }}
        >
          <p className="flex-1 text-center text-[12px] leading-snug" style={{ color: TEXT_SECONDARY }}>
            Complete your profile to personalize your account and help friends find you.{" "}
            <Link href="/profile" className="font-semibold text-sky-400 underline">
              Open profile
            </Link>
          </p>
          <button
            type="button"
            aria-label="Dismiss"
            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center text-lg leading-none text-white/70 hover:text-white"
            onClick={() => {
              localStorage.setItem("profile_banner_dismissed", "true");
              setProfileBannerDismissed(true);
            }}
          >
            ×
          </button>
        </div>
      ) : null}
      {!firebaseReady && !firebaseBannerDismissed ? (
        <div
          className="relative shrink-0 border-b px-4 py-2 pr-10 text-center text-xs"
          style={{
            borderColor: BORDER_SUB,
            background: "#422006",
            color: "#FDE68A",
          }}
        >
          Add{" "}
          <code className="rounded px-1" style={{ background: "#78350F" }}>
            NEXT_PUBLIC_FIREBASE_*
          </code>{" "}
          to enable real-time chat. Groups and contacts still load from the API.
          <button
            type="button"
            aria-label="Dismiss"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-lg leading-none text-[#FDE68A]/80 hover:text-[#FDE68A]"
            onClick={() => {
              localStorage.setItem("firebase_banner_dismissed", "true");
              setFirebaseBannerDismissed(true);
            }}
          >
            ×
          </button>
        </div>
      ) : null}
      <div
        className="flex min-h-0 flex-1 flex-row overflow-hidden"
        style={{ display: "flex", flexDirection: "row" }}
      >
        <div
          className={`flex min-h-0 flex-col overflow-hidden ${
            !isMd && mobileShowChat && activeTab === "chats"
              ? "hidden"
              : "flex"
          }`}
          style={{
            width: isMd ? 360 : "100%",
            flexShrink: 0,
            background: BG,
            borderRight: isMd ? `0.5px solid ${BORDER_SUB}` : undefined,
            height: "100%",
          }}
        >
          <header
            className="flex shrink-0 flex-col gap-3 px-4 pb-3 pt-4"
            style={{
              background: BG,
            }}
          >
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="truncate text-[20px] font-bold tracking-tight text-white">
                  Travelo Connect
                </p>
                <p className="mt-0.5 text-[11px] font-medium text-white/60">
                  Messages, calls, and updates
                </p>
              </div>
              <div className="flex items-center gap-3 text-white/75">
                <button
                  type="button"
                  aria-label="Menu"
                  className="flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-white/10 hover:text-white"
                  onClick={() => setShowMenuDrawer(true)}
                >
                  <MenuIcon />
                </button>
                <button
                  type="button"
                  aria-label="New chat"
                  className="flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-white/10 hover:text-white"
                  onClick={() => setShowNewChatPanel(true)}
                >
                  <ConnectHeaderComposeIcon />
                </button>
              </div>
            </div>
            <button
              type="button"
              aria-label="Search chats, people, and groups"
              className="flex h-10 w-full items-center gap-2 rounded-full px-3 text-left text-sm text-white/70 transition hover:bg-white/[0.18]"
              style={{ background: "rgba(255,255,255,0.14)" }}
              onClick={() => setShowSearchOverlay(true)}
            >
              <Search className="h-4 w-4 shrink-0" strokeWidth={2} />
              <span className="truncate">Search chats, people, and groups</span>
            </button>
          </header>

          {tabBar}

          <div className="relative min-h-0 flex flex-1 flex-col">
            <div
              ref={listScrollRef}
              className="min-h-0 flex-1 custom-scrollbar overflow-y-auto overscroll-contain"
              style={{
                background: "#ffffff",
                transform: pullDist ? `translateY(${pullDist * 0.35}px)` : undefined,
                transition: pullDist ? "none" : "transform 0.2s ease-out",
              }}
              onTouchStart={(e) => {
                if (activeTab === "chats") onListTouchStart(e);
              }}
              onTouchMove={(e) => {
                if (activeTab === "chats") onListTouchMove(e);
              }}
              onTouchEnd={() => {
                if (activeTab === "chats") onListTouchEnd();
              }}
            >
              {pullDist > 20 && activeTab === "chats" ? (
                <div
                  className="pointer-events-none py-1 text-center text-[11px]"
                  style={{ color: TEXT_MUTED }}
                >
                  {pullDist >= 60 ? "Release to refresh" : "Pull to refresh"}
                </div>
              ) : null}
              {activeTab === "chats" ? (
                <HubChatsTab
                  groups={groups}
                  user={user}
                  mainChatList={mainChatList}
                  activeChatId={activeChat?.id}
                  chatPrefs={chatPrefs}
                  onSelectChat={selectChat}
                  onNavigateToGroup={(gid) => {
                    const existing = mainChatList.find(
                      (c) => c.type === "group" && c.group_id === gid,
                    );
                    if (existing) {
                      selectChat(existing);
                      return;
                    }
                    const g = groups.find((x) => x.id === gid);
                    if (!g || !user) return;
                    const ids = (g.members ?? []).map((m) => m.user_id);
                    selectChat({
                      id: `group_${g.id}`,
                      name: g.name,
                      type: "group",
                      group_id: g.id,
                      members: ids.length > 0 ? ids : [user.id],
                      created_by: user.id,
                      created_at: Date.now(),
                    });
                  }}
                  updateChatPref={updateChatPref}
                  markChatDeleted={markChatDeleted}
                  showToast={showToast}
                  setContextMenu={setContextMenu}
                  longPressTimerRef={longPressTimer}
                />
              ) : null}
              {activeTab === "calls" ? (
                <HubCallsTab
                  showCallToast={showCallToast}
                  mainChatList={mainChatList}
                  callHistory={callHistory}
                  onOpenHistoryRow={(e) => {
                    const c = mainChatList.find(
                      (x) =>
                        x.type === "individual" &&
                        x.members.includes(e.user_id),
                    );
                    if (c) {
                      setActiveTab("chats");
                      selectChat(c);
                    } else {
                      void openDirectChat({
                        id: e.user_id,
                        full_name: e.user_name,
                        username: null,
                        avatar_url: null,
                      });
                      setActiveTab("chats");
                    }
                  }}
                  onStartAudioCall={(userId, name, avatar) => {
                    void startOutgoingCall("audio", {
                      id: userId,
                      name,
                      avatar,
                    });
                  }}
                  onStartVideoCall={(userId, name, avatar) => {
                    void startOutgoingCall("video", {
                      id: userId,
                      name,
                      avatar,
                    });
                  }}
                  handleUnauthorized={handleUnauthorized}
                  masterAbortRef={masterAbortRef}
                />
              ) : null}
              {activeTab === "updates" ? (
                <HubUpdatesTab currentUser={user} />
              ) : null}
              <HubGroupsTab
                listHidden
                openCreateRequestId={createGroupRequestId}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                groups={groups}
                user={user}
                groupsOnlyList={groupsOnlyList}
                activeChatId={activeChat?.id}
                chatPrefs={chatPrefs}
                onSelectChat={selectChat}
                reloadGroups={loadBackend}
                onGroupCreated={(g) => {
                  if (!user) return;
                  const ids = (g.members ?? []).map((m) => m.user_id);
                  selectChat({
                    id: `group_${g.id}`,
                    name: g.name,
                    type: "group",
                    group_id: g.id,
                    members: ids.length > 0 ? ids : [user.id],
                    created_by: user.id,
                    created_at: Date.now(),
                  });
                }}
                onUnauthorized={handleUnauthorized}
                updateChatPref={updateChatPref}
                markChatDeleted={markChatDeleted}
                showToast={showToast}
                setContextMenu={setContextMenu}
                longPressTimerRef={longPressTimer}
                masterAbortRef={masterAbortRef}
              />
            </div>
            {showNewChatPanel && user ? (
              <NewChatSlidePanel
                onClose={() => setShowNewChatPanel(false)}
                onNewGroup={() =>
                  setCreateGroupRequestId((n) => n + 1)
                }
                onPickContact={(p) => {
                  void openDirectChat(p);
                }}
                user={user}
                groups={groups}
                mainChatList={mainChatList}
                handleUnauthorized={handleUnauthorized}
                masterAbortRef={masterAbortRef}
              />
            ) : null}
          </div>
        </div>

        <div
          className={`flex min-h-0 min-w-0 flex-col ${
            !isMd &&
            !(
              activeTab === "calls" ||
              (activeTab === "chats" && mobileShowChat)
            )
              ? "hidden"
              : "flex"
          }`}
          style={{
            flex: 1,
            minWidth: 0,
            background:
              activeTab === "calls" ? "#f5ede4" : RIGHT_PANEL_BG,
            height: "100%",
          }}
        >
          {activeTab === "calls" ? (
            <CallsConnectRightPanel
              showCallToast={showCallToast}
              activeChat={activeChat}
              user={user}
              onStartVideoCall={() => {
                if (!user || !activeChat || activeChat.type !== "individual") {
                  showCallToast("Select a chat first");
                  return;
                }
                const peer = activeChat.members.find((m) => m !== user.id);
                if (!peer) {
                  showCallToast("Select a chat first");
                  return;
                }
                void startOutgoingCall("video", {
                  id: peer,
                  name: chatRowDisplayName(activeChat),
                  avatar: chatRowDmAvatarUrl(activeChat),
                });
              }}
              mainChatList={mainChatList}
              groups={groups}
              startOutgoingCall={startOutgoingCall}
            />
          ) : !activeChat ? (
            <div
              className="flex flex-1 flex-col px-6 text-center"
              style={{
                background: RIGHT_PANEL_BG,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "column",
                height: "100%",
                gap: 12,
              }}
            >
              <ThIconPlane size={48} className="text-[#9ca3af]" aria-hidden />
              <p className="text-lg font-semibold text-white">
                Select a conversation to start
              </p>
              <p className="text-sm text-gray-400">
                Or start a new one from the list
              </p>
            </div>
          ) : activeChat.isDemo ? (
            <DemoDmChatPanel
              chat={activeChat}
              onBack={closeMobileChat}
              showToast={(m, t) => showToast(m, t ?? "success")}
            />
          ) : activeChat.isBot ? (
            <TravelloHelpChatPanel />
          ) : activeChat.isAnnouncement ? (
            <CommunityAnnouncementPanel />
          ) : (
            <div className="relative flex min-h-0 min-w-0 flex-1">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <ChatHeader
              chat={activeChat}
              onBack={closeMobileChat}
              groups={groups}
              dmPeerIsOnline={
                activeChat.type === "individual"
                  ? dmHeaderPeerOnline
                  : null
              }
              onDmHeaderClick={() => setShowDmInfo(true)}
              onOpenGroupInfo={() => setShowGroupInfo(true)}
              onMuteChat={() => {
                if (activeChat) {
                  updateChatPref(activeChat.id, { muted: true });
                  showToast("Muted", "success");
                }
              }}
              onSearchInChat={() => {
                setShowInChatSearch(true);
              }}
              onClearChat={() => void clearActiveChatMessages()}
              onBlockPeer={() => void blockActiveChatPeer()}
              onLeaveGroup={() => void leaveActiveGroupChat()}
              onReport={() => showToast("Report submitted", "success")}
              onDmVoiceCall={() => {
                if (!user || !activeChat || activeChat.type !== "individual")
                  return;
                const peer = activeChat.members.find((m) => m !== user.id);
                if (!peer) return;
                void startOutgoingCall("audio", {
                  id: peer,
                  name: chatRowDisplayName(activeChat),
                  avatar: chatRowDmAvatarUrl(activeChat),
                });
              }}
              onDmVideoCall={() => {
                if (!user || !activeChat || activeChat.type !== "individual")
                  return;
                const peer = activeChat.members.find((m) => m !== user.id);
                if (!peer) return;
                void startOutgoingCall("video", {
                  id: peer,
                  name: chatRowDisplayName(activeChat),
                  avatar: chatRowDmAvatarUrl(activeChat),
                });
              }}
              onDmSchedule={() => {
                if (!activeChat) return;
                setScheduleCallTitle("");
                setScheduleCallAt("");
                setScheduleCallOpen({ chat: activeChat });
              }}
              groupTrip={headerGroupTrip}
              groupTripLoading={headerGroupTripLoading}
              onGroupVoice={() => {
                if (!activeChat || activeChat.type !== "group") return;
                setGroupCallPicker({ type: "audio", chat: activeChat });
              }}
              onGroupVideoCall={() => {
                if (!activeChat || activeChat.type !== "group") return;
                setGroupCallPicker({ type: "video", chat: activeChat });
              }}
              onGroupSchedule={() => {
                if (!activeChat || activeChat.type !== "group") return;
                setScheduleCallTitle("");
                setScheduleCallAt("");
                setScheduleCallOpen({ chat: activeChat });
              }}
            />

            {showInChatSearch ? (
              <div
                className="flex shrink-0 items-center gap-2 border-b px-3 py-2"
                style={{
                  borderColor: BORDER_SUB,
                  background: SURFACE,
                }}
              >
                <Search
                  className="h-4 w-4 shrink-0 text-slate-500"
                  strokeWidth={2}
                />
                <input
                  ref={chatSearchInputRef}
                  value={inChatSearchQuery}
                  onChange={(e) => setInChatSearchQuery(e.target.value)}
                  placeholder="Search in chat…"
                  className="min-w-0 flex-1 border-0 bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
                />
                <button
                  type="button"
                  className="shrink-0 text-slate-400 hover:text-white"
                  onClick={() => {
                    setShowInChatSearch(false);
                    setInChatSearchQuery("");
                  }}
                  aria-label="Close search"
                >
                  ×
                </button>
              </div>
            ) : null}

            <div
              className="messages-area min-h-0 flex-1 custom-scrollbar overflow-y-auto px-2 py-2 sm:px-3"
              style={{
                background: WA_MSG_BG,
                position: "relative",
              }}
            >
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  backgroundImage: WA_PATTERN,
                  backgroundSize: "20px 20px",
                  opacity: 0.15,
                }}
                aria-hidden
              />
              <div className="relative z-[1]">
              {filteredChatMessages.map((m, i) => {
                const showSep = shouldShowDateSeparator(
                  filteredChatMessages,
                  i,
                );
                const mine = m.sender_id === user?.id;
                const isDm = activeChat.type === "individual";
                const isGroup = activeChat.type === "group";
                const prev = i > 0 ? filteredChatMessages[i - 1] : null;
                const startRun = Boolean(
                  i === 0 ||
                    (prev != null && prev.sender_id !== m.sender_id),
                );
                const readReceipt: "none" | "sent" | "read" =
                  mine && isDm && !activeChat.isDemo
                    ? peerLastReadAt > 0 && peerLastReadAt >= m.timestamp
                      ? "read"
                      : "sent"
                    : "none";
                return (
                  <div key={m.id || i}>
                    {showSep ? (
                      <div className="my-3 flex justify-center">
                        <span
                          className="rounded-[8px] px-3 py-1 text-[12px]"
                          style={{
                            background: "rgba(225,221,214,0.92)",
                            color: "#54656f",
                          }}
                        >
                          {isGroup
                            ? getGroupWaDateLabel(m.timestamp)
                            : getDateLabel(m.timestamp)}
                        </span>
                      </div>
                    ) : null}
                    <div
                      className="message-bubble-wrapper"
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setMessageContextMenu({
                          x: e.clientX,
                          y: e.clientY,
                          message: m,
                          mine: !!mine,
                        });
                      }}
                    >
                    {isGroup && user ? (
                      <GroupMessageBubble
                        msg={m}
                        mine={!!mine}
                        isTravelGroup={isActiveGroupTravel}
                        showAvatar={!mine && startRun}
                        showName={!mine && startRun}
                        readState={
                          mine
                            ? groupReadReceipt(m, user.id)
                            : "delivered"
                        }
                        selectMode={selectMode}
                        isSelected={selectedMessages.has(m.id)}
                        onToggleSelect={() => {
                          setSelectedMessages((prev) => {
                            const next = new Set(prev);
                            if (next.has(m.id)) next.delete(m.id);
                            else next.add(m.id);
                            return next;
                          });
                        }}
                      />
                    ) : (
                    <MessageBubble
                      msg={m}
                      mine={mine}
                      isGroup={isGroup}
                      readReceipt={readReceipt}
                      dmPeerAvatarUrl={
                        !mine && isDm
                          ? chatRowDmAvatarUrl(activeChat)
                          : null
                      }
                      dmPeerDisplayName={chatRowDisplayName(activeChat)}
                      selectMode={selectMode}
                      isSelected={selectedMessages.has(m.id)}
                      onToggleSelect={() => {
                        setSelectedMessages((prev) => {
                          const next = new Set(prev);
                          if (next.has(m.id)) next.delete(m.id);
                          else next.add(m.id);
                          return next;
                        });
                      }}
                    />
                    )}
                    </div>
                  </div>
                );
              })}
              {typingUsers.length > 0 ? (
                <div className="mb-2 flex items-end gap-2">
                  <div
                    className="rounded-2xl border px-4 py-2 text-sm"
                    style={{
                      borderColor: MSG_BORDER,
                      background: SURFACE,
                      color: TEXT_MUTED,
                    }}
                  >
                    <ThStatusDot
                      className="typing-dot inline-block animate-pulse"
                      color={TEXT_MUTED}
                    />{" "}
                    {typingUsers[0]} is typing…
                  </div>
                </div>
              ) : null}
              <div ref={messagesEndRef} />
              </div>
            </div>

            {isRecording ? (
              <div
                className="flex items-center justify-between border-t px-4 py-3"
                style={{ borderColor: BORDER_SUB, background: SURFACE }}
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-red-500">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                  Recording… {recordSeconds}s
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={cancelRecording}
                    className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1 text-sm text-white"
                    style={{ borderColor: MSG_BORDER }}
                  >
                    <X className="h-4 w-4" strokeWidth={1.5} />
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={stopRecordingSend}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1 text-sm font-bold text-white"
                  >
                    <ThIconSendPlane size={16} className="text-white" />
                    Send
                  </button>
                </div>
              </div>
            ) : (
              <>
                {showSplitPopup ? (
                  <div
                    className="fixed inset-0 z-[240] flex items-end justify-center bg-black/50 p-4 pb-24 sm:items-center sm:pb-4"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Add split"
                    onClick={() => setShowSplitPopup(false)}
                  >
                    <div
                      className="w-full max-w-sm rounded-2xl border p-4 shadow-2xl"
                      style={{ borderColor: MSG_BORDER, background: SURFACE }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <p className="text-sm font-bold text-white">Add split</p>
                      <label className="mt-3 block text-[11px] font-medium uppercase"
                        style={{ color: TEXT_MUTED }}
                      >
                        Amount ({getCurrencyCodeFromUser(user)})
                      </label>
                      <input
                        value={splitAmount}
                        onChange={(e) => setSplitAmount(e.target.value)}
                        type="number"
                        min="0"
                        step="0.01"
                        className="mt-1 w-full rounded-lg border-0 px-3 py-2.5 text-sm text-white outline-none"
                        style={{ background: BG }}
                        placeholder="0.00"
                      />
                      <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-slate-200">
                        <input
                          type="checkbox"
                          checked={splitEqually}
                          onChange={(e) => setSplitEqually(e.target.checked)}
                          className="rounded border-slate-500"
                        />
                        Split equally
                      </label>
                      <div className="mt-4 flex justify-end gap-2">
                        <button
                          type="button"
                          className="rounded-lg px-3 py-2 text-sm"
                          style={{ color: TEXT_MUTED }}
                          onClick={() => setShowSplitPopup(false)}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
                          style={{ background: BUBBLE_SENDER_CORAL }}
                          onClick={() => {
                            const n = parseFloat(splitAmount);
                            if (!Number.isFinite(n) || n <= 0) {
                              showToast("Enter a valid amount", "error");
                              return;
                            }
                            const sym = getCurrencySymbolFromUser(user);
                            const code = getCurrencyCodeFromUser(user);
                            const t = splitEqually
                              ? `Split ${sym}${n.toFixed(2)} equally`
                              : `Split ${sym}${n.toFixed(2)}`;
                            void sendMessage("split", t, {
                              amount: n,
                              currency: code,
                              split_equally: splitEqually,
                            });
                          }}
                        >
                          Add Split
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div
                  ref={composerMediaPickerRef}
                  className="relative w-full shrink-0"
                >
                  <ChatEmojiGifPicker
                    open={emojiGifPickerOpen}
                    tab={emojiGifPickerTab}
                    onTabChange={setEmojiGifPickerTab}
                    panelHeightPx={isMd ? 320 : 280}
                    onClose={() => setEmojiGifPickerOpen(false)}
                    onInsertEmoji={(em) =>
                      insertTextInComposerInput(
                        messageComposerInputRef.current,
                        messageText,
                        em,
                        setMessageText,
                      )
                    }
                    onPickGifUrl={(url) => void sendMessage("gif", url)}
                  />
                {activeChat.type === "group" ? (
                user ? (
                <div
                  className="input-bar flex shrink-0 items-center gap-1.5 border-t px-2 py-2.5"
                  style={{
                    borderColor: "rgba(255,255,255,0.08)",
                    background: WA_INPUT_ROW,
                    ...mobileComposerBottomStyle,
                  }}
                >
                  {messageText.trim() ? null : (
                    <>
                      <div className="relative flex shrink-0" ref={attachMenuRef}>
                        <button
                          type="button"
                          className="shrink-0 rounded-full p-2 text-lg"
                          style={{ color: WA_TEXT }}
                          aria-label="Attach"
                          onClick={() => setAttachMiniOpen((o) => !o)}
                        >
                          <ThIconPaperclip size={18} className="text-[#e5e7eb]" />
                        </button>
                        {attachMiniOpen ? (
                          <div
                            className="absolute bottom-full left-0 z-[200] mb-1 min-w-[11rem] overflow-hidden rounded-lg border py-1 shadow-xl"
                            style={{
                              background: "#1a1f35",
                              borderColor: "rgba(255,255,255,0.1)",
                            }}
                          >
                            {(
                              [
                                "Photo/Video",
                                "Audio",
                                "Location",
                                ...(isActiveGroupTravel
                                  ? (["Split Expense", "Create Poll", "Pin Meeting Point"] as const)
                                  : []),
                              ] as const
                            ).map((label) => (
                              <button
                                key={label}
                                type="button"
                                className="block w-full px-3 py-2 text-left text-sm text-white hover:bg-white/10"
                                onClick={() => {
                                  setAttachMiniOpen(false);
                                  showToast("Coming soon", "success");
                                }}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      {isActiveGroupTravel ? (
                        <button
                          type="button"
                          className="flex shrink-0 items-center gap-0.5 rounded-full px-2.5 py-2 text-xs font-bold text-white"
                          style={{ background: WA_CORAL }}
                          aria-label="Split"
                          onClick={() => {
                            setShowSplitPopup(true);
                            setEmojiGifPickerOpen(false);
                          }}
                        >
                          <span className="text-sm" aria-hidden>
                            $
                          </span>
                          Split
                        </button>
                      ) : null}
                    </>
                  )}
                  <input
                    ref={messageComposerInputRef}
                    value={messageText}
                    onChange={(e) => {
                      setMessageText(e.target.value);
                      if (e.target.value.trim()) {
                        setShowSplitPopup(false);
                      }
                      handleTyping();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void sendMessage("text", messageText);
                      }
                    }}
                    placeholder="Type a message…"
                    className="min-w-0 flex-1 rounded-full border-0 px-3 py-2.5 text-[14px] outline-none placeholder:text-slate-500"
                    style={{ background: WA_INPUT_FIELD, color: WA_TEXT }}
                  />
                  <button
                    type="button"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                    style={{ color: TH_MUTED }}
                    aria-label={
                      emojiGifPickerOpen
                        ? "Close emoji and GIF"
                        : "Emoji and GIF"
                    }
                    onClick={() => {
                      setEmojiGifPickerOpen((o) => !o);
                      setShowSplitPopup(false);
                    }}
                  >
                    {emojiGifPickerOpen ? (
                      <X className="h-5 w-5" strokeWidth={1.5} />
                    ) : (
                      <ThIconSmile size={18} className="text-current" />
                    )}
                  </button>
                  {messageText.trim() ? null : !isActiveGroupTravel ? (
                    <button
                      type="button"
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                      style={{ color: TH_MUTED }}
                      aria-label="Voice"
                      onClick={() => showToast("Coming soon", "success")}
                    >
                      <ThIconMicLine size={18} className="text-current" />
                    </button>
                  ) : null}
                  {messageText.trim() ? (
                    <button
                      type="button"
                      onClick={() => void sendMessage("text", messageText)}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white"
                      style={{ background: WA_CORAL }}
                      aria-label="Send"
                    >
                      <ThIconSendPlane size={18} className="text-white" />
                    </button>
                  ) : null}
                </div>
                ) : (
                <div
                  className="h-12 shrink-0 border-t"
                  style={{
                    borderColor: "rgba(255,255,255,0.08)",
                    background: WA_INPUT_ROW,
                  }}
                />
                )
                ) : (
                <div
                  className="input-bar flex shrink-0 items-center gap-1.5 border-t px-2 py-2"
                  style={{
                    borderColor: BORDER_SUB,
                    background: BG,
                    ...mobileComposerBottomStyle,
                  }}
                >
                  {messageText.trim() ? null : (
                    <>
                      <button
                        type="button"
                        className="flex shrink-0 items-center gap-0.5 rounded-full px-2.5 py-2 text-xs font-bold text-white"
                        style={{ background: BUBBLE_SENDER_CORAL }}
                        aria-label="Split"
                        onClick={() => {
                          setShowSplitPopup(true);
                          setEmojiGifPickerOpen(false);
                        }}
                      >
                        <span className="text-sm tabular-nums" aria-hidden>
                          {getCurrencySymbolFromUser(user)}
                        </span>
                        <span>Split</span>
                      </button>
                    </>
                  )}
                  <input
                    ref={messageComposerInputRef}
                    value={messageText}
                    onChange={(e) => {
                      setMessageText(e.target.value);
                      if (e.target.value.trim()) {
                        setShowSplitPopup(false);
                      }
                      handleTyping();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void sendMessage("text", messageText);
                      }
                    }}
                    placeholder="Type a message…"
                    className="min-w-0 flex-1 rounded-full border-0 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-500"
                    style={{ background: SURFACE }}
                  />
                  <button
                    type="button"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                    style={{ color: TH_MUTED }}
                    aria-label={
                      emojiGifPickerOpen
                        ? "Close emoji and GIF"
                        : "Emoji and GIF"
                    }
                    onClick={() => {
                      setEmojiGifPickerOpen((o) => !o);
                      setShowSplitPopup(false);
                    }}
                  >
                    {emojiGifPickerOpen ? (
                      <X className="h-5 w-5" strokeWidth={1.5} />
                    ) : (
                      <ThIconSmile size={18} className="text-current" />
                    )}
                  </button>
                  {messageText.trim() ? null : (
                    <>
                      <button
                        type="button"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                        style={{ color: TH_MUTED }}
                        aria-label="Camera"
                        onClick={() => showToast("Camera coming soon", "success")}
                      >
                        <Camera className="h-5 w-5" strokeWidth={1.5} />
                      </button>
                      <div
                        className="relative flex shrink-0"
                        ref={attachMenuRef}
                      >
                        <button
                          type="button"
                          className="shrink-0 rounded-full p-2 text-lg"
                          aria-label="Attach"
                          onClick={() => setAttachMiniOpen((o) => !o)}
                        >
                          <ThIconPaperclip size={18} className="text-[#e5e7eb]" />
                        </button>
                        {attachMiniOpen ? (
                          <div
                            className="absolute bottom-full right-0 z-[200] mb-1 min-w-[10rem] overflow-hidden rounded-lg border py-1 shadow-xl"
                            style={{
                              background: SURFACE,
                              borderColor: MSG_BORDER,
                            }}
                          >
                            {(
                              [
                                "Image",
                                "Document",
                                "Location",
                                "Trip",
                              ] as const
                            ).map((label) => (
                              <button
                                key={label}
                                type="button"
                                className="block w-full px-3 py-2 text-left text-sm text-white hover:bg-white/10"
                                onClick={() => {
                                  setAttachMiniOpen(false);
                                  showToast("Coming soon", "success");
                                }}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </>
                  )}
                  {messageText.trim() ? (
                    <button
                      type="button"
                      onClick={() => void sendMessage("text", messageText)}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white"
                      style={{ background: BUBBLE_SENDER_CORAL }}
                      aria-label="Send"
                    >
                      <ThIconSendPlane size={18} className="text-white" />
                    </button>
                  ) : null}
                </div>
                )}
                </div>
              </>
            )}
            </div>
            {activeChat.type === "group" &&
            showGroupInfo &&
            activeChat.group_id &&
            user ? (
              <aside
                className="absolute inset-0 z-[35] flex shrink-0 flex-col border-l lg:relative lg:inset-auto lg:z-auto"
                style={{
                  borderColor: BORDER_SUB,
                  background: SURFACE,
                  width:
                    typeof window !== "undefined" && window.innerWidth >= 1024
                      ? groupDrawerWidth
                      : undefined,
                }}
              >
                <button
                  type="button"
                  aria-label="Resize panel"
                  className="absolute left-0 top-0 hidden h-full w-1 cursor-col-resize bg-transparent hover:bg-white/10 lg:block"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    drawerResizeRef.current = {
                      startX: e.clientX,
                      startW: groupDrawerWidth,
                    };
                    const onMove = (ev: MouseEvent) => {
                      if (!drawerResizeRef.current) return;
                      const dx =
                        drawerResizeRef.current.startX - ev.clientX;
                      const next = Math.min(
                        640,
                        Math.max(
                          320,
                          drawerResizeRef.current.startW + dx,
                        ),
                      );
                      setGroupDrawerWidth(next);
                    };
                    const onUp = () => {
                      if (drawerResizeRef.current) {
                        try {
                          window.localStorage.setItem(
                            "gt_group_drawer_width",
                            String(groupDrawerWidth),
                          );
                        } catch {
                          /* ignore */
                        }
                      }
                      drawerResizeRef.current = null;
                      window.removeEventListener("mousemove", onMove);
                      window.removeEventListener("mouseup", onUp);
                    };
                    window.addEventListener("mousemove", onMove);
                    window.addEventListener("mouseup", onUp);
                  }}
                />
                <GroupInfoPanel
                  key={activeChat.group_id}
                  group={
                    groups.find((x) => x.id === activeChat.group_id) ?? {
                      id: activeChat.group_id,
                      name: activeChat.name,
                      description: null,
                      members: [],
                    }
                  }
                  selfId={user.id}
                  onClose={() => setShowGroupInfo(false)}
                  onSearchInGroupChat={() => setShowInChatSearch(true)}
                  openDirectChat={openDirectChat}
                  onLeaveSuccess={(gid) => {
                    handleGroupLeft(gid);
                  }}
                  showToast={showToast}
                  onUnauthorized={handleUnauthorized}
                  loadBackend={loadBackend}
                  onViewFullSplit={() => {
                    setShowGroupInfo(false);
                    setShowSplitPopup(true);
                  }}
                  onSettleAll={() =>
                    showToast(
                      "Open Split in chat to settle expenses",
                      "success",
                    )
                  }
                  masterAbortRef={masterAbortRef}
                  onVoiceCall={() =>
                    setGroupCallPicker({ type: "audio", chat: activeChat })
                  }
                  onVideoCall={() =>
                    setGroupCallPicker({ type: "video", chat: activeChat })
                  }
                  onScheduleCall={() => {
                    setScheduleCallTitle("");
                    setScheduleCallAt("");
                    setScheduleCallOpen({ chat: activeChat });
                  }}
                  onClearChat={() => void clearActiveChatMessages()}
                  onToggleFavorite={() => {
                    const cur = chatPrefs[activeChat.id]?.favorite ?? false;
                    updateChatPref(activeChat.id, { favorite: !cur });
                    showToast(
                      cur
                        ? "Removed from favorites"
                        : "Added to favorites",
                      "success",
                    );
                  }}
                  isFavorite={
                    chatPrefs[activeChat.id]?.favorite ?? false
                  }
                  scheduleVersion={scheduleVersion}
                  onScheduleChanged={() =>
                    setScheduleVersion((v) => v + 1)
                  }
                />
              </aside>
            ) : null}
            {activeChat.type === "individual" && showDmInfo && user ? (
              <aside
                className="absolute inset-0 z-[35] flex shrink-0 flex-col border-l lg:relative lg:inset-auto lg:z-auto"
                style={{
                  borderColor: BORDER_SUB,
                  background: SURFACE,
                  width:
                    typeof window !== "undefined" && window.innerWidth >= 1024
                      ? groupDrawerWidth
                      : undefined,
                }}
              >
                <button
                  type="button"
                  aria-label="Resize panel"
                  className="absolute left-0 top-0 hidden h-full w-1 cursor-col-resize bg-transparent hover:bg-white/10 lg:block"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    drawerResizeRef.current = {
                      startX: e.clientX,
                      startW: groupDrawerWidth,
                    };
                    const onMove = (ev: MouseEvent) => {
                      if (!drawerResizeRef.current) return;
                      const dx =
                        drawerResizeRef.current.startX - ev.clientX;
                      const next = Math.min(
                        640,
                        Math.max(
                          320,
                          drawerResizeRef.current.startW + dx,
                        ),
                      );
                      setGroupDrawerWidth(next);
                    };
                    const onUp = () => {
                      if (drawerResizeRef.current) {
                        try {
                          window.localStorage.setItem(
                            "gt_group_drawer_width",
                            String(groupDrawerWidth),
                          );
                        } catch {
                          /* ignore */
                        }
                      }
                      drawerResizeRef.current = null;
                      window.removeEventListener("mousemove", onMove);
                      window.removeEventListener("mouseup", onUp);
                    };
                    window.addEventListener("mousemove", onMove);
                    window.addEventListener("mouseup", onUp);
                  }}
                />
                <DmInfoPanel
                  key={activeChat.id}
                  chatId={activeChat.id}
                  peerName={chatRowDisplayName(activeChat)}
                  peerUsername={
                    (() => {
                      const peerId = activeChat.members.find(
                        (m) => m !== user.id,
                      );
                      const peer = peerId
                        ? connectionsList.find(
                            (p) => p.id === peerId,
                          )
                        : null;
                      return peer?.username ?? null;
                    })()
                  }
                  peerAvatarUrl={chatRowDmAvatarUrl(activeChat)}
                  peerOnline={dmHeaderPeerOnline}
                  isFavorite={
                    chatPrefs[activeChat.id]?.favorite ?? false
                  }
                  isMuted={chatPrefs[activeChat.id]?.muted ?? false}
                  onClose={() => setShowDmInfo(false)}
                  onSearchInChat={() => setShowInChatSearch(true)}
                  onVoiceCall={() => {
                    if (
                      !activeChat ||
                      activeChat.type !== "individual"
                    )
                      return;
                    const peer = activeChat.members.find(
                      (m) => m !== user.id,
                    );
                    if (!peer) return;
                    void startOutgoingCall("audio", {
                      id: peer,
                      name: chatRowDisplayName(activeChat),
                      avatar: chatRowDmAvatarUrl(activeChat),
                    });
                  }}
                  onVideoCall={() => {
                    if (
                      !activeChat ||
                      activeChat.type !== "individual"
                    )
                      return;
                    const peer = activeChat.members.find(
                      (m) => m !== user.id,
                    );
                    if (!peer) return;
                    void startOutgoingCall("video", {
                      id: peer,
                      name: chatRowDisplayName(activeChat),
                      avatar: chatRowDmAvatarUrl(activeChat),
                    });
                  }}
                  onScheduleCall={() => {
                    setScheduleCallTitle("");
                    setScheduleCallAt("");
                    setScheduleCallOpen({ chat: activeChat });
                  }}
                  onClearChat={() => void clearActiveChatMessages()}
                  onBlockPeer={() => void blockActiveChatPeer()}
                  onReport={() =>
                    showToast("Report flow coming soon", "success")
                  }
                  onToggleFavorite={() => {
                    const cur =
                      chatPrefs[activeChat.id]?.favorite ?? false;
                    updateChatPref(activeChat.id, { favorite: !cur });
                    showToast(
                      cur
                        ? "Removed from favorites"
                        : "Added to favorites",
                      "success",
                    );
                  }}
                  onToggleMute={() => {
                    const cur =
                      chatPrefs[activeChat.id]?.muted ?? false;
                    updateChatPref(activeChat.id, { muted: !cur });
                    showToast(
                      cur ? "Notifications unmuted" : "Notifications muted",
                      "success",
                    );
                  }}
                  onViewFullProfile={() => {
                    void openPeerProfileFromActiveChat();
                  }}
                  scheduleVersion={scheduleVersion}
                  onScheduleChanged={() =>
                    setScheduleVersion((v) => v + 1)
                  }
                />
              </aside>
            ) : null}
            </div>
        )}
      </div>
      </div>

      {showNewChat ? (
        <NewChatOverlay
          contacts={contacts}
          onClose={() => setShowNewChat(false)}
          onPick={(p) => {
            setShowNewChat(false);
            void openDirectChat(p);
          }}
        />
      ) : null}

      {showSearchOverlay ? (
        <div
          className="fixed inset-0 z-[360] flex min-h-0 flex-col"
          style={{ background: BG }}
        >
          <div
            className="flex shrink-0 items-center gap-2 px-3 py-3"
            style={{ borderBottom: `0.5px solid ${BORDER_SUB}` }}
          >
            <button
              type="button"
              aria-label="Close search"
              className="flex h-9 w-9 items-center justify-center text-white"
              onClick={() => {
                setShowSearchOverlay(false);
                setSearchQuery("");
              }}
            >
              <ThIconChevronLeft size={22} className="text-white" />
            </button>
            <div
              className="flex min-w-0 flex-1 items-center gap-2 rounded-full px-3 py-2"
              style={{ background: SURFACE }}
            >
              <span className="inline-flex shrink-0" style={{ color: TH_MUTED }} aria-hidden>
                <ThIconSearch size={18} className="text-current" />
              </span>
              <input
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search chats, people, and groups…"
                className="min-w-0 flex-1 border-0 bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
              />
              {searchQuery ? (
                <button
                  type="button"
                  className="text-slate-400"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear"
                >
                  ×
                </button>
              ) : null}
            </div>
          </div>
          <div className="min-h-0 flex-1 custom-scrollbar overflow-y-auto overscroll-contain px-2 py-2">
            {searchQuery.trim().length < 2 ? (
              <p
                className="px-2 py-8 text-center text-sm"
                style={{ color: TEXT_MUTED }}
              >
                Type 2+ characters to search
              </p>
            ) : null}
            {searchQuery.trim().length >= 2 && searchOverlayLoading ? (
              <div className="flex flex-1 items-center justify-center py-20">
                <div
                  className="h-10 w-10 animate-spin rounded-full border-2 border-slate-600 border-t-white"
                  aria-hidden
                />
              </div>
            ) : null}
            {searchQuery.trim().length >= 2 && !searchOverlayLoading ? (
              <>
                {overlayChats.length > 0 ? (
                  <div className="mb-3">
                    <p
                      className="px-2 pb-2 text-xs font-bold"
                      style={{ color: "#E94560" }}
                    >
                      Chats
                    </p>
                    {overlayChats.map((c) => {
                      const gMeta = c.group_id
                        ? groups.find((g) => g.id === c.group_id)
                        : undefined;
                      const n = gMeta?.members?.length ?? 0;
                      const bg = listAvatarColor(c.name);
                      const ini =
                        c.listInitials ?? initialsFromName(c.name);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => openGroupChatFromSearch(c)}
                          className="mb-1 flex w-full min-h-[56px] items-center gap-3 rounded-lg px-2 py-2 text-left"
                          style={{ background: SURFACE }}
                        >
                          <span
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                            style={{ background: bg }}
                          >
                            {ini}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-white">
                              {c.name}
                            </p>
                            <p
                              className="truncate text-xs"
                              style={{ color: TEXT_MUTED }}
                            >
                              {n} {n === 1 ? "member" : "members"}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
                {overlayContacts.length > 0 ? (
                  <div className="mb-3">
                    <p
                      className="px-2 pb-2 text-xs font-bold"
                      style={{ color: "#E94560" }}
                    >
                      Contacts
                    </p>
                    {overlayContacts.map((c) => {
                      const contactPhoto = profileOrAvatarPublicUrl(c);
                      return (
                        <div
                          key={c.id}
                          className="mb-1 flex min-h-[56px] items-center gap-3 rounded-lg px-2 py-2"
                          style={{ background: SURFACE }}
                        >
                          {contactPhoto ? (
                            <img
                              src={contactPhoto}
                              alt=""
                              className="h-10 w-10 shrink-0 rounded-full object-cover"
                            />
                          ) : (
                            <InitialsAvatar name={c.full_name} size={40} />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-white">
                              {c.full_name}
                            </p>
                            {c.username ? (
                              <p
                                className="truncate text-xs"
                                style={{ color: TEXT_MUTED }}
                              >
                                @{c.username}
                              </p>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium text-white"
                            style={{ background: "#2563EB" }}
                            onClick={() => {
                              setShowSearchOverlay(false);
                              setSearchQuery("");
                              void openDirectChat({
                                id: c.id,
                                full_name: c.full_name,
                                username: c.username,
                                avatar_url:
                                  c.profile_picture ?? c.avatar_url ?? null,
                              });
                            }}
                          >
                            Message
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
                {overlayPeople.length > 0 ? (
                  <div className="mb-3">
                    <p
                      className="px-2 pb-2 text-xs font-bold"
                      style={{ color: "#E94560" }}
                    >
                      People
                    </p>
                    {overlayPeople.map((u) => {
                      const uPhoto = profileOrAvatarPublicUrl(u);
                      const st = u.friend_status;
                      const pl = (u.plan ?? "free").replace(/_/g, " ");
                      return (
                        <div
                          key={u.id}
                          className="mb-1 flex min-h-[56px] items-center gap-3 rounded-lg px-2 py-2"
                          style={{ background: SURFACE }}
                        >
                          <button
                            type="button"
                            className="shrink-0 border-0 bg-transparent p-0"
                            aria-label="View profile"
                            onClick={() => setSearchProfileFor(u)}
                          >
                            {uPhoto ? (
                              <img
                                src={uPhoto}
                                alt=""
                                className="h-10 w-10 rounded-full object-cover"
                              />
                            ) : (
                              <InitialsAvatar name={u.full_name} size={40} />
                            )}
                          </button>
                          <button
                            type="button"
                            className="min-w-0 flex-1 border-0 bg-transparent p-0 text-left"
                            onClick={() => setSearchProfileFor(u)}
                          >
                            <p className="truncate text-sm font-bold text-white">
                              {u.full_name}
                            </p>
                            {u.username ? (
                              <p
                                className="truncate text-xs"
                                style={{ color: TEXT_MUTED }}
                              >
                                @{u.username}
                              </p>
                            ) : null}
                            <span className="mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white/90"
                              style={{ background: "#334155" }}
                            >
                              {pl}
                            </span>
                          </button>
                          <div
                            className="shrink-0"
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                            role="presentation"
                          >
                            {st === "none" ? (
                              <button
                                type="button"
                                className="rounded-lg px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                                style={{ background: "#2563EB" }}
                                disabled={userSearchActionId === u.id}
                                onClick={() => void connectUserSearchRow(u)}
                              >
                                Connect
                              </button>
                            ) : null}
                            {st === "pending_sent" ? (
                              <button
                                type="button"
                                className="cursor-not-allowed rounded-lg bg-slate-600/50 px-3 py-1.5 text-xs font-medium text-slate-400"
                                disabled
                              >
                                Requested
                              </button>
                            ) : null}
                            {st === "pending_received" ? (
                              <button
                                type="button"
                                className="rounded-lg px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                                style={{ background: "#16A34A" }}
                                disabled={userSearchActionId === u.id}
                                onClick={() => void acceptUserSearchRow(u)}
                              >
                                Accept
                              </button>
                            ) : null}
                            {st === "accepted" ? (
                              <div className="relative" data-buddies-root>
                                <button
                                  type="button"
                                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-white"
                                  style={{ background: "#16A34A" }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setBuddiesMenuOpenId((x) =>
                                      x === u.id ? null : u.id,
                                    );
                                  }}
                                >
                                  <span className="inline-flex items-center gap-1">
                                    <ThIconCheckCircle size={14} className="text-white" />
                                    Buddies
                                  </span>
                                </button>
                                {buddiesMenuOpenId === u.id ? (
                                  <div
                                    className="absolute right-0 top-full z-[410] mt-1 min-w-[11rem] rounded-lg border py-1 shadow-xl"
                                    style={{
                                      background: SURFACE,
                                      borderColor: BORDER_SUB,
                                    }}
                                    data-buddies-root
                                  >
                                    <button
                                      type="button"
                                      className="block w-full px-3 py-2 text-left text-xs text-white hover:bg-white/10"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        messageUserSearchRow(u);
                                      }}
                                    >
                                      <span className="inline-flex items-center gap-2">
                                        <MessageCircle className="h-3.5 w-3.5" strokeWidth={1.5} />
                                        Message
                                      </span>
                                    </button>
                                    <button
                                      type="button"
                                      className="block w-full px-3 py-2 text-left text-xs text-white hover:bg-white/10"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (
                                          readBuddyFavourites().includes(u.id)
                                        ) {
                                          showToast(
                                            "Already a favourite",
                                            "success",
                                          );
                                        } else {
                                          addBuddyFavourite(u.id);
                                          showToast(
                                            "Added to favourites",
                                            "success",
                                          );
                                        }
                                        setBuddiesMenuOpenId(null);
                                      }}
                                    >
                                      <span className="inline-flex items-center gap-2">
                                        <Star className="h-3.5 w-3.5" strokeWidth={1.5} />
                                        Favourite
                                      </span>
                                    </button>
                                    <button
                                      type="button"
                                      className="block w-full px-3 py-2 text-left text-xs text-white hover:bg-white/10"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setBuddiesMenuOpenId(null);
                                        showToast("Muted", "success");
                                      }}
                                    >
                                      <span className="inline-flex items-center gap-2">
                                        <BellOff className="h-3.5 w-3.5" strokeWidth={1.5} />
                                        Mute
                                      </span>
                                    </button>
                                    <button
                                      type="button"
                                      className="block w-full px-3 py-2 text-left text-xs text-white hover:bg-white/10"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setBuddiesMenuOpenId(null);
                                        void blockUserSearch(u);
                                      }}
                                    >
                                      <span className="inline-flex items-center gap-2">
                                        <Ban className="h-3.5 w-3.5" strokeWidth={1.5} />
                                        Block
                                      </span>
                                    </button>
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                            {st === "blocked" ? (
                              <span
                                className="px-2 text-xs"
                                style={{ color: TEXT_MUTED }}
                              >
                                Blocked
                              </span>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
                {discoverGroupsList.length > 0 ? (
                  <div className="mb-3">
                    <p
                      className="px-2 pb-2 text-xs font-bold"
                      style={{ color: "#E94560" }}
                    >
                      Groups
                    </p>
                    {discoverGroupsList.map((g) => {
                      const n = g.members?.length ?? 0;
                      const bg = listAvatarColor(g.name);
                      const ch = (g.name.trim()[0] ?? "?").toUpperCase();
                      return (
                        <div
                          key={g.id}
                          className="mb-1 flex min-h-[56px] items-center gap-3 rounded-lg px-2 py-2"
                          style={{ background: SURFACE }}
                        >
                          <span
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                            style={{ background: bg }}
                          >
                            {ch}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-white">
                              {g.name}
                            </p>
                            <p
                              className="truncate text-xs"
                              style={{ color: TEXT_MUTED }}
                            >
                              {n} {n === 1 ? "member" : "members"}
                            </p>
                          </div>
                          <button
                            type="button"
                            className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium text-white"
                            style={{ background: ACCENT }}
                            onClick={() => void joinDiscoverGroup()}
                          >
                            Join
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
                {searchQuery.trim().length >= 2 &&
                !searchOverlayLoading &&
                overlayChats.length === 0 &&
                overlayContacts.length === 0 &&
                overlayPeople.length === 0 &&
                discoverGroupsList.length === 0 ? (
                  <p
                    className="px-2 py-12 text-center text-sm"
                    style={{ color: TEXT_MUTED }}
                  >
                    No results found
                  </p>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {groupMemberPanelGroupId ? (
        <div className="fixed inset-0 z-[400] flex justify-end">
          <button
            type="button"
            aria-label="Close group info"
            className="min-h-0 flex-1 bg-black/55"
            onClick={() => setGroupMemberPanelGroupId(null)}
          />
          <div
            className="flex h-full max-h-screen w-[min(100%,400px)] shrink-0 flex-col custom-scrollbar overflow-y-auto border-l shadow-2xl"
            style={{ background: BG, borderColor: BORDER_SUB }}
          >
            {(() => {
              const g = groups.find((x) => x.id === groupMemberPanelGroupId);
              if (!g) {
                return (
                  <p className="p-4 text-sm text-slate-400">Group not found</p>
                );
              }
              return (
                <>
                  <div
                    className="flex shrink-0 items-center justify-between border-b px-3 py-2"
                    style={{ borderColor: BORDER_SUB }}
                  >
                    <span className="text-sm font-medium text-white">
                      Group members
                    </span>
                    <button
                      type="button"
                      className="text-2xl leading-none text-slate-400 hover:text-white"
                      onClick={() => setGroupMemberPanelGroupId(null)}
                      aria-label="Close"
                    >
                      ×
                    </button>
                  </div>
                  <p className="border-b px-4 py-2 text-sm font-bold text-white"
                    style={{ borderColor: BORDER_SUB }}
                  >
                    {g.name}
                  </p>
                  <ul className="px-2 py-2">
                    {(g.members ?? []).map((m) => (
                      <li
                        key={m.user_id}
                        className="mb-1 flex items-center gap-3 rounded-lg px-2 py-2"
                        style={{ background: SURFACE }}
                      >
                        {m.avatar_url?.trim() &&
                        !isInlineSvgDataUrlToSkipForPhoto(m.avatar_url) &&
                        !isLegacyDicebearUrl(m.avatar_url) ? (
                          <img
                            src={m.avatar_url}
                            alt=""
                            className="h-10 w-10 rounded-full object-cover"
                            width={40}
                            height={40}
                          />
                        ) : (
                          <InitialsAvatar name={m.full_name} size={40} />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-white">
                            {m.full_name}
                          </p>
                          {m.role ? (
                            <p
                              className="text-[11px] capitalize"
                              style={{ color: TEXT_MUTED }}
                            >
                              {m.role}
                            </p>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              );
            })()}
          </div>
        </div>
      ) : null}

      {searchProfileFor ? (
        <>
        <div className="fixed inset-0 z-[400] flex justify-end">
          <button
            type="button"
            aria-label="Close profile"
            className="min-h-0 flex-1 bg-black/55"
            onClick={() => {
              setProfileReportDialogOpen(false);
              setSearchProfileFor(null);
            }}
          />
          <div
            className="flex h-full max-h-screen w-[min(100%,400px)] shrink-0 flex-col custom-scrollbar overflow-y-auto border-l shadow-2xl"
            style={{ background: BG, borderColor: BORDER_SUB }}
          >
            {(() => {
              const p = searchProfileFor;
              const st = p.friend_status;
              const planLabel = (p.plan ?? "free").replace(/_/g, " ");
              const photo = profileOrAvatarPublicUrl(p);
              const inDmWithPeer =
                activeChat?.type === "individual" &&
                p.id != null &&
                (activeChat.members ?? []).includes(p.id);
              const isPending =
                st === "pending_sent" || st === "pending_received";
              const youOweThem = 0;
              const theyOweYou = 0;
              const totalNet = theyOweYou - youOweThem;
              const moneyAllZero =
                youOweThem + theyOweYou === 0 && totalNet === 0;
              const fmtTotal = (n: number) => {
                if (n > 0) return `+$${n.toFixed(2)}`;
                if (n < 0) return `-$${Math.abs(n).toFixed(2)}`;
                return "$0.00";
              };
              const tabList = [
                "media",
                "links",
                "docs",
                "trips",
                "activities",
              ] as const;
              return (
                <>
                  <div
                    className="flex shrink-0 items-center justify-between border-b px-3 py-2"
                    style={{ borderColor: BORDER_SUB }}
                  >
                    <span className="text-sm font-medium text-white">
                      Profile
                    </span>
                    <button
                      type="button"
                      className="text-2xl leading-none text-slate-400 hover:text-white"
                      onClick={() => {
                        setProfileReportDialogOpen(false);
                        setSearchProfileFor(null);
                      }}
                      aria-label="Close"
                    >
                      ×
                    </button>
                  </div>
                  <div className="flex flex-col items-center px-4 pb-2 pt-4">
                    {photo ? (
                      <img
                        src={photo}
                        alt=""
                        className="h-20 w-20 rounded-full object-cover"
                        width={80}
                        height={80}
                      />
                    ) : (
                      <InitialsAvatar name={p.full_name} size={80} />
                    )}
                    <h2 className="mt-4 text-center text-lg font-bold text-white">
                      {p.full_name}
                    </h2>
                    <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1.5">
                      {st === "accepted" ? (
                        <span
                          className="inline-flex items-center gap-1 rounded-full border border-green-500/40 bg-green-500/15 px-2.5 py-0.5 text-xs font-semibold text-green-300"
                        >
                          <ThIconCheckCircle size={12} className="text-green-300/90" />
                          Buddy
                        </span>
                      ) : isPending ? (
                        <span
                          className="rounded-full border border-sky-500/40 bg-sky-500/15 px-2.5 py-0.5 text-xs font-semibold text-sky-300"
                        >
                          Request Pending
                        </span>
                      ) : inDmWithPeer && st === "blocked" ? (
                        <span className="rounded-full border border-red-500/40 bg-red-500/15 px-2.5 py-0.5 text-xs font-semibold text-red-300">
                          Blocked
                        </span>
                      ) : inDmWithPeer && st === "none" ? (
                        <span
                          className="rounded-full border border-slate-500/40 bg-slate-600/25 px-2.5 py-0.5 text-xs font-semibold text-slate-300"
                        >
                          Private Chat
                        </span>
                      ) : null}
                    </div>
                    {p.username ? (
                      <p
                        className="mt-0.5 text-sm"
                        style={{ color: TEXT_MUTED }}
                      >
                        @{p.username}
                      </p>
                    ) : null}
                    <p
                      className="mt-1 flex items-center justify-center gap-1.5 text-center text-sm"
                      style={{ color: TEXT_MUTED }}
                    >
                      {profilePanelPeerOnline === true ? (
                        <span
                          className="inline-block h-2 w-2 shrink-0 rounded-full"
                          style={{ background: ONLINE }}
                          aria-hidden
                        />
                      ) : (
                        <span
                          className="inline-block h-2 w-2 shrink-0 rounded-full bg-slate-500"
                          aria-hidden
                        />
                      )}
                      {profilePanelPeerOnline === true
                        ? "Active now"
                        : "Last seen recently"}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                      <span
                        className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white"
                        style={{ background: SURFACE }}
                      >
                        {planLabel}
                      </span>
                      {p.is_verified ? (
                        <span className="rounded-full bg-sky-600/80 px-2.5 py-0.5 text-[10px] font-semibold text-white">
                          Verified
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div
                    className="flex border-b px-1 pb-3 pt-1"
                    style={{ borderColor: BORDER_SUB }}
                  >
                    {(
                      [
                        [Phone, "Phone", () => showToast("Calls coming soon", "success")],
                        [
                          Video,
                          "Video",
                          () => showToast("Video call coming soon", "success"),
                        ],
                        [
                          Search,
                          "Search",
                          () => {
                            setProfileReportDialogOpen(false);
                            setSearchProfileFor(null);
                            if (inDmWithPeer) {
                              setShowInChatSearch(true);
                            } else {
                              setShowSearchOverlay(true);
                            }
                          },
                        ],
                        [
                          Ban,
                          "Block",
                          () => {
                            if (st === "blocked") {
                              showToast("Already blocked", "success");
                              return;
                            }
                            void blockUserSearch(p);
                          },
                        ],
                      ] as const
                    ).map(([Icon, label, onClick], i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={onClick}
                        disabled={st === "blocked" && label === "Block"}
                        className="flex min-w-0 flex-1 flex-col items-center gap-1.5 p-1 text-white disabled:opacity-40"
                      >
                        <Icon className="h-6 w-6 text-white" strokeWidth={2} />
                        <span className="text-center text-[10px] text-white/90">
                          {label}
                        </span>
                      </button>
                    ))}
                  </div>
                  <div
                    className="mx-3 mt-2 rounded-xl border p-3"
                    style={{ borderColor: BORDER_SUB, background: SURFACE }}
                  >
                    <p
                      className="text-center text-[11px] font-semibold uppercase tracking-wide"
                      style={{ color: TEXT_MUTED }}
                    >
                      Total balance
                    </p>
                    <p
                      className="mt-1 text-center text-2xl font-bold tabular-nums"
                      style={{
                        color:
                          totalNet > 0
                            ? MONEY_TOTAL_POS
                            : totalNet < 0
                              ? MONEY_TOTAL_NEG
                              : MONEY_TOTAL_ZERO,
                      }}
                    >
                      {fmtTotal(totalNet)}
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-3 border-t border-white/10 pt-3 text-center text-xs">
                      <div>
                        <p
                          className="mb-1 flex items-center justify-center gap-1"
                          style={{ color: MONEY_LINE_GREEN }}
                        >
                          <ArrowUpRight
                            className="h-3.5 w-3.5 shrink-0"
                            strokeWidth={1.5}
                            aria-hidden
                          />
                          You receive
                        </p>
                        <p
                          className="text-base font-bold tabular-nums"
                          style={{
                            color:
                              theyOweYou > 0
                                ? MONEY_LINE_GREEN
                                : MONEY_TOTAL_ZERO,
                          }}
                        >
                          ${theyOweYou.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p
                          className="mb-1 flex items-center justify-center gap-1"
                          style={{ color: MONEY_LINE_RED }}
                        >
                          <ArrowDownRight
                            className="h-3.5 w-3.5 shrink-0"
                            strokeWidth={1.5}
                            aria-hidden
                          />
                          You owe
                        </p>
                        <p
                          className="text-base font-bold tabular-nums"
                          style={{
                            color:
                              youOweThem > 0
                                ? MONEY_LINE_RED
                                : MONEY_TOTAL_ZERO,
                          }}
                        >
                          ${youOweThem.toFixed(2)}
                        </p>
                      </div>
                    </div>
                    <p
                      className="mt-3 text-[11px] leading-relaxed"
                      style={{ color: TEXT_MUTED }}
                    >
                      {moneyAllZero
                        ? "No shared group expenses yet"
                        : "Split activity totals are summarized here when you share a group."}
                    </p>
                  </div>
                  <div
                    className="mt-1 flex shrink-0 flex-wrap border-b"
                    style={{ borderColor: BORDER_SUB }}
                  >
                    {tabList.map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setSearchProfileSubTab(tab)}
                        className="min-w-0 flex-1 px-1.5 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wide"
                        style={{
                          color:
                            searchProfileSubTab === tab
                              ? BUBBLE_SENDER_CORAL
                              : TEXT_MUTED,
                          borderBottom:
                            searchProfileSubTab === tab
                              ? `2px solid ${BUBBLE_SENDER_CORAL}`
                              : "2px solid transparent",
                        }}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                  <div
                    className="min-h-[88px] px-4 py-3 text-sm"
                    style={{ color: TEXT_MUTED }}
                  >
                    {searchProfileSubTab === "media" ? (
                      <p>Nothing in Media</p>
                    ) : null}
                    {searchProfileSubTab === "links" ? (
                      <p>Nothing in Links</p>
                    ) : null}
                    {searchProfileSubTab === "docs" ? (
                      <p>Nothing in Docs</p>
                    ) : null}
                    {searchProfileSubTab === "trips" ? (
                      <p>Nothing in Trips</p>
                    ) : null}
                    {searchProfileSubTab === "activities" ? (
                      <p>Nothing in Activities</p>
                    ) : null}
                  </div>
                  <div
                    className="border-t px-4 py-3"
                    style={{ borderColor: BORDER_SUB }}
                  >
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      {st === "none" ? (
                        <button
                          type="button"
                          className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                          style={{ background: "#2563EB" }}
                          disabled={userSearchActionId === p.id}
                          onClick={() => void connectUserSearchRow(p)}
                        >
                          Connect
                        </button>
                      ) : null}
                      {st === "pending_sent" ? (
                        <button
                          type="button"
                          className="cursor-not-allowed rounded-lg bg-slate-600/50 px-4 py-2 text-sm font-medium text-slate-400"
                          disabled
                        >
                          Requested
                        </button>
                      ) : null}
                      {st === "pending_received" ? (
                        <button
                          type="button"
                          className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                          style={{ background: "#16A34A" }}
                          disabled={userSearchActionId === p.id}
                          onClick={() => void acceptUserSearchRow(p)}
                        >
                          Accept
                        </button>
                      ) : null}
                      {st === "blocked" ? (
                        <span
                          className="text-sm"
                          style={{ color: TEXT_MUTED }}
                        >
                          Blocked
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div
                    className="mt-auto border-t px-4 py-3"
                    style={{ borderColor: BORDER_SUB }}
                  >
                    <div className="text-center">
                      <button
                        type="button"
                        onClick={() => setProfileReportDialogOpen(true)}
                        className="text-center text-xs font-medium underline-offset-2 hover:underline"
                        style={{
                          color: "#E8385A",
                          background: "none",
                          border: "none",
                        }}
                      >
                        Report
                      </button>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
        {profileReportDialogOpen ? (
          <div
            className="fixed inset-0 z-[500] flex items-center justify-center bg-black/60 px-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-report-title"
          >
            <div
              className="w-full max-w-sm rounded-2xl border p-4 shadow-2xl"
              style={{ background: SURFACE, borderColor: BORDER_SUB }}
            >
              <p
                id="profile-report-title"
                className="text-center text-sm text-white"
              >
                Are you sure you want to report{" "}
                <span className="font-semibold">
                  {searchProfileFor?.full_name ?? "this person"}
                </span>
                ?
              </p>
              <div className="mt-4 flex justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setProfileReportDialogOpen(false)}
                  className="rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setProfileReportDialogOpen(false);
                    showToast("Report submitted. We'll review this.", "success");
                  }}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-white"
                  style={{ background: "#E8385A" }}
                >
                  Report
                </button>
              </div>
            </div>
          </div>
        ) : null}
        </>
      ) : null}

      {showMenuDrawer ? (
        <div className="fixed inset-0 z-[360]">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/55"
            onClick={() => setShowMenuDrawer(false)}
          />
          <div
            className="absolute right-0 top-0 flex h-full w-[min(100%,300px)] flex-col border-l shadow-2xl"
            style={{
              background: BG,
              borderColor: BORDER_SUB,
            }}
          >
            <div
              className="border-b px-4 py-4"
              style={{ borderColor: BORDER_SUB }}
            >
              <p className="text-sm font-medium text-white">Connect</p>
              <p className="text-xs" style={{ color: TEXT_MUTED }}>
                {user?.full_name?.trim() || "Travel Hub"}
              </p>
            </div>
            <nav className="flex flex-1 flex-col p-2 text-left text-sm text-white">
              <button
                type="button"
                className="rounded-lg px-3 py-3 text-left hover:bg-white/5"
                onClick={() => {
                  setShowMenuDrawer(false);
                  setShowNewChat(true);
                }}
              >
                New chat
              </button>
              <button
                type="button"
                className="rounded-lg px-3 py-3 text-left hover:bg-white/5"
                onClick={() => {
                  setShowMenuDrawer(false);
                  setCreateGroupRequestId((n) => n + 1);
                }}
              >
                New group
              </button>
              <button
                type="button"
                className="rounded-lg px-3 py-3 text-left hover:bg-white/5"
                onClick={() => {
                  setShowMenuDrawer(false);
                  setShowSearchOverlay(true);
                }}
              >
                Contacts
              </button>
              <button
                type="button"
                className="rounded-lg px-3 py-3 text-left hover:bg-white/5"
                onClick={() => {
                  setShowMenuDrawer(false);
                  showToast("Linked devices coming soon", "success");
                }}
              >
                Linked devices
              </button>
              <button
                type="button"
                className="rounded-lg px-3 py-3 text-left hover:bg-white/5"
                onClick={() => {
                  setShowMenuDrawer(false);
                  showToast("Starred messages coming soon", "success");
                }}
              >
                Starred
              </button>
              <div
                className="my-2 h-px w-full"
                style={{ background: BORDER_SUB }}
              />
              <button
                type="button"
                className="rounded-lg px-3 py-3 text-left font-semibold hover:bg-white/5"
                onClick={() => {
                  setShowMenuDrawer(false);
                  setShowConnectSettings(true);
                }}
              >
                Settings
              </button>
            </nav>
          </div>
        </div>
      ) : null}

      {showConnectSettings ? (
        <ConnectSettingsPanel
          user={user}
          onClose={() => setShowConnectSettings(false)}
          showToast={showToast}
          onLogout={handleUnauthorized}
          onShareInvite={async () => {
            const origin =
              typeof window !== "undefined"
                ? window.location.origin
                : "";
            const url = `${origin}/`;
            const text = `Join me on Group Travel: ${url}`;
            const nav = navigator as Navigator & {
              share?: (data: {
                title?: string;
                text?: string;
                url?: string;
              }) => Promise<void>;
            };
            try {
              if (typeof nav.share === "function") {
                await nav.share({
                  title: "Group Travel",
                  text,
                  url,
                });
                return;
              }
              await nav.clipboard.writeText(text);
              showToast("Invite link copied", "success");
            } catch {
              /* user cancelled */
            }
          }}
        />
      ) : null}

      {groupCallPicker && user ? (
        <div
          className="fixed inset-0 z-[400] flex items-center justify-center bg-black/60 px-4"
          role="presentation"
          onClick={() => setGroupCallPicker(null)}
        >
          <div
            role="dialog"
            aria-label={
              groupCallPicker.type === "audio"
                ? "Voice call group member"
                : "Video call group member"
            }
            onClick={(e) => e.stopPropagation()}
            className="flex w-full max-w-md flex-col rounded-2xl border shadow-2xl"
            style={{ background: SURFACE, borderColor: BORDER_SUB }}
          >
            <div
              className="flex items-center justify-between border-b px-4 py-3"
              style={{ borderColor: BORDER_SUB }}
            >
              <div className="min-w-0">
                <p className="truncate text-[15px] font-bold text-white">
                  {groupCallPicker.type === "audio"
                    ? "Voice call"
                    : "Video call"}
                </p>
                <p
                  className="truncate text-[12px]"
                  style={{ color: TEXT_MUTED }}
                >
                  Group calls aren&apos;t supported yet — pick a member to start
                  a 1-on-1 call.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                className="shrink-0 text-slate-400 hover:text-white"
                onClick={() => setGroupCallPicker(null)}
              >
                ×
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto custom-scrollbar p-2">
              {(() => {
                const grp = groups.find(
                  (g) => g.id === groupCallPicker.chat.group_id,
                );
                const members = (grp?.members ?? []).filter(
                  (m) => m.user_id !== user.id,
                );
                if (members.length === 0) {
                  return (
                    <p
                      className="px-3 py-6 text-center text-sm"
                      style={{ color: TEXT_MUTED }}
                    >
                      No other members in this group yet.
                    </p>
                  );
                }
                return members.map((m) => (
                  <button
                    key={m.user_id}
                    type="button"
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-white hover:bg-white/10"
                    onClick={() => {
                      const callType = groupCallPicker.type;
                      setGroupCallPicker(null);
                      void startOutgoingCall(callType, {
                        id: m.user_id,
                        name: m.full_name,
                        avatar: m.avatar_url ?? null,
                      });
                    }}
                  >
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white"
                      style={{
                        background: listAvatarColor(m.full_name ?? "?"),
                      }}
                    >
                      {initialsFromName(m.full_name ?? "?")}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {m.full_name}
                      </span>
                    </span>
                    {groupCallPicker.type === "audio" ? (
                      <Phone className="h-4 w-4 shrink-0" />
                    ) : (
                      <Video className="h-4 w-4 shrink-0" />
                    )}
                  </button>
                ));
              })()}
            </div>
            <div
              className="flex items-center justify-between gap-2 border-t px-3 py-3"
              style={{ borderColor: BORDER_SUB }}
            >
              <button
                type="button"
                className="text-xs font-medium text-sky-400 hover:underline"
                onClick={() => {
                  const chat = groupCallPicker.chat;
                  setGroupCallPicker(null);
                  setScheduleCallTitle("");
                  setScheduleCallAt("");
                  setScheduleCallOpen({ chat });
                }}
              >
                Schedule a call instead
              </button>
              <button
                type="button"
                className="rounded-lg px-3 py-1.5 text-xs text-white hover:bg-white/10"
                onClick={() => setGroupCallPicker(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {scheduleCallOpen && user ? (
        <div
          className="fixed inset-0 z-[400] flex items-center justify-center bg-black/60 px-4"
          role="presentation"
          onClick={() => setScheduleCallOpen(null)}
        >
          <div
            role="dialog"
            aria-label="Schedule a call"
            onClick={(e) => e.stopPropagation()}
            className="flex w-full max-w-md flex-col rounded-2xl border shadow-2xl"
            style={{ background: SURFACE, borderColor: BORDER_SUB }}
          >
            <div
              className="flex items-center justify-between border-b px-4 py-3"
              style={{ borderColor: BORDER_SUB }}
            >
              <p className="truncate text-[15px] font-bold text-white">
                Schedule a call · {scheduleCallOpen.chat.name}
              </p>
              <button
                type="button"
                aria-label="Close"
                className="shrink-0 text-slate-400 hover:text-white"
                onClick={() => setScheduleCallOpen(null)}
              >
                ×
              </button>
            </div>
            <div className="space-y-3 px-4 py-4">
              <label className="block text-xs text-slate-300">
                Title
                <input
                  type="text"
                  value={scheduleCallTitle}
                  maxLength={120}
                  onChange={(e) => setScheduleCallTitle(e.target.value)}
                  placeholder="e.g. Trip planning catch-up"
                  className="mt-1 w-full rounded-lg border bg-transparent px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500"
                  style={{ borderColor: BORDER_SUB }}
                />
              </label>
              <label className="block text-xs text-slate-300">
                When
                <input
                  type="datetime-local"
                  value={scheduleCallAt}
                  onChange={(e) => setScheduleCallAt(e.target.value)}
                  className="mt-1 w-full rounded-lg border bg-transparent px-3 py-2 text-sm text-white outline-none"
                  style={{ borderColor: BORDER_SUB }}
                />
              </label>
              <p className="text-[11px] text-slate-500">
                Saved as a reminder in this browser. Server-side scheduling will
                arrive in a later release.
              </p>
            </div>
            <div
              className="flex items-center justify-end gap-2 border-t px-3 py-3"
              style={{ borderColor: BORDER_SUB }}
            >
              <button
                type="button"
                className="rounded-lg px-3 py-1.5 text-xs text-white hover:bg-white/10"
                onClick={() => setScheduleCallOpen(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
                style={{ background: ACCENT }}
                disabled={!scheduleCallAt}
                onClick={() => {
                  if (!scheduleCallOpen) return;
                  const at = new Date(scheduleCallAt).getTime();
                  if (!at || Number.isNaN(at)) {
                    showToast("Pick a valid date/time", "error");
                    return;
                  }
                  try {
                    const KEY = "gt_scheduled_calls_v1";
                    const raw = localStorage.getItem(KEY);
                    const list: Array<{
                      id: string;
                      chatId: string;
                      chatName: string;
                      title: string;
                      at: number;
                    }> = raw ? JSON.parse(raw) : [];
                    list.push({
                      id: `${Date.now()}-${Math.random()
                        .toString(36)
                        .slice(2, 8)}`,
                      chatId: scheduleCallOpen.chat.id,
                      chatName: scheduleCallOpen.chat.name,
                      title: scheduleCallTitle.trim() || "Group call",
                      at,
                    });
                    localStorage.setItem(KEY, JSON.stringify(list));
                  } catch {
                    /* localStorage unavailable */
                  }
                  setScheduleVersion((v) => v + 1);
                  showToast(
                    `Reminder set for ${new Date(at).toLocaleString()}`,
                    "success",
                  );
                  setScheduleCallOpen(null);
                }}
              >
                Save reminder
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {contextMenu ? (
        <div
          className="fixed inset-0 z-[380]"
          role="presentation"
          onClick={() => setContextMenu(null)}
        >
          <div
            role="menu"
            className="absolute max-h-[min(80vh,420px)] w-56 custom-scrollbar overflow-y-auto rounded-xl border py-2 shadow-2xl"
            style={{
              background: SURFACE,
              borderColor: BORDER_SUB,
              left: Math.min(
                contextMenu.x,
                typeof window !== "undefined"
                  ? window.innerWidth - 230
                  : contextMenu.x,
              ),
              top: Math.min(
                contextMenu.y,
                typeof window !== "undefined"
                  ? window.innerHeight - 320
                  : contextMenu.y,
              ),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {(
              [
                [
                  "Mark as read",
                  () =>
                    updateChatPref(contextMenu.chat.id, {
                      lastReadAt: Date.now(),
                    }),
                ],
                [
                  "Mute",
                  () =>
                    updateChatPref(contextMenu.chat.id, {
                      muted: !chatPrefs[contextMenu.chat.id]?.muted,
                    }),
                ],
                [
                  "Archive",
                  () =>
                    updateChatPref(contextMenu.chat.id, { archived: true }),
                ],
                [
                  "Pin to top",
                  () =>
                    updateChatPref(contextMenu.chat.id, {
                      pinned: !chatPrefs[contextMenu.chat.id]?.pinned,
                    }),
                ],
                [
                  "Clear chat",
                  async () => {
                    const c = contextMenu.chat;
                    if (!db || c.isDemo || c.isBot || c.isAnnouncement) {
                      showToast("Cannot clear this chat", "error");
                      return;
                    }
                    if (
                      !window.confirm("Clear all messages in this chat?")
                    )
                      return;
                    try {
                      await remove(ref(db, `chats/${c.id}/messages`));
                      if (activeChat?.id === c.id) setMessages([]);
                      showToast("Chat cleared", "success");
                    } catch {
                      showToast("Could not clear chat", "error");
                    }
                  },
                ],
                ...(contextMenu.chat.type === "group"
                  ? ([
                      [
                        "Exit group",
                        async () => {
                          const c = contextMenu.chat;
                          if (
                            c.type !== "group" ||
                            !c.group_id ||
                            !user?.id
                          )
                            return;
                          if (!window.confirm("Leave this group?")) return;
                          const r = await apiFetchWithStatus<unknown>(
                            `/groups/${c.group_id}/leave`,
                            {
                              method: "DELETE",
                              signal: masterAbortRef.current?.signal,
                            },
                          );
                          if (r.status === 401) {
                            handleUnauthorized();
                            return;
                          }
                          if (r.status === 204 || r.status === 200) {
                            showToast("You left the group", "success");
                            handleGroupLeft(c.group_id);
                            return;
                          }
                          if (r.status === 400) {
                            showToast(
                              "Settle your balance before leaving this travel group",
                              "error",
                            );
                            return;
                          }
                          showToast("Could not leave group", "error");
                        },
                      ],
                    ] as const)
                  : []),
                [
                  "Report",
                  () => showToast("Report flow coming soon", "success"),
                ],
              ] as const
            ).map(([label, fn]) => (
              <button
                key={label}
                type="button"
                role="menuitem"
                className="block w-full px-4 py-2.5 text-left text-sm text-white hover:bg-white/10"
                onClick={() => {
                  fn();
                  setContextMenu(null);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* Message Context Menu (WhatsApp style) */}
      {messageContextMenu ? (
        <div
          className="fixed inset-0 z-[390]"
          role="presentation"
          onClick={() => setMessageContextMenu(null)}
          onContextMenu={(e) => {
            e.preventDefault();
            setMessageContextMenu(null);
          }}
        >
          <div
            role="menu"
            className="absolute w-48 overflow-hidden rounded-lg border py-1 shadow-2xl"
            style={{
              background: "#ffffff",
              borderColor: "rgba(0,0,0,0.08)",
              left: Math.min(
                messageContextMenu.x,
                typeof window !== "undefined"
                  ? window.innerWidth - 200
                  : messageContextMenu.x,
              ),
              top: Math.min(
                messageContextMenu.y,
                typeof window !== "undefined"
                  ? window.innerHeight - 350
                  : messageContextMenu.y,
              ),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {(
              [
                [
                  "Reply",
                  () => {
                    setReplyingTo(messageContextMenu.message);
                    showToast("Reply mode activated", "success");
                  },
                  true,
                ],
                [
                  "Copy",
                  () => {
                    const text = messageContextMenu.message.text || "";
                    navigator.clipboard.writeText(text).then(() => {
                      showToast("Message copied", "success");
                    });
                  },
                  true,
                ],
                [
                  "Forward",
                  () => {
                    showToast("Forward feature coming soon", "success");
                  },
                  true,
                ],
                [
                  "Pin",
                  () => {
                    showToast("Message pinned", "success");
                  },
                  true,
                ],
                [
                  "Star",
                  () => {
                    showToast("Message starred", "success");
                  },
                  true,
                ],
                [
                  "Add text to note",
                  () => {
                    showToast("Added to notes", "success");
                  },
                  true,
                ],
                [
                  "Select",
                  () => {
                    setSelectMode(true);
                    setSelectedMessages(new Set([messageContextMenu.message.id]));
                    showToast("Select multiple messages", "success");
                  },
                  true,
                ],
                ["divider", null, false],
                [
                  "Report",
                  () => {
                    showToast("Report submitted", "success");
                  },
                  true,
                ],
                [
                  "Delete",
                  () => {
                    if (window.confirm("Delete this message?")) {
                      const msgId = messageContextMenu.message.id;
                      if (activeChat && db) {
                        remove(ref(db, `chats/${activeChat.id}/messages/${msgId}`))
                          .then(() => {
                            showToast("Message deleted", "success");
                          })
                          .catch(() => {
                            showToast("Could not delete message", "error");
                          });
                      }
                    }
                  },
                  true,
                ],
              ] as [string, (() => void) | null, boolean][]
            ).map((item, idx) => {
              if (item[0] === "divider") {
                return (
                  <div
                    key={`divider-${idx}`}
                    className="my-1 h-px"
                    style={{ background: "rgba(0,0,0,0.08)" }}
                  />
                );
              }
              const [label, fn] = item;
              return (
                <button
                  key={label}
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-gray-50"
                  style={{ color: label === "Delete" || label === "Report" ? "#ef4444" : "#111827" }}
                  onClick={() => {
                    fn?.();
                    setMessageContextMenu(null);
                  }}
                >
                  <span className="flex h-5 w-5 items-center justify-center">
                    {label === "Reply" && "↩️"}
                    {label === "Copy" && "📋"}
                    {label === "Forward" && "↪️"}
                    {label === "Pin" && "📌"}
                    {label === "Star" && "⭐"}
                    {label === "Add text to note" && "📝"}
                    {label === "Select" && "☑️"}
                    {label === "Report" && "🚩"}
                    {label === "Delete" && "🗑️"}
                  </span>
                  <span className="font-medium">{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {selectMode && (
        <div
          className="fixed bottom-0 left-0 right-0 z-[395] flex items-center justify-between border-t px-4 py-3"
          style={{
            background: "#ffffff",
            borderColor: "rgba(0,0,0,0.08)",
          }}
        >
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setSelectMode(false);
                setSelectedMessages(new Set());
              }}
              className="rounded-full p-2 hover:bg-gray-100"
            >
              <X className="h-5 w-5" />
            </button>
            <span className="text-sm font-medium">
              {selectedMessages.size} selected
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                showToast("Forward selected messages", "success");
              }}
              className="rounded-lg bg-blue-500 px-3 py-1.5 text-sm text-white hover:bg-blue-600"
            >
              Forward
            </button>
            <button
              onClick={() => {
                if (window.confirm(`Delete ${selectedMessages.size} messages?`)) {
                  if (activeChat && db) {
                    selectedMessages.forEach((msgId) => {
                      remove(ref(db, `chats/${activeChat.id}/messages/${msgId}`));
                    });
                    showToast("Messages deleted", "success");
                  }
                  setSelectMode(false);
                  setSelectedMessages(new Set());
                }
              }}
              className="rounded-lg bg-red-500 px-3 py-1.5 text-sm text-white hover:bg-red-600"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      <WebrtcCallOverlays
        callState={callState}
        callType={currentCall?.callType ?? "audio"}
        currentCall={currentCall}
        isMuted={isMuted}
        isCameraOff={isCameraOff}
        isSpeaker={isSpeaker}
        callDurationSec={callDurationSec}
        endedDisplaySec={endedDisplaySec}
        localVideoRef={localVideoRef}
        remoteVideoRef={remoteVideoRef}
        remoteStream={remoteStream}
        onToggleMute={onCallToggleMute}
        onToggleCamera={onCallToggleCamera}
        onToggleSpeaker={onCallToggleSpeaker}
        onEnd={hangupCall}
        onAccept={acceptIncomingCall}
        onDecline={declineIncomingCall}
        outgoingPeerOnline={outgoingPeerOnline}
        onActiveCallMenuAction={handleActiveCallMenuAction}
      />

      {callAudioOutputDevices && callAudioOutputDevices.length > 0 ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center px-4"
          style={{ background: "rgba(15, 25, 35, 0.75)" }}
          role="dialog"
          aria-modal="true"
          aria-label="Audio output"
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-white/10 p-4 shadow-2xl"
            style={{ background: "#1b2838" }}
          >
            <p className="text-center text-base font-semibold text-white">
              Play call audio through
            </p>
            <p className="mt-1 text-center text-xs" style={{ color: "#8896a0" }}>
              {typeof (HTMLVideoElement.prototype as { setSinkId?: unknown })
                .setSinkId === "function"
                ? callAudioOutputDevices.some((d) =>
                      looksLikeBluetoothAudioDeviceLabel(d.label),
                    )
                  ? "Choose a speaker, phone, or Bluetooth output"
                  : "Choose a speaker or wired output"
                : "Your browser may not support choosing the output device here"}
            </p>
            <ul className="mt-3 max-h-56 space-y-1 overflow-y-auto custom-scrollbar">
              {callAudioOutputDevices.map((d) => (
                <li key={d.deviceId}>
                  <button
                    type="button"
                    className="w-full rounded-xl px-3 py-2.5 text-left text-sm text-white hover:bg-white/10"
                    onClick={async () => {
                      const el = remoteVideoRef.current;
                      if (!el) return;
                      try {
                        await (
                          el as HTMLVideoElement & {
                            setSinkId: (id: string) => Promise<void>;
                          }
                        ).setSinkId(d.deviceId);
                        showCallToast(
                          d.label && d.label !== ""
                            ? `Output: ${d.label}`
                            : "Output device updated",
                        );
                      } catch {
                        showCallToast("Could not set audio output on this device");
                      }
                      setCallAudioOutputDevices(null);
                    }}
                  >
                    {d.label && d.label !== "" ? d.label : "Default speaker"}
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="mt-3 w-full rounded-xl py-2.5 text-sm font-medium text-white/90 hover:bg-white/10"
              onClick={() => setCallAudioOutputDevices(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div
          className={
            toast.callStyle
              ? "animate-in fade-in slide-in-from-bottom-4 fixed bottom-6 left-1/2 z-[300] max-w-sm -translate-x-1/2 duration-200"
              : `fixed right-4 top-20 z-[300] max-w-sm animate-in rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg ${
                  toast.type === "success" ? "bg-green-600" : "bg-red-600"
                }`
          }
          style={
            toast.callStyle
              ? {
                  background: "#1e2a3a",
                  color: "#e9edef",
                  border: "1px solid #f0a500",
                  borderRadius: 8,
                  padding: "10px 16px",
                  fontSize: 14,
                  fontWeight: 500,
                }
              : undefined
          }
        >
          {toast.message}
        </div>
      ) : null}
    </div>
  );
}

function ChatHeader({
  chat,
  onBack,
  groups,
  dmPeerIsOnline,
  onDmHeaderClick,
  onOpenGroupInfo,
  onMuteChat,
  onSearchInChat,
  onClearChat,
  onBlockPeer,
  onLeaveGroup,
  onReport,
  onDmVoiceCall,
  onDmVideoCall,
  onDmSchedule,
  groupTrip,
  groupTripLoading,
  onGroupVoice,
  onGroupVideoCall,
  onGroupSchedule,
}: {
  chat: ChatInfo;
  onBack: () => void;
  groups: GroupOut[];
  /** DM only: peer `presence/{id}/online` (null = unknown) */
  dmPeerIsOnline: boolean | null;
  onDmHeaderClick: () => void;
  onOpenGroupInfo: () => void;
  onMuteChat: () => void;
  onSearchInChat: () => void;
  onClearChat: () => void;
  onBlockPeer: () => void;
  onLeaveGroup: () => void;
  onReport: () => void;
  onDmVoiceCall: () => void;
  onDmVideoCall: () => void;
  onDmSchedule: () => void;
  /** Travel group: first trip for header subtitle & pill (null = none / still loading) */
  groupTrip: TripOut | null;
  groupTripLoading: boolean;
  onGroupVoice: () => void;
  onGroupVideoCall: () => void;
  onGroupSchedule: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuWrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      const el = menuWrapRef.current;
      if (el && !el.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  const g = chat.group_id
    ? groups.find((x) => x.id === chat.group_id)
    : undefined;
  const memberCount = g?.members?.length ?? chat.members?.length ?? 0;
  const headerTitle = chatRowDisplayName(chat);
  const dmHeaderAvatar =
    chat.type === "individual" ? chatRowDmAvatarUrl(chat) : null;
  const isTravelGroup = (g?.group_type ?? "regular") === "travel";
  const groupIni = initialsFromName(headerTitle);
  const groupBg = listAvatarColor(headerTitle);
  const tripPill = groupTrip && isTravelGroup ? groupTripStatusPill(groupTrip) : null;

  const headerMainClick = () => {
    if (chat.type === "group") onOpenGroupInfo();
    else onDmHeaderClick();
  };

  if (chat.type === "group") {
    return (
      <header
        className="shrink-0 border-b"
        style={{
          borderColor: "rgba(255,255,255,0.08)",
          background: WA_HEADER_GROUP,
        }}
      >
        <div className="flex items-center gap-2 px-2 py-2.5 md:px-3">
          <button
            type="button"
            className="shrink-0 text-xl text-white md:hidden"
            onClick={onBack}
            aria-label="Back"
          >
            <ThIconChevronLeft size={22} className="text-white" />
          </button>
          <div
            role="button"
            tabIndex={0}
            onClick={headerMainClick}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                headerMainClick();
              }
            }}
            className="flex min-w-0 flex-1 cursor-pointer items-start gap-2.5 text-left"
          >
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
              style={{ background: groupBg, minWidth: 40, minHeight: 40 }}
            >
              {groupIni}
            </span>
            <div className="min-w-0 flex-1">
              <p className="inline-flex min-w-0 max-w-full items-center gap-0.5 truncate text-[15px] font-semibold" style={{ color: WA_TEXT }}>
                <span className="truncate">{headerTitle}</span>
                {isTravelGroup ? (
                  <span className="inline-flex shrink-0" style={{ color: WA_CORAL }}>
                    <ThIconPlane size={14} className="text-current" />
                  </span>
                ) : null}
              </p>
              {isTravelGroup ? (
                <>
                  <p
                    className="mt-0.5 line-clamp-2 text-[12px] leading-tight"
                    style={{ color: WA_MUTED }}
                  >
                    {memberCount} {memberCount === 1 ? "member" : "members"} ·{" "}
                    {groupTripLoading
                      ? "…"
                      : groupTrip
                        ? formatTripHeaderDates(groupTrip)
                        : "No trip linked"}
                  </p>
                  {groupTrip && tripPill ? (
                    <p
                      className="mt-1 inline-flex max-w-full items-center gap-1.5 rounded-lg px-2 py-0.5 text-[10px] font-bold leading-snug"
                      style={{ background: tripPill.bg, color: WA_TEXT }}
                    >
                      <ThStatusDot color={tripPill.dotColor} />
                      <span>{tripPill.text}</span>
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="mt-0.5 w-full text-[12px]">
                  <span style={{ color: WA_MUTED }}>{memberCount} members · </span>
                  <span style={{ color: WA_TEXT }}>tap for info</span>
                </p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded hover:bg-white/10"
              style={{ color: TH_MUTED }}
              aria-label="Search"
              onClick={onSearchInChat}
            >
              <ThIconSearch size={20} className="text-current" />
            </button>
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded hover:bg-white/10"
              style={{ color: TH_MUTED }}
              aria-label="Voice"
              onClick={onGroupVoice}
            >
              <ThIconPhoneHandset size={20} className="text-current" />
            </button>
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded hover:bg-white/10"
              style={{ color: TH_MUTED }}
              aria-label="Video"
              onClick={onGroupVideoCall}
            >
              <Video className="h-5 w-5" strokeWidth={1.5} />
            </button>
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded hover:bg-white/10"
              style={{ color: TH_MUTED }}
              aria-label="Schedule a call"
              onClick={onGroupSchedule}
            >
              <Calendar className="h-5 w-5" strokeWidth={1.5} />
            </button>
            <div className="relative" ref={menuWrapRef}>
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded text-slate-300 hover:bg-white/10"
                style={{ color: TH_MUTED }}
                aria-label="Menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((o) => !o)}
              >
                <ThIconMoreDots size={20} className="text-current" />
              </button>
              {menuOpen ? (
                <div
                  className="absolute right-0 top-full z-[120] mt-1 min-w-[12rem] overflow-hidden rounded-lg border py-1 shadow-xl"
                  style={{
                    background: SURFACE,
                    borderColor: BORDER_SUB,
                  }}
                >
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-white hover:bg-white/10"
                    onClick={() => {
                      setMenuOpen(false);
                      onSearchInChat();
                    }}
                  >
                    <Search className="h-4 w-4 shrink-0 opacity-80" />
                    Search
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-white hover:bg-white/10"
                    onClick={() => {
                      setMenuOpen(false);
                      onMuteChat();
                    }}
                  >
                    <BellOff className="h-4 w-4 shrink-0 opacity-80" />
                    Mute
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-white hover:bg-white/10"
                    onClick={() => {
                      setMenuOpen(false);
                      onOpenGroupInfo();
                    }}
                  >
                    <Users className="h-4 w-4 shrink-0 opacity-80" />
                    Group Info
                  </button>
                  <button
                    type="button"
                    className="w-full px-3 py-2.5 text-left text-sm font-medium text-red-400 hover:bg-white/10"
                    onClick={() => {
                      setMenuOpen(false);
                      onReport();
                    }}
                  >
                    Report
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header
      className="flex shrink-0 items-center gap-3 border-b px-3 py-3 md:px-4"
      style={{ borderColor: BORDER_SUB, background: BG }}
    >
      <button
        type="button"
        className="text-xl text-white md:hidden"
        onClick={onBack}
        aria-label="Back"
      >
        <ThIconChevronLeft size={22} className="text-white" />
      </button>
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
        onClick={headerMainClick}
      >
        {dmHeaderAvatar ? (
          <img
            src={dmHeaderAvatar}
            alt=""
            className="h-10 w-10 shrink-0 rounded-full object-cover"
            width={40}
            height={40}
          />
        ) : (
          <InitialsAvatar name={headerTitle} size={40} />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium text-white">
            {headerTitle}
          </p>
          <p
            className="flex min-w-0 items-center gap-1.5 text-[12px]"
            style={{ color: TEXT_MUTED }}
          >
            {dmPeerIsOnline === true ? (
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ background: ONLINE }}
                aria-hidden
              />
            ) : (
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full bg-slate-500"
                aria-hidden
              />
            )}
            {dmPeerIsOnline === true ? "Active now" : "Last seen recently"}
          </p>
        </div>
      </button>
      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          className="rounded p-1.5 text-white hover:bg-white/10"
          aria-label="Voice call"
          onClick={onDmVoiceCall}
        >
          <Phone className="h-5 w-5" strokeWidth={1.5} />
        </button>
        <button
          type="button"
          className="rounded p-1.5 text-white hover:bg-white/10"
          aria-label="Video call"
          onClick={onDmVideoCall}
        >
          <Video className="h-5 w-5" strokeWidth={1.5} />
        </button>
        <button
          type="button"
          className="rounded p-1.5 text-white hover:bg-white/10"
          aria-label="Schedule a call"
          onClick={onDmSchedule}
        >
          <Calendar className="h-5 w-5" strokeWidth={1.5} />
        </button>
      </div>
      <div className="relative flex shrink-0 items-center" ref={menuWrapRef}>
        <button
          type="button"
          className="rounded p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
          aria-label="Chat menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
        >
          <MoreVertical className="h-6 w-6" strokeWidth={1.5} />
        </button>
        {menuOpen ? (
          <div
            className="absolute right-0 top-full z-[120] mt-1 min-w-[14rem] overflow-hidden rounded-lg border py-1 shadow-xl"
            style={{
              background: SURFACE,
              borderColor: BORDER_SUB,
            }}
          >
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-white hover:bg-white/10"
              onClick={() => {
                setMenuOpen(false);
                onDmHeaderClick();
              }}
            >
              <User className="h-4 w-4 shrink-0 opacity-80" />
              View Profile
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-white hover:bg-white/10"
              onClick={() => {
                setMenuOpen(false);
                onMuteChat();
              }}
            >
              <BellOff className="h-4 w-4 shrink-0 opacity-80" />
              Mute notifications
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-white hover:bg-white/10"
              onClick={() => {
                setMenuOpen(false);
                onSearchInChat();
              }}
            >
              <Search className="h-4 w-4 shrink-0 opacity-80" />
              Search in chat
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-white hover:bg-white/10"
              onClick={() => {
                setMenuOpen(false);
                onDmSchedule();
              }}
            >
              <Calendar className="h-4 w-4 shrink-0 opacity-80" />
              Schedule a call
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-white hover:bg-white/10"
              onClick={() => {
                setMenuOpen(false);
                void onClearChat();
              }}
            >
              <Trash2 className="h-4 w-4 shrink-0 opacity-80" />
              Clear chat
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-red-300 hover:bg-white/10"
              onClick={() => {
                setMenuOpen(false);
                void onBlockPeer();
              }}
            >
              <Ban className="h-4 w-4 shrink-0 opacity-80" />
              Block user
            </button>
            <button
              type="button"
              className="w-full px-3 py-2.5 text-left text-sm font-medium text-red-500 hover:bg-white/10"
              onClick={() => {
                setMenuOpen(false);
                onReport();
              }}
            >
              Report
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}

function GroupMessageBubble({
  msg,
  mine,
  isTravelGroup,
  showAvatar,
  showName,
  readState,
  selectMode,
  isSelected,
  onToggleSelect,
}: {
  msg: ChatMessage;
  mine: boolean;
  isTravelGroup: boolean;
  showAvatar: boolean;
  showName: boolean;
  readState: "sent" | "delivered" | "read";
  selectMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}) {
  const meta = (msg.metadata || {}) as Record<string, unknown>;
  const t = String(msg.type || "text").toLowerCase();
  const timeStr = new Date(msg.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const name = (msg.sender_name || "?").trim();
  const senderIni = initialsFromName(name);
  const senderBg = listAvatarColor(name);

  if (t === "poll" && meta?.question != null) {
    const options = (meta.options as { label: string; votes: number }[]) ?? [];
    return (
      <div
        className={`mb-1.5 flex w-full items-end gap-1.5 ${mine ? "justify-end" : "justify-start"}`}
      >
        {!mine && showAvatar ? (
          <span
            className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
            style={{ background: senderBg }}
          >
            {senderIni}
          </span>
        ) : !mine ? (
          <span className="w-7 shrink-0" aria-hidden />
        ) : null}
        <div
          className="max-w-[min(100%,20rem)] rounded-xl border px-3 py-2"
          style={{
            background: "rgba(99,102,241,0.1)",
            borderColor: "rgba(99,102,241,0.35)",
          }}
        >
          {showName && !mine ? (
            <p className="mb-1 text-[11px] font-bold" style={{ color: WA_CORAL }}>
              {name}
            </p>
          ) : null}
          <p className="flex items-center gap-1 text-[11px] font-bold" style={{ color: "#a5b4fc" }}>
            <BarChart2 className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
            POLL
          </p>
          <p className="text-sm" style={{ color: WA_TEXT }}>
            {String(meta.question ?? msg.text ?? "")}
          </p>
          {options.length > 0 ? (
            <ul className="mt-1 space-y-0.5 text-xs" style={{ color: WA_MUTED }}>
              {options.map((o, i) => (
                <li key={i}>
                  {o.label} · {o.votes} vote{o.votes === 1 ? "" : "s"}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-1 flex items-center justify-between text-[10px]" style={{ color: WA_MUTED }}>
            <button type="button" className="text-indigo-300">
              Vote Now
            </button>
            <span>Closes 8PM</span>
          </div>
          <p className="mt-0.5 text-right text-[10px]" style={{ color: WA_MUTED }}>
            {timeStr}
          </p>
        </div>
      </div>
    );
  }

  if (t === "location" || t === "live_location") {
    return (
      <div
        className={`mb-1.5 flex w-full items-end gap-1.5 ${mine ? "justify-end" : "justify-start"}`}
      >
        {!mine && showAvatar ? (
          <span
            className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
            style={{ background: senderBg }}
          >
            {senderIni}
          </span>
        ) : !mine ? (
          <span className="w-7 shrink-0" aria-hidden />
        ) : null}
        <div
          className="max-w-[min(100%,20rem)] rounded-xl border px-3 py-2"
          style={{
            background: "rgba(59,130,246,0.1)",
            borderColor: "rgba(59,130,246,0.35)",
          }}
        >
          {showName && !mine ? (
            <p className="mb-1 text-[11px] font-bold" style={{ color: WA_CORAL }}>
              {name}
            </p>
          ) : null}
          <p className="flex items-center gap-1.5 text-sm" style={{ color: WA_TEXT }}>
            <MapPin className="h-4 w-4 shrink-0 text-[#9ca3af]" strokeWidth={1.5} aria-hidden />
            <span>
              {name} shared live location
            </span>
          </p>
          <button
            type="button"
            className="mt-1 text-xs font-semibold"
            style={{ color: "#60a5fa" }}
            onClick={() => {
              if (meta.lat != null && meta.lon != null) {
                globalThis.open(
                  `https://www.google.com/maps?q=${String(meta.lat)},${String(meta.lon)}`,
                  "_blank",
                );
              } else globalThis.alert("No map coordinates in this message");
            }}
          >
            View on Map
          </button>
          <p className="mt-0.5 text-right text-[10px]" style={{ color: WA_MUTED }}>
            {timeStr}
          </p>
        </div>
      </div>
    );
  }

  if (
    (t === "expense" || t === "split") &&
    isTravelGroup
  ) {
    const title =
      (meta.title as string) ||
      (meta.description as string) ||
      (msg.text as string) ||
      "Expense";
    const amount = meta.amount;
    const paidBy = (meta.paid_by_name as string) || (meta.paidBy as string) || "—";
    const yourShare = meta.your_share ?? meta.yourShare;
    return (
      <div
        className={`mb-1.5 flex w-full items-end gap-1.5 ${mine ? "justify-end" : "justify-start"}`}
      >
        {!mine && showAvatar ? (
          <span
            className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
            style={{ background: senderBg }}
          >
            {senderIni}
          </span>
        ) : !mine ? (
          <span className="w-7 shrink-0" aria-hidden />
        ) : null}
        <div
          className="max-w-[min(100%,20rem)] rounded-xl border px-3 py-2"
          style={{
            background: "rgba(29,158,117,0.1)",
            border: "1px solid rgba(29,158,117,0.3)",
          }}
        >
          {showName && !mine ? (
            <p className="mb-1 text-[11px] font-bold" style={{ color: WA_CORAL }}>
              {name}
            </p>
          ) : null}
          <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: WA_GREEN }}>
            Expense added
          </p>
          <p className="text-sm font-medium" style={{ color: WA_TEXT }}>
            {title}
          </p>
          <p className="text-sm" style={{ color: WA_TEXT }}>
            {amount != null ? `₹${Number(amount).toLocaleString()}` : ""}
            {amount != null ? " · " : ""}Paid by {paidBy}
          </p>
          {yourShare != null ? (
            <p className="text-sm" style={{ color: WA_MUTED }}>
              Your share: ₹{Number(yourShare).toLocaleString()}
            </p>
          ) : null}
          <button
            type="button"
            className="mt-2 w-full rounded-lg border border-[#1d9e75] py-1.5 text-xs font-bold"
            style={{ color: WA_GREEN, background: "transparent" }}
            onClick={() => globalThis.alert("Split details: coming soon in travel hub")}
          >
            View Split Details
          </button>
          <p className="mt-0.5 text-right text-[10px]" style={{ color: WA_MUTED }}>
            {timeStr}
          </p>
        </div>
      </div>
    );
  }

  const bubble = (
    <div
      className="max-w-[min(100%,20rem)] px-3 py-1.5"
      style={{
        background: mine ? WA_OUTGOING_BUBBLE : WA_INCOMING_BUBBLE,
        boxShadow: "0 1px 0.5px rgba(0,0,0,0.08)",
        borderRadius: mine
          ? "7.5px 0px 7.5px 7.5px"
          : "0px 7.5px 7.5px 7.5px",
      }}
    >
      {showName && !mine ? (
        <p className="mb-0.5 text-[11px] font-bold" style={{ color: WA_CORAL }}>
          {name}
        </p>
      ) : null}
      {t === "gif" && msg.text ? (
        <img
          src={String(msg.text)}
          alt=""
          className="max-w-[240px] rounded-[8px]"
        />
      ) : t === "image" && meta?.url ? (
        <img
          src={String(meta.url)}
          alt=""
          className="max-h-60 max-w-full rounded-lg"
        />
      ) : t === "audio" ? (
        <div className="flex items-center gap-2 text-sm" style={{ color: BUBBLE_TEXT }}>
          <Play className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden />
          <span
            className="h-2 flex-1 rounded"
            style={{ background: "rgba(26,26,46,0.12)" }}
          />
        </div>
      ) : (
        <p
          className="whitespace-pre-wrap break-words text-sm leading-relaxed"
          style={{ color: BUBBLE_TEXT }}
        >
          {msg.text}
        </p>
      )}
      <div
        className="mt-0.5 flex items-center justify-end gap-0.5 text-[10px]"
        style={{ color: BUBBLE_TS }}
      >
        <span className="tabular-nums">{timeStr}</span>
        {mine ? (
          <span
            className="inline-flex shrink-0 items-center"
            style={{
              color: readState === "read" ? WA_CORAL : BUBBLE_TS,
            }}
            aria-hidden
            title={readState === "read" ? "Read" : "Delivered"}
          >
            {readState === "read" || readState === "delivered" ? (
              <CheckCheck className="h-3.5 w-3.5" strokeWidth={2.5} />
            ) : (
              <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
            )}
          </span>
        ) : null}
      </div>
    </div>
  );

  return (
    <div
      className={`mb-0.5 flex w-full min-w-0 items-end gap-1.5 ${mine ? "justify-end" : "justify-start"}`}
    >
      {selectMode ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect?.();
          }}
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded border-2 ${
            isSelected
              ? "border-blue-500 bg-blue-500"
              : "border-gray-400 bg-transparent"
          }`}
        >
          {isSelected && <Check className="h-4 w-4 text-white" />}
        </button>
      ) : null}
      {!mine && showAvatar ? (
        <span
          className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
          style={{ background: senderBg }}
        >
          {senderIni}
        </span>
      ) : !mine ? (
        <span className="w-7 shrink-0" aria-hidden />
      ) : null}
      {bubble}
    </div>
  );
}

function MessageBubble({
  msg,
  mine,
  isGroup,
  readReceipt,
  dmPeerAvatarUrl,
  dmPeerDisplayName,
  selectMode,
  isSelected,
  onToggleSelect,
}: {
  msg: ChatMessage;
  mine: boolean;
  isGroup: boolean;
  readReceipt: "none" | "sent" | "read";
  /** Other user in 1:1 (for avatar when !mine) */
  dmPeerAvatarUrl: string | null;
  dmPeerDisplayName: string;
  selectMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}) {
  const meta = msg.metadata as Record<string, unknown> | undefined;

  const otherPhotoUrl = (() => {
    if (isGroup) {
      const sa = msg.sender_avatar?.trim();
      if (
        sa &&
        !isInlineSvgDataUrlToSkipForPhoto(sa) &&
        !isLegacyDicebearUrl(sa)
      ) {
        return sa;
      }
      return null;
    }
    const dm = dmPeerAvatarUrl?.trim();
    if (dm && !isInlineSvgDataUrlToSkipForPhoto(dm) && !isLegacyDicebearUrl(dm)) {
      return dm;
    }
    return null;
  })();
  const otherInitialsName = isGroup
    ? msg.sender_name || "?"
    : dmPeerDisplayName || "?";

  return (
    <div
      className={`mb-2 flex w-full items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}
    >
      {selectMode ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect?.();
          }}
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded border-2 ${
            isSelected
              ? "border-blue-500 bg-blue-500"
              : "border-gray-400 bg-transparent"
          }`}
        >
          {isSelected && <Check className="h-4 w-4 text-white" />}
        </button>
      ) : null}
      {!mine ? (
        otherPhotoUrl ? (
          <img
            src={otherPhotoUrl}
            alt=""
            className="h-8 w-8 shrink-0 rounded-full object-cover"
            width={32}
            height={32}
          />
        ) : (
          <InitialsAvatar name={otherInitialsName} size={32} />
        )
      ) : null}
      <div
        className={`flex min-w-0 max-w-[70%] flex-col ${mine ? "items-end" : "items-start"}`}
      >
        {isGroup && !mine ? (
          <p
            className="mb-0.5 text-[11px] font-semibold"
            style={{ color: BUBBLE_SENDER_CORAL }}
          >
            {msg.sender_name}
          </p>
        ) : null}
        <div
          className="px-3 py-2"
          style={{
            background: mine ? WA_OUTGOING_BUBBLE : WA_INCOMING_BUBBLE,
            boxShadow: "0 1px 0.5px rgba(0,0,0,0.08)",
            borderRadius: mine
              ? "7.5px 0px 7.5px 7.5px"
              : "0px 7.5px 7.5px 7.5px",
            border: mine ? "none" : "1px solid rgba(0,0,0,0.06)",
          }}
        >
          {msg.type === "split" ? (
            <div
              className="min-w-[200px] max-w-[min(100%,280px)] rounded-xl border-2 px-3 py-3"
              style={{
                borderColor: BUBBLE_SENDER_CORAL,
                background: "rgba(255,127,80,0.1)",
              }}
            >
              <div
                className="mb-1.5 flex items-center justify-between gap-2"
                style={{ color: BUBBLE_SENDER_CORAL }}
              >
                <span className="inline-flex text-[#9ca3af]" aria-hidden>
                  <Banknote className="h-5 w-5" strokeWidth={1.5} />
                </span>
                <div className="min-w-0 text-right">
                  <span className="text-base font-bold tabular-nums">
                    {(() => {
                      const code = String(
                        (meta as { currency?: string } | undefined)
                          ?.currency ?? "USD",
                      );
                      const sym = CURRENCY_SYMBOLS[code] ?? "$";
                      const raw = (meta as { amount?: number } | undefined)
                        ?.amount;
                      const n =
                        typeof raw === "number" ? raw : parseFloat(String(raw));
                      if (!Number.isFinite(n)) return "—";
                      return `${sym}${n.toFixed(2)}`;
                    })()}
                  </span>{" "}
                  <span
                    className="text-[10px] font-medium opacity-80"
                    style={{ color: TEXT_MUTED }}
                  >
                    {String(
                      (meta as { currency?: string } | undefined)?.currency ??
                        "USD",
                    )}
                  </span>
                </div>
              </div>
              {msg.text ? (
                <p
                  className="text-sm leading-snug"
                  style={{ color: BUBBLE_TEXT }}
                >
                  {msg.text}
                </p>
              ) : null}
              {meta && (meta as { split_equally?: boolean }).split_equally ? (
                <p
                  className="mt-1.5 text-[10px] font-semibold uppercase tracking-wide"
                  style={{ color: BUBBLE_SENDER_CORAL }}
                >
                  Split equally
                </p>
              ) : null}
            </div>
          ) : null}
          {msg.type === "gif" && msg.text ? (
            <img
              src={String(msg.text)}
              alt=""
              className="max-w-[240px] rounded-[8px]"
            />
          ) : null}
          {!msg.type || msg.type === "text" ? (
            <p className="text-sm" style={{ color: BUBBLE_TEXT }}>
              {msg.text}
            </p>
          ) : null}
          {msg.type === "image" && meta?.url ? (
            <img
              src={String(meta.url)}
              alt=""
              className="max-h-60 max-w-[250px] rounded-xl"
            />
          ) : null}
          {msg.type === "location" ? (
            <div>
              <p
                className="flex items-start gap-1.5 text-sm"
                style={{ color: BUBBLE_TEXT }}
              >
                <MapPin
                  className="mt-0.5 h-4 w-4 shrink-0"
                  style={{ color: BUBBLE_TS }}
                  strokeWidth={1.5}
                  aria-hidden
                />
                <span>{msg.text}</span>
              </p>
              <p className="text-[11px]" style={{ color: BUBBLE_TS }}>
                {meta?.lat != null && meta?.lon != null
                  ? `${meta.lat}, ${meta.lon}`
                  : ""}
              </p>
              <Link
                href={`/map?lat=${String(meta?.lat ?? "")}&lon=${String(meta?.lon ?? "")}`}
                className="mt-1 inline-block text-xs font-bold"
                style={{ color: ACCENT }}
              >
                Open in Map
              </Link>
            </div>
          ) : null}
          {msg.type === "expense" ? (
            <div>
              <p className="text-sm" style={{ color: BUBBLE_TEXT }}>
                {String(meta?.description ?? msg.text)}
              </p>
              <p className="font-bold" style={{ color: ACCENT }}>
                {meta?.amount != null ? String(meta.amount) : ""}
              </p>
              <Link
                href="/split-activities"
                className="text-xs font-bold text-sky-400"
              >
                View Details
              </Link>
            </div>
          ) : null}
          {msg.type === "trip" ? (
            <div>
              <p
                className="flex items-center gap-1.5 text-sm"
                style={{ color: BUBBLE_TEXT }}
              >
                <ThIconPlane
                  size={16}
                  className="shrink-0 text-[#8896a0]"
                />
                <span>{String(meta?.trip_name ?? msg.text)}</span>
              </p>
              <p className="text-[11px]" style={{ color: BUBBLE_TS }}>
                {String(meta?.destination ?? "")}
              </p>
              <p className="text-[11px]" style={{ color: BUBBLE_TS }}>
                {String(meta?.dates ?? "")}
              </p>
              <Link
                href={`/trips/${String(meta?.trip_id ?? "")}`}
                className="text-xs font-bold"
                style={{ color: ACCENT }}
              >
                View Trip
              </Link>
            </div>
          ) : null}
          {msg.type === "audio" ? (
            <div
              className="flex items-center gap-2 text-sm"
              style={{ color: BUBBLE_TEXT }}
            >
              <Play
                className="h-4 w-4 shrink-0"
                style={{ color: BUBBLE_TS }}
                strokeWidth={1.5}
                aria-hidden
              />
              <span
                className="h-8 flex-1 rounded"
                style={{ background: "rgba(26,26,46,0.1)" }}
              />
              <span className="text-[11px]" style={{ color: BUBBLE_TS }}>
                {String(meta?.duration ?? "")}
              </span>
            </div>
          ) : null}
          <div
            className={`mt-1 flex items-center gap-1 text-[10px] ${mine ? "justify-end" : "justify-start"}`}
            style={{ color: BUBBLE_TS }}
          >
            <span>
              {new Date(msg.timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            {mine && readReceipt !== "none" ? (
              <span
                className="inline-flex shrink-0 items-center"
                title={readReceipt === "read" ? "Read" : "Sent"}
                aria-hidden
              >
                {readReceipt === "read" ? (
                  <CheckCheck
                    className="h-3.5 w-3.5"
                    style={{ color: BUBBLE_TS }}
                    strokeWidth={1.5}
                  />
                ) : (
                  <Check
                    className="h-3.5 w-3.5"
                    style={{ color: BUBBLE_TS }}
                    strokeWidth={1.5}
                  />
                )}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function AttachMenu({
  trips,
  onClose,
  onPickImage,
  onLocation,
  onExpense,
  onTrip,
  onLiveLocation,
  onAudio,
}: {
  trips: TripOut[];
  onClose: () => void;
  onPickImage: (b64: string) => void;
  onLocation: (lat: number, lon: number, name: string) => void;
  onExpense: () => void;
  onTrip: (t: TripOut) => void;
  onLiveLocation: () => void;
  onAudio: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [showTrips, setShowTrips] = useState(false);

  return (
    <div
      className="mx-3 mb-2 rounded-t-2xl border p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.4)]"
      style={{ borderColor: MSG_BORDER, background: SURFACE }}
    >
      <p
        className="mb-3 text-[12px] font-bold uppercase"
        style={{ color: TEXT_MUTED }}
      >
        Share
      </p>
      <div className="grid grid-cols-3 gap-3">
        <label className="flex cursor-pointer flex-col items-center gap-1">
          <span
            className="flex h-14 w-14 items-center justify-center rounded-full border text-white"
            style={{ background: "#1e2538", borderColor: "rgba(255,255,255,0.12)" }}
          >
            <Camera className="h-6 w-6" strokeWidth={1.5} />
          </span>
          <span className="text-[11px] text-slate-200">Photo</span>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const r = new FileReader();
              r.onload = () => onPickImage(String(r.result));
              r.readAsDataURL(f);
              onClose();
            }}
          />
        </label>
        <button
          type="button"
          className="flex flex-col items-center gap-1"
          onClick={() => {
            onAudio();
            onClose();
          }}
        >
          <span
            className="flex h-14 w-14 items-center justify-center rounded-full border text-white"
            style={{ background: "#1e2538", borderColor: "rgba(255,255,255,0.12)" }}
          >
            <Music className="h-6 w-6" strokeWidth={1.5} />
          </span>
          <span className="text-[11px] text-slate-200">Audio</span>
        </button>
        <button
          type="button"
          className="flex flex-col items-center gap-1"
          onClick={() => {
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                onLocation(
                  pos.coords.latitude,
                  pos.coords.longitude,
                  "My Location",
                );
                onClose();
              },
              () => {},
            );
          }}
        >
          <span
            className="flex h-14 w-14 items-center justify-center rounded-full border text-white"
            style={{ background: "#1e2538", borderColor: "rgba(255,255,255,0.12)" }}
          >
            <MapPin className="h-6 w-6" strokeWidth={1.5} />
          </span>
          <span className="text-[11px] text-slate-200">Location</span>
        </button>
        <button
          type="button"
          className="flex flex-col items-center gap-1"
          onClick={() => {
            onExpense();
            onClose();
          }}
        >
          <span
            className="flex h-14 w-14 items-center justify-center rounded-full border text-white"
            style={{ background: "#1e2538", borderColor: "rgba(255,255,255,0.12)" }}
          >
            <Banknote className="h-6 w-6" strokeWidth={1.5} />
          </span>
          <span className="text-[11px] text-slate-200">Split Expense</span>
        </button>
        <button
          type="button"
          className="flex flex-col items-center gap-1"
          onClick={() => setShowTrips((s) => !s)}
        >
          <span
            className="flex h-14 w-14 items-center justify-center rounded-full border text-white"
            style={{ background: "#1e2538", borderColor: "rgba(255,255,255,0.12)" }}
          >
            <ThIconPlane size={24} className="text-[#9ca3af]" />
          </span>
          <span className="text-[11px] text-slate-200">Trip</span>
        </button>
        <button
          type="button"
          className="flex flex-col items-center gap-1"
          onClick={() => {
            onLiveLocation();
            onClose();
          }}
        >
          <span
            className="flex h-14 w-14 items-center justify-center rounded-full border text-white"
            style={{ background: "#1e2538", borderColor: "rgba(255,255,255,0.12)" }}
          >
            <MapIcon className="h-6 w-6" strokeWidth={1.5} />
          </span>
          <span className="text-[11px] text-slate-200">Live Location</span>
        </button>
      </div>
      {showTrips ? (
        <ul
          className="mt-3 max-h-32 custom-scrollbar overflow-y-auto rounded-lg border p-2 text-sm"
          style={{ borderColor: MSG_BORDER, background: BG }}
        >
          {trips.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                className="w-full py-1 text-left text-slate-200 hover:underline"
                onClick={() => {
                  onTrip(t);
                  onClose();
                }}
              >
                {t.title}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <button
        type="button"
        onClick={onClose}
        className="mt-3 w-full py-1 text-center text-xs"
        style={{ color: TEXT_MUTED }}
      >
        Close
      </button>
    </div>
  );
}

function NewChatOverlay({
  contacts,
  onClose,
  onPick,
}: {
  contacts: ContactPerson[];
  onClose: () => void;
  onPick: (p: ContactPerson) => void;
}) {
  const [q, setQ] = useState("");
  const filtered = contacts.filter((c) =>
    c.full_name.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col"
      style={{ background: BG }}
    >
      <div
        className="flex items-center gap-3 border-b px-3 py-3"
        style={{ borderColor: BORDER_SUB }}
      >
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-9 w-9 items-center justify-center text-white"
        >
          <ThIconChevronLeft size={22} className="text-white" />
        </button>
        <span className="font-bold text-white">New Chat</span>
      </div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search people..."
        className="mx-4 mt-3 rounded-full border px-4 py-2 text-sm text-white outline-none placeholder:text-slate-500"
        style={{ borderColor: MSG_BORDER, background: SURFACE }}
      />
      <div className="mt-4 px-4">
        <button
          type="button"
          className="mb-4 inline-flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white"
          style={{ background: ACCENT }}
        >
          <Users className="h-5 w-5" strokeWidth={1.5} />
          New Group Chat
        </button>
      </div>
      <ul className="flex-1 custom-scrollbar overflow-y-auto px-4">
            {filtered.map((c) => {
          const cPhoto =
            c.avatar_url &&
            c.avatar_url.trim() &&
            !isInlineSvgDataUrlToSkipForPhoto(c.avatar_url) &&
            !isLegacyDicebearUrl(c.avatar_url)
              ? c.avatar_url
              : null;
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onPick(c)}
                className="flex w-full items-center gap-3 py-3 text-left"
              >
                {cPhoto ? (
                  <img
                    src={cPhoto}
                    alt=""
                    className="h-10 w-10 rounded-full object-cover"
                    width={40}
                    height={40}
                  />
                ) : (
                  <InitialsAvatar name={c.full_name} size={40} />
                )}
                <span className="font-semibold text-white">{c.full_name}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
