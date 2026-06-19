"use client";

import { Sparkles, ArrowRight } from "lucide-react";

const PROMPT_CHIPS = [
  "Plan a fun Saturday in Chicago",
  "Find cheap group activities nearby",
  "What should we do tonight?",
  "Create a 1-day itinerary",
];

type WayraDiscoveryCardProps = {
  onAskWayra?: (prompt?: string) => void;
};

export function WayraDiscoveryCard({ onAskWayra }: WayraDiscoveryCardProps) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0F766E] via-teal-600 to-emerald-600 p-8 md:p-10">
      {/* Decorative background circles */}
      <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/10 blur-2xl pointer-events-none" />
      <div className="absolute -bottom-16 -left-8 w-56 h-56 rounded-full bg-teal-400/20 blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col md:flex-row gap-8 md:items-center">
        {/* Left: Text + CTA */}
        <div className="flex-1 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
              <Sparkles size={20} className="text-white" />
            </div>
            <span className="text-white/80 text-sm font-bold uppercase tracking-widest">
              Wayra AI
            </span>
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-white leading-tight">
            Ask Wayra what to do next
          </h2>
          <p className="text-teal-100 text-sm leading-relaxed max-w-md">
            Your AI travel companion that plans personalized group adventures, finds hidden gems, and builds full itineraries in seconds.
          </p>
          <button
            onClick={() => onAskWayra?.()}
            className="inline-flex items-center gap-2 bg-white text-[#0F766E] font-bold px-7 py-3.5 rounded-xl hover:bg-teal-50 transition-colors shadow-lg text-sm"
          >
            <Sparkles size={16} />
            Ask Wayra
            <ArrowRight size={15} />
          </button>
        </div>

        {/* Right: Prompt chips */}
        <div className="md:w-72 grid grid-cols-1 gap-2.5">
          {PROMPT_CHIPS.map((prompt) => (
            <button
              key={prompt}
              onClick={() => onAskWayra?.(prompt)}
              className="group text-left bg-white/15 hover:bg-white/25 backdrop-blur-sm border border-white/20 hover:border-white/40 rounded-xl px-4 py-3 text-white text-sm font-medium transition-all duration-200 flex items-center justify-between gap-2"
            >
              <span className="line-clamp-1">{prompt}</span>
              <ArrowRight size={13} className="shrink-0 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
