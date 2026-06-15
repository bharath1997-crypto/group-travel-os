"use client";

import { useState, useRef, useEffect } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  type DateQuickPreset,
  formatLocalDate,
  getTodayDate,
  getWeekendRange,
  getWeekRange,
  isDateInRange,
  resolveDatePreset,
} from "@/lib/explore-date-utils";

type MinimalCalendarProps = {
  selectedDate: string | null;
  quickPreset?: DateQuickPreset;
  onChange: (date: string | null, preset?: DateQuickPreset) => void;
  compact?: boolean;
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function MinimalCalendar({
  selectedDate,
  quickPreset = null,
  onChange,
  compact = false,
}: MinimalCalendarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentViewDate, setCurrentViewDate] = useState(new Date());
  const dropdownRef = useRef<HTMLDivElement>(null);
  const today = new Date();

  useEffect(() => {
    if (isOpen && selectedDate) {
      const parsed = new Date(`${selectedDate}T00:00:00`);
      if (!Number.isNaN(parsed.getTime())) setCurrentViewDate(parsed);
    }
  }, [isOpen, selectedDate]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getDaysInMonth = () => {
    const year = currentViewDate.getFullYear();
    const month = currentViewDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: { date: Date; isCurrentMonth: boolean }[] = [];
    const startOffset = firstDay.getDay();

    for (let i = startOffset - 1; i >= 0; i--) {
      days.push({ date: new Date(year, month, -i), isCurrentMonth: false });
    }
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true });
    }
    const totalCells = Math.ceil(days.length / 7) * 7;
    for (let i = 1; i <= totalCells - days.length; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    }
    return days;
  };

  const days = getDaysInMonth();
  const years = Array.from({ length: 11 }, (_, i) => today.getFullYear() - 1 + i);

  const effectivePreset: DateQuickPreset =
    quickPreset ?? (selectedDate ? resolveDatePreset(selectedDate) : null);

  const handleDateSelect = (date: Date) => {
    const formatted = formatLocalDate(date);
    const preset = resolveDatePreset(formatted);
    onChange(formatted, preset);
    setIsOpen(false);
  };

  const handleClear = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    onChange(null, null);
    setIsOpen(false);
  };

  const applyToday = () => {
    const d = getTodayDate();
    onChange(d, "today");
    setCurrentViewDate(new Date(`${d}T00:00:00`));
    setIsOpen(false);
  };

  const applyWeekend = () => {
    const { start } = getWeekendRange();
    onChange(start, "weekend");
    setCurrentViewDate(new Date(`${start}T00:00:00`));
    setIsOpen(false);
  };

  const applyWeek = () => {
    const { start } = getWeekRange();
    onChange(start, "week");
    setCurrentViewDate(new Date(`${start}T00:00:00`));
    setIsOpen(false);
  };

  const getButtonLabel = () => {
    if (effectivePreset === "today") return "Today";
    if (effectivePreset === "weekend") return "Weekend";
    if (effectivePreset === "week") return "This Week";
    if (!selectedDate) return "Any Date";
    const dateObj = new Date(`${selectedDate}T00:00:00`);
    if (Number.isNaN(dateObj.getTime())) return "Any Date";
    return dateObj.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const weekendRange = getWeekendRange();
  const weekRange = getWeekRange();
  const todayStr = getTodayDate();

  const quickLinkClass = (active: boolean) =>
    `rounded-full px-2.5 py-1 text-[10px] font-semibold transition ${
      active
        ? "bg-teal-600 text-white shadow-sm"
        : "bg-slate-100 text-slate-600 hover:bg-teal-50 hover:text-teal-700"
    }`;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex items-center justify-between gap-2 rounded-xl border shadow-sm transition hover:border-teal-400 ${
          compact
            ? "px-3 py-1.5 text-xs font-semibold"
            : "w-full px-4 py-2.5 text-sm sm:w-auto"
        } ${
          selectedDate || quickPreset
            ? "border-teal-500 bg-teal-50/50 font-semibold text-teal-900"
            : "border-slate-200 bg-white text-slate-700"
        }`}
      >
        <div className="flex items-center gap-1.5">
          <CalendarIcon
            size={compact ? 13 : 15}
            className={selectedDate || quickPreset ? "text-teal-600" : "text-slate-400"}
          />
          <span>{getButtonLabel()}</span>
        </div>
        {selectedDate || quickPreset ? (
          <div onClick={handleClear} className="rounded-full p-0.5 hover:bg-teal-100">
            <X size={12} className="text-teal-600" />
          </div>
        ) : (
          <ChevronRight size={14} className="rotate-90 text-slate-400" />
        )}
      </button>

      {isOpen && (
        <div
          className={`absolute right-0 top-full z-50 mt-1.5 rounded-xl border border-slate-200 bg-white shadow-xl ${
            compact ? "w-72 p-3" : "w-80 p-4"
          }`}
        >
          <div className="mb-3 flex flex-wrap gap-1.5">
            <button type="button" onClick={applyToday} className={quickLinkClass(effectivePreset === "today")}>
              Today
            </button>
            <button type="button" onClick={applyWeekend} className={quickLinkClass(effectivePreset === "weekend")}>
              Weekend
            </button>
            <button type="button" onClick={applyWeek} className={quickLinkClass(effectivePreset === "week")}>
              This Week
            </button>
          </div>

          <div className="mb-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setCurrentViewDate(
                  new Date(currentViewDate.getFullYear(), currentViewDate.getMonth() - 1, 1),
                )
              }
              className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
            >
              <ChevronLeft size={14} />
            </button>

            <select
              value={currentViewDate.getMonth()}
              onChange={(e) =>
                setCurrentViewDate(
                  new Date(currentViewDate.getFullYear(), Number(e.target.value), 1),
                )
              }
              className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none focus:border-teal-500"
            >
              {MONTH_NAMES.map((name, idx) => (
                <option key={name} value={idx}>
                  {name}
                </option>
              ))}
            </select>

            <select
              value={currentViewDate.getFullYear()}
              onChange={(e) =>
                setCurrentViewDate(
                  new Date(Number(e.target.value), currentViewDate.getMonth(), 1),
                )
              }
              className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none focus:border-teal-500"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() =>
                setCurrentViewDate(
                  new Date(currentViewDate.getFullYear(), currentViewDate.getMonth() + 1, 1),
                )
              }
              className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-1 text-center">
            {WEEKDAYS.map((day) => (
              <span key={day} className="text-[10px] font-semibold text-slate-400">
                {day}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {days.map((cell, idx) => {
              const formattedCell = formatLocalDate(cell.date);
              const isSelected = selectedDate === formattedCell;
              const isToday = todayStr === formattedCell;
              const inWeekend =
                effectivePreset === "weekend" &&
                isDateInRange(formattedCell, weekendRange.start, weekendRange.end);
              const inWeek =
                effectivePreset === "week" &&
                isDateInRange(formattedCell, weekRange.start, weekRange.end);

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleDateSelect(cell.date)}
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-[11px] transition ${
                    !cell.isCurrentMonth
                      ? "text-slate-300"
                      : isSelected
                        ? "bg-teal-600 font-bold text-white shadow-sm"
                        : inWeekend || inWeek
                          ? "bg-teal-100 font-semibold text-teal-800"
                          : isToday
                            ? "border border-teal-500 font-semibold text-teal-600"
                            : "text-slate-600 hover:bg-slate-50 hover:text-teal-600"
                  }`}
                >
                  {cell.date.getDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2">
            <button
              type="button"
              onClick={applyToday}
              className="text-[10px] font-bold text-teal-600 hover:text-teal-700"
            >
              Jump to Today
            </button>
            {(selectedDate || quickPreset) && (
              <button
                type="button"
                onClick={handleClear}
                className="text-[10px] font-bold text-slate-400 hover:text-slate-600"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
