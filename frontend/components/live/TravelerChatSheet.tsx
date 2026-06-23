"use client";

import { ArrowUp, Flag, Loader2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { minutesAgo } from "@/lib/live/types";

type ChatMessage = {
  id: string;
  text: string;
  sender_label: string;
  sent_at: string;
};

const DRIVE_SESSION_KEY = "rovvy_drive_session";

function getDriveSessionKey(): string {
  const existing = sessionStorage.getItem(DRIVE_SESSION_KEY);
  if (existing) return existing;
  const key = crypto.randomUUID();
  sessionStorage.setItem(DRIVE_SESSION_KEY, key);
  return key;
}

type TravelerChatSheetProps = {
  travelerId: string;
  travelerLabel: string;
  onClose: () => void;
  onToast?: (message: string) => void;
};

export function TravelerChatSheet({
  travelerId,
  travelerLabel,
  onClose,
  onToast,
}: TravelerChatSheetProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const sessionKeyRef = useRef("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    sessionKeyRef.current = getDriveSessionKey();
  }, []);

  const loadMessages = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const params = new URLSearchParams({
          sender_session_key: sessionKeyRef.current,
        });
        const data = await apiFetch<ChatMessage[]>(
          `/live/travelers/${travelerId}/chat?${params.toString()}`,
        );
        setMessages(data);
      } catch {
        if (!silent) onToast?.("Could not load chat messages.");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [onToast, travelerId],
  );

  useEffect(() => {
    void loadMessages(false);
    const interval = window.setInterval(() => {
      void loadMessages(true);
    }, 5000);
    return () => window.clearInterval(interval);
  }, [loadMessages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;

    const optimisticId = `local-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: optimisticId,
        text,
        sender_label: "You",
        sent_at: new Date().toISOString(),
      },
    ]);
    setInput("");
    setSending(true);

    try {
      const created = await apiFetch<{
        message_id: string;
        sent_at: string;
        text: string;
        sender_label: string;
      }>(`/live/travelers/${travelerId}/chat`, {
        method: "POST",
        body: JSON.stringify({
          text,
          sender_session_key: sessionKeyRef.current,
        }),
      });
      setMessages((prev) =>
        prev
          .filter((msg) => msg.id !== optimisticId)
          .concat({
            id: created.message_id,
            text: created.text,
            sender_label: "You",
            sent_at: created.sent_at,
          }),
      );
    } catch {
      setMessages((prev) => prev.filter((msg) => msg.id !== optimisticId));
      onToast?.("Failed to send");
    } finally {
      setSending(false);
    }
  };

  const handleFlag = async (messageId: string) => {
    try {
      await apiFetch(`/live/travelers/${travelerId}/chat/${messageId}/flag`, {
        method: "POST",
      });
      onToast?.("Message reported");
      await loadMessages(true);
    } catch {
      onToast?.("Could not report message.");
    }
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-end justify-center bg-black/40">
      <button
        type="button"
        aria-label="Close traveler chat"
        className="absolute inset-0"
        onClick={onClose}
      />
      <div className="relative z-10 flex h-[60dvh] w-full max-w-lg flex-col rounded-t-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-stone-200 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-stone-900">{travelerLabel}</p>
            <p className="mt-1 text-xs text-stone-500">On same route</p>
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

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 size={20} className="animate-spin text-[#0F766E]" />
            </div>
          ) : null}

          {!loading && messages.length === 0 ? (
            <p className="py-8 text-center text-sm text-stone-500">
              No messages yet. Say hello to a fellow traveler.
            </p>
          ) : null}

          {messages.map((msg) => {
            const isYou = msg.sender_label === "You";
            return (
              <div key={msg.id} className="flex items-start gap-2">
                <div className="min-w-0 flex-1 rounded-2xl bg-stone-100 px-3 py-2">
                  <p className="text-xs font-semibold text-stone-500">
                    {isYou ? "You" : msg.sender_label}
                  </p>
                  <p className="text-sm text-stone-800">{msg.text}</p>
                  <p className="mt-1 text-xs text-stone-400">
                    {minutesAgo(msg.sent_at) === 0
                      ? "just now"
                      : `${minutesAgo(msg.sent_at)} min ago`}
                  </p>
                </div>
                {!isYou ? (
                  <button
                    type="button"
                    aria-label="Report message"
                    onClick={() => void handleFlag(msg.id)}
                    className="mt-1 rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
                  >
                    <Flag size={14} />
                  </button>
                ) : null}
              </div>
            );
          })}
          <div ref={endRef} />
        </div>

        <div className="border-t border-stone-200 px-4 py-3">
          <form
            className="flex items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSend();
            }}
          >
            <div className="min-w-0 flex-1">
              <input
                value={input}
                maxLength={200}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Message traveler..."
                className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-[#0F766E]"
              />
              {input.length > 150 ? (
                <p className="mt-1 text-right text-xs text-stone-400">
                  {input.length}/200
                </p>
              ) : null}
            </div>
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0F766E] text-white disabled:opacity-50"
              aria-label="Send message"
            >
              <ArrowUp size={16} />
            </button>
          </form>
          <p className="mt-2 text-center text-[11px] text-stone-400">
            Anonymous · text only · chat ends when you leave this route
          </p>
        </div>
      </div>
    </div>
  );
}
