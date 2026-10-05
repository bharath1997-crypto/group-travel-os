"use client";

import Link from "next/link";

import { buildLiveDirectionsHref } from "@/app/(dashboard)/live/live-explore-deeplink";
import type { ExploreSlotDetail } from "../explore-fixtures";
import { drawerHoursSourceLabel } from "../explore-availability-copy";
import {
  EXPLORE_PHOTO_UNAVAILABLE,
  EXPLORE_PROVIDER_INDEPENDENCE_NOTE,
  exploreDrawerProviderActionLabel,
  exploreScaperProviderLinkLabel,
  exploreVerifiedRatingLine,
} from "../explore-listing-field-state";
import { openExploreListingUrl } from "../explore-open-listing";
import styles from "../explore.module.css";
import { ExploreDrawerMap } from "./ExploreDrawerMap";
import { ExploreDrawerPhotoUpload } from "./ExploreDrawerPhotoUpload";
import { photoCreditText } from "../explore-photo-credit";
import { explorePhoneHref } from "../explore-place-actions";

type ExploreDetailDrawerProps = {
  detail: ExploreSlotDetail | null;
  onClose: () => void;
  onSave: (id: string) => void;
  saveState?: "idle" | "saving" | "saved" | "error";
  saveError?: string | null;
  isSaved?: boolean;
};

export function ExploreDetailDrawer({
  detail,
  onClose,
  onSave,
  saveState = "idle",
  saveError,
  isSaved = false,
}: ExploreDetailDrawerProps) {
  if (!detail) return null;

  const bookLabel = exploreDrawerProviderActionLabel({
    source: detail.source,
    sourceUrl: detail.sourceUrl,
    editorial: detail.editorial,
    priceKnown: detail.priceKnown,
    priceLabel: detail.price,
    listingKind: detail.listingKind,
  });
  const canBook = bookLabel !== "No booking link";
  const scaperTicketHref =
    detail.listingKind === "event" && detail.sourceUrl?.trim()
      ? detail.sourceUrl.trim()
      : null;
  const showProviderIndependence =
    detail.listingKind === "event" && Boolean(exploreScaperProviderLinkLabel(detail.source));
  const hasPin = typeof detail.lat === "number" && typeof detail.lng === "number";
  const fullAddress = detail.address?.trim() || null;
  const liveDirectionsHref = hasPin
    ? buildLiveDirectionsHref({
        gersId: detail.listingKind === "place" ? detail.id : null,
        lat: detail.lat,
        lng: detail.lng,
        name: detail.title,
        address: fullAddress,
      })
    : null;
  const phoneHref = explorePhoneHref(detail.phone);
  const ratingLine = exploreVerifiedRatingLine(detail.rating, undefined);
  const heroStyle = detail.imageUrl
    ? { backgroundImage: `url(${detail.imageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
    : undefined;

  return (
    <div className={styles.drawerOverlay} onClick={onClose} role="presentation">
      <aside
        className={styles.drawerPanel}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={detail.title}
      >
        <div className={styles.drawerHero} style={heroStyle}>
          {!detail.imageUrl ? (
            <span className={styles.drawerHeroLabel}>{EXPLORE_PHOTO_UNAVAILABLE}</span>
          ) : null}
          <button type="button" className={styles.drawerClose} onClick={onClose} aria-label="Close">
            ×
          </button>
          <span className={styles.drawerSource}>{detail.source}</span>
          {detail.imageUrl && detail.imageCredit ? (
            detail.imageCredit.sourceUrl ? (
              <a
                href={detail.imageCredit.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.drawerPhotoCredit}
              >
                {photoCreditText(detail.imageCredit)}
              </a>
            ) : (
              <span className={styles.drawerPhotoCredit}>{photoCreditText(detail.imageCredit)}</span>
            )
          ) : null}
          <div className={styles.drawerHeroCopy}>
            <span className={styles.slotMeta}>{detail.meta}</span>
            <h2 className={styles.drawerTitle}>{detail.title}</h2>
          </div>
        </div>
        <div className={styles.drawerContent}>
          <div className={styles.drawerPriceRow}>
            <span className={styles.drawerPrice}>{detail.price}</span>
            <span className={styles.drawerPriceNote}>{detail.note}</span>
            {ratingLine ? <span className={styles.drawerRating}>{ratingLine}</span> : null}
          </div>
          <p className={styles.drawerBody}>{detail.body}</p>
          <div className={styles.drawerTags}>
            {detail.tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
          {hasPin ? (
            <ExploreDrawerMap lat={detail.lat as number} lng={detail.lng as number} label={detail.title} />
          ) : detail.area?.trim() ? (
            <div className={styles.drawerMap}>
              <span>{detail.area}</span>
              <span className={styles.drawerMapDot} aria-hidden />
            </div>
          ) : null}
          {fullAddress || phoneHref || liveDirectionsHref ? (
            <div className={styles.drawerPlaceInfo}>
              {fullAddress ? <p className={styles.drawerAddress}>{fullAddress}</p> : null}
              {detail.phone && phoneHref ? <p className={styles.drawerPhone}>{detail.phone}</p> : null}
              <div className={styles.drawerPlaceActions}>
                {liveDirectionsHref ? (
                  <Link href={liveDirectionsHref} className={styles.drawerChip}>
                    Directions
                  </Link>
                ) : null}
                {phoneHref ? (
                  <a href={phoneHref} className={styles.drawerChip}>
                    Call
                  </a>
                ) : null}
                {detail.sourceUrl ? (
                  <a href={detail.sourceUrl} target="_blank" rel="noopener noreferrer" className={styles.drawerChip}>
                    Website
                  </a>
                ) : null}
              </div>
            </div>
          ) : null}
          {detail.listingKind === "place" ? <ExploreDrawerPhotoUpload placeId={detail.id} /> : null}
          <div className={styles.drawerSectionLabel}>
            {detail.openingHours
              ? `Hours · ${drawerHoursSourceLabel(detail.hoursSource)}`
              : "Hours unknown"}
          </div>
          {detail.openingHours ? (
            <p className={styles.drawerBody}>{detail.openingHours}</p>
          ) : null}
          <div className={styles.drawerActions}>
            {scaperTicketHref ? (
              <a
                href={scaperTicketHref}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.drawerBook}
                title={bookLabel}
              >
                {bookLabel}
              </a>
            ) : (
              <button
                type="button"
                className={styles.drawerBook}
                disabled={!canBook}
                title={canBook ? "Open provider booking page" : "No verified booking link for this listing"}
                onClick={() => openExploreListingUrl(detail.sourceUrl)}
              >
                {bookLabel}
              </button>
            )}
            <button
              type="button"
              className={styles.drawerSave}
              onClick={() => onSave(detail.id)}
              disabled={saveState === "saving"}
              aria-label={isSaved || saveState === "saved" ? "Saved to Collection" : "Save to Collection"}
              title={
                saveError ||
                (saveState === "saving"
                  ? "Saving…"
                  : isSaved || saveState === "saved"
                    ? "Saved to My Space"
                    : "Save to My Space")
              }
            >
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill={isSaved || saveState === "saved" ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M6 3.5h12v17l-6-3.4-6 3.4z" />
              </svg>
            </button>
          </div>
          {saveState === "error" && saveError ? (
            <p className={styles.drawerSaveError} role="alert">
              {saveError}{" "}
              <button type="button" className={styles.drawerSaveRetry} onClick={() => onSave(detail.id)}>
                Retry
              </button>
            </p>
          ) : null}
          {showProviderIndependence ? (
            <p className={styles.drawerProviderNote}>{EXPLORE_PROVIDER_INDEPENDENCE_NOTE}</p>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
