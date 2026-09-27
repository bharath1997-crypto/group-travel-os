"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  AtSign,
  Bookmark,
  Camera,
  Clock3,
  Compass,
  MapPin,
  MessageCircle,
  Sparkles,
  ThumbsUp,
  Users,
} from "lucide-react";
import styles from "./PlacePanel.module.css";
import type { Place, PlaceDistance, PlaceSeed } from "./place-panel-types";
import {
  buildMapCropBackgroundPosition,
  buildMapCropTileUrl,
  MAP_CROP_ZOOM_LEVEL,
} from "./place-panel-map-tile";
import {
  buildCategorySubtitle,
  buildPlacePanelSections,
  categoryGlyphLabel,
  formatHoldSeatsLabel,
  formatReviewCount,
  formatRollUp,
  mergePlaceSeed,
  orderGroupTags,
  photoPublicUrl,
  shouldShowLivePreviewChrome,
} from "./place-panel-display";
import { formatPlaceSubtitle } from "./live-place-display";
import PlacePanelLiveChrome, { type PlacePanelLiveChromeProps } from "./PlacePanelLiveChrome";
import { usePlacePanelFocus } from "./use-place-panel-focus";

export type PlacePanelProps = {
  /** Instant header fields from the map feature. */
  seed: PlaceSeed;
  /** Detail fetch result — merges over seed as it arrives. */
  detail?: Partial<Place> | null;
  distance?: PlaceDistance | null;
  groupSize?: number;
  inPlan?: boolean;
  open?: boolean;
  onClose: () => void;
  onDirections?: () => void;
  onTogglePlan?: () => void;
  onAskGroup?: () => void;
  onHoldSeats?: () => void;
  onReviewFirst?: () => void;
  onAddHours?: () => void;
  onAskTier1?: () => void;
  onSuggestEdit?: () => void;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
  /** Mobile thin-preview chrome — tabs, group section, travel footer. */
  liveChrome?: PlacePanelLiveChromeProps | null;
  className?: string;
  style?: CSSProperties;
};

function formatReviewDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function useIsSheetLayout(): boolean {
  const [isSheet, setIsSheet] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(max-width: 639px)");
    const sync = () => setIsSheet(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return isSheet;
}

export default function PlacePanel({
  seed,
  detail = null,
  distance = null,
  groupSize = 6,
  inPlan = false,
  open = true,
  onClose,
  onDirections,
  onTogglePlan,
  onAskGroup,
  onHoldSeats,
  onReviewFirst,
  onAddHours,
  onAskTier1,
  onSuggestEdit,
  returnFocusRef,
  liveChrome = null,
  className,
  style,
}: PlacePanelProps) {
  const place = useMemo(() => mergePlaceSeed(seed, detail), [seed, detail]);
  const sections = useMemo(
    () => buildPlacePanelSections(place, { distance, groupSize }),
    [place, distance, groupSize],
  );

  const isSheet = useIsSheetLayout();
  const containerRef = usePlacePanelFocus(open, onClose, returnFocusRef);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const dragStartY = useRef<number | null>(null);

  const mapCropStyle = useMemo(
    () => ({
      backgroundImage: `url(${buildMapCropTileUrl(place.lat, place.lon)})`,
      backgroundPosition: buildMapCropBackgroundPosition(place.lat, place.lon),
    }),
    [place.lat, place.lon],
  );

  const openPhoto = useCallback((index: number) => setLightboxIndex(index), []);
  const closePhoto = useCallback(() => setLightboxIndex(null), []);

  const showLiveChrome = Boolean(
    liveChrome && shouldShowLivePreviewChrome(sections, isSheet),
  );
  const categorySubtitle = showLiveChrome
    ? formatPlaceSubtitle(liveChrome!.preview, liveChrome!.mapZoom)
    : buildCategorySubtitle(place, liveChrome?.preview.state ?? liveChrome?.preview.country);

  const panelClass = [
    styles.panel,
    isSheet ? styles.sheet : styles.panelDesktop,
    isSheet && showLiveChrome ? styles.sheetLiveChrome : "",
    isSheet && sheetExpanded ? styles.sheetExpanded : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  function onSheetHandlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    dragStartY.current = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onSheetHandlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (dragStartY.current == null) return;
    const delta = dragStartY.current - event.clientY;
    if (delta > 48) setSheetExpanded(true);
    if (delta < -48) setSheetExpanded(false);
  }

  function onSheetHandlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    dragStartY.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  const nameId = `place-panel-name-${place.gers_id}`;

  return (
    <>
      <article
        ref={containerRef as React.RefObject<HTMLElement>}
        className={panelClass}
        style={style}
        data-place-panel
        role="dialog"
        aria-modal={isSheet ? "true" : undefined}
        aria-labelledby={nameId}
      >
        {isSheet ? (
          <div
            className={styles.sheetHandle}
            role="separator"
            aria-orientation="horizontal"
            aria-label="Drag to expand"
            onPointerDown={onSheetHandlePointerDown}
            onPointerMove={onSheetHandlePointerMove}
            onPointerUp={onSheetHandlePointerUp}
          />
        ) : null}

        <div className={isSheet ? styles.scrollBody : styles.panelBody}>
          <div className={styles.media}>
            {sections.showSlotsChip ? (
              <div className={styles.slotsChip}>
                <span className={styles.slotsDot} aria-hidden />
                {place.slots_tonight} slots tonight
              </div>
            ) : null}

            {sections.mediaMode === "grid" ? (
              <div className={styles.photoGrid}>
                <div className={styles.photoGridLeft}>
                  <button
                    type="button"
                    className={styles.photoCell}
                    onClick={() => openPhoto(0)}
                    aria-label={`Photo 1 of ${place.photos.length}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photoPublicUrl(sections.photoGrid[0]!.key_prefix)} alt="" />
                  </button>
                </div>
                <div className={styles.photoGridRight}>
                  {sections.photoGrid.slice(1).map((photo, index) => {
                    const photoIndex = index + 1;
                    const isLast = photoIndex === 2;
                    return (
                      <button
                        key={photo.id}
                        type="button"
                        className={styles.photoCell}
                        onClick={() => openPhoto(photoIndex)}
                        aria-label={`Photo ${photoIndex + 1} of ${place.photos.length}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photoPublicUrl(photo.key_prefix)} alt="" />
                        {isLast && sections.photoOverflow > 0 ? (
                          <span className={styles.photoOverflow}>+{sections.photoOverflow}</span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {sections.mediaMode === "single" ? (
              <button
                type="button"
                className={styles.singlePhoto}
                onClick={() => openPhoto(0)}
                aria-label={`Photo 1 of ${sections.singlePhotoCount}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoPublicUrl(place.photos[0]!.key_prefix)} alt="" />
                <span className={styles.photoCountChip}>
                  1 of {sections.singlePhotoCount}
                </span>
              </button>
            ) : null}

            {sections.mediaMode === "map-crop" && showLiveChrome ? (
              <div className={styles.emptyPhotoHero}>
                <div className={styles.emptyPhotoPin} aria-hidden>
                  <MapPin size={22} strokeWidth={2} />
                </div>
                <p className={styles.emptyPhotoCategory}>{place.category_label || "Place"}</p>
                <p className={styles.emptyPhotoCaption}>
                  <Camera size={14} strokeWidth={2} aria-hidden />
                  No Rovvy photos yet
                </p>
              </div>
            ) : null}

            {sections.mediaMode === "map-crop" && !showLiveChrome ? (
              <div className={styles.mapCrop} style={mapCropStyle}>
                <div className={styles.mapCropGrid} aria-hidden />
                <div className={styles.mapPin} aria-hidden />
                <span className={styles.mapCaption}>
                  map tile · z{MAP_CROP_ZOOM_LEVEL} · no photo on file
                </span>
              </div>
            ) : null}
          </div>

          <header className={styles.header}>
            <div className={styles.categoryGlyph} aria-hidden>
              {categoryGlyphLabel(place.category, place.category_label)}
            </div>
            <div className={styles.headerText}>
              <h2 id={nameId} className={styles.placeName}>
                {place.name}
              </h2>
              {categorySubtitle ? (
                <p className={styles.categoryLine}>{categorySubtitle}</p>
              ) : null}
              {sections.showRollUp ? (
                <div className={styles.rollUp}>
                  <ThumbsUp size={14} strokeWidth={2} aria-hidden />
                  <span className={styles.rollUpStrong}>
                    {formatRollUp(place.would_return_pct!, place.review_count)}
                  </span>
                  <span className={styles.rollUpMuted}>
                    {formatReviewCount(place.review_count)}
                  </span>
                </div>
              ) : null}
            </div>
            {sections.showClaimedBadge ? (
              <span className={styles.claimedBadge}>Claimed</span>
            ) : null}
            <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
              ×
            </button>
          </header>

          {!showLiveChrome ? (
            <div className={styles.actionRow}>
              <button type="button" className={styles.actionCell} onClick={onDirections}>
                <Compass size={20} strokeWidth={2} aria-hidden />
                <span className={styles.actionLabel}>Directions</span>
              </button>
              <button
                type="button"
                className={`${styles.actionCell} ${inPlan ? styles.actionCellPressed : ""}`}
                onClick={onTogglePlan}
                aria-pressed={inPlan}
              >
                <Bookmark size={20} strokeWidth={2} aria-hidden />
                <span className={styles.actionLabel}>{inPlan ? "In plan" : "Add to plan"}</span>
              </button>
              <button type="button" className={styles.actionCell} onClick={onAskGroup}>
                <Users size={20} strokeWidth={2} aria-hidden />
                <span className={styles.actionLabel}>Ask group</span>
              </button>
            </div>
          ) : null}

          {!showLiveChrome && isSheet ? (
            <div className={styles.sheetPrimaryRow}>
              <button
                type="button"
                className={`${styles.sheetPrimaryBtn} ${styles.sheetPrimaryBtnGrad} ${inPlan ? styles.actionCellPressed : ""}`}
                onClick={onTogglePlan}
                aria-pressed={inPlan}
              >
                {inPlan ? "In plan" : "Add to plan"}
              </button>
              <button
                type="button"
                className={`${styles.sheetPrimaryBtn} ${styles.sheetPrimaryBtnTint}`}
                onClick={onDirections}
              >
                Directions
              </button>
            </div>
          ) : null}

          {!showLiveChrome && isSheet ? (
            <div className={styles.sheetAskGroup}>
              <button type="button" className={styles.actionCell} onClick={onAskGroup}>
                <MessageCircle size={20} strokeWidth={2} aria-hidden />
                <span className={styles.actionLabel}>Ask group</span>
              </button>
            </div>
          ) : null}

          {showLiveChrome && liveChrome ? (
            <PlacePanelLiveChrome {...liveChrome} />
          ) : null}

          <div className={isSheet && showLiveChrome ? undefined : isSheet ? undefined : styles.scrollMiddle}>
          {!showLiveChrome && sections.showDescription ? (
            <section className={styles.section}>
              <p className={styles.description}>{place.short_description}</p>
              {place.description_source ? (
                <p className={styles.descriptionSource}>
                  {place.description_url ? (
                    <a href={place.description_url} className={styles.detailLink}>
                      {place.description_source}
                    </a>
                  ) : (
                    place.description_source
                  )}
                </p>
              ) : null}
            </section>
          ) : null}

          {!showLiveChrome && sections.detailRows.length > 0 ? (
            <ul className={styles.detailList}>
              {sections.detailRows.map((row) => {
                if (row.kind === "hours") {
                  return (
                    <li key="hours" className={styles.detailRow}>
                      <Clock3 className={styles.detailIcon} aria-hidden />
                      <span>
                        <span className={row.status === "open" ? styles.detailOpen : styles.detailClosed}>
                          {row.statusWord}
                        </span>
                        {row.rest ? ` ${row.rest}` : ""}
                      </span>
                    </li>
                  );
                }
                if (row.kind === "address") {
                  return (
                    <li key="address" className={styles.detailRow}>
                      <MapPin className={styles.detailIcon} aria-hidden />
                      <span>{row.text}</span>
                    </li>
                  );
                }
                if (row.kind === "instagram") {
                  return (
                    <li key="instagram" className={styles.detailRow}>
                      <AtSign className={styles.detailIcon} aria-hidden />
                      <a
                        href={row.href}
                        className={styles.detailLink}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        @{row.handle}
                      </a>
                    </li>
                  );
                }
                return (
                  <li key="distance" className={styles.detailRow}>
                    <Compass className={styles.detailIcon} aria-hidden />
                    <span>{row.text}</span>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {!showLiveChrome && sections.showGroupTags ? (
            <section className={styles.section}>
              <p className={styles.sectionLabel}>Good for your group</p>
              <div className={styles.tagList}>
                {orderGroupTags(place.group_tags).map((tag) => (
                  <span
                    key={tag.label}
                    className={`${styles.tag} ${tag.tone === "warn" ? styles.tagWarn : styles.tagNeutral}`}
                  >
                    {tag.label}
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          {!showLiveChrome && sections.showLatestReview && place.latest_review ? (
            <section className={styles.section}>
              <p className={styles.sectionLabel}>Latest</p>
              <blockquote className={styles.reviewBlock}>
                <p className={styles.reviewText}>{place.latest_review.text}</p>
                <div className={styles.reviewMeta}>
                  <span className={styles.reviewAvatar} aria-hidden>
                    {place.latest_review.author_initials}
                  </span>
                  <div className={styles.reviewWhen}>
                    {place.latest_review.author_name}
                    {" · "}
                    {formatReviewDate(place.latest_review.visited_at)}
                    {place.latest_review.wait_minutes != null
                      ? ` · ${place.latest_review.wait_minutes} min wait`
                      : ""}
                  </div>
                </div>
              </blockquote>
            </section>
          ) : null}
          </div>

          <div className={isSheet && showLiveChrome ? undefined : isSheet ? undefined : styles.pinnedBottom}>
          {!showLiveChrome && sections.cta?.kind === "hold-seats" ? (
            <button type="button" className={styles.ctaHold} onClick={onHoldSeats}>
              <Sparkles size={16} strokeWidth={2} aria-hidden />
              {formatHoldSeatsLabel(sections.cta.seatCount, place.next_slot)}
            </button>
          ) : null}

          {!showLiveChrome && sections.cta?.kind === "tier0-empty" ? (
            <div className={styles.emptyBlock}>
              <h3 className={styles.emptyHeading}>{sections.cta.heading}</h3>
              <p className={styles.emptyBody}>{sections.cta.body}</p>
              <div className={styles.emptyActions}>
                <button type="button" className={styles.btnPrimary} onClick={onReviewFirst}>
                  Review it first
                </button>
                <button type="button" className={styles.btnOutline} onClick={onAddHours}>
                  Add hours
                </button>
              </div>
            </div>
          ) : null}

          {!showLiveChrome && sections.cta?.kind === "tier1-empty" ? (
            <div className={styles.emptyBlock}>
              <h3 className={styles.emptyHeading}>{sections.cta.heading}</h3>
              <p className={styles.emptyBody}>{sections.cta.body}</p>
              <div className={styles.emptyActionsInline}>
                <span />
                <button type="button" className={styles.btnAsk} onClick={onAskTier1}>
                  Ask
                </button>
              </div>
            </div>
          ) : null}

          {!showLiveChrome ? (
            <footer className={styles.footer}>
              <p className={styles.provenance}>{sections.provenance}</p>
              <button type="button" className={styles.suggestEdit} onClick={onSuggestEdit}>
                Suggest an edit
              </button>
            </footer>
          ) : null}
          </div>
        </div>
      </article>

      {lightboxIndex != null && place.photos[lightboxIndex] ? (
        <div className={styles.lightbox} role="dialog" aria-label="Photo viewer">
          <button
            type="button"
            className={styles.lightboxClose}
            onClick={closePhoto}
            aria-label="Close photo"
          >
            ×
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoPublicUrl(place.photos[lightboxIndex].key_prefix)}
            alt={`${place.name} photo ${lightboxIndex + 1}`}
          />
        </div>
      ) : null}
    </>
  );
}
