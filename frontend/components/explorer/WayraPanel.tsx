"use client";

import { Send, X } from "lucide-react";
import { useRef, useState } from "react";

import WayraIcon from "@/components/ui/WayraIcon";
import { apiFetch } from "@/lib/api";

const TRAVEL_KEYWORDS = [
  "event",
  "events",
  "restaurant",
  "bar",
  "bars",
  "hotel",
  "food",
  "eat",
  "drink",
  "music",
  "concert",
  "show",
  "tour",
  "ticket",
  "book",
  "reserve",
  "weather",
  "chicago",
  "city",
  "place",
  "park",
  "museum",
  "club",
  "tonight",
  "weekend",
  "near",
  "recommend",
  "best",
  "jazz",
  "sports",
  "art",
  "beach",
  "flight",
  "trip",
  "stay",
  "visit",
  "explore",
  "activity",
  "fun",
  "nightlife",
];

const APP_KEYWORDS = [
  "how",
  "create",
  "trip",
  "expense",
  "split",
  "invite",
  "member",
  "group",
  "poll",
  "vote",
  "live",
  "map",
  "setting",
  "profile",
  "password",
  "login",
  "account",
  "notification",
  "timer",
  "share",
  "location",
];

function detectMode(message: string): "flying" | "perched" {
  const lower = message.toLowerCase();
  const travelScore = TRAVEL_KEYWORDS.filter((k) => lower.includes(k)).length;
  const appScore = APP_KEYWORDS.filter((k) => lower.includes(k)).length;
  return travelScore > appScore ? "flying" : "perched";
}

const TRAVEL_FALLBACK_RESPONSES = [
  "Ask me what kind of outing you want tonight and I’ll narrow venues, timings, and a Plan B.",
  "I’ll line up nearby food, jazz, outdoors, or family-friendly picks once you choose a vibe or budget.",
  "Try naming a mood (food, nightlife, museums) plus your area — I’ll suggest a simple itinerary.",
];

const APP_GUIDE_RESPONSES: { keys: string[]; text: string }[] = [
  {
    keys: ["invite", "member"],
    text: "Invite people from Connect: open your group, share the invite link, and confirm seats before splitting costs.",
  },
  {
    keys: ["split", "expense"],
    text: "For expenses open Split Activities → add amounts, assign who paid, split evenly or custom weights.",
  },
  {
    keys: ["poll", "vote"],
    text: "Create a poll in your trip drawer so everyone can vote dates and venues before bookings.",
  },
  {
    keys: ["trip", "create"],
    text: "Start in Trips → New Trip, add destinations and dates; then wire budget and participants from there.",
  },
  {
    keys: ["map", "location", "live"],
    text: "Use Map/Live tabs to coordinate meetups safely; pins update as people share arrivals.",
  },
  {
    keys: ["notification", "account", "setting", "password", "profile", "login"],
    text: "Profile and security live under Settings: update contact info there and keep Travello synced.",
  },
];

function appGuideReply(userMessage: string): string {
  const low = userMessage.toLowerCase();
  for (const row of APP_GUIDE_RESPONSES) {
    if (row.keys.some((k) => low.includes(k))) return row.text;
  }
  return (
    "I can walk you through trips, groups, splits, polls, Live/Map, timers, invites, and Settings. " +
    "What do you want to do in the app? Or ask about events and places for travel help."
  );
}

type ChatRow =
  | { id: string; role: "user" | "assistant"; text: string }
  | { id: string; role: "system"; text: string };

export type WayraPanelProps = {
  open: boolean;
  city: string;
  onClose: () => void;
  onOpen: () => void;
};

const QUICK_CHIPS = [
  "What's fun tonight?",
  "Free events near me",
  "Plan a weekend trip",
  "Best food tours?",
];

export function WayraPanel({ open, city, onClose, onOpen }: WayraPanelProps) {
  const [birdState, setBirdState] = useState<"flying" | "perched">("perched");
  const prevModeRef = useRef<"flying" | "perched">("perched");

  const [messages, setMessages] = useState<ChatRow[]>([
    {
      id: "hello",
      role: "assistant",
      text: `Hi, I’m Wayra. Ask me what to do in ${city}.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [fallbackIndex, setFallbackIndex] = useState(0);

  const send = async (raw: string) => {
    const message = raw.trim();
    if (!message || busy) return;

    const mode = detectMode(message);
    const prev = prevModeRef.current;
    const modeChanged = mode !== prev;
    if (modeChanged) {
      prevModeRef.current = mode;
    }
    setBirdState(mode);

    const userRow: ChatRow = { id: `u-${Date.now()}`, role: "user", text: message };
    const systemRow: ChatRow | null = modeChanged
      ? {
          id: `sys-${Date.now()}`,
          role: "system",
          text: mode === "flying" ? "✦ switched to travel mode" : "✦ switched to app guide",
        }
      : null;

    setInput("");
    setBusy(true);
    setMessages((prevMsgs) =>
      [...prevMsgs, userRow, ...(systemRow ? [systemRow] : [])],
    );

    if (mode === "flying") {
      try {
        const res = await apiFetch<{ response?: string; reply?: string; message?: string }>(
          "/wayra/chat",
          {
            method: "POST",
            body: JSON.stringify({
              message,
              city,
              trip_context: "",
            }),
          },
        );
        const reply =
          res.response ??
          res.reply ??
          res.message ??
          TRAVEL_FALLBACK_RESPONSES[fallbackIndex % TRAVEL_FALLBACK_RESPONSES.length]!;
        setFallbackIndex((i) => i + 1);
        setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: "assistant", text: reply }]);
      } catch {
        const reply =
          TRAVEL_FALLBACK_RESPONSES[fallbackIndex % TRAVEL_FALLBACK_RESPONSES.length]!;
        setFallbackIndex((i) => i + 1);
        setMessages((prev) => [...prev, { id: `d-${Date.now()}`, role: "assistant", text: reply }]);
      } finally {
        setBusy(false);
      }
      return;
    }

    window.setTimeout(() => {
      const reply = appGuideReply(message);
      setMessages((prev) => [...prev, { id: `g-${Date.now()}`, role: "assistant", text: reply }]);
      setBusy(false);
    }, 240);
  };

  const headerStatus =
    birdState === "flying"
      ? busy
        ? "AI Travel Guide · thinking..."
        : "AI Travel Guide"
      : "App Guide · offline";

  return (
    <>
      <aside
        className={[
          "fixed bottom-0 right-0 top-0 z-[70] w-full max-w-[320px] border-l border-[#E9ECEF] bg-white shadow-xl transition-transform duration-200",
          open ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
        aria-hidden={!open}
      >
        <div className="flex h-full flex-col">
          <header className="flex items-center gap-3 border-b border-[#E9ECEF] p-4">
            <div className="flex shrink-0 items-center justify-center">
              <WayraIcon
                state={birdState}
                size={0.42}
                variant={birdState === "flying" ? "fog" : "navy"}
                animate={true}
              />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-[#2C3E50]">Wayra</h2>
              <p
                className={
                  birdState === "flying"
                    ? "text-[10px] text-[#E94560]"
                    : "text-[10px] text-[#0F3460]"
                }
              >
                {headerStatus}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-[#E9ECEF] p-1.5 text-[#6C757D] hover:border-[#E94560] hover:text-[#E94560]"
              aria-label="Close Wayra"
            >
              <X size={16} />
            </button>
          </header>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-[#F8F9FA] p-4">
            {messages.map((row) => {
              if (row.role === "system") {
                return (
                  <p
                    key={row.id}
                    className="py-1 text-center text-[10px] text-[#6C757D]"
                  >
                    {row.text}
                  </p>
                );
              }
              return (
                <div
                  key={row.id}
                  className={[
                    "rounded-2xl border px-3 py-2 text-sm leading-5",
                    row.role === "user"
                      ? "ml-8 border-[#E94560] bg-[#E94560] text-white"
                      : "mr-8 border-[#E9ECEF] bg-white text-[#2C3E50]",
                  ].join(" ")}
                >
                  {row.text}
                </div>
              );
            })}
          </div>

          <div className="border-t border-[#E9ECEF] bg-white p-3">
            <div className="mb-3 flex gap-2 overflow-x-auto">
              {QUICK_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => void send(chip)}
                  className="shrink-0 rounded-full border border-[#E9ECEF] bg-white px-3 py-1.5 text-xs font-medium text-[#6C757D] hover:border-[#E94560] hover:text-[#E94560]"
                >
                  {chip}
                </button>
              ))}
            </div>
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void send(input);
              }}
            >
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Ask Wayra..."
                className="min-w-0 flex-1 rounded-full border border-[#E9ECEF] bg-[#F8F9FA] px-3 py-2 text-sm text-[#2C3E50] outline-none placeholder:text-[#6C757D] focus:border-[#E94560]"
              />
              <button
                type="submit"
                disabled={busy}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E94560] text-white disabled:opacity-60"
                aria-label="Send"
              >
                <Send size={16} />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {!open ? (
        <button
          type="button"
          onClick={() => onOpen()}
          aria-label="Open Wayra"
          style={{
            position: "fixed",
            bottom: "20px",
            right: "20px",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: 0,
            zIndex: 40,
          }}
        >
          <WayraIcon state={birdState} size={1} variant="fog" animate={true} />
        </button>
      ) : null}
    </>
  );
}
