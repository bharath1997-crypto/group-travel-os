"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import WayraIcon from "@/components/ui/WayraIcon";
import { BOT_CHIP_QUESTIONS } from "@/lib/lounge/constants";
import { findBotAnswerForText } from "@/lib/lounge/bot-help";
import { LOUNGE_FULL } from "@/lib/lounge/theme";

type BotMsg = {
  id: string;
  role: "user" | "bot";
  text: string;
  timestamp: number;
};

const WELCOME =
  "Hi! I'm your Rovvy assistant. I can help you plan trips, split expenses, find destinations, and more. Try asking me something!";

export function RovvyHelpPanel({
  variant = "popup",
  compact = false,
}: {
  variant?: "full" | "popup";
  compact?: boolean;
}) {
  const isFull = variant === "full";
  const isResponding = useRef(false);
  const [messages, setMessages] = useState<BotMsg[]>(() => [
    { id: "welcome", role: "bot", text: WELCOME, timestamp: Date.now() },
  ]);
  const [showChips, setShowChips] = useState(true);
  const [input, setInput] = useState("");
  const [botBusy, setBotBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, showChips]);

  const sendFlow = (question: string) => {
    const q = question.trim();
    if (!q || isResponding.current || botBusy) return;
    isResponding.current = true;
    setBotBusy(true);
    const uid = `${Date.now()}-${Math.random()}`;
    setMessages((m) => [...m, { id: uid, role: "user", text: q, timestamp: Date.now() }]);
    setShowChips(false);
    setInput("");
    const answer = findBotAnswerForText(q);
    globalThis.setTimeout(() => {
      setMessages((m) => [
        ...m,
        { id: `${Date.now()}`, role: "bot", text: answer, timestamp: Date.now() },
      ]);
      setShowChips(true);
      globalThis.setTimeout(() => {
        isResponding.current = false;
        setBotBusy(false);
      }, isFull ? 800 : 400);
    }, isFull ? 600 : 500);
  };

  const resetChat = () => {
    setMessages([{ id: `${Date.now()}`, role: "bot", text: WELCOME, timestamp: Date.now() }]);
    setShowChips(true);
  };

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      style={isFull ? { background: LOUNGE_FULL.rightPanelBg } : undefined}
    >
      {isFull ? (
        <header
          className="flex shrink-0 items-center gap-3 border-b px-4 py-3"
          style={{ borderColor: LOUNGE_FULL.borderSub, background: LOUNGE_FULL.bg }}
        >
          <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-[#E9ECEF] bg-[#F8F9FA]">
            <WayraIcon state="flying" size={0.5} variant="navy" animate={false} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-medium text-white">Rovvy Help</p>
            <p className="flex items-center gap-1.5 text-[12px]" style={{ color: LOUNGE_FULL.textMuted }}>
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: LOUNGE_FULL.online }} />
              AI Assistant · always online
            </p>
          </div>
        </header>
      ) : null}

      <div
        ref={scrollRef}
        className={`min-h-0 flex-1 overflow-y-auto ${isFull ? "custom-scrollbar px-4 py-3" : "p-3 space-y-2"}`}
      >
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} ${isFull ? "mb-3" : ""}`}
          >
            <div
              className={
                isFull
                  ? "max-w-[85%] rounded-2xl px-3 py-2 text-[14px] leading-snug text-white"
                  : `max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                      m.role === "user"
                        ? "bg-[#0F766E] text-white rounded-tr-none"
                        : "bg-white text-slate-900 border border-stone-200 rounded-tl-none"
                    }`
              }
              style={
                isFull
                  ? { background: m.role === "user" ? LOUNGE_FULL.accent : LOUNGE_FULL.surface }
                  : undefined
              }
            >
              {m.text}
            </div>
          </div>
        ))}
        {showChips ? (
          <div className={`flex flex-wrap gap-${isFull ? "2" : "1.5"} ${isFull ? "mb-4" : "pt-1"}`}>
            {BOT_CHIP_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                disabled={botBusy}
                onClick={() => sendFlow(q)}
                className={
                  isFull
                    ? "rounded-full border px-3 py-1.5 text-left text-[12px] text-white disabled:opacity-45"
                    : "rounded-full border border-stone-200 bg-white px-2.5 py-1 text-[10px] font-medium text-slate-700 hover:bg-teal-50 disabled:opacity-45"
                }
                style={isFull ? { borderColor: LOUNGE_FULL.msgBorder, background: LOUNGE_FULL.surface } : undefined}
              >
                {q}
              </button>
            ))}
            {isFull ? (
              <button
                type="button"
                disabled={botBusy}
                onClick={resetChat}
                className="rounded-full px-3 py-1.5 text-[12px] disabled:opacity-45"
                style={{ color: LOUNGE_FULL.textSecondary, border: `1px dashed ${LOUNGE_FULL.msgBorder}` }}
              >
                Ask another question
              </button>
            ) : null}
          </div>
        ) : null}
        {botBusy ? (
          <div className={`flex items-center gap-1.5 ${isFull ? "text-[12px]" : "text-[10px]"} text-stone-500`}>
            <Loader2 className="h-3 w-3 animate-spin" />
            Thinking...
          </div>
        ) : null}
      </div>

      <div
        className={`shrink-0 flex gap-1.5 ${isFull ? "border-t px-3 py-2 gap-2" : "border-t border-stone-200 bg-white p-2"}`}
        style={isFull ? { borderColor: LOUNGE_FULL.borderSub, background: LOUNGE_FULL.bg } : undefined}
      >
        {!compact && !isFull ? (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-stone-200 bg-stone-50">
            <WayraIcon state="flying" size={0.4} variant="navy" animate={false} />
          </span>
        ) : null}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") sendFlow(input);
          }}
          disabled={botBusy}
          placeholder="Ask a question…"
          className={
            isFull
              ? "min-w-0 flex-1 rounded-full border-0 px-4 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 disabled:opacity-45"
              : "min-w-0 flex-1 rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-[#0F766E] disabled:opacity-45"
          }
          style={isFull ? { background: LOUNGE_FULL.surface } : undefined}
        />
        <button
          type="button"
          disabled={botBusy}
          onClick={() => sendFlow(input)}
          className={
            isFull
              ? "shrink-0 rounded-full px-5 py-2 text-sm font-semibold text-white disabled:opacity-45"
              : "shrink-0 rounded-full bg-[#0F766E] px-3 py-1.5 text-[10px] font-bold text-white disabled:opacity-45"
          }
          style={isFull ? { background: LOUNGE_FULL.accent } : undefined}
        >
          Send
        </button>
      </div>
    </div>
  );
}
