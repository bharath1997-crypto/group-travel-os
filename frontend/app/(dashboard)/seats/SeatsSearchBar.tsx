"use client";

import { Search } from "lucide-react";
import { useCallback } from "react";
import { SeatsLocationPicker } from "./SeatsLocationPicker";
import type { LocationPoint } from "./seats-location";
import styles from "./seats.module.css";

export type SeatsSearchState = {
  from: LocationPoint;
  to: LocationPoint;
  date: string;
  time: string;
  seats: number;
};

type Props = {
  state: SeatsSearchState;
  onStateChange: (state: SeatsSearchState) => void;
  onSearch: () => void;
  searchDisabled?: boolean;
  searchDisabledTitle?: string;
};

export function SeatsSearchBar({
  state,
  onStateChange,
  onSearch,
  searchDisabled = false,
  searchDisabledTitle,
}: Props) {
  const { from, to, date, time, seats } = state;
  const patch = useCallback(
    (partial: Partial<SeatsSearchState>) => onStateChange({ ...state, ...partial }),
    [onStateChange, state],
  );

  const submit = useCallback(() => {
    if (searchDisabled) return;
    onSearch();
  }, [onSearch, searchDisabled]);

  return (
    <form
      className={styles.searchCard}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <SeatsLocationPicker
        from={from}
        to={to}
        onFromChange={(p) => patch({ from: p })}
        onToChange={(p) => patch({ to: p })}
        layout="search"
      />
      <label className={styles.searchField}>
        <span className={`${styles.searchLabel} ${styles.mono}`}>Leaving</span>
        <div className={styles.dateTimeRow}>
          <input
            type="date"
            className={`${styles.searchValue} ${styles.mono}`}
            value={date}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => patch({ date: e.target.value })}
          />
          <input
            type="time"
            className={`${styles.searchValue} ${styles.mono}`}
            value={time}
            onChange={(e) => patch({ time: e.target.value })}
          />
        </div>
      </label>
      <div className={styles.searchField}>
        <span className={`${styles.searchLabel} ${styles.mono}`}>Seats</span>
        <div className={styles.seatsStepper}>
          <button
            type="button"
            aria-label="Fewer seats"
            onClick={() => patch({ seats: Math.max(1, seats - 1) })}
          >
            −
          </button>
          <span className={styles.mono}>
            {seats} seat{seats === 1 ? "" : "s"}
          </span>
          <button
            type="button"
            aria-label="More seats"
            onClick={() => patch({ seats: Math.min(4, seats + 1) })}
          >
            +
          </button>
        </div>
      </div>
      <button
        type="submit"
        className={styles.searchBtn}
        aria-label="Search seats"
        disabled={searchDisabled}
        title={
          searchDisabledTitle ??
          (searchDisabled ? "Confirm your route to search" : "Search seats")
        }
      >
        <Search size={20} strokeWidth={2.2} />
      </button>
    </form>
  );
}
