"use client";

import type { ExploreRankingRow as ExploreRankingRowType } from "../explore-fixtures";
import styles from "../explore.module.css";

type ExploreRankingRowProps = {
  row: ExploreRankingRowType;
  onOpen: (id: string) => void;
};

export function ExploreRankingRow({ row, onOpen }: ExploreRankingRowProps) {
  const availabilityClass =
    row.availabilityTone === "urgency"
      ? styles.rankAvailabilityUrgency
      : row.availabilityTone === "accent"
        ? styles.rankAvailabilityAccent
        : styles.rankAvailabilityMuted;

  return (
    <button type="button" className={styles.rankRow} onClick={() => onOpen(row.id)}>
      <span className={styles.rankIndex}>{row.rank}</span>
      <span className={styles.rankPlace}>
        <span className={styles.rankTitle}>{row.title}</span>
        <span className={styles.rankSubtitle}>{row.subtitle}</span>
      </span>
      <span className={styles.rankRatingCol}>
        <span className={styles.rankRating}>{row.rating}</span>
        <span className={styles.rankReviews}>{row.reviews}</span>
      </span>
      <span className={styles.rankDistance}>{row.distance}</span>
      <span className={styles.rankPrice}>{row.price}</span>
      <span className={`${styles.rankAvailability} ${availabilityClass}`}>{row.availability}</span>
    </button>
  );
}
