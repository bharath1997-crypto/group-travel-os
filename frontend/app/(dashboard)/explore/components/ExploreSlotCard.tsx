"use client";

import { useState } from "react";
import type { ExploreSlotCard as ExploreSlotCardType } from "../explore-fixtures";
import { cardRatingDisplay } from "../explore-card-copy";
import { ExploreProviderBadge } from "./ExploreProviderBadge";
import { photoCreditText } from "../explore-photo-credit";
import styles from "../explore.module.css";

type ExploreSlotCardProps = {
  slot: ExploreSlotCardType;
  onOpen: (id: string) => void;
  isSaved?: boolean;
};

export function ExploreSlotCard({ slot, onOpen, isSaved = false }: ExploreSlotCardProps) {
  const ratingLabel = cardRatingDisplay(slot.rating);
  const [photoFailed, setPhotoFailed] = useState(false);
  const showPhoto = Boolean(slot.imageUrl) && !photoFailed;
  const compactText = !showPhoto && !slot.overlayTitle;

  return (
    <button
      type="button"
      className={`${styles.slotCard} ${compactText ? styles.slotCardCompact : ""}`}
      onClick={() => onOpen(slot.id)}
    >
      {!compactText ? (
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
          ) : slot.imageLabel ? (
            <span className={styles.slotMediaLabel}>{slot.imageLabel}</span>
          ) : null}
          {showPhoto && slot.imageCredit ? (
            <span className={styles.slotPhotoCredit}>{photoCreditText(slot.imageCredit)}</span>
          ) : null}
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
      ) : null}
      {!slot.overlayTitle ? (
        <span className={`${styles.slotBody} ${compactText ? styles.slotBodyCompact : ""}`}>
          {compactText ? (
            <>
              <span className={styles.slotCompactProvider}>
                <ExploreProviderBadge label={slot.source} variant="dark" layout="inline" />
              </span>
              {isSaved ? <span className={styles.slotSavedMarkCompact}>Saved</span> : null}
              {slot.badge ? (
                <span className={styles.slotCompactBadge}>
                  <ExploreProviderBadge
                    label={slot.badge}
                    variant={slot.badgeVariant ?? "neutral"}
                    layout="inline"
                  />
                </span>
              ) : null}
              <span className={styles.slotTitle}>{slot.title}</span>
              {slot.meta ? <span className={styles.slotMeta}>{slot.meta}</span> : null}
              {slot.area ? <span className={styles.slotCompactArea}>{slot.area}</span> : null}
              {slot.distanceLabel ? (
                <span className={styles.slotCompactDistance}>{slot.distanceLabel}</span>
              ) : null}
              {slot.reason ? <span className={styles.slotReason}>{slot.reason}</span> : null}
            </>
          ) : (
            <>
              <span className={styles.slotMeta}>{slot.meta}</span>
              <span className={styles.slotTitle}>{slot.title}</span>
              {slot.summary ? <span className={styles.slotSummary}>{slot.summary}</span> : null}
              {slot.reason ? <span className={styles.slotReason}>{slot.reason}</span> : null}
            </>
          )}
          <span className={styles.slotFooter}>
            <span className={styles.slotPrice}>{slot.price}</span>
            {!compactText ? <span className={styles.slotNote}>{slot.note}</span> : null}
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
