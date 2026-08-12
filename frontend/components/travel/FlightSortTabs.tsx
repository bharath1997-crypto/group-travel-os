"use client";

import { Zap, DollarSign, Clock, Sunrise } from "lucide-react";
import type { FlightSortMode } from "@/lib/flight-types";

const MODES: { id: FlightSortMode; label: string; subtext: string; icon: React.ElementType }[] = [
  { id: "best", label: "Rovvy Recommended", subtext: "Balanced value", icon: Zap },
  { id: "cheapest", label: "Cheapest", subtext: "Lowest fare", icon: DollarSign },
  { id: "fastest", label: "Fastest", subtext: "Shortest duration", icon: Clock },
  { id: "earliest", label: "Earliest", subtext: "First departure", icon: Sunrise },
];

type Props = {
  value: FlightSortMode;
  onChange: (mode: FlightSortMode) => void;
  cheapestPrice?: string | null;
  fastestDuration?: string | null;
};

export default function FlightSortTabs({ value, onChange, cheapestPrice, fastestDuration }: Props) {
  return (
    <div className="w-full">
      <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1 md:grid-cols-4">
        {MODES.map((mode) => {
          const Icon = mode.icon;
          const active = value === mode.id;

          let badgeText = mode.subtext;
          if (mode.id === "cheapest" && cheapestPrice) {
            badgeText = cheapestPrice;
          } else if (mode.id === "fastest" && fastestDuration) {
            badgeText = fastestDuration;
          }

          return (
            <button
              key={mode.id}
              type="button"
              onClick={() => onChange(mode.id)}
              className={`flex min-h-11 flex-col items-center justify-center rounded-lg px-3 py-2 transition ${
                active
                  ? "border border-teal-600 bg-white font-bold text-slate-900"
                  : "border border-transparent text-slate-600 hover:bg-white/70 hover:text-slate-900"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Icon className={`h-4 w-4 ${active ? "text-teal-600" : "text-slate-400"}`} />
                <span className="text-xs">{mode.label}</span>
              </div>
              <span className={`text-[10px] mt-0.5 ${active ? "text-teal-700 font-semibold" : "text-slate-400"}`}>
                {badgeText}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
