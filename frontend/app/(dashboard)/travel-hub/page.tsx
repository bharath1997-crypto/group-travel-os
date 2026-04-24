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
const WA_BG = "#0F172A";

const EMOJIS = [
  "😀",
  "😂",
  "😍",
  "🥰",
  "😭",
  "😎",
  "🤔",
  "👍",
  "❤️",
  "🔥",
  "🎉",
  "✈️",
  "🏖️",
  "🗺️",
  "📍",
  "💸",
  "🍽️",
  "🎵",
  "🏨",
  "🚗",
  "🌴",
  "❄️",
  "🏔️",
  "🌊",
  "🎭",
  "🙏",
  "💪",
  "✅",
  "⭐",
  "🎯",
];

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
  avatar_url?: string | null;
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
  displayPreview: "Hi! Ask me anything about planning your trip ✈",
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
  displayPreview: "🚀 New feature: AI trip planner is now live!",
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

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
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
        <span style={{ color: TEXT_MUTED }} aria-hidden>
          <SearchIcon className="opacity-80" />
        </span>
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
            className="text-lg leading-none"
            style={{ color: TEXT_MUTED }}
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
              <span className="ml-1 text-[12px] text-slate-500">🔕</span>
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
  onNavigateToGroup,
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
  onNavigateToGroup: (groupId: string) => void;
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
  const dmSection = filteredReal.filter((c) => c.type !== "group");
  const qGroups = q
    ? groups.filter((g) => g.name.toLowerCase().includes(q))
    : groups;

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
          <BotFaceIcon size={26} />
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
        {qGroups.length > 0 ? (
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
            {qGroups.map((g) => (
              <li key={g.id} className="list-none">
                <ChatListRow72
                  active={activeChatId === `group_${g.id}`}
                  onClick={() => onNavigateToGroup(g.id)}
                  avatar={
                    <span
                      className="flex h-12 w-12 items-center justify-center rounded-full text-[17px] font-bold text-white"
                      style={{ background: listAvatarColor(g.name) }}
                    >
                      {(g.name.trim()[0] ?? "?").toUpperCase()}
                    </span>
                  }
                  name={g.name}
                  preview="No messages yet"
                  time=""
                  unread={0}
                />
              </li>
            ))}
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
        qGroups.length === 0 &&
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
  reloadGroups,
  onUnauthorized,
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
  reloadGroups: () => Promise<void>;
  onUnauthorized: () => void;
  updateChatPref: (id: string, p: Partial<ChatPrefs>) => void;
  markChatDeleted: (id: string) => void;
  showToast: (m: string, t?: "success" | "error") => void;
  setContextMenu: (v: { x: number; y: number; chat: ChatInfo } | null) => void;
  longPressTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDesc, setNewGroupDesc] = useState("");
  const [creating, setCreating] = useState(false);

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
        onClick={() => setCreateOpen(true)}
        className="sticky bottom-0 z-10 h-12 w-full shrink-0 rounded-none text-sm font-semibold text-white"
        style={{ background: ACCENT }}
      >
        + Create Group
      </button>
      {createOpen ? (
        <div
          className="fixed inset-0 z-[600] flex items-end justify-center sm:items-center sm:p-6"
          style={{ background: "rgba(0,0,0,0.65)" }}
          role="presentation"
          onClick={() => !creating && setCreateOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="hub-create-group-title"
            className="w-full max-w-md rounded-t-2xl border p-4 shadow-2xl sm:rounded-2xl"
            style={{
              background: SURFACE,
              borderColor: MSG_BORDER,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="hub-create-group-title"
              className="text-lg font-semibold text-white"
            >
              New group
            </h2>
            <p className="mt-1 text-xs" style={{ color: TEXT_MUTED }}>
              Name is required. Add an optional description for your members.
            </p>
            <label className="mt-4 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Group name
            </label>
            <input
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="e.g. Weekend in Lisbon"
              maxLength={120}
              className="mt-1.5 w-full rounded-lg border px-3 py-2.5 text-[15px] text-white outline-none placeholder:text-slate-500"
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
              className="mt-1.5 w-full resize-none rounded-lg border px-3 py-2.5 text-[14px] text-white outline-none placeholder:text-slate-500"
              style={{
                background: BG,
                borderColor: MSG_BORDER,
              }}
            />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={creating}
                onClick={() => {
                  if (!creating) {
                    setCreateOpen(false);
                    setNewGroupName("");
                    setNewGroupDesc("");
                  }
                }}
                className="flex-1 rounded-lg py-2.5 text-sm font-medium text-slate-300"
                style={{
                  background: BG,
                  border: `0.5px solid ${MSG_BORDER}`,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={creating}
                onClick={() => {
                  void (async () => {
                    const nm = newGroupName.trim();
                    if (nm.length < 2) {
                      showToast("Name must be at least 2 characters", "error");
                      return;
                    }
                    setCreating(true);
                    try {
                      const res = await apiFetchWithStatus<GroupOut>("/groups", {
                        method: "POST",
                        body: JSON.stringify({
                          name: nm,
                          description: newGroupDesc.trim() || null,
                        }),
                      });
                      if (res.status === 401) {
                        onUnauthorized();
                        return;
                      }
                      if (res.status !== 201 || !res.data) {
                        showToast("Could not create group", "error");
                        return;
                      }
                      showToast("Group created", "success");
                      setCreateOpen(false);
                      setNewGroupName("");
                      setNewGroupDesc("");
                      await reloadGroups();
                    } catch {
                      showToast("Could not create group", "error");
                    } finally {
                      setCreating(false);
                    }
                  })();
                }}
                className="flex-1 rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: ACCENT }}
              >
                {creating ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
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
    { dir: "in", text: "Hey! Are we still going to Goa next month? 🏖", time: "Apr 20, 10:30 AM" },
    { dir: "out", text: "Yes! Booking flights this week. Check the poll I created.", time: "Apr 20, 10:32 AM" },
    { dir: "in", text: "Perfect. Should I book the hotel or will the group decide?", time: "Apr 20, 10:33 AM" },
    { dir: "out", text: "Let's do a poll for that too 😄", time: "Apr 20, 10:35 AM" },
    { dir: "in", text: "Good idea. Also Suresh is asking about the budget split.", time: "Apr 20, 11:00 AM" },
    { dir: "out", text: "Tell him to check the Split Activities section — it's all tracked there!", time: "Apr 20, 11:02 AM" },
    { dir: "in", text: "This app is actually really useful 🔥", time: "Apr 20, 11:05 AM" },
  ],
  priya: [
    { dir: "in", text: "Did you add me to the Manali trip?", time: "Apr 21, 9:00 AM" },
    { dir: "out", text: "Yes! Check your groups — you should see Manali Winter there.", time: "Apr 21, 9:02 AM" },
    { dir: "in", text: "Got it! The live location feature is so cool btw 📍", time: "Apr 21, 9:10 AM" },
    { dir: "out", text: "Right? It works best when everyone enables it at the same time.", time: "Apr 21, 9:11 AM" },
    { dir: "in", text: "How do I check who owes me money?", time: "Apr 21, 9:15 AM" },
    { dir: "out", text: "Go to the trip → Expenses tab → Balance Summary. It shows everything.", time: "Apr 21, 9:16 AM" },
    { dir: "in", text: "Found it! Arjun owes me ₹800 😅", time: "Apr 21, 9:18 AM" },
  ],
  suresh: [
    { dir: "in", text: "Bhai when is the Kashmir trip confirmed? 🏔", time: "Apr 19, 6:00 PM" },
    { dir: "out", text: "Still planning. Join the group and vote on the poll!", time: "Apr 19, 6:05 PM" },
    { dir: "in", text: "Done! I voted for June dates. Budget looks a bit high though.", time: "Apr 19, 6:10 PM" },
    { dir: "out", text: "We can split differently — I'll adjust the expense split.", time: "Apr 19, 6:12 PM" },
    { dir: "in", text: "The map with all our saved pins is 🔥", time: "Apr 19, 6:20 PM" },
    { dir: "out", text: "Haha yes! I saved like 15 spots already from Instagram reels.", time: "Apr 19, 6:21 PM" },
    { dir: "in", text: "See you in Kashmir then! 🎿", time: "Apr 19, 6:25 PM" },
  ],
  self: [
    {
      dir: "in",
      text: "This is your own account — use it to test group features!",
      time: "System",
    },
  ],
};

const DEMO_DM_EMOJIS = [
  "😄",
  "😂",
  "🔥",
  "❤️",
  "👍",
  "🙏",
  "😍",
  "🤔",
  "😅",
  "🎉",
  "✈️",
  "🏖",
  "🏔",
  "🗺",
  "💰",
  "📍",
  "🎿",
  "🍕",
  "🥂",
  "👋",
] as const;

const DEMO_AUTO_REPLIES = [
  "Got it! 👍",
  "Sounds good!",
  "Let me check and get back to you.",
  "Ha! True 😄",
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
            {c.avatar_url && c.avatar_url.trim() ? (
              <img
                src={c.avatar_url}
                alt=""
                className="h-12 w-12 shrink-0 rounded-full object-cover"
                width={48}
                height={48}
              />
            ) : (
              <img
                src={getDiceBearUrl(c.id)}
                alt=""
                className="h-12 w-12 shrink-0 rounded-full"
                width={48}
                height={48}
              />
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

const CALL_CAROUSEL_SLIDES: {
  icon: string;
  title: string;
  body: string;
  bg: string;
}[] = [
  {
    icon: "📹",
    title: "Start a group call",
    body: "Tap the video icon in any group chat to instantly start a Jitsi-powered group video call. No sign-up needed for participants.",
    bg: "#0C1A2E",
  },
  {
    icon: "🔗",
    title: "Share the link",
    body: "Every call generates a unique link. Share it in the group chat — members join from web or mobile with one tap.",
    bg: "#0C2E1A",
  },
  {
    icon: "🎤",
    title: "Audio controls",
    body: "Mute yourself, toggle camera, raise your hand, or switch to audio-only mode to save data on the go.",
    bg: "#1C0A1A",
  },
  {
    icon: "📌",
    title: "Pin to trip",
    body: "Call recordings and notes are saved to your trip. All decisions made on the call sync to your trip's Travel Hub automatically.",
    bg: "#0A0F2E",
  },
  {
    icon: "🚀",
    title: "Try it now!",
    body: "Open any group in Travel Hub and tap the video call button to start your first call.",
    bg: "#1C0A00",
  },
];

function HubCallsTab({ showToast }: { showToast: (m: string) => void }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [slide, setSlide] = useState(0);
  const touchStartX = useRef(0);

  const go = (dir: -1 | 1) => {
    setSlide((s) => {
      const n = s + dir;
      if (n < 0) return CALL_CAROUSEL_SLIDES.length - 1;
      if (n >= CALL_CAROUSEL_SLIDES.length) return 0;
      return n;
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="flex w-full cursor-pointer items-center gap-3 border-b px-4 text-left transition-colors hover:bg-[#1E293B]"
        style={{
          height: 72,
          borderColor: BORDER_SUB,
          borderBottomWidth: 0.5,
          background: "transparent",
        }}
      >
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[15px] font-bold text-white"
          style={{ background: listAvatarColor("Goa Gang") }}
        >
          GG
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-medium text-white">
            Goa Gang · Group call
          </p>
          <p className="truncate text-[12px]" style={{ color: TEXT_MUTED }}>
            Apr 20 · 3 participants · 12 min
          </p>
        </div>
        <span
          className="flex shrink-0 items-center gap-1 text-[12px]"
          style={{ color: ONLINE }}
        >
          📞 Call back
        </span>
      </button>
      <div className="p-4">
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="w-full rounded-lg py-3 text-sm font-medium text-white"
          style={{ background: SURFACE, border: `0.5px solid ${MSG_BORDER}` }}
        >
          Watch Demo
        </button>
      </div>

      {modalOpen ? (
        <div
          className="fixed inset-0 z-[500] flex items-center justify-center p-0 md:p-6"
          style={{ background: "rgba(0,0,0,0.75)" }}
        >
          <div
            className="flex h-full w-full max-h-[90vh] max-w-lg flex-col overflow-hidden md:rounded-2xl"
            style={{ background: "#000" }}
          >
            <div className="relative shrink-0 px-4 pt-4">
              <button
                type="button"
                aria-label="Close"
                className="absolute right-3 top-3 text-2xl text-white"
                onClick={() => setModalOpen(false)}
              >
                ×
              </button>
              <h2 className="pr-10 text-center text-lg font-semibold text-white">
                📹 Jitsi Video Call Demo
              </h2>
              <p
                className="mt-1 text-center text-[13px]"
                style={{ color: TEXT_MUTED }}
              >
                Swipe to see how group calls work in Travello
              </p>
            </div>
            <div
              className="relative min-h-0 flex-1 touch-pan-y"
              onTouchStart={(e) => {
                touchStartX.current = e.touches[0]?.clientX ?? 0;
              }}
              onTouchEnd={(e) => {
                const x = e.changedTouches[0]?.clientX ?? 0;
                const d = x - touchStartX.current;
                if (d > 50) go(-1);
                else if (d < -50) go(1);
              }}
            >
              <div
                className="flex h-full flex-col items-center justify-center px-6 py-8"
                style={{ background: CALL_CAROUSEL_SLIDES[slide]?.bg }}
              >
                <span className="text-6xl">
                  {CALL_CAROUSEL_SLIDES[slide]?.icon}
                </span>
                <h3 className="mt-4 text-center text-xl font-semibold text-white">
                  {CALL_CAROUSEL_SLIDES[slide]?.title}
                </h3>
                <p
                  className="mt-3 max-w-sm text-center text-[14px] leading-relaxed"
                  style={{ color: TEXT_SECONDARY }}
                >
                  {CALL_CAROUSEL_SLIDES[slide]?.body}
                </p>
                {slide === CALL_CAROUSEL_SLIDES.length - 1 ? (
                  <div className="mt-8 w-full max-w-xs space-y-3">
                    <button
                      type="button"
                      className="w-full rounded-lg py-3 text-sm font-semibold text-white"
                      style={{ background: ACCENT }}
                      onClick={() => {
                        setModalOpen(false);
                        showToast("Start a call from any group chat");
                      }}
                    >
                      Start a call →
                    </button>
                    <button
                      type="button"
                      className="w-full text-sm"
                      style={{ color: TEXT_MUTED }}
                      onClick={() => setModalOpen(false)}
                    >
                      Close
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="flex shrink-0 items-center justify-center gap-4 border-t border-white/10 py-3">
              <button
                type="button"
                className="text-xl text-white"
                aria-label="Previous"
                onClick={() => go(-1)}
              >
                ←
              </button>
              <div className="flex gap-2">
                {CALL_CAROUSEL_SLIDES.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Slide ${i + 1}`}
                    className="h-2 w-2 rounded-full"
                    style={{
                      background: i === slide ? ACCENT : "#475569",
                    }}
                    onClick={() => setSlide(i)}
                  />
                ))}
              </div>
              <button
                type="button"
                className="text-xl text-white"
                aria-label="Next"
                onClick={() => go(1)}
              >
                →
              </button>
            </div>
          </div>
        </div>
      ) : null}
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
          className="text-xl text-white/90 md:hidden"
          aria-label="Back"
          onClick={onBack}
        >
          ←
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
        <div className="flex shrink-0 items-center gap-4 text-lg text-[#94A3B8]">
          <button
            type="button"
            aria-label="Video call"
            onClick={() => showToast("Calls coming soon", "success")}
          >
            📹
          </button>
          <button
            type="button"
            aria-label="Voice call"
            onClick={() => showToast("Calls coming soon", "success")}
          >
            📞
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
      {emojiOpen ? (
        <div
          className="mx-3 mb-1 grid grid-cols-10 gap-1 rounded-xl border p-2"
          style={{ borderColor: MSG_BORDER, background: SURFACE }}
        >
          {DEMO_DM_EMOJIS.map((em) => (
            <button
              key={em}
              type="button"
              className="rounded p-1 text-xl hover:bg-white/10"
              onClick={() => setInput((p) => p + em)}
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
          className="shrink-0 text-xl"
          aria-label="Emoji"
          onClick={() => setEmojiOpen((o) => !o)}
        >
          😊
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
    "Go to Trips → click + Plan New Trip → choose Social or Business → fill in details or upload a document and our AI will fill it for you! 🗺",
  "How does expense split work?":
    "Tap the ₹ split button in any group chat → enter amount → choose who paid → select who to split with. Everyone sees their share instantly! 💰",
  "What is live coordination?":
    "When your trip starts, activate Live mode. Everyone's location appears on a shared map. Drop meetup pins, set countdown timers, and see who has arrived. Needs a 3-Day Pass or Pro. 📍",
  "How to invite friends?":
    "Open your group → share the invite code or copy the invite link. Friends join instantly by entering the code. No app download needed on web! 👥",
  "What's included in Pro plan?":
    "Pro (₹849/month) includes: unlimited trips, live coordination, receipt scanner, expense export PDF, AI trip planner, and everything in Free. Upgrade in your Profile. ⭐",
};

const BOT_FALLBACK =
  "I don't have an answer for that yet, but our team is working on it! Try one of the suggested questions above. 🙏";

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
      text: "👋 Hi! I'm your Travello assistant. I can help you plan trips, split expenses, find destinations, and more. Try asking me something!",
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
                    text: "👋 Hi! I'm your Travello assistant. I can help you plan trips, split expenses, find destinations, and more. Try asking me something!",
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
        <span className="text-xl" aria-hidden>
          📢
        </span>
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
            🚀 New feature alert! AI Trip Planner is now live. Upload any
            document — screenshot, PDF, Word or Excel — and our AI fills your
            entire trip plan automatically. Try it in Trips → Plan New Trip!
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
            📍 Live Coordination upgrade Meetup pins now show distance in real
            time. When you&apos;re within 100m of the meetup point, you&apos;ll
            see a &apos;You&apos;ve arrived!&apos; celebration. 🎉
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
            👥 Buddy Trips launching soon! Solo traveler? Post a trip listing
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
            💰 Split money in chat You can now split expenses directly from the
            chat box. Tap the ₹ icon in any group chat to split a bill and post
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
        📢 This is an official announcement channel. Only the Travello team can
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
  const [showSearchOverlay, setShowSearchOverlay] = useState(false);
  const [showMenuDrawer, setShowMenuDrawer] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
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
  const [showEmoji, setShowEmoji] = useState(false);
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
      if (meRes.status === 0 || groupsRes.status === 0) {
        showToast(
          "Cannot reach the server. Check that the API is running (e.g. localhost:8000) and try again.",
          "error",
        );
        return;
      }
      if (!meRes.data) {
        showToast("Could not load profile", "error");
        return;
      }
      setUser(meRes.data);
      const gList = groupsRes.data ?? [];

      let enrichUnauthorized = false;
      const enrichedGroups: GroupOut[] = await Promise.all(
        gList.map(async (gFromList) => {
          const memRes = await apiFetchWithStatus<GroupMemberOut[]>(
            `/groups/${gFromList.id}/members`,
          );
          if (memRes.status === 401) {
            enrichUnauthorized = true;
            return { ...gFromList, members: gFromList.members ?? [] };
          }
          if (memRes.status === 200 && memRes.data) {
            return { ...gFromList, members: memRes.data };
          }
          const full = await apiFetchWithStatus<GroupOut>(
            `/groups/${gFromList.id}`,
          );
          if (full.status === 401) {
            enrichUnauthorized = true;
            return { ...gFromList, members: gFromList.members ?? [] };
          }
          if (full.status === 200 && full.data) return full.data;
          return { ...gFromList, members: gFromList.members ?? [] };
        }),
      );
      if (enrichUnauthorized) {
        handleUnauthorized();
        return;
      }
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
      setContacts([...memberSet.values()]);

      const tripLists = await Promise.all(
        enrichedGroups.map((g) =>
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
        for (const g of enrichedGroups) {
          await initGroupChat(db, g, g.members ?? [], meRes.data);
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
        const infoRef = ref(db, `chats/${chatId}/info`);
        const u = onValue(infoRef, (snapInfo) => {
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

      const message: Record<string, unknown> = {
        sender_id: user.id,
        sender_name: user.full_name || "You",
        sender_avatar: avatarUrl,
        text: content,
        type,
        timestamp: Date.now(),
        read_by: { [user.id]: true },
      };
      if (metadata && Object.keys(metadata).length)
        message.metadata = metadata;

      try {
        await push(messagesRef, message);
        await update(ref(db, `chats/${chatId}/info`), {
          last_message:
            type === "text" ? content : `📎 ${type}`,
          last_message_time: Date.now(),
          last_message_sender: user.full_name || "You",
        });
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
      const ids = [user.id, other.id].sort();
      const chatId = `dm_${ids[0]}_${ids[1]}`;
      const chatRef = ref(db, `chats/${chatId}/info`);
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
        updateChatPref(chatId, { lastReadAt: Date.now() });
        loadMessages(chatId);
      } catch (e) {
        console.error(e);
        showToast("Could not open chat", "error");
      }
    },
    [db, user, loadMessages, showToast, updateChatPref],
  );

  const selectChat = useCallback(
    (c: ChatInfo) => {
      setActiveChat(c);
      messagesUnsubRef.current?.();
      messagesUnsubRef.current = null;
      setMessages([]);
      updateChatPref(c.id, { lastReadAt: Date.now() });
      if (c.isBot || c.isAnnouncement || c.isDemo) return;
      loadMessages(c.id);
    },
    [loadMessages, updateChatPref],
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
            void sendMessage("audio", "🎵 Voice message", {
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
            !isMd && activeChat ? "hidden" : "flex"
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
            className="flex shrink-0 items-center justify-between px-4 py-3"
            style={{
              background: BG,
              borderBottom: `0.5px solid ${BORDER_SUB}`,
            }}
          >
            <span className="text-[17px] font-medium text-white">
              Connect
            </span>
            <div className="flex items-center gap-5 text-white">
              <button
                type="button"
                aria-label="Search"
                className="flex items-center justify-center text-white"
                onClick={() => setShowSearchOverlay(true)}
              >
                <SearchIcon />
              </button>
              <button
                type="button"
                aria-label="Menu"
                className="flex items-center justify-center text-white"
                onClick={() => setShowMenuDrawer(true)}
              >
                <MenuIcon />
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
                onNavigateToGroup={(gid) => {
                  router.push(`/groups/${gid}`);
                }}
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
                reloadGroups={loadBackend}
                onUnauthorized={handleUnauthorized}
                updateChatPref={updateChatPref}
                markChatDeleted={markChatDeleted}
                showToast={showToast}
                setContextMenu={setContextMenu}
                longPressTimerRef={longPressTimer}
              />
            ) : null}
            {activeTab === "contacts" ? (
              <HubContactsTab
                contacts={contactsWithGroupCounts}
                onMessage={() => {
                  showToast("Chat coming soon", "success");
                }}
                onOpenDemo={openDemoDm}
                currentUser={user}
              />
            ) : null}
            {activeTab === "calls" ? (
              <HubCallsTab showToast={(m) => showToast(m, "success")} />
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
              <span className="text-6xl leading-none">✈️</span>
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
            <>
            <ChatHeader
              chat={activeChat}
              userId={user?.id}
              onBack={() => setActiveChat(null)}
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
                    <span className="typing-dot inline-block animate-pulse">
                      ●
                    </span>{" "}
                    {typingUsers[0]} is typing…
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
                    className="rounded-lg border px-3 py-1 text-sm text-white"
                    style={{ borderColor: MSG_BORDER }}
                  >
                    ✕ Cancel
                  </button>
                  <button
                    type="button"
                    onClick={stopRecordingSend}
                    className="rounded-lg bg-green-600 px-3 py-1 text-sm font-bold text-white"
                  >
                    ✓ Send
                  </button>
                </div>
              </div>
            ) : (
              <>
                {showEmoji ? (
                  <div
                    className="mx-4 mb-2 grid max-h-36 grid-cols-6 gap-1 overflow-y-auto rounded-xl border p-3 shadow-md"
                    style={{
                      borderColor: MSG_BORDER,
                      background: SURFACE,
                    }}
                  >
                    {EMOJIS.map((em) => (
                      <button
                        key={em}
                        type="button"
                        className="rounded p-1 text-2xl hover:bg-white/10"
                        onClick={() => {
                          setMessageText((p) => p + em);
                          setShowEmoji(false);
                        }}
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                ) : null}

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
                  <button
                    type="button"
                    className="text-xl"
                    onClick={() => setShowEmoji((e) => !e)}
                  >
                    😊
                  </button>
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
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white"
                      style={{ background: ACCENT }}
                      aria-label="Send"
                    >
                      ➤
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="text-xl"
                        onClick={() => setShowAttach(true)}
                      >
                        📎
                      </button>
                      <button
                        type="button"
                        className="text-xl"
                        onClick={startRecording}
                      >
                        🎤
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </>
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
          className="fixed inset-0 z-[360] flex flex-col"
          style={{ background: BG }}
        >
          <div
            className="flex shrink-0 items-center gap-2 px-3 py-3"
            style={{ borderBottom: `0.5px solid ${BORDER_SUB}` }}
          >
            <button
              type="button"
              aria-label="Close search"
              className="px-2 py-1 text-lg text-white"
              onClick={() => setShowSearchOverlay(false)}
            >
              ←
            </button>
            <div
              className="flex min-w-0 flex-1 items-center gap-2 rounded-full px-3 py-2"
              style={{ background: SURFACE }}
            >
              <SearchIcon className="shrink-0 text-slate-400" />
              <input
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search chats..."
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
          <p className="px-4 py-6 text-center text-sm" style={{ color: TEXT_MUTED }}>
            Results update in the Chats / Groups tabs. Tap back to continue.
          </p>
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

function ChatHeader({
  chat,
  onBack,
  groups,
}: {
  chat: ChatInfo;
  userId?: string;
  onBack: () => void;
  groups: GroupOut[];
}) {
  const g = chat.group_id
    ? groups.find((x) => x.id === chat.group_id)
    : undefined;
  const memberCount = g?.members?.length ?? chat.members?.length ?? 0;
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
        ←
      </button>
      {chat.type === "group" ? (
        <span
          className="flex h-12 w-12 items-center justify-center rounded-full text-[15px] font-bold text-white"
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
          className="h-12 w-12 rounded-full"
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
            : "Active now"}
        </p>
      </div>
      <div className="flex gap-2 text-lg" style={{ color: TEXT_MUTED }}>
        <span className="opacity-50">🔍</span>
        <span className="opacity-50" title="Coming soon">
          📞
        </span>
        <span className="opacity-50" title="Coming soon">
          📹
        </span>
        <span>⋮</span>
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
  return (
    <div
      className={`mb-2 flex w-full gap-2 ${mine ? "justify-end" : "justify-start"}`}
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
        <span className="w-7 shrink-0" />
      )}
      <div className="max-w-[70%]">
        {isGroup && !mine ? (
          <p
            className="mb-0.5 text-[11px] font-semibold"
            style={{ color: TEXT_MUTED }}
          >
            {msg.sender_name}
          </p>
        ) : null}
        <div
          className={`rounded-2xl px-3 py-2 ${
            mine
              ? "rounded-br-sm"
              : "rounded-bl-sm"
          }`}
          style={{
            background: mine ? "rgba(220,38,38,0.25)" : SURFACE,
            boxShadow: "0 1px 0.5px rgba(0,0,0,0.2)",
            border: mine ? "none" : `1px solid ${MSG_BORDER}`,
          }}
        >
          {msg.type === "text" ? (
            <p className="text-sm text-slate-100">{msg.text}</p>
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
              <p className="text-sm text-slate-100">📍 {msg.text}</p>
              <p className="text-[11px]" style={{ color: TEXT_MUTED }}>
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
              <p className="text-sm text-slate-100">
                💸 {String(meta?.description ?? msg.text)}
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
              <p className="text-sm text-slate-100">
                ✈️ {String(meta?.trip_name ?? msg.text)}
              </p>
              <p className="text-[11px]" style={{ color: TEXT_MUTED }}>
                {String(meta?.destination ?? "")}
              </p>
              <p className="text-[11px] text-slate-300">
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
            <div className="flex items-center gap-2 text-sm text-slate-200">
              <span>▶️</span>
              <span
                className="h-8 flex-1 rounded"
                style={{ background: MSG_BORDER }}
              />
              <span className="text-[11px]">{String(meta?.duration ?? "")}</span>
            </div>
          ) : null}
          <div
            className="mt-1 flex justify-end gap-1 text-[10px]"
            style={{ color: TEXT_MUTED }}
          >
            {new Date(msg.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
            {mine ? <span>✓✓</span> : null}
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
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-purple-500 text-2xl text-white">
            📷
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
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-orange-500 text-2xl text-white">
            🎵
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
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-green-600 text-2xl text-white">
            📍
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
            className="flex h-14 w-14 items-center justify-center rounded-full text-2xl text-white"
            style={{ background: ACCENT }}
          >
            💸
          </span>
          <span className="text-[11px] text-slate-200">Split Expense</span>
        </button>
        <button
          type="button"
          className="flex flex-col items-center gap-1"
          onClick={() => setShowTrips((s) => !s)}
        >
          <span
            className="flex h-14 w-14 items-center justify-center rounded-full text-2xl text-white"
            style={{ background: "#1E3A5F" }}
          >
            ✈️
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
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-600 text-2xl text-white">
            🗺️
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
          className="text-xl text-white"
        >
          ←
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
          className="mb-4 w-full rounded-xl py-3 text-sm font-bold text-white"
          style={{ background: ACCENT }}
        >
          👥 New Group Chat
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
