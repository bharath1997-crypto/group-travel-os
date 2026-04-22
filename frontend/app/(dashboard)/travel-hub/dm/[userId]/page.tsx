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
} from "react";

import { apiFetchWithStatus } from "@/lib/api";
import { clearToken } from "@/lib/auth";

import type { ChatMessage } from "../../[groupId]/profile/page";

const NAVY = "#0F3460";
const CORAL = "#E94560";
const BORDER = "#E9ECEF";
const WA_BG = "#F0F2F5";
const PANEL_BG = "#0F172A";
const MUTED = "#94A3B8";
const CARD_BG = "#1E293B";
const GREEN = "#22C55E";
const RED = "#EF4444";

type UserMe = {
  id: string;
  full_name: string | null;
  username?: string | null;
};

type GroupMemberOut = {
  user_id: string;
  full_name: string;
  avatar_url?: string | null;
  role: string;
  is_online?: boolean;
  last_seen_at?: string | null;
};

type GroupOut = {
  id: string;
  name: string;
  members: GroupMemberOut[];
};

type TripOut = {
  id: string;
  title: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
};

type BalanceRow = {
  from_user_id: string;
  to_user_id: string;
  amount: number;
};

type ExpenseOut = {
  id: string;
  paid_by: string;
  amount: number;
  splits: { user_id: string; amount: number }[];
};

type SharedTab = "media" | "links" | "docs" | "trips" | "activities";

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

function getDiceBearUrl(seed: string): string {
  return `https://api.dicebear.com/7.x/lorelei/svg?seed=${encodeURIComponent(seed)}`;
}

function dmChatId(a: string, b: string): string {
  const ids = [a, b].sort();
  return `dm_${ids[0]}_${ids[1]}`;
}

function urlRegex(): RegExp {
  return /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/gi;
}

function extractShared(messages: ChatMessage[]) {
  const media: { url: string; ts: number }[] = [];
  const links: { url: string; ts: number }[] = [];
  const docs: { name: string; size: string; ts: number }[] = [];
  for (const m of messages) {
    const ts = m.timestamp;
    const meta = m.metadata ?? {};
    if (m.type === "image" && meta.url) {
      media.push({ url: String(meta.url), ts });
    }
    if (m.type === "text" && m.text) {
      const matches = m.text.match(urlRegex());
      if (matches) for (const u of matches) links.push({ url: u, ts });
    }
    const fileName = meta.file_name ?? meta.filename;
    if (typeof fileName === "string" && (m.type === "file" || meta.mime)) {
      docs.push({
        name: fileName,
        size: meta.size != null ? String(meta.size) : "—",
        ts,
      });
    }
  }
  return { media, links, docs };
}

function domainFromUrl(url: string): string {
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname;
  } catch {
    return url;
  }
}

function formatShortDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function hoursAgo(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const h = Math.floor((Date.now() - t) / 3600000);
  if (h < 1) return "Last seen recently";
  return `Last seen ${h}h ago`;
}

export default function DirectMessagePage() {
  const params = useParams();
  const router = useRouter();
  const peerId = String(params.userId ?? "");

  const [firebaseReady, setFirebaseReady] = useState(false);
  const [db, setDb] = useState<Database | null>(null);
  const [user, setUser] = useState<UserMe | null>(null);
  const [groups, setGroups] = useState<GroupOut[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageText, setMessageText] = useState("");
  const [showProfile, setShowProfile] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [spendLoading, setSpendLoading] = useState(false);
  const [youPaidForThem, setYouPaidForThem] = useState(0);
  const [theyPaidForYou, setTheyPaidForYou] = useState(0);
  const [youOweThem, setYouOweThem] = useState(0);
  const [theyOweYou, setTheyOweYou] = useState(0);
  const [sharedTrips, setSharedTrips] = useState<TripOut[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesUnsubRef = useRef<(() => void) | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const chatId = user?.id ? dmChatId(user.id, peerId) : "";

  const showToast = useCallback((m: string) => {
    setToast(m);
    globalThis.setTimeout(() => setToast(null), 2800);
  }, []);

  const handleUnauthorized = useCallback(() => {
    clearToken();
    router.push("/login");
  }, [router]);

  useEffect(() => {
    const { db: d, ok } = initFirebase();
    setDb(d);
    setFirebaseReady(ok);
  }, []);

  const peerMeta = useMemo(() => {
    for (const g of groups) {
      const m = g.members.find((x) => x.user_id === peerId);
      if (m) return m;
    }
    return null;
  }, [groups, peerId]);

  const peerName = peerMeta?.full_name ?? `Traveler ${peerId.slice(0, 6)}`;
  const peerOnline = Boolean(peerMeta?.is_online);
  const statusLine = peerOnline
    ? "Online"
    : hoursAgo(peerMeta?.last_seen_at) ?? "Last seen recently";

  const mutualGroups = useMemo(
    () =>
      groups.filter(
        (g) =>
          g.members.some((m) => m.user_id === user?.id) &&
          g.members.some((m) => m.user_id === peerId),
      ),
    [groups, user?.id, peerId],
  );

  useEffect(() => {
    if (!user?.id || !peerId) return;
    let cancelled = false;
    void (async () => {
      setSpendLoading(true);
      try {
        const tripMap = new Map<string, TripOut>();
        for (const g of mutualGroups) {
          const res = await apiFetchWithStatus<TripOut[]>(
            `/groups/${g.id}/trips`,
          );
          if (res.status === 401) {
            handleUnauthorized();
            return;
          }
          for (const t of res.data ?? []) tripMap.set(t.id, t);
        }
        const trips = [...tripMap.values()];
        if (cancelled) return;
        setSharedTrips(trips);

        let yp = 0,
          tp = 0,
          yO = 0,
          tO = 0;
        for (const t of trips) {
          const [expRes, balRes] = await Promise.all([
            apiFetchWithStatus<ExpenseOut[]>(`/trips/${t.id}/expenses`),
            apiFetchWithStatus<BalanceRow[]>(
              `/trips/${t.id}/expenses/summary`,
            ),
          ]);
          if (expRes.status === 401 || balRes.status === 401) {
            handleUnauthorized();
            return;
          }
          for (const e of expRes.data ?? []) {
            if (e.paid_by === user.id) {
              const sp = e.splits.find((s) => s.user_id === peerId);
              if (sp) yp += sp.amount;
            } else if (e.paid_by === peerId) {
              const sp = e.splits.find((s) => s.user_id === user.id);
              if (sp) tp += sp.amount;
            }
          }
          for (const row of balRes.data ?? []) {
            if (row.from_user_id === peerId && row.to_user_id === user.id) {
              tO += row.amount;
            }
            if (row.from_user_id === user.id && row.to_user_id === peerId) {
              yO += row.amount;
            }
          }
        }
        if (!cancelled) {
          setYouPaidForThem(Math.round(yp * 100) / 100);
          setTheyPaidForYou(Math.round(tp * 100) / 100);
          setYouOweThem(Math.round(yO * 100) / 100);
          setTheyOweYou(Math.round(tO * 100) / 100);
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setYouPaidForThem(0);
          setTheyPaidForYou(0);
          setYouOweThem(0);
          setTheyOweYou(0);
        }
      } finally {
        if (!cancelled) setSpendLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, peerId, mutualGroups, handleUnauthorized]);

  useEffect(() => {
    if (!peerId) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const meRes = await apiFetchWithStatus<UserMe>("/auth/me");
        if (meRes.status === 401) {
          handleUnauthorized();
          return;
        }
        if (!meRes.data || cancelled) return;
        if (meRes.data.id === peerId) {
          router.replace("/travel-hub");
          return;
        }
        setUser(meRes.data);

        const gRes = await apiFetchWithStatus<GroupOut[]>("/groups");
        if (gRes.status === 401) {
          handleUnauthorized();
          return;
        }
        if (!cancelled) setGroups(gRes.data ?? []);

        const database = initFirebase().db;
        if (database && meRes.data.id) {
          const cid = dmChatId(meRes.data.id, peerId);
          const chatRef = ref(database, `chats/${cid}/info`);
          const snapshot = await get(chatRef);
          if (!snapshot.exists()) {
            await set(chatRef, {
              id: cid,
              name: peerName,
              type: "individual",
              members: [meRes.data.id, peerId],
              created_by: meRes.data.id,
              created_at: Date.now(),
              last_message: "",
              last_message_time: Date.now(),
              last_message_sender: "",
            });
            await set(
              ref(database, `user_chats/${meRes.data.id}/${cid}`),
              true,
            );
            await set(ref(database, `user_chats/${peerId}/${cid}`), true);
          }
        }
      } catch (e) {
        console.error(e);
        showToast("Failed to load chat");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [peerId, peerName, router, handleUnauthorized, showToast]);

  const loadMessages = useCallback(
    (cid: string) => {
      if (!db) return;
      messagesUnsubRef.current?.();
      messagesUnsubRef.current = null;
      const messagesRef = ref(db, `chats/${cid}/messages`);
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
            typeof v.timestamp === "number" ? v.timestamp : Date.now();
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
    if (!db || !chatId) return;
    loadMessages(chatId);
    return () => {
      messagesUnsubRef.current?.();
    };
  }, [db, chatId, loadMessages]);

  useEffect(() => {
    if (!db || !user?.id || !chatId) return;
    const typingRef = ref(db, `chats/${chatId}/typing`);
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
  }, [db, chatId, user?.id]);

  useEffect(() => {
    return () => {
      messagesUnsubRef.current?.();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  const sendMessage = useCallback(
    async (
      type: string,
      content: string,
      metadata?: Record<string, unknown> | null,
    ) => {
      if (!db || !user || !chatId) return;
      if (type === "text" && !content.trim()) return;
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
      } catch (e) {
        console.error(e);
        showToast("Could not send message");
      }
    },
    [db, user, chatId, showToast],
  );

  const handleTyping = useCallback(() => {
    if (!db || !user || !chatId) return;
    const r = ref(db, `chats/${chatId}/typing/${user.id}`);
    set(r, user.full_name || "Someone");
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      remove(r).catch(() => {});
    }, 2000);
  }, [db, user, chatId]);

  const autoOweLine = useMemo(() => {
    const net = theyOweYou - youOweThem;
    if (Math.abs(net) < 0.01) {
      return { text: "You’re all settled up in shared trips", amount: 0 };
    }
    if (net > 0) {
      return {
        text: "You paid, they owe you",
        amount: Math.round(net * 100) / 100,
      };
    }
    return {
      text: "They paid, you owe them",
      amount: Math.round(-net * 100) / 100,
    };
  }, [theyOweYou, youOweThem]);

  if (loading && !user) {
    return (
      <div
        className="flex animate-pulse flex-col gap-4 p-4"
        style={{ height: "calc(100vh - 60px)" }}
      >
        <div className="h-14 rounded-xl bg-gray-200" />
        <div className="flex-1 rounded-xl bg-gray-100" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <Link href="/travel-hub" className="text-sky-600 underline">
          Back
        </Link>
      </div>
    );
  }

  return (
    <div
      className="relative flex w-full flex-col overflow-hidden"
      style={{ height: "calc(100vh - 60px)", background: WA_BG }}
    >
      {!firebaseReady ? (
        <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-950">
          Add{" "}
          <code className="rounded bg-amber-100 px-1">NEXT_PUBLIC_FIREBASE_*</code>{" "}
          for live messages.
        </div>
      ) : null}

      <header
        className="relative flex shrink-0 items-center gap-3 border-b bg-white px-3 py-3 md:px-4"
        style={{ borderColor: BORDER }}
      >
        <button
          type="button"
          className="text-xl md:hidden"
          onClick={() => router.push("/travel-hub")}
        >
          ←
        </button>
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          onClick={() => setShowProfile(true)}
        >
          <img
            src={peerMeta?.avatar_url || getDiceBearUrl(peerName)}
            alt=""
            width={48}
            height={48}
            className="h-12 w-12 shrink-0 rounded-full border"
          />
          <div className="min-w-0">
            <p className="truncate text-[15px] font-bold" style={{ color: NAVY }}>
              {peerName}
            </p>
            <p className="text-[12px] text-[#6C757D]">{statusLine}</p>
          </div>
        </button>
        <div className="flex shrink-0 items-center gap-1 text-xl text-[#6C757D]">
          <button
            type="button"
            onClick={() => showToast("Video call (coming soon)")}
            aria-label="Video call"
          >
            📹
          </button>
          <button
            type="button"
            onClick={() => showToast("Voice call (coming soon)")}
            aria-label="Voice call"
          >
            📞
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((m) => !m)}
              aria-label="Menu"
            >
              ⋮
            </button>
            {menuOpen ? (
              <DmMenu
                onClose={() => setMenuOpen(false)}
                onPick={(action) => {
                  setMenuOpen(false);
                  if (action === "contact") setShowProfile(true);
                  else showToast(`${action} (coming soon)`);
                }}
              />
            ) : null}
          </div>
        </div>
      </header>

      <div
        className="min-h-0 flex-1 overflow-y-auto px-4 py-3"
        style={{ background: WA_BG }}
      >
        {messages.map((m, i) => (
          <DmBubble key={m.id || i} msg={m} mine={m.sender_id === user.id} />
        ))}
        {typingUsers.length > 0 ? (
          <div className="mb-2 text-sm text-[#6C757D]">
            {typingUsers[0]} is typing…
          </div>
        ) : null}
        <div ref={messagesEndRef} />
      </div>

      <DmInputBar
        messageText={messageText}
        setMessageText={setMessageText}
        onSend={() => void sendMessage("text", messageText)}
        onTyping={handleTyping}
        autoOweLine={autoOweLine}
        onSendExpense={(desc, amt) =>
          void sendMessage("expense", desc, {
            description: desc,
            amount: amt,
          })
        }
      />

      <div
        className={`pointer-events-none fixed inset-0 z-40 transition-[visibility] ${
          showProfile ? "visible" : "invisible delay-200"
        }`}
      >
        <button
          type="button"
          className={`pointer-events-auto absolute inset-0 bg-black/40 transition-opacity duration-200 ${
            showProfile ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setShowProfile(false)}
          aria-label="Close profile"
        />
        <div
          className={`pointer-events-auto absolute right-0 top-0 h-full w-full max-w-md border-l border-slate-700 shadow-2xl transition-transform duration-300 ease-out ${
            showProfile ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <DmProfilePanel
            peerName={peerName}
            avatarUrl={peerMeta?.avatar_url || getDiceBearUrl(peerName)}
            online={peerOnline}
            statusLine={statusLine}
            messages={messages}
            sharedTrips={sharedTrips}
            mutualGroups={mutualGroups}
            youPaidForThem={youPaidForThem}
            theyPaidForYou={theyPaidForYou}
            youOweThem={youOweThem}
            theyOweYou={theyOweYou}
            spendLoading={spendLoading}
            onClose={() => setShowProfile(false)}
            showToast={showToast}
          />
        </div>
      </div>

      {toast ? (
        <div className="fixed bottom-24 left-1/2 z-[350] -translate-x-1/2 rounded-full bg-slate-900 px-4 py-2 text-[12px] text-white shadow-lg">
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function DmMenu({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (action: string) => void;
}) {
  const items: [string, string][] = [
    ["contact", "View contact"],
    ["search", "Search in chat"],
    ["media", "Media, links & docs"],
    ["mute", "Mute notifications"],
    ["disappear", "Disappearing messages"],
    ["theme", "Chat theme"],
    ["block", "Block contact"],
    ["report", "Report contact"],
  ];
  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[60]"
        aria-label="Close menu"
        onClick={onClose}
      />
      <ul className="absolute right-0 top-full z-[70] mt-1 min-w-[220px] rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
        {items.map(([key, label]) => (
          <li key={key}>
            <button
              type="button"
              className="w-full px-4 py-2.5 text-left text-[13px] hover:bg-slate-50"
              onClick={() => onPick(key)}
            >
              {label}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

function DmBubble({ msg, mine }: { msg: ChatMessage; mine: boolean }) {
  const meta = msg.metadata as Record<string, unknown> | undefined;
  return (
    <div
      className={`mb-2 flex ${mine ? "justify-end" : "justify-start"}`}
    >
      <div
        className="max-w-[75%] rounded-2xl px-3 py-2"
        style={{
          background: mine ? "#ffe4e8" : "#fff",
          boxShadow: "0 1px 0.5px rgba(0,0,0,0.08)",
        }}
      >
        {msg.type === "text" ? (
          <p className="text-sm text-[#2C3E50]">{msg.text}</p>
        ) : null}
        {msg.type === "image" && meta?.url ? (
          <img
            src={String(meta.url)}
            alt=""
            className="max-h-56 rounded-lg"
          />
        ) : null}
        {msg.type === "expense" ? (
          <div>
            <p className="text-sm">
              💸 {String(meta?.description ?? msg.text)}
            </p>
            <p className="font-bold text-[#E94560]">
              ₹{meta?.amount != null ? Number(meta.amount).toLocaleString("en-IN") : ""}
            </p>
          </div>
        ) : null}
        <p className="mt-1 text-right text-[10px] text-[#6C757D]">
          {new Date(msg.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}

function DmInputBar({
  messageText,
  setMessageText,
  onSend,
  onTyping,
  autoOweLine,
  onSendExpense,
}: {
  messageText: string;
  setMessageText: (s: string) => void;
  onSend: () => void;
  onTyping: () => void;
  autoOweLine: { text: string; amount: number };
  onSendExpense: (desc: string, amount: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");

  return (
    <div
      className="shrink-0 border-t bg-white px-3 py-2"
      style={{ borderColor: BORDER }}
    >
      {open ? (
        <div className="mb-2 rounded-xl p-3 text-[13px]" style={{ background: CARD_BG }}>
          <p className="font-semibold text-white">Split money (1-to-1)</p>
          <p className="mt-2 text-[12px]" style={{ color: MUTED }}>
            {autoOweLine.amount > 0
              ? `${autoOweLine.text} ₹${autoOweLine.amount.toLocaleString("en-IN")}`
              : autoOweLine.text}
          </p>
          <input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Note (e.g. Dinner)"
            className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-[13px] text-white"
          />
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount you paid (₹)"
            inputMode="decimal"
            className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-[13px] text-white"
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className="flex-1 rounded-lg border border-slate-600 py-2 text-[12px] text-slate-200"
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="flex-1 rounded-lg py-2 text-[12px] font-bold text-white"
              style={{ background: CORAL }}
              onClick={() => {
                const n = Number(amount);
                if (!desc.trim() || Number.isNaN(n) || n <= 0) return;
                const line =
                  autoOweLine.amount > 0 && autoOweLine.text.includes("they owe")
                    ? `${desc} — ${autoOweLine.text} ₹${autoOweLine.amount.toLocaleString("en-IN")}`
                    : `${desc} — Split 50/50 suggested`;
                onSendExpense(line, n);
                setOpen(false);
                setAmount("");
                setDesc("");
              }}
            >
              Send expense
            </button>
          </div>
        </div>
      ) : null}
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="text-xl"
          onClick={() => setOpen((o) => !o)}
        >
          💸
        </button>
        <input
          value={messageText}
          onChange={(e) => {
            setMessageText(e.target.value);
            onTyping();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          placeholder="Message"
          className="min-w-0 flex-1 rounded-full border-0 bg-[#F0F2F5] px-4 py-2.5 text-sm outline-none"
        />
        {messageText.trim() ? (
          <button
            type="button"
            onClick={onSend}
            className="flex h-10 w-10 items-center justify-center rounded-full text-white"
            style={{ background: CORAL }}
          >
            ➤
          </button>
        ) : null}
      </div>
    </div>
  );
}

function DmProfilePanel({
  peerName,
  avatarUrl,
  online,
  statusLine,
  messages,
  sharedTrips,
  mutualGroups,
  youPaidForThem,
  theyPaidForYou,
  youOweThem,
  theyOweYou,
  spendLoading,
  onClose,
  showToast,
}: {
  peerName: string;
  avatarUrl: string;
  online: boolean;
  statusLine: string;
  messages: ChatMessage[];
  sharedTrips: TripOut[];
  mutualGroups: GroupOut[];
  youPaidForThem: number;
  theyPaidForYou: number;
  youOweThem: number;
  theyOweYou: number;
  spendLoading: boolean;
  onClose: () => void;
  showToast: (s: string) => void;
}) {
  const [tab, setTab] = useState<SharedTab>("media");
  const [lightbox, setLightbox] = useState<string | null>(null);
  const { media, links, docs } = useMemo(
    () => extractShared(messages),
    [messages],
  );

  const expenseTotal = useMemo(() => {
    let n = 0;
    for (const m of messages) {
      if (m.type !== "expense") continue;
      const amt = Number((m.metadata as { amount?: unknown })?.amount);
      if (!Number.isNaN(amt)) n += amt;
    }
    return Math.round(n);
  }, [messages]);

  return (
    <div
      className="flex h-full flex-col overflow-hidden"
      style={{ background: PANEL_BG, color: "#F8FAFC" }}
    >
      <div className="flex shrink-0 justify-end border-b border-slate-700/80 px-3 py-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-3 py-1 text-sm text-slate-300 hover:bg-slate-800"
        >
          Close
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-10 pt-4">
        <div className="flex flex-col items-center text-center">
          <img
            src={avatarUrl}
            alt=""
            width={80}
            height={80}
            className="h-20 w-20 rounded-full border-2 border-slate-600"
          />
          <h1 className="mt-3 text-[18px] font-bold">{peerName}</h1>
          <p className="text-[13px]" style={{ color: online ? GREEN : MUTED }}>
            {statusLine}
          </p>
          <div className="mt-4 flex justify-center gap-6 text-[12px]" style={{ color: MUTED }}>
            {(
              [
                ["🎧", "Audio"],
                ["📹", "Video"],
                ["🔍", "Search"],
                ["🚫", "Block"],
              ] as const
            ).map(([ic, label]) => (
              <button
                key={label}
                type="button"
                className="flex flex-col items-center gap-1 hover:text-white"
                onClick={() => showToast(`${label} (coming soon)`)}
              >
                <span className="text-xl">{ic}</span>
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div
          className="mt-6 rounded-xl p-4 text-[13px]"
          style={{ background: CARD_BG }}
        >
          <p className="font-semibold text-white">
            Your money with {peerName}
          </p>
          {spendLoading ? (
            <p className="mt-3 text-slate-400">Loading balances…</p>
          ) : (
            <div className="mt-3 space-y-2">
              <div className="flex justify-between">
                <span style={{ color: MUTED }}>You paid for them</span>
                <span style={{ color: GREEN }}>
                  ₹{youPaidForThem.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: MUTED }}>They paid for you</span>
                <span style={{ color: GREEN }}>
                  ₹{theyPaidForYou.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: MUTED }}>You owe them</span>
                <span style={{ color: youOweThem > 0 ? RED : MUTED }}>
                  ₹{youOweThem.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: MUTED }}>They owe you</span>
                <span
                  className="font-semibold"
                  style={{ color: theyOweYou > 0 ? RED : MUTED }}
                >
                  ₹{theyOweYou.toLocaleString("en-IN")}
                </span>
              </div>
            </div>
          )}
          <Link
            href="/split-activities"
            className="mt-4 block rounded-lg py-2.5 text-center text-[13px] font-bold text-sky-400 hover:bg-slate-700/50"
          >
            Settle up →
          </Link>
        </div>

        <div className="mt-6">
          <div className="flex border-b border-slate-700/80 text-[12px] font-semibold">
            {(
              [
                ["media", "Media"],
                ["links", "Links"],
                ["docs", "Docs"],
                ["trips", "Trips"],
                ["activities", "Activities"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`flex-1 py-2 ${
                  tab === id ? "border-b-2 text-white" : "text-slate-500"
                }`}
                style={tab === id ? { borderColor: CORAL } : undefined}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="mt-4 min-h-[100px] text-[13px]">
            {tab === "media" ? (
              media.length === 0 ? (
                <p className="text-center" style={{ color: MUTED }}>
                  No media shared yet
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-1.5">
                  {media.map((im, i) => (
                    <button
                      key={`${im.url}-${i}`}
                      type="button"
                      className="aspect-square overflow-hidden rounded-lg bg-slate-800"
                      onClick={() => setLightbox(im.url)}
                    >
                      <img
                        src={im.url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )
            ) : null}
            {tab === "links" ? (
              links.length === 0 ? (
                <p className="text-center" style={{ color: MUTED }}>
                  No links yet
                </p>
              ) : (
                <ul className="space-y-2">
                  {links.map((l, i) => (
                    <li
                      key={`${l.url}-${i}`}
                      className="flex gap-2 rounded-lg bg-slate-800/60 px-2 py-2"
                    >
                      <img
                        src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domainFromUrl(l.url))}&sz=32`}
                        alt=""
                        className="h-5 w-5"
                        width={20}
                        height={20}
                      />
                      <a
                        href={l.url}
                        target="_blank"
                        rel="noreferrer"
                        className="break-all text-sky-400"
                      >
                        {l.url}
                      </a>
                      <span className="shrink-0 text-[11px]" style={{ color: MUTED }}>
                        {formatShortDate(l.ts)}
                      </span>
                    </li>
                  ))}
                </ul>
              )
            ) : null}
            {tab === "docs" ? (
              docs.length === 0 ? (
                <p className="text-center" style={{ color: MUTED }}>
                  No documents yet
                </p>
              ) : (
                <ul className="space-y-2">
                  {docs.map((d, i) => (
                    <li key={`${d.name}-${i}`} className="text-slate-300">
                      📄 {d.name} · {d.size}
                    </li>
                  ))}
                </ul>
              )
            ) : null}
            {tab === "trips" ? (
              <div>
                <p className="mb-2 font-semibold text-white">
                  {sharedTrips.length} trips together
                </p>
                <ul className="space-y-2">
                  {sharedTrips.map((t) => (
                    <li key={t.id} className="rounded-lg bg-slate-800/50 px-3 py-2">
                      <Link
                        href={`/trips/${t.id}`}
                        className="font-medium text-sky-400"
                      >
                        {t.title}
                      </Link>
                      <p className="text-[11px]" style={{ color: MUTED }}>
                        {(t.start_date ?? "—") + " – " + (t.end_date ?? "—")} ·{" "}
                        {t.status}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {tab === "activities" ? (
              <div className="space-y-2">
                <p>
                  <span style={{ color: MUTED }}>Total messages: </span>
                  <span className="text-white">{messages.length} (in session)</span>
                </p>
                <p>
                  <span style={{ color: MUTED }}>Total expenses shared (chat): </span>
                  <span className="text-white">
                    ₹{expenseTotal.toLocaleString("en-IN")}
                  </span>
                </p>
                <p className="font-semibold text-white">Groups in common</p>
                <ul className="space-y-1">
                  {mutualGroups.map((g) => (
                    <li key={g.id} className="text-[12px] text-slate-300">
                      · {g.name}
                    </li>
                  ))}
                  {mutualGroups.length === 0 ? (
                    <li style={{ color: MUTED }}>No shared groups</li>
                  ) : null}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {lightbox ? (
        <button
          type="button"
          className="fixed inset-0 z-[500] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightbox(null)}
        >
          <img
            src={lightbox}
            alt=""
            className="max-h-full max-w-full object-contain"
          />
        </button>
      ) : null}
    </div>
  );
}
