"use client";

import { ChevronLeft, Search, Send, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ANCHORED_PANEL_MAX_HEIGHT, useAnchoredPosition } from "@/components/live/AnchoredLivePopover";

type LoungeMessage = {
  text: string;
  mine: boolean;
  time: string;
};

type LoungeChat = {
  id: string;
  name: string;
  lastMessage: string;
  time: string;
  unread: number;
  messages: LoungeMessage[];
};

const MOCK_CHATS: LoungeChat[] = [
  {
    id: "1",
    name: "Trip Group",
    lastMessage: "Where should we meet?",
    time: "2m",
    unread: 3,
    messages: [
      { text: "Hey everyone!", mine: false, time: "3:10" },
      { text: "Where should we meet?", mine: false, time: "3:12" },
      { text: "I am on my way", mine: true, time: "3:13" },
    ],
  },
  {
    id: "2",
    name: "Direct Chat",
    lastMessage: "No messages yet — say hello!",
    time: "Jun 8",
    unread: 0,
    messages: [],
  },
];

interface LoungePanelProps {
  isOpen: boolean;
  onClose: () => void;
  anchorEl: HTMLElement | null;
}

export function LoungePanel({ isOpen, onClose, anchorEl }: LoungePanelProps) {
  const [view, setView] = useState<"list" | "chat">("list");
  const [activeChat, setActiveChat] = useState<LoungeChat | null>(null);
  const [search, setSearch] = useState("");
  const top = useAnchoredPosition(isOpen, anchorEl);

  useEffect(() => {
    if (!isOpen) {
      setView("list");
      setActiveChat(null);
      setSearch("");
    }
  }, [isOpen]);

  const filteredChats = useMemo(
    () =>
      MOCK_CHATS.filter((chat) =>
        chat.name.toLowerCase().includes(search.toLowerCase()),
      ),
    [search],
  );

  if (!isOpen) return null;

  return (
    <div
      className={[
        "fixed z-[30] flex flex-col overflow-hidden rounded-2xl border border-white/10",
        "bg-slate-950/92 shadow-[0_20px_60px_rgba(0,0,0,0.6)] backdrop-blur-2xl",
        "transition-all duration-200",
        isOpen ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0",
      ].join(" ")}
      style={{
        right: 72,
        width: 300,
        height: ANCHORED_PANEL_MAX_HEIGHT,
        top,
      }}
    >
      {view === "list" ? (
        <>
          <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
            <div>
              <span className="text-[13px] font-medium text-white">Rovvy Lounge</span>
              <p className="text-[10px] text-white/40">Messages · calls · updates</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-white/40 transition-colors hover:text-white/70"
              aria-label="Close lounge"
            >
              <X size={15} />
            </button>
          </div>

          <div className="border-b border-white/6 px-3 py-2">
            <div className="flex items-center gap-2 rounded-xl bg-white/6 px-3 py-1.5">
              <Search size={12} className="text-white/30" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search chats..."
                className="flex-1 bg-transparent text-[12px] text-white/80 outline-none placeholder:text-white/25"
              />
            </div>
          </div>

          <div className="flex border-b border-white/6">
            {["Chats", "Calls", "Updates"].map((tab) => (
              <button
                key={tab}
                type="button"
                className="flex-1 py-2 text-[11px] text-white/50 transition-colors hover:text-white/80"
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {filteredChats.map((chat) => (
              <button
                key={chat.id}
                type="button"
                onClick={() => {
                  setActiveChat(chat);
                  setView("chat");
                }}
                className="flex w-full items-center gap-3 border-b border-white/4 px-4 py-3 transition-colors hover:bg-white/5"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-600/30 text-[13px] font-medium text-emerald-300">
                  {chat.name[0]?.toUpperCase()}
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <div className="truncate text-[12px] font-medium text-white/90">{chat.name}</div>
                  <div className="mt-0.5 truncate text-[10px] text-white/35">{chat.lastMessage}</div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-[9px] text-white/25">{chat.time}</span>
                  {chat.unread > 0 ? (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-medium text-white">
                      {chat.unread}
                    </span>
                  ) : null}
                </div>
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-3 border-b border-white/8 px-3 py-3">
            <button
              type="button"
              onClick={() => setView("list")}
              className="text-white/50 transition-colors hover:text-white/80"
              aria-label="Back to chat list"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600/30 text-[11px] font-medium text-emerald-300">
              {activeChat?.name[0]?.toUpperCase()}
            </div>
            <span className="flex-1 text-[12px] font-medium text-white/90">{activeChat?.name}</span>
            <button
              type="button"
              onClick={onClose}
              className="text-white/40 hover:text-white/70"
              aria-label="Close lounge"
            >
              <X size={14} />
            </button>
          </div>

          <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-3 py-3">
            {activeChat?.messages?.map((msg, i) => (
              <div
                key={`${msg.time}-${i}`}
                className={[
                  "max-w-[80%] rounded-2xl px-3 py-2 text-[12px] leading-relaxed",
                  msg.mine
                    ? "self-end rounded-br-sm bg-emerald-600/70 text-white"
                    : "self-start rounded-bl-sm bg-white/10 text-white/85",
                ].join(" ")}
              >
                {msg.text}
                <div
                  className={[
                    "mt-1 text-right text-[9px]",
                    msg.mine ? "text-white/50" : "text-white/30",
                  ].join(" ")}
                >
                  {msg.time}
                </div>
              </div>
            ))}
            {!activeChat?.messages?.length ? (
              <div className="flex flex-1 items-center justify-center">
                <span className="text-[11px] text-white/25">No messages yet · say hello!</span>
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-2 border-t border-white/8 px-3 py-2">
            <input
              placeholder="Message..."
              maxLength={500}
              className="flex-1 rounded-xl border border-white/6 bg-white/6 px-3 py-2 text-[12px] text-white/80 outline-none placeholder:text-white/25"
            />
            <button
              type="button"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-600 transition-colors hover:bg-emerald-500"
              aria-label="Send message"
            >
              <Send size={13} className="text-white" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
