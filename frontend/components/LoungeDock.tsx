"use client";

import React, { useState, useEffect, useRef } from "react";
import { MessageCircle, X, ChevronUp, ChevronDown, Send, User, Bot, Sparkles, MessageSquare } from "lucide-react";
import { apiFetch } from "@/lib/api";

type ChatThread = {
  id: string;
  title: string;
  subtitle: string;
  avatar: string;
  isAi?: boolean;
};

type Message = {
  id: string;
  sender: "user" | "other" | "ai";
  text: string;
  timestamp: string;
};

export function LoungeDock() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeChats, setActiveChats] = useState<ChatThread[]>([]);
  const [openChatBoxes, setOpenChatBoxes] = useState<string[]>([]); // list of chat IDs currently open as popped-up windows
  const [messages, setMessages] = useState<Record<string, Message[]>>({
    ai: [
      { id: "1", sender: "ai", text: "Hello! I am your Rovvy AI Assistant. How can I help you plan your next trip today?", timestamp: "Now" }
    ],
    jane: [
      { id: "1", sender: "other", text: "Hey! Did you check out the flight rates to Paris? They look pretty good today!", timestamp: "10:30 AM" }
    ],
    group: [
      { id: "1", sender: "other", text: "Guys, we need to finalize the hotel booking by tonight.", timestamp: "Yesterday" }
    ]
  });

  const [inputTexts, setInputTexts] = useState<Record<string, string>>({});

  useEffect(() => {
    const handleToggle = () => {
      setIsOpen(prev => !prev);
    };
    const handleOpenAi = () => {
      setIsOpen(true);
      if (!openChatBoxes.includes("ai")) {
        setOpenChatBoxes(prev => {
          if (prev.length >= 3) {
            return [...prev.slice(1), "ai"];
          }
          return [...prev, "ai"];
        });
      }
    };
    window.addEventListener("toggle-rovvy-lounge", handleToggle);
    window.addEventListener("open-ai-sidecar", handleOpenAi);
    return () => {
      window.removeEventListener("toggle-rovvy-lounge", handleToggle);
      window.removeEventListener("open-ai-sidecar", handleOpenAi);
    };
  }, [openChatBoxes]);

  const threads: ChatThread[] = [
    { id: "ai", title: "Rovvy AI Companion", subtitle: "Ask travel planning questions", avatar: "R", isAi: true },
    { id: "jane", title: "Jane Doe (Buddy)", subtitle: "Active dm thread", avatar: "J" },
    { id: "group", title: "Summer Trip", subtitle: "Group discussion", avatar: "S" }
  ];

  const handleThreadClick = (threadId: string) => {
    if (!openChatBoxes.includes(threadId)) {
      // Limit to max 3 side-by-side chats to keep it neat
      if (openChatBoxes.length >= 3) {
        setOpenChatBoxes([...openChatBoxes.slice(1), threadId]);
      } else {
        setOpenChatBoxes([...openChatBoxes, threadId]);
      }
    }
  };

  const handleCloseChatBox = (threadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenChatBoxes(openChatBoxes.filter(id => id !== threadId));
  };

  const handleSend = async (threadId: string) => {
    const text = inputTexts[threadId]?.trim();
    if (!text) return;

    // Add user message
    const userMsg: Message = {
      id: Date.now().toString(),
      sender: "user",
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => ({
      ...prev,
      [threadId]: [...(prev[threadId] || []), userMsg]
    }));

    setInputTexts(prev => ({
      ...prev,
      [threadId]: ""
    }));

    // Trigger auto replies
    if (threadId === "ai") {
      // Simulate AI thinking and reply
      setTimeout(() => {
        const aiMsg: Message = {
          id: (Date.now() + 1).toString(),
          sender: "ai",
          text: getAiReply(text),
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages(prev => ({
          ...prev,
          ai: [...(prev.ai || []), aiMsg]
        }));
      }, 1000);
    } else {
      // Standard chat mock response
      setTimeout(() => {
        const replyMsg: Message = {
          id: (Date.now() + 1).toString(),
          sender: "other",
          text: "Awesome! Let me review that. Talk to you in a bit!",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages(prev => ({
          ...prev,
          [threadId]: [...(prev[threadId] || []), replyMsg]
        }));
      }, 1500);
    }
  };

  const getAiReply = (query: string): string => {
    const q = query.toLowerCase();
    if (q.includes("flight") || q.includes("ticket")) {
      return "✈️ I found cheap flights departing next Friday starting at just $340! Would you like me to book it or add it to your itinerary?";
    }
    if (q.includes("hotel") || q.includes("stay") || q.includes("resort")) {
      return "🏨 The Hyatt Regency Paris is currently offering a 15% discount for Rovvy travelers. Highly recommended! Shall I pin it on your map?";
    }
    if (q.includes("weather") || q.includes("rain") || q.includes("temp")) {
      return "☀️ It's expected to be beautifully warm and sunny (24°C) next week. Perfect weather for exploring outdoor cafes and routes!";
    }
    return "💡 That sounds like a wonderful plan! Rovvy can help organize all flights, hotel locations, and split budgets seamlessly. What's next on your mind?";
  };

  return (
    <div className="fixed bottom-0 right-[40px] z-[80] hidden md:flex items-end gap-3 pointer-events-none select-none">
      {/* 1. DOCKED CHAT WINDOWS (OPEN SIDE-BY-SIDE) */}
      {openChatBoxes.map(chatId => {
        const thread = threads.find(t => t.id === chatId);
        if (!thread) return null;
        const chatMsgs = messages[chatId] || [];
        const inputText = inputTexts[chatId] || "";

        return (
          <div
            key={chatId}
            className="w-[280px] h-[340px] bg-white rounded-t-xl shadow-2xl border border-stone-200 flex flex-col pointer-events-auto select-text overflow-hidden animate-slide-up"
          >
            {/* Header */}
            <div className="h-10 shrink-0 bg-slate-800 text-white px-3 flex items-center justify-between cursor-pointer rounded-t-xl"
                 onClick={(e) => handleCloseChatBox(chatId, e)}>
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="h-5 w-5 rounded-full bg-slate-700 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                  {thread.avatar}
                </div>
                <span className="text-xs font-bold truncate">{thread.title}</span>
              </div>
              <button
                type="button"
                onClick={(e) => handleCloseChatBox(chatId, e)}
                className="hover:bg-white/20 p-1 rounded transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            {/* Chat Body / Message History */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-stone-50 text-[12px] flex flex-col justify-end">
              <div className="overflow-y-auto space-y-2 max-h-full pr-1">
                {chatMsgs.map(m => {
                  const isUser = m.sender === "user";
                  const isAiMsg = m.sender === "ai";
                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
                    >
                      <div className="flex items-center gap-1 mb-0.5 text-[9px] text-stone-500 font-medium">
                        {isAiMsg && <Sparkles size={8} className="text-teal-600 animate-pulse" />}
                        <span>{isUser ? "You" : isAiMsg ? "Rovvy AI" : thread.title.split(" ")[0]}</span>
                        <span>·</span>
                        <span>{m.timestamp}</span>
                      </div>
                      <div
                        className={`px-3 py-1.5 rounded-2xl max-w-[85%] leading-relaxed break-words font-medium shadow-sm ${
                          isUser
                            ? "bg-teal-600 text-white rounded-tr-none"
                            : isAiMsg
                            ? "bg-teal-50 text-stone-800 border border-teal-100 rounded-tl-none"
                            : "bg-white text-stone-800 border border-stone-200 rounded-tl-none"
                        }`}
                      >
                        {m.text}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Input form */}
            <div className="p-2 border-t border-stone-100 bg-white flex items-center gap-1.5 shrink-0">
              <input
                type="text"
                placeholder="Type a message..."
                value={inputText}
                onChange={(e) => setInputTexts(prev => ({ ...prev, [chatId]: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSend(chatId);
                }}
                className="flex-1 text-xs border border-stone-200 px-2.5 py-1.5 rounded-full outline-none focus:border-teal-500 text-stone-800"
              />
              <button
                type="button"
                onClick={() => handleSend(chatId)}
                disabled={!inputText.trim()}
                className="bg-teal-600 text-white p-1.5 rounded-full hover:bg-teal-700 disabled:opacity-40 transition-opacity flex items-center justify-center shrink-0"
              >
                <Send size={12} />
              </button>
            </div>
          </div>
        );
      })}

      {/* 2. COLLAPSED MAIN DOCK PILL (LinkedIn messaging drawer style) */}
      <div
        className={`w-[280px] bg-slate-900 text-white shadow-2xl rounded-t-xl flex flex-col border border-slate-700/50 pointer-events-auto select-text overflow-hidden transition-all duration-300 ease-in-out ${
          isOpen ? "h-[380px]" : "h-11"
        }`}
      >
        {/* Main Title bar */}
        <div
          className="h-11 shrink-0 px-4 bg-slate-900 text-white flex items-center justify-between cursor-pointer border-b border-slate-800/80 hover:bg-slate-850"
          onClick={() => setIsOpen(!isOpen)}
        >
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
              <span>Rovvy Lounge</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            {isOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </div>
        </div>

        {/* Expanded thread list */}
        {isOpen && (
          <div className="flex-1 overflow-y-auto bg-white p-2 divide-y divide-stone-100">
            {threads.map(t => (
              <div
                key={t.id}
                onClick={() => handleThreadClick(t.id)}
                className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
              >
                <div className="h-8 w-8 rounded-full bg-[#0F766E] text-white flex items-center justify-center text-xs font-bold shadow-sm shrink-0">
                  {t.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-stone-850 truncate">{t.title}</p>
                    {t.isAi && (
                      <span className="text-[8px] bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-wide border border-teal-100">
                        AI
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-stone-500 truncate mt-0.5 font-medium">{t.subtitle}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
