"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Send,
  Loader2,
  Brain,
  MapPin,
  ShoppingCart,
  DollarSign,
  Info,
  RefreshCw,
  User,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

type TripContext = {
  id: string;
  title: string;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
};

type CartContext = {
  id: string;
  item_name: string;
  item_type: string;
  price: number | null;
};

type MemoryContext = {
  id: string;
  memory_type: string;
  content: string;
  created_at: string;
};

type ExpenseContext = {
  id: string;
  description: string;
  amount: number;
  currency: string;
};

type WayraContext = {
  full_name: string | null;
  trips: TripContext[];
  cart: CartContext[];
  memory: MemoryContext[];
  expenses: ExpenseContext[];
};

type Message = {
  id: string;
  sender: "user" | "wayra";
  text: string;
  timestamp: Date;
};

export default function WayraPersonalPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      sender: "wayra",
      text: "Hello! I am Wayra, your personal travel intelligence assistant. I can help you plan trips, organize your budget, view flights/hotels, and scan travel deals. How can I assist you today?",
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState<WayraContext | null>(null);
  const [refreshingContext, setRefreshingContext] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchContext();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const fetchContext = async () => {
    setRefreshingContext(true);
    try {
      const data = await apiFetch<WayraContext>("/wayra/context");
      setContext(data);
    } catch (err) {
      console.error("Failed to load Wayra context", err);
    } finally {
      setRefreshingContext(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text || loading) return;

    setInputText("");
    const userMsg: Message = {
      id: Math.random().toString(),
      sender: "user",
      text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await apiFetch<{ response: string }>("/wayra/chat", {
        method: "POST",
        body: JSON.stringify({ message: text }),
      });

      const wayraMsg: Message = {
        id: Math.random().toString(),
        sender: "wayra",
        text: res.response || "I couldn't process that. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, wayraMsg]);
    } catch (err: any) {
      const errMsg = err.message || "Something went wrong. Please check your rate limit or try again.";
      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          sender: "wayra",
          text: `⚠️ Error: ${errMsg}`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full bg-[#F8FAFC] py-6 px-4 md:px-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-[#0F766E] flex items-center justify-center text-white shadow-md shadow-teal-700/20">
              <Brain className="h-6 w-6 animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-850 flex items-center gap-2">
                Personal Wayra
                <span className="text-[10px] uppercase bg-teal-50 text-[#0F766E] px-2 py-0.5 rounded-full font-bold border border-teal-100">
                  AI Companion
                </span>
              </h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Your private sandbox. Wayra accesses only your private data and group activity context.
              </p>
            </div>
          </div>
          <button
            onClick={fetchContext}
            disabled={refreshingContext}
            className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-xl border border-slate-200/60 transition-all active:scale-95 disabled:opacity-50 self-start md:self-auto"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshingContext ? "animate-spin" : ""}`} />
            Sync Memory Context
          </button>
        </div>

        {/* Workspace Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          {/* Left Panel: Chat Terminal (2 columns wide) */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col h-[650px] overflow-hidden">
            {/* Top Bar */}
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#0F766E]"></span>
                </span>
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Secure Sandbox Chat
                </span>
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">
                Privacy Guaranteed
              </span>
            </div>

            {/* Conversation Stream */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/30">
              {messages.map((m) => {
                const isUser = m.sender === "user";
                return (
                  <div key={m.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                    <div className={`flex gap-3 max-w-[85%] ${isUser ? "flex-row-reverse" : "flex-row"}`}>
                      {/* Avatar */}
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 shadow-sm ${
                        isUser ? "bg-slate-100 text-slate-600" : "bg-[#0F766E] text-white"
                      }`}>
                        {isUser ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                      </div>

                      {/* Bubble */}
                      <div className="space-y-1">
                        <div className={`px-4 py-2.5 rounded-2xl text-[13px] leading-relaxed shadow-sm font-medium ${
                          isUser
                            ? "bg-[#0F766E] text-white rounded-tr-none"
                            : "bg-white text-slate-800 border border-slate-100 rounded-tl-none"
                        }`}>
                          {m.text}
                        </div>
                        <p className={`text-[9px] text-slate-400 font-semibold px-1 ${isUser ? "text-right" : "text-left"}`}>
                          {m.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}

              {loading && (
                <div className="flex justify-start">
                  <div className="flex gap-3 max-w-[80%]">
                    <div className="h-8 w-8 rounded-full bg-[#0F766E] text-white flex items-center justify-center shadow-sm">
                      <Sparkles className="h-4 w-4 animate-spin" />
                    </div>
                    <div className="bg-white border border-slate-100 px-4 py-2.5 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-[#0F766E]" />
                      <span className="text-[13px] font-semibold text-slate-500">Wayra is thinking...</span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
            <form onSubmit={handleSend} className="p-4 border-t border-slate-100 bg-white flex items-center gap-2 shrink-0">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Ask Wayra anything..."
                className="flex-1 text-[13px] border border-slate-200 hover:border-slate-300 focus:border-[#0F766E] px-4 py-3 rounded-xl outline-none transition-all font-medium text-slate-800"
              />
              <button
                type="submit"
                disabled={!inputText.trim() || loading}
                className="bg-[#0F766E] text-white p-3 rounded-xl hover:bg-teal-700 disabled:opacity-40 transition-all flex items-center justify-center shrink-0 active:scale-95 shadow-md shadow-teal-700/10"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>

          {/* Right Panel: Context / Memory Panel */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col h-[650px] overflow-hidden">
            <h2 className="text-sm font-bold text-slate-850 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Brain className="h-4 w-4 text-[#0F766E]" />
              Wayra Memory Context
            </h2>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {/* Trips Context */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-rose-500" />
                  Trips ({context?.trips.length || 0})
                </h3>
                {context?.trips && context.trips.length > 0 ? (
                  <div className="space-y-1.5">
                    {context.trips.map((trip) => (
                      <div key={trip.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-[11px] font-semibold text-slate-700">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold text-slate-800">{trip.title}</span>
                          <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-100 px-1.5 py-0.2 rounded uppercase font-bold">
                            {trip.status}
                          </span>
                        </div>
                        <p className="text-slate-500 text-[10px]">Destination: {trip.destination || "Not specified"}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] font-semibold text-slate-400 pl-5">No active trips detected.</p>
                )}
              </div>

              {/* Cart Context */}
              <div className="space-y-2 border-t border-slate-50 pt-3">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                  <ShoppingCart className="h-3.5 w-3.5 text-[#0F766E]" />
                  Travel Cart ({context?.cart.length || 0})
                </h3>
                {context?.cart && context.cart.length > 0 ? (
                  <div className="space-y-1.5">
                    {context.cart.map((item) => (
                      <div key={item.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-[11px] font-semibold text-slate-700">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-slate-800">{item.item_name}</span>
                          <span className="text-[9px] bg-teal-50 text-[#0F766E] border border-teal-100 px-1.5 py-0.2 rounded uppercase font-bold">
                            {item.item_type}
                          </span>
                        </div>
                        {item.price !== null && <p className="text-slate-500 text-[10px] mt-0.5">Price: ${item.price}</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] font-semibold text-slate-400 pl-5">No items in your travel cart.</p>
                )}
              </div>

              {/* Expenses Context */}
              <div className="space-y-2 border-t border-slate-50 pt-3">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5 text-amber-500" />
                  Expenses ({context?.expenses.length || 0})
                </h3>
                {context?.expenses && context.expenses.length > 0 ? (
                  <div className="space-y-1.5">
                    {context.expenses.map((exp) => (
                      <div key={exp.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-[11px] font-semibold text-slate-700 flex justify-between items-center">
                        <div>
                          <p className="font-bold text-slate-800">{exp.description}</p>
                        </div>
                        <span className="font-bold text-[#0F766E]">
                          {exp.amount} {exp.currency}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] font-semibold text-slate-400 pl-5">No logged expenses detected.</p>
                )}
              </div>

              {/* Stored Memories */}
              <div className="space-y-2 border-t border-slate-50 pt-3">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5 text-blue-500" />
                  Learned Memories ({context?.memory.length || 0})
                </h3>
                {context?.memory && context.memory.length > 0 ? (
                  <div className="space-y-1.5">
                    {context.memory.map((mem) => (
                      <div key={mem.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-[11px] font-semibold text-slate-700">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[9px] uppercase font-bold text-blue-600 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-100">
                            {mem.memory_type}
                          </span>
                          <span className="text-[8px] text-slate-400 font-medium">
                            {new Date(mem.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-slate-800 leading-relaxed font-medium">{mem.content}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] font-semibold text-slate-400 pl-5">No explicit preferences learned yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
