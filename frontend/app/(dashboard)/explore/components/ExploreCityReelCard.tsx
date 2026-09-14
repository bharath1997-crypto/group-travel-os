"use client";

import type { ExploreCityReel } from "../explore-fixtures";
import styles from "../explore.module.css";

type ExploreCityReelCardProps = {
  city: ExploreCityReel;
  onPick: (name: string) => void;
};

export function ExploreCityReelCard({ city, onPick }: ExploreCityReelCardProps) {
  const badgeClass =
    city.badgeVariant === "trending"
      ? styles.reelBadgeTrending
      : city.badgeVariant === "accent"
        ? styles.reelBadgeAccent
        : city.badgeVariant === "light"
          ? styles.reelBadgeLight
          : styles.reelBadgeHere;

  return (
    <button type="button" className={styles.reelCard} onClick={() => onPick(city.name)}>
      <span className={styles.reelMediaLabel}>reel 600×870</span>
      {city.badge ? <span className={`${styles.reelBadge} ${badgeClass}`}>{city.badge}</span> : null}
      <span className={styles.reelBody}>
        <span className={styles.reelName}>{city.name}</span>
        <span className={styles.reelMeta}>
          {city.region} · {city.slots}
        </span>
        {city.social ? <span className={styles.reelSocial}>{city.social}</span> : null}
      </span>
    </button>
  );
}
