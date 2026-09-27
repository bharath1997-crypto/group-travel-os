"use client";

import styles from "../explore.module.css";

export type ExploreReelPlace = {
  id: string;
  name: string;
  meta: string;
  social?: string;
  badge?: string;
  badgeVariant?: "here" | "trending" | "accent" | "light";
};

type ExploreReelPlaceCardProps = {
  place: ExploreReelPlace;
  onPick: () => void;
};

export function ExploreReelPlaceCard({ place, onPick }: ExploreReelPlaceCardProps) {
  const badgeClass =
    place.badgeVariant === "trending"
      ? styles.reelBadgeTrending
      : place.badgeVariant === "accent"
        ? styles.reelBadgeAccent
        : place.badgeVariant === "light"
          ? styles.reelBadgeLight
          : styles.reelBadgeHere;

  return (
    <button type="button" className={styles.reelCard} onClick={onPick}>
      <span className={styles.reelMediaLabel}>Explore</span>
      {place.badge ? <span className={`${styles.reelBadge} ${badgeClass}`}>{place.badge}</span> : null}
      <span className={styles.reelBody}>
        <span className={styles.reelName}>{place.name}</span>
        <span className={styles.reelMeta}>{place.meta}</span>
        {place.social ? <span className={styles.reelSocial}>{place.social}</span> : null}
      </span>
    </button>
  );
}
