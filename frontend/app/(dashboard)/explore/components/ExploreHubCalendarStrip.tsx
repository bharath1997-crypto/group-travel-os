"use client";

import type { ExploreCalendarDaySummary } from "../explore-hub-time-scope";

import styles from "../explore.module.css";

type ExploreHubCalendarStripProps = {
  days: ExploreCalendarDaySummary[];
  selectedDayIso: string | null;
  onSelectDay: (iso: string) => void;
  onClearDay: () => void;
};

export function ExploreHubCalendarStrip({
  days,
  selectedDayIso,
  onSelectDay,
  onClearDay,
}: ExploreHubCalendarStripProps) {
  const visibleDays = days.filter((d) => d.eventCount > 0);
  if (visibleDays.length === 0) return null;

  return (
    <section className={styles.calendarStrip} aria-label="Events by day">
      <div className={styles.calendarStripHead}>
        <small>Calendar</small>
        {selectedDayIso ? (
          <button type="button" className={styles.calendarClear} onClick={onClearDay}>
            Clear day
          </button>
        ) : null}
      </div>
      <div className={styles.calendarRow} role="list">
        {visibleDays.map((day) => {
          const selected = selectedDayIso === day.iso;
          return (
            <button
              type="button"
              key={day.iso}
              role="listitem"
              className={`${styles.calendarDay} ${selected ? styles.calendarDaySelected : ""}`}
              aria-pressed={selected}
              onClick={() => onSelectDay(day.iso)}
            >
              <span className={styles.calendarWeekday}>{day.weekdayLabel}</span>
              <span className={styles.calendarDayNum}>{day.dayNum}</span>
              <span className={styles.calendarCount}>{day.eventCount}</span>
            </button>
          );
        })}
      </div>
      <p className={styles.calendarHint}>
        Counts are dated events in your loaded area. Places stay in the feed when you pick a day.
      </p>
    </section>
  );
}
