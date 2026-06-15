"use client";

import { useEffect, useRef, useState } from "react";
import { Phone, Video, ChevronLeft, Send, Smile } from "lucide-react";
import {
  DEMO_AUTO_REPLIES,
  DEMO_DM_SCRIPTS,
  type DemoContactKind,
} from "@/lib/lounge/demo-contacts";
import { ChatEmojiGifPicker } from "./ChatEmojiGifPicker";

export type DemoChatView = {
  id: string;
  name: string;
  kind: DemoContactKind;
  initials: string;
  bg: string;
};

type DemoDmChatPanelProps = {
  chat: DemoChatView;
  onBack?: () => void;
  onToast?: (msg: string) => void;
  variant?: "popup" | "full";
};

export function DemoDmChatPanel({
  chat,
  onBack,
  onToast,
  variant = "popup",
}: DemoDmChatPanelProps) {
  const isFull = variant === "full";
  const kind = chat.kind;
  const baseScript = DEMO_DM_SCRIPTS[kind] ?? DEMO_DM_SCRIPTS.arjun;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [extra, setExtra] = useState<
    { id: string; dir: "in" | "out"; text: string; time: string }[]
  >([]);
  const [input, setInput] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [emojiTab, setEmojiTab] = useState<"emoji" | "gif" | "stickers">("emoji");
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
        DEMO_AUTO_REPLIES[Math.floor(Math.random() * DEMO_AUTO_REPLIES.length)]!;
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

  const bubbleOut = isFull ? "#0F766E" : "#0F766E";
  const bubbleIn = isFull ? "#263545" : "#ffffff";
  const textOut = "#fff";
  const textIn = isFull ? "#fff" : "#1e293b";

  return (
    <div
      className={`flex min-h-0 flex-1 flex-col ${isFull ? "" : "bg-stone-50"}`}
      style={isFull ? { background: "#e8ddd0" } : undefined}
    >
      <header
        className={`flex shrink-0 items-center gap-2 border-b px-3 py-2.5 ${isFull ? "" : "bg-white border-stone-200"}`}
        style={isFull ? { borderColor: "rgba(255,255,255,0.1)", background: "#0f1923" } : undefined}
      >
        {onBack ? (
          <button type="button" onClick={onBack} className="p-1 text-stone-400" aria-label="Back">
            <ChevronLeft size={18} className={isFull ? "text-white" : "text-[#0F766E]"} />
          </button>
        ) : null}
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
          style={{ background: chat.bg }}
        >
          {chat.initials}
        </span>
        <div className="min-w-0 flex-1">
          <p className={`truncate text-xs font-bold ${isFull ? "text-white" : "text-slate-900"}`}>
            {chat.name}
          </p>
          <p className={`text-[10px] ${isFull ? "text-slate-400" : "text-stone-500"}`}>
            Demo account · for testing
          </p>
        </div>
        <button
          type="button"
          aria-label="Video call"
          onClick={() => onToast?.("Calls coming soon")}
          className={isFull ? "text-white/80" : "text-stone-400"}
        >
          <Video size={16} />
        </button>
        <button
          type="button"
          aria-label="Voice call"
          onClick={() => onToast?.("Calls coming soon")}
          className={isFull ? "text-white/80" : "text-stone-400"}
        >
          <Phone size={16} />
        </button>
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {kind === "self" ? (
          <p className="rounded-lg bg-stone-100 px-2 py-2 text-center text-[10px] text-stone-500">
            Demo self-conversation for testing
          </p>
        ) : null}
        {[...baseScript, ...extra].map((line, i) => (
          <div
            key={`${line.dir}-${i}-${line.time}`}
            className={`flex w-full ${line.dir === "out" ? "justify-end" : "justify-start"}`}
          >
            <div
              className="max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-snug shadow-sm"
              style={{
                background: line.dir === "out" ? bubbleOut : bubbleIn,
                color: line.dir === "out" ? textOut : textIn,
                border: line.dir === "in" && !isFull ? "1px solid #e7e5e4" : undefined,
              }}
            >
              {line.text}
              <p
                className="mt-1 text-[9px] opacity-70"
                style={{ textAlign: line.dir === "out" ? "right" : "left" }}
              >
                {line.time}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className={`relative shrink-0 border-t ${isFull ? "" : "bg-white border-stone-200"}`}
        style={isFull ? { borderColor: "rgba(255,255,255,0.1)", background: "#0f1923" } : undefined}
      >
        <ChatEmojiGifPicker
          variant={isFull ? "dark" : "light"}
          open={emojiOpen}
          tab={emojiTab}
          onTabChange={setEmojiTab}
          panelHeightPx={220}
          onClose={() => setEmojiOpen(false)}
          onInsertEmoji={(em) => setInput((v) => v + em)}
          onPickGifUrl={() => onToast?.("GIFs in demo chats coming soon")}
        />
        <div className="flex items-center gap-1.5 px-2 py-2">
          <button
            type="button"
            onClick={() => setEmojiOpen((o) => !o)}
            className={`p-1.5 ${isFull ? "text-slate-400" : "text-stone-400"}`}
          >
            <Smile size={18} />
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendDemo()}
            placeholder="Message..."
            className={`flex-1 rounded-full px-3 py-1.5 text-xs outline-none ${
              isFull
                ? "bg-white/10 text-white placeholder:text-slate-500"
                : "bg-stone-100 text-slate-900"
            }`}
          />
          <button
            type="button"
            onClick={sendDemo}
            disabled={!input.trim()}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0F766E] text-white disabled:opacity-40"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
