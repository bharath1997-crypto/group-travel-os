"use client";

import { useState } from "react";
import type { ExploreSlotCard as ExploreSlotCardType } from "../explore-fixtures";
import { cardRatingDisplay } from "../explore-card-copy";
import {
  eventCardVenueLine,
  eventCardWhenLine,
  exploreFeedCardPriceLine,
  placeCardCategoryLine,
  placeCardStreetLine,
  showExploreCardProviderBadge,
} from "../explore-card-display";
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
  const isPlace = slot.listingKind === "place";
  const isEvent = slot.listingKind === "event";
  const showProviderBadge = showExploreCardProviderBadge(slot);
  const cardPrice = exploreFeedCardPriceLine(slot);

  const compactPlaceLines = isPlace ? (
    <>
      <span className={styles.slotTitle}>{slot.title}</span>
      {placeCardCategoryLine(slot) ? (
        <span className={styles.slotMeta}>{placeCardCategoryLine(slot)}</span>
      ) : null}
      {placeCardStreetLine(slot.area, slot.placeAddress) ? (
        <span className={styles.slotCompactArea}>{placeCardStreetLine(slot.area, slot.placeAddress)}</span>
      ) : null}
      {slot.distanceLabel ? (
        <span className={styles.slotCompactDistance}>{slot.distanceLabel}</span>
      ) : null}
      {slot.reason ? <span className={styles.slotReason}>{slot.reason}</span> : null}
    </>
  ) : null;

  const compactEventLines = isEvent ? (
    <>
      <span className={styles.slotTitle}>{slot.title}</span>
      {eventCardWhenLine(slot) ? (
        <span className={styles.slotMeta}>{eventCardWhenLine(slot)}</span>
      ) : null}
      {eventCardVenueLine(slot) ? (
        <span className={styles.slotCompactArea}>{eventCardVenueLine(slot)}</span>
      ) : null}
      {slot.distanceLabel ? (
        <span className={styles.slotCompactDistance}>{slot.distanceLabel}</span>
      ) : null}
      {slot.reason ? <span className={styles.slotReason}>{slot.reason}</span> : null}
    </>
  ) : null;

  const compactFallbackLines = !isPlace && !isEvent ? (
    <>
      <span className={styles.slotTitle}>{slot.title}</span>
      {slot.meta ? <span className={styles.slotMeta}>{slot.meta}</span> : null}
      {slot.area ? <span className={styles.slotCompactArea}>{slot.area}</span> : null}
      {slot.distanceLabel ? (
        <span className={styles.slotCompactDistance}>{slot.distanceLabel}</span>
      ) : null}
      {slot.reason ? <span className={styles.slotReason}>{slot.reason}</span> : null}
    </>
  ) : null;

  const photoBodyLines = isPlace ? (
    <>
      <span className={styles.slotMeta}>{placeCardCategoryLine(slot)}</span>
      <span className={styles.slotTitle}>{slot.title}</span>
      {placeCardStreetLine(slot.area, slot.placeAddress) ? (
        <span className={styles.slotSummary}>{placeCardStreetLine(slot.area, slot.placeAddress)}</span>
      ) : null}
      {slot.reason ? <span className={styles.slotReason}>{slot.reason}</span> : null}
    </>
  ) : isEvent ? (
    <>
      <span className={styles.slotMeta}>{eventCardWhenLine(slot)}</span>
      <span className={styles.slotTitle}>{slot.title}</span>
      {eventCardVenueLine(slot) ? (
        <span className={styles.slotSummary}>{eventCardVenueLine(slot)}</span>
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
  );

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
          {!slot.overlayTitle && showProviderBadge ? (
            <ExploreProviderBadge label={slot.source} variant="dark" />
          ) : null}
          {slot.badge && !isPlace ? (
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
              {showProviderBadge ? (
                <span className={styles.slotCompactProvider}>
                  <ExploreProviderBadge label={slot.source} variant="dark" layout="inline" />
                </span>
              ) : null}
              {isSaved ? <span className={styles.slotSavedMarkCompact}>Saved</span> : null}
              {slot.badge && !isPlace ? (
                <span className={styles.slotCompactBadge}>
                  <ExploreProviderBadge
                    label={slot.badge}
                    variant={slot.badgeVariant ?? "neutral"}
                    layout="inline"
                  />
                </span>
              ) : null}
              {isPlace ? compactPlaceLines : isEvent ? compactEventLines : compactFallbackLines}
            </>
          ) : (
            photoBodyLines
          )}
          {cardPrice || ratingLabel ? (
            <span className={styles.slotFooter}>
              {cardPrice ? <span className={styles.slotPrice}>{cardPrice}</span> : null}
              {!compactText && !isPlace && !isEvent ? (
                <span className={styles.slotNote}>{slot.note}</span>
              ) : null}
              {ratingLabel ? <span className={styles.slotRating}>{ratingLabel}</span> : null}
            </span>
          ) : null}
        </span>
      ) : (
        <span className={styles.slotBody}>
          {slot.summary ? <span className={styles.slotSummary}>{slot.summary}</span> : null}
          <span className={styles.slotFooter}>
            {cardPrice ? <span className={styles.slotPrice}>{cardPrice}</span> : null}
            <span className={styles.slotNote}>{slot.note}</span>
            {ratingLabel ? <span className={styles.slotRating}>{ratingLabel}</span> : null}
          </span>
        </span>
      )}
    </button>
  );
}
