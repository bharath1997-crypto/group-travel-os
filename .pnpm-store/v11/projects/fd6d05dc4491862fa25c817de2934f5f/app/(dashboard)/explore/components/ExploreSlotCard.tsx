"use client";

import { useState } from "react";
import type { ExploreSlotCard as ExploreSlotCardType } from "../explore-fixtures";
import { cardRatingDisplay } from "../explore-card-copy";
import { EXPLORE_PHOTO_UNAVAILABLE } from "../explore-listing-field-state";
import { ExploreProviderBadge } from "./ExploreProviderBadge";
import styles from "../explore.module.css";

type ExploreSlotCardProps = {
  slot: ExploreSlotCardType;
  onOpen: (id: string) => void;
  isSaved?: boolean;
};

export function ExploreSlotCard({ slot, onOpen, isSaved = false }: ExploreSlotCardProps) {
  const ratingLabel = cardRatingDisplay(slot.rating);
  const [photoFailed, setPhotoFailed] = useState(false);
  const photoLabel = slot.imageLabel || EXPLORE_PHOTO_UNAVAILABLE;
  const showPhoto = Boolean(slot.imageUrl) && !photoFailed;

  return (
    <button
      type="button"
      className={`${styles.slotCard} ${!showPhoto ? styles.slotCardNoPhoto : ""}`}
      onClick={() => onOpen(slot.id)}
    >
      <span className={styles.slotMedia} style={{ height: slot.imageHeight }}>
        {showPhoto ? (
          // Provider image URLs are dynamic per listing.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={slot.imageUrl ?? undefined}
            alt=""
            className={styles.slotPhoto}
            loading="lazy"
            decoding="async"
            onError={() => setPhotoFailed(true)}
          />
        ) : (
          <span className={styles.slotMediaLabel}>{photoLabel}</span>
        )}
        {isSaved ? <span className={styles.slotSavedMark}>Saved</span> : null}
        {!slot.overlayTitle ? <ExploreProviderBadge label={slot.source} variant="dark" /> : null}
        {slot.badge ? (
          <ExploreProviderBadge
            label={slot.badge}
            variant={slot.badgeVariant ?? "neutral"}
            align={slot.overlayTitle ? "left" : "right"}
          />
        ) : null}
        {slot.overlayTitle ? (
          <span className={styles.slotOverlayTitle}>
            <span className={styles.slotMeta}>{slot.meta}</span>
            <span className={styles.slotOverlayHeading}>{slot.title}</span>
          </span>
        ) : null}
      </span>
      {!slot.overlayTitle ? (
        <span className={styles.slotBody}>
          <span className={styles.slotMeta}>{slot.meta}</span>
          <span className={styles.slotTitle}>{slot.title}</span>
          {slot.summary ? <span className={styles.slotSummary}>{slot.summary}</span> : null}
          {slot.reason ? <span className={styles.slotReason}>{slot.reason}</span> : null}
          <span className={styles.slotFooter}>
            <span className={styles.slotPrice}>{slot.price}</span>
            <span className={styles.slotNote}>{slot.note}</span>
            {ratingLabel ? <span className={styles.slotRating}>{ratingLabel}</span> : null}
          </span>
        </span>
      ) : (
        <span className={styles.slotBody}>
          {slot.summary ? <span className={styles.slotSummary}>{slot.summary}</span> : null}
          <span className={styles.slotFooter}>
            <span className={styles.slotPrice}>{slot.price}</span>
            <span className={styles.slotNote}>{slot.note}</span>
            {ratingLabel ? <span className={styles.slotRating}>{ratingLabel}</span> : null}
          </span>
        </span>
      )}
    </button>
  );
}
