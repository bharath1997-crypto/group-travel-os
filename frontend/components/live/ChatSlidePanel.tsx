"use client";

import { ArrowLeft, Loader2, Send } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnchoredLivePopover } from "@/components/live/AnchoredLivePopover";
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

function timeAgo(iso: string): string {
  const mins = minutesAgo(iso);
  if (mins === 0) return "just now";
  return `${mins}m ago`;
}

interface ChatSlidePanelProps {
  chatOpen: boolean;
  chatTarget: { id: string; label: string; type: "traveler" | "report" } | null;
  anchorEl: HTMLElement | null;
  onBack: () => void;
  onToast?: (message: string) => void;
}

export function ChatSlidePanel({
  chatOpen,
  chatTarget,
  anchorEl,
  onBack,
  onToast,
}: ChatSlidePanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const sessionKeyRef = useRef("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    sessionKeyRef.current = getDriveSessionKey();
  }, []);

  const loadMessages = useCallback(
    async (silent = false) => {
      if (!chatTarget) return;
      if (!silent) setLoading(true);
      try {
        if (chatTarget.type === "traveler") {
          const params = new URLSearchParams({
            sender_session_key: sessionKeyRef.current,
          });
          const data = await apiFetch<ChatMessage[]>(
            `/live/travelers/${chatTarget.id}/chat?${params.toString()}`,
          );
          setMessages(data);
        } else {
          const data = await apiFetch<ChatMessage[]>(
            `/live/reports/${chatTarget.id}/chat`,
          );
          setMessages(data);
        }
      } catch {
        if (!silent) onToast?.("Could not load chat messages.");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [chatTarget, onToast],
  );

  useEffect(() => {
    if (!chatOpen || !chatTarget) {
      setMessages([]);
      setInput("");
      return;
    }
    void loadMessages(false);
    const interval = window.setInterval(() => {
      void loadMessages(true);
    }, 5000);
    return () => window.clearInterval(interval);
  }, [chatOpen, chatTarget, loadMessages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending || !chatTarget) return;

    const optimisticId = `local-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: optimisticId, text, sender_label: "You", sent_at: new Date().toISOString() },
    ]);
    setInput("");
    setSending(true);

    try {
      if (chatTarget.type === "traveler") {
        const created = await apiFetch<{
          message_id: string;
          sent_at: string;
          text: string;
          sender_label: string;
        }>(`/live/travelers/${chatTarget.id}/chat`, {
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
      } else {
        const created = await apiFetch<{
          message_id: string;
          sent_at: string;
          text: string;
          sender_label: string;
        }>(`/live/reports/${chatTarget.id}/chat`, {
          method: "POST",
          body: JSON.stringify({ text }),
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
      }
    } catch {
      setMessages((prev) => prev.filter((msg) => msg.id !== optimisticId));
      onToast?.("Failed to send");
    } finally {
      setSending(false);
    }
  };

  return (
    <AnchoredLivePopover isOpen={chatOpen && Boolean(chatTarget)} anchorEl={chatOpen ? anchorEl : null}>
      {chatTarget ? (
        <>
          <div className="flex items-center gap-2 border-b border-white/8 px-3 py-3">
            <button
              type="button"
              onClick={onBack}
              className="text-white/50 transition-colors hover:text-white/80"
              aria-label="Back"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-medium text-white/90">{chatTarget.label}</p>
              <p className="mt-0.5 text-[10px] text-white/35">Anonymous</p>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-3 py-3">
            {loading ? (
              <div className="flex justify-center py-6">
                <Loader2 size={20} className="animate-spin text-emerald-400" />
              </div>
            ) : null}

            {!loading && messages.length === 0 ? (
              <p className="py-6 text-center text-sm text-white/35">No messages yet</p>
            ) : null}

            {messages.map((message) => {
              const myMessage = message.sender_label === "You";
              return (
                <div
                  key={message.id}
                  className={[
                    "max-w-[80%] rounded-2xl px-3 py-2 text-[12px] leading-relaxed",
                    myMessage
                      ? "self-end rounded-br-sm bg-[#0F766E] text-white"
                      : "self-start rounded-bl-sm bg-white/10 text-white/85",
                  ].join(" ")}
                >
                  {message.text}
                  <div
                    className={[
                      "mt-1 text-right text-[9px]",
                      myMessage ? "text-white/50" : "text-white/30",
                    ].join(" ")}
                  >
                    {timeAgo(message.sent_at)}
                  </div>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>

          <div className="relative shrink-0">
            {input.length >= 150 ? (
              <span className="absolute -top-3.5 right-4 text-[10px] text-red-400">
                {input.length}/200
              </span>
            ) : null}
            <div className="flex items-center gap-2 border-t border-white/8 px-3 py-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleSend();
                }}
                placeholder="Message..."
                maxLength={200}
                className="flex-1 rounded-xl border border-white/6 bg-white/6 px-3 py-2 text-[12px] text-white/80 outline-none placeholder:text-white/25"
              />
              <button
                type="button"
                onClick={() => void handleSend()}
                disabled={sending || !input.trim()}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0F766E] transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Send message"
              >
                <Send size={14} className="text-white" />
              </button>
            </div>
            <p className="pb-2 text-center text-[10px] text-white/30">
              Anonymous · text only · expires with report
            </p>
          </div>
        </>
      ) : null}
    </AnchoredLivePopover>
  );
}
