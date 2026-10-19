"use client";

import { useEffect, useMemo, useRef } from "react";

import {
  EXPLORE_CALENDAR_WEEKDAYS,
  buildCalendarMonthGrid,
  calendarCellSelectable,
  calendarMonthLabel,
  canShiftCalendarMonth,
  shiftCalendarMonth,
  totalCalendarMonthEvents,
  type ExploreCalendarMonth,
} from "../explore-hub-calendar-month";

import styles from "../explore.module.css";

type ExploreHubDateCalendarProps = {
  month: ExploreCalendarMonth;
  onMonthChange: (next: ExploreCalendarMonth) => void;
  /** YYYY-MM-DD → dated events that day in the active location. */
  countsByIso: Record<string, number>;
  /** Window the counts cover (null while loading). */
  loadedRange: { dateFrom: string; dateTo: string } | null;
  loading: boolean;
  selectedDayIso: string | null;
  onSelectDay: (iso: string) => void;
  onClearDay: () => void;
  onClose: () => void;
};

function NavButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      className={styles.dateCalNav}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/** Month grid under the When chips: big black date, small dark-green event count, month + year nav. */
export function ExploreHubDateCalendar({
  month,
  onMonthChange,
  countsByIso,
  loadedRange,
  loading,
  selectedDayIso,
  onSelectDay,
  onClearDay,
  onClose,
}: ExploreHubDateCalendarProps) {
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const cells = useMemo(
    () => buildCalendarMonthGrid(month, countsByIso, loadedRange),
    [month, countsByIso, loadedRange],
  );
  const monthTotal = totalCalendarMonthEvents(cells);

  const canPrevMonth = canShiftCalendarMonth(month, -1);
  const canPrevYear = canShiftCalendarMonth(month, -12);

  return (
    <section ref={rootRef} className={styles.dateCal} aria-label="Select the date">
      <header className={styles.dateCalHead}>
        <div className={styles.dateCalNavGroup}>
          <NavButton label="Previous year" disabled={!canPrevYear} onClick={() => onMonthChange(shiftCalendarMonth(month, -12))}>
            «
          </NavButton>
          <NavButton label="Previous month" disabled={!canPrevMonth} onClick={() => onMonthChange(shiftCalendarMonth(month, -1))}>
            ‹
          </NavButton>
        </div>
        <h3 className={styles.dateCalTitle} aria-live="polite">
          {calendarMonthLabel(month)}
        </h3>
        <div className={styles.dateCalNavGroup}>
          <NavButton label="Next month" disabled={false} onClick={() => onMonthChange(shiftCalendarMonth(month, 1))}>
            ›
          </NavButton>
          <NavButton label="Next year" disabled={false} onClick={() => onMonthChange(shiftCalendarMonth(month, 12))}>
            »
          </NavButton>
        </div>
      </header>

      <div className={styles.dateCalWeekdays} aria-hidden>
        {EXPLORE_CALENDAR_WEEKDAYS.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>

      <div className={styles.dateCalGrid} role="grid" aria-busy={loading}>
        {cells.map((cell, index) => {
          if (!cell) return <span key={`pad-${index}`} className={styles.dateCalPad} aria-hidden />;
          const selectable = !loading && calendarCellSelectable(cell);
          const selected = selectedDayIso === cell.iso;
          const className = [
            styles.dateCalDay,
            cell.isPast ? styles.dateCalDayPast : "",
            cell.isToday ? styles.dateCalDayToday : "",
            selected ? styles.dateCalDaySelected : "",
            !cell.isPast && !selectable ? styles.dateCalDayEmpty : "",
          ]
            .filter(Boolean)
            .join(" ");
          const countLabel =
            cell.eventCount > 0 ? `${cell.eventCount} event${cell.eventCount === 1 ? "" : "s"}` : "no dated events";
          return (
            <button
              type="button"
              key={cell.iso}
              role="gridcell"
              className={className}
              aria-pressed={selected}
              aria-label={`${cell.iso}, ${cell.isPast ? "past" : countLabel}`}
              disabled={!selectable}
              onClick={() => onSelectDay(cell.iso)}
            >
              <span className={styles.dateCalDayNum}>{cell.dayNum}</span>
              {!cell.isPast && cell.eventCount > 0 ? (
                <span className={styles.dateCalCount}>{cell.eventCount}</span>
              ) : (
                <span className={styles.dateCalCountEmpty} aria-hidden>
                  &nbsp;
                </span>
              )}
            </button>
          );
        })}
      </div>

      <footer className={styles.dateCalFoot}>
        <p className={styles.dateCalHint}>
          {loading
            ? "Loading event counts for your area…"
            : monthTotal > 0
              ? `${monthTotal} dated event${monthTotal === 1 ? "" : "s"} loaded in your area this month. Places stay in the feed when you pick a day.`
              : "No dated events loaded in your area for this month yet."}
        </p>
        <div className={styles.dateCalActions}>
          {selectedDayIso ? (
            <button type="button" className={styles.calendarClear} onClick={onClearDay}>
              Clear day
            </button>
          ) : null}
          <button type="button" className={styles.calendarClear} onClick={onClose}>
            Close
          </button>
        </div>
      </footer>
    </section>
  );
}
