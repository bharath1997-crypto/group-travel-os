"use client";

import type { ExploreRankingRow as ExploreRankingRowType } from "../explore-fixtures";
import styles from "../explore.module.css";

type ExploreRankingRowProps = {
  row: ExploreRankingRowType;
  onOpen: (id: string) => void;
};

export function ExploreRankingRow({ row, onOpen }: ExploreRankingRowProps) {
  return (
    <button type="button" className={styles.rankRow} onClick={() => onOpen(row.id)}>
      <span className={styles.rankPlace}>
        <span className={styles.rankTitle}>{row.title}</span>
        <span className={styles.rankSubtitle}>{row.subtitle}</span>
      </span>
      <span className={styles.rankPrice}>{row.price}</span>
      <span className={`${styles.rankAvailability} ${styles.rankAvailabilityMuted}`}>{row.availability}</span>
    </button>
  );
}
