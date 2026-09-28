"use client";

import styles from "../explore.module.css";

type ExploreFilterChipProps = {
  label: string;
  selected?: boolean;
  onToggle: () => void;
  className?: string;
};

export function ExploreFilterChip({ label, selected, onToggle, className }: ExploreFilterChipProps) {
  return (
    <button
      type="button"
      className={`${styles.filterChip} ${selected ? styles.filterChipOn : ""} ${className ?? ""}`}
      onClick={onToggle}
      aria-pressed={selected}
    >
      {label}
    </button>
  );
}
