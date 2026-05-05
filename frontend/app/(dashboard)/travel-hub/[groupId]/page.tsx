"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getDatabase,
  ref,
  push,
  onValue,
  set,
  update,
  get,
  remove,
  query,
  orderByChild,
  limitToLast,
  type Database,
} from "firebase/database";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  Banknote,
  Bot,
  Camera,
  CheckCheck,
  ChevronLeft,
  FileText,
  Image as ImageIcon,
  Keyboard,
  Link2,
  MapPin,
  Mic,
  MoreVertical,
  Music,
  Paperclip,
  Phone,
  Pin,
  Plane,
  Smile,
  Tag,
  Video,
} from "lucide-react";

import { apiFetch } from "@/lib/api";

const CRIMSON = "#DC2626";
const NAVY_TOP = "#0F172A";
const BORDER = "#1E293B";
const CHAT_BG_DEFAULT = "#0A0F1E";
const MUTED = "#64748B";
const SLATE_TEXT = "#94A3B8";

const QUICK_TEXT_CHIPS = [
  "OK",
  "Thanks",
  "Hi",
  "On my way",
  "Yes",
  "No",
  "Sounds good",
  "See you",
  "Done",
  "Maybe",
  "Call me",
  "Running late",
  "Arrived",
  "Stuck in traffic",
] as const;

const REACTION_CHIPS = ["+1", "Thanks", "Haha", "Fire", "Wow"] as const;

type ChatThemePreset = {
  id: string;
  label: string;
  bg: string;
  sent: string;
  recv: string;
};

const THEME_PRESETS: ChatThemePreset[] = [
  { id: "default", label: "Default Dark", bg: "#0A0F1E", sent: "#DC2626", recv: "#1E293B" },
  { id: "ocean", label: "Ocean Night", bg: "#0C1A2E", sent: "#0369A1", recv: "#1E3A5F" },
  { id: "forest", label: "Forest", bg: "#052E16", sent: "#15803D", recv: "#1A3A2A" },
  { id: "sunset", label: "Sunset", bg: "#1C0A00", sent: "#B45309", recv: "#292524" },
  { id: "lavender", label: "Lavender Night", bg: "#0F0A1E", sent: "#7C3AED", recv: "#1E1B4B" },
  { id: "mono", label: "Monochrome", bg: "#111827", sent: "#374151", recv: "#1F2937" },
];

type UserMe = { id: string; full_name: string | null; username?: string | null };
type GroupMemberOut = {
  id: string;
  user_id: string;
  full_name: string;
  avatar_url?: string | null;
};
type GroupOut = {
  id: string;
  name: string;
  description: string | null;
  members: GroupMemberOut[];
};
type TripOut = { id: string; group_id: string; title: string };

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
};

type MenuItem = {
  label: string;
  fn: () => void;
  icon?: string;
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
  reactions?: Record<string, string[]>;
};

type PollOption = { id: string; label: string; votes: string[] };

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function initFirebase(): { app: FirebaseApp | null; db: Database | null; ok: boolean } {
  if (typeof window === "undefined") return { app: null, db: null, ok: false };
  if (!firebaseConfig.databaseURL || !firebaseConfig.apiKey)
    return { app: null, db: null, ok: false };
  try {
    const app =
      getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]!;
    return { app, db: getDatabase(app), ok: true };
  } catch {
    return { app: null, db: null, ok: false };
  }
}

function getDiceBearUrl(seed: string): string {
  return `https://api.dicebear.com/7.x/lorelei/svg?seed=${encodeURIComponent(seed)}`;
}

function firstLetter(name: string): string {
  const t = name.trim();
  return t ? t[0]!.toUpperCase() : "?";
}

function getDateLabel(timestamp: number): string {
  const d = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function shouldShowDateSeparator(messages: ChatMessage[], index: number): boolean {
  if (index === 0) return true;
  const curr = messages[index];
  const prev = messages[index - 1];
  if (!curr?.timestamp || !prev?.timestamp) return true;
  return new Date(curr.timestamp).toDateString() !== new Date(prev.timestamp).toDateString();
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function renderFormattedText(text: string, color: string): ReactNode {
  const parts: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  const pushPlain = (s: string) => {
    if (s) parts.push(<span key={key++}>{s}</span>);
  };
  while (i < text.length) {
    const bold = text.indexOf("**", i);
    const italic = text.indexOf("__", i);
    const strike = text.indexOf("~~", i);
    const candidates = [bold, italic, strike].filter((x) => x >= 0);
    if (candidates.length === 0) {
      pushPlain(text.slice(i));
      break;
    }
    const next = Math.min(...candidates);
    pushPlain(text.slice(i, next));
    if (text.startsWith("**", next)) {
      const end = text.indexOf("**", next + 2);
      if (end < 0) {
        pushPlain(text.slice(next));
        break;
      }
      parts.push(
        <strong key={key++} className="font-semibold">
          {text.slice(next + 2, end)}
        </strong>,
      );
      i = end + 2;
    } else if (text.startsWith("__", next)) {
      const end = text.indexOf("__", next + 2);
      if (end < 0) {
        pushPlain(text.slice(next));
        break;
      }
      parts.push(
        <em key={key++} className="italic">
          {text.slice(next + 2, end)}
        </em>,
      );
      i = end + 2;
    } else {
      const end = text.indexOf("~~", next + 2);
      if (end < 0) {
        pushPlain(text.slice(next));
        break;
      }
      parts.push(
        <span key={key++} className="line-through opacity-90">
          {text.slice(next + 2, end)}
        </span>,
      );
      i = end + 2;
    }
  }
  return (
    <span className="text-[14px] leading-[1.5]" style={{ color }}>
      {parts}
    </span>
  );
}

function readReceiptIcon(
  mine: boolean,
  readBy: Record<string, boolean> | undefined,
  senderId: string,
  memberIds: string[],
): ReactNode {
  if (!mine) return null;
  const othersRead = memberIds.some((id) => id !== senderId && readBy?.[id]);
  const cls = "h-3 w-3";
  if (othersRead)
    return (
      <span className="inline-flex text-sky-400">
        <CheckCheck className={cls} strokeWidth={1.5} aria-hidden />
      </span>
    );
  return (
    <span className="inline-flex text-[#64748B]">
      <CheckCheck className={cls} strokeWidth={1.5} aria-hidden />
    </span>
  );
}

export default function GroupChatPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = String(params.groupId ?? "");

  const [db, setDb] = useState<Database | null>(null);
  const [firebaseOk, setFirebaseOk] = useState(false);
  const [user, setUser] = useState<UserMe | null>(null);
  const [group, setGroup] = useState<GroupOut | null>(null);
  const [trips, setTrips] = useState<TripOut[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageText, setMessageText] = useState("");
  const [loading, setLoading] = useState(true);

  const [menuOpen, setMenuOpen] = useState(false);
  const [groupInfoOpen, setGroupInfoOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [emojiPanelOpen, setEmojiPanelOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [splitOpen, setSplitOpen] = useState(false);
  const [pollCreatorOpen, setPollCreatorOpen] = useState(false);
  const [stickerPanelOpen, setStickerPanelOpen] = useState(false);
  const [linkPasteOpen, setLinkPasteOpen] = useState(false);
  const [expenseDetail, setExpenseDetail] = useState<Record<string, unknown> | null>(null);
  const [confirmModal, setConfirmModal] = useState<"clear" | "exit" | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState("");

  const [chatTheme, setChatTheme] = useState<ChatThemePreset>(THEME_PRESETS[0]!);
  const [wallpaperUrl, setWallpaperUrl] = useState<string | null>(null);

  const [pinned, setPinned] = useState<{ id: string; preview: string } | null>(null);
  const [groupStatus, setGroupStatus] = useState<{
    name: string;
    text: string;
    avatars: string[];
  } | null>(null);

  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "err" } | null>(null);
  const [tooltip, setTooltip] = useState<string | null>(null);

  const [contextMsg, setContextMsg] = useState<ChatMessage | null>(null);
  const [reactPickerFor, setReactPickerFor] = useState<string | null>(null);

  const [pollQ, setPollQ] = useState("");
  const [pollA, setPollA] = useState("");
  const [pollB, setPollB] = useState("");

  const [splitDesc, setSplitDesc] = useState("");
  const [splitAmount, setSplitAmount] = useState("");
  const [splitChecked, setSplitChecked] = useState<Record<string, boolean>>({});
  const [splitPosting, setSplitPosting] = useState(false);

  const [linkUrl, setLinkUrl] = useState("");

  const [isRecording, setIsRecording] = useState(false);
  const [recordMs, setRecordMs] = useState(0);
  const [recordCancelSlide, setRecordCancelSlide] = useState(false);
  const recordCancelSlideRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordMsAccumRef = useRef(0);
  const recordIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordStartXRef = useRef(0);
  const pointerDownRef = useRef(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesUnsubRef = useRef<(() => void) | null>(null);

  const chatId = `group_${groupId}`;

  const showToast = useCallback((msg: string, kind: "ok" | "err" = "ok") => {
    setToast({ msg, kind });
    globalThis.setTimeout(() => setToast(null), 2800);
  }, []);

  useEffect(() => {
    const { db: d, ok } = initFirebase();
    setDb(d);
    setFirebaseOk(ok);
  }, []);

  useEffect(() => {
    const themeKey = `chat_theme_${groupId}`;
    const bgKey = `chat_bg_${groupId}`;
    try {
      const raw = localStorage.getItem(themeKey);
      if (raw) {
        const p = JSON.parse(raw) as ChatThemePreset;
        if (p?.bg && p?.sent && p?.recv) setChatTheme(p);
      }
      const wp = localStorage.getItem(bgKey);
      if (wp) setWallpaperUrl(wp);
    } catch {
      /* ignore */
    }
  }, [groupId]);

  const persistTheme = useCallback(
    (t: ChatThemePreset) => {
      setChatTheme(t);
      localStorage.setItem(`chat_theme_${groupId}`, JSON.stringify(t));
    },
    [groupId],
  );

  const onWallpaper = useCallback(
    (file: File | null) => {
      if (!file) return;
      const r = new FileReader();
      r.onload = () => {
        const u = String(r.result);
        setWallpaperUrl(u);
        localStorage.setItem(`chat_bg_${groupId}`, u);
      };
      r.readAsDataURL(file);
    },
    [groupId],
  );

  const removeWallpaper = useCallback(() => {
    setWallpaperUrl(null);
    localStorage.removeItem(`chat_bg_${groupId}`);
  }, [groupId]);

  useEffect(() => {
    if (!groupId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [me, g, tripList] = await Promise.all([
          apiFetch<UserMe>("/auth/me"),
          apiFetch<GroupOut>(`/groups/${groupId}`),
          apiFetch<TripOut[]>(`/groups/${groupId}/trips`),
        ]);
        if (cancelled) return;
        setUser(me);
        setGroup(g);
        setTrips(tripList);
        const sc: Record<string, boolean> = {};
        for (const m of g.members) sc[m.user_id] = true;
        setSplitChecked(sc);
      } catch (e) {
        if (!cancelled) {
          showToast(e instanceof Error ? e.message : "Failed to load", "err");
          router.push("/travel-hub");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [groupId, router, showToast]);

  const initChat = useCallback(
    async (database: Database, g: GroupOut, current: UserMe) => {
      const chatRef = ref(database, `chats/${chatId}/info`);
      try {
        const snapshot = await get(chatRef);
        const memberIds = g.members.map((m) => m.user_id);
        if (!snapshot.exists()) {
          await set(chatRef, {
            id: chatId,
            name: g.name,
            type: "group",
            group_id: g.id,
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
        console.warn("initChat", e);
      }
    },
    [chatId],
  );

  useEffect(() => {
    if (!db || !user || !group) return;
    void initChat(db, group, user);
  }, [db, user, group, initChat]);

  const loadMessages = useCallback(() => {
    if (!db) return;
    messagesUnsubRef.current?.();
    const messagesRef = ref(db, `chats/${chatId}/messages`);
    const qy = query(messagesRef, orderByChild("timestamp"), limitToLast(200));
    const unsub = onValue(qy, (snapshot) => {
      const msgs: ChatMessage[] = [];
      snapshot.forEach((child) => {
        const v = child.val() as Omit<ChatMessage, "id">;
        msgs.push({
          id: child.key ?? "",
          ...v,
          timestamp: typeof v.timestamp === "number" ? v.timestamp : Date.now(),
        });
      });
      msgs.sort((a, b) => a.timestamp - b.timestamp);
      setMessages(msgs);
      globalThis.setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 60);
    });
    messagesUnsubRef.current = unsub;
  }, [db, chatId]);

  useEffect(() => {
    loadMessages();
    return () => messagesUnsubRef.current?.();
  }, [loadMessages]);

  useEffect(() => {
    if (!db) return;
    const pRef = ref(db, `chats/${chatId}/meta/pinned`);
    const sRef = ref(db, `chats/${chatId}/meta/group_status`);
    const u1 = onValue(pRef, (s) => {
      const v = s.val() as { id?: string; preview?: string } | null;
      if (v?.id && v.preview) setPinned({ id: v.id, preview: v.preview });
      else setPinned(null);
    });
    const u2 = onValue(sRef, (s) => {
      const v = s.val() as {
        name?: string;
        text?: string;
        avatars?: string[];
      } | null;
      if (v?.text && v?.name)
        setGroupStatus({
          name: v.name,
          text: v.text,
          avatars: v.avatars ?? [],
        });
      else setGroupStatus(null);
    });
    return () => {
      u1();
      u2();
    };
  }, [db, chatId]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const memberIds = useMemo(() => group?.members.map((m) => m.user_id) ?? [], [group]);
  const onlineCount = 2;
  const headerSubtitle = group
    ? `${group.members.length} members · ${onlineCount} online`
    : "";

  const currentTripId = trips[0]?.id ?? null;

  const sendMessage = useCallback(
    async (
      type: string,
      content: string,
      metadata?: Record<string, unknown> | null,
      opt?: { skipClear?: boolean },
    ) => {
      if (!db || !user) return;
      if (type === "text" && !content.trim()) return;
      const messagesRef = ref(db, `chats/${chatId}/messages`);
      const seed = user.username || user.full_name || user.id;
      const avatarUrl = getDiceBearUrl(seed);
      const payload: Record<string, unknown> = {
        sender_id: user.id,
        sender_name: user.full_name || "You",
        sender_avatar: avatarUrl,
        text: content,
        type,
        timestamp: Date.now(),
        read_by: { [user.id]: true },
        reactions: {},
      };
      if (metadata && Object.keys(metadata).length) payload.metadata = metadata;
      try {
        const newRef = await push(messagesRef, payload);
        const key = newRef.key;
        await update(ref(db, `chats/${chatId}/info`), {
          last_message:
            type === "text" ? content.slice(0, 80) : `Attachment (${type})`,
          last_message_time: Date.now(),
          last_message_sender: user.full_name || "You",
        });
        if (!opt?.skipClear) {
          setMessageText("");
          setEmojiPanelOpen(false);
          setAttachOpen(false);
        }
        if (type === "text" && content.trim().startsWith("#") && key) {
          globalThis.setTimeout(() => {
            update(ref(db, `chats/${chatId}/messages/${key}`), {
              "metadata/ai_reply":
                "Here’s a quick suggestion based on your command. (Demo reply — connect an AI backend for real responses.)",
            }).catch(() => {});
          }, 900);
        }
      } catch (e) {
        console.error(e);
        showToast("Could not send message", "err");
      }
    },
    [db, user, chatId, showToast],
  );

  const markRead = useCallback(() => {
    if (!db || !user || messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (!last?.id || last.sender_id === user.id) return;
    update(ref(db, `chats/${chatId}/messages/${last.id}/read_by`), {
      [user.id]: true,
    }).catch(() => {});
  }, [db, user, messages, chatId]);

  useEffect(() => {
    markRead();
  }, [markRead, messages.length]);

  const jumpToPinned = useCallback(() => {
    if (!pinned?.id) return;
    const el = document.querySelector(`[data-msg-id="${pinned.id}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [pinned]);

  const handleInputChange = (v: string) => {
    setMessageText(v);
    if (v.endsWith("**")) setTooltip("Wrap with ** for bold");
    else if (v.endsWith("__")) setTooltip("Wrap with __ for italic");
    else setTooltip(null);
    if (v.trim() === "/poll") {
      setPollCreatorOpen(true);
      setMessageText("");
      setTooltip(null);
    }
  };

  const onVote = useCallback(
    (msg: ChatMessage, optionId: string) => {
      if (!db || !user) return;
      const meta = (msg.metadata ?? {}) as {
        options?: PollOption[];
        closed?: boolean;
      };
      const opts = meta.options ?? [];
      const next = opts.map((o) => {
        if (o.id !== optionId) return o;
        const votes = o.votes.filter((id) => id !== user.id);
        votes.push(user.id);
        return { ...o, votes };
      });
      update(ref(db, `chats/${chatId}/messages/${msg.id}`), {
        metadata: { ...meta, options: next },
      }).catch(() => {});
    },
    [db, user, chatId],
  );

  const pinMessage = useCallback(
    async (msg: ChatMessage) => {
      if (!db || !msg.text) return;
      const preview =
        msg.text.length > 40 ? `${msg.text.slice(0, 40)}…` : msg.text;
      await set(ref(db, `chats/${chatId}/meta/pinned`), {
        id: msg.id,
        preview,
      });
      showToast("Message pinned");
    },
    [db, chatId, showToast],
  );

  const clearChat = useCallback(async () => {
    if (!db) return;
    try {
      await remove(ref(db, `chats/${chatId}/messages`));
      await remove(ref(db, `chats/${chatId}/meta/pinned`));
      setConfirmModal(null);
      showToast("Chat cleared");
    } catch {
      showToast("Could not clear chat", "err");
    }
  }, [db, chatId, showToast]);

  const copyText = (t: string) => {
    void navigator.clipboard.writeText(t);
    showToast("Copied");
  };

  const postSplitExpense = useCallback(async () => {
    if (!currentTripId) {
      showToast("Create a trip for this group to post expenses", "err");
      return;
    }
    const amt = parseFloat(splitAmount);
    if (!splitDesc.trim() || !Number.isFinite(amt) || amt <= 0) {
      showToast("Enter description and amount", "err");
      return;
    }
    const splitWith = Object.entries(splitChecked)
      .filter(([, on]) => on)
      .map(([uid]) => uid);
    if (splitWith.length < 1) {
      showToast("Select at least one person", "err");
      return;
    }
    setSplitPosting(true);
    try {
      const created = await apiFetch<{
        id: string;
        amount: number;
        currency: string;
        paid_by: string;
        description: string;
        splits: { user_id: string; amount: number }[];
      }>(`/trips/${currentTripId}/expenses`, {
        method: "POST",
        body: JSON.stringify({
          description: splitDesc.trim().slice(0, 300),
          amount: amt,
          currency: "INR",
          split_with: splitWith,
        }),
      });
      const payer = group?.members.find((m) => m.user_id === created.paid_by);
      const mySplit =
        created.splits.find((s) => s.user_id === user?.id)?.amount ?? 0;
      const othersOweYou = created.splits
        .filter((s) => s.user_id !== user?.id)
        .reduce((a, s) => a + s.amount, 0);
      const iAmPayer = created.paid_by === user?.id;
      await sendMessage(
        "expense",
        created.description,
        {
          expense_id: created.id,
          trip_id: currentTripId,
          title: created.description,
          total: created.amount,
          currency: created.currency,
          paid_by_id: created.paid_by,
          paid_by_name: payer?.full_name ?? "Someone",
          paid_by_avatar: payer
            ? getDiceBearUrl(payer.full_name)
            : getDiceBearUrl("?"),
          split_count: created.splits.length,
          per_person: created.amount / Math.max(created.splits.length, 1),
          your_share: mySplit,
          you_owe: iAmPayer ? false : true,
          you_get_amount: iAmPayer ? othersOweYou : 0,
          you_owe_amount: iAmPayer ? 0 : mySplit,
        },
        { skipClear: true },
      );
      setSplitOpen(false);
      setSplitDesc("");
      setSplitAmount("");
      showToast(`₹${created.amount} split posted to chat`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Expense failed", "err");
    } finally {
      setSplitPosting(false);
    }
  }, [
    currentTripId,
    splitAmount,
    splitDesc,
    splitChecked,
    group,
    user,
    sendMessage,
    showToast,
  ]);

  const startRecord = useCallback(() => {
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        streamRef.current = stream;
        const chunks: BlobPart[] = [];
        const rec = new MediaRecorder(stream);
        mediaRecorderRef.current = rec;
        setIsRecording(true);
        setRecordMs(0);
        recordMsAccumRef.current = 0;
        recordCancelSlideRef.current = false;
        setRecordCancelSlide(false);
        recordIntervalRef.current = setInterval(() => {
          recordMsAccumRef.current += 1000;
          setRecordMs(recordMsAccumRef.current);
        }, 1000);
        rec.ondataavailable = (e) => {
          if (e.data.size) chunks.push(e.data);
        };
        rec.onstop = () => {
          const cancelled = recordCancelSlideRef.current;
          const elapsed = recordMsAccumRef.current;
          if (cancelled) {
            stream.getTracks().forEach((t) => t.stop());
            setIsRecording(false);
            recordCancelSlideRef.current = false;
            setRecordCancelSlide(false);
            if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
            return;
          }
          const blob = new Blob(chunks, { type: "audio/webm" });
          const reader = new FileReader();
          reader.onloadend = () => {
            const dur = `${Math.floor(elapsed / 60000)}:${String(Math.floor((elapsed % 60000) / 1000)).padStart(2, "0")}`;
            void sendMessage("audio", "Voice message", {
              url: reader.result,
              duration: dur,
            });
          };
          reader.readAsDataURL(blob);
          stream.getTracks().forEach((t) => t.stop());
          setIsRecording(false);
          if (recordIntervalRef.current) {
            clearInterval(recordIntervalRef.current);
            recordIntervalRef.current = null;
          }
        };
        rec.start();
      })
      .catch(() => showToast("Microphone denied", "err"));
  }, [sendMessage, showToast]);

  const stopRecordSend = useCallback(() => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
  }, []);

  const cancelRecord = useCallback(() => {
    recordCancelSlideRef.current = true;
    setRecordCancelSlide(true);
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
  }, []);

  const onVoicePointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    pointerDownRef.current = true;
    recordStartXRef.current = e.clientX;
    longPressTimer.current = setTimeout(() => {
      if (pointerDownRef.current) startRecord();
    }, 200);
  };
  const onVoicePointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!isRecording) return;
    if (recordStartXRef.current - e.clientX > 80) {
      recordCancelSlideRef.current = true;
      setRecordCancelSlide(true);
    }
  };
  const onVoicePointerUp = () => {
    pointerDownRef.current = false;
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (isRecording) {
      if (recordCancelSlide) cancelRecord();
      else stopRecordSend();
    }
  };

  const stickers = useMemo(() => {
    try {
      const raw = localStorage.getItem(`stickers_${groupId}`);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  }, [groupId, stickerPanelOpen]);

  const addSticker = useCallback(
    (dataUrl: string) => {
      const next = [...stickers, dataUrl];
      localStorage.setItem(`stickers_${groupId}`, JSON.stringify(next));
      void sendMessage("sticker", "", { url: dataUrl });
      setStickerPanelOpen(false);
    },
    [stickers, groupId, sendMessage],
  );

  const filteredMessages = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter((m) => (m.text ?? "").toLowerCase().includes(q));
  }, [messages, searchQ]);

  const chatAreaStyle: CSSProperties = {
    backgroundColor: wallpaperUrl ? undefined : chatTheme.bg,
    backgroundImage: wallpaperUrl ? `url(${wallpaperUrl})` : undefined,
    backgroundSize: "cover",
    backgroundPosition: "center",
  };

  if (loading || !group) {
    return (
      <div
        className="flex animate-pulse flex-col gap-2 p-4"
        style={{ height: "calc(100vh - 60px)", background: CHAT_BG_DEFAULT }}
      >
        <div className="h-16 rounded-lg bg-[#1E293B]" />
        <div className="min-h-0 flex-1 rounded-lg bg-[#0F172A]" />
      </div>
    );
  }

  return (
    <div
      className="flex w-full flex-col overflow-hidden text-white"
      style={{ height: "calc(100vh - 60px)", background: CHAT_BG_DEFAULT }}
    >
      {!firebaseOk ? (
        <div className="shrink-0 border-b border-amber-700/50 bg-amber-950/40 px-3 py-2 text-center text-[11px] text-amber-100">
          Add <code className="rounded bg-black/30 px-1">NEXT_PUBLIC_FIREBASE_*</code> for
          live chat.
        </div>
      ) : null}

      {/* —— Section A: Top bar —— */}
      <header
        className="relative z-20 flex h-16 shrink-0 items-center gap-3 border-b px-3 pr-4"
        style={{
          background: NAVY_TOP,
          borderBottom: "0.5px solid #1E293B",
        }}
      >
        <button
          type="button"
          aria-label="Back"
          className="text-xl text-white/90"
          onClick={() => router.push("/travel-hub")}
        >
          <ChevronLeft className="h-6 w-6" strokeWidth={1.5} />
        </button>
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          onClick={() => setGroupInfoOpen(true)}
        >
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
            style={{ background: CRIMSON }}
          >
            {firstLetter(group.name)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-medium text-white">{group.name}</p>
            <p className="truncate text-xs" style={{ color: MUTED }}>
              {headerSubtitle}
            </p>
          </div>
        </button>
        <div className="flex shrink-0 items-center gap-4 text-[#94A3B8]">
          <button
            type="button"
            aria-label="Video call"
            className="text-lg"
            onClick={() => showToast("Video call coming soon")}
          >
            <Video className="h-5 w-5" strokeWidth={1.5} />
          </button>
          <button
            type="button"
            aria-label="Voice call"
            className="text-lg"
            onClick={() => showToast("Voice call coming soon")}
          >
            <Phone className="h-5 w-5" strokeWidth={1.5} />
          </button>
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              className="text-xl"
              aria-label="Menu"
              onClick={() => setMenuOpen((o) => !o)}
            >
              <MoreVertical className="h-5 w-5" strokeWidth={1.5} />
            </button>
            {menuOpen ? (
              <div
                className="absolute right-0 top-full z-50 mt-2 min-w-[220px] rounded-xl py-1 shadow-lg"
                style={{
                  background: "#1E293B",
                  border: "0.5px solid #334155",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
                }}
              >
                {(
                  [
                    {
                      label: "Add to a list",
                      fn: () => showToast("Added to list (demo)"),
                    },
                    { label: "Group info", fn: () => setGroupInfoOpen(true) },
                    {
                      label: "Group media",
                      fn: () => showToast("Open media gallery (demo)"),
                    },
                    { label: "Search in chat", fn: () => setSearchOpen(true) },
                    {
                      label: "Mute notifications",
                      fn: () => showToast("Notifications muted (local)"),
                    },
                    {
                      label: "Notification settings",
                      fn: () => showToast("Opening settings (demo)"),
                    },
                    {
                      label: "Chat theme",
                      fn: () => {
                        setThemeOpen(true);
                        setMenuOpen(false);
                      },
                    },
                    {
                      label: "Clear chat",
                      fn: () => {
                        setConfirmModal("clear");
                        setMenuOpen(false);
                      },
                    },
                    {
                      label: "Add shortcut",
                      fn: () => showToast("Shortcut added (demo)"),
                    },
                    {
                      label: "Report group",
                      fn: () => showToast("Report submitted (demo)"),
                    },
                    {
                      label: "Exit group",
                      fn: () => {
                        setConfirmModal("exit");
                        setMenuOpen(false);
                      },
                    },
                  ] satisfies MenuItem[]
                ).map(({ label, fn }) => (
                  <button
                    key={label}
                    type="button"
                    className="flex h-11 w-full items-center px-4 text-left text-sm text-white/90 hover:bg-white/5"
                    onClick={() => {
                      fn();
                      setMenuOpen(false);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {/* Status strip */}
      <div
        className="z-10 flex min-h-10 shrink-0 items-center gap-3 border-b px-4 text-xs"
        style={{ borderBottom: "0.5px solid #1E293B", background: "transparent" }}
      >
        {pinned ? (
          <button
            type="button"
            className="flex max-w-[60%] items-center gap-1 truncate text-left"
            style={{ color: SLATE_TEXT }}
            onClick={jumpToPinned}
          >
            <Pin className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} aria-hidden />
            <span className="truncate">&quot;{pinned.preview}&quot;</span>
          </button>
        ) : null}
        {groupStatus ? (
          <div className="flex flex-1 items-center justify-end gap-2 truncate">
            <div className="flex -space-x-2">
              {groupStatus.avatars.slice(0, 3).map((s, i) => (
                <img
                  key={i}
                  src={s}
                  alt=""
                  className="h-6 w-6 rounded-full border border-[#0A0F1E]"
                  width={24}
                  height={24}
                />
              ))}
            </div>
            <span className="truncate" style={{ color: MUTED }}>
              {groupStatus.name} set a group status
            </span>
          </div>
        ) : null}
      </div>

      {/* —— Section B: Messages —— */}
      <div
        ref={listRef}
        className="min-h-0 flex-1 overflow-y-auto px-4 py-3"
        style={chatAreaStyle}
      >
        {filteredMessages.map((m, i) => {
          const showSep = shouldShowDateSeparator(filteredMessages, i);
          const mine = m.sender_id === user?.id;
          const isGroup = true;
          return (
            <div key={m.id || i} data-msg-id={m.id}>
              {showSep ? (
                <div className="my-3 flex justify-center">
                  <span
                    className="rounded-full px-3 py-1 text-xs"
                    style={{ background: "#1E293B", color: SLATE_TEXT }}
                  >
                    {getDateLabel(m.timestamp)}
                  </span>
                </div>
              ) : null}
              <MessageRow
                msg={m}
                mine={mine}
                isGroup={isGroup}
                themeRecv={chatTheme.recv}
                themeSent={chatTheme.sent}
                memberIds={memberIds}
                onLongPress={() => setContextMsg(m)}
                onReact={() => setReactPickerFor(m.id)}
                onVote={(oid) => onVote(m, oid)}
                userId={user?.id ?? ""}
                onExpenseClick={() => setExpenseDetail(m.metadata ?? {})}
              />
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* —— Section C: Input —— */}
      {isRecording ? (
        <div
          className="flex shrink-0 items-center justify-between border-t px-3 py-3"
          style={{
            background: "#0A0F1E",
            borderTop: "0.5px solid #1E293B",
          }}
        >
          <span className="flex items-center gap-2 text-sm" style={{ color: CRIMSON }}>
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-60" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-red-600" />
            </span>
            Recording {Math.floor(recordMs / 1000)}s — slide left to cancel
          </span>
          <button type="button" className="text-sm text-[#94A3B8]" onClick={cancelRecord}>
            Cancel
          </button>
        </div>
      ) : (
        <div
          className="flex shrink-0 flex-col"
          style={{
            background: "#0A0F1E",
            borderTop: "0.5px solid #1E293B",
            minHeight: 56,
            padding: "8px 12px",
          }}
        >
          {emojiPanelOpen ? (
            <div
              className="mb-2 grid max-h-[240px] shrink-0 grid-cols-4 gap-1 overflow-y-auto rounded-xl border p-2 sm:grid-cols-6"
              style={{ borderColor: BORDER, background: NAVY_TOP }}
            >
              {QUICK_TEXT_CHIPS.map((em) => (
                <button
                  key={em}
                  type="button"
                  className="rounded px-1.5 py-1 text-[11px] text-white/90 hover:bg-white/10"
                  onClick={() => {
                    setMessageText((p) => (p ? `${p} ${em}` : em));
                    setEmojiPanelOpen(false);
                  }}
                >
                  {em}
                </button>
              ))}
              <button
                type="button"
                className="col-span-full mt-1 flex items-center justify-center gap-1 rounded-lg py-2 text-center text-xs text-[#94A3B8]"
                onClick={() => setEmojiPanelOpen(false)}
              >
                <Keyboard className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
                Show keyboard
              </button>
            </div>
          ) : null}

          {attachOpen ? (
            <AttachSheet
              onClose={() => setAttachOpen(false)}
              onPhoto={(f) => {
                const r = new FileReader();
                r.onload = () => void sendMessage("image", "", { url: r.result });
                r.readAsDataURL(f);
              }}
              onDoc={(f) =>
                void sendMessage("document", f.name, { name: f.name, size: f.size })
              }
              onLocation={() => {
                navigator.geolocation.getCurrentPosition(
                  (pos) =>
                    void sendMessage("location", "Shared location", {
                      lat: pos.coords.latitude,
                      lon: pos.coords.longitude,
                    }),
                  () => showToast("Location denied", "err"),
                );
              }}
              onAudio={() => {
                setAttachOpen(false);
                startRecord();
              }}
              onSticker={() => {
                setAttachOpen(false);
                setStickerPanelOpen(true);
              }}
              onLink={() => {
                setAttachOpen(false);
                setLinkPasteOpen(true);
              }}
            />
          ) : null}

          <div className="flex items-end gap-2">
            <div className="flex shrink-0 items-center gap-2 pb-2">
              <button
                type="button"
                className="text-xl"
                onClick={() => {
                  setEmojiPanelOpen((e) => !e);
                  setAttachOpen(false);
                }}
              >
                <Smile className="h-5 w-5 text-[#94A3B8]" strokeWidth={1.5} />
              </button>
              <button
                type="button"
                className="text-xl"
                onClick={() => {
                  setAttachOpen((e) => !e);
                  setEmojiPanelOpen(false);
                }}
              >
                <Paperclip className="h-5 w-5 text-[#94A3B8]" strokeWidth={1.5} />
              </button>
            </div>
            <div className="relative min-w-0 flex-1">
              {tooltip ? (
                <div className="absolute -top-7 left-2 z-10 rounded-md bg-black/80 px-2 py-0.5 text-[10px] text-white">
                  {tooltip}
                </div>
              ) : null}
              <textarea
                ref={inputRef}
                rows={1}
                value={messageText}
                onChange={(e) => {
                  const el = e.target;
                  handleInputChange(el.value);
                  el.style.height = "auto";
                  el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
                }}
                placeholder="Message..."
                className="max-h-[120px] min-h-[44px] w-full resize-none rounded-[24px] px-4 py-2.5 text-[14px] text-white outline-none placeholder:text-[#64748B]"
                style={{ background: "#1E293B" }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void sendMessage("text", messageText);
                  }
                }}
              />
            </div>
            <div className="flex shrink-0 items-center gap-2 pb-2">
              <button
                type="button"
                className="text-lg font-semibold"
                style={{ color: CRIMSON }}
                onClick={() => setSplitOpen(true)}
              >
                ₹
              </button>
              <label className="inline-flex cursor-pointer items-center text-xl text-[#94A3B8]">
                <Camera className="h-5 w-5" strokeWidth={1.5} />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const r = new FileReader();
                    r.onload = () => void sendMessage("image", "", { url: r.result });
                    r.readAsDataURL(f);
                  }}
                />
              </label>
              <button
                type="button"
                className="touch-none text-xl"
                onPointerDown={onVoicePointerDown}
                onPointerMove={onVoicePointerMove}
                onPointerUp={onVoicePointerUp}
                onPointerLeave={onVoicePointerUp}
              >
                <Mic className="h-5 w-5 text-[#94A3B8]" strokeWidth={1.5} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Group info panel */}
      {groupInfoOpen ? (
        <div className="fixed inset-0 z-[100] flex justify-end bg-black/50" onClick={() => setGroupInfoOpen(false)}>
          <div
            className="h-full w-full max-w-sm overflow-y-auto p-5 shadow-xl"
            style={{ background: NAVY_TOP }}
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button" className="mb-4 inline-flex text-lg text-white" onClick={() => setGroupInfoOpen(false)}>
              <ChevronLeft className="h-6 w-6" strokeWidth={1.5} />
            </button>
            <div className="mb-4 flex flex-col items-center gap-2">
              <span
                className="flex h-20 w-20 items-center justify-center rounded-full text-2xl font-bold text-white"
                style={{ background: CRIMSON }}
              >
                {firstLetter(group.name)}
              </span>
              <h2 className="text-lg font-semibold">{group.name}</h2>
              <p className="text-center text-sm" style={{ color: MUTED }}>
                {group.description || "No description"}
              </p>
            </div>
            <p className="mb-2 text-xs font-bold uppercase" style={{ color: MUTED }}>
              Members
            </p>
            <ul className="space-y-2">
              {group.members.map((m) => (
                <li key={m.id} className="flex items-center gap-2">
                  <img
                    src={m.avatar_url || getDiceBearUrl(m.full_name)}
                    alt=""
                    className="h-9 w-9 rounded-full"
                    width={36}
                    height={36}
                  />
                  <span className="text-sm">{m.full_name}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="mt-6 w-full rounded-xl py-3 text-sm font-semibold"
              style={{ background: "#1E293B", color: SLATE_TEXT }}
              onClick={() => {
                const text = prompt("Set a group status message");
                if (!text || !db || !user) return;
                void set(ref(db, `chats/${chatId}/meta/group_status`), {
                  name: user.full_name || "Someone",
                  text,
                  avatars: group.members.slice(0, 3).map((mm) => getDiceBearUrl(mm.full_name)),
                });
                showToast("Status updated");
              }}
            >
              Set group status
            </button>
          </div>
        </div>
      ) : null}

      {/* Theme overlay — Section D */}
      {themeOpen ? (
        <div
          className="fixed inset-0 z-[120] overflow-y-auto"
          style={{ background: CHAT_BG_DEFAULT }}
          onClick={() => setThemeOpen(false)}
        >
          <div className="mx-auto max-w-lg p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Chat theme</h2>
              <button type="button" className="text-[#94A3B8]" onClick={() => setThemeOpen(false)}>
                ✕
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {THEME_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="rounded-xl border p-3 text-left"
                  style={{ borderColor: BORDER, background: p.bg }}
                  onClick={() => persistTheme(p)}
                >
                  <div className="mb-2 flex gap-1">
                    <span className="h-6 flex-1 rounded-lg" style={{ background: p.recv }} />
                    <span className="h-6 w-8 rounded-lg" style={{ background: p.sent }} />
                  </div>
                  <span className="text-[11px]" style={{ color: SLATE_TEXT }}>
                    {p.label}
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-8">
              <p className="mb-2 text-sm font-medium">Custom wallpaper</p>
              <label className="inline-block cursor-pointer rounded-lg bg-[#1E293B] px-4 py-2 text-sm">
                Upload wallpaper
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onWallpaper(e.target.files?.[0] ?? null)}
                />
              </label>
              {wallpaperUrl ? (
                <div className="mt-3 flex items-center gap-3">
                  <img src={wallpaperUrl} alt="" className="h-16 w-16 rounded-lg object-cover" />
                  <button type="button" className="text-sm text-sky-400 underline" onClick={removeWallpaper}>
                    Remove
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {/* Split sheet */}
      {splitOpen ? (
        <div className="fixed inset-0 z-[110] flex flex-col justify-end bg-black/50" onClick={() => setSplitOpen(false)}>
          <div
            className="max-h-[65vh] overflow-y-auto rounded-t-2xl p-4"
            style={{ background: NAVY_TOP }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-3 text-base font-semibold">Add expense to chat</h3>
            {!currentTripId ? (
              <p className="text-sm" style={{ color: MUTED }}>
                No trip on this group yet. Create a trip to post splits.
              </p>
            ) : (
              <>
                <label className="mb-2 block text-xs" style={{ color: MUTED }}>
                  What for?
                </label>
                <input
                  value={splitDesc}
                  onChange={(e) => setSplitDesc(e.target.value)}
                  className="mb-3 w-full rounded-xl border-0 bg-[#1E293B] px-3 py-2 text-white outline-none"
                  placeholder="Dinner at Adhoos"
                />
                <label className="mb-2 block text-xs" style={{ color: MUTED }}>
                  Total amount (₹)
                </label>
                <input
                  type="number"
                  value={splitAmount}
                  onChange={(e) => setSplitAmount(e.target.value)}
                  className="mb-3 w-full rounded-xl border-0 bg-[#1E293B] px-3 py-3 text-2xl font-bold text-white outline-none"
                />
                <p className="mb-2 text-xs" style={{ color: MUTED }}>
                  Paid by (shown in chat; API records you as payer)
                </p>
                <select className="mb-3 w-full rounded-xl border-0 bg-[#1E293B] px-3 py-2 text-white">
                  <option>Me</option>
                  {group.members.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.full_name}
                    </option>
                  ))}
                </select>
                <p className="mb-2 text-xs font-bold uppercase" style={{ color: MUTED }}>
                  Split between
                </p>
                <ul className="mb-3 space-y-2">
                  {group.members.map((m) => (
                    <li key={m.user_id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={!!splitChecked[m.user_id]}
                        onChange={(e) =>
                          setSplitChecked((c) => ({ ...c, [m.user_id]: e.target.checked }))
                        }
                      />
                      <span className="text-sm">{m.full_name}</span>
                    </li>
                  ))}
                </ul>
                {(() => {
                  const n = Object.values(splitChecked).filter(Boolean).length || 1;
                  const t = parseFloat(splitAmount);
                  const per = Number.isFinite(t) ? t / n : 0;
                  return (
                    <p className="mb-4 text-2xl font-bold">
                      Per person: ₹{per.toFixed(2)}
                    </p>
                  );
                })()}
                <button
                  type="button"
                  disabled={splitPosting}
                  className="w-full rounded-xl py-3 text-sm font-bold text-white disabled:opacity-50"
                  style={{ background: CRIMSON }}
                  onClick={() => void postSplitExpense()}
                >
                  Post to chat
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}

      {/* Poll creator */}
      {pollCreatorOpen ? (
        <div className="fixed inset-0 z-[115] flex items-end justify-center bg-black/50" onClick={() => setPollCreatorOpen(false)}>
          <div
            className="w-full max-w-md rounded-t-2xl p-4"
            style={{ background: NAVY_TOP }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-2 font-semibold">Quick poll</p>
            <input
              value={pollQ}
              onChange={(e) => setPollQ(e.target.value)}
              placeholder="Question"
              className="mb-2 w-full rounded-xl bg-[#1E293B] px-3 py-2 text-sm outline-none"
            />
            <input
              value={pollA}
              onChange={(e) => setPollA(e.target.value)}
              placeholder="Option A"
              className="mb-2 w-full rounded-xl bg-[#1E293B] px-3 py-2 text-sm outline-none"
            />
            <input
              value={pollB}
              onChange={(e) => setPollB(e.target.value)}
              placeholder="Option B"
              className="mb-3 w-full rounded-xl bg-[#1E293B] px-3 py-2 text-sm outline-none"
            />
            <button
              type="button"
              className="w-full rounded-xl py-3 font-bold text-white"
              style={{ background: CRIMSON }}
              onClick={() => {
                if (!pollQ.trim() || !pollA.trim() || !pollB.trim()) {
                  showToast("Fill all fields", "err");
                  return;
                }
                const options: PollOption[] = [
                  { id: "a", label: pollA.trim(), votes: [] },
                  { id: "b", label: pollB.trim(), votes: [] },
                ];
                void sendMessage("poll", pollQ.trim(), { question: pollQ.trim(), options, closed: false });
                setPollCreatorOpen(false);
                setPollQ("");
                setPollA("");
                setPollB("");
              }}
            >
              Create poll
            </button>
          </div>
        </div>
      ) : null}

      {/* Link paste */}
      {linkPasteOpen ? (
        <div className="fixed inset-0 z-[115] flex items-center justify-center bg-black/60 p-4" onClick={() => setLinkPasteOpen(false)}>
          <div className="w-full max-w-sm rounded-xl p-4" style={{ background: NAVY_TOP }} onClick={(e) => e.stopPropagation()}>
            <p className="mb-2 text-sm font-semibold">Paste link</p>
            <input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              className="mb-3 w-full rounded-lg bg-[#1E293B] px-3 py-2 text-sm outline-none"
              placeholder="https://..."
            />
            <button
              type="button"
              className="w-full rounded-lg py-2 font-bold text-white"
              style={{ background: CRIMSON }}
              onClick={() => {
                const u = linkUrl.trim();
                if (!u) return;
                void sendMessage("link", u, { url: u, previewTitle: u });
                setLinkUrl("");
                setLinkPasteOpen(false);
              }}
            >
              Add preview card
            </button>
          </div>
        </div>
      ) : null}

      {/* Stickers */}
      {stickerPanelOpen ? (
        <div className="fixed inset-0 z-[115] flex flex-col justify-end bg-black/50" onClick={() => setStickerPanelOpen(false)}>
          <div className="max-h-[50vh] overflow-y-auto rounded-t-2xl p-4" style={{ background: NAVY_TOP }} onClick={(e) => e.stopPropagation()}>
            <p className="mb-2 font-semibold">Stickers</p>
            <label className="mb-3 inline-block cursor-pointer text-sm text-sky-400">
              Create sticker (upload)
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const r = new FileReader();
                  r.onload = () => addSticker(String(r.result));
                  r.readAsDataURL(f);
                }}
              />
            </label>
            <div className="grid grid-cols-4 gap-2">
              {stickers.map((s, i) => (
                <button key={i} type="button" className="rounded-lg bg-[#1E293B] p-1" onClick={() => void sendMessage("sticker", "", { url: s })}>
                  <img src={s} alt="" className="h-full w-full object-contain" />
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* Search */}
      {searchOpen ? (
        <div className="fixed inset-0 z-[105] bg-black/60 p-4" onClick={() => setSearchOpen(false)}>
          <div className="mx-auto mt-10 max-w-md rounded-xl p-4" style={{ background: NAVY_TOP }} onClick={(e) => e.stopPropagation()}>
            <input
              autoFocus
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Search messages…"
              className="w-full rounded-lg bg-[#1E293B] px-3 py-2 text-sm outline-none"
            />
            <p className="mt-2 text-xs" style={{ color: MUTED }}>
              {filteredMessages.length} matches
            </p>
          </div>
        </div>
      ) : null}

      {/* Context menu */}
      {contextMsg ? (
        <div className="fixed inset-0 z-[130] bg-black/40" onClick={() => setContextMsg(null)}>
          <div
            className="absolute bottom-24 left-4 right-4 mx-auto max-w-sm rounded-xl py-1 shadow-xl"
            style={{ background: "#1E293B", border: "0.5px solid #334155" }}
            onClick={(e) => e.stopPropagation()}
          >
            {(
              [
                { label: "Reply", fn: () => showToast("Reply (demo)") },
                { label: "React", fn: () => setReactPickerFor(contextMsg.id) },
                { label: "Forward", fn: () => showToast("Forward (demo)") },
                { label: "Copy", fn: () => copyText(contextMsg.text ?? "") },
                { label: "Pin", fn: () => void pinMessage(contextMsg) },
                { label: "Star", fn: () => showToast("Starred (demo)") },
                {
                  label: "Delete",
                  fn: () => {
                    if (db) remove(ref(db, `chats/${chatId}/messages/${contextMsg.id}`));
                    showToast("Deleted");
                  },
                },
              ] satisfies MenuItem[]
            ).map(({ label, fn }) => (
              <button
                key={label}
                type="button"
                className="block w-full px-4 py-3 text-left text-sm hover:bg-white/5"
                onClick={() => {
                  fn();
                  setContextMsg(null);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* Reaction picker */}
      {reactPickerFor ? (
        <div className="fixed inset-0 z-[135] flex items-end justify-center bg-black/40" onClick={() => setReactPickerFor(null)}>
          <div className="mb-8 flex gap-2 rounded-full bg-[#1E293B] px-4 py-2" onClick={(e) => e.stopPropagation()}>
            {REACTION_CHIPS.map((em) => (
              <button
                key={em}
                type="button"
                className="rounded-full px-3 py-1.5 text-xs font-medium text-white/90"
                onClick={() => {
                  if (!db || !user) return;
                  const msg = messages.find((x) => x.id === reactPickerFor);
                  if (!msg) return;
                  const r = { ...(msg.reactions ?? {}) };
                  for (const k of Object.keys(r)) {
                    r[k] = (r[k] ?? []).filter((id) => id !== user.id);
                  }
                  r[em] = [...(r[em] ?? []), user.id];
                  update(ref(db, `chats/${chatId}/messages/${msg.id}`), { reactions: r }).catch(
                    () => {},
                  );
                  setReactPickerFor(null);
                }}
              >
                {em}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* Expense detail modal */}
      {expenseDetail ? (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/60 p-4" onClick={() => setExpenseDetail(null)}>
          <div className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-xl p-4" style={{ background: NAVY_TOP }} onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold">Expense split</h3>
            <pre className="mt-2 whitespace-pre-wrap text-xs" style={{ color: SLATE_TEXT }}>
              {JSON.stringify(expenseDetail, null, 2)}
            </pre>
            {expenseDetail.trip_id ? (
              <Link
                href={`/trips/${String(expenseDetail.trip_id)}`}
                className="mt-4 inline-block text-sm font-semibold text-sky-400"
              >
                Open trip
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Confirm modals */}
      {confirmModal ? (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-xl p-5" style={{ background: "#1E293B" }}>
            <p className="text-sm">
              {confirmModal === "clear"
                ? "Clear all messages in this chat?"
                : "Are you sure you want to exit?"}
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-lg py-2 text-sm"
                style={{ background: "#334155" }}
                onClick={() => setConfirmModal(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="flex-1 rounded-lg py-2 text-sm font-bold text-white"
                style={{ background: CRIMSON }}
                onClick={() => {
                  if (confirmModal === "clear") void clearChat();
                  else {
                    setConfirmModal(null);
                    router.push("/travel-hub");
                    showToast("Left group (demo)");
                  }
                }}
              >
                {confirmModal === "clear" ? "Clear" : "Exit"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div
          className={`fixed bottom-24 left-1/2 z-[200] -translate-x-1/2 rounded-full px-4 py-2 text-sm font-medium shadow-lg ${
            toast.kind === "ok" ? "bg-emerald-700 text-white" : "bg-red-600 text-white"
          }`}
        >
          {toast.msg}
        </div>
      ) : null}
    </div>
  );
}

function MessageRow({
  msg,
  mine,
  isGroup,
  themeRecv,
  themeSent,
  memberIds,
  onLongPress,
  onReact,
  onVote,
  userId,
  onExpenseClick,
}: {
  msg: ChatMessage;
  mine: boolean;
  isGroup: boolean;
  themeRecv: string;
  themeSent: string;
  memberIds: string[];
  onLongPress: () => void;
  onReact: () => void;
  onVote: (optionId: string) => void;
  userId: string;
  onExpenseClick: () => void;
}) {
  const meta = msg.metadata as Record<string, unknown> | undefined;
  const isHashCommand =
    msg.type === "text" && (msg.text ?? "").trim().startsWith("#");
  const bubbleRecv = isHashCommand ? "#1E3A5F" : themeRecv;
  const borderRecv = isHashCommand ? "3px solid #6366F1" : "none";

  const longPress = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onDown = () => {
    longPress.current = setTimeout(() => onLongPress(), 500);
  };
  const onUp = () => {
    if (longPress.current) clearTimeout(longPress.current);
  };

  if (msg.type === "poll" && meta?.options) {
    const q = String(meta.question ?? msg.text ?? "");
    const options = meta.options as PollOption[];
    const totalVotes = options.reduce((s, o) => s + o.votes.length, 0);
    const closed = !!meta.closed;
    return (
      <div
        className={`mb-2 flex w-full ${mine ? "justify-end" : "justify-start"}`}
        onMouseDown={onDown}
        onMouseUp={onUp}
        onMouseLeave={onUp}
        onTouchStart={onDown}
        onTouchEnd={onUp}
      >
        <div
          className="max-w-[85%] rounded-xl border border-[#334155] p-3"
          style={{ background: "#1E293B" }}
        >
          <p className="mb-2 text-[14px] font-bold text-white">{q}</p>
          {options.map((o) => {
            const pct = totalVotes ? (o.votes.length / totalVotes) * 100 : 0;
            return (
              <div key={o.id} className="relative mb-2 overflow-hidden rounded-lg bg-[#0F172A]">
                <div
                  className="absolute inset-y-0 left-0"
                  style={{ width: `${pct}%`, background: CRIMSON, opacity: 0.35 }}
                />
                <div className="relative px-2 py-1.5 text-sm">{o.label}</div>
              </div>
            );
          })}
          {!closed && !options.some((o) => o.votes.includes(userId)) ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {options.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className="rounded-lg px-3 py-1 text-xs font-bold text-white"
                  style={{ background: CRIMSON }}
                  onClick={() => onVote(o.id)}
                >
                  Vote {o.label.slice(0, 12)}
                </button>
              ))}
            </div>
          ) : null}
          <div className="mt-1 text-right text-[10px]" style={{ color: MUTED }}>
            {formatTime(msg.timestamp)}
          </div>
        </div>
      </div>
    );
  }

  if (msg.type === "expense" && meta) {
    const title = String(meta.title ?? msg.text ?? "Expense");
    const total = Number(meta.total ?? 0);
    const per = Number(meta.per_person ?? 0);
    const youOwe = !!meta.you_owe;
    const youGetAmt = Number(meta.you_get_amount ?? 0);
    const youOweAmt = Number(meta.you_owe_amount ?? meta.your_share ?? per);
    const paidName = String(meta.paid_by_name ?? "");
    const paidAv = String(meta.paid_by_avatar ?? getDiceBearUrl(paidName));
    const n = Number(meta.split_count ?? 1);
    return (
      <div className={`mb-2 flex w-full ${mine ? "justify-end" : "justify-start"}`}>
        <button
          type="button"
          className="max-w-[85%] rounded-xl border p-3 text-left"
          style={{ background: "#1E293B", border: "0.5px solid #22C55E" }}
          onClick={onExpenseClick}
        >
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#22C55E]">
            <Banknote className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
            Expense Split
          </span>
          <p className="mt-1 text-[15px] font-bold text-white">
            {title} · ₹{total.toFixed(2)}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <img src={paidAv} alt="" className="h-7 w-7 rounded-full" width={28} height={28} />
            <span className="text-sm text-white/90">Paid by {paidName}</span>
          </div>
          <p className="mt-2 text-xs" style={{ color: SLATE_TEXT }}>
            Split {n} ways · ₹{per.toFixed(2)} each
          </p>
          <p
            className={`mt-1 text-sm font-semibold ${youOwe ? "text-red-400" : "text-[#22C55E]"}`}
          >
            {youOwe
              ? `You owe: ₹${youOweAmt.toFixed(2)}`
              : `You get: ₹${youGetAmt.toFixed(2)}`}
          </p>
          <span className="mt-2 inline-block rounded-lg px-3 py-1 text-xs font-bold text-white" style={{ background: CRIMSON }}>
            View full split
          </span>
        </button>
      </div>
    );
  }

  if (msg.type === "booking") {
    return (
      <div className={`mb-2 flex w-full ${mine ? "justify-end" : "justify-start"}`}>
        <div className="max-w-[85%] rounded-xl border border-[#334155] bg-[#1E293B] p-3">
          <div className="flex items-center gap-2">
            <Plane className="h-7 w-7 shrink-0 text-white" strokeWidth={1.5} aria-hidden />
            <div>
              <p className="text-sm font-bold">Booking confirmed</p>
              <p className="text-xs" style={{ color: MUTED }}>
                Ref: {String(meta?.ref ?? "—")} · {String(meta?.date ?? "")}
              </p>
            </div>
          </div>
          <div className="mt-2 flex gap-2">
            <button type="button" className="flex-1 rounded-lg bg-[#0F172A] py-2 text-xs font-semibold">
              Download ticket
            </button>
            <button type="button" className="flex-1 rounded-lg py-2 text-xs font-semibold text-white" style={{ background: CRIMSON }}>
              View booking
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`mb-2 flex w-full gap-2 ${mine ? "justify-end" : "justify-start"}`}
      onMouseDown={onDown}
      onMouseUp={onUp}
      onMouseLeave={onUp}
      onTouchStart={onDown}
      onTouchEnd={onUp}
    >
      {!mine ? (
        <img
          src={msg.sender_avatar || getDiceBearUrl(msg.sender_name ?? "?")}
          alt=""
          className="mt-auto h-7 w-7 shrink-0 rounded-full"
          width={28}
          height={28}
        />
      ) : (
        <span className="w-0 shrink-0 sm:w-0" />
      )}
      <div className="max-w-[78%]">
        {isGroup && !mine ? (
          <p className="mb-0.5 text-[11px] font-medium" style={{ color: CRIMSON }}>
            {msg.sender_name}
          </p>
        ) : null}
        <div
          className="relative px-3 py-2"
          style={{
            background: mine ? themeSent : bubbleRecv,
            borderRadius: mine ? "16px 16px 0 16px" : "0 16px 16px 16px",
            borderLeft: mine ? "none" : borderRecv,
          }}
        >
          {isHashCommand ? (
            <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-indigo-600/40 px-2 py-0.5 text-[7px] font-bold uppercase tracking-wide text-indigo-200">
              <Bot className="h-2.5 w-2.5" strokeWidth={1.5} aria-hidden />
              AI command
            </span>
          ) : null}
          {msg.type === "text" || msg.type === "link" ? (
            <div>
              {msg.type === "link" && meta?.url ? (
                <a
                  href={String(meta.url)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-semibold text-sky-300 underline"
                >
                  {String(meta.previewTitle ?? meta.url)}
                </a>
              ) : (
                renderFormattedText(msg.text ?? "", "#fff")
              )}
            </div>
          ) : null}
          {msg.type === "image" || msg.type === "sticker" ? (
            <img
              src={String(meta?.url ?? "")}
              alt=""
              className="max-h-60 max-w-full rounded-lg"
            />
          ) : null}
          {msg.type === "location" ? (
            <p className="flex items-start gap-1.5 text-sm">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden />
              <span>
                {msg.text}{" "}
                <span className="text-[11px]" style={{ color: MUTED }}>
                  {meta?.lat != null ? `${meta.lat}, ${meta.lon}` : ""}
                </span>
              </span>
            </p>
          ) : null}
          {msg.type === "document" ? (
            <p className="flex items-center gap-1.5 text-sm">
              <FileText className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden />
              {msg.text}
            </p>
          ) : null}
          {msg.type === "audio" ? (
            <p className="flex items-center gap-1.5 text-sm">
              <Mic className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden />
              Voice · {String(meta?.duration ?? "")}
            </p>
          ) : null}
          {isHashCommand && meta?.ai_reply ? (
            <div
              className="mt-2 rounded-xl border border-[#334155] bg-[#0F172A] p-2 text-[13px] italic"
              style={{ color: SLATE_TEXT }}
            >
              {String(meta.ai_reply)}
            </div>
          ) : null}
          <div className="mt-1 flex items-end justify-end gap-1 text-[10px]" style={{ color: MUTED }}>
            <span>{formatTime(msg.timestamp)}</span>
            {readReceiptIcon(mine, msg.read_by, msg.sender_id, memberIds)}
          </div>
        </div>
        {msg.reactions && Object.keys(msg.reactions).length > 0 ? (
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {Object.entries(msg.reactions).map(([em, ids]) =>
              (ids?.length ?? 0) > 0 ? (
                <span
                  key={em}
                  className="rounded-full bg-[#1E293B] px-2 py-0.5 text-[11px]"
                  style={{ color: SLATE_TEXT }}
                >
                  {em} {ids.length}
                </span>
              ) : null,
            )}
            <button type="button" className="rounded-full bg-[#1E293B] px-2 py-0.5 text-[11px]" onClick={onReact}>
              +
            </button>
          </div>
        ) : (
          <button type="button" className="mt-0.5 text-[11px] opacity-60 hover:opacity-100" style={{ color: MUTED }} onClick={onReact}>
            + react
          </button>
        )}
      </div>
    </div>
  );
}

function AttachSheet({
  onClose,
  onPhoto,
  onDoc,
  onLocation,
  onAudio,
  onSticker,
  onLink,
}: {
  onClose: () => void;
  onPhoto: (f: File) => void;
  onDoc: (f: File) => void;
  onLocation: () => void;
  onAudio: () => void;
  onSticker: () => void;
  onLink: () => void;
}) {
  const photoRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);
  return (
    <div
      className="mb-2 rounded-t-2xl border p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.35)]"
      style={{ background: NAVY_TOP, borderColor: BORDER }}
    >
      <div className="grid grid-cols-3 gap-4 text-center text-[11px]">
        <label className="cursor-pointer">
          <span className="mb-1 flex justify-center text-[#94A3B8]">
            <ImageIcon className="h-7 w-7" strokeWidth={1.5} aria-hidden />
          </span>
          Photo/Camera
          <input
            ref={photoRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onPhoto(f);
              onClose();
            }}
          />
        </label>
        <label className="cursor-pointer">
          <span className="mb-1 flex justify-center text-[#94A3B8]">
            <FileText className="h-7 w-7" strokeWidth={1.5} aria-hidden />
          </span>
          Document
          <input
            ref={docRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onDoc(f);
              onClose();
            }}
          />
        </label>
        <button type="button" onClick={() => { onLocation(); onClose(); }}>
          <span className="mb-1 flex justify-center text-[#94A3B8]">
            <MapPin className="h-7 w-7" strokeWidth={1.5} aria-hidden />
          </span>
          Location
        </button>
        <button type="button" onClick={() => { onAudio(); }}>
          <span className="mb-1 flex justify-center text-[#94A3B8]">
            <Music className="h-7 w-7" strokeWidth={1.5} aria-hidden />
          </span>
          Audio
        </button>
        <button type="button" onClick={() => { onSticker(); }}>
          <span className="mb-1 flex justify-center text-[#94A3B8]">
            <Tag className="h-7 w-7" strokeWidth={1.5} aria-hidden />
          </span>
          Sticker
        </button>
        <button type="button" onClick={() => { onLink(); }}>
          <span className="mb-1 flex justify-center text-[#94A3B8]">
            <Link2 className="h-7 w-7" strokeWidth={1.5} aria-hidden />
          </span>
          Link
        </button>
      </div>
      <button type="button" className="mt-3 w-full py-1 text-xs" style={{ color: MUTED }} onClick={onClose}>
        Close
      </button>
    </div>
  );
}
