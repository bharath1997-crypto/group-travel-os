"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";
import { formatLocalDate } from "@/lib/explore-date-utils";
import {
  formatUsDateTyping,
  isoToUsDisplay,
  isIsoOnOrAfterMin,
  parseUsDateInput,
  previewIsoFromParsed,
  viewDateFromParsed,
} from "@/lib/flight-date-input";

type Props = {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  placeholder?: string;
  triggerClassName?: string;
  allowClear?: boolean;
  id?: string;
  menuPlacement?: "above" | "below";
};

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const defaultWrapperClass =
  "flex h-11 w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 focus-within:border-teal-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-teal-500/20";

function buildMonthGrid(viewDate: Date) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
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
}

export default function FlightDateField({
  value,
  onChange,
  min,
  placeholder = "mm/dd/yyyy",
  triggerClassName,
  allowClear = false,
  id,
  menuPlacement = "below",
}: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => (value ? isoToUsDisplay(value) : ""));
  const [viewDate, setViewDate] = useState(() => {
    if (value) {
      const parsed = new Date(`${value}T12:00:00`);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    return new Date();
  });
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const today = formatLocalDate(new Date());

  const parsed = parseUsDateInput(draft);
  const highlightIso = value || previewIsoFromParsed(parsed) || "";

  const commitDraft = () => {
    if (!draft.trim()) {
      if (allowClear) onChange("");
      return;
    }
    const next = parseUsDateInput(draft);
    if (next.isComplete && next.iso && isIsoOnOrAfterMin(next.iso, min)) {
      onChange(next.iso);
      setDraft(isoToUsDisplay(next.iso));
    } else if (value) {
      setDraft(isoToUsDisplay(value));
    } else {
      setDraft("");
    }
  };

  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setDraft(value ? isoToUsDisplay(value) : "");
    }
  }, [value]);

  useEffect(() => {
    if (!open) return;
    if (value) {
      const parsedValue = new Date(`${value}T12:00:00`);
      if (!Number.isNaN(parsedValue.getTime())) {
        setViewDate(parsedValue);
        return;
      }
    }
    setViewDate(viewDateFromParsed(parsed));
  }, [open, value, parsed.month, parsed.day, parsed.year, parsed.iso]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        commitDraft();
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [draft, value, min, allowClear, onChange]);

  const days = buildMonthGrid(viewDate);
  const years = Array.from({ length: 3 }, (_, i) => new Date().getFullYear() + i);

  const applyDraft = (nextDraft: string) => {
    const formatted = formatUsDateTyping(nextDraft);
    setDraft(formatted);
    setOpen(true);

    const nextParsed = parseUsDateInput(formatted);
    setViewDate(viewDateFromParsed(nextParsed));

    if (nextParsed.isComplete && nextParsed.iso && isIsoOnOrAfterMin(nextParsed.iso, min)) {
      onChange(nextParsed.iso);
    }
  };

  const selectDate = (date: Date) => {
    const formatted = formatLocalDate(date);
    if (min && formatted < min) return;
    onChange(formatted);
    setDraft(isoToUsDisplay(formatted));
    setViewDate(date);
    setOpen(false);
    inputRef.current?.blur();
  };

  const clearDate = () => {
    onChange("");
    setDraft("");
    setOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div ref={ref} className="relative">
      <div
        className={
          triggerClassName
            ? `flex items-center gap-2 focus-within:border-teal-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-teal-500/20 ${triggerClassName}`
            : defaultWrapperClass
        }
      >
        <Calendar className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder={placeholder}
          value={draft}
          onChange={(e) => applyDraft(e.target.value)}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitDraft();
              setOpen(false);
            }
            if (e.key === "Escape") {
              setDraft(value ? isoToUsDisplay(value) : "");
              setOpen(false);
              inputRef.current?.blur();
            }
          }}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label="Flight date"
          className="min-w-0 flex-1 bg-transparent text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none"
        />
        {allowClear && value ? (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={clearDate}
            className="rounded-full p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Clear date"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {open ? (
        <div
          role="dialog"
          aria-label="Choose date"
          className={`absolute left-0 z-30 w-72 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl sm:w-80 ${
            menuPlacement === "above" ? "bottom-full mb-2" : "top-full mt-2"
          }`}
        >
          <div className="mb-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}
              className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <select
              value={viewDate.getMonth()}
              onChange={(e) =>
                setViewDate(new Date(viewDate.getFullYear(), Number(e.target.value), 1))
              }
              className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none focus:border-teal-500"
              aria-label="Month"
            >
              {MONTH_NAMES.map((name, idx) => (
                <option key={name} value={idx}>
                  {name}
                </option>
              ))}
            </select>

            <select
              value={viewDate.getFullYear()}
              onChange={(e) =>
                setViewDate(new Date(Number(e.target.value), viewDate.getMonth(), 1))
              }
              className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none focus:border-teal-500"
              aria-label="Year"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}
              className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
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
              const isSelected = highlightIso === formattedCell;
              const isToday = today === formattedCell;
              const isDisabled = Boolean(min && formattedCell < min);

              return (
                <button
                  key={idx}
                  type="button"
                  disabled={isDisabled}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectDate(cell.date)}
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-[11px] transition ${
                    isDisabled
                      ? "cursor-not-allowed text-slate-300"
                      : !cell.isCurrentMonth
                        ? "text-slate-300 hover:bg-slate-50"
                        : isSelected
                          ? "bg-teal-600 font-bold text-white shadow-sm"
                          : isToday
                            ? "border border-teal-500 font-semibold text-teal-600 hover:bg-teal-50"
                            : "text-slate-600 hover:bg-slate-50 hover:text-teal-600"
                  }`}
                >
                  {cell.date.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
