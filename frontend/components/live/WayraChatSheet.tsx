"use client";

import { Loader2, MessageCircle, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { apiFetch, apiFetchPublic } from "@/lib/api";

type ChatMessage = {
  id: string;
  sender: "user" | "wayra";
  text: string;
};

const WAYRA_SESSION_KEY = "live-wayra-session-key";

function getOrCreateSessionKey(): string {
  const existing = sessionStorage.getItem(WAYRA_SESSION_KEY);
  if (existing) return existing;
  const key = crypto.randomUUID();
  sessionStorage.setItem(WAYRA_SESSION_KEY, key);
  return key;
}

type WayraChatSheetProps = {
  isGuest: boolean;
  guestRemaining: number;
  guestLimit: number;
  onGuestRemainingChange: (remaining: number) => void;
  onGuestLimit: () => void;
  onClose: () => void;
};

export function WayraChatSheet({
  isGuest,
  guestRemaining,
  guestLimit,
  onGuestRemainingChange,
  onGuestLimit,
  onClose,
}: WayraChatSheetProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      sender: "wayra",
      text: "Hi, I'm Wayra. Ask about traffic, hazards, or your route.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const sessionKeyRef = useRef<string>("");

  useEffect(() => {
    sessionKeyRef.current = getOrCreateSessionKey();
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    if (isGuest && guestRemaining <= 0) {
      onGuestLimit();
      return;
    }

    const userMsg: ChatMessage = {
      id: `${Date.now()}-user`,
      sender: "user",
      text,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      if (isGuest) {
        const res = await apiFetchPublic<{ reply: string; remaining: number }>(
          "/live/wayra/guest",
          {
            method: "POST",
            body: JSON.stringify({
              message: text,
              session_key: sessionKeyRef.current,
            }),
          },
        );
        onGuestRemainingChange(res.remaining);
        setMessages((prev) => [
          ...prev,
          { id: `${Date.now()}-wayra`, sender: "wayra", text: res.reply },
        ]);
      } else {
        const res = await apiFetch<{ response: string }>("/wayra/chat", {
          method: "POST",
          body: JSON.stringify({ message: text }),
        });
        setMessages((prev) => [
          ...prev,
          {
            id: `${Date.now()}-wayra`,
            sender: "wayra",
            text: res.response,
          },
        ]);
      }
    } catch (error) {
      if (
        isGuest &&
        error instanceof Error &&
        /Guest message limit reached/i.test(error.message)
      ) {
        onGuestRemainingChange(0);
        onGuestLimit();
        return;
      }
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-err`,
          sender: "wayra",
          text: "Sorry, I couldn't respond right now. Try again in a moment.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const guestUsed = Math.min(guestLimit, guestLimit - guestRemaining);

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/40">
      <button
        type="button"
        aria-label="Close Wayra chat"
        className="absolute inset-0"
        onClick={onClose}
      />
      <div className="relative z-10 flex h-[min(70dvh,520px)] w-full max-w-lg flex-col rounded-t-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0F766E] text-white">
              <MessageCircle size={16} />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-stone-900">Wayra</h2>
              {isGuest ? (
                <p className="text-xs text-stone-500">
                  {guestUsed}/{guestLimit} guest messages
                </p>
              ) : null}
            </div>
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
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                  msg.sender === "user"
                    ? "bg-[#0F766E] text-white"
                    : "bg-stone-100 text-stone-800"
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}
          {loading ? (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-stone-100 px-3 py-2">
                <Loader2 size={16} className="animate-spin text-[#0F766E]" />
              </div>
            </div>
          ) : null}
          <div ref={endRef} />
        </div>

        <form
          className="flex items-center gap-2 border-t border-stone-200 px-3 py-3"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSend();
          }}
        >
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask Wayra…"
            className="min-w-0 flex-1 rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-[#0F766E]"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0F766E] text-white disabled:opacity-50"
            aria-label="Send message"
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
