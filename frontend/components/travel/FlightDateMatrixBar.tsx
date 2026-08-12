"use client";

import { Calendar, ChevronLeft, ChevronRight, TrendingDown } from "lucide-react";
import type { DateMatrixItem } from "@/lib/flight-types";
import { formatPrice } from "@/lib/flight-format";

type Props = {
  items: DateMatrixItem[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
};

export default function FlightDateMatrixBar({ items, selectedDate, onSelectDate }: Props) {
  if (!items || items.length === 0) return null;

  const formatDateLabel = (isoStr: string): { day: string; monthDay: string } => {
    const d = new Date(isoStr + "T00:00:00");
    if (Number.isNaN(d.getTime())) {
      return { day: isoStr, monthDay: isoStr };
    }
    const day = d.toLocaleDateString("en-US", { weekday: "short" });
    const monthDay = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return { day, monthDay };
  };

  const cheapestItem = items.reduce<DateMatrixItem | null>((acc, curr) => {
    if (curr.price === null) return acc;
    if (!acc || acc.price === null || curr.price < acc.price) return curr;
    return acc;
  }, null);

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-900 uppercase tracking-wider">
          <Calendar className="h-4 w-4 text-teal-600" />
          <span>Flexible Departure Dates</span>
        </div>
        {cheapestItem && cheapestItem.price ? (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200/60">
            <TrendingDown className="h-3.5 w-3.5" />
            <span>Cheapest: {formatPrice(cheapestItem.currency, cheapestItem.price)} ({formatDateLabel(cheapestItem.date).monthDay})</span>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 gap-2 overflow-x-auto pb-1">
        {items.map((item) => {
          const { day, monthDay } = formatDateLabel(item.date);
          const isSelected = item.date === selectedDate;
          const isCheapest = cheapestItem && item.date === cheapestItem.date && item.price !== null;

          return (
            <button
              key={item.date}
              type="button"
              onClick={() => onSelectDate(item.date)}
              className={`flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all duration-150 ${
                isSelected
                  ? "border-teal-600 bg-teal-50/90 text-teal-950 ring-2 ring-teal-500/20 font-bold shadow-xs"
                  : isCheapest
                  ? "border-emerald-300 bg-emerald-50/50 hover:bg-emerald-100/60 text-slate-900"
                  : "border-slate-200/80 bg-white hover:bg-slate-50 text-slate-700"
              }`}
            >
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">{day}</span>
              <span className="text-xs font-bold text-slate-900 mt-0.5">{monthDay}</span>
              <span
                className={`text-[11px] font-extrabold mt-1 ${
                  isSelected
                    ? "text-teal-700"
                    : isCheapest
                    ? "text-emerald-700 font-black"
                    : item.price
                    ? "text-slate-600"
                    : "text-slate-400"
                }`}
              >
                {item.price ? formatPrice(item.currency, item.price) : "—"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
