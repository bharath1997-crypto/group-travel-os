"use client";

import React from "react";
import { Calendar, RotateCcw } from "lucide-react";

type DateFilterProps = {
  startDate: string;
  endDate: string;
  onDatesChange: (start: string, end: string) => void;
};

export function DateFilterBar({ startDate, endDate, onDatesChange }: DateFilterProps) {
  const handleReset = () => {
    onDatesChange("", "");
  };

  const handleQuickSelect = (type: "today" | "weekend" | "month") => {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    if (type === "today") {
      onDatesChange(todayStr, todayStr);
    } else if (type === "weekend") {
      const nextSat = new Date();
      nextSat.setDate(today.getDate() + (6 - today.getDay()));
      const nextSun = new Date(nextSat);
      nextSun.setDate(nextSat.getDate() + 1);
      onDatesChange(nextSat.toISOString().split("T")[0], nextSun.toISOString().split("T")[0]);
    } else if (type === "month") {
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      onDatesChange(todayStr, lastDay.toISOString().split("T")[0]);
    }
  };

  const pill = "shrink-0 rounded-full border px-3.5 py-2 text-xs font-semibold transition";
  const pillInactive = `${pill} border-[#1e4976] bg-[#0d1f33] text-gray-400 hover:border-[#E94560]/35 hover:text-gray-200`;

  return (
    <div className="mb-8 w-full overflow-hidden rounded-2xl border border-[#1e4976] bg-gradient-to-r from-[#0d1f33] to-[#071221] px-3 py-3 shadow-lg sm:px-4">
      <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 scrollbar-thin scrollbar-track-[#0B192E] scrollbar-thumb-[#1e4976] [-ms-overflow-style:none] [scrollbar-width:thin]">
        <span className="flex shrink-0 items-center gap-1.5 pr-1 text-[#E94560]">
          <Calendar className="h-4 w-4" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Dates</span>
        </span>

        <button type="button" onClick={() => handleQuickSelect("today")} className={pillInactive}>
          Today
        </button>
        <button type="button" onClick={() => handleQuickSelect("weekend")} className={pillInactive}>
          Weekend
        </button>
        <button type="button" onClick={() => handleQuickSelect("month")} className={pillInactive}>
          This month
        </button>

        <label className={`${pillInactive} flex cursor-pointer items-center gap-2`}>
          <span className="text-[10px] font-bold uppercase text-gray-500">From</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => onDatesChange(e.target.value, endDate)}
            className="border-0 bg-transparent text-xs text-white outline-none [color-scheme:dark]"
          />
        </label>
        <label className={`${pillInactive} flex cursor-pointer items-center gap-2`}>
          <span className="text-[10px] font-bold uppercase text-gray-500">To</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => onDatesChange(startDate, e.target.value)}
            className="border-0 bg-transparent text-xs text-white outline-none [color-scheme:dark]"
          />
        </label>

        {(startDate || endDate) && (
          <button
            type="button"
            onClick={handleReset}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-red-500/25 bg-red-500/10 text-red-300 transition hover:bg-red-500/20"
            title="Clear dates"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
