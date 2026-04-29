"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getDatabase,
  ref,
  push,
  onValue,
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
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
  type TouchEvent,
} from "react";

import { apiFetchWithStatus } from "@/lib/api";
import { clearToken } from "@/lib/auth";
import {
  ArrowLeft,
  Banknote,
  BellOff,
  Camera,
  Check,
  CheckCheck,
  Flag,
  Map as MapIcon,
  MapPin,
  MessageCircle,
  Mic,
  MoreVertical,
  Paperclip,
  PenSquare,
  Phone,
  PhoneCall,
  Plane,
  Search,
  Send,
  Settings,
  Shield,
  Star,
  UserPlus,
  Users,
  Video,
  X,
} from "lucide-react";

/** Travello dark navy + crimson (not indigo) */
const BG = "#0F172A";
const SURFACE = "#1E293B";
const BORDER_SUB = "#1E293B";
const TEXT = "#FFFFFF";
const TEXT_MUTED = "#64748B";
const TEXT_SECONDARY = "#94A3B8";
const SECTION_LABEL = "#475569";
const ACCENT = "#DC2626";
const ONLINE = "#22C55E";
const RIGHT_PANEL_BG = "#0A0F1E";

const CHAT_PREFS_KEY = "travelhub_chat_prefs_v1";
const DELETED_CHATS_KEY = "travelhub_deleted_chats_v1";

const AVATAR_PALETTE = [
  "#DC2626",
  "#2563EB",
  "#059669",
  "#D97706",
  "#7C3AED",
  "#0891B2",
] as const;

const DEMO_CHAT_TRAVELLO_HELP_ID = "__demo_travello_help__";
const DEMO_CHAT_COMMUNITY_ID = "__demo_community_updates__";

/** Legacy message thread colors */
const MSG_BORDER = "#334155";
/** WhatsApp-style bubbles (spec) */
const WA_MINE = "#E8385A";
const WA_OTHER = "#1E2A3A";

const CONTACTS_AUTOSYNC_KEY = "travelhub_contacts_autosync_v1";
const CALL_TOAST = "Calling coming soon";
const SOON_TOAST = "Coming soon";

type UserMe = {
  id: string;
  email?: string | null;
  full_name: string | null;
  username?: string | null;
};

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
  invite_code?: string;
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
};

type ChatMessage = {
  id: string;
  sender_id: string;
  sender_name?: string;
  sender_avatar?: string;
  text?: string;
  type: string;
  timestamp: number;
  read_by?: Record<string, boolean>;
  metadata?: Record<string, unknown>;
};

type ContactPerson = {
  id: string;
  full_name: string;
  username?: string | null;
  phone?: string | null;
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
  profile_picture: string | null;
  avatar_url: string | null;
  friend_status: UserSearchFriendStatus;
};

type ChatPrefs = {
  muted?: boolean;
  pinned?: boolean;
  archived?: boolean;
  lastReadAt?: number;
};

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  ...(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    ? { storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET }
    : {}),
  ...(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
    ? { messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID }
    : {}),
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

function getDiceBearUrl(seed: string): string {
  return `https://api.dicebear.com/7.x/lorelei/svg?seed=${encodeURIComponent(seed)}`;
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
  return AVATAR_PALETTE[hashString(name) % AVATAR_PALETTE.length]!;
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
  displayPreview: "Hi! Ask me anything about planning your trip.",
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
  displayPreview: "New feature: AI trip planner is now live!",
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

/** DM chatId: dm_{uid1}_{uid2} with uid1 < uid2 (alphabetical) */
function sortedPairForDm(a: string, b: string): [string, string] {
  return a.localeCompare(b) <= 0 ? [a, b] : [b, a];
}

function parseSocialConnectionsPayload(data: unknown): ContactPerson[] {
  const out: ContactPerson[] = [];
  let raw: unknown[] = [];
  if (Array.isArray(data)) raw = data;
  else if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    const nested = o.connections ?? o.items ?? o.results ?? o.data;
    if (Array.isArray(nested)) raw = nested;
  }
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const inner = (o.user ?? o.other_user ?? o.connection ?? o) as Record<
      string,
      unknown
    >;
    const id =
      typeof inner.id === "string"
        ? inner.id
        : typeof o.user_id === "string"
          ? o.user_id
          : null;
    const full_name =
      typeof inner.full_name === "string"
        ? inner.full_name
        : typeof o.full_name === "string"
          ? o.full_name
          : null;
    if (!id || !full_name) continue;
    const un =
      typeof inner.username === "string" || inner.username === null
        ? (inner.username as string | null)
        : typeof o.username === "string" || o.username === null
          ? (o.username as string | null)
          : null;
    const phone =
      typeof inner.phone === "string" || inner.phone === null
        ? (inner.phone as string | null)
        : typeof o.phone === "string"
          ? o.phone
          : null;
    out.push({ id, full_name, username: un, phone });
  }
  return out;
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
      style={{ background: BG }}
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
          background: BG,
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
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="shrink-0 px-4 py-2">
      <div
        className="flex items-center gap-2 rounded-full px-3 py-2"
        style={{ background: SURFACE }}
      >
        <Search className="h-5 w-5 shrink-0 opacity-80" aria-hidden />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search chats..."
          className="min-w-0 flex-1 border-0 bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
        />
        {value ? (
          <button
            type="button"
            aria-label="Clear search"
            className="inline-flex text-slate-400 transition hover:text-white"
            onClick={() => onChange("")}
          >
            <X className="h-5 w-5" />
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
      className="flex w-full cursor-pointer items-center gap-3 border-b px-4 text-left transition-colors duration-150 hover:bg-[#1E293B]"
      style={{
        height: 72,
        borderColor: BORDER_SUB,
        borderBottomWidth: 0.5,
        background: active ? SURFACE : "transparent",
        borderLeft: active ? `3px solid ${ACCENT}` : "3px solid transparent",
      }}
    >
      <div className="relative h-12 w-12 shrink-0">{avatar}</div>
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <div className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 truncate text-[14px] font-medium text-white">
            {name}
            {muted ? (
              <BellOff className="ml-1 h-3.5 w-3.5 text-slate-500" aria-hidden />
            ) : null}
          </span>
          <span
            className="ml-auto shrink-0 text-[11px]"
            style={{ color: TEXT_MUTED }}
          >
            {time}
          </span>
        </div>
        <div className="mt-0.5 flex min-w-0 items-center gap-2">
          <p
            className="min-w-0 flex-1 truncate text-[13px]"
            style={{
              color: TEXT_SECONDARY,
              maxWidth: "calc(100% - 32px)",
            }}
          >
            {preview}
          </p>
          {unread > 0 ? (
            <span
              className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full px-1 text-[11px] font-bold text-white"
              style={{ background: muted ? TEXT_MUTED : ACCENT }}
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
  searchQuery,
  onSearchChange,
  groups,
  user,
  mainChatList,
  activeChatId,
  chatPrefs,
  onSelectChat,
  updateChatPref,
  markChatDeleted,
  showToast,
  setContextMenu,
  longPressTimerRef,
}: {
  searchQuery: string;
  onSearchChange: (v: string) => void;
  groups: GroupOut[];
  user: UserMe | null;
  mainChatList: ChatInfo[];
  activeChatId?: string;
  chatPrefs: Record<string, ChatPrefs>;
  onSelectChat: (c: ChatInfo) => void;
  updateChatPref: (id: string, p: Partial<ChatPrefs>) => void;
  markChatDeleted: (id: string) => void;
  showToast: (m: string, t?: "success" | "error") => void;
  setContextMenu: (v: { x: number; y: number; chat: ChatInfo } | null) => void;
  longPressTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
}) {
  const q = searchQuery.trim().toLowerCase();
  const demosAlways = [DEMO_CHAT_TRAVELLO_HELP, DEMO_CHAT_COMMUNITY];
  const demosFiltered = q
    ? demosAlways.filter((d) => d.name.toLowerCase().includes(q))
    : demosAlways;

  const filteredReal = q
    ? mainChatList.filter((c) => c.name?.toLowerCase().includes(q))
    : mainChatList;
  const groupSection = filteredReal.filter((c) => c.type === "group");
  const dmSection = filteredReal.filter((c) => c.type !== "group");

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
          className="flex h-12 w-12 items-center justify-center rounded-full"
          style={{ background: ACCENT }}
        >
          <MessageCircle className="h-6 w-6 text-white" aria-hidden />
        </span>
      );
    }
    const bg =
      c.listAvatarBg ?? listAvatarColor(c.name);
    const initials =
      c.listInitials ?? initialsFromName(c.name);
    const isGroup = c.type === "group";
    const gMeta = c.group_id
      ? groups.find((g) => g.id === c.group_id)
      : undefined;
    const online =
      isGroup && user && !c.isAnnouncement
        ? memberOnlineRecently(gMeta?.members ?? [], user.id)
        : false;
    if (!isGroup && !c.listInitials) {
      return (
        <div className="relative">
          <img
            src={getDiceBearUrl(c.name)}
            alt=""
            className="h-12 w-12 rounded-full"
            width={48}
            height={48}
          />
          {online ? (
            <span
              className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-[#0F172A]"
              style={{ background: ONLINE }}
            />
          ) : null}
        </div>
      );
    }
    return (
      <div className="relative">
        <span
          className="flex h-12 w-12 items-center justify-center rounded-full text-[15px] font-bold text-white"
          style={{ background: bg }}
        >
          {initials}
        </span>
        {online ? (
          <span
            className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-[#0F172A]"
            style={{ background: ONLINE }}
          />
        ) : null}
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

    return (
      <ChatListRow72
        active={activeChatId === c.id}
        onClick={() => onSelectChat(c)}
        avatar={renderAvatar(c)}
        name={c.name}
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
              bg: ACCENT,
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
    <div className="flex min-h-0 flex-1 flex-col">
      <HubSearchField value={searchQuery} onChange={onSearchChange} />
      <ul className="m-0 min-h-0 flex-1 list-none overflow-y-auto p-0">
        {demosFiltered.map((c) =>
          wrapSwipe(
            c,
            <div key={c.id} className="block w-full">
              {rowInner(c)}
            </div>,
          ),
        )}
        {groupSection.length > 0 ? (
          <>
            <li
              className="sticky top-0 z-[1] list-none py-2 pl-4 pr-4 text-[11px] font-semibold uppercase tracking-wide"
              style={{
                color: SECTION_LABEL,
                background: BG,
              }}
            >
              Your groups
            </li>
            {groupSection.map((c) =>
              wrapSwipe(
                c,
                <div key={c.id} className="block w-full">
                  {rowInner(c)}
                </div>,
              ),
            )}
          </>
        ) : null}
        {dmSection.length > 0 ? (
          <>
            <li
              className="sticky top-0 z-[1] list-none py-2 pl-4 pr-4 text-[11px] font-semibold uppercase tracking-wide"
              style={{
                color: SECTION_LABEL,
                background: BG,
              }}
            >
              Direct messages
            </li>
            {dmSection.map((c) =>
              wrapSwipe(
                c,
                <div key={c.id} className="block w-full">
                  {rowInner(c)}
                </div>,
              ),
            )}
          </>
        ) : null}
        {demosFiltered.length === 0 &&
        groupSection.length === 0 &&
        dmSection.length === 0 ? (
          <li
            className="list-none px-4 py-16 text-center text-sm"
            style={{ color: TEXT_MUTED }}
          >
            No chats yet
          </li>
        ) : null}
      </ul>
    </div>
  );
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
  onCreateGroup,
  updateChatPref,
  markChatDeleted,
  showToast,
  setContextMenu,
  longPressTimerRef,
}: {
  searchQuery: string;
  onSearchChange: (v: string) => void;
  groups: GroupOut[];
  user: UserMe | null;
  groupsOnlyList: ChatInfo[];
  activeChatId?: string;
  chatPrefs: Record<string, ChatPrefs>;
  onSelectChat: (c: ChatInfo) => void;
  onCreateGroup: () => void;
  updateChatPref: (id: string, p: Partial<ChatPrefs>) => void;
  markChatDeleted: (id: string) => void;
  showToast: (m: string, t?: "success" | "error") => void;
  setContextMenu: (v: { x: number; y: number; chat: ChatInfo } | null) => void;
  longPressTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
}) {
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
    <div className="relative flex min-h-0 flex-1 flex-col">
      <HubSearchField value={searchQuery} onChange={onSearchChange} />
      <ul className="m-0 min-h-0 flex-1 list-none overflow-y-auto p-0 pb-14">
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
                    bg: ACCENT,
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
      <button
        type="button"
        onClick={onCreateGroup}
        className="sticky bottom-0 z-10 flex h-12 w-full shrink-0 items-center justify-center gap-2 rounded-none text-sm font-semibold text-white"
        style={{ background: ACCENT }}
        title="Create group"
      >
        <UserPlus className="h-5 w-5" />
        Create Group
      </button>
    </div>
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
    { dir: "in", text: "The live location feature is so cool.", time: "Apr 21, 9:10 AM" },
    { dir: "out", text: "Right? It works best when everyone enables it at the same time.", time: "Apr 21, 9:11 AM" },
    { dir: "in", text: "How do I check who owes me money?", time: "Apr 21, 9:15 AM" },
    { dir: "out", text: "Go to the trip, Expenses tab, Balance Summary. It shows everything.", time: "Apr 21, 9:16 AM" },
    { dir: "in", text: "Found it! Arjun owes me 800.", time: "Apr 21, 9:18 AM" },
  ],
  suresh: [
    { dir: "in", text: "When is the Kashmir trip confirmed?", time: "Apr 19, 6:00 PM" },
    { dir: "out", text: "Still planning. Join the group and vote on the poll!", time: "Apr 19, 6:05 PM" },
    { dir: "in", text: "Done! I voted for June dates. Budget looks a bit high though.", time: "Apr 19, 6:10 PM" },
    { dir: "out", text: "We can split differently — I'll adjust the expense split.", time: "Apr 19, 6:12 PM" },
    { dir: "in", text: "The map with all our saved pins is great.", time: "Apr 19, 6:20 PM" },
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
  "Got it.",
  "Sounds good!",
  "Let me check and get back to you.",
  "Ha! True.",
  "Yes, definitely!",
  "I'll ask the group.",
] as const;

function HubContactsTab({
  socialRows,
  groupRows,
  onMessage,
  onCall,
  onOpenDemo,
  currentUser,
  settingsOpen,
  onSettingsOpen,
  autoSync,
  onAutoSync,
  onSyncContacts,
}: {
  socialRows: ContactRow[];
  groupRows: ContactRow[];
  onMessage: (p: ContactPerson) => void;
  onCall: () => void;
  onOpenDemo: (
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
  ) => void;
  currentUser: UserMe | null;
  settingsOpen: boolean;
  onSettingsOpen: (v: boolean) => void;
  autoSync: boolean;
  onAutoSync: (v: boolean) => void;
  onSyncContacts: () => void;
}) {
  const rowActions = (c: ContactRow) => (
    <div className="flex shrink-0 items-center gap-1.5">
      <button
        type="button"
        onClick={() => onMessage(c)}
        className="inline-flex h-8 items-center gap-1 rounded-full border px-2.5 text-[11px] font-medium text-white transition hover:bg-white/10"
        style={{ borderColor: MSG_BORDER }}
        title="Message"
      >
        <MessageCircle className="h-4 w-4" />
        Message
      </button>
      <button
        type="button"
        onClick={onCall}
        className="inline-flex h-8 items-center gap-1 rounded-full border px-2.5 text-[11px] font-medium text-white transition hover:bg-white/10"
        style={{ borderColor: MSG_BORDER }}
        title="Call"
      >
        <Phone className="h-4 w-4" />
        Call
      </button>
    </div>
  );
  const demoMsgCall = (onDemoMessage: () => void) => (
    <div className="flex shrink-0 flex-col gap-1 sm:flex-row sm:items-center">
      <button
        type="button"
        onClick={onDemoMessage}
        className="inline-flex h-8 items-center justify-center gap-1 rounded-full border px-2.5 text-[11px] font-medium text-white"
        style={{ borderColor: MSG_BORDER }}
        title="Message"
      >
        <MessageCircle className="h-4 w-4" />
        Message
      </button>
      <button
        type="button"
        onClick={onCall}
        className="inline-flex h-8 items-center justify-center gap-1 rounded-full border px-2.5 text-[11px] font-medium text-white"
        style={{ borderColor: MSG_BORDER }}
        title="Call"
      >
        <Phone className="h-4 w-4" />
        Call
      </button>
    </div>
  );
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        className="flex shrink-0 items-center justify-between border-b px-3 py-2.5"
        style={{ borderColor: BORDER_SUB, background: BG }}
      >
        <span className="text-[15px] font-medium text-white">Contacts</span>
        <button
          type="button"
          className="rounded p-2 text-slate-300 transition hover:bg-white/10 hover:text-white"
          onClick={() => onSettingsOpen(!settingsOpen)}
          title="Contact settings"
          aria-label="Contact settings"
        >
          <Settings className="h-5 w-5" />
        </button>
      </div>
      {settingsOpen ? (
        <div
          className="shrink-0 space-y-3 border-b px-4 py-3"
          style={{ borderColor: BORDER_SUB, background: SURFACE }}
        >
          <button
            type="button"
            className="w-full rounded-lg py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
            style={{ background: ACCENT }}
            onClick={() => onSyncContacts()}
          >
            Sync contacts
          </button>
          <label className="flex cursor-pointer items-center justify-between text-sm text-white">
            <span style={{ color: TEXT_SECONDARY }}>Auto-sync</span>
            <span className="flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 accent-red-600"
                checked={autoSync}
                onChange={(e) => onAutoSync(e.target.checked)}
              />
              {autoSync ? "On" : "Off"}
            </span>
          </label>
        </div>
      ) : null}
      <ul className="m-0 min-h-0 flex-1 list-none overflow-y-auto p-0">
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
            <div className="flex min-h-[72px] items-center gap-2 px-3">
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
              {demoMsgCall(() => onOpenDemo(d))}
            </div>
          </li>
        ))}
        {currentUser ? (
          <li
            className="list-none border-b"
            style={{ borderColor: BORDER_SUB, borderBottomWidth: 0.5 }}
          >
            <div className="flex min-h-[72px] items-center gap-2 px-3">
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
              {demoMsgCall(() =>
                onOpenDemo({
                  kind: "self",
                  id: "__demo_contact_self__",
                  name: formatDisplayNameHub(currentUser.full_name),
                  initials: initialsFromName(currentUser.full_name || "You"),
                  bg: listAvatarColor(
                    currentUser.full_name || currentUser.id || "me",
                  ),
                  sub: "Your account · demo self-chat",
                }),
              )}
            </div>
          </li>
        ) : null}
        {socialRows.length > 0 ? (
          <li
            className="list-none py-2 pl-4 pr-4 text-[11px] font-semibold uppercase tracking-wide"
            style={{ color: SECTION_LABEL, background: BG }}
          >
            Connections
          </li>
        ) : null}
        {socialRows.map((c) => (
          <li
            key={`soc-${c.id}`}
            className="list-none border-b"
            style={{ borderColor: BORDER_SUB, borderBottomWidth: 0.5 }}
          >
            <div className="flex min-h-[72px] items-center gap-2 px-3">
              <img
                src={getDiceBearUrl(c.full_name)}
                alt=""
                className="h-12 w-12 shrink-0 rounded-full"
                width={48}
                height={48}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-bold text-white">
                  {c.full_name}
                </p>
                <p
                  className="truncate text-[12px]"
                  style={{ color: TEXT_MUTED }}
                >
                  {c.groupsTogether > 0
                    ? `${c.groupsTogether} group${
                        c.groupsTogether === 1 ? "" : "s"
                      } in common`
                    : "Connection"}
                </p>
              </div>
              {rowActions(c)}
            </div>
          </li>
        ))}
        {groupRows.length > 0 ? (
          <li
            className="list-none py-2 pl-4 pr-4 text-[11px] font-semibold uppercase tracking-wide"
            style={{ color: SECTION_LABEL, background: BG }}
          >
            From your groups
          </li>
        ) : null}
        {groupRows.map((c) => (
          <li
            key={`grp-${c.id}`}
            className="list-none border-b"
            style={{ borderColor: BORDER_SUB, borderBottomWidth: 0.5 }}
          >
            <div className="flex min-h-[72px] items-center gap-2 px-3">
              <img
                src={getDiceBearUrl(c.full_name)}
                alt=""
                className="h-12 w-12 shrink-0 rounded-full"
                width={48}
                height={48}
              />
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
              {rowActions(c)}
            </div>
          </li>
        ))}
        {socialRows.length === 0 && groupRows.length === 0 ? (
          <li
            className="list-none px-4 py-8 text-center text-sm"
            style={{ color: TEXT_MUTED }}
          >
            No contacts yet. Sync or join a group to add people.
          </li>
        ) : null}
      </ul>
    </div>
  );
}

type ContactWithGroupCount = ContactPerson & { groupsTogether: number };

function HubCallsTab({
  showToast,
  contacts,
}: {
  showToast: (m: string) => void;
  contacts: ContactWithGroupCount[];
}) {
  const onCall = () => {
    showToast(SOON_TOAST);
  };
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div
        className="mx-3 mt-3 shrink-0 rounded-2xl border p-5"
        style={{ borderColor: MSG_BORDER, background: "linear-gradient(145deg, #0A1628 0%, #1E293B 100%)" }}
      >
        <div className="flex items-start gap-4">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
            style={{
              background: "rgba(220, 38, 38, 0.2)",
              border: `1px solid ${MSG_BORDER}`,
            }}
            aria-hidden
          >
            <Phone className="h-8 w-8 animate-bounce text-red-400" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <PhoneCall className="h-5 w-5 text-slate-500" aria-hidden />
              <p className="text-base font-bold text-white">Coming soon</p>
            </div>
            <p className="mt-1 text-[13px] leading-relaxed" style={{ color: TEXT_SECONDARY }}>
              We&apos;re building voice &amp; video calls for your travel groups — stay tuned.
            </p>
          </div>
          <div
            className="hidden h-12 w-12 shrink-0 sm:flex sm:items-center sm:justify-center text-sky-400"
            aria-hidden
          >
            <Video className="h-8 w-8" />
          </div>
        </div>
        <p className="mt-4 text-center text-[12px] font-medium" style={{ color: TEXT_MUTED }}>
          Try call buttons below — you&apos;ll see a quick heads-up
        </p>
      </div>
      <p
        className="px-4 pt-4 text-[11px] font-bold uppercase tracking-wide"
        style={{ color: SECTION_LABEL }}
      >
        Recent contacts from your groups
      </p>
      <ul className="px-0 pb-6 pt-1">
        {contacts.length === 0 ? (
          <li
            className="px-4 py-6 text-center text-sm"
            style={{ color: TEXT_MUTED }}
          >
            Join a group to see people you travel with here.
          </li>
        ) : (
          contacts.map((c) => (
            <li
              key={c.id}
              className="mx-2 mb-1 flex min-h-[72px] items-center gap-2 rounded-xl px-2 py-2"
              style={{ borderBottom: `0.5px solid ${BORDER_SUB}` }}
            >
              <img
                src={getDiceBearUrl(c.full_name)}
                alt=""
                className="h-12 w-12 shrink-0 rounded-full"
                width={48}
                height={48}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium text-white">
                  {c.full_name}
                </p>
                <p className="truncate text-[12px]" style={{ color: TEXT_MUTED }}>
                  {c.groupsTogether} group
                  {c.groupsTogether === 1 ? "" : "s"} together
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  className="inline-flex min-w-0 items-center justify-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold text-white transition hover:opacity-90"
                  style={{ borderColor: MSG_BORDER, background: WA_OTHER }}
                  onClick={onCall}
                  title="Voice call"
                >
                  <Phone className="h-4 w-4" />
                  Voice
                </button>
                <button
                  type="button"
                  className="inline-flex min-w-0 items-center justify-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold text-white transition hover:opacity-90"
                  style={{ borderColor: MSG_BORDER, background: "#1E3A5F" }}
                  onClick={onCall}
                  title="Video call"
                >
                  <Video className="h-4 w-4" />
                  Video
                </button>
              </div>
            </li>
          ))
        )}
      </ul>
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
  const replyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setExtra([]);
    setInput("");
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
          className="p-1 text-slate-300 hover:text-white md:hidden"
          aria-label="Back"
          onClick={onBack}
        >
          <ArrowLeft className="h-6 w-6" />
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
        <div className="flex shrink-0 items-center gap-1 text-slate-400">
          <button
            type="button"
            className="rounded p-2 hover:bg-white/10 hover:text-white"
            aria-label="Video call"
            title="Video call"
            onClick={() => showToast(SOON_TOAST, "success")}
          >
            <Video className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="rounded p-2 hover:bg-white/10 hover:text-white"
            aria-label="Voice call"
            title="Voice call"
            onClick={() => showToast(SOON_TOAST, "success")}
          >
            <Phone className="h-5 w-5" />
          </button>
        </div>
      </header>
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto px-4 py-3"
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
      <div
        className="flex shrink-0 items-center gap-2 border-t px-3 py-2"
        style={{ borderColor: BORDER_SUB, background: BG }}
      >
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
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white"
          style={{ background: ACCENT }}
          title="Send"
          aria-label="Send"
        >
          <Send className="h-5 w-5" />
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
    "Tap the split button in any group chat, enter amount, choose who paid, and select who to split with. Everyone sees their share instantly.",
  "What is live coordination?":
    "When your trip starts, activate Live mode. Everyone's location appears on a shared map. Drop meetup pins, set countdown timers, and see who has arrived. Needs a 3-Day Pass or Pro.",
  "How to invite friends?":
    "Open your group, share the invite code or copy the invite link. Friends join instantly by entering the code. No app download needed on web.",
  "What's included in Pro plan?":
    "Pro (849/month) includes: unlimited trips, live coordination, receipt scanner, expense export PDF, AI trip planner, and everything in Free. Upgrade in your Profile.",
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
          <MessageCircle className="h-5 w-5 text-white" aria-hidden />
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
        className="min-h-0 flex-1 overflow-y-auto px-4 py-3"
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
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white disabled:opacity-45"
          style={{ background: ACCENT }}
          title="Send"
          aria-label="Send"
        >
          <Send className="h-5 w-5" />
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
        <MessageCircle className="h-6 w-6 text-slate-500" aria-hidden />
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
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
            New feature alert: AI Trip Planner is now live. Upload any
            document (screenshot, PDF, Word or Excel) and our AI fills your
            entire trip plan automatically. Try it in Trips, Plan New Trip.
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
            Live Coordination upgrade: Meetup pins now show distance in real
            time. When you&apos;re within 100m of the meetup point, you&apos;ll
            see a &apos;You&apos;ve arrived!&apos; celebration.
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
            Buddy Trips launching soon. Solo traveler? Post a trip listing
            and find companions who match your vibe, budget, and destination.
            Coming in our next update.
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
            chat box. Tap the split control in any group chat to split a bill and post
            it as a message. All members see their share instantly.
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

export default function TravelHubPage() {
  const router = useRouter();
  const [firebaseReady, setFirebaseReady] = useState(false);
  const [db, setDb] = useState<Database | null>(null);

  const [user, setUser] = useState<UserMe | null>(null);
  const [groups, setGroups] = useState<GroupOut[]>([]);
  const [trips, setTrips] = useState<TripOut[]>([]);
  const [chats, setChats] = useState<ChatInfo[]>([]);
  const [activeChat, setActiveChat] = useState<ChatInfo | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageText, setMessageText] = useState("");
  const [activeTab, setActiveTab] = useState<
    "chats" | "groups" | "contacts" | "calls"
  >("chats");
  const [showAttach, setShowAttach] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showDmUserSearch, setShowDmUserSearch] = useState(false);
  const [showSearchOverlay, setShowSearchOverlay] = useState(false);
  const [showMenuDrawer, setShowMenuDrawer] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [overlaySearchText, setOverlaySearchText] = useState("");
  const [overlaySearchResults, setOverlaySearchResults] = useState<
    UserSearchResultRow[]
  >([]);
  const [overlaySearchLoading, setOverlaySearchLoading] = useState(false);
  const [incomingFrIdBySender, setIncomingFrIdBySender] = useState<
    Record<string, string>
  >({});
  const [overlayActionUserId, setOverlayActionUserId] = useState<string | null>(
    null,
  );
  const overlaySearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const overlaySearchSeq = useRef(0);
  const [isMd, setIsMd] = useState(false);
  const [chatPrefs, setChatPrefs] = useState<Record<string, ChatPrefs>>({});
  const [deletedChatIds, setDeletedChatIds] = useState<string[]>([]);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    chat: ChatInfo;
  } | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [contacts, setContacts] = useState<ContactPerson[]>([]);
  const [socialConnections, setSocialConnections] = useState<ContactPerson[]>(
    [],
  );
  const [contactsSettingsOpen, setContactsSettingsOpen] = useState(false);
  const [chatProfileOpen, setChatProfileOpen] = useState(false);
  const [contactsAutoSync, setContactsAutoSync] = useState(true);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [profileBannerDismissed, setProfileBannerDismissed] = useState(false);
  const [firebaseBannerDismissed, setFirebaseBannerDismissed] = useState(false);

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

  const showToast = useCallback(
    (message: string, type: "success" | "error" = "success") => {
      setToast({ message, type });
      globalThis.setTimeout(() => setToast(null), 3000);
    },
    [],
  );

  const handleUnauthorized = useCallback(() => {
    clearToken();
    router.push("/login");
  }, [router]);

  useEffect(() => {
    const { db: d, ok } = initFirebase();
    setDb(d);
    setFirebaseReady(ok);
  }, []);

  useEffect(() => {
    setChatPrefs(readJsonLs<Record<string, ChatPrefs>>(CHAT_PREFS_KEY, {}));
    setDeletedChatIds(readJsonLs<string[]>(DELETED_CHATS_KEY, []));
    if (typeof window !== "undefined") {
      setProfileBannerDismissed(
        localStorage.getItem("profile_banner_dismissed") === "true",
      );
      setFirebaseBannerDismissed(
        localStorage.getItem("firebase_banner_dismissed") === "true",
      );
      setContactsAutoSync(
        localStorage.getItem(CONTACTS_AUTOSYNC_KEY) !== "0",
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
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => {
      const h = window.innerHeight;
      setKeyboardOpen(h - vv.height > 120);
    };
    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, []);

  const initGroupChat = useCallback(
    async (
      database: Database,
      group: GroupOut,
      members: GroupMemberOut[],
      current: UserMe,
    ) => {
      const chatId = `group_${group.id}`;
      const chatRef = ref(database, `chats/${chatId}/metadata`);
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

  const loadBackend = useCallback(async () => {
    setLoading(true);
    try {
      const [meRes, groupsRes] = await Promise.all([
        apiFetchWithStatus<UserMe>("/auth/me"),
        apiFetchWithStatus<GroupOut[]>("/groups"),
      ]);
      if (meRes.status === 401 || groupsRes.status === 401) {
        handleUnauthorized();
        return;
      }
      if (!meRes.data) {
        showToast("Could not load profile", "error");
        return;
      }
      setUser(meRes.data);
      const gList = groupsRes.data ?? [];
      setGroups(gList);

      const memberSet = new Map<string, ContactPerson>();
      for (const g of gList) {
        for (const m of g.members) {
          if (m.user_id !== meRes.data.id && !memberSet.has(m.user_id)) {
            memberSet.set(m.user_id, {
              id: m.user_id,
              full_name: m.full_name,
              username: null,
            });
          }
        }
      }
      setContacts([...memberSet.values()]);

      const connRes = await apiFetchWithStatus<unknown>("/social/connections");
      if (connRes.status === 401) {
        handleUnauthorized();
        return;
      }
      if (connRes.status < 400 && connRes.data != null) {
        setSocialConnections(parseSocialConnectionsPayload(connRes.data));
      } else {
        setSocialConnections([]);
      }

      const tripLists = await Promise.all(
        gList.map((g) =>
          apiFetchWithStatus<TripOut[]>(`/groups/${g.id}/trips`),
        ),
      );
      if (tripLists.some((r) => r.status === 401)) {
        handleUnauthorized();
        return;
      }
      const flat: TripOut[] = [];
      for (const r of tripLists) {
        for (const t of r.data ?? []) flat.push(t);
      }
      setTrips(flat);

      if (db && meRes.data.id) {
        for (const g of gList) {
          await initGroupChat(db, g, g.members, meRes.data);
        }
      }
    } catch (e) {
      console.error(e);
      showToast(
        e instanceof Error ? e.message : "Failed to load",
        "error",
      );
    } finally {
      setLoading(false);
    }
  }, [db, handleUnauthorized, showToast, initGroupChat]);

  useEffect(() => {
    void loadBackend();
  }, [loadBackend]);

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
        const metadataRef = ref(db, `chats/${chatId}/metadata`);
        const u = onValue(metadataRef, (snapInfo) => {
          if (!snapInfo.exists()) return;
          const data = snapInfo.val() as ChatInfo;
          merged[chatId] = { ...data, id: chatId };
          const list = Object.values(merged).sort(
            (a, b) =>
              (b.last_message_time ?? 0) - (a.last_message_time ?? 0),
          );
          setChats(list);
        });
        chatInfoUnsubsRef.current.push(u);
      });

      if (chatIds.length === 0) setChats([]);
    });

    return () => {
      unsub();
      chatInfoUnsubsRef.current.forEach((u) => u());
      chatInfoUnsubsRef.current = [];
    };
  }, [db, user?.id]);

  useEffect(() => {
    if (!showSearchOverlay || !user) return;
    void (async () => {
      const r = await apiFetchWithStatus<
        { id: string; sender_id: string; status: string }[]
      >("/social/friend-requests");
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
  }, [showSearchOverlay, user, handleUnauthorized]);

  const showSearchOverlayWasOpen = useRef(false);
  useEffect(() => {
    if (showSearchOverlayWasOpen.current && !showSearchOverlay) {
      overlaySearchSeq.current += 1;
    }
    showSearchOverlayWasOpen.current = showSearchOverlay;
  }, [showSearchOverlay]);

  useEffect(() => {
    if (overlaySearchDebounceRef.current) {
      clearTimeout(overlaySearchDebounceRef.current);
      overlaySearchDebounceRef.current = null;
    }
    if (!showSearchOverlay) {
      return;
    }
    const q = overlaySearchText.trim();
    if (q.length < 2) {
      overlaySearchSeq.current += 1;
      setOverlaySearchResults([]);
      setOverlaySearchLoading(false);
      return;
    }
    const seq = ++overlaySearchSeq.current;
    setOverlaySearchLoading(true);
    overlaySearchDebounceRef.current = setTimeout(() => {
      void (async () => {
        const enc = encodeURIComponent(overlaySearchText.trim());
        const r = await apiFetchWithStatus<UserSearchResultRow[]>(
          `/users/search?q=${enc}&limit=20`,
        );
        if (seq !== overlaySearchSeq.current) return;
        if (r.status === 401) {
          handleUnauthorized();
          setOverlaySearchLoading(false);
          return;
        }
        setOverlaySearchResults(Array.isArray(r.data) ? r.data : []);
        setOverlaySearchLoading(false);
      })();
    }, 300);
    return () => {
      if (overlaySearchDebounceRef.current) {
        clearTimeout(overlaySearchDebounceRef.current);
        overlaySearchDebounceRef.current = null;
      }
    };
  }, [overlaySearchText, showSearchOverlay, handleUnauthorized]);

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
        setMessages(msgs);
        globalThis.setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 80);
      });
      messagesUnsubRef.current = unsub;
    },
    [db],
  );

  useEffect(() => {
    if (!db || !activeChat) {
      messagesUnsubRef.current?.();
      messagesUnsubRef.current = null;
      return;
    }
    if (activeChat.isBot || activeChat.isAnnouncement || activeChat.isDemo) {
      messagesUnsubRef.current?.();
      messagesUnsubRef.current = null;
      return;
    }
    loadMessages(activeChat.id);
    return () => {
      messagesUnsubRef.current?.();
      messagesUnsubRef.current = null;
    };
  }, [
    db,
    activeChat?.id,
    activeChat?.isBot,
    activeChat?.isAnnouncement,
    activeChat?.isDemo,
    loadMessages,
  ]);

  const refreshSocialConnections = useCallback(async () => {
    const r = await apiFetchWithStatus<unknown>("/social/connections");
    if (r.status === 401) {
      handleUnauthorized();
      return;
    }
    if (r.status < 400 && r.data != null) {
      setSocialConnections(parseSocialConnectionsPayload(r.data));
      showToast("Contacts updated", "success");
    } else {
      showToast("Could not sync contacts", "error");
    }
  }, [handleUnauthorized, showToast]);

  useEffect(() => {
    return () => {
      messagesUnsubRef.current?.();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
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

      const chatId = activeChat.id;
      const messagesRef = ref(db, `chats/${chatId}/messages`);
      const seed = user.username || user.full_name || user.id;
      const avatarUrl = getDiceBearUrl(seed);
      const preview =
        type === "text" ? content : `Attachment (${type})`;
      const now = Date.now();
      const usePlainTextShape =
        type === "text" &&
        (metadata == null || Object.keys(metadata).length === 0);

      const message: Record<string, unknown> = usePlainTextShape
        ? {
            sender_id: user.id,
            sender_name: user.full_name || "You",
            sender_avatar: avatarUrl,
            text: content,
            timestamp: now,
            type: "text",
          }
        : {
            sender_id: user.id,
            sender_name: user.full_name || "You",
            sender_avatar: avatarUrl,
            text: content,
            type,
            timestamp: now,
            read_by: { [user.id]: true },
          };
      if (metadata && Object.keys(metadata).length)
        message.metadata = metadata;

      try {
        await push(messagesRef, message);
        await update(ref(db, `chats/${chatId}/metadata`), {
          last_message: preview,
          last_message_time: now,
          last_message_sender: user.full_name || "You",
        });
        const mem = activeChat.members?.filter(Boolean) ?? [];
        for (const uid of mem) {
          await set(ref(db, `user_chats/${uid}/${chatId}`), true);
        }
        setMessageText("");
        setShowAttach(false);
      } catch (e) {
        console.error(e);
        showToast("Could not send message", "error");
      }
    },
    [db, user, activeChat, showToast],
  );

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
    return () => {
      unsub();
    };
  }, [db, activeChat?.id, user?.id]);

  const openDirectChat = useCallback(
    async (other: ContactPerson) => {
      if (!db || !user) return;
      const [uid1, uid2] = sortedPairForDm(user.id, other.id);
      const chatId = `dm_${uid1}_${uid2}`;
      const chatRef = ref(db, `chats/${chatId}/metadata`);
      try {
        const snapshot = await get(chatRef);
        if (!snapshot.exists()) {
          await set(chatRef, {
            id: chatId,
            name: other.full_name,
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
        }
        const info = snapshot.exists()
          ? (snapshot.val() as ChatInfo)
          : {
              id: chatId,
              name: other.full_name,
              type: "individual" as const,
              members: [user.id, other.id],
              created_by: user.id,
              created_at: Date.now(),
            };
        setActiveChat({ ...info, id: chatId });
        setActiveTab("chats");
        setChatProfileOpen(false);
        updateChatPref(chatId, { lastReadAt: Date.now() });
      } catch (e) {
        console.error(e);
        showToast("Could not open chat", "error");
      }
    },
    [db, user, showToast, updateChatPref],
  );

  const connectOverlayUser = useCallback(
    async (row: UserSearchResultRow) => {
      setOverlayActionUserId(row.id);
      const r = await apiFetchWithStatus<{ id: string }>("/social/friend-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiver_id: row.id }),
      });
      setOverlayActionUserId(null);
      if (r.status === 401) {
        handleUnauthorized();
        return;
      }
      if (r.status >= 400 || !r.data) {
        showToast("Could not send request", "error");
        return;
      }
      setOverlaySearchResults((prev) =>
        prev.map((u) =>
          u.id === row.id
            ? { ...u, friend_status: "pending_sent" as const }
            : u,
        ),
      );
      showToast("Request sent", "success");
    },
    [handleUnauthorized, showToast],
  );

  const acceptOverlayUser = useCallback(
    async (row: UserSearchResultRow) => {
      const frId = incomingFrIdBySender[row.id];
      if (!frId) {
        showToast("Request not found. Try closing and opening search again.", "error");
        return;
      }
      setOverlayActionUserId(row.id);
      const r = await apiFetchWithStatus<unknown>(
        `/social/friend-requests/${frId}/accept`,
        { method: "PATCH" },
      );
      setOverlayActionUserId(null);
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
      setOverlaySearchResults((prev) =>
        prev.map((u) =>
          u.id === row.id
            ? { ...u, friend_status: "accepted" as const }
            : u,
        ),
      );
      showToast("You are now connected", "success");
    },
    [incomingFrIdBySender, handleUnauthorized, showToast],
  );

  const messageOverlayUser = useCallback(
    (row: UserSearchResultRow) => {
      setShowSearchOverlay(false);
      setOverlaySearchText("");
      setOverlaySearchResults([]);
      void openDirectChat({
        id: row.id,
        full_name: row.full_name,
        username: row.username,
      });
    },
    [openDirectChat],
  );

  const selectChat = useCallback(
    (c: ChatInfo) => {
      setActiveChat(c);
      setChatProfileOpen(false);
      setMessages([]);
      updateChatPref(c.id, { lastReadAt: Date.now() });
    },
    [updateChatPref],
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
    },
    [],
  );

  const filteredChats = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return chats;
    return chats.filter((c) => c.name?.toLowerCase().includes(q));
  }, [chats, searchQuery]);

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

  const groupTogetherCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const g of groups) {
      for (const m of g.members) {
        if (m.user_id === user?.id) continue;
        counts.set(m.user_id, (counts.get(m.user_id) ?? 0) + 1);
      }
    }
    return counts;
  }, [groups, user?.id]);

  const contactIdsFromSocial = useMemo(
    () => new Set(socialConnections.map((c) => c.id)),
    [socialConnections],
  );

  const socialConnectionRows = useMemo((): ContactRow[] => {
    return socialConnections
      .map((c) => ({
        ...c,
        groupsTogether: groupTogetherCounts.get(c.id) ?? 0,
      }))
      .sort((a, b) =>
        a.full_name.localeCompare(b.full_name, undefined, {
          sensitivity: "base",
        }),
      );
  }, [socialConnections, groupTogetherCounts]);

  const groupMemberRowsOnly = useMemo((): ContactRow[] => {
    return contacts
      .filter((c) => !contactIdsFromSocial.has(c.id))
      .map((c) => ({
        ...c,
        groupsTogether: groupTogetherCounts.get(c.id) ?? 0,
      }))
      .sort((a, b) =>
        a.full_name.localeCompare(b.full_name, undefined, {
          sensitivity: "base",
        }),
      );
  }, [contacts, contactIdsFromSocial, groupTogetherCounts]);

  const contactsWithGroupCounts = useMemo(() => {
    const byId = new Map<string, ContactRow>();
    for (const c of socialConnectionRows) byId.set(c.id, c);
    for (const c of groupMemberRowsOnly) {
      if (!byId.has(c.id)) byId.set(c.id, c);
    }
    return [...byId.values()].sort((a, b) =>
      a.full_name.localeCompare(b.full_name, undefined, {
        sensitivity: "base",
      }),
    );
  }, [socialConnectionRows, groupMemberRowsOnly]);

  const profilePeer = useMemo((): ContactPerson | null => {
    if (!activeChat || !user || activeChat.type !== "individual") return null;
    const oid = activeChat.members.find((id) => id !== user.id);
    if (!oid) return null;
    const all = [...socialConnectionRows, ...groupMemberRowsOnly, ...contacts];
    const found = all.find((c) => c.id === oid);
    if (found) return found;
    return { id: oid, full_name: activeChat.name, username: null };
  }, [activeChat, user, socialConnectionRows, groupMemberRowsOnly, contacts]);

  const blockUserById = useCallback(
    async (userId: string) => {
      const r = await apiFetchWithStatus<unknown>("/social/block", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      if (r.status === 401) {
        handleUnauthorized();
        return;
      }
      if (r.status < 400) {
        showToast("User blocked", "success");
        setChatProfileOpen(false);
        setSocialConnections((p) => p.filter((x) => x.id !== userId));
      } else {
        showToast("Could not block user", "error");
      }
    },
    [handleUnauthorized, showToast],
  );

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
          ["groups", "Groups"],
          ["contacts", "Contacts"],
          ["calls", "Calls"],
        ] as const
      ).map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => setActiveTab(id)}
          className="flex-1 border-0 text-center text-[13px] outline-none"
          style={{
            lineHeight: "44px",
            padding: 0,
            color: activeTab === id ? TEXT : TEXT_MUTED,
            fontWeight: activeTab === id ? 500 : 400,
            borderBottom:
              activeTab === id
                ? `2px solid ${ACCENT}`
                : "2px solid transparent",
            background: "transparent",
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );

  if (loading && !user) {
    return (
      <div
        className="flex animate-pulse gap-4 p-4"
        style={{ height: "calc(100vh - 64px)", background: BG }}
      >
        <div className="h-full w-80 rounded-xl" style={{ background: SURFACE }} />
        <div className="flex-1 rounded-xl" style={{ background: SURFACE }} />
      </div>
    );
  }

  return (
    <div
      className="relative flex w-full flex-col overflow-hidden"
      style={{
        height: "calc(100vh - 64px)",
        background: BG,
        color: TEXT,
      }}
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
            <X className="h-5 w-5" />
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
            <X className="h-5 w-5" />
          </button>
        </div>
      ) : null}
      <div
        className="flex min-h-0 flex-1 flex-row overflow-hidden"
        style={{ display: "flex", flexDirection: "row" }}
      >
        <div
          className={`flex min-h-0 flex-col overflow-hidden ${
            !isMd && activeChat ? "hidden" : "flex"
          }`}
          style={{
            width: isMd ? 380 : "100%",
            flexShrink: 0,
            background: BG,
            borderRight: isMd ? `0.5px solid ${BORDER_SUB}` : undefined,
            height: "100%",
          }}
        >
          <header
            className="flex shrink-0 items-center justify-between px-4 py-3"
            style={{
              background: BG,
              borderBottom: `0.5px solid ${BORDER_SUB}`,
            }}
          >
            <span className="text-[17px] font-medium text-white">
              Travel Hub
            </span>
            <div className="flex items-center gap-5 text-white">
              <button
                type="button"
                aria-label="Search"
                className="flex items-center justify-center text-white"
                onClick={() => {
                  setShowSearchOverlay(true);
                  setOverlaySearchText("");
                  setOverlaySearchResults([]);
                }}
              >
                <Search className="h-5 w-5" />
              </button>
              <button
                type="button"
                aria-label="Menu"
                className="flex items-center justify-center text-white"
                onClick={() => setShowMenuDrawer(true)}
              >
                <MoreVertical className="h-5 w-5" />
              </button>
            </div>
          </header>

          {tabBar}

          <div
            ref={listScrollRef}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
            style={{
              transform: pullDist ? `translateY(${pullDist * 0.35}px)` : undefined,
              transition: pullDist ? "none" : "transform 0.2s ease-out",
            }}
            onTouchStart={(e) => {
              if (activeTab === "chats" || activeTab === "groups")
                onListTouchStart(e);
            }}
            onTouchMove={(e) => {
              if (activeTab === "chats" || activeTab === "groups")
                onListTouchMove(e);
            }}
            onTouchEnd={() => {
              if (activeTab === "chats" || activeTab === "groups")
                onListTouchEnd();
            }}
          >
            {pullDist > 20 && (activeTab === "chats" || activeTab === "groups") ? (
              <div
                className="pointer-events-none py-1 text-center text-[11px]"
                style={{ color: TEXT_MUTED }}
              >
                {pullDist >= 60 ? "Release to refresh" : "Pull to refresh"}
              </div>
            ) : null}
            {activeTab === "chats" ? (
              <HubChatsTab
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                groups={groups}
                user={user}
                mainChatList={mainChatList}
                activeChatId={activeChat?.id}
                chatPrefs={chatPrefs}
                onSelectChat={selectChat}
                updateChatPref={updateChatPref}
                markChatDeleted={markChatDeleted}
                showToast={showToast}
                setContextMenu={setContextMenu}
                longPressTimerRef={longPressTimer}
              />
            ) : null}
            {activeTab === "groups" ? (
              <HubGroupsTab
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                groups={groups}
                user={user}
                groupsOnlyList={groupsOnlyList}
                activeChatId={activeChat?.id}
                chatPrefs={chatPrefs}
                onSelectChat={selectChat}
                onCreateGroup={() => {
                  router.push("/groups/new");
                }}
                updateChatPref={updateChatPref}
                markChatDeleted={markChatDeleted}
                showToast={showToast}
                setContextMenu={setContextMenu}
                longPressTimerRef={longPressTimer}
              />
            ) : null}
            {activeTab === "contacts" ? (
              <HubContactsTab
                socialRows={socialConnectionRows}
                groupRows={groupMemberRowsOnly}
                onMessage={(p) => void openDirectChat(p)}
                onCall={() => showToast(CALL_TOAST, "success")}
                onOpenDemo={openDemoDm}
                currentUser={user}
                settingsOpen={contactsSettingsOpen}
                onSettingsOpen={setContactsSettingsOpen}
                autoSync={contactsAutoSync}
                onAutoSync={(v) => {
                  setContactsAutoSync(v);
                  if (typeof window !== "undefined") {
                    localStorage.setItem(CONTACTS_AUTOSYNC_KEY, v ? "1" : "0");
                  }
                }}
                onSyncContacts={() => void refreshSocialConnections()}
              />
            ) : null}
            {activeTab === "calls" ? (
              <HubCallsTab
                showToast={(m) => showToast(m, "success")}
                contacts={contactsWithGroupCounts}
              />
            ) : null}
          </div>
        </div>

        <div
          className={`flex min-h-0 min-w-0 flex-col ${
            !isMd && !activeChat ? "hidden" : "flex"
          }`}
          style={{
            flex: 1,
            minWidth: 0,
            background: RIGHT_PANEL_BG,
            height: "100%",
          }}
        >
          {!activeChat ? (
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
              <Plane className="mx-auto h-16 w-16 text-slate-500" aria-hidden />
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
              onBack={() => setActiveChat(null)}
              showToast={(m, t) => showToast(m, t ?? "success")}
            />
          ) : activeChat.isBot ? (
            <TravelloHelpChatPanel />
          ) : activeChat.isAnnouncement ? (
            <CommunityAnnouncementPanel />
          ) : (
            <div
              className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden"
              style={{ background: RIGHT_PANEL_BG }}
            >
            <ChatHeader
              chat={activeChat}
              onBack={() => {
                setActiveChat(null);
                setChatProfileOpen(false);
              }}
              onOpenProfile={() => setChatProfileOpen(true)}
              onOpenSearch={() => {
                setShowSearchOverlay(true);
                setOverlaySearchText("");
                setOverlaySearchResults([]);
              }}
              onVoip={() => showToast(SOON_TOAST)}
              groups={groups}
            />

            <div
              className="min-h-0 flex-1 overflow-y-auto px-4 py-3"
              style={{ background: RIGHT_PANEL_BG }}
            >
              {messages.map((m, i) => {
                const showSep = shouldShowDateSeparator(messages, i);
                const mine = m.sender_id === user?.id;
                return (
                  <div key={m.id || i}>
                    {showSep ? (
                      <div className="my-3 flex justify-center">
                        <span
                          className="rounded-full border px-3 py-1 text-[11px] shadow-sm"
                          style={{
                            background: SURFACE,
                            borderColor: MSG_BORDER,
                            color: TEXT_MUTED,
                          }}
                        >
                          {getDateLabel(m.timestamp)}
                        </span>
                      </div>
                    ) : null}
                    <MessageBubble
                      msg={m}
                      mine={mine}
                      isGroup={activeChat.type === "group"}
                    />
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
                    <span
                      className="inline-block h-2 w-2 animate-pulse rounded-full"
                      style={{ background: TEXT_MUTED }}
                    />{" "}
                    {typingUsers[0]} is typing
                  </div>
                </div>
              ) : null}
              <div ref={messagesEndRef} />
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
                    className="inline-flex items-center gap-1 rounded-lg border px-3 py-1 text-sm text-white"
                    style={{ borderColor: MSG_BORDER }}
                  >
                    <X className="h-4 w-4" />
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={stopRecordingSend}
                    className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1 text-sm font-bold text-white"
                  >
                    <Check className="h-4 w-4" />
                    Send
                  </button>
                </div>
              </div>
            ) : (
              <>
                {showAttach ? (
                  <AttachMenu
                    trips={trips}
                    onClose={() => setShowAttach(false)}
                    onPickImage={(b64) => {
                      void sendMessage("image", "", { url: b64 });
                    }}
                    onLocation={(lat, lon, name) => {
                      void sendMessage("location", name, {
                        lat,
                        lon,
                        name,
                      });
                    }}
                    onExpense={() =>
                      showToast("Open Split Activities to add expenses", "success")
                    }
                    onTrip={(t) => {
                      void sendMessage("trip", t.title, {
                        trip_name: t.title,
                        destination: t.description ?? "",
                        dates: `${t.start_date ?? ""} – ${t.end_date ?? ""}`,
                        trip_id: t.id,
                      });
                    }}
                    onLiveLocation={() =>
                      showToast("Live location coming soon", "success")
                    }
                    onAudio={() => {
                      setShowAttach(false);
                      startRecording();
                    }}
                  />
                ) : null}

                <div
                  className={`flex shrink-0 items-center gap-2 border-t px-3 py-2 ${
                    keyboardOpen ? "hidden md:flex" : "flex"
                  }`}
                  style={{ borderColor: BORDER_SUB, background: BG }}
                >
                  <input
                    value={messageText}
                    onChange={(e) => {
                      setMessageText(e.target.value);
                      handleTyping();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void sendMessage("text", messageText);
                      }
                    }}
                    placeholder="Type a message"
                    className="min-w-0 flex-1 rounded-full border-0 px-4 py-2.5 text-sm text-white outline-none placeholder:text-slate-500"
                    style={{ background: SURFACE }}
                  />
                  {messageText.trim() ? (
                    <button
                      type="button"
                      onClick={() => void sendMessage("text", messageText)}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white transition hover:opacity-90"
                      style={{ background: ACCENT }}
                      aria-label="Send"
                      title="Send"
                    >
                      <Send className="h-5 w-5" />
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="rounded p-1.5 text-slate-300 transition hover:bg-white/10 hover:text-white"
                        onClick={() => setShowAttach(true)}
                        title="Attach"
                        aria-label="Attach"
                      >
                        <Paperclip className="h-5 w-5" />
                      </button>
                      <button
                        type="button"
                        className="rounded p-1.5 text-slate-300 transition hover:bg-white/10 hover:text-white"
                        onClick={startRecording}
                        title="Record voice"
                        aria-label="Record voice"
                      >
                        <Mic className="h-5 w-5" />
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
            </div>
        )}
      </div>
      </div>

      {activeTab === "chats" && !showDmUserSearch && !showNewChat ? (
        <button
          type="button"
          aria-label="Start a direct message"
          className="fixed bottom-5 right-5 z-[120] flex h-14 w-14 items-center justify-center rounded-full text-2xl shadow-lg transition-transform active:scale-95"
          style={{
            background: ACCENT,
            color: "#fff",
            boxShadow: "0 6px 24px rgba(220, 38, 38, 0.4)",
          }}
          onClick={() => setShowDmUserSearch(true)}
        >
          <PenSquare className="h-6 w-6" />
        </button>
      ) : null}

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

      {showDmUserSearch && user ? (
        <DmUserSearchOverlay
          onClose={() => setShowDmUserSearch(false)}
          onPick={(p) => {
            setShowDmUserSearch(false);
            void openDirectChat(p);
          }}
          showToast={showToast}
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
              className="p-1 text-slate-300 hover:text-white"
              onClick={() => {
                setShowSearchOverlay(false);
                setOverlaySearchText("");
                setOverlaySearchResults([]);
              }}
            >
              <ArrowLeft className="h-6 w-6" />
            </button>
            <div
              className="flex min-w-0 flex-1 items-center gap-2 rounded-full px-3 py-2"
              style={{ background: SURFACE }}
            >
              <Search className="h-5 w-5 shrink-0 text-slate-400" />
              <input
                autoFocus
                value={overlaySearchText}
                onChange={(e) => setOverlaySearchText(e.target.value)}
                placeholder="Name, @username, or phone…"
                className="min-w-0 flex-1 border-0 bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
              />
              {overlaySearchText ? (
                <button
                  type="button"
                  className="text-slate-400 hover:text-white"
                  onClick={() => {
                    setOverlaySearchText("");
                    setOverlaySearchResults([]);
                  }}
                  aria-label="Clear"
                >
                  <X className="h-5 w-5" />
                </button>
              ) : null}
            </div>
          </div>
          <div
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2"
            role="list"
          >
            {overlaySearchLoading ? (
              <div className="flex items-center justify-center py-12">
                <div
                  className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-white"
                  aria-hidden
                />
              </div>
            ) : null}
            {!overlaySearchLoading &&
            overlaySearchText.trim().length >= 2 &&
            overlaySearchResults.length === 0 ? (
              <p
                className="py-8 text-center text-sm"
                style={{ color: TEXT_MUTED }}
              >
                No users found
              </p>
            ) : null}
            {!overlaySearchLoading
              ? overlaySearchResults.map((u) => {
                  const thumb =
                    u.profile_picture || u.avatar_url || getDiceBearUrl(u.full_name);
                  const st = u.friend_status;
                  return (
                    <div
                      key={u.id}
                      role="listitem"
                      className="mb-1 flex min-h-[56px] items-center gap-3 rounded-lg px-2 py-2"
                      style={{ background: SURFACE }}
                    >
                      <img
                        src={thumb}
                        alt=""
                        className="h-11 w-11 shrink-0 rounded-full object-cover"
                      />
                      <div className="min-w-0 flex-1">
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
                      </div>
                      <div className="shrink-0">
                        {st === "none" ? (
                          <button
                            type="button"
                            className="rounded-lg px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                            style={{ background: "#2563EB" }}
                            disabled={overlayActionUserId === u.id}
                            onClick={() => void connectOverlayUser(u)}
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
                            disabled={overlayActionUserId === u.id}
                            onClick={() => void acceptOverlayUser(u)}
                          >
                            Accept
                          </button>
                        ) : null}
                        {st === "accepted" ? (
                          <button
                            type="button"
                            className="rounded-lg px-3 py-1.5 text-xs font-medium text-white"
                            style={{ background: "#0D9488" }}
                            onClick={() => messageOverlayUser(u)}
                          >
                            Message
                          </button>
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
                })
              : null}
          </div>
        </div>
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
            className="absolute right-0 top-0 flex h-full w-[min(100%,280px)] flex-col border-l shadow-2xl"
            style={{
              background: BG,
              borderColor: BORDER_SUB,
            }}
          >
            <div
              className="border-b px-4 py-4"
              style={{ borderColor: BORDER_SUB }}
            >
              <p className="text-sm font-medium text-white">Menu</p>
              <p className="text-xs" style={{ color: TEXT_MUTED }}>
                Travel Hub
              </p>
            </div>
            <nav className="flex flex-col p-2 text-left text-sm text-white">
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
                  setActiveTab("contacts");
                }}
              >
                Contacts
              </button>
              <button
                type="button"
                className="rounded-lg px-3 py-3 text-left hover:bg-white/5"
                onClick={() => {
                  setShowMenuDrawer(false);
                  showToast("Settings coming soon", "success");
                }}
              >
                Settings
              </button>
            </nav>
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
            className="absolute max-h-[min(80vh,420px)] w-56 overflow-y-auto rounded-xl border py-2 shadow-2xl"
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
                  () =>
                    showToast("Clear chat history coming soon", "success"),
                ],
                [
                  "Exit group",
                  () =>
                    showToast(
                      "Leave group from the group page",
                      "success",
                    ),
                ],
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

      {activeChat &&
      user &&
      !activeChat.isDemo &&
      !activeChat.isBot &&
      !activeChat.isAnnouncement ? (
        <ChatProfileSheet
          open={chatProfileOpen}
          onClose={() => setChatProfileOpen(false)}
          chat={activeChat}
          user={user}
          groups={groups}
          peer={profilePeer}
          onBlock={blockUserById}
          showToast={showToast}
        />
      ) : null}

      {toast ? (
        <div
          className={`fixed right-4 top-20 z-[300] max-w-sm animate-in rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg ${
            toast.type === "success" ? "bg-green-600" : "bg-red-600"
          }`}
        >
          {toast.message}
        </div>
      ) : null}
    </div>
  );
}

function ChatProfileSheet({
  open,
  onClose,
  chat,
  user,
  groups,
  peer,
  onBlock,
  showToast,
}: {
  open: boolean;
  onClose: () => void;
  chat: ChatInfo;
  user: UserMe;
  groups: GroupOut[];
  peer: ContactPerson | null;
  onBlock: (userId: string) => void;
  showToast: (m: string, t?: "success" | "error") => void;
}) {
  if (!open) return null;
  const g = chat.group_id
    ? groups.find((x) => x.id === chat.group_id)
    : undefined;
  const memberCount = g?.members?.length ?? chat.members?.length ?? 0;
  const mutual =
    user && peer
      ? groups.filter(
          (gr) =>
            gr.members.some((m) => m.user_id === user.id) &&
            gr.members.some((m) => m.user_id === peer.id),
        )
      : [];

  return (
    <div className="fixed inset-0 z-[400] flex">
      <button
        type="button"
        className="h-full min-w-0 flex-1 bg-black/60"
        aria-label="Close profile"
        onClick={onClose}
      />
      <div
        className="flex h-full w-full max-w-md flex-col overflow-y-auto border-l shadow-2xl"
        style={{ background: BG, borderColor: BORDER_SUB }}
      >
        <div
          className="flex items-center justify-between border-b px-3 py-3"
          style={{ borderColor: BORDER_SUB }}
        >
          <span className="text-sm font-semibold text-white">Profile</span>
          <button
            type="button"
            className="rounded p-1 text-slate-300 hover:bg-white/10 hover:text-white"
            onClick={onClose}
            aria-label="Close"
            title="Close"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        {chat.type === "group" ? (
          <div className="flex flex-1 flex-col items-center px-4 pb-8 pt-6 text-center">
            <span
              className="flex h-28 w-28 items-center justify-center rounded-full text-3xl font-bold text-white"
              style={{
                background: g
                  ? listAvatarColor(g.name)
                  : listAvatarColor(chat.name),
              }}
            >
              {initialsFromName(chat.name)}
            </span>
            <Users className="mt-4 h-8 w-8 text-slate-400" aria-hidden />
            <h2 className="mt-2 text-xl font-bold text-white">{chat.name}</h2>
            <p className="text-sm" style={{ color: TEXT_MUTED }}>
              {memberCount} members
            </p>
            <div className="mt-6 flex w-full max-w-xs flex-col gap-2">
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white"
                style={{ background: WA_MINE }}
                onClick={() => showToast(SOON_TOAST)}
                title="Voice call"
              >
                <Phone className="h-5 w-5" />
                Voice Call
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold text-white"
                style={{ borderColor: MSG_BORDER }}
                onClick={() => showToast(SOON_TOAST)}
                title="Video call"
              >
                <Video className="h-5 w-5" />
                Video Call
              </button>
            </div>
          </div>
        ) : peer ? (
          <div className="flex flex-1 flex-col items-center px-4 pb-8 pt-6">
            <img
              src={getDiceBearUrl(peer.full_name)}
              alt=""
              className="h-28 w-28 rounded-full"
              width={112}
              height={112}
            />
            <h2 className="mt-4 text-center text-xl font-bold text-white">
              {peer.full_name}
            </h2>
            {peer.username ? (
              <p className="text-sm" style={{ color: TEXT_MUTED }}>
                @{peer.username}
              </p>
            ) : null}
            {peer.phone ? (
              <p className="mt-1 text-sm text-slate-300">{peer.phone}</p>
            ) : (
              <p className="mt-1 text-sm" style={{ color: TEXT_MUTED }}>
                Phone not shared
              </p>
            )}
            <p className="mt-1 flex items-center gap-1.5 text-xs" style={{ color: ONLINE }}>
              <span className="h-2 w-2 rounded-full" style={{ background: ONLINE }} />
              Online
            </p>
            <div className="mt-6 flex w-full max-w-xs flex-col gap-2">
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white"
                style={{ background: WA_MINE }}
                onClick={() => showToast(SOON_TOAST)}
              >
                <Phone className="h-5 w-5" />
                Voice Call
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold text-white"
                style={{ borderColor: MSG_BORDER }}
                onClick={() => showToast(SOON_TOAST)}
              >
                <Video className="h-5 w-5" />
                Video Call
              </button>
            </div>
            <p
              className="mt-8 w-full text-left text-[11px] font-bold uppercase tracking-wide"
              style={{ color: SECTION_LABEL }}
            >
              Mutual groups
            </p>
            <ul className="mt-2 w-full space-y-2">
              {mutual.length === 0 ? (
                <li className="text-sm" style={{ color: TEXT_MUTED }}>
                  No shared groups
                </li>
              ) : (
                mutual.map((gr) => (
                  <li
                    key={gr.id}
                    className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-white"
                    style={{ borderColor: MSG_BORDER, background: SURFACE }}
                  >
                    <Users className="h-4 w-4 shrink-0 text-slate-400" />
                    {gr.name}
                  </li>
                ))
              )}
            </ul>
            <div className="mt-6 grid w-full max-w-xs grid-cols-3 gap-2">
              <button
                type="button"
                className="flex flex-col items-center gap-1 rounded-lg border py-2 text-[11px] text-white"
                style={{ borderColor: MSG_BORDER }}
                onClick={() => showToast("Favorite — coming soon")}
                title="Favorite"
              >
                <Star className="h-5 w-5 text-amber-400" />
                Favorite
              </button>
              <button
                type="button"
                className="flex flex-col items-center gap-1 rounded-lg border py-2 text-[11px] text-white"
                style={{ borderColor: MSG_BORDER }}
                onClick={() => onBlock(peer.id)}
                title="Block"
              >
                <Shield className="h-5 w-5 text-slate-300" />
                Block
              </button>
              <button
                type="button"
                className="flex flex-col items-center gap-1 rounded-lg border py-2 text-[11px] text-white"
                style={{ borderColor: MSG_BORDER }}
                onClick={() => showToast("Report — coming soon")}
                title="Report"
              >
                <Flag className="h-5 w-5 text-slate-300" />
                Report
              </button>
            </div>
          </div>
        ) : (
          <p className="p-4 text-sm" style={{ color: TEXT_MUTED }}>
            Profile unavailable
          </p>
        )}
      </div>
    </div>
  );
}

function ChatHeader({
  chat,
  onBack,
  onOpenProfile,
  onOpenSearch,
  onVoip,
  groups,
}: {
  chat: ChatInfo;
  onBack: () => void;
  onOpenProfile: () => void;
  onOpenSearch: () => void;
  onVoip: () => void;
  groups: GroupOut[];
}) {
  const g = chat.group_id
    ? groups.find((x) => x.id === chat.group_id)
    : undefined;
  const memberCount = g?.members?.length ?? chat.members?.length ?? 0;
  const showOnline = chat.type === "individual";
  return (
    <header
      className="flex shrink-0 items-center gap-3 border-b px-3 py-3 md:px-4"
      style={{ borderColor: BORDER_SUB, background: BG }}
    >
      <button
        type="button"
        className="inline-flex p-1 text-slate-300 hover:text-white md:hidden"
        onClick={onBack}
        aria-label="Back to chat list"
        title="Back"
      >
        <ArrowLeft className="h-6 w-6" />
      </button>
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
        onClick={onOpenProfile}
        title="View profile"
      >
        {chat.type === "group" ? (
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[15px] font-bold text-white"
            style={{
              background: g
                ? listAvatarColor(g.name)
                : listAvatarColor(chat.name),
            }}
          >
            {initialsFromName(chat.name)}
          </span>
        ) : (
          <img
            src={getDiceBearUrl(chat.name)}
            alt=""
            className="h-12 w-12 shrink-0 rounded-full"
            width={48}
            height={48}
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium text-white">
            {chat.name}
          </p>
          <p className="text-[12px]" style={{ color: TEXT_MUTED }}>
            {chat.type === "group"
              ? `${memberCount} members`
              : showOnline
                ? "Active now"
                : ""}
          </p>
        </div>
      </button>
      <div className="flex shrink-0 items-center gap-1.5" style={{ color: TEXT_MUTED }}>
        <button
          type="button"
          className="rounded p-2 text-slate-300 hover:bg-white/10 hover:text-white"
          onClick={onOpenSearch}
          title="Search"
          aria-label="Search"
        >
          <Search className="h-5 w-5" />
        </button>
        <button
          type="button"
          className="rounded p-2 text-slate-300 hover:bg-white/10 hover:text-white"
          onClick={onVoip}
          title="Voice call"
          aria-label="Voice call"
        >
          <Phone className="h-5 w-5" />
        </button>
        <button
          type="button"
          className="rounded p-2 text-slate-300 hover:bg-white/10 hover:text-white"
          onClick={onVoip}
          title="Video call"
          aria-label="Video call"
        >
          <Video className="h-5 w-5" />
        </button>
        <button
          type="button"
          className="rounded p-2 text-slate-300 hover:bg-white/10 hover:text-white"
          title="More"
          aria-label="More options"
        >
          <MoreVertical className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}

function MessageBubble({
  msg,
  mine,
  isGroup,
}: {
  msg: ChatMessage;
  mine: boolean;
  isGroup: boolean;
}) {
  const meta = msg.metadata as Record<string, unknown> | undefined;
  const timeStr = new Date(msg.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const bg = mine ? WA_MINE : WA_OTHER;
  const cornerMine =
    "rounded-tl-2xl rounded-bl-2xl rounded-tr-sm rounded-br-2xl";
  const cornerOther =
    "rounded-tr-2xl rounded-br-2xl rounded-tl-sm rounded-bl-2xl";
  return (
    <div
      className={`mb-3 flex w-full gap-2 ${mine ? "justify-end" : "justify-start"}`}
    >
      {!mine ? (
        <img
          src={msg.sender_avatar || getDiceBearUrl(msg.sender_name || "?")}
          alt=""
          className="mt-auto h-7 w-7 shrink-0 rounded-full"
          width={28}
          height={28}
        />
      ) : (
        <span className="w-7 shrink-0" aria-hidden />
      )}
      <div
        className={`flex max-w-[70%] flex-col ${mine ? "items-end" : "items-start"}`}
      >
        {isGroup && !mine && msg.sender_name ? (
          <p
            className="mb-0.5 max-w-full truncate px-0.5 text-[11px] font-semibold"
            style={{ color: WA_MINE }}
          >
            {msg.sender_name}
          </p>
        ) : null}
        <div
          className={`px-3 py-2 text-white ${mine ? cornerMine : cornerOther}`}
          style={{
            background: bg,
            boxShadow: "0 1px 0.5px rgba(0,0,0,0.25)",
          }}
        >
          {msg.type === "text" ? (
            <p className="text-sm text-white">{msg.text}</p>
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
              <p className="flex items-center gap-1.5 text-sm text-white">
                <MapPin className="h-4 w-4 shrink-0" />
                {msg.text}
              </p>
              <p className="text-[11px] text-white/80">
                {meta?.lat != null && meta?.lon != null
                  ? `${meta.lat}, ${meta.lon}`
                  : ""}
              </p>
              <Link
                href={`/map?lat=${String(meta?.lat ?? "")}&lon=${String(meta?.lon ?? "")}`}
                className="mt-1 inline-block text-xs font-bold"
                style={{ color: "#FCA5A5" }}
              >
                Open in Map
              </Link>
            </div>
          ) : null}
          {msg.type === "expense" ? (
            <div>
              <p className="text-sm text-white">
                {String(meta?.description ?? msg.text)}
              </p>
              <p className="font-bold" style={{ color: "#FEE2E2" }}>
                {meta?.amount != null ? String(meta.amount) : ""}
              </p>
              <Link
                href="/split-activities"
                className="text-xs font-bold text-sky-200"
              >
                View Details
              </Link>
            </div>
          ) : null}
          {msg.type === "trip" ? (
            <div>
              <p className="flex items-center gap-1.5 text-sm text-white">
                <Plane className="h-4 w-4 shrink-0" />
                {String(meta?.trip_name ?? msg.text)}
              </p>
              <p className="text-[11px] text-white/80">
                {String(meta?.destination ?? "")}
              </p>
              <p className="text-[11px] text-white/80">
                {String(meta?.dates ?? "")}
              </p>
              <Link
                href={`/trips/${String(meta?.trip_id ?? "")}`}
                className="text-xs font-bold"
                style={{ color: "#FCA5A5" }}
              >
                View Trip
              </Link>
            </div>
          ) : null}
          {msg.type === "audio" ? (
            <div className="flex items-center gap-2 text-sm text-white">
              <MessageCircle className="h-4 w-4 shrink-0" />
              <span
                className="h-8 flex-1 rounded"
                style={{ background: "rgba(255,255,255,0.2)" }}
              />
              <span className="text-[11px]">{String(meta?.duration ?? "")}</span>
            </div>
          ) : null}
        </div>
        <div
          className={`mt-0.5 flex items-center gap-1 px-0.5 text-[10px] ${
            mine ? "justify-end" : "justify-start"
          }`}
          style={{ color: TEXT_MUTED }}
        >
          <span>{timeStr}</span>
          {mine ? (
            <CheckCheck className="h-3.5 w-3.5 text-sky-300" aria-hidden />
          ) : null}
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
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-purple-500 text-white">
            <Camera className="h-7 w-7" />
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
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-orange-500 text-white">
            <Mic className="h-7 w-7" />
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
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-green-600 text-white">
            <MapPin className="h-7 w-7" />
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
            className="flex h-14 w-14 items-center justify-center rounded-full text-white"
            style={{ background: ACCENT }}
          >
            <Banknote className="h-7 w-7" />
          </span>
          <span className="text-[11px] text-slate-200">Split Expense</span>
        </button>
        <button
          type="button"
          className="flex flex-col items-center gap-1"
          onClick={() => setShowTrips((s) => !s)}
        >
          <span
            className="flex h-14 w-14 items-center justify-center rounded-full text-white"
            style={{ background: "#1E3A5F" }}
          >
            <Plane className="h-7 w-7" />
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
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-600 text-white">
            <MapIcon className="h-7 w-7" />
          </span>
          <span className="text-[11px] text-slate-200">Live Location</span>
        </button>
      </div>
      {showTrips ? (
        <ul
          className="mt-3 max-h-32 overflow-y-auto rounded-lg border p-2 text-sm"
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

function parseUsersFromSearchResponse(data: unknown): ContactPerson[] {
  if (!data) return [];
  if (Array.isArray(data)) {
    const out: ContactPerson[] = [];
    for (const u of data) {
      if (typeof u !== "object" || u === null) continue;
      const o = u as Record<string, unknown>;
      const id = typeof o.id === "string" ? o.id : null;
      const full_name =
        typeof o.full_name === "string"
          ? o.full_name
          : typeof o.name === "string"
            ? o.name
            : null;
      if (!id || !full_name) continue;
      out.push({
        id,
        full_name,
        username:
          typeof o.username === "string" || o.username === null
            ? (o.username as string | null)
            : null,
      });
    }
    return out;
  }
  if (typeof data === "object") {
    const o = data as Record<string, unknown>;
    const arr = o.users ?? o.items ?? o.results ?? o.data;
    if (Array.isArray(arr)) return parseUsersFromSearchResponse(arr);
  }
  return [];
}

function DmUserSearchOverlay({
  onClose,
  onPick,
  showToast,
}: {
  onClose: () => void;
  onPick: (p: ContactPerson) => void;
  showToast: (message: string, type?: "success" | "error") => void;
}) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<ContactPerson[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const query = q.trim();
    if (query.length < 1) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(() => {
      void (async () => {
        const path = `/users/search?q=${encodeURIComponent(query)}`;
        const res = await apiFetchWithStatus<unknown>(path);
        if (res.status === 401) {
          setRows([]);
          setLoading(false);
          return;
        }
        if (res.status >= 400) {
          setRows([]);
          setLoading(false);
          if (res.status !== 404) {
            showToast("Could not search users", "error");
          }
          return;
        }
        setRows(parseUsersFromSearchResponse(res.data));
        setLoading(false);
      })();
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, showToast]);

  return (
    <div
      className="fixed inset-0 z-[210] flex flex-col"
      style={{ background: BG }}
    >
      <div
        className="flex items-center gap-3 border-b px-3 py-3"
        style={{ borderColor: BORDER_SUB }}
      >
        <button
          type="button"
          onClick={onClose}
          className="p-1 text-slate-300 hover:text-white"
          aria-label="Back"
        >
          <ArrowLeft className="h-6 w-6" />
        </button>
        <span className="font-bold text-white">Message someone</span>
      </div>
      <p className="px-4 pt-2 text-[12px]" style={{ color: TEXT_MUTED }}>
        Search by name — we&apos;ll open a 1:1 chat when you pick someone
      </p>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoFocus
        placeholder="Search users…"
        className="mx-4 mt-3 rounded-full border px-4 py-2.5 text-sm text-white outline-none placeholder:text-slate-500"
        style={{ borderColor: MSG_BORDER, background: SURFACE }}
      />
      {loading ? (
        <p className="px-4 py-4 text-sm" style={{ color: TEXT_MUTED }}>
          Searching…
        </p>
      ) : null}
      <ul className="flex-1 overflow-y-auto px-4 pb-6 pt-2">
        {!loading && q.trim().length > 0 && rows.length === 0 ? (
          <li
            className="py-6 text-center text-sm"
            style={{ color: TEXT_MUTED }}
          >
            No users found. Try another name.
          </li>
        ) : null}
        {rows.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onPick(c)}
              className="flex w-full items-center gap-3 rounded-xl py-3 text-left hover:bg-white/5"
            >
              <img
                src={getDiceBearUrl(c.full_name)}
                alt=""
                className="h-10 w-10 rounded-full"
                width={40}
                height={40}
              />
              <div className="min-w-0">
                <span className="block font-semibold text-white">
                  {c.full_name}
                </span>
                {c.username ? (
                  <span className="text-[12px]" style={{ color: TEXT_MUTED }}>
                    @{c.username}
                  </span>
                ) : null}
              </div>
            </button>
          </li>
        ))}
      </ul>
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
          className="p-1 text-slate-300 hover:text-white"
          aria-label="Back"
        >
          <ArrowLeft className="h-6 w-6" />
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
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white"
          style={{ background: ACCENT }}
        >
          <Users className="h-5 w-5" />
          New Group Chat
        </button>
      </div>
      <ul className="flex-1 overflow-y-auto px-4">
        {filtered.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onPick(c)}
              className="flex w-full items-center gap-3 py-3 text-left"
            >
              <img
                src={getDiceBearUrl(c.full_name)}
                alt=""
                className="h-10 w-10 rounded-full"
                width={40}
                height={40}
              />
              <span className="font-semibold text-white">{c.full_name}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
