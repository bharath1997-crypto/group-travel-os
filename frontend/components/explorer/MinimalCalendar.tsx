"use client";

import { useState, useRef, useEffect } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from "lucide-react";

type MinimalCalendarProps = {
  selectedDate: string | null; // Format: "YYYY-MM-DD"
  onChange: (date: string | null) => void;
};

export function MinimalCalendar({
  selectedDate,
  onChange,
}: MinimalCalendarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Parse today and current month view
  const today = new Date();
  const [currentViewDate, setCurrentViewDate] = useState(new Date());

  // Re-sync current view month to selected date when opened
  useEffect(() => {
    if (isOpen && selectedDate) {
      const parsed = new Date(selectedDate + "T00:00:00");
      if (!isNaN(parsed.getTime())) {
        setCurrentViewDate(parsed);
      }
    }
  }, [isOpen, selectedDate]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentViewDate(
      new Date(currentViewDate.getFullYear(), currentViewDate.getMonth() - 1, 1)
    );
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentViewDate(
      new Date(currentViewDate.getFullYear(), currentViewDate.getMonth() + 1, 1)
    );
  };

  // Helper to generate days for the calendar grid
  const getDaysInMonth = () => {
    const year = currentViewDate.getFullYear();
    const month = currentViewDate.getMonth();

    // First day of month and last day of month
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const days = [];
    
    // Fill empty cells before the first day (offset for Sunday start)
    const startOffset = firstDay.getDay();
    for (let i = startOffset - 1; i >= 0; i--) {
      const prevDate = new Date(year, month, -i);
      days.push({ date: prevDate, isCurrentMonth: false });
    }

    // Fill days of the current month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true });
    }

    // Fill empty cells at the end to make it a full week grid
    const totalCells = Math.ceil(days.length / 7) * 7;
    const remaining = totalCells - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    }

    return days;
  };

  const days = getDaysInMonth();
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const handleDateSelect = (date: Date) => {
    const formatted = date.toISOString().split("T")[0];
    onChange(formatted);
    setIsOpen(false);
  };

  const handleReset = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
    setIsOpen(false);
  };

  // Format label for button
  const getButtonLabel = () => {
    if (!selectedDate) return "Any Date";
    const dateObj = new Date(selectedDate + "T00:00:00");
    if (isNaN(dateObj.getTime())) return "Any Date";
    return dateObj.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex w-full items-center justify-between gap-2 rounded-xl border px-4 py-2.5 text-sm shadow-sm transition hover:border-teal-400 sm:w-auto ${
          selectedDate
            ? "border-teal-500 bg-teal-50/50 text-teal-900 font-semibold"
            : "border-slate-200 bg-white text-slate-700"
        }`}
      >
        <div className="flex items-center gap-1.5">
          <CalendarIcon
            size={15}
            className={selectedDate ? "text-teal-600" : "text-slate-400"}
          />
          <span>{getButtonLabel()}</span>
        </div>
        {selectedDate ? (
          <div
            onClick={handleReset}
            className="rounded-full p-0.5 hover:bg-teal-100"
          >
            <X size={12} className="text-teal-600" />
          </div>
        ) : (
          <ChevronRight size={14} className="rotate-90 text-slate-400" />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
          {/* Header */}
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="rounded-lg p-1 hover:bg-slate-100 text-slate-500"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-xs font-bold text-slate-800">
              {monthNames[currentViewDate.getMonth()]} {currentViewDate.getFullYear()}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="rounded-lg p-1 hover:bg-slate-100 text-slate-500"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
              <span key={day} className="text-[10px] font-semibold text-slate-400">
                {day}
              </span>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((cell, idx) => {
              const formattedCell = cell.date.toISOString().split("T")[0];
              const isSelected = selectedDate === formattedCell;
              const isToday = today.toISOString().split("T")[0] === formattedCell;

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleDateSelect(cell.date)}
                  className={`flex h-7 w-7 items-center justify-center text-[11px] transition rounded-full ${
                    !cell.isCurrentMonth
                      ? "text-slate-300"
                      : isSelected
                      ? "bg-teal-600 font-bold text-white shadow-sm"
                      : isToday
                      ? "border border-teal-500 text-teal-600 font-semibold"
                      : "text-slate-600 hover:bg-slate-50 hover:text-teal-600"
                  }`}
                >
                  {cell.date.getDate()}
                </button>
              );
            })}
          </div>

          {/* Footer controls */}
          <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2">
            <button
              type="button"
              onClick={(e) => {
                const todayFormatted = today.toISOString().split("T")[0];
                onChange(todayFormatted);
                setIsOpen(false);
              }}
              className="text-[10px] font-bold text-teal-600 hover:text-teal-700"
            >
              Today
            </button>
            {selectedDate && (
              <button
                type="button"
                onClick={handleReset}
                className="text-[10px] font-bold text-slate-400 hover:text-slate-600"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
