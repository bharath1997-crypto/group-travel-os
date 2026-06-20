"use client";

import { Loader2, MessageCircle, Mic, Send, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, apiFetchPublic } from "@/lib/api";
import { speakWayra } from "@/lib/live/wayra-voice";

type ChatMessage = {
  id: string;
  sender: "user" | "wayra";
  text: string;
};

type WayraLiveResponse = {
  reply: string;
  action?: "open_poi_search" | "open_navigation" | "call_sos" | null;
};

const WAYRA_SESSION_KEY = "live-wayra-session-key";
const MAX_MESSAGES = 10;

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
  buildContext: () => Record<string, unknown>;
  onAction?: (action: NonNullable<WayraLiveResponse["action"]>) => void;
  onToast?: (message: string) => void;
  onClose: () => void;
};

export function WayraChatSheet({
  isGuest,
  guestRemaining,
  guestLimit,
  onGuestRemainingChange,
  onGuestLimit,
  buildContext,
  onAction,
  onToast,
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
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);
  const sessionKeyRef = useRef<string>("");
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    sessionKeyRef.current = getOrCreateSessionKey();
    const supported =
      typeof window !== "undefined" &&
      ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
    setVoiceSupported(supported);
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const appendMessages = useCallback((next: ChatMessage[]) => {
    setMessages((prev) => [...prev, ...next].slice(-MAX_MESSAGES));
  }, []);

  const handleClose = () => {
    recognitionRef.current?.stop();
    setMessages([
      {
        id: "welcome",
        sender: "wayra",
        text: "Hi, I'm Wayra. Ask about traffic, hazards, or your route.",
      },
    ]);
    setInput("");
    onClose();
  };

  const sendMessage = useCallback(
    async (rawText: string) => {
      const text = rawText.trim();
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
      appendMessages([userMsg]);
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
          appendMessages([
            { id: `${Date.now()}-wayra`, sender: "wayra", text: res.reply },
          ]);
        } else {
          const res = await apiFetch<WayraLiveResponse>("/live/wayra", {
            method: "POST",
            body: JSON.stringify({
              message: text,
              context: buildContext(),
            }),
          });
      appendMessages([
        { id: `${Date.now()}-wayra`, sender: "wayra", text: res.reply },
      ]);
      speakWayra(res.reply);
      if (res.action && onAction) {
            onAction(res.action);
          }
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
        appendMessages([
          {
            id: `${Date.now()}-err`,
            sender: "wayra",
            text: "Sorry, I couldn't respond right now. Try again in a moment.",
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [
      appendMessages,
      buildContext,
      guestRemaining,
      isGuest,
      loading,
      onAction,
      onGuestLimit,
      onGuestRemainingChange,
    ],
  );

  const handleSend = () => {
    void sendMessage(input);
  };

  const startVoiceInput = () => {
    if (!voiceSupported) {
      onToast?.("Voice not supported on this browser");
      return;
    }

    type SpeechRecognitionCtor = new () => {
      lang: string;
      continuous: boolean;
      interimResults: boolean;
      onresult: ((event: { results: Array<Array<{ transcript: string }>> }) => void) | null;
      onerror: (() => void) | null;
      onend: (() => void) | null;
      start: () => void;
      stop: () => void;
    };

    const windowWithSpeech = window as Window & {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const SpeechRecognition =
      windowWithSpeech.SpeechRecognition || windowWithSpeech.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      onToast?.("Voice not supported on this browser");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? "";
      if (transcript) {
        setInput(transcript);
        window.setTimeout(() => {
          void sendMessage(transcript);
        }, 500);
      }
    };

    recognition.onerror = () => {
      onToast?.("Voice input failed. Try again.");
      setVoiceListening(false);
    };

    recognition.onend = () => {
      setVoiceListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
    setVoiceListening(true);
  };

  const guestUsed = Math.min(guestLimit, guestLimit - guestRemaining);

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/40">
      <button
        type="button"
        aria-label="Close Wayra chat"
        className="absolute inset-0"
        onClick={handleClose}
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
            onClick={handleClose}
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
              <div className="flex items-center gap-1 rounded-2xl bg-stone-100 px-3 py-2">
                <span className="live-wayra-typing-dot" />
                <span className="live-wayra-typing-dot live-wayra-typing-dot--2" />
                <span className="live-wayra-typing-dot live-wayra-typing-dot--3" />
              </div>
            </div>
          ) : null}
          <div ref={endRef} />
        </div>

        <form
          className="flex items-center gap-2 border-t border-stone-200 px-3 py-3"
          onSubmit={(event) => {
            event.preventDefault();
            handleSend();
          }}
        >
          <button
            type="button"
            disabled={!voiceSupported || loading || voiceListening}
            onClick={startVoiceInput}
            title={
              voiceSupported
                ? "Voice input"
                : "Not supported on this browser"
            }
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition ${
              voiceListening
                ? "border-red-300 bg-red-50 text-red-600 live-wayra-mic-listening"
                : voiceSupported
                  ? "border-stone-200 text-stone-500 hover:bg-stone-50"
                  : "border-stone-100 text-stone-300"
            }`}
            aria-label="Voice input"
          >
            <Mic size={16} />
          </button>
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
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </form>
      </div>
    </div>
  );
}
