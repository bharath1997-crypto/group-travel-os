"use client";

import { Megaphone } from "lucide-react";
import { LOUNGE_FULL } from "@/lib/lounge/theme";

const ANNOUNCEMENTS = [
  {
    date: "Today",
    title: "Rovvy Team",
    body: "New feature alert: AI Trip Planner is now live. Upload any document (screenshot, PDF, Word, or Excel) and our AI fills your entire trip plan automatically. Try it in Trips, Plan New Trip.",
    time: "2:10 AM",
  },
  {
    date: null,
    title: "Rovvy Team",
    body: "Live Coordination upgrade: meetup pins now show distance in real time. When you are within 100m of the meetup point, you will see a 'You have arrived!' celebration.",
    time: "Apr 21",
  },
  {
    date: "Apr 20",
    title: "Rovvy Team",
    body: "Buddy Trips launching soon. Solo traveler? Post a trip listing and find companions who match your vibe, budget, and destination. Coming in our next update.",
    time: "Apr 20",
  },
  {
    date: null,
    title: "Rovvy Team",
    body: "Split money in chat: you can now split expenses directly from the chat box. Tap the split action in any group chat to split a bill and post it as a message. All members see their share instantly.",
    time: "Apr 20",
  },
];

export function CommunityUpdatesPanel({ variant = "popup" }: { variant?: "full" | "popup" }) {
  const isFull = variant === "full";

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
          <span
            className="flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-bold text-white"
            style={{ background: "#2563EB" }}
          >
            CU
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-medium text-white">Community Updates</p>
            <p className="text-[12px]" style={{ color: LOUNGE_FULL.textMuted }}>
              Official channel · read only
            </p>
          </div>
          <Megaphone className="h-5 w-5 shrink-0 text-[#9ca3af]" strokeWidth={1.5} aria-hidden />
        </header>
      ) : null}

      <div className={`min-h-0 flex-1 overflow-y-auto ${isFull ? "custom-scrollbar px-4 py-3" : "p-3"}`}>
        {ANNOUNCEMENTS.map((a, i) => (
          <div key={i}>
            {a.date ? (
              <div className="my-2 flex justify-center">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${isFull ? "" : "bg-stone-200 text-stone-600"}`}
                  style={isFull ? { background: LOUNGE_FULL.surface, color: LOUNGE_FULL.textMuted } : undefined}
                >
                  {a.date}
                </span>
              </div>
            ) : null}
            <div
              className={`mb-3 max-w-[95%] rounded-2xl px-3 py-2 ${isFull ? "" : "border border-stone-200 bg-white"}`}
              style={isFull ? { background: LOUNGE_FULL.surface } : undefined}
            >
              <p
                className={`text-[10px] font-bold ${isFull ? "" : "text-primary"}`}
                style={isFull ? { color: LOUNGE_FULL.accent } : undefined}
              >
                {a.title}
              </p>
              <p
                className={`mt-1 leading-relaxed ${isFull ? "text-[14px] text-white" : "text-xs text-slate-800"}`}
              >
                {a.body}
              </p>
              <p
                className="mt-1 text-[9px]"
                style={isFull ? { color: LOUNGE_FULL.textMuted } : undefined}
              >
                {a.time}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div
        className={`shrink-0 px-3 py-2 text-center text-[10px] ${isFull ? "text-[12px] leading-relaxed" : "text-stone-500 border-t border-stone-200 bg-white"}`}
        style={
          isFull
            ? {
                background: LOUNGE_FULL.surface,
                borderTop: `0.5px solid ${LOUNGE_FULL.msgBorder}`,
                color: LOUNGE_FULL.textMuted,
              }
            : undefined
        }
      >
        {!isFull ? <Megaphone className="mx-auto mb-1 h-3.5 w-3.5 text-stone-400" /> : null}
        {isFull
          ? "This is an official announcement channel. Only the Rovvy team can post here."
          : "Official announcement channel · read only"}
      </div>
    </div>
  );
}
