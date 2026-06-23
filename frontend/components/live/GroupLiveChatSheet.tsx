"use client";

import { ArrowUp, Loader2, X } from "lucide-react";
import { off, onValue, push, ref, type Database } from "firebase/database";
import { useCallback, useEffect, useRef, useState } from "react";

type ChatMessage = {
  id: string;
  text: string;
  sender_id: string;
  sender_name: string;
  timestamp: number;
};

type GroupLiveChatSheetProps = {
  tripId: string;
  db: Database;
  currentUserId: string;
  currentUserName: string;
  onClose: () => void;
};

const MAX_CHARS = 500;

export function GroupLiveChatSheet({
  tripId,
  db,
  currentUserId,
  currentUserName,
  onClose,
}: GroupLiveChatSheetProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const chatRef = ref(db, `trips/${tripId}/chat`);
    const unsubscribe = onValue(chatRef, (snapshot) => {
      const raw = snapshot.val();
      if (!raw || typeof raw !== "object") {
        setMessages([]);
        return;
      }
      const parsed: ChatMessage[] = Object.entries(raw).map(([id, value]) => {
        const payload = value as Record<string, unknown>;
        return {
          id,
          text: String(payload.text ?? payload.message ?? ""),
          sender_id: String(payload.sender_id ?? ""),
          sender_name: String(payload.sender_name ?? "Member"),
          timestamp: Number(payload.timestamp ?? 0),
        };
      });
      parsed.sort((a, b) => a.timestamp - b.timestamp);
      setMessages(parsed);
    });
    return () => off(chatRef, "value", unsubscribe);
  }, [db, tripId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending || text.length > MAX_CHARS) return;

    setSending(true);
    try {
      const chatRef = ref(db, `trips/${tripId}/chat`);
      await push(chatRef, {
        sender_id: currentUserId,
        sender_name: currentUserName,
        text,
        message: text,
        timestamp: Date.now(),
        type: "text",
      });
      setInput("");
    } finally {
      setSending(false);
    }
  }, [currentUserId, currentUserName, db, input, sending, tripId]);

  return (
    <div className="fixed inset-0 z-[130] flex items-end justify-center bg-black/40">
      <button
        type="button"
        aria-label="Close group chat"
        className="absolute inset-0"
        onClick={onClose}
      />
      <div className="relative z-10 flex h-[min(75dvh,560px)] w-full max-w-lg flex-col rounded-t-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-stone-900">Group chat</h2>
            <p className="text-xs text-stone-500">Live trip chat</p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded-lg p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {messages.length === 0 ? (
            <p className="py-8 text-center text-sm text-stone-500">
              No messages yet. Say hello to the group.
            </p>
          ) : (
            <ul className="space-y-3">
              {messages.map((message) => {
                const mine = message.sender_id === currentUserId;
                return (
                  <li
                    key={message.id}
                    className={`flex flex-col ${mine ? "items-end" : "items-start"}`}
                  >
                    {!mine ? (
                      <span className="mb-1 text-[11px] font-medium text-stone-500">
                        {message.sender_name}
                      </span>
                    ) : null}
                    <div
                      className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                        mine
                          ? "bg-teal-600 text-white"
                          : "bg-stone-100 text-stone-900"
                      }`}
                    >
                      {message.text}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <div ref={endRef} />
        </div>

        <div className="border-t border-stone-200 px-4 py-3">
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value.slice(0, MAX_CHARS))}
              rows={2}
              placeholder="Message the group…"
              className="max-h-28 flex-1 resize-none rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none ring-teal-500 focus:ring-2"
            />
            <button
              type="button"
              disabled={!input.trim() || sending}
              onClick={() => void handleSend()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50"
              aria-label="Send message"
            >
              {sending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <ArrowUp size={16} />
              )}
            </button>
          </div>
          {input.length > 400 ? (
            <p className="mt-1 text-right text-[11px] text-stone-400">
              {input.length}/{MAX_CHARS}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function GroupLiveChatButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Open group chat"
      className="pointer-events-auto absolute bottom-40 right-4 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-[#0F766E] text-white shadow-lg transition hover:bg-[#0d655c]"
    >
      <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current" aria-hidden>
        <path d="M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2z" />
      </svg>
    </button>
  );
}
